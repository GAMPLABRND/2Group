// Google Sheets 탭과 헤더의 통합 정본. 기존 열은 유지하고 필요한 열만 끝에 추가한다.

export const TAB_HEADERS = {
  USERS: [
    "id", "user_id", "name", "password", "role", "status", "created_at",
    "employee_no", "permission_overrides", "password_changed_at", "password_expires_at",
    "failed_login_count", "locked_at", "updated_at",
  ],
  SECURITY_SETTINGS: [
    "id", "min_password_length", "require_uppercase", "require_lowercase", "require_digit",
    "require_special", "password_validity_days", "max_failed_login_attempts", "idle_timeout_minutes",
    "updated_by", "updated_at",
  ],
  TRAINING_PROFILE: ["id", "company_name", "trainee_name", "team_no", "updated_by", "updated_at", "members_json"],
  TRAINING_HISTORY: ["id", "user_id", "course_name", "completed_at", "recorded_by", "status"],
  EQUIPMENT: [
    "id", "equipment_code", "equipment_name", "location", "calibration_required", "calibration_due_date",
    "availability_status", "occupancy_status", "occupancy_record_id", "occupied_by_user_id",
    "occupied_by_user_name", "occupied_at", "remarks", "created_by", "created_at", "updated_by", "updated_at",
    "qualification_required",
  ],
  USE_RECORDS: [
    "id", "equipment_id", "equipment_code", "equipment_name", "user_id", "user_name", "employee_no",
    "usage_type", "usage_purpose", "reference_no", "started_at", "ended_at", "record_status",
    "after_use_status", "abnormality_details", "end_method", "exception_ended_by_id",
    "exception_ended_by_name", "exception_ended_at", "exception_reason", "change_request_reason",
    "reviewer_id", "reviewer_name", "reviewed_at", "signature_meaning", "invalidated_by",
    "invalidated_at", "invalidation_reason", "updated_by", "updated_at",
  ],
  EQUIPMENT_REMEDIATIONS: [
    "id", "equipment_id", "source_record_id", "action_type", "action_details", "action_recorded_by_id",
    "action_recorded_by_name", "action_recorded_at", "updated_by_id", "updated_at", "remediation_status",
  ],
  EQUIPMENT_RESUME_REQUESTS: [
    "id", "equipment_id", "source_record_id", "remediation_id", "action_details_snapshot",
    "request_sequence", "resume_status", "requested_by_id", "requested_by_name", "requested_at",
    "confirmed_by_id", "confirmed_by_name", "confirmed_at", "confirmation_result", "rejection_reason",
  ],
  BACKUP_SETTINGS: [
    "id", "interval_days", "execution_time", "enabled", "timezone", "updated_by", "updated_at",
  ],
  BACKUP_RUNS: [
    "id", "backup_date", "started_at", "completed_at", "status", "backup_scope", "file_format",
    "file_name", "file_size_bytes", "error_message", "drive_file_id", "sha256", "trigger_type",
    "triggered_by", "schedule_key",
  ],
  BACKUP_ALARMS: [
    "id", "backup_id", "backup_date", "started_at", "completed_at", "result", "backup_type",
    "file_name", "error_message", "drive_file_id", "created_at",
  ],
  ALARM_ACKS: [
    "id", "alarm_key", "user_id", "acknowledged_at", "alarm_type", "target", "created_at",
  ],
  AUDIT: [
    "id", "category", "actor_id", "actor_name", "role", "action", "target",
    "before_value", "after_value", "reason", "timestamp_kst",
  ],
} as const;

export type TabName = keyof typeof TAB_HEADERS;

export const SEED_USERS = [
  { id: "seed-user-admin", user_id: "admin", name: "관리자", employee_no: "EDU2-001", role: "ADMIN" },
  { id: "seed-user-user", user_id: "user", name: "사용자", employee_no: "EDU2-002", role: "TESTER" },
  { id: "seed-user-reviewer", user_id: "reviewer", name: "검토자", employee_no: "EDU2-003", role: "APPROVER" },
] as const;

export const SEED_EQUIPMENT = [
  { id: "seed-equip-hplc-01", equipment_code: "HPLC-01", equipment_name: "HPLC 분석기 1호", location: "분석실 A", calibration_required: "REQUIRED", calibration_due_date: "2026-12-31", qualification_required: "REQUIRED", remarks: "정상 교정 유효 장비" },
  { id: "seed-equip-bal-01", equipment_code: "BAL-01", equipment_name: "전자저울 1호", location: "칭량실", calibration_required: "REQUIRED", calibration_due_date: "2025-12-31", qualification_required: "NOT_REQUIRED", remarks: "교정 유효기간 경과 실습 장비" },
  { id: "seed-equip-inc-01", equipment_code: "INC-01", equipment_name: "인큐베이터 1호", location: "배양실", calibration_required: "NOT_REQUIRED", calibration_due_date: "2027-06-30", qualification_required: "REQUIRED", remarks: "적격성평가 대상 장비" },
] as const;
