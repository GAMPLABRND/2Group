import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { APP_NAME } from "@/lib/brand";
import { ROLE_LABELS } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { denied } = await searchParams;

  return (
    <div>
      {denied ? (
        <div className="mb-4 rounded-input border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-sm text-[#92400E]">
          접근 권한이 없는 화면입니다. 메인 화면으로 이동했습니다.
        </div>
      ) : null}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-dark">{APP_NAME} 대시보드</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {session.userId} ({ROLE_LABELS[session.role]}) 님, 환영합니다.
        </p>
      </div>
      <div className="rounded-card border-2 border-dashed border-line bg-white p-10 text-center text-sm leading-6 text-ink-muted">
        대시보드 자리입니다. builder-d4가 구현합니다: 맨 위에 Kpi 타일 grid(좌우 배치는 여기까지), 그 아래 표가 든 카드는 전체 폭 1열로 위아래로 쌓습니다(design.md 6.2).
      </div>
    </div>
  );
}
