import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { getRows, updateRowById } from "@/lib/sheets";
import type { EquipmentRow } from "@/types";

import {
  authenticateActor,
  D3_TABS,
  errorResponse,
  INVALID_TRANSITION_MESSAGE,
  REQUIRED_FIELD_MESSAGE,
  trimmed,
} from "../../../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type ResumeRequestRow = Record<string, string> & {
  id: string;
  equipment_id: string;
  source_record_id: string;
  remediation_id: string;
  resume_status: string;
  requested_by_id: string;
  requested_by_name: string;
  confirmed_by_id: string;
  confirmed_by_name: string;
  confirmed_at: string;
  confirmation_result: string;
  rejection_reason: string;
};

type RemediationRow = Record<string, string> & {
  id: string;
  action_recorded_by_id: string;
  remediation_status: string;
};

const SECOND_PERSON_MESSAGE =
  "사용 재개를 반려하는 경우 반려 사유를 필수로 입력해야 하며, 반려된 장비는 조치 내용을 보완하여 다시 사용 재개를 요청할 수 있어야 한다.";

export async function POST(request: Request, context: { params: Promise<{ request_id: string }> }) {
  const auth = await authenticateActor(["APPROVER"], "RESUME_APPROVE", "POST /api/approvals/resume-decision");
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(REQUIRED_FIELD_MESSAGE, 400, ["확인 결과"]);
  }
  const result = trimmed((body as { result?: unknown } | null)?.result);
  const reason = trimmed((body as { reason?: unknown } | null)?.reason);
  if (!(["APPROVED", "REJECTED"] as const).includes(result as "APPROVED" | "REJECTED")) {
    return errorResponse(REQUIRED_FIELD_MESSAGE, 400, ["확인 결과"]);
  }
  if (result === "REJECTED" && !reason) {
    return errorResponse(SECOND_PERSON_MESSAGE, 400, ["반려 사유"]);
  }

  try {
    const { request_id: requestId } = await context.params;
    const [requestRows, remediationRows, equipmentRows] = await Promise.all([
      getRows(D3_TABS.resumeRequests),
      getRows(D3_TABS.remediations),
      getRows(D3_TABS.equipment),
    ]);
    const resumeRequest = (requestRows as ResumeRequestRow[]).find((row) => row.id === requestId);
    if (!resumeRequest) return errorResponse("사용 재개 요청을 찾을 수 없습니다.", 404);
    if (resumeRequest.resume_status !== "REQUESTED") {
      return errorResponse(INVALID_TRANSITION_MESSAGE, 409);
    }

    const remediation = (remediationRows as RemediationRow[]).find(
      (row) => row.id === resumeRequest.remediation_id,
    );
    const equipment = (equipmentRows as EquipmentRow[]).find(
      (row) => row.id === resumeRequest.equipment_id,
    );
    if (!remediation || !equipment) {
      return errorResponse("사용 재개 요청의 장비 또는 조치 기록을 찾을 수 없습니다.", 409);
    }
    if (
      auth.actor.id === resumeRequest.requested_by_id ||
      auth.actor.id === remediation.action_recorded_by_id
    ) {
      return errorResponse(SECOND_PERSON_MESSAGE, 403);
    }
    if (remediation.remediation_status !== "RESUME_REQUESTED") {
      return errorResponse(INVALID_TRANSITION_MESSAGE, 409);
    }
    if (equipment.availability_status !== "SUSPENDED" || equipment.occupancy_status !== "FREE") {
      return errorResponse(INVALID_TRANSITION_MESSAGE, 409);
    }

    const decidedAt = nowISO();
    const decisionPatch = {
      resume_status: result,
      confirmed_by_id: auth.actor.id,
      confirmed_by_name: auth.actor.name,
      confirmed_at: decidedAt,
      confirmation_result: result === "APPROVED" ? "승인" : "반려",
      rejection_reason: result === "REJECTED" ? reason : "",
    };
    const remediationPatch = { remediation_status: result };
    let remediationChanged = false;
    let requestChanged = false;

    try {
      await updateRowById(D3_TABS.remediations, remediation.id, remediationPatch);
      remediationChanged = true;
      await updateRowById(D3_TABS.resumeRequests, resumeRequest.id, decisionPatch);
      requestChanged = true;
      if (result === "APPROVED") {
        await updateRowById(D3_TABS.equipment, equipment.id, {
          availability_status: "AVAILABLE",
          occupancy_status: "FREE",
          occupancy_record_id: "",
          occupied_by_user_id: "",
          occupied_by_user_name: "",
          occupied_at: "",
          updated_by: auth.actor.id,
          updated_at: decidedAt,
        });
      }
    } catch (writeError) {
      const compensations: Promise<unknown>[] = [];
      if (requestChanged) {
        compensations.push(
          updateRowById(D3_TABS.resumeRequests, resumeRequest.id, {
            resume_status: resumeRequest.resume_status,
            confirmed_by_id: resumeRequest.confirmed_by_id,
            confirmed_by_name: resumeRequest.confirmed_by_name,
            confirmed_at: resumeRequest.confirmed_at,
            confirmation_result: resumeRequest.confirmation_result,
            rejection_reason: resumeRequest.rejection_reason,
          }),
        );
      }
      if (remediationChanged) {
        compensations.push(
          updateRowById(D3_TABS.remediations, remediation.id, {
            remediation_status: remediation.remediation_status,
          }),
        );
      }
      await Promise.allSettled(compensations);
      throw writeError;
    }

    await logAudit({
      category: "DATA",
      actor: { id: auth.actor.id, name: auth.actor.name, role: auth.actor.role },
      action: result === "APPROVED" ? "RESUME_APPROVED" : "RESUME_REJECTED",
      target: `EQUIPMENT_RESUME_REQUESTS/${resumeRequest.id}`,
      before: JSON.stringify({
        resume_status: resumeRequest.resume_status,
        remediation_status: remediation.remediation_status,
        equipment_status: equipment.availability_status,
      }),
      after: JSON.stringify({
        resume_status: result,
        remediation_status: result,
        equipment_status: result === "APPROVED" ? "AVAILABLE" : "SUSPENDED",
        confirmed_at: decidedAt,
      }),
      reason,
    });

    return NextResponse.json({
      message: result === "APPROVED" ? "사용 재개를 승인했습니다." : "사용 재개를 반려했습니다.",
      resume_status: result,
      confirmed_by_id: auth.actor.id,
      confirmed_by_name: auth.actor.name,
      confirmed_at: decidedAt,
    });
  } catch (error) {
    console.error("[approvals] resume decision failed", error);
    return errorResponse("사용 재개 확인 결과를 저장하지 못했습니다.", 500);
  }
}
