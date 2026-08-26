import { NextResponse } from "next/server";

import { getRows } from "@/lib/sheets";
import { normalizeEquipmentApplicability } from "@/lib/equipment";
import type { EquipmentRow, UseRecordRow } from "@/types";

import { authenticateActor, D3_TABS } from "./_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type RemediationRow = Record<string, string> & {
  id: string;
  equipment_id: string;
  source_record_id: string;
  action_type: string;
  action_details: string;
  action_recorded_by_id: string;
  action_recorded_by_name: string;
  action_recorded_at: string;
  remediation_status: string;
};

type ResumeRequestRow = Record<string, string> & {
  id: string;
  equipment_id: string;
  source_record_id: string;
  remediation_id: string;
  action_details_snapshot: string;
  request_sequence: string;
  resume_status: string;
  requested_by_id: string;
  requested_by_name: string;
  requested_at: string;
  confirmed_by_id: string;
  confirmed_by_name: string;
  confirmed_at: string;
  confirmation_result: string;
  rejection_reason: string;
};

export async function GET() {
  const auth = await authenticateActor(["APPROVER"], "REVIEW_SIGN", "GET /api/approvals");
  if ("response" in auth) return auth.response;

  try {
    const [recordRows, remediationRows, resumeRows, equipmentRows] = await Promise.all([
      getRows(D3_TABS.records),
      getRows(D3_TABS.remediations),
      getRows(D3_TABS.resumeRequests),
      getRows(D3_TABS.equipment),
    ]);
    const records = recordRows as UseRecordRow[];
    const remediations = remediationRows as RemediationRow[];
    const resumeRequests = resumeRows as ResumeRequestRow[];
    const equipment = (equipmentRows as EquipmentRow[]).map(normalizeEquipmentApplicability);

    const reviewRecords = records
      .filter((record) => ["COMPLETED", "CHANGE_REQUESTED"].includes(record.record_status))
      .map((record) => ({
        ...record,
        equipment: equipment.find((row) => row.id === record.equipment_id) ?? null,
        remediations: remediations.filter((row) => row.source_record_id === record.id),
        resume_requests: resumeRequests.filter((row) => row.source_record_id === record.id),
      }))
      .sort((a, b) => b.ended_at.localeCompare(a.ended_at));

    const pendingResumeRequests = resumeRequests
      .filter((request) => request.resume_status === "REQUESTED")
      .map((request) => ({
        ...request,
        equipment: equipment.find((row) => row.id === request.equipment_id) ?? null,
        remediation: remediations.find((row) => row.id === request.remediation_id) ?? null,
        source_record: records.find((row) => row.id === request.source_record_id) ?? null,
      }))
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at));

    return NextResponse.json({
      current_user: {
        user_id: auth.actor.id,
        name: auth.actor.name,
        role: auth.actor.role,
      },
      review_records: reviewRecords,
      resume_requests: pendingResumeRequests,
    });
  } catch (error) {
    console.error("[approvals] queue read failed", error);
    return NextResponse.json({ error: "검토와 승인 대기 목록을 조회하지 못했습니다." }, { status: 500 });
  }
}
