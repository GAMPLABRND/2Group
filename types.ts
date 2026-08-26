// URS 기반 공통 타입. 공유 파일은 오케스트레이터만 수정한다.

export const ROLES = ["ADMIN", "TESTER", "APPROVER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "관리자",
  TESTER: "사용자",
  APPROVER: "검토자",
};

export type Session = { userId: string; role: Role };

export type UserRow = {
  id: string;
  user_id: string;
  name: string;
  employee_no: string;
  password: string;
  role: Role | string;
  status: "ACTIVE" | "INACTIVE" | string;
  permission_overrides: string;
  password_changed_at: string;
  password_expires_at: string;
  failed_login_count: string;
  locked_at: string;
  created_at: string;
  updated_at: string;
};

export type AccountOption = { user_id: string; name: string; role: string; initial: boolean };

export const EQUIPMENT_AVAILABILITY = ["AVAILABLE", "SUSPENDED", "RETIRED"] as const;
export type EquipmentAvailability = (typeof EQUIPMENT_AVAILABILITY)[number];
export const EQUIPMENT_OCCUPANCY = ["FREE", "OCCUPIED"] as const;
export type EquipmentOccupancy = (typeof EQUIPMENT_OCCUPANCY)[number];

export type EquipmentRow = {
  id: string;
  equipment_code: string;
  equipment_name: string;
  location: string;
  calibration_required: "REQUIRED" | "NOT_REQUIRED" | string;
  calibration_due_date: string;
  qualification_required: "REQUIRED" | "NOT_REQUIRED" | string;
  availability_status: EquipmentAvailability | string;
  occupancy_status: EquipmentOccupancy | string;
  occupancy_record_id: string;
  occupied_by_user_id: string;
  occupied_by_user_name: string;
  occupied_at: string;
  remarks: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
};

export const USE_RECORD_STATUSES = ["IN_USE", "COMPLETED", "CHANGE_REQUESTED", "REVIEWED", "INVALID"] as const;
export type UseRecordStatus = (typeof USE_RECORD_STATUSES)[number];

export type UseRecordRow = {
  id: string;
  equipment_id: string;
  equipment_code: string;
  equipment_name: string;
  user_id: string;
  user_name: string;
  employee_no: string;
  usage_type: string;
  usage_purpose: string;
  reference_no: string;
  started_at: string;
  ended_at: string;
  record_status: UseRecordStatus | string;
  after_use_status: string;
  abnormality_details: string;
  end_method: string;
  exception_ended_by_id: string;
  exception_ended_by_name: string;
  exception_ended_at: string;
  exception_reason: string;
  change_request_reason: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewed_at: string;
  signature_meaning: string;
  invalidated_by: string;
  invalidated_at: string;
  invalidation_reason: string;
  updated_by: string;
  updated_at: string;
};

export type AuditCategory = "SECURITY" | "DATA" | "SYSTEM";
export type AuditRow = {
  id: string;
  category: string;
  actor_id: string;
  actor_name: string;
  role: string;
  action: string;
  target: string;
  before_value: string;
  after_value: string;
  reason: string;
  timestamp_kst: string;
};

export type BackupSettings = {
  id: string;
  intervalDays: number;
  executionTime: string;
  enabled: boolean;
  timezone: "Asia/Seoul";
  updatedBy: string;
  updatedAt: string;
};

export type BackupRun = {
  id: string;
  backupDate: string;
  startedAt: string;
  completedAt: string;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  backupScope: string;
  fileFormat: "XLSX";
  fileName: string;
  fileSizeBytes: number;
  errorMessage: string;
  driveFileId: string;
  sha256: string;
  triggerType: "MANUAL" | "SCHEDULED";
  triggeredBy: string;
  scheduleKey: string;
};
