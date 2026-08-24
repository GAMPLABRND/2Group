import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import SideNav from "@/components/SideNav";
import { getSession } from "@/lib/auth";
import {
  APP_NAME,
  APP_SUBTITLE,
  CI_WHITE_SRC,
  FOOTER_COPYRIGHT,
  FOOTER_NOTICE,
  ORG_NAME,
} from "@/lib/brand";
import { ROLE_LABELS, type Role } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_SUBTITLE,
};

// 역할별 메뉴. 공유 파일이므로 오케스트레이터만 수정한다 (CLAUDE.md 파일 소유권 규칙).
// STEP 2 에서 URS §6.2 화면 목록과 §6.3 권한 매트릭스대로 항목을 채운다. group 은 사이드 메뉴의 소제목이다.
const MENUS: { href: string; label: string; roles: Role[]; group?: string }[] = [
  { href: "/", label: "대시보드", roles: ["ADMIN", "USER", "REVIEWER"] },
];

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const menus = session ? MENUS.filter((m) => m.roles.includes(session.role)) : [];

  // 로그인 전에는 셸(상단바, 사이드 메뉴) 없이 본문만 렌더한다 (로그인 화면이 전체 화면을 쓴다)
  if (!session) {
    return (
      <html lang="ko">
        <body className="min-h-screen">{children}</body>
      </html>
    );
  }

  return (
    <html lang="ko">
      <body className="min-h-screen">
        <header className="no-print flex h-14 shrink-0 items-center justify-between bg-primary-dark px-6 text-white shadow-[0_2px_4px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-5">
            <Image src={CI_WHITE_SRC} alt={ORG_NAME} width={198} height={25} priority />
            <Link href="/" className="text-[16px] font-bold tracking-tight text-white">
              {APP_NAME}
            </Link>
          </div>
          <div className="flex items-center gap-4 text-[13.5px]">
            <span>
              <b>{session.userId}</b>
            </span>
            <span className="rounded-pill bg-primary px-2.5 py-0.5 text-[11px] font-bold">
              {ROLE_LABELS[session.role]} ({session.role})
            </span>
            <form action="/api/logout" method="post">
              <button
                type="submit"
                className="rounded-pill border border-white/30 px-3 py-1 text-xs text-white hover:bg-white/10"
              >
                로그아웃
              </button>
            </form>
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-3.5rem)]">
          <SideNav menus={menus} />
          <main className="flex-1 min-w-0 overflow-x-auto bg-muted px-10 py-8">
            <div className="mx-auto max-w-6xl">{children}</div>
            <footer className="no-print mt-14 border-t border-line pt-6 text-center text-xs leading-relaxed text-ink-muted">
              <div className="font-medium">{FOOTER_NOTICE}</div>
              <div className="mt-1">{FOOTER_COPYRIGHT}</div>
            </footer>
          </main>
        </div>
      </body>
    </html>
  );
}
