import { getApiSession } from "@/lib/auth";
import { logAudit, newId } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { reconcileCalibrationExpiry } from "@/lib/equipment";
import { getRows, updateRowById } from "@/lib/sheets";
import { TAB_HEADERS } from "@/lib/schema";
import type { EquipmentRow, Role, Session, UseRecordRow, UserRow } from "@/types";

export const EQUIPMENT_TAB = "EQUIPMENT";
export const RECORDS_TAB = "USE_RECORDS";
export const REMEDIATIONS_TAB = "EQUIPMENT_REMEDIATIONS";
export const RESUME_REQUESTS_TAB = "EQUIPMENT_RESUME_REQUESTS";
export const USERS_TAB = "USERS";

export const USAGE_TYPES = [
  "일반 사용",
  "시험/분석",
  "적격성평가/밸리데이션",
  "점검/유지보수",
  "기타",
] as const;
export const AFTER_USE_STATUSES = ["NORMAL", "ABNORMAL"] as const;
export const ACTION_TYPES = ["INSPECTION", "REPAIR", "OTHER"] as const;

export type Actor = Session & { name: string; employeeNo: string };

export type RemediationRow = {
  id: string;
  equipment_id: string;
  source_record_id: string;
  action_type: string;
  action_details: string;
  action_recorded_by_id: string;
  action_recorded_by_name: string;
  action_recorded_at: string;
  updated_by_id: string;
  updated_at: string;
  remediation_status: string;
};

export type ResumeRequestRow = {
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

export class BusinessError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const ACCESS_NOTICE =
  "권한이 없는 화면 또는 기능에 접근을 시도하면 접근이 차단되고 안내 메시지가 표시된 후 메인 화면으로 이동한다.";
const AUTO_FIELD_NOTICE =
  "시스템이 자동 생성하는 사용자 및 일시 정보는 사용자가 임의로 변경할 수 없어야 한다.";

function rowsAs<T>(rows: Record<string, string>[]): T[] {
  return rows as unknown as T[];
}

export async function readEquipment(): Promise<EquipmentRow[]> {
  return reconcileCalibrationExpiry(rowsAs<EquipmentRow>(await getRows(EQUIPMENT_TAB)));
}

export async function readRecords(): Promise<UseRecordRow[]> {
  return rowsAs<UseRecordRow>(await getRows(RECORDS_TAB));
}

export async function readRemediations(): Promise<RemediationRow[]> {
  return rowsAs<RemediationRow>(await getRows(REMEDIATIONS_TAB));
}

export async function readResumeRequests(): Promise<ResumeRequestRow[]> {
  return rowsAs<ResumeRequestRow>(await getRows(RESUME_REQUESTS_TAB));
}

export async function requireActor(
  roles?: Role[],
  attemptedAction = "records",
  permission?: string,
): Promise<Actor> {
  const session = await getApiSession(roles, permission, attemptedAction);
  if (!session) throw new BusinessError(401, "로그인이 필요합니다.");
  const users = rowsAs<UserRow>(await getRows(USERS_TAB));
  const user = users.find((item) => item.user_id === session.userId);
  if (!user || user.status !== "ACTIVE") {
    await logAudit({
      category: "SECURITY",
      actor: { id: session.userId, name: user?.name || session.userId, role: session.role },
      action: "SECURITY.ACCESS_DENIED",
      target: attemptedAction,
      reason: "활성 계정 확인 실패",
    });
    throw new BusinessError(403, ACCESS_NOTICE);
  }
  const actor: Actor = {
    ...session,
    name: user.name,
    employeeNo: user.employee_no || "",
  };
  return actor;
}

export function parseObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BusinessError(400, "요청 형식이 올바르지 않습니다.");
  }
  return value as Record<string, unknown>;
}

export function textField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

export function assertOnlyKeys(body: Record<string, unknown>, allowed: readonly string[]) {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new BusinessError(400, AUTO_FIELD_NOTICE);
}

export function requireFields(fields: Record<string, string>) {
  const missing = Object.entries(fields)
    .filter(([, value]) => !value.trim())
    .map(([label]) => label);
  if (missing.length) {
    throw new BusinessError(
      400,
      `필수 입력 항목이 누락된 경우 기록을 저장할 수 없으며 누락된 항목을 안내해야 한다. 누락 항목: ${missing.join(
        ", ",
      )}`,
    );
  }
}

export function assertListValue<T extends readonly string[]>(
  value: string,
  values: T,
  label: string,
): asserts value is T[number] {
  if (!values.includes(value)) throw new BusinessError(400, `${label} 값이 올바르지 않습니다.`);
}

export function findRecord(rows: UseRecordRow[], id: string): UseRecordRow {
  const record = rows.find((item) => item.id === id);
  if (!record) throw new BusinessError(404, "사용 기록을 찾을 수 없습니다.");
  return record;
}

export function findEquipment(rows: EquipmentRow[], id: string): EquipmentRow {
  const equipment = rows.find((item) => item.id === id);
  if (!equipment) throw new BusinessError(404, "장비를 찾을 수 없습니다.");
  return equipment;
}

export function findRemediation(rows: RemediationRow[], id: string): RemediationRow {
  const remediation = rows.find((item) => item.id === id);
  if (!remediation) throw new BusinessError(404, "조치 기록을 찾을 수 없습니다.");
  return remediation;
}

export function assertRecordOwner(record: UseRecordRow, actor: Actor) {
  if (actor.role !== "TESTER" || record.user_id !== actor.userId) {
    throw new BusinessError(403, "본인이 작성한 사용 기록만 변경할 수 있습니다.");
  }
}

export function assertMutableRecord(record: UseRecordRow) {
  if (record.record_status === "REVIEWED") {
    throw new BusinessError(409, "검토완료 (전자서명 완료) 된 기록은 기존 값을 직접 수정할 수 없어야 한다.");
  }
  if (record.record_status === "INVALID") {
    throw new BusinessError(409, "무효 처리된 기록은 다시 변경할 수 없습니다.");
  }
}

export function currentKSTDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isoKSTDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function validateDateRange(dateFrom: string, dateTo: string) {
  const valid = (value: string) => {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!valid(dateFrom) || !valid(dateTo)) {
    throw new BusinessError(400, "조회 기간은 YYYY-MM-DD 형식이어야 합니다.");
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new BusinessError(400, "조회 종료일은 조회 시작일보다 빠를 수 없습니다.");
  }
}

function stableSnapshot(row: Record<string, unknown>, headers: readonly string[]): string {
  return JSON.stringify(Object.fromEntries(headers.map((key) => [key, String(row[key] ?? "")])));
}

export function recordSnapshot(row: UseRecordRow | Record<string, unknown>): string {
  return stableSnapshot(row as Record<string, unknown>, TAB_HEADERS.USE_RECORDS);
}

export function equipmentSnapshot(row: EquipmentRow | Record<string, unknown>): string {
  return stableSnapshot(row as Record<string, unknown>, TAB_HEADERS.EQUIPMENT);
}

export function remediationSnapshot(row: RemediationRow | Record<string, unknown>): string {
  return stableSnapshot(row as Record<string, unknown>, TAB_HEADERS.EQUIPMENT_REMEDIATIONS);
}

export function resumeSnapshot(row: ResumeRequestRow | Record<string, unknown>): string {
  return stableSnapshot(row as Record<string, unknown>, TAB_HEADERS.EQUIPMENT_RESUME_REQUESTS);
}

export function publicEquipmentEligibility(equipment: EquipmentRow) {
  let blockedReason = "";
  if (
    equipment.calibration_required === "REQUIRED" &&
    equipment.calibration_due_date &&
    equipment.calibration_due_date < currentKSTDate()
  ) {
    blockedReason = "교정 대상 장비의 교정 유효기간이 지난 경우 새로운 사용을 시작할 수 없어야 한다.";
  } else if (equipment.availability_status === "SUSPENDED" || equipment.availability_status === "RETIRED") {
    blockedReason = "사용중지 또는 폐기 상태인 장비는 새로운 사용을 시작할 수 없어야 한다.";
  } else if (equipment.occupancy_status === "OCCUPIED") {
    blockedReason = "동일 장비에 사용중 상태의 기록이 존재하는 경우 새로운 사용 시작을 등록할 수 없어야 한다.";
  }
  return { ...equipment, eligible: !blockedReason, blocked_reason: blockedReason };
}

export function errorResponse(error: unknown): Response {
  if (error instanceof BusinessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("[records] 요청 처리 실패", error);
  return Response.json(
    { error: "데이터 저장소 요청을 처리하지 못했습니다. 잠시 후 새로고침하여 다시 시도해 주세요." },
    { status: 500 },
  );
}

type GlobalLocks = typeof globalThis & {
  __equipmentRecordLocks?: Map<string, Promise<void>>;
};

const globalLocks = globalThis as GlobalLocks;

export async function withEquipmentLock<T>(equipmentId: string, work: () => Promise<T>): Promise<T> {
  const locks = (globalLocks.__equipmentRecordLocks ??= new Map<string, Promise<void>>());
  const previous = locks.get(equipmentId) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  locks.set(equipmentId, queued);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (locks.get(equipmentId) === queued) locks.delete(equipmentId);
  }
}

export function makeRecord(actor: Actor, equipment: EquipmentRow, body: Record<string, unknown>): UseRecordRow {
  const now = nowISO();
  return {
    id: newId(),
    equipment_id: equipment.id,
    equipment_code: equipment.equipment_code,
    equipment_name: equipment.equipment_name,
    user_id: actor.userId,
    user_name: actor.name,
    employee_no: actor.employeeNo,
    usage_type: textField(body, "usage_type"),
    usage_purpose: textField(body, "usage_purpose"),
    reference_no: textField(body, "reference_no"),
    started_at: now,
    ended_at: "",
    record_status: "IN_USE",
    after_use_status: "",
    abnormality_details: "",
    end_method: "",
    exception_ended_by_id: "",
    exception_ended_by_name: "",
    exception_ended_at: "",
    exception_reason: "",
    change_request_reason: "",
    reviewer_id: "",
    reviewer_name: "",
    reviewed_at: "",
    signature_meaning: "",
    invalidated_by: "",
    invalidated_at: "",
    invalidation_reason: "",
    updated_by: actor.userId,
    updated_at: now,
  };
}

export function occupiedEquipmentPatch(record: UseRecordRow) {
  return {
    occupancy_status: "OCCUPIED",
    occupancy_record_id: record.id,
    occupied_by_user_id: record.user_id,
    occupied_by_user_name: record.user_name,
    occupied_at: record.started_at,
    updated_by: record.user_id,
    updated_at: record.started_at,
  };
}

export function freeEquipmentPatch(actor: Actor, availability?: "AVAILABLE" | "SUSPENDED") {
  return {
    ...(availability ? { availability_status: availability } : {}),
    occupancy_status: "FREE",
    occupancy_record_id: "",
    occupied_by_user_id: "",
    occupied_by_user_name: "",
    occupied_at: "",
    updated_by: actor.userId,
    updated_at: nowISO(),
  };
}

export async function restoreOccupancyFromActive(equipmentId: string, actor: Actor) {
  const active = (await readRecords())
    .filter((item) => item.equipment_id === equipmentId && item.record_status === "IN_USE")
    .sort((a, b) => a.started_at.localeCompare(b.started_at))[0];
  if (active) {
    await updateRowById(EQUIPMENT_TAB, equipmentId, occupiedEquipmentPatch(active));
  } else {
    await updateRowById(EQUIPMENT_TAB, equipmentId, freeEquipmentPatch(actor));
  }
}
