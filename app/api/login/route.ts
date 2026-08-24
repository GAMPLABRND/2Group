import { NextResponse } from "next/server";
import { getRows } from "@/lib/sheets";
import { createSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Role } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const REQUIRED_ENV = [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_SHEET_ID",
] as const;

export async function POST(req: Request) {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Google Sheets 환경 변수 누락: ${missing.join(
          ", "
        )}. .env.local(또는 Vercel 환경 변수) 설정 후 서버를 재시작하세요.`,
      },
      { status: 500 }
    );
  }

  let body: { user_id?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const userId = String(body.user_id ?? "").trim();
  const password = String(body.password ?? "");
  if (!userId || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력하세요." }, { status: 400 });
  }

  try {
    const users = await getRows("USERS");
    const user = users.find((u) => u.user_id === userId);
    // 교육용 MVP 단순화 치환: 비밀번호 평문 비교 (CLAUDE.md MVP 범위 규칙)
    const ok = user && user.password === password && (!user.status || user.status === "ACTIVE");

    if (!ok) {
      await logAudit({
        category: "SECURITY",
        actor: { id: userId },
        action: "LOGIN_FAIL",
        reason: !user
          ? "존재하지 않는 계정"
          : user.password !== password
            ? "비밀번호 불일치"
            : "비활성 계정",
      });
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않거나 비활성 계정입니다." },
        { status: 401 }
      );
    }

    await createSession(user.user_id, user.role as Role);
    await logAudit({
      category: "SECURITY",
      actor: { id: user.user_id, name: user.name, role: user.role },
      action: "LOGIN_SUCCESS",
    });
    return NextResponse.json({ ok: true, user_id: user.user_id, name: user.name, role: user.role });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `Google Sheets 조회 실패: ${msg}. 시트 공유(서비스 계정 편집자), 환경 변수, 시드(/api/seed) 여부를 확인하세요.`,
      },
      { status: 500 }
    );
  }
}
