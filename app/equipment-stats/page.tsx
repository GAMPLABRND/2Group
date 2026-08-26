import Link from "next/link";
import { Banner, Button, Card, PageTitle, Select, Table, Td } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getEquipmentUsageStatistics } from "@/app/api/dashboard/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const USAGE_TYPES = ["일반 사용", "시험/분석", "적격성평가/밸리데이션", "점검/유지보수", "기타"];

export default async function EquipmentStatsPage({ searchParams }: { searchParams: Promise<{ equipmentId?: string; startDate?: string; endDate?: string }> }) {
  await requireRole(["ADMIN", "TESTER", "APPROVER"], "DASHBOARD_VIEW", "PAGE:/equipment-stats");
  const params = await searchParams;
  const result = await getEquipmentUsageStatistics(params.equipmentId ?? "", params.startDate ?? "", params.endDate ?? "");
  const values = USAGE_TYPES.map((usageType) => result.statistics.find((item) => item.usageType === usageType) ?? {
    usageType,
    count: 0,
    durationHours: "0.0",
    abnormalCount: 0,
    abnormalRate: "0%",
  });
  const maxCount = Math.max(1, ...values.map((item) => item.count));
  const maxHours = Math.max(1, ...values.map((item) => Number(item.durationHours)));
  const queried = Boolean(params.equipmentId);
  return <div>
    <PageTitle title="장비 사용 통계" description="장비 ID와 조회기간에 해당하는 사용 유형별 통계를 조회합니다." actions={<Link href="/"><Button type="button" variant="secondary">대시보드</Button></Link>} />
    <Card title="조회 조건">
      <form method="get" className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-end">
        <div><label htmlFor="equipmentId" className="mb-1 block text-sm font-medium text-ink">장비 ID (장비 코드)</label><Select id="equipmentId" name="equipmentId" defaultValue={params.equipmentId ?? ""}><option value="">장비 ID 선택</option>{result.equipment.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</Select></div>
        <div><label htmlFor="startDate" className="mb-1 block text-sm font-medium text-ink">조회 시작일</label><input id="startDate" name="startDate" type="date" defaultValue={params.startDate ?? ""} className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm" /></div>
        <div><label htmlFor="endDate" className="mb-1 block text-sm font-medium text-ink">조회 종료일</label><input id="endDate" name="endDate" type="date" defaultValue={params.endDate ?? ""} className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm" /></div>
        <Button type="submit">조회</Button>
      </form>
    </Card>
    {!queried ? <Banner kind="info">장비 ID를 선택해 주세요</Banner> : result.selected ? <>
      <Card title="조회 결과">
        <p className="text-sm text-ink-muted">장비 ID: <strong className="text-ink">{result.selected.code}</strong> · 장비명: <strong className="text-ink">{result.selected.name}</strong> · 조회기간: <strong className="text-ink">{result.selected.startDate || "전체"} ~ {result.selected.endDate || "전체"}</strong></p>
        <Table columns={[{ label: "사용 유형" }, { label: "사용 횟수", width: "130px", align: "right" }, { label: "이상 발생 횟수", width: "150px", align: "right" }, { label: "이상율", width: "120px", align: "right" }, { label: "총 사용 시간", width: "160px", align: "right" }]} empty="조회된 사용 기록이 없습니다.">{values.map((item) => <tr key={item.usageType}><Td>{item.usageType}</Td><Td num>{item.count}건</Td><Td num>{item.abnormalCount}건</Td><Td num>{item.abnormalRate}</Td><Td num>{item.durationHours}시간</Td></tr>)}</Table>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        {([["사용 유형별 사용 횟수", "count", maxCount], ["사용 유형별 총 사용 시간", "hours", maxHours]] as const).map(([title, kind, max]) => <Card key={title} title={title}><div className="flex h-72 items-end gap-2 border-b border-l border-line px-3 pb-2 pt-6">{values.map((item) => { const value = kind === "count" ? item.count : Number(item.durationHours); const height = `${value ? Math.max(4, (value / max) * 100) : 0}%`; return <div key={item.usageType} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${item.usageType}: ${kind === "count" ? `${item.count}건` : `${item.durationHours}시간`}`}><span className="mb-1 text-xs font-semibold text-ink">{kind === "count" ? item.count : item.durationHours}</span><div className="w-full rounded-t bg-primary" style={{ height }} /><span className="mt-2 w-full truncate text-center text-[11px] text-ink-muted">{item.usageType}</span></div>; })}</div><div className="mt-2 flex justify-between text-xs text-ink-muted"><span>Y축: 집계값</span><span>X축: 사용 유형</span></div></Card>)}
      </div>
    </> : <Banner kind="warn">선택한 장비를 찾을 수 없습니다.</Banner>}
  </div>;
}
