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
  REVIEWED_LOCK_MESSAGE,
  trimmed,
} from "../../../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const SIGNATURE_FAILURE_MESSAGE = "올바른 경우에만 검토가 완료되어야 한다.";

export async function POST(request: Request, context: { params: Promise<{ record_id: string }> }) {
  const auth = await authenticateActor(["APPROVER"], "REVIEW_SIGN", "POST /api/approvals/review-signature");
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(SIGNATURE_FAILURE_MESSAGE, 400);
  }
  const password = trimmed((body as { password?: unknown } | null)?.password);
  if (!password || password !== auth.actor.password) {
    return errorResponse(SIGNATURE_FAILURE_MESSAGE, 403);
  }

  try {
    const { record_id: recordId } = await context.params;
    const records = (await getRows(D3_TABS.records)) as UseRecordRow[];
    const record = records.find((row) => row.id === recordId);
    if (!record) return errorResponse("사용 기록을 찾을 수 없습니다.", 404);
    if (record.record_status === "REVIEWED") return errorResponse(REVIEWED_LOCK_MESSAGE, 409);
    if (record.record_status !== "COMPLETED") return errorResponse(INVALID_TRANSITION_MESSAGE, 409);

    const reviewedAt = nowISO();
    await updateRowById(D3_TABS.records, record.id, {
      record_status: "REVIEWED",
      reviewer_id: auth.actor.id,
      reviewer_name: auth.actor.name,
      reviewed_at: reviewedAt,
      signature_meaning: "검토 완료",
      change_request_reason: "",
      updated_by: auth.actor.id,
      updated_at: reviewedAt,
    });
    await logAudit({
      category: "DATA",
      actor: { id: auth.actor.id, name: auth.actor.name, role: auth.actor.role },
      action: "REVIEW_COMPLETED_E_SIGNATURE",
      target: `USE_RECORDS/${record.id}`,
      before: JSON.stringify({ record_status: record.record_status }),
      after: JSON.stringify({
        record_status: "REVIEWED",
        reviewer_id: auth.actor.id,
        reviewed_at: reviewedAt,
        signature_meaning: "검토 완료",
      }),
    });

    return NextResponse.json({
      message: "전자서명이 되었습니다.",
      record_status: "REVIEWED",
      reviewer_id: auth.actor.id,
      reviewer_name: auth.actor.name,
      reviewed_at: reviewedAt,
      signature_meaning: "검토 완료",
    });
  } catch (error) {
    console.error("[approvals] electronic signature failed", error);
    return errorResponse("전자서명을 저장하지 못했습니다.", 500);
  }
}
