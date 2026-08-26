import { USE_RECORD_STATUSES } from "@/types";
import {
  AFTER_USE_STATUSES,
  USAGE_TYPES,
  assertListValue,
  errorResponse,
  isoKSTDate,
  publicEquipmentEligibility,
  readEquipment,
  readRecords,
  readRemediations,
  readResumeRequests,
  requireActor,
  validateDateRange,
} from "@/app/api/records/_lib/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(["ADMIN", "TESTER", "APPROVER"], "GET /api/records", "USE_RECORD_VIEW");
    const url = new URL(request.url);
    const equipmentId = url.searchParams.get("equipment_id")?.trim() || "";
    const dateFrom = url.searchParams.get("date_from")?.trim() || "";
    const dateTo = url.searchParams.get("date_to")?.trim() || "";
    const userId = url.searchParams.get("user_id")?.trim() || "";
    const usageType = url.searchParams.get("usage_type")?.trim() || "";
    const recordStatus = url.searchParams.get("record_status")?.trim() || "";
    const afterUseStatus = url.searchParams.get("after_use_status")?.trim() || "";
    validateDateRange(dateFrom, dateTo);
    if (usageType) assertListValue(usageType, USAGE_TYPES, "사용 유형");
    if (recordStatus) assertListValue(recordStatus, USE_RECORD_STATUSES, "기록 상태");
    if (afterUseStatus) assertListValue(afterUseStatus, AFTER_USE_STATUSES, "사용 후 상태");

    const [allRecords, equipment, remediations, resumeRequests] = await Promise.all([
      readRecords(),
      readEquipment(),
      readRemediations(),
      readResumeRequests(),
    ]);
    const records = allRecords
      .filter((record) => {
        const startedDate = isoKSTDate(record.started_at);
        return (
          (!equipmentId || record.equipment_id === equipmentId) &&
          (!dateFrom || startedDate >= dateFrom) &&
          (!dateTo || startedDate <= dateTo) &&
          (!userId || record.user_id === userId) &&
          (!usageType || record.usage_type === usageType) &&
          (!recordStatus || record.record_status === recordStatus) &&
          (!afterUseStatus || record.after_use_status === afterUseStatus)
        );
      })
      .sort((a, b) => b.started_at.localeCompare(a.started_at));

    const users = Array.from(
      new Map(allRecords.map((record) => [record.user_id, { id: record.user_id, name: record.user_name }])).values(),
    ).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return Response.json({
      records,
      equipment: equipment.map(publicEquipmentEligibility),
      users,
      remediations,
      resume_requests: resumeRequests,
      actor: { user_id: actor.userId, name: actor.name, role: actor.role },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    await requireActor(["TESTER"], "DELETE /api/records", "USE_RECORD_AMEND_OWN");
    return Response.json(
      { error: "사용 기록은 물리적으로 삭제할 수 없으며 사유와 함께 무효 처리해야 합니다." },
      { status: 405, headers: { Allow: "GET" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
