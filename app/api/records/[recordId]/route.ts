import { logAudit } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { updateRowById } from "@/lib/sheets";
import {
  BusinessError,
  RECORDS_TAB,
  USAGE_TYPES,
  assertListValue,
  assertMutableRecord,
  assertOnlyKeys,
  assertRecordOwner,
  errorResponse,
  findRecord,
  parseObject,
  readEquipment,
  readRecords,
  readRemediations,
  readResumeRequests,
  recordSnapshot,
  requireActor,
  textField,
} from "@/app/api/records/_lib/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Context = { params: Promise<{ recordId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await requireActor(["ADMIN", "TESTER", "APPROVER"], "GET /api/records/[recordId]", "USE_RECORD_VIEW");
    const { recordId } = await context.params;
    const [records, equipment, remediations, resumeRequests] = await Promise.all([
      readRecords(),
      readEquipment(),
      readRemediations(),
      readResumeRequests(),
    ]);
    const record = findRecord(records, recordId);
    return Response.json({
      record,
      equipment: equipment.find((item) => item.id === record.equipment_id) || null,
      remediations: remediations.filter((item) => item.source_record_id === record.id),
      resume_requests: resumeRequests.filter((item) => item.source_record_id === record.id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireActor(["TESTER"], "PATCH /api/records/[recordId]", "USE_RECORD_AMEND_OWN");
    const { recordId } = await context.params;
    const body = parseObject(await request.json());
    assertOnlyKeys(body, [
      "usage_type",
      "usage_purpose",
      "reference_no",
      "abnormality_details",
      "modification_reason",
    ]);
    const reason = textField(body, "modification_reason");
    if (!reason) {
      throw new BusinessError(
        400,
        "필수 입력 항목이 누락된 경우 기록을 저장할 수 없으며 누락된 항목을 안내해야 한다. 누락 항목: 수정 사유",
      );
    }
    const record = findRecord(await readRecords(), recordId);
    assertRecordOwner(record, actor);
    assertMutableRecord(record);

    const patch: Record<string, string> = {};
    if ("usage_type" in body) {
      const value = textField(body, "usage_type");
      if (!value) throw new BusinessError(400, "사용 유형은 필수 입력 항목입니다.");
      assertListValue(value, USAGE_TYPES, "사용 유형");
      patch.usage_type = value;
    }
    if ("usage_purpose" in body) {
      const value = textField(body, "usage_purpose");
      if (!value) throw new BusinessError(400, "사용 목적은 필수 입력 항목입니다.");
      patch.usage_purpose = value;
    }
    if ("reference_no" in body) patch.reference_no = textField(body, "reference_no");
    if ("abnormality_details" in body) patch.abnormality_details = textField(body, "abnormality_details");
    if (!Object.keys(patch).length) throw new BusinessError(400, "변경할 기록 항목을 입력해 주세요.");
    if (!Object.entries(patch).some(([key, value]) => String(record[key as keyof typeof record] ?? "") !== value)) {
      throw new BusinessError(400, "변경된 기록 항목이 없습니다.");
    }

    const after = {
      ...record,
      ...patch,
      record_status: record.record_status === "CHANGE_REQUESTED" ? "COMPLETED" : record.record_status,
      updated_by: actor.userId,
      updated_at: nowISO(),
    };
    if (after.after_use_status === "ABNORMAL" && !after.abnormality_details.trim()) {
      throw new BusinessError(400, "사용 후 상태가 '이상'인 경우 특이사항을 필수로 기록해야 한다.");
    }
    await updateRowById(RECORDS_TAB, record.id, after);
    await logAudit({
      category: "DATA",
      actor: { id: actor.userId, name: actor.name, role: actor.role },
      action: "DATA.USAGE_UPDATED",
      target: `USAGE:${record.id}`,
      before: recordSnapshot(record),
      after: recordSnapshot(after),
      reason,
    });
    return Response.json({ record: after });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireActor(["TESTER"], "DELETE /api/records/[recordId]", "USE_RECORD_AMEND_OWN");
    await context.params;
    return Response.json(
      { error: "사용 기록은 물리적으로 삭제할 수 없으며 사유와 함께 무효 처리해야 합니다." },
      { status: 405, headers: { Allow: "GET, PATCH" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
