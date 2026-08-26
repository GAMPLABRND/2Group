import { NextResponse } from "next/server";

import { nowISO } from "@/lib/kst";

import { authenticateActor, errorResponse } from "../../approvals/_shared";
import { buildDocumentNumber, isValidDate, loadOfficialLogbook } from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticateActor(["ADMIN", "TESTER", "APPROVER"], "LOGBOOK_PRINT", "GET /api/print/logbook");
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const equipmentId = url.searchParams.get("equipment_id")?.trim() ?? "";
  const dateFrom = url.searchParams.get("date_from")?.trim() ?? "";
  const dateTo = url.searchParams.get("date_to")?.trim() ?? "";
  const missing = [
    !equipmentId ? "장비" : "",
    !dateFrom ? "조회 시작일" : "",
    !dateTo ? "조회 종료일" : "",
  ].filter(Boolean);
  if (missing.length) {
    return errorResponse("필수 입력 항목이 누락된 경우 기록을 저장할 수 없으며 누락된 항목을 안내해야 한다.", 400, missing);
  }
  if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
    return errorResponse("조회 기간은 YYYY-MM-DD 형식으로 입력해야 합니다.", 400);
  }
  if (dateTo < dateFrom) return errorResponse("조회 종료일은 조회 시작일보다 빠를 수 없습니다.", 400);

  try {
    const logbook = await loadOfficialLogbook(equipmentId, dateFrom, dateTo);
    if (!logbook) return errorResponse("장비를 찾을 수 없습니다.", 404);
    const printedAt = nowISO();
    const documentNumber = buildDocumentNumber(
      logbook.equipment.equipment_code,
      dateFrom,
      dateTo,
      printedAt,
    );

    return NextResponse.json({
      document_number: documentNumber,
      printed_at: printedAt,
      printed_by: { user_id: auth.actor.id, name: auth.actor.name, role: auth.actor.role },
      period: { date_from: dateFrom, date_to: dateTo },
      equipment: {
        id: logbook.equipment.id,
        equipment_code: logbook.equipment.equipment_code,
        equipment_name: logbook.equipment.equipment_name,
        calibration_required: logbook.equipment.calibration_required,
        qualification_required: logbook.equipment.qualification_required || logbook.equipment.calibration_required,
      },
      records: logbook.records,
      official_status: "REVIEWED_ONLY",
    });
  } catch (error) {
    console.error("[print] logbook read failed", error);
    return errorResponse("공식 로그북을 조회하지 못했습니다.", 500);
  }
}
