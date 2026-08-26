import { Banner, Button, Card, PageTitle, StatusBadge, Table, Td } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { toKST } from "@/lib/kst";
import { getAlarmData } from "@/app/api/alarms/data";
import HistoryDetail from "./HistoryDetail";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const resumeLabels: Record<string, string> = {
  REQUESTED: "사용 재개 요청",
  APPROVED: "승인",
  REJECTED: "반려",
  "재개 요청 없음": "재개 요청 없음",
};

export default async function AlarmsPage() {
  const session = await requireRole(["ADMIN", "TESTER", "APPROVER"], "ALARM_VIEW", "PAGE:/alarms");
  let data: Awaited<ReturnType<typeof getAlarmData>> | null = null;
  let error = "";
  try {
    data = await getAlarmData(session.role === "ADMIN");
  } catch {
    error = "알람 데이터를 조회하지 못했습니다. Google Sheets 연결을 확인한 후 새로고침하세요.";
  }

  return (
    <div>
      <PageTitle
        title="알람"
        description="교정 만료, 장비 사용중지, 이상 발생과 조치, 사용 재개, 보안 잠금과 권한별 운영 알람을 조회합니다."
        actions={<form action="/alarms" method="get"><Button type="submit" variant="secondary">새로고침</Button></form>}
      />
      {error ? <Banner kind="error">{error}</Banner> : null}
      {data ? (
        <>
          {session.role === "ADMIN" ? (
            <Card title={`백업 알람 ${data.backup.length}건`}>
              <Table columns={[
                { label: "백업 일자", width: "120px" },
                { label: "시작 일시", width: "190px" },
                { label: "완료 일시", width: "190px" },
                { label: "결과", width: "100px", align: "center" },
                { label: "백업본 형태", width: "120px", align: "center" },
                { label: "파일명", width: "240px", nowrap: false },
                { label: "오류 내용", width: "220px", nowrap: false },
                { label: "저장 방식", width: "150px", align: "center" },
              ]} empty="백업 완료 또는 실패 알람이 없습니다." density="compact">
                {data.backup.map((row) => (
                  <tr key={row.id}>
                    <Td nowrap code>{row.backupDate}</Td>
                    <Td nowrap code>{row.startedAt ? toKST(row.startedAt, true) : "해당 없음"}</Td>
                    <Td nowrap code>{row.completedAt ? toKST(row.completedAt, true) : "해당 없음"}</Td>
                    <Td align="center"><StatusBadge value={row.result === "COMPLETED" ? "APPROVED" : "FAIL"} label={row.result === "COMPLETED" ? "완료" : "실패"} /></Td>
                    <Td align="center" code>.xlsx</Td>
                    <Td clamp={2} code>{row.fileName || "해당 없음"}</Td>
                    <Td clamp={2}>{row.errorMessage || "해당 없음"}</Td>
                    <Td align="center">
                      {row.result === "COMPLETED" ? "사용자 PC" : "해당 없음"}
                    </Td>
                  </tr>
                ))}
              </Table>
            </Card>
          ) : null}
          <Card title={`교정 알람 ${data.calibration.length}건`}>
            <Table columns={[
              { label: "구분", width: "120px", align: "center" },
              { label: "장비 코드", width: "140px" },
              { label: "장비명" },
              { label: "교정 유효기간", width: "150px" },
              { label: "잔여 일수", width: "120px", align: "right" },
            ]} empty="교정 만료 또는 90일 이내 만료 임박 장비가 없습니다.">
              {data.calibration.map((row) => (
                <tr key={row.id}>
                  <Td align="center"><StatusBadge value={row.severity === "EXPIRED" ? "FAIL" : "IN_USE"} label={row.severity === "EXPIRED" ? "교정 만료" : "만료 임박"} /></Td>
                  <Td code>{row.equipmentCode}</Td>
                  <Td clamp={2}>{row.equipmentName}</Td>
                  <Td nowrap code>{row.dueDate}</Td>
                  <Td num>{row.daysRemaining < 0 ? `${Math.abs(row.daysRemaining)}일 경과` : `${row.daysRemaining}일`}</Td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card title={`사용중지 장비 ${data.suspended.length}건`}>
            <Table columns={[
              { label: "장비 코드", width: "140px" },
              { label: "장비명" },
              { label: "사용 상태", width: "120px", align: "center" },
              { label: "점유 상태", width: "120px", align: "center" },
              { label: "최종 변경 일시", width: "200px" },
              { label: "비고", width: "220px", nowrap: false },
            ]} empty="사용중지 장비가 없습니다.">
              {data.suspended.map((row) => (
                <tr key={row.id}>
                  <Td code>{row.equipmentCode}</Td>
                  <Td clamp={2}>{row.equipmentName}</Td>
                  <Td align="center"><StatusBadge value="SUSPENDED" label="사용중지" /></Td>
                  <Td align="center"><StatusBadge value={row.occupancyStatus} label={row.occupancyStatus === "FREE" ? "미사용" : "사용중"} /></Td>
                  <Td nowrap code>{row.updatedAt ? toKST(row.updatedAt, true) : "해당 없음"}</Td>
                  <Td clamp={2}>{row.remarks || "해당 없음"}</Td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card title={`이상 발생, 조치와 사용 재개 이력 ${data.abnormalHistory.length}건`}>
            <Table columns={[
              { label: "종료 일시", width: "200px" },
              { label: "장비", width: "150px" },
              { label: "이상 내용", nowrap: false },
              { label: "최근 조치", width: "180px", nowrap: false },
              { label: "재개 상태", width: "130px", align: "center" },
              { label: "반려 사유", width: "140px", nowrap: false },
              { label: "상세", width: "88px", align: "center" },
            ]} empty="저장된 이상 발생 이력이 없습니다." density="compact">
              {data.abnormalHistory.map((row) => (
                <tr key={row.id}>
                  <Td nowrap code>{row.endedAt ? toKST(row.endedAt, true) : "해당 없음"}</Td>
                  <Td clamp={2}>{row.equipmentCode}<br />{row.equipmentName}</Td>
                  <Td clamp={2}>{row.abnormalityDetails || "해당 없음"}</Td>
                  <Td clamp={2}>{row.latestAction}</Td>
                  <Td align="center"><StatusBadge value={row.latestResumeStatus} label={resumeLabels[row.latestResumeStatus] ?? row.latestResumeStatus} /></Td>
                  <Td clamp={2}>{row.rejectionReason || "해당 없음"}</Td>
                  <Td align="center"><HistoryDetail decisions={row.decisions} /></Td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card title={`보안 잠금 경고 ${data.security.length}건`}>
            <Table columns={[
              { label: "사용자 ID", width: "150px" },
              { label: "이름" },
              { label: "역할", width: "130px" },
              { label: "실패 횟수", width: "120px", align: "right" },
              { label: "잠금 일시", width: "200px" },
            ]} empty="잠긴 계정이 없습니다.">
              {data.security.map((row) => (
                <tr key={row.id}>
                  <Td code>{row.userId}</Td>
                  <Td clamp={2}>{row.name}</Td>
                  <Td code>{row.role}</Td>
                  <Td num>{row.failedCount}</Td>
                  <Td nowrap code>{row.lockedAt ? toKST(row.lockedAt, true) : `실패 기준 ${data.maxFailures}회 도달`}</Td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card title={`권한 없는 접근 반복 경고 ${data.accessWarnings.length}건`}>
            <Table columns={[
              { label: "최근 발생 일시", width: "200px" },
              { label: "행위자", width: "180px" },
              { label: "역할", width: "130px" },
              { label: "최근 대상" },
              { label: "발생 횟수", width: "120px", align: "right" },
              { label: "경고 기준", width: "120px", align: "right" },
            ]} empty={`권한 없는 접근이 경고 기준 ${data.maxFailures}회에 도달한 행위자가 없습니다.`}>
              {data.accessWarnings.map((row) => (
                <tr key={row.actorId}>
                  <Td nowrap code>{row.latestAt ? toKST(row.latestAt, true) : "해당 없음"}</Td>
                  <Td clamp={2}>{row.actorName}<br />{row.actorId}</Td>
                  <Td code>{row.role}</Td>
                  <Td clamp={2}>{row.latestTarget || "해당 없음"}</Td>
                  <Td num>{row.count}</Td>
                  <Td num>{data.maxFailures}</Td>
                </tr>
              ))}
            </Table>
          </Card>
          <p className="text-xs text-ink-muted">서버 계산 시각: {toKST(data.calculatedAt, true)}</p>
        </>
      ) : null}
    </div>
  );
}
