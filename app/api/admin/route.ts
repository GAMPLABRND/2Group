import { NextResponse } from "next/server";

import { auditActor, authorizeRequest, calculatePasswordExpiry, publicUser, toUserRow, validatePassword } from "./_utils";
import { logAudit, newId } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { effectivePermissions, parsePermissionOverrides, PERMISSION_CATALOG, roleDefaultPermissions } from "@/lib/permissions";
import { TAB_HEADERS } from "@/lib/schema";
import { appendMissingHeaders } from "@/lib/schema-migration";
import { appendRow, getRows, updateRowById } from "@/lib/sheets";
import { requireTrainingMembers, trainingProfileFromRow } from "@/lib/training-profile";
import { ROLES, type Role, type UserRow } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const INITIAL_PASSWORD = "1234";
const KNOWN_PERMISSIONS = new Set<string>(PERMISSION_CATALOG.map((permission) => permission.code));

type Overrides = { allow: string[]; deny: string[] };

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asPositiveInteger(value: unknown, label: string, min = 1, max = 3650) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label}은 ${min} 이상 ${max} 이하의 정수여야 합니다.`);
  }
  return number;
}

function parseBoolean(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function normalizeOverrides(value: unknown): Overrides {
  if (value === undefined || value === null || value === "") return { allow: [], deny: [] };
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("개별 권한은 올바른 JSON 형식이어야 합니다.");
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("개별 권한 형식이 올바르지 않습니다.");
  const source = parsed as { allow?: unknown; deny?: unknown };
  if ((source.allow !== undefined && !Array.isArray(source.allow)) || (source.deny !== undefined && !Array.isArray(source.deny))) {
    throw new Error("개별 권한의 allow와 deny는 배열이어야 합니다.");
  }
  const allow = (source.allow ?? []).map(asText).filter(Boolean);
  const deny = (source.deny ?? []).map(asText).filter(Boolean);
  if (new Set(allow).size !== allow.length || new Set(deny).size !== deny.length) {
    throw new Error("개별 권한에 중복 코드가 있습니다.");
  }
  const unknown = [...allow, ...deny].filter((permission) => !KNOWN_PERMISSIONS.has(permission));
  if (unknown.length) throw new Error(`알 수 없는 권한 코드입니다: ${unknown.join(", ")}`);
  const conflicts = allow.filter((permission) => deny.includes(permission));
  if (conflicts.length) throw new Error(`허용과 차단에 동시에 지정된 권한입니다: ${conflicts.join(", ")}`);
  return { allow, deny };
}

function requireRoleCode(value: unknown): Role {
  const role = asText(value);
  if (!(ROLES as readonly string[]).includes(role)) throw new Error("역할을 선택하세요.");
  return role as Role;
}

function requireAccountStatus(value: unknown) {
  const status = asText(value);
  if (status !== "ACTIVE" && status !== "INACTIVE") throw new Error("계정 상태를 선택하세요.");
  return status;
}

async function loadUsers() {
  return (await getRows("USERS")).map(toUserRow);
}

function appliedPermissionResult(user: UserRow) {
  const overrides = parsePermissionOverrides(user.permission_overrides);
  return {
    user: publicUser(user),
    role: user.role,
    role_defaults: roleDefaultPermissions(user.role),
    allow: overrides.allow,
    deny: overrides.deny,
    effective: effectivePermissions(user.role, overrides),
  };
}

export async function GET() {
  const authorization = await authorizeRequest("/api/admin", ["ADMIN"], { requiredPermission: "ADMIN_MANAGE" });
  if (!authorization.ok) return authorization.response;

  try {
    const [users, settingsRows, profileRows, auditRows] = await Promise.all([
      loadUsers(),
      getRows("SECURITY_SETTINGS"),
      getRows("TRAINING_PROFILE"),
      getRows("AUDIT"),
    ]);
    const permissionHistory = auditRows
      .filter((row) => ["SECURITY.ACCOUNT_CREATED", "SECURITY.ACCOUNT_ROLE_CHANGED"].includes(row.action))
      .sort((a, b) => Date.parse(b.timestamp_kst) - Date.parse(a.timestamp_kst))
      .map((row) => {
        const target = users.find((user) => user.id === row.target);
        return {
          id: row.id,
          timestamp: row.timestamp_kst,
          actor_id: row.actor_id,
          actor_name: row.actor_name,
          actor_role: row.role,
          target_id: row.target,
          target_user_id: target?.user_id ?? "",
          target_user_name: target?.name ?? "",
          action: row.action,
          before_value: row.before_value,
          after_value: row.after_value,
          reason: row.reason,
        };
      });
    return NextResponse.json({
      users: users.map(publicUser),
      settings: authorization.value.settings,
      training_profile: trainingProfileFromRow(profileRows.find((row) => row.id === "training-profile-default") ?? profileRows[0]),
      known_permissions: [...KNOWN_PERMISSIONS],
      permission_catalog: PERMISSION_CATALOG,
      permission_history: permissionHistory,
      settings_persisted: settingsRows.some((row) => row.id === authorization.value.settings.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `관리자 설정을 불러오지 못했습니다: ${message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest("/api/admin", ["ADMIN"], { requiredPermission: "ADMIN_MANAGE" });
  if (!authorization.ok) return authorization.response;
  const { user: actor, settings: activeSettings } = authorization.value;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const action = asText(body.action);
    if (action === "CREATE_USER") {
      const userId = asText(body.user_id);
      const name = asText(body.name);
      const employeeNo = asText(body.employee_no);
      const role = requireRoleCode(body.role);
      const status = requireAccountStatus(body.status || "ACTIVE");
      const password = String(body.password ?? INITIAL_PASSWORD);
      const permissionOverrides = normalizeOverrides(body.permission_overrides);
      if (!userId || !name || !employeeNo) throw new Error("사용자 ID, 사용자명, 사번은 필수입니다.");
      const passwordError = validatePassword(password, activeSettings);
      if (passwordError) throw new Error(passwordError);
      const users = await loadUsers();
      if (users.some((user) => user.user_id === userId)) throw new Error("이미 등록된 사용자 ID입니다.");

      const timestamp = nowISO();
      const row: UserRow = {
        id: newId(),
        user_id: userId,
        name,
        employee_no: employeeNo,
        password,
        role,
        status,
        permission_overrides: JSON.stringify(permissionOverrides),
        password_changed_at: timestamp,
        password_expires_at: calculatePasswordExpiry(timestamp, activeSettings.password_validity_days),
        failed_login_count: "0",
        locked_at: "",
        created_at: timestamp,
        updated_at: timestamp,
      };
      await appendRow("USERS", row);
      await logAudit({
        category: "SECURITY",
        actor: auditActor(actor),
        action: "SECURITY.ACCOUNT_CREATED",
        target: row.id,
        after: JSON.stringify(publicUser(row)),
      });
      return NextResponse.json({ ok: true, applied: appliedPermissionResult(row) }, { status: 201 });
    }

    if (action === "UPDATE_USER") {
      const id = asText(body.id);
      const reason = asText(body.reason);
      if (!id) throw new Error("대상 계정 식별자가 필요합니다.");
      if (!reason) throw new Error("계정 수정 사유를 입력하세요.");
      const users = await loadUsers();
      const before = users.find((user) => user.id === id);
      if (!before) throw new Error("대상 계정을 찾을 수 없습니다.");
      const userId = asText(body.user_id);
      const name = asText(body.name);
      const employeeNo = asText(body.employee_no);
      const role = requireRoleCode(body.role);
      const status = requireAccountStatus(body.status);
      const permissionOverrides = normalizeOverrides(body.permission_overrides);
      if (!userId || !name || !employeeNo) throw new Error("사용자 ID, 사용자명, 사번은 필수입니다.");
      if (users.some((user) => user.id !== id && user.user_id === userId)) throw new Error("이미 등록된 사용자 ID입니다.");
      const timestamp = nowISO();
      const patch = {
        user_id: userId,
        name,
        employee_no: employeeNo,
        role,
        status,
        permission_overrides: JSON.stringify(permissionOverrides),
        updated_at: timestamp,
      };
      await updateRowById("USERS", id, patch);
      const after = { ...before, ...patch } as UserRow;
      const beforeSafe = publicUser(before);
      const afterSafe = publicUser(after);
      const eventActions = new Set<string>();
      if (before.role !== role || before.permission_overrides !== patch.permission_overrides) eventActions.add("SECURITY.ACCOUNT_ROLE_CHANGED");
      if (before.status !== status) eventActions.add("SECURITY.ACCOUNT_STATUS_CHANGED");
      if (!eventActions.size) eventActions.add("SECURITY.ACCOUNT_UPDATED");
      for (const eventAction of eventActions) {
        await logAudit({
          category: "SECURITY",
          actor: auditActor(actor),
          action: eventAction,
          target: id,
          before: JSON.stringify(beforeSafe),
          after: JSON.stringify(afterSafe),
          reason,
        });
      }
      return NextResponse.json({ ok: true, applied: appliedPermissionResult(after) });
    }

    if (action === "UNLOCK_USER") {
      const id = asText(body.id);
      const reason = asText(body.reason);
      if (!reason) throw new Error("잠금 해제 사유를 입력하세요.");
      const before = (await loadUsers()).find((user) => user.id === id);
      if (!before) throw new Error("대상 계정을 찾을 수 없습니다.");
      if (!before.locked_at) throw new Error("잠긴 계정이 아닙니다.");
      const timestamp = nowISO();
      await updateRowById("USERS", id, { failed_login_count: 0, locked_at: "", updated_at: timestamp });
      await logAudit({
        category: "SECURITY",
        actor: auditActor(actor),
        action: "SECURITY.ACCOUNT_UNLOCKED",
        target: id,
        before: JSON.stringify({ locked_at: before.locked_at, failed_login_count: before.failed_login_count }),
        after: JSON.stringify({ locked_at: "", failed_login_count: 0, unlocked_at: timestamp }),
        reason,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "RESET_PASSWORD") {
      const id = asText(body.id);
      const reason = asText(body.reason);
      if (!reason) throw new Error("비밀번호 초기화 사유를 입력하세요.");
      const before = (await loadUsers()).find((user) => user.id === id);
      if (!before) throw new Error("대상 계정을 찾을 수 없습니다.");
      const passwordError = validatePassword(INITIAL_PASSWORD, activeSettings);
      if (passwordError) throw new Error(`현재 보안 정책에서는 초기 비밀번호 1234를 사용할 수 없습니다. ${passwordError}`);
      const timestamp = nowISO();
      await updateRowById("USERS", id, {
        password: INITIAL_PASSWORD,
        password_changed_at: timestamp,
        password_expires_at: calculatePasswordExpiry(timestamp, activeSettings.password_validity_days),
        updated_at: timestamp,
      });
      await logAudit({
        category: "SECURITY",
        actor: auditActor(actor),
        action: "SECURITY.PASSWORD_RESET",
        target: id,
        reason,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "UPDATE_SECURITY_SETTINGS") {
      const settings = {
        id: "security-settings-default",
        min_password_length: asPositiveInteger(body.min_password_length, "비밀번호 최소 길이", 4, 128),
        require_uppercase: parseBoolean(body.require_uppercase),
        require_lowercase: parseBoolean(body.require_lowercase),
        require_digit: parseBoolean(body.require_digit),
        require_special: parseBoolean(body.require_special),
        password_validity_days: asPositiveInteger(body.password_validity_days, "비밀번호 유효기간", 1, 3650),
        max_failed_login_attempts: asPositiveInteger(body.max_failed_login_attempts, "잠금 기준", 1, 100),
        idle_timeout_minutes: asPositiveInteger(body.idle_timeout_minutes, "자동 로그아웃 시간", 1, 1440),
      };
      const reason = asText(body.reason);
      if (!reason) throw new Error("보안 설정 변경 사유를 입력하세요.");
      const rows = await getRows("SECURITY_SETTINGS");
      const before = rows.find((row) => row.id === settings.id) ?? null;
      const stored = {
        ...settings,
        require_uppercase: String(settings.require_uppercase),
        require_lowercase: String(settings.require_lowercase),
        require_digit: String(settings.require_digit),
        require_special: String(settings.require_special),
        updated_by: actor.user_id,
        updated_at: nowISO(),
      };
      if (before) await updateRowById("SECURITY_SETTINGS", settings.id, stored);
      else await appendRow("SECURITY_SETTINGS", stored);
      await logAudit({
        category: "SECURITY",
        actor: auditActor(actor),
        action: "SECURITY.SECURITY_SETTINGS_CHANGED",
        target: settings.id,
        before: JSON.stringify(before ?? {}),
        after: JSON.stringify(stored),
        reason,
      });
      return NextResponse.json({ ok: true, settings });
    }

    if (action === "UPDATE_TRAINING_PROFILE") {
      const teamNo = asText(body.team_no);
      const members = requireTrainingMembers(body.members);
      const reason = asText(body.reason);
      if (!teamNo) throw new Error("소속 조를 입력하세요.");
      if (!reason) throw new Error("수정 사유(Reason for Change)를 입력하세요.");
      await appendMissingHeaders("TRAINING_PROFILE", TAB_HEADERS.TRAINING_PROFILE);
      const rows = await getRows("TRAINING_PROFILE");
      const id = "training-profile-default";
      const before = rows.find((row) => row.id === id) ?? null;
      const beforeProfile = trainingProfileFromRow(before);
      const updatedAt = nowISO();
      const stored = {
        id,
        company_name: members[0].company,
        trainee_name: members[0].name,
        team_no: teamNo,
        updated_by: actor.user_id,
        updated_at: updatedAt,
        members_json: JSON.stringify(members),
      };
      if (before) await updateRowById("TRAINING_PROFILE", id, stored);
      else await appendRow("TRAINING_PROFILE", stored);
      const trainingProfile = trainingProfileFromRow(stored);
      await logAudit({
        category: "DATA",
        actor: auditActor(actor),
        action: "DATA.TRAINING_PROFILE_CHANGED",
        target: id,
        before: JSON.stringify({
          team_no: beforeProfile.teamNo,
          members: beforeProfile.members,
          last_modified_by: beforeProfile.lastModifiedBy,
          last_modified_at: beforeProfile.lastModifiedAt,
        }),
        after: JSON.stringify({
          team_no: trainingProfile.teamNo,
          members: trainingProfile.members,
          last_modified_by: trainingProfile.lastModifiedBy,
          last_modified_at: trainingProfile.lastModifiedAt,
        }),
        reason,
      });
      return NextResponse.json({ ok: true, training_profile: trainingProfile });
    }

    return NextResponse.json({ error: "지원하지 않는 관리자 작업입니다." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
