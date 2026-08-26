import { redirect } from "next/navigation";

import { logAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { getRows } from "@/lib/sheets";
import type { Role, Session } from "@/types";

export async function requirePagePermission(
  target: string,
  roles: Role[],
  permission: string,
  options: { allowExpiredPassword?: boolean } = {},
): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");

  const users = await getRows("USERS");
  const user = users.find((row) => row.user_id === session.userId);
  if (!user || user.status !== "ACTIVE" || Boolean(user.locked_at) || user.role !== session.role) {
    await logAudit({
      category: "SECURITY",
      actor: { id: session.userId, name: user?.name, role: session.role },
      action: "SECURITY.ACCESS_DENIED",
      target,
      reason: !user ? "계정 없음" : user.status !== "ACTIVE" ? "비활성 계정" : user.locked_at ? "잠금 계정" : "세션 역할 불일치",
    });
    redirect("/api/logout");
  }

  let allowed = roles.includes(session.role);
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
  if (!allowed) {
    await logAudit({
      category: "SECURITY",
      actor: { id: session.userId, name: user.name, role: session.role },
      action: "SECURITY.ACCESS_DENIED",
      target,
      reason: `유효 권한 없음: ${permission}`,
    });
    redirect("/?denied=1");
  }

  if (
    !options.allowExpiredPassword &&
    user.password_expires_at &&
    new Date(user.password_expires_at).getTime() <= Date.now()
  ) {
    redirect("/password?expired=1");
  }
  return session;
}
