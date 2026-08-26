import { NextResponse } from "next/server";
import { acknowledgeAlarm, getUnreadAlarms } from "@/lib/alarm-notifications";
import { logAudit } from "@/lib/audit";
import { getApiSession } from "@/lib/auth";
import { getRows } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const session = await getApiSession(
    ["ADMIN", "TESTER", "APPROVER"],
    "ALARM_VIEW",
    "GET /api/alarms/unread",
  );
  if (!session) return NextResponse.json({ error: "로그인이 필요하거나 알람 조회 권한이 없습니다." }, { status: 401 });
  try {
    return NextResponse.json({ alarms: await getUnreadAlarms(session.role, session.userId) });
  } catch {
    return NextResponse.json(
      { error: "미확인 알람을 조회하지 못했습니다. Google Sheets 연결을 확인하세요." },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  const session = await getApiSession(
    ["ADMIN", "TESTER", "APPROVER"],
    "ALARM_VIEW",
    "POST /api/alarms/unread",
  );
  if (!session) return NextResponse.json({ error: "로그인이 필요하거나 알람 확인 권한이 없습니다." }, { status: 401 });
  try {
    const body = (await req.json()) as { alarm_key?: unknown };
    const result = await acknowledgeAlarm(session.role, session.userId, String(body.alarm_key || ""));
    if (result.created) {
      const users = await getRows("USERS");
      const actorName = users.find((row) => row.user_id === session.userId)?.name || session.userId;
      await logAudit({
        category: "DATA",
        actor: { id: session.userId, name: actorName, role: session.role },
        action: "DATA.ALARM_ACKNOWLEDGED",
        target: `ALARM:${result.alarm.key}`,
        after: JSON.stringify({
          type: result.alarm.type,
          target: result.alarm.target,
          acknowledged_at: result.acknowledgedAt,
        }),
        reason: "미확인 알람 팝업에서 확인(읽음) 처리",
      });
    }
    return NextResponse.json({ ok: true, acknowledgedAt: result.acknowledgedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알람을 확인 처리하지 못했습니다.";
    const status = message.includes("현재 조회") || message.includes("알람 키") ? 400 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
