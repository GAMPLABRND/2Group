import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { getRows, updateRowById } from "@/lib/sheets";
import type { UseRecordRow } from "@/types";

import {
  authenticateActor,
  D3_TABS,
  errorResponse,
  INVALID_TRANSITION_MESSAGE,
  REQUIRED_FIELD_MESSAGE,
  REVIEWED_LOCK_MESSAGE,
  trimmed,
} from "../../../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ record_id: string }> }) {
  const auth = await authenticateActor(["APPROVER"], "REVIEW_SIGN", "POST /api/approvals/change-request");
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(REQUIRED_FIELD_MESSAGE, 400, ["수정 요청 사유"]);
  }
  const reason = trimmed((body as { reason?: unknown } | null)?.reason);
  if (!reason) return errorResponse(REQUIRED_FIELD_MESSAGE, 400, ["수정 요청 사유"]);

  try {
    const { record_id: recordId } = await context.params;
    const records = (await getRows(D3_TABS.records)) as UseRecordRow[];
    const record = records.find((row) => row.id === recordId);
    if (!record) return errorResponse("사용 기록을 찾을 수 없습니다.", 404);
    if (record.record_status === "REVIEWED") return errorResponse(REVIEWED_LOCK_MESSAGE, 409);
    if (record.record_status !== "COMPLETED") return errorResponse(INVALID_TRANSITION_MESSAGE, 409);

    const changedAt = nowISO();
    await updateRowById(D3_TABS.records, record.id, {
      record_status: "CHANGE_REQUESTED",
      change_request_reason: reason,
      updated_by: auth.actor.id,
      updated_at: changedAt,
    });
    await logAudit({
      category: "DATA",
      actor: { id: auth.actor.id, name: auth.actor.name, role: auth.actor.role },
      action: "REVIEW_CHANGE_REQUESTED",
      target: `USE_RECORDS/${record.id}`,
      before: JSON.stringify({ record_status: record.record_status }),
      after: JSON.stringify({ record_status: "CHANGE_REQUESTED" }),
      reason,
    });

    return NextResponse.json({
      message: "수정 요청을 저장했습니다.",
      record_status: "CHANGE_REQUESTED",
      changed_at: changedAt,
    });
  } catch (error) {
    console.error("[approvals] change request failed", error);
    return errorResponse("수정 요청을 저장하지 못했습니다.", 500);
  }
}
