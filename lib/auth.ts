import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROLES, type Role, type Session } from "@/types";

// 세션 규칙: httpOnly 쿠키 "session" = `userId|role` (CLAUDE.md 기술 규칙).
const COOKIE_NAME = "session";

export async function createSession(userId: string, role: Role) {
  const store = await cookies();
  store.set(COOKIE_NAME, `${userId}|${role}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
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
export async function requireRole(roles: Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.role)) redirect("/?denied=1");
  return session;
}

/** API 라우트용: 세션이 없거나 역할이 맞지 않으면 null. 호출부에서 401/403 응답을 만든다. */
export async function getApiSession(roles?: Role[]): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  if (roles && !roles.includes(session.role)) return null;
  return session;
}
