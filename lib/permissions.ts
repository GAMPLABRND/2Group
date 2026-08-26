import type { Role } from "@/types";

export type PermissionOverride = { allow: string[]; deny: string[] };

export const PERMISSION_CATALOG = [
  { code: "DASHBOARD_VIEW", label: "대시보드 조회", baseRoles: ["ADMIN", "TESTER", "APPROVER"] },
  { code: "EQUIPMENT_VIEW", label: "장비 기준정보 조회", baseRoles: ["ADMIN", "TESTER", "APPROVER"] },
  { code: "EQUIPMENT_MANAGE", label: "장비 기준정보 관리", baseRoles: ["ADMIN"] },
  { code: "USE_RECORD_START", label: "장비 사용 시작", baseRoles: ["TESTER"] },
  { code: "USE_RECORD_COMPLETE", label: "장비 사용 종료", baseRoles: ["TESTER"] },
  { code: "USE_RECORD_VIEW", label: "사용 기록 조회", baseRoles: ["ADMIN", "TESTER", "APPROVER"] },
  { code: "USE_RECORD_AMEND_OWN", label: "본인 사용 기록 수정과 무효", baseRoles: ["TESTER"] },
  { code: "USE_RECORD_EXCEPTION_CLOSE", label: "사용 기록 예외 종료", baseRoles: ["ADMIN"] },
  { code: "REMEDIATION_RECORD", label: "이상 조치 기록", baseRoles: ["TESTER"] },
  { code: "RESUME_REQUEST", label: "장비 사용 재개 요청", baseRoles: ["TESTER"] },
  { code: "RESUME_APPROVE", label: "장비 사용 재개 승인", baseRoles: ["APPROVER"] },
  { code: "REVIEW_SIGN", label: "검토와 전자서명", baseRoles: ["APPROVER"] },
  { code: "LOGBOOK_PRINT", label: "로그북 조회와 출력", baseRoles: ["ADMIN", "TESTER", "APPROVER"] },
  { code: "ALARM_VIEW", label: "알람 조회", baseRoles: ["ADMIN", "TESTER", "APPROVER"] },
  { code: "PASSWORD_CHANGE", label: "본인 비밀번호 변경", baseRoles: ["ADMIN", "TESTER", "APPROVER"] },
  { code: "AUDIT_VIEW", label: "감사추적 조회", baseRoles: ["ADMIN", "APPROVER"] },
  { code: "AUDIT_PRINT", label: "감사추적 출력", baseRoles: ["ADMIN", "APPROVER"] },
  { code: "BACKUP_MANAGE", label: "백업 생성, 이력 조회와 브라우저 다운로드", baseRoles: ["ADMIN"] },
  { code: "ADMIN_MANAGE", label: "사용자와 보안 설정 관리", baseRoles: ["ADMIN"] },
] as const satisfies readonly { code: string; label: string; baseRoles: readonly Role[] }[];

export function parsePermissionOverrides(value: unknown): PermissionOverride {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value || "{}") : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { allow: [], deny: [] };
    const source = parsed as { allow?: unknown; deny?: unknown };
    return {
      allow: Array.isArray(source.allow) ? source.allow.map(String) : [],
      deny: Array.isArray(source.deny) ? source.deny.map(String) : [],
    };
  } catch {
    return { allow: [], deny: [] };
  }
}

export function roleDefaultPermissions(role: string) {
  return PERMISSION_CATALOG.filter((permission) => permission.baseRoles.some((baseRole) => baseRole === role)).map(
    (permission) => permission.code,
  );
}

export function effectivePermissions(role: string, overrides: PermissionOverride) {
  const effective = new Set<string>(roleDefaultPermissions(role));
  for (const permission of overrides.allow) effective.add(permission);
  for (const permission of overrides.deny) effective.delete(permission);
  return PERMISSION_CATALOG.map((permission) => permission.code).filter((permission) => effective.has(permission));
}

export function permissionLabel(code: string) {
  return PERMISSION_CATALOG.find((permission) => permission.code === code)?.label ?? code;
}
