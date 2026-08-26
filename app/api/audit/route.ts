import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { auditFiltersFrom, queryAudit } from "./query";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getApiSession(["ADMIN", "APPROVER"], "AUDIT_VIEW", "GET /api/audit");
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  try {
    const filters = auditFiltersFrom(request.nextUrl.searchParams);
    const rows = await queryAudit(filters);
    return NextResponse.json({ rows, filters, count: rows.length });
  } catch (error) {
    if (error instanceof Error && [
      "조회 기간 형식이 올바르지 않습니다.",
      "조회 시작 일시는 종료 일시보다 늦을 수 없습니다.",
      "지원하지 않는 감사추적 분류입니다.",
    ].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "감사추적을 조회하지 못했습니다. 조회 조건과 Google Sheets 연결을 확인한 후 다시 시도하세요." },
      { status: 503 },
    );
  }
}
