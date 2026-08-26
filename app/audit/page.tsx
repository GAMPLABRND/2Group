import { Button, Card, Field, PageTitle, Select, TextInput, Banner } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { auditFiltersFrom, queryAudit } from "@/app/api/audit/query";
import type { AuditRow } from "@/types";
import AuditActions from "./AuditActions";
import AuditTable from "./AuditTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Params = Record<string, string | string[] | undefined>;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRole(["ADMIN", "APPROVER"], "AUDIT_VIEW", "PAGE:/audit");

  const filters = auditFiltersFrom(await searchParams);
  let rows: AuditRow[] = [];
  let error = "";
  try {
    rows = await queryAudit(filters);
  } catch (err) {
    error = err instanceof Error && err.message.includes("조회")
      ? err.message
      : "감사추적을 조회하지 못했습니다. Google Sheets 연결을 확인한 후 새로고침하세요.";
  }

  const hidden = Object.entries(filters).filter(([, value]) => value);
  return (
    <div>
      <PageTitle
        title="감사추적"
        description="보안과 데이터 행위를 기간, 행위자, 행위 유형으로 조회합니다. 기록은 애플리케이션에서 수정하거나 삭제할 수 없습니다."
        actions={<AuditActions filters={filters} />}
      />
      {error ? <Banner kind="error">{error}</Banner> : null}
      <Card title="조회 조건">
        <form action="/audit" method="get" className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Field label="분류">
            <Select name="category" defaultValue={filters.category}>
              <option value="">전체</option>
              <option value="SECURITY">SECURITY</option>
              <option value="DATA">DATA</option>
              <option value="SYSTEM">SYSTEM</option>
            </Select>
          </Field>
          <Field label="시작 일자">
            <TextInput name="from" type="date" defaultValue={filters.from} />
          </Field>
          <Field label="종료 일자">
            <TextInput name="to" type="date" defaultValue={filters.to} />
          </Field>
          <Field label="행위자">
            <TextInput name="actor" defaultValue={filters.actor} placeholder="ID 또는 이름" />
          </Field>
          <Field label="행위 유형">
            <TextInput name="action" defaultValue={filters.action} placeholder="예: LOGIN" />
          </Field>
          <div className="md:col-span-5 flex justify-end gap-2">
            <Button type="submit">조회</Button>
          </div>
        </form>
        <div className="mt-3 flex justify-end gap-2">
          <form action="/audit" method="get"><Button type="submit" variant="secondary">초기화</Button></form>
          <form action="/audit" method="get">
            {hidden.map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
            <Button type="submit" variant="secondary">새로고침</Button>
          </form>
          <form action="/audit/print" method="get">
            {hidden.map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
            <Button type="submit" variant="secondary">인쇄용 화면</Button>
          </form>
        </div>
      </Card>
      <Card title={`감사추적 목록 ${rows.length}건`}>
        <AuditTable rows={rows} />
      </Card>
    </div>
  );
}
