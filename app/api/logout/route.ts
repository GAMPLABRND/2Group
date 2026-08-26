import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getRows } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

async function logout(req: Request) {
  const session = await getSession();
  try {
    if (session) {
      let name = session.userId;
      try {
        const users = await getRows("USERS");
        name = users.find((user) => user.user_id === session.userId)?.name || session.userId;
      } catch {
        // 사용자 조회가 일시 실패해도 행위자 이름 필드는 비워 두지 않는다.
      }
      const automatic = new URL(req.url).searchParams.get("reason") === "timeout";
      await logAudit({
        category: "SECURITY",
        actor: { id: session.userId, name, role: session.role },
        action: automatic ? "SECURITY.SESSION_AUTO_LOGOUT" : "SECURITY.LOGOUT",
        reason: automatic ? "자동 로그아웃 시간 경과" : "사용자 로그아웃",
      });
    }
  } finally {
    await clearSession();
  }
  return new NextResponse(null, {
    status: 303,
    headers: { Location: "/login" },
  });
}

export async function POST(req: Request) {
  return logout(req);
}

export async function GET(req: Request) {
  return logout(req);
}
