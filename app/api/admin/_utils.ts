import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
import { clearSession, getApiSession } from "@/lib/auth";
import { getRows } from "@/lib/sheets";
import type { Role, Session, UserRow } from "@/types";

export const DEFAULT_SECURITY_SETTINGS = {
  id: "security-settings-default",
  min_password_length: 4,
  require_uppercase: false,
  require_lowercase: false,
  require_digit: false,
  require_special: false,
  password_validity_days: 90,
  max_failed_login_attempts: 5,
  idle_timeout_minutes: 30,
};

export type SecuritySettings = typeof DEFAULT_SECURITY_SETTINGS;

export type AuthorizedRequest = {
  session: Session;
  user: UserRow;
  settings: SecuritySettings;
};

export type AuthorizationResult =
  | { ok: true; value: AuthorizedRequest }
  | { ok: false; response: NextResponse };

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function storedBoolean(value: string | undefined, fallback: boolean) {
  if (value === "true" || value === "TRUE" || value === "1") return true;
  if (value === "false" || value === "FALSE" || value === "0") return false;
  return fallback;
}

export async function readSecuritySettings(): Promise<SecuritySettings> {
  try {
    const rows = await getRows("SECURITY_SETTINGS");
    const row = rows.find((item) => item.id === DEFAULT_SECURITY_SETTINGS.id) ?? rows[0];
    if (!row) return DEFAULT_SECURITY_SETTINGS;
    return {
      id: row.id || DEFAULT_SECURITY_SETTINGS.id,
      min_password_length: positiveInteger(row.min_password_length, DEFAULT_SECURITY_SETTINGS.min_password_length),
      require_uppercase: storedBoolean(row.require_uppercase, DEFAULT_SECURITY_SETTINGS.require_uppercase),
      require_lowercase: storedBoolean(row.require_lowercase, DEFAULT_SECURITY_SETTINGS.require_lowercase),
      require_digit: storedBoolean(row.require_digit, DEFAULT_SECURITY_SETTINGS.require_digit),
      require_special: storedBoolean(row.require_special, DEFAULT_SECURITY_SETTINGS.require_special),
      password_validity_days: positiveInteger(
        row.password_validity_days,
        DEFAULT_SECURITY_SETTINGS.password_validity_days,
      ),
      max_failed_login_attempts: positiveInteger(
        row.max_failed_login_attempts,
        DEFAULT_SECURITY_SETTINGS.max_failed_login_attempts,
      ),
      idle_timeout_minutes: positiveInteger(row.idle_timeout_minutes, DEFAULT_SECURITY_SETTINGS.idle_timeout_minutes),
    };
  } catch {
    return DEFAULT_SECURITY_SETTINGS;
  }
}

export function validatePassword(password: string, settings: SecuritySettings): string | null {
  if (password.length < settings.min_password_length) {
    return `비밀번호는 ${settings.min_password_length}자 이상이어야 합니다.`;
  }
  if (settings.require_uppercase && !/[A-Z]/.test(password)) return "비밀번호에 영문 대문자가 필요합니다.";
  if (settings.require_lowercase && !/[a-z]/.test(password)) return "비밀번호에 영문 소문자가 필요합니다.";
  if (settings.require_digit && !/[0-9]/.test(password)) return "비밀번호에 숫자가 필요합니다.";
  if (settings.require_special && !/[^A-Za-z0-9]/.test(password)) return "비밀번호에 특수문자가 필요합니다.";
  return null;
}

export function calculatePasswordExpiry(changedAt: string, validityDays: number) {
  return new Date(new Date(changedAt).getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString();
}

export function isPasswordExpired(user: Pick<UserRow, "password_expires_at">) {
  const expiresAt = new Date(user.password_expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

export function toUserRow(row: Record<string, string>): UserRow {
  return {
    id: row.id ?? "",
    user_id: row.user_id ?? "",
    name: row.name ?? "",
    employee_no: row.employee_no ?? "",
    password: row.password ?? "",
    role: row.role ?? "",
    status: row.status ?? "",
    permission_overrides: row.permission_overrides ?? "",
    password_changed_at: row.password_changed_at ?? "",
    password_expires_at: row.password_expires_at ?? "",
    failed_login_count: row.failed_login_count ?? "0",
    locked_at: row.locked_at ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

export function publicUser(user: UserRow) {
  const { password: _password, ...safe } = user;
  void _password;
  return safe;
}

export function hasEffectivePermission(user: UserRow, role: Role, baseRoles: Role[], permission: string) {
  let allowed = baseRoles.includes(role);
  try {
    const overrides = user.permission_overrides
      ? (JSON.parse(user.permission_overrides) as { allow?: unknown; deny?: unknown })
      : {};
    const allow = Array.isArray(overrides.allow) ? overrides.allow.map(String) : [];
    const deny = Array.isArray(overrides.deny) ? overrides.deny.map(String) : [];
    if (allow.includes(permission)) allowed = true;
    if (deny.includes(permission)) allowed = false;
  } catch {
    allowed = false;
  }
  return allowed;
}

export async function authorizeRequest(
  target: string,
  roles?: Role[],
  options: { allowExpiredPassword?: boolean; requiredPermission?: string } = {},
): Promise<AuthorizationResult> {
  const session = await getApiSession();
  if (!session) {
    await clearSession();
    return { ok: false, response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }

  let user: UserRow | undefined;
  try {
    const rows = await getRows("USERS");
    user = rows.map(toUserRow).find((item) => item.user_id === session.userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      response: NextResponse.json({ error: `계정 정보를 확인하지 못했습니다: ${message}` }, { status: 500 }),
    };
  }

  if (!user || user.status !== "ACTIVE" || Boolean(user.locked_at) || user.role !== session.role) {
    await logAudit({
      category: "SECURITY",
      actor: { id: session.userId, name: user?.name, role: session.role },
      action: "SECURITY.ACCESS_DENIED",
      target,
      reason: !user ? "계정 없음" : user.status !== "ACTIVE" ? "비활성 계정" : user.locked_at ? "잠금 계정" : "세션 역할 불일치",
    });
    await clearSession();
    return { ok: false, response: NextResponse.json({ error: "계정 상태를 확인한 후 다시 로그인하세요." }, { status: 401 }) };
  }

  let permissionAllowed = !roles || roles.includes(session.role);
  if (options.requiredPermission) {
    permissionAllowed = hasEffectivePermission(user, session.role, roles ?? [], options.requiredPermission);
  }
  if (!permissionAllowed) {
    await logAudit({
      category: "SECURITY",
      actor: { id: session.userId, name: user.name, role: session.role },
      action: "SECURITY.ACCESS_DENIED",
      target,
      reason: options.requiredPermission ? `유효 권한 없음: ${options.requiredPermission}` : "역할 권한 없음",
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "권한이 없는 화면 또는 기능에 접근을 시도하면 접근이 차단되고 안내 메시지가 표시된 후 메인 화면으로 이동한다." },
        { status: 403 },
      ),
    };
  }

  const settings = await readSecuritySettings();
  if (!options.allowExpiredPassword && isPasswordExpired(user)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "비밀번호 유효기간이 만료되었습니다. 비밀번호 변경 후 다시 시도하세요.", password_expired: true },
        { status: 403 },
      ),
    };
  }

  return { ok: true, value: { session, user, settings } };
}

export function auditActor(user: UserRow) {
  return { id: user.user_id, name: user.name, role: user.role };
}
