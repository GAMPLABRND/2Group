import { NextResponse } from "next/server";
import { createSession, getApiSession } from "@/lib/auth";
import { getRows } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST() {
  const access = await getApiSession(["ADMIN", "TESTER", "APPROVER"]);
  if (!access) {
    return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  }

  const rows = await getRows("SECURITY_SETTINGS");
  const configuredMinutes = Number(rows[0]?.idle_timeout_minutes ?? 30);
  const idleTimeoutMinutes = Number.isFinite(configuredMinutes)
    ? Math.max(1, configuredMinutes)
    : 30;

  await createSession(access.userId, access.role, idleTimeoutMinutes * 60);
  return NextResponse.json({ ok: true, idle_timeout_minutes: idleTimeoutMinutes });
}
