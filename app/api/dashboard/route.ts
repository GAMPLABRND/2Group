import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { getDashboardData } from "./data";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const session = await getApiSession(["ADMIN", "TESTER", "APPROVER"], "DASHBOARD_VIEW", "GET /api/dashboard");
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    return NextResponse.json(await getDashboardData());
  } catch {
    return NextResponse.json(
      { error: "대시보드 데이터를 조회하지 못했습니다. Google Sheets 연결을 확인한 후 다시 시도하세요." },
      { status: 503 },
    );
  }
}
