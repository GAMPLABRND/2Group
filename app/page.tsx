import Link from "next/link";
import { Banner, Button, Card, Kpi, PageTitle, StatusBadge, Table, Td } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { requireRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/types";
import { getDashboardData } from "@/app/api/dashboard/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const session = await requireRole(["ADMIN", "TESTER", "APPROVER"], "DASHBOARD_VIEW", "PAGE:/");
  const { denied } = await searchParams;
  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  let error = "";
  try { data = await getDashboardData(); } catch { error = "대시보드 데이터를 조회하지 못했습니다. Google Sheets 연결을 확인해 주세요."; }
  return <div>
    <PageTitle title={`${APP_NAME} 대시보드`} description={`${session.userId} (${ROLE_LABELS[session.role]}) 계정의 최신 시스템 현황입니다.`} actions={<form action="/" method="get"><Button type="submit" variant="secondary">새로고침</Button></form>} />
    {denied ? <Banner kind="warn">접근 권한이 없는 화면입니다. 메인 화면으로 이동했습니다.</Banner> : null}
    {error ? <Banner kind="error">{error}</Banner> : null}
    {data ? <>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="전체 장비" value={data.counts.total} />
        <Kpi label="사용가능" value={data.counts.available} tone="success" />
        <Kpi label="사용중" value={data.counts.inUse} tone="warning" />
        <Kpi label="사용중지" value={data.counts.suspended} tone="danger" />
        <Kpi label="폐기" value={data.counts.retired} />
        <Kpi label="교정 만료" value={data.counts.calibrationExpired} tone="danger" />
      </div>
      <Link href="/equipment-stats" className="block">
        <Card title="장비 사용 통계">
          <p className="text-sm text-ink-muted">장비 ID와 조회기간을 선택해 사용 유형별 횟수와 총 사용 시간을 확인합니다.</p>
          <span className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">장비 사용 통계 화면으로 이동</span>
        </Card>
      </Link>
      <Card title="장비 기준정보 현황">
        <Table columns={[
          { label: "장비 코드", width: "150px" },
          { label: "장비명" },
          { label: "장비 위치", width: "180px" },
          { label: "사용 가능 상태", width: "150px", align: "center" },
          { label: "현재 사용 상태", width: "140px", align: "center" },
        ]} empty="등록된 장비 기준정보가 없습니다.">
          {data.equipment.map((row) => (
            <tr key={row.id}>
              <Td code>{row.equipment_code}</Td>
              <Td clamp={2}>{row.equipment_name}</Td>
              <Td clamp={2}>{row.location || "해당 없음"}</Td>
              <Td align="center">
                <StatusBadge
                  value={row.availability_status}
                  label={row.availability_status === "AVAILABLE" ? "사용가능" : row.availability_status === "SUSPENDED" ? "사용불가" : "폐기"}
                />
              </Td>
              <Td align="center">
                <StatusBadge
                  value={row.occupancy_status === "OCCUPIED" ? "IN_USE" : "AVAILABLE"}
                  label={row.occupancy_status === "OCCUPIED" ? "사용중" : "미사용"}
                />
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </> : null}
  </div>;
}
