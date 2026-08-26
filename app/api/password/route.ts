import { NextResponse } from "next/server";

import { auditActor, authorizeRequest, calculatePasswordExpiry, validatePassword } from "@/app/api/admin/_utils";
import { logAudit } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { updateRowById } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const authorization = await authorizeRequest("/api/password", ["ADMIN", "TESTER", "APPROVER"], {
    allowExpiredPassword: true,
    requiredPermission: "PASSWORD_CHANGE",
  });
  if (!authorization.ok) return authorization.response;
  const { user, settings } = authorization.value;
  return NextResponse.json({
    user: { user_id: user.user_id, name: user.name, employee_no: user.employee_no, role: user.role },
    policy: settings,
    password_expired: Boolean(user.password_expires_at) && new Date(user.password_expires_at).getTime() <= Date.now(),
  });
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest("/api/password", ["ADMIN", "TESTER", "APPROVER"], {
    allowExpiredPassword: true,
    requiredPermission: "PASSWORD_CHANGE",
  });
  if (!authorization.ok) return authorization.response;

  let body: { current_password?: unknown; new_password?: unknown; confirm_password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const currentPassword = String(body.current_password ?? "");
  const newPassword = String(body.new_password ?? "");
  const confirmPassword = String(body.confirm_password ?? "");
  const { user, settings } = authorization.value;
  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "현재 비밀번호와 새 비밀번호를 모두 입력하세요." }, { status: 400 });
  }
  if (currentPassword !== user.password) {
    return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "새 비밀번호와 확인 값이 일치하지 않습니다." }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "새 비밀번호는 현재 비밀번호와 달라야 합니다." }, { status: 400 });
  }
  const policyError = validatePassword(newPassword, settings);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });

  try {
    const timestamp = nowISO();
    await updateRowById("USERS", user.id, {
      password: newPassword,
      password_changed_at: timestamp,
      password_expires_at: calculatePasswordExpiry(timestamp, settings.password_validity_days),
      failed_login_count: 0,
      locked_at: "",
      updated_at: timestamp,
    });
    await logAudit({
      category: "SECURITY",
      actor: auditActor(user),
      action: "SECURITY.PASSWORD_CHANGED",
      target: user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `비밀번호를 변경하지 못했습니다: ${message}` }, { status: 500 });
  }
}
