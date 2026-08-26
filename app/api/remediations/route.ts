import { logAudit, newId } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { appendRow, updateRowById } from "@/lib/sheets";
import {
  ACTION_TYPES,
  BusinessError,
  REMEDIATIONS_TAB,
  assertListValue,
  assertOnlyKeys,
  assertRecordOwner,
  errorResponse,
  findEquipment,
  findRecord,
  parseObject,
  readEquipment,
  readRecords,
  readRemediations,
  remediationSnapshot,
  requireActor,
  requireFields,
  textField,
} from "@/app/api/records/_lib/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireActor(["ADMIN", "TESTER", "APPROVER"], "GET /api/remediations", "USE_RECORD_VIEW");
    const url = new URL(request.url);
    const equipmentId = url.searchParams.get("equipment_id")?.trim() || "";
    const sourceRecordId = url.searchParams.get("source_record_id")?.trim() || "";
    const remediations = (await readRemediations())
      .filter(
        (item) =>
          (!equipmentId || item.equipment_id === equipmentId) &&
          (!sourceRecordId || item.source_record_id === sourceRecordId),
      )
      .sort((a, b) => (b.updated_at || b.action_recorded_at).localeCompare(a.updated_at || a.action_recorded_at));
    return Response.json({ remediations });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(["TESTER"], "POST /api/remediations", "REMEDIATION_RECORD");
    const body = parseObject(await request.json());
    assertOnlyKeys(body, ["source_record_id", "action_type", "action_details"]);
    const sourceRecordId = textField(body, "source_record_id");
    const actionType = textField(body, "action_type");
    const actionDetails = textField(body, "action_details");
    requireFields({ "이상 종료 사용 기록": sourceRecordId, "조치 유형": actionType, "조치 내용": actionDetails });
    assertListValue(actionType, ACTION_TYPES, "조치 유형");

    const record = findRecord(await readRecords(), sourceRecordId);
    assertRecordOwner(record, actor);
    if (record.record_status === "IN_USE" || record.record_status === "INVALID") {
      throw new BusinessError(409, "허용되지 않은 상태 전이는 차단되어야 한다.");
    }
    if (record.after_use_status !== "ABNORMAL" || !record.abnormality_details.trim()) {
      throw new BusinessError(409, "이상 종료된 사용 기록에만 조치 내용을 기록할 수 있습니다.");
    }
    const equipment = findEquipment(await readEquipment(), record.equipment_id);
    if (equipment.availability_status !== "SUSPENDED" || equipment.occupancy_status !== "FREE") {
      throw new BusinessError(409, "사용중지 상태의 이상 장비에만 조치 내용을 기록할 수 있습니다.");
    }

    const related = (await readRemediations())
      .filter((item) => item.source_record_id === record.id)
      .sort((a, b) => (b.updated_at || b.action_recorded_at).localeCompare(a.updated_at || a.action_recorded_at));
    const latest = related[0];
    const timestamp = nowISO();
    if (latest) {
      if (latest.remediation_status !== "REJECTED") {
        throw new BusinessError(409, "현재 이상 건에는 이미 유효한 조치 기록이 있습니다.");
      }
      const updated = {
        ...latest,
        action_type: actionType,
        action_details: actionDetails,
        updated_by_id: actor.userId,
        updated_at: timestamp,
        remediation_status: "ACTION_RECORDED",
      };
      await updateRowById(REMEDIATIONS_TAB, latest.id, updated);
      await logAudit({
        category: "DATA",
        actor: { id: actor.userId, name: actor.name, role: actor.role },
        action: "DATA.REMEDIATION_RECORDED",
        target: `REMEDIATION:${latest.id}`,
        before: remediationSnapshot(latest),
        after: remediationSnapshot(updated),
        reason: "반려 후 조치 내용 보완",
      });
      return Response.json({ remediation: updated });
    }

    const remediation = {
      id: newId(),
      equipment_id: record.equipment_id,
      source_record_id: record.id,
      action_type: actionType,
      action_details: actionDetails,
      action_recorded_by_id: actor.userId,
      action_recorded_by_name: actor.name,
      action_recorded_at: timestamp,
      updated_by_id: "",
      updated_at: "",
      remediation_status: "ACTION_RECORDED",
    };
    await appendRow(REMEDIATIONS_TAB, remediation);
    await logAudit({
      category: "DATA",
      actor: { id: actor.userId, name: actor.name, role: actor.role },
      action: "DATA.REMEDIATION_RECORDED",
      target: `REMEDIATION:${remediation.id}`,
      after: remediationSnapshot(remediation),
      reason: record.abnormality_details,
    });
    return Response.json({ remediation }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
