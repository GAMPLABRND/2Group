import { Card, PageTitle } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { getRows } from "@/lib/sheets";
import { trainingProfileFromRow } from "@/lib/training-profile";
import { requirePagePermission } from "@/app/admin/_pageAccess";
import AboutClient from "./AboutClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const SYSTEM_INFO = { version: "v1.0.0", buildDate: "2026-08-26", documentNo: "KPBMA-EDU-001-URS", framework: "Next.js App Router / Google Sheets" };

export default async function AboutPage() {
  const session = await requirePagePermission("/about", ["ADMIN", "TESTER", "APPROVER"], "DASHBOARD_VIEW");
  const profileRows = await getRows("TRAINING_PROFILE");
  const profileRow = profileRows.find((row) => row.id === "training-profile-default") ?? profileRows[0];
  const profile = trainingProfileFromRow(profileRow);
  return <div>
    <PageTitle title="About" description="시스템 정보와 교육 및 조직 정보를 확인합니다." />
    <div className="grid gap-6">
      <Card title="시스템 정보">
        <dl className="space-y-3 text-sm">
          <div><dt className="font-semibold text-ink-muted">시스템명</dt><dd className="mt-1 text-ink">{APP_NAME}</dd></div>
          <div><dt className="font-semibold text-ink-muted">릴리스 버전</dt><dd className="mt-1 font-mono text-ink">{SYSTEM_INFO.version}</dd></div>
          <div><dt className="font-semibold text-ink-muted">빌드 일자</dt><dd className="mt-1 text-ink">{SYSTEM_INFO.buildDate}</dd></div>
          <div><dt className="font-semibold text-ink-muted">문서 번호</dt><dd className="mt-1 text-ink">{SYSTEM_INFO.documentNo}</dd></div>
          <div><dt className="font-semibold text-ink-muted">기술 구성</dt><dd className="mt-1 text-ink">{SYSTEM_INFO.framework}</dd></div>
        </dl>
      </Card>
      <AboutClient profile={profile} canEdit={session.role === "ADMIN"} />
    </div>
  </div>;
}
