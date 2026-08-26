import { appendRow, updateRowById } from "@/lib/sheets";
import { logAudit } from "@/lib/audit";
import {
  BusinessError,
  EQUIPMENT_TAB,
  RECORDS_TAB,
  USAGE_TYPES,
  assertListValue,
  assertOnlyKeys,
  currentKSTDate,
  equipmentSnapshot,
  errorResponse,
  findEquipment,
  freeEquipmentPatch,
  makeRecord,
  occupiedEquipmentPatch,
  parseObject,
  readEquipment,
  readRecords,
  recordSnapshot,
  requireActor,
  requireFields,
  restoreOccupancyFromActive,
  textField,
  withEquipmentLock,
} from "@/app/api/records/_lib/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const DUPLICATE_NOTICE =
  "동일 장비에 사용중 상태의 기록이 존재하는 경우 새로운 사용 시작을 등록할 수 없어야 한다.";

export async function POST(request: Request) {
  try {
    const actor = await requireActor(["TESTER"], "POST /api/records/start", "USE_RECORD_START");
    const body = parseObject(await request.json());
    assertOnlyKeys(body, ["equipment_id", "usage_type", "usage_purpose", "reference_no"]);
    const equipmentId = textField(body, "equipment_id");
    const usageType = textField(body, "usage_type");
    const usagePurpose = textField(body, "usage_purpose");
    requireFields({ 장비: equipmentId, "사용 유형": usageType, "사용 목적": usagePurpose });
    assertListValue(usageType, USAGE_TYPES, "사용 유형");

    const record = await withEquipmentLock(equipmentId, async () => {
      const equipment = findEquipment(await readEquipment(), equipmentId);
      const active = (await readRecords()).filter(
        (item) => item.equipment_id === equipmentId && item.record_status === "IN_USE",
      );
      if (
        equipment.calibration_required === "REQUIRED" &&
        equipment.calibration_due_date &&
        equipment.calibration_due_date < currentKSTDate()
      ) {
        throw new BusinessError(
          409,
          "교정 대상 장비의 교정 유효기간이 지난 경우 새로운 사용을 시작할 수 없어야 한다.",
        );
      }
      if (equipment.availability_status === "SUSPENDED" || equipment.availability_status === "RETIRED") {
        throw new BusinessError(
          409,
          "사용중지 또는 폐기 상태인 장비는 새로운 사용을 시작할 수 없어야 한다.",
        );
      }
      if (equipment.occupancy_status !== "FREE" || active.length) {
        throw new BusinessError(409, DUPLICATE_NOTICE);
      }

      const candidate = makeRecord(actor, equipment, body);
      const claim = occupiedEquipmentPatch(candidate);
      await updateRowById(EQUIPMENT_TAB, equipment.id, claim);
      const claimed = findEquipment(await readEquipment(), equipment.id);
      if (
        claimed.occupancy_status !== "OCCUPIED" ||
        claimed.occupancy_record_id !== candidate.id ||
        claimed.occupied_by_user_id !== actor.userId
      ) {
        if (claimed.occupancy_record_id === candidate.id) {
          await updateRowById(EQUIPMENT_TAB, equipment.id, freeEquipmentPatch(actor));
        }
        throw new BusinessError(409, DUPLICATE_NOTICE);
      }

      try {
        await appendRow(RECORDS_TAB, candidate);
      } catch (error) {
        const current = findEquipment(await readEquipment(), equipment.id);
        if (current.occupancy_record_id === candidate.id) {
          await updateRowById(EQUIPMENT_TAB, equipment.id, freeEquipmentPatch(actor));
        }
        throw error;
      }

      const [verifiedEquipment, verifiedRecords] = await Promise.all([readEquipment(), readRecords()]);
      const current = findEquipment(verifiedEquipment, equipment.id);
      const activeAfter = verifiedRecords.filter(
        (item) => item.equipment_id === equipment.id && item.record_status === "IN_USE",
      );
      const tokenOwned = current.occupancy_record_id === candidate.id;
      const uniqueClaim = activeAfter.length === 1 && activeAfter[0]?.id === candidate.id;
      if (!tokenOwned || !uniqueClaim) {
        await updateRowById(RECORDS_TAB, candidate.id, {
          record_status: "INVALID",
          invalidated_by: actor.userId,
          invalidated_at: new Date().toISOString(),
          invalidation_reason: "중복 시작 점유 검증 실패",
          updated_by: actor.userId,
          updated_at: new Date().toISOString(),
        });
        const afterInvalidation = findEquipment(await readEquipment(), equipment.id);
        if (afterInvalidation.occupancy_record_id === candidate.id) {
          await restoreOccupancyFromActive(equipment.id, actor);
        }
        await logAudit({
          category: "DATA",
          actor: { id: actor.userId, name: actor.name, role: actor.role },
          action: "DATA.USAGE_INVALIDATED",
          target: `USAGE:${candidate.id}`,
          before: recordSnapshot(candidate),
          after: JSON.stringify({ record_status: "INVALID", compensation: "duplicate_claim" }),
          reason: "중복 시작 점유 검증 실패",
        });
        throw new BusinessError(409, DUPLICATE_NOTICE);
      }

      await logAudit({
        category: "DATA",
        actor: { id: actor.userId, name: actor.name, role: actor.role },
        action: "DATA.USAGE_STARTED",
        target: `USAGE:${candidate.id}`,
        before: JSON.stringify({ equipment: equipmentSnapshot(equipment), record: "" }),
        after: JSON.stringify({ equipment: equipmentSnapshot(current), record: recordSnapshot(candidate) }),
      });
      return candidate;
    });

    return Response.json({ record }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
