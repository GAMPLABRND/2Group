import { NextResponse } from "next/server";

import { auditActor, authorizeRequest, hasEffectivePermission } from "@/app/api/admin/_utils";
import { logAudit, newId } from "@/lib/audit";
import { currentKstDate, isCalibrationExpired, normalizeEquipmentApplicability, reconcileCalibrationExpiry } from "@/lib/equipment";
import { nowISO } from "@/lib/kst";
import { TAB_HEADERS } from "@/lib/schema";
import { appendMissingHeaders } from "@/lib/schema-migration";
import { appendRow, getRows, updateRowById } from "@/lib/sheets";
import type { EquipmentAvailability, EquipmentRow } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const AVAILABILITY = new Set<EquipmentAvailability>(["AVAILABLE", "SUSPENDED", "RETIRED"]);
const APPLICABILITY = new Set(["REQUIRED", "NOT_REQUIRED"]);
const OCCUPANCY_FIELDS = [
  "occupancy_status",
  "occupancy_record_id",
  "occupied_by_user_id",
  "occupied_by_user_name",
  "occupied_at",
];

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function toEquipment(row: Record<string, string>): EquipmentRow {
  return {
    id: row.id ?? "",
    equipment_code: row.equipment_code ?? "",
    equipment_name: row.equipment_name ?? "",
    location: row.location ?? "",
    calibration_required: row.calibration_required ?? "",
    calibration_due_date: row.calibration_due_date ?? "",
    qualification_required: row.qualification_required || row.calibration_required || "NOT_REQUIRED",
    availability_status: row.availability_status ?? "",
    occupancy_status: row.occupancy_status ?? "",
    occupancy_record_id: row.occupancy_record_id ?? "",
    occupied_by_user_id: row.occupied_by_user_id ?? "",
    occupied_by_user_name: row.occupied_by_user_name ?? "",
    occupied_at: row.occupied_at ?? "",
    remarks: row.remarks ?? "",
    created_by: row.created_by ?? "",
    created_at: row.created_at ?? "",
    updated_by: row.updated_by ?? "",
    updated_at: row.updated_at ?? "",
  };
}

function validateDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function equipmentInput(body: Record<string, unknown>) {
  if (OCCUPANCY_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(body, field))) {
    throw new Error("현재 점유 상태는 사용 기록 흐름에서만 변경할 수 있습니다.");
  }
  const equipmentCode = asText(body.equipment_code);
  const equipmentName = asText(body.equipment_name);
  const location = asText(body.location);
  const calibrationRequired = asText(body.calibration_required);
  const qualificationRequired = asText(body.qualification_required);
  let calibrationDueDate = asText(body.calibration_due_date);
  const requestedAvailabilityStatus = asText(body.availability_status) as EquipmentAvailability;
  const remarks = asText(body.remarks);
  if (!equipmentCode || !equipmentName || !location) throw new Error("장비 코드, 장비명, 설치 위치는 필수입니다.");
  if (!APPLICABILITY.has(calibrationRequired)) throw new Error("교정 대상 여부를 확인하세요.");
  if (!APPLICABILITY.has(qualificationRequired)) throw new Error("적격성평가 대상 여부를 확인하세요.");
  if (!AVAILABILITY.has(requestedAvailabilityStatus)) throw new Error("사용 상태를 선택하세요.");
  const dueDateRequired = calibrationRequired === "REQUIRED" || qualificationRequired === "REQUIRED";
  if (dueDateRequired) {
    if (!calibrationDueDate) throw new Error("교정 또는 적격성평가 대상 장비는 교정 유효기간이 필요합니다.");
    if (!validateDate(calibrationDueDate)) throw new Error("교정 유효기간은 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.");
  } else {
    calibrationDueDate = "";
  }
  const availabilityStatus =
    requestedAvailabilityStatus === "AVAILABLE" &&
    calibrationRequired === "REQUIRED" &&
    calibrationDueDate < currentKstDate()
      ? "SUSPENDED"
      : requestedAvailabilityStatus;
  return {
    equipment_code: equipmentCode,
    equipment_name: equipmentName,
    location,
    calibration_required: calibrationRequired,
    calibration_due_date: calibrationDueDate,
    qualification_required: qualificationRequired,
    availability_status: availabilityStatus,
    remarks,
  };
}

export async function GET() {
  const authorization = await authorizeRequest("/api/equipment", ["ADMIN", "TESTER", "APPROVER"], {
    requiredPermission: "EQUIPMENT_VIEW",
  });
  if (!authorization.ok) return authorization.response;
  try {
    const rows = await reconcileCalibrationExpiry((await getRows("EQUIPMENT")).map(toEquipment));
    return NextResponse.json({
      equipment: rows,
      can_manage: hasEffectivePermission(
        authorization.value.user,
        authorization.value.session.role,
        ["ADMIN"],
        "EQUIPMENT_MANAGE",
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `장비 기준정보를 불러오지 못했습니다: ${message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest("/api/equipment", ["ADMIN"], { requiredPermission: "EQUIPMENT_MANAGE" });
  if (!authorization.ok) return authorization.response;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  try {
    const input = equipmentInput(body);
    await appendMissingHeaders("EQUIPMENT", TAB_HEADERS.EQUIPMENT);
    const equipment = (await getRows("EQUIPMENT")).map(toEquipment);
    if (equipment.some((row) => row.equipment_code === input.equipment_code)) {
      throw new Error("이미 등록된 장비 코드입니다.");
    }
    const timestamp = nowISO();
    const row: EquipmentRow = {
      id: newId(),
      ...input,
      occupancy_status: "FREE",
      occupancy_record_id: "",
      occupied_by_user_id: "",
      occupied_by_user_name: "",
      occupied_at: "",
      created_by: authorization.value.user.user_id,
      created_at: timestamp,
      updated_by: authorization.value.user.user_id,
      updated_at: timestamp,
    };
    await appendRow("EQUIPMENT", row);
    await logAudit({
      category: "DATA",
      actor: auditActor(authorization.value.user),
      action: "DATA.EQUIPMENT_CREATED",
      target: row.id,
      after: JSON.stringify(row),
    });
    return NextResponse.json({ ok: true, equipment: normalizeEquipmentApplicability(row) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeRequest("/api/equipment", ["ADMIN"], { requiredPermission: "EQUIPMENT_MANAGE" });
  if (!authorization.ok) return authorization.response;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  try {
    const id = asText(body.id);
    const modificationReason = asText(body.modification_reason);
    const statusChangeReason = asText(body.status_change_reason);
    if (!id) throw new Error("대상 장비 식별자가 필요합니다.");
    if (!modificationReason) throw new Error("수정 사유를 입력하세요.");
    const input = equipmentInput(body);
    await appendMissingHeaders("EQUIPMENT", TAB_HEADERS.EQUIPMENT);
    const equipment = await reconcileCalibrationExpiry((await getRows("EQUIPMENT")).map(toEquipment));
    const before = equipment.find((row) => row.id === id);
    if (!before) throw new Error("대상 장비를 찾을 수 없습니다.");
    if (equipment.some((row) => row.id !== id && row.equipment_code === input.equipment_code)) {
      throw new Error("이미 등록된 장비 코드입니다.");
    }
    const statusChanged = before.availability_status !== input.availability_status;
    const automaticallySuspended =
      statusChanged &&
      input.availability_status === "SUSPENDED" &&
      isCalibrationExpired(input as EquipmentRow);
    if (statusChanged && !statusChangeReason && !automaticallySuspended) throw new Error("사용 상태 변경 사유를 입력하세요.");
    if (statusChanged && input.availability_status === "AVAILABLE") {
      const requests = await getRows("EQUIPMENT_RESUME_REQUESTS");
      const pending = requests.some(
        (row) =>
          row.equipment_id === id &&
          ["PENDING", "REQUESTED", "AWAITING_APPROVAL"].includes(row.resume_status),
      );
      if (pending) throw new Error("사용 재개 승인 대기 중인 장비는 관리자 설정에서 사용가능으로 변경할 수 없습니다.");
    }
    const patch = {
      ...input,
      updated_by: authorization.value.user.user_id,
      updated_at: nowISO(),
    };
    await updateRowById("EQUIPMENT", id, patch);
    const after = normalizeEquipmentApplicability({ ...before, ...patch } as EquipmentRow);
    await logAudit({
      category: "DATA",
      actor: auditActor(authorization.value.user),
      action: "DATA.EQUIPMENT_UPDATED",
      target: id,
      before: JSON.stringify(before),
      after: JSON.stringify(after),
      reason: modificationReason,
    });
    if (statusChanged) {
      await logAudit({
        category: "DATA",
        actor: auditActor(authorization.value.user),
        action: "DATA.EQUIPMENT_USAGE_STATUS_CHANGED",
        target: id,
        before: JSON.stringify({ availability_status: before.availability_status }),
        after: JSON.stringify({ availability_status: after.availability_status }),
        reason: statusChangeReason || "교정 유효기간 만료에 따른 자동 사용중지",
      });
    }
    return NextResponse.json({ ok: true, equipment: after });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
