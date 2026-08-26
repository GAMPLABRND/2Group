import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { auditActor, auditCsv, auditFiltersFrom, queryAudit } from "../query";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getApiSession(["ADMIN", "APPROVER"], "AUDIT_PRINT", "POST /api/audit/export");
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    const filters = auditFiltersFrom(body);
    const rows = await queryAudit(filters);
    await logAudit({
      category: "DATA",
      actor: await auditActor(session.userId, session.role),
      action: "PRINT.AUDIT_REPORT_EXPORTED",
      target: "AUDIT:CSV",
      after: JSON.stringify({ filters, count: rows.length }),
    });
    return new NextResponse(auditCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="audit-report.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "감사추적 CSV를 만들지 못했습니다. 잠시 후 다시 시도하세요." },
      { status: 503 },
    );
  }
}
