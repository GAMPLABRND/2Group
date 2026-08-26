import { NextResponse } from "next/server";

import { authorizeRequest } from "@/app/api/admin/_utils";
import { getRows } from "@/lib/sheets";
import { trainingProfileFromRow } from "@/lib/training-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const authorization = await authorizeRequest(
    "/api/admin/training-profile",
    ["ADMIN", "TESTER", "APPROVER"],
  );
  if (!authorization.ok) return authorization.response;
  try {
    const rows = await getRows("TRAINING_PROFILE");
    const row = rows.find((item) => item.id === "training-profile-default") ?? rows[0];
    const profile = trainingProfileFromRow(row);
    return NextResponse.json({ training_profile: profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `실습 정보를 불러오지 못했습니다: ${message}` }, { status: 500 });
  }
}
