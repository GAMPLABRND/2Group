import { NextResponse } from "next/server";

import { getRows } from "@/lib/sheets";
import { normalizeEquipmentApplicability } from "@/lib/equipment";
import type { EquipmentRow } from "@/types";

import { authenticateActor, D3_TABS } from "../../approvals/_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const auth = await authenticateActor(["ADMIN", "TESTER", "APPROVER"], "LOGBOOK_PRINT", "GET /api/print/equipment");
  if ("response" in auth) return auth.response;

  try {
    const equipment = ((await getRows(D3_TABS.equipment)) as EquipmentRow[])
      .map(normalizeEquipmentApplicability)
      .map((row) => ({
        id: row.id,
        equipment_code: row.equipment_code,
        equipment_name: row.equipment_name,
        availability_status: row.availability_status,
      }))
      .sort((a, b) => a.equipment_code.localeCompare(b.equipment_code));
    return NextResponse.json({ equipment });
  } catch (error) {
    console.error("[print] equipment read failed", error);
    return NextResponse.json({ error: "로그북 장비 목록을 조회하지 못했습니다." }, { status: 500 });
  }
}
