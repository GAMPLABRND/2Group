import { AuditPrintTable, Banner, PrintButton, PrintHeader } from "@/components/ui";
import { auditFiltersFrom, queryAudit } from "@/app/api/audit/query";
import { requireRole } from "@/lib/auth";
import { nowKST, toKST } from "@/lib/kst";
import type { AuditPrintRow } from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Params = Record<string, string | string[] | undefined>;

export default async function AuditPrintPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireRole(["ADMIN", "APPROVER"], "AUDIT_PRINT", "PAGE:/audit/print");

  const filters = auditFiltersFrom(await searchParams);
  let rows: AuditPrintRow[] = [];
  let error = "";
  try {
    rows = (await queryAudit(filters)).map((row) => ({ ...row, timestamp_kst: toKST(row.timestamp_kst, true) }));
  } catch {
    error = "감사추적 보고서를 만들지 못했습니다. Google Sheets 연결을 확인한 후 다시 시도하세요.";
  }

  return (
    <div>
      <div className="no-print mb-4 flex justify-end">
        <PrintButton auditEndpoint="/api/audit/print" auditPayload={filters} label="감사추적 보고서 인쇄" />
      </div>
      {error ? <Banner kind="error">{error}</Banner> : null}
      <div className="print-area print-landscape bg-white text-black">
        <PrintHeader
          title="감사추적 보고서"
          docNo="AUDIT-REPORT"
          printedBy={`${session.userId} (${session.role})`}
          printedAt={nowKST(true)}
        />
        <div className="mb-3 text-[11px] text-black">
          조회 조건: 분류 {filters.category || "전체"}, 기간 {filters.from || "전체"}부터 {filters.to || "전체"},
          행위자 {filters.actor || "전체"}, 행위 유형 {filters.action || "전체"}, 총 {rows.length}건
        </div>
        <AuditPrintTable rows={rows} />
      </div>
      <p className="no-print mt-4 text-xs text-ink-muted">
        Chrome 또는 Edge 인쇄 설정에서 머리글과 바닥글을 사용하여 페이지 번호를 표시합니다.
      </p>
    </div>
  );
}
