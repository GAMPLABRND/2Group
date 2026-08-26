import { logAudit, newId } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { appendRow, updateRowById } from "@/lib/sheets";
import {
  BusinessError,
  REMEDIATIONS_TAB,
  RESUME_REQUESTS_TAB,
  assertOnlyKeys,
  errorResponse,
  findEquipment,
  findRecord,
  findRemediation,
  parseObject,
  readEquipment,
  readRecords,
  readRemediations,
  readResumeRequests,
  remediationSnapshot,
  requireActor,
  resumeSnapshot,
  textField,
} from "@/app/api/records/_lib/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireActor(["ADMIN", "TESTER", "APPROVER"], "GET /api/resume-requests", "USE_RECORD_VIEW");
    const url = new URL(request.url);
    const equipmentId = url.searchParams.get("equipment_id")?.trim() || "";
    const sourceRecordId = url.searchParams.get("source_record_id")?.trim() || "";
    const resumeStatus = url.searchParams.get("resume_status")?.trim() || "";
    const requests = (await readResumeRequests())
      .filter(
        (item) =>
          (!equipmentId || item.equipment_id === equipmentId) &&
          (!sourceRecordId || item.source_record_id === sourceRecordId) &&
          (!resumeStatus || item.resume_status === resumeStatus),
      )
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at));
    return Response.json({ resume_requests: requests });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(["TESTER"], "POST /api/resume-requests", "RESUME_REQUEST");
    const body = parseObject(await request.json());
    assertOnlyKeys(body, ["remediation_id"]);
    const remediationId = textField(body, "remediation_id");
    if (!remediationId) {
      throw new BusinessError(
        400,
        "필수 입력 항목이 누락된 경우 기록을 저장할 수 없으며 누락된 항목을 안내해야 한다. 누락 항목: 조치 기록",
      );
    }
    const remediation = findRemediation(await readRemediations(), remediationId);
    if (remediation.action_recorded_by_id !== actor.userId) {
      throw new BusinessError(403, "본인이 기록한 조치에 대해서만 사용 재개를 요청할 수 있습니다.");
    }
    if (remediation.remediation_status !== "ACTION_RECORDED") {
      throw new BusinessError(409, "조치 완료 후 사용자는 장비의 사용 재개 확인을 요청할 수 있어야 한다.");
    }
    const record = findRecord(await readRecords(), remediation.source_record_id);
    if (
      record.user_id !== actor.userId ||
      record.after_use_status !== "ABNORMAL" ||
      record.record_status === "INVALID"
    ) {
      throw new BusinessError(403, "본인의 이상 종료 기록에 대해서만 사용 재개를 요청할 수 있습니다.");
    }
    const equipment = findEquipment(await readEquipment(), remediation.equipment_id);
    if (equipment.availability_status !== "SUSPENDED" || equipment.occupancy_status !== "FREE") {
      throw new BusinessError(409, "조치 완료 후 사용자는 장비의 사용 재개 확인을 요청할 수 있어야 한다.");
    }
    const history = (await readResumeRequests()).filter(
      (item) => item.source_record_id === remediation.source_record_id,
    );
    if (history.some((item) => item.resume_status === "REQUESTED")) {
      throw new BusinessError(409, "현재 이상 건에는 이미 사용 재개 확인 요청이 진행 중입니다.");
    }
    const sequence =
      history.reduce((max, item) => Math.max(max, Number(item.request_sequence) || 0), 0) + 1;
    const timestamp = nowISO();
    const resumeRequest = {
      id: newId(),
      equipment_id: remediation.equipment_id,
      source_record_id: remediation.source_record_id,
      remediation_id: remediation.id,
      action_details_snapshot: remediation.action_details,
      request_sequence: String(sequence),
      resume_status: "REQUESTED",
      requested_by_id: actor.userId,
      requested_by_name: actor.name,
      requested_at: timestamp,
      confirmed_by_id: "",
      confirmed_by_name: "",
      confirmed_at: "",
      confirmation_result: "",
      rejection_reason: "",
    };
    const updatedRemediation = {
      ...remediation,
      remediation_status: "RESUME_REQUESTED",
      updated_by_id: actor.userId,
      updated_at: timestamp,
    };
    await updateRowById(REMEDIATIONS_TAB, remediation.id, updatedRemediation);
    try {
      await appendRow(RESUME_REQUESTS_TAB, resumeRequest);
    } catch (error) {
      await updateRowById(REMEDIATIONS_TAB, remediation.id, remediation);
      throw error;
    }
    await logAudit({
      category: "DATA",
      actor: { id: actor.userId, name: actor.name, role: actor.role },
      action: "DATA.RESUME_REQUESTED",
      target: `RESUME_REQUEST:${resumeRequest.id}`,
      before: remediationSnapshot(remediation),
      after: JSON.stringify({
        remediation: remediationSnapshot(updatedRemediation),
        request: resumeSnapshot(resumeRequest),
      }),
    });
    return Response.json({ resume_request: resumeRequest }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
