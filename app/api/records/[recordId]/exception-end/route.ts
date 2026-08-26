import { logAudit } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { updateRowById } from "@/lib/sheets";
import {
  AFTER_USE_STATUSES,
  BusinessError,
  EQUIPMENT_TAB,
  RECORDS_TAB,
  assertListValue,
  assertOnlyKeys,
  equipmentSnapshot,
  errorResponse,
  findEquipment,
  findRecord,
  freeEquipmentPatch,
  parseObject,
  readEquipment,
  readRecords,
  recordSnapshot,
  requireActor,
  requireFields,
  textField,
  withEquipmentLock,
} from "@/app/api/records/_lib/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Context = { params: Promise<{ recordId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireActor(["ADMIN"], "POST /api/records/[recordId]/exception-end", "USE_RECORD_EXCEPTION_CLOSE");
    const { recordId } = await context.params;
    const body = parseObject(await request.json());
    assertOnlyKeys(body, ["after_use_status", "abnormality_details", "exception_reason"]);
    const afterUseStatus = textField(body, "after_use_status");
    const abnormalityDetails = textField(body, "abnormality_details");
    const reason = textField(body, "exception_reason");
    requireFields({ "사용 후 상태": afterUseStatus, "예외 종료 사유": reason });
    assertListValue(afterUseStatus, AFTER_USE_STATUSES, "사용 후 상태");
    if (afterUseStatus === "ABNORMAL" && !abnormalityDetails) {
      throw new BusinessError(400, "사용 후 상태가 '이상'인 경우 특이사항을 필수로 기록해야 한다.");
    }

    const result = await withEquipmentLock(recordId, async () => {
      const record = findRecord(await readRecords(), recordId);
      if (record.record_status !== "IN_USE") {
        throw new BusinessError(409, "사용완료 상태의 기록에는 동일한 사용 종료를 다시 등록할 수 없어야 한다.");
      }
      const equipment = findEquipment(await readEquipment(), record.equipment_id);
      if (equipment.occupancy_record_id !== record.id || equipment.occupancy_status !== "OCCUPIED") {
        throw new BusinessError(409, "허용되지 않은 상태 전이는 차단되어야 한다.");
      }
      const endedAt = nowISO();
      if (new Date(endedAt).getTime() <= new Date(record.started_at).getTime()) {
        throw new BusinessError(409, "종료일시는 시작일시 이후여야 합니다.");
      }
      const equipmentPatch = freeEquipmentPatch(
        actor,
        afterUseStatus === "ABNORMAL" ? "SUSPENDED" : undefined,
      );
      const updatedRecord = {
        ...record,
        ended_at: endedAt,
        record_status: "COMPLETED",
        after_use_status: afterUseStatus,
        abnormality_details: afterUseStatus === "ABNORMAL" ? abnormalityDetails : "",
        end_method: "EXCEPTION_END",
        exception_ended_by_id: actor.userId,
        exception_ended_by_name: actor.name,
        exception_ended_at: endedAt,
        exception_reason: reason,
        updated_by: actor.userId,
        updated_at: endedAt,
      };
      await updateRowById(EQUIPMENT_TAB, equipment.id, equipmentPatch);
      try {
        await updateRowById(RECORDS_TAB, record.id, updatedRecord);
      } catch (error) {
        await updateRowById(EQUIPMENT_TAB, equipment.id, {
          availability_status: equipment.availability_status,
          occupancy_status: equipment.occupancy_status,
          occupancy_record_id: equipment.occupancy_record_id,
          occupied_by_user_id: equipment.occupied_by_user_id,
          occupied_by_user_name: equipment.occupied_by_user_name,
          occupied_at: equipment.occupied_at,
          updated_by: equipment.updated_by,
          updated_at: equipment.updated_at,
        });
        throw error;
      }
      const updatedEquipment = { ...equipment, ...equipmentPatch };
      await logAudit({
        category: "DATA",
        actor: { id: actor.userId, name: actor.name, role: actor.role },
        action: "DATA.USAGE_EXCEPTIONALLY_TERMINATED",
        target: `USAGE:${record.id}`,
        before: JSON.stringify({ record: recordSnapshot(record), equipment: equipmentSnapshot(equipment) }),
        after: JSON.stringify({
          record: recordSnapshot(updatedRecord),
          equipment: equipmentSnapshot(updatedEquipment),
        }),
        reason,
      });
      return updatedRecord;
    });
    return Response.json({ record: result });
  } catch (error) {
    return errorResponse(error);
  }
}
