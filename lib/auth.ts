import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROLES, type Role, type Session } from "@/types";
import { getRows } from "@/lib/sheets";
import { logAudit } from "@/lib/audit";

// 세션 규칙: httpOnly 쿠키 "session" = `userId|role` (CLAUDE.md 기술 규칙).
const COOKIE_NAME = "session";

export async function createSession(userId: string, role: Role, maxAgeSeconds = 60 * 30) {
  const store = await cookies();
  store.set(COOKIE_NAME, `${userId}|${role}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [userId, role] = raw.split("|");
  if (!userId || !isRole(role)) return null;
  return { userId, role };
}

function isRole(v: string | undefined): v is Role {
  return !!v && (ROLES as readonly string[]).includes(v);
}

/** 페이지(서버 컴포넌트)용: 미로그인 → /login, 권한 없음 → 경고와 함께 대시보드 이동. */
export function hasEffectivePermission(
  role: Role,
  baseRoles: Role[],
  permissionOverrides: string | undefined,
  permission: string,
) {
  let allowed = baseRoles.includes(role);
  try {
    const parsed = permissionOverrides
      ? (JSON.parse(permissionOverrides) as { allow?: unknown; deny?: unknown })
      : {};
    const allow = Array.isArray(parsed.allow) ? parsed.allow.map(String) : [];
    const deny = Array.isArray(parsed.deny) ? parsed.deny.map(String) : [];
    if (allow.includes(permission)) allowed = true;
    if (deny.includes(permission)) allowed = false;
  } catch {
    allowed = false;
  }
  return allowed;
}

export function isPermissionExplicitlyAllowed(permissionOverrides: string | undefined, permission: string) {
  try {
    const parsed = permissionOverrides
      ? (JSON.parse(permissionOverrides) as { allow?: unknown; deny?: unknown })
      : {};
    const allow = Array.isArray(parsed.allow) ? parsed.allow.map(String) : [];
    const deny = Array.isArray(parsed.deny) ? parsed.deny.map(String) : [];
    return allow.includes(permission) && !deny.includes(permission);
  } catch {
    return false;
  }
}

export async function getSessionUser(session: Session) {
  const users = await getRows("USERS");
  return users.find(
    (user) =>
      user.user_id === session.userId &&
      user.status === "ACTIVE" &&
      !user.locked_at &&
      user.role === session.role,
  ) ?? null;
}

async function checkAccess(session: Session, roles: Role[], permission?: string, target = "PAGE") {
  const user = await getSessionUser(session);
  const allowed = Boolean(
    user &&
      (permission
        ? hasEffectivePermission(session.role, roles, user.permission_overrides, permission)
        : roles.includes(session.role)),
  );
  if (!allowed && user) {
    try {
      await logAudit({
        category: "SECURITY",
        actor: { id: session.userId, name: user.name, role: session.role },
        action: "SECURITY.ACCESS_DENIED",
        target,
        reason: permission ? `유효 권한 없음: ${permission}` : "역할 권한 없음",
      });
    } catch {
      // 접근은 감사추적 저장 결과와 관계없이 차단한다.
    }
  }
  return allowed;
}

export async function requireRole(roles: Role[], permission?: string, target?: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  try {
    if (!(await checkAccess(session, roles, permission, target))) redirect("/?denied=1");
  } catch {
    redirect("/?denied=1");
  }
  return session;
}

/** API 라우트용: 세션이 없거나 역할이 맞지 않으면 null. 호출부에서 401/403 응답을 만든다. */
export async function getApiSession(
  roles?: Role[],
  permission?: string,
  target?: string,
): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  if (roles) {
    try {
      if (!(await checkAccess(session, roles, permission, target || "API"))) return null;
    } catch {
      return null;
    }
  }
  return session;
}
