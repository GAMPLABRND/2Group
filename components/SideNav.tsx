"use client";

// 좌측 사이드 메뉴 (design.md 5.2). 현재 경로와 일치하는 항목을 활성 상태(연파랑 배경, 파란 좌측 선)로 표시한다.
// 공유 파일이므로 오케스트레이터만 수정한다. 메뉴 항목은 app/layout.tsx 의 MENUS 에서 내려온다.

import Link from "next/link";
import { usePathname } from "next/navigation";

export type MenuItem = { href: string; label: string; group?: string };

export default function SideNav({ menus }: { menus: MenuItem[] }) {
  const pathname = usePathname();
  const groups = new Map<string, MenuItem[]>();
  for (const m of menus) {
    const g = m.group ?? "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(m);
  }
  return (
    <nav className="no-print w-[220px] shrink-0 border-r border-line bg-white py-5">
      {Array.from(groups.entries()).map(([group, items]) => (
        <div key={group || "default"} className="mb-2">
          {group ? (
            <div className="mx-4 mb-2 mt-3 border-b-[2.5px] border-primary px-2 pb-1.5 text-sm font-extrabold tracking-tight text-primary-dark">
              {group}
            </div>
          ) : null}
          {items.map((m) => {
            const active = m.href === "/" ? pathname === "/" : pathname.startsWith(m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`flex items-center gap-2.5 border-l-4 px-6 py-2.5 text-[14px] transition-colors ${
                  active
                    ? "border-primary bg-primary-soft font-bold text-primary"
                    : "border-transparent font-medium text-ink hover:bg-muted hover:text-primary"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
