import { Banner, PageTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getBackupRuns } from "@/lib/backup";
import { getRows } from "@/lib/sheets";
import type { BackupRun } from "@/types";
import BackupClient from "./BackupClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function BackupPage() {
  const session = await requireRole(["ADMIN"]);
  let runs: BackupRun[] = [];
  let error = "";
  try {
    runs = await getBackupRuns();
    const users = await getRows("USERS");
    const actor = users.find((user) => user.user_id === session.userId);
    await logAudit({
      category: "SYSTEM",
      actor: { id: session.userId, name: actor?.name || session.userId, role: session.role },
      action: "SYSTEM.BACKUP_VIEWED",
      target: "BACKUP:PAGE",
      after: JSON.stringify({ count: runs.length }),
    });
  } catch {
    error = "백업 실행 이력을 조회하지 못했습니다. Google Sheets 연결 설정을 확인하세요.";
  }

  return (
    <div>
      <PageTitle
        title="백업"
        description="운영 데이터를 XLSX로 생성한 후 브라우저 다운로드 기능으로 사용자 PC에 직접 저장합니다."
      />
      {error ? <Banner kind="error">{error}</Banner> : null}
      {!error ? <BackupClient runs={runs} /> : null}
    </div>
  );
}
