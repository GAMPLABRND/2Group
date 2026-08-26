import { NextResponse } from "next/server";
import { getRows, updateRowById } from "@/lib/sheets";
import { createSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { ROLES, type Role } from "@/types";
import { readSecuritySettings, toUserRow } from "@/app/api/admin/_utils";

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
    const rawUser = users.find((u) => u.user_id === userId);
    const user = rawUser ? toUserRow(rawUser) : null;
    const settings = await readSecuritySettings();

    if (!user) {
      await logAudit({
        category: "SECURITY",
        actor: { id: userId },
        action: "SECURITY.LOGIN_FAILURE",
        reason: "존재하지 않는 계정",
      });
      return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    if (user.status !== "ACTIVE") {
      await logAudit({
        category: "SECURITY",
        actor: { id: user.user_id, name: user.name, role: user.role },
        action: "SECURITY.LOGIN_FAILURE",
        target: user.id,
        reason: "비활성 계정",
      });
      return NextResponse.json({ error: "비활성 계정은 로그인할 수 없습니다." }, { status: 403 });
    }

    if (user.locked_at) {
      await logAudit({
        category: "SECURITY",
        actor: { id: user.user_id, name: user.name, role: user.role },
        action: "SECURITY.LOGIN_FAILURE",
        target: user.id,
        reason: "잠금 계정",
      });
      return NextResponse.json({ error: "잠긴 계정입니다. 관리자에게 잠금 해제를 요청하세요." }, { status: 423 });
    }

    // 교육용 MVP 단순화 범위에 따라 서버에서 평문 비밀번호를 비교한다.
    if (user.password !== password) {
      const failedCount = Math.max(0, Number(user.failed_login_count) || 0) + 1;
      const lockedAt = failedCount >= settings.max_failed_login_attempts ? nowISO() : "";
      await updateRowById("USERS", user.id, {
        failed_login_count: failedCount,
        locked_at: lockedAt,
        updated_at: nowISO(),
      });
      await logAudit({
        category: "SECURITY",
        actor: { id: user.user_id, name: user.name, role: user.role },
        action: "SECURITY.LOGIN_FAILURE",
        target: user.id,
        after: JSON.stringify({ failed_login_count: failedCount }),
        reason: "비밀번호 불일치",
      });
      if (lockedAt) {
        await logAudit({
          category: "SECURITY",
          actor: { id: user.user_id, name: user.name, role: user.role },
          action: "SECURITY.ACCOUNT_LOCKED",
          target: user.id,
          after: JSON.stringify({ threshold: settings.max_failed_login_attempts, failed_login_count: failedCount }),
          reason: "연속 로그인 실패 잠금 기준 도달",
        });
      }
      return NextResponse.json(
        {
          error: lockedAt
            ? "로그인 실패 횟수가 잠금 기준에 도달하여 계정이 잠겼습니다."
            : `아이디 또는 비밀번호가 올바르지 않습니다. 연속 실패 ${failedCount}회입니다.`,
        },
        { status: lockedAt ? 423 : 401 },
      );
    }

    if (!(ROLES as readonly string[]).includes(user.role)) {
      await logAudit({
        category: "SECURITY",
        actor: { id: user.user_id, name: user.name, role: user.role },
        action: "SECURITY.LOGIN_FAILURE",
        target: user.id,
        reason: "허용되지 않은 역할 코드",
      });
      return NextResponse.json({ error: "계정 역할 설정을 확인하세요." }, { status: 403 });
    }

    const loginAt = nowISO();
    if (Number(user.failed_login_count) !== 0) {
      await updateRowById("USERS", user.id, { failed_login_count: 0, updated_at: loginAt });
    }
    await createSession(user.user_id, user.role as Role, settings.idle_timeout_minutes * 60);
    await logAudit({
      category: "SECURITY",
      actor: { id: user.user_id, name: user.name, role: user.role },
      action: "SECURITY.LOGIN_SUCCESS",
      target: user.id,
    });
    const passwordExpired = Boolean(user.password_expires_at) && new Date(user.password_expires_at).getTime() <= Date.now();
    return NextResponse.json({
      ok: true,
      user_id: user.user_id,
      name: user.name,
      role: user.role,
      password_expired: passwordExpired,
    });
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
