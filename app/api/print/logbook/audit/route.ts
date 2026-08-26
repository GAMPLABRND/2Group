import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";

import { authenticateActor, errorResponse, trimmed } from "../../../approvals/_shared";
import {
  buildDocumentNumber,
  isValidDate,
  loadOfficialLogbook,
  LOGBOOK_REVIEW_MESSAGE,
} from "../../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type AuditBody = {
  equipment_id?: unknown;
  date_from?: unknown;
  date_to?: unknown;
  document_number?: unknown;
  printed_at?: unknown;
  record_ids?: unknown;
};

export async function POST(request: Request) {
  const auth = await authenticateActor(["ADMIN", "TESTER", "APPROVER"], "LOGBOOK_PRINT", "POST /api/print/logbook/audit");
  if ("response" in auth) return auth.response;

  let body: AuditBody;
  try {
    body = (await request.json()) as AuditBody;
  } catch {
    return errorResponse("출력 감사추적 요청 형식이 올바르지 않습니다.", 400);
  }
  const equipmentId = trimmed(body.equipment_id);
  const dateFrom = trimmed(body.date_from);
  const dateTo = trimmed(body.date_to);
  const documentNumber = trimmed(body.document_number);
  const printedAt = trimmed(body.printed_at);
  const recordIds = Array.isArray(body.record_ids)
    ? body.record_ids.filter((value): value is string => typeof value === "string")
    : [];
  if (
    !equipmentId ||
    !isValidDate(dateFrom) ||
    !isValidDate(dateTo) ||
    dateTo < dateFrom ||
    !documentNumber ||
    Number.isNaN(new Date(printedAt).getTime())
  ) {
    return errorResponse("출력 감사추적 요청 값이 올바르지 않습니다.", 400);
  }

  try {
    const logbook = await loadOfficialLogbook(equipmentId, dateFrom, dateTo);
    if (!logbook) return errorResponse("장비를 찾을 수 없습니다.", 404);
    const expectedDocumentNumber = buildDocumentNumber(
      logbook.equipment.equipment_code,
      dateFrom,
      dateTo,
      printedAt,
    );
    if (documentNumber !== expectedDocumentNumber) {
      return errorResponse("문서번호가 서버 조회 결과와 일치하지 않습니다.", 409);
    }

    const eligibleIds = new Set(logbook.records.map((record) => record.id));
    const requestedIds = new Set(recordIds);
    if (
      requestedIds.size !== recordIds.length ||
      requestedIds.size !== eligibleIds.size ||
      recordIds.some((id) => !eligibleIds.has(id))
    ) {
      return errorResponse(LOGBOOK_REVIEW_MESSAGE, 409);
    }

    await logAudit({
      category: "DATA",
      actor: { id: auth.actor.id, name: auth.actor.name, role: auth.actor.role },
      action: "LOGBOOK_PRINTED",
      target: documentNumber,
      after: JSON.stringify({
        equipment_id: equipmentId,
        equipment_code: logbook.equipment.equipment_code,
        date_from: dateFrom,
        date_to: dateTo,
        record_ids: recordIds,
        record_count: recordIds.length,
        printed_at: printedAt,
      }),
    });

    return NextResponse.json({ message: "출력 감사추적을 기록했습니다." });
  } catch (error) {
    console.error("[print] logbook audit failed", error);
    return errorResponse("출력 감사추적을 기록하지 못했습니다.", 500);
  }
}
