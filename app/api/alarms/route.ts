import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { getAlarmData } from "./data";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const session = await getApiSession(["ADMIN", "TESTER", "APPROVER"], "ALARM_VIEW", "GET /api/alarms");
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    const data = await getAlarmData(session.role === "ADMIN");
    if (session.role === "ADMIN") return NextResponse.json(data);
    const { backup: _backup, ...publicData } = data;
    void _backup;
    return NextResponse.json(publicData);
  } catch {
    return NextResponse.json(
      { error: "알람 데이터를 조회하지 못했습니다. Google Sheets 연결을 확인한 후 다시 시도하세요." },
      { status: 503 },
    );
  }
}
