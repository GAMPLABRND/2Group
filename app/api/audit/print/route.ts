import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { auditActor, auditFiltersFrom, validateAuditFilters } from "../query";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getApiSession(["ADMIN", "APPROVER"], "AUDIT_PRINT", "POST /api/audit/print");
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    const filters = auditFiltersFrom(body);
    validateAuditFilters(filters);
    await logAudit({
      category: "DATA",
      actor: await auditActor(session.userId, session.role),
      action: "PRINT.AUDIT_REPORT_PRINTED",
      target: "AUDIT:REPORT",
      after: JSON.stringify({ filters }),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "인쇄 감사추적을 기록하지 못했습니다. 조회 조건을 확인한 후 다시 시도하세요." },
      { status: 503 },
    );
  }
}
