import { logAudit } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { updateRowById } from "@/lib/sheets";
import {
  BusinessError,
  EQUIPMENT_TAB,
  RECORDS_TAB,
  assertMutableRecord,
  assertOnlyKeys,
  assertRecordOwner,
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
  textField,
  withEquipmentLock,
} from "@/app/api/records/_lib/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Context = { params: Promise<{ recordId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireActor(["TESTER"], "POST /api/records/[recordId]/invalidate", "USE_RECORD_AMEND_OWN");
    const { recordId } = await context.params;
    const body = parseObject(await request.json());
    assertOnlyKeys(body, ["invalidation_reason"]);
    const reason = textField(body, "invalidation_reason");
    if (!reason) {
      throw new BusinessError(
        400,
        "필수 입력 항목이 누락된 경우 기록을 저장할 수 없으며 누락된 항목을 안내해야 한다. 누락 항목: 무효 사유",
      );
    }

    const result = await withEquipmentLock(recordId, async () => {
      const record = findRecord(await readRecords(), recordId);
      assertRecordOwner(record, actor);
      assertMutableRecord(record);
      const invalidatedAt = nowISO();
      const updatedRecord = {
        ...record,
        record_status: "INVALID",
        invalidated_by: actor.userId,
        invalidated_at: invalidatedAt,
        invalidation_reason: reason,
        updated_by: actor.userId,
        updated_at: invalidatedAt,
      };
      let equipmentBefore = null;
      let equipmentAfter = null;
      if (record.record_status === "IN_USE") {
        equipmentBefore = findEquipment(await readEquipment(), record.equipment_id);
        if (
          equipmentBefore.occupancy_status !== "OCCUPIED" ||
          equipmentBefore.occupancy_record_id !== record.id
        ) {
          throw new BusinessError(409, "사용중 기록의 장비 점유를 해제할 수 없어 무효 처리를 완료하지 못했습니다.");
        }
        const equipmentPatch = freeEquipmentPatch(actor);
        await updateRowById(EQUIPMENT_TAB, equipmentBefore.id, equipmentPatch);
        equipmentAfter = { ...equipmentBefore, ...equipmentPatch };
      }
      try {
        await updateRowById(RECORDS_TAB, record.id, updatedRecord);
      } catch (error) {
        if (equipmentBefore) {
          await updateRowById(EQUIPMENT_TAB, equipmentBefore.id, {
            occupancy_status: equipmentBefore.occupancy_status,
            occupancy_record_id: equipmentBefore.occupancy_record_id,
            occupied_by_user_id: equipmentBefore.occupied_by_user_id,
            occupied_by_user_name: equipmentBefore.occupied_by_user_name,
            occupied_at: equipmentBefore.occupied_at,
            updated_by: equipmentBefore.updated_by,
            updated_at: equipmentBefore.updated_at,
          });
        }
        throw error;
      }
      await logAudit({
        category: "DATA",
        actor: { id: actor.userId, name: actor.name, role: actor.role },
        action: "DATA.USAGE_INVALIDATED",
        target: `USAGE:${record.id}`,
        before: JSON.stringify({
          record: recordSnapshot(record),
          equipment: equipmentBefore ? equipmentSnapshot(equipmentBefore) : "",
        }),
        after: JSON.stringify({
          record: recordSnapshot(updatedRecord),
          equipment: equipmentAfter ? equipmentSnapshot(equipmentAfter) : "",
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
