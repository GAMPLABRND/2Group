"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  Banner,
  Button,
  Card,
  Field,
  Modal,
  NoticeBox,
  PageTitle,
  Select,
  StatusBadge,
  Table,
  Td,
  Textarea,
  TextInput,
} from "@/components/ui";
import { toKST } from "@/lib/kst";

type PublicUser = {
  id: string;
  user_id: string;
  name: string;
  employee_no: string;
  role: string;
  status: string;
  permission_overrides: string;
  password_changed_at: string;
  password_expires_at: string;
  failed_login_count: string;
  locked_at: string;
  created_at: string;
  updated_at: string;
};

type SecuritySettings = {
  id: string;
  min_password_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_digit: boolean;
  require_special: boolean;
  password_validity_days: number;
  max_failed_login_attempts: number;
  idle_timeout_minutes: number;
};

type TrainingProfile = {
  id?: string;
  company_name?: string;
  trainee_name?: string;
  team_no?: string;
  updated_by?: string;
  updated_at?: string;
};

type AdminData = {
  users: PublicUser[];
  settings: SecuritySettings;
  training_profile: TrainingProfile | null;
  known_permissions: string[];
  permission_catalog: PermissionCatalogItem[];
};

type PermissionCatalogItem = {
  code: string;
  label: string;
  baseRoles: string[];
};

type UserForm = {
  user_id: string;
  name: string;
  employee_no: string;
  role: string;
  status: string;
  password: string;
  allow: string[];
  deny: string[];
};

const EMPTY_USER: UserForm = {
  user_id: "",
  name: "",
  employee_no: "",
  role: "TESTER",
  status: "ACTIVE",
  password: "1234",
  allow: [],
  deny: [],
};

function permissionList(raw: string, key: "allow" | "deny") {
  try {
    const value = JSON.parse(raw || "{}") as { allow?: string[]; deny?: string[] };
    return Array.isArray(value[key]) ? value[key]!.map(String) : [];
  } catch {
    return [];
  }
}

function permissionPayload(allow: string[], deny: string[]) {
  return { allow, deny };
}

function PermissionDropdown({
  label,
  hint,
  selected,
  excluded,
  catalog,
  onChange,
}: {
  label: string;
  hint: string;
  selected: string[];
  excluded: string[];
  catalog: PermissionCatalogItem[];
  onChange: (permissions: string[]) => void;
}) {
  const [candidate, setCandidate] = useState("");
  const unavailable = new Set([...selected, ...excluded]);
  const available = catalog.filter((permission) => !unavailable.has(permission.code));
  const labelFor = (code: string) => catalog.find((permission) => permission.code === code)?.label || code;

  function addPermission() {
    if (!candidate || unavailable.has(candidate)) return;
    onChange([...selected, candidate]);
    setCandidate("");
  }

  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2 rounded-input border border-line bg-muted/40 p-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Select value={candidate} onChange={(event) => setCandidate(event.target.value)}>
            <option value="">권한 항목을 선택하세요</option>
            {available.map((permission) => (
              <option key={permission.code} value={permission.code}>
                {permission.label} ({permission.code})
              </option>
            ))}
          </Select>
          <Button type="button" size="sm" variant="secondary" disabled={!candidate} onClick={addPermission}>
            추가
          </Button>
        </div>
        {selected.length ? (
          <div className="flex flex-wrap gap-2">
            {selected.map((code) => (
              <span key={code} className="inline-flex items-center gap-2 rounded-pill bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary-dark">
                {labelFor(code)} ({code})
                <button
                  type="button"
                  aria-label={`${labelFor(code)} 제거`}
                  className="font-bold text-danger hover:opacity-70"
                  onClick={() => onChange(selected.filter((permission) => permission !== code))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : <p className="text-xs text-ink-muted">선택된 개별 권한이 없습니다.</p>}
      </div>
    </Field>
  );
}

function RolePermissionSummary({ role, catalog }: { role: string; catalog: PermissionCatalogItem[] }) {
  const defaults = catalog.filter((permission) => permission.baseRoles.includes(role));
  return (
    <div className="rounded-input border border-line bg-primary-soft px-4 py-3 text-xs text-primary-dark">
      <p className="font-bold">선택 역할의 기본 권한 {defaults.length}개</p>
      <p className="mt-1 leading-relaxed">
        {defaults.length ? defaults.map((permission) => permission.label).join(", ") : "기본 권한 없음"}
      </p>
    </div>
  );
}

export default function AdminConsole() {
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [createForm, setCreateForm] = useState<UserForm>({ ...EMPTY_USER, allow: [], deny: [] });
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [editForm, setEditForm] = useState<UserForm & { reason: string }>({ ...EMPTY_USER, allow: [], deny: [], reason: "" });
  const [securityReason, setSecurityReason] = useState("");
  const [message, setMessage] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as AdminData & { error?: string; password_expired?: boolean };
      if (!response.ok) {
        if (body.password_expired) {
          router.push("/password?expired=1");
          return;
        }
        throw new Error(body.error || "관리자 설정을 불러오지 못했습니다.");
      }
      setData(body);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function send(payload: Record<string, unknown>, success: string) {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; password_expired?: boolean };
      if (!response.ok) {
        if (body.password_expired) router.push("/password?expired=1");
        throw new Error(body.error || "관리자 작업을 수행하지 못했습니다.");
      }
      setMessage({ kind: "success", text: success });
      await load();
      return true;
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    const ok = await send(
      {
        action: "CREATE_USER",
        ...createForm,
        permission_overrides: permissionPayload(createForm.allow, createForm.deny),
      },
      "계정이 등록되었습니다.",
    );
    if (ok) setCreateForm({ ...EMPTY_USER, allow: [], deny: [] });
  }

  function openUser(user: PublicUser) {
    setEditing(user);
    setEditForm({
      user_id: user.user_id,
      name: user.name,
      employee_no: user.employee_no,
      role: user.role,
      status: user.status,
      password: "",
      allow: permissionList(user.permission_overrides, "allow"),
      deny: permissionList(user.permission_overrides, "deny"),
      reason: "",
    });
  }

  async function updateUser() {
    if (!editing) return;
    const ok = await send(
      {
        action: "UPDATE_USER",
        id: editing.id,
        user_id: editForm.user_id,
        name: editForm.name,
        employee_no: editForm.employee_no,
        role: editForm.role,
        status: editForm.status,
        permission_overrides: permissionPayload(editForm.allow, editForm.deny),
        reason: editForm.reason,
      },
      "계정 정보가 수정되었습니다.",
    );
    if (ok) setEditing(null);
  }

  async function accountAction(action: "UNLOCK_USER" | "RESET_PASSWORD") {
    if (!editing) return;
    const label = action === "UNLOCK_USER" ? "계정 잠금이 해제되었습니다." : "비밀번호가 1234로 초기화되었습니다.";
    const ok = await send({ action, id: editing.id, reason: editForm.reason }, label);
    if (ok) setEditing(null);
  }

  async function updateSettings(event: FormEvent) {
    event.preventDefault();
    if (!data) return;
    await send({ action: "UPDATE_SECURITY_SETTINGS", ...data.settings, reason: securityReason }, "보안 설정이 저장되었습니다.");
    setSecurityReason("");
  }

  const settings = data?.settings;

  return (
    <>
      <PageTitle
        title="관리자 설정"
        description="계정, 역할, 보안 정책과 실습 정보를 관리합니다. 모든 변경은 서버에서 검증하고 감사추적에 기록합니다."
        actions={<Button variant="secondary" onClick={() => void load()} disabled={loading}>새로고침</Button>}
      />
      {message ? <Banner kind={message.kind}>{message.text}</Banner> : null}
      <NoticeBox title="계정 보안 운영">
        계정은 물리 삭제하지 않습니다. 비활성 전환으로 접근을 차단하고 잠금 해제와 비밀번호 초기화에는 사유를 기록합니다.
      </NoticeBox>

      <Card title="계정 등록">
        <form onSubmit={createUser} className="max-w-3xl space-y-4">
          <Field label="사용자 ID" required><TextInput value={createForm.user_id} onChange={(event) => setCreateForm({ ...createForm, user_id: event.target.value })} /></Field>
          <Field label="사용자명" required><TextInput value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} /></Field>
          <Field label="사번" required><TextInput value={createForm.employee_no} onChange={(event) => setCreateForm({ ...createForm, employee_no: event.target.value })} /></Field>
          <Field label="역할" required>
            <Select value={createForm.role} onChange={(event) => setCreateForm({ ...createForm, role: event.target.value })}>
              <option value="ADMIN">관리자 (ADMIN)</option><option value="TESTER">사용자 (TESTER)</option><option value="APPROVER">검토자 (APPROVER)</option>
            </Select>
          </Field>
          <RolePermissionSummary role={createForm.role} catalog={data?.permission_catalog || []} />
          <Field label="초기 비밀번호" required hint="첫 빌드 기본값은 1234이며 현재 보안 정책을 충족해야 합니다.">
            <TextInput type="password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} />
          </Field>
          <PermissionDropdown
            label="추가 허용 권한"
            hint="선택 역할의 기본 권한에 추가로 허용할 항목을 선택합니다."
            selected={createForm.allow}
            excluded={createForm.deny}
            catalog={data?.permission_catalog || []}
            onChange={(allow) => setCreateForm({ ...createForm, allow })}
          />
          <PermissionDropdown
            label="추가 차단 권한"
            hint="선택 역할의 기본 허용보다 우선하여 차단할 항목을 선택합니다."
            selected={createForm.deny}
            excluded={createForm.allow}
            catalog={data?.permission_catalog || []}
            onChange={(deny) => setCreateForm({ ...createForm, deny })}
          />
          <div className="flex justify-end"><Button type="submit" disabled={saving}>계정 등록</Button></div>
        </form>
      </Card>

      <Card title="계정 목록">
        <Table
          columns={[
            { label: "사용자 ID", width: "120px" }, { label: "사용자", width: "175px", nowrap: false },
            { label: "역할", width: "105px" }, { label: "상태", width: "105px", align: "center" },
            { label: "실패", width: "70px", align: "right" }, { label: "비밀번호 만료", width: "190px" },
            { label: "동작", width: "88px", align: "center" },
          ]}
          empty={loading ? "계정 목록을 불러오는 중입니다." : "등록된 계정이 없습니다."}
        >
          {data?.users.map((user) => (
            <tr key={user.id}>
              <Td code>{user.user_id}</Td>
              <Td clamp={2}>{user.name} ({user.employee_no})</Td>
              <Td code>{user.role}</Td>
              <Td align="center"><StatusBadge value={user.locked_at ? "LOCKED" : user.status} label={user.locked_at ? "잠금" : user.status === "ACTIVE" ? "활성" : "비활성"} /></Td>
              <Td num>{user.failed_login_count || "0"}</Td>
              <Td nowrap code>{user.password_expires_at ? toKST(user.password_expires_at) : "미설정"}</Td>
              <Td align="center"><Button size="sm" variant="secondary" onClick={() => openUser(user)}>상세</Button></Td>
            </tr>
          ))}
        </Table>
      </Card>

      {settings ? (
        <Card title="보안 설정">
          <form onSubmit={updateSettings} className="max-w-3xl space-y-4">
            <Field label="비밀번호 최소 길이" required><TextInput type="number" min={4} max={128} value={settings.min_password_length} onChange={(event) => setData((current) => current && ({ ...current, settings: { ...current.settings, min_password_length: Number(event.target.value) } }))} /></Field>
            {(["require_uppercase", "require_lowercase", "require_digit", "require_special"] as const).map((key) => (
              <Field key={key} label={{ require_uppercase: "영문 대문자 필요", require_lowercase: "영문 소문자 필요", require_digit: "숫자 필요", require_special: "특수문자 필요" }[key]} required>
                <Select value={String(settings[key])} onChange={(event) => setData((current) => current && ({ ...current, settings: { ...current.settings, [key]: event.target.value === "true" } }))}><option value="false">사용 안 함</option><option value="true">사용</option></Select>
              </Field>
            ))}
            <Field label="비밀번호 유효기간 (일)" required><TextInput type="number" min={1} max={3650} value={settings.password_validity_days} onChange={(event) => setData((current) => current && ({ ...current, settings: { ...current.settings, password_validity_days: Number(event.target.value) } }))} /></Field>
            <Field label="잠금 기준 (연속 실패 횟수)" required><TextInput type="number" min={1} max={100} value={settings.max_failed_login_attempts} onChange={(event) => setData((current) => current && ({ ...current, settings: { ...current.settings, max_failed_login_attempts: Number(event.target.value) } }))} /></Field>
            <Field label="자동 로그아웃 시간 (분)" required><TextInput type="number" min={1} max={1440} value={settings.idle_timeout_minutes} onChange={(event) => setData((current) => current && ({ ...current, settings: { ...current.settings, idle_timeout_minutes: Number(event.target.value) } }))} /></Field>
            <Field label="변경 사유" required><Textarea rows={3} value={securityReason} onChange={(event) => setSecurityReason(event.target.value)} /></Field>
            <div className="flex justify-end"><Button type="submit" disabled={saving}>보안 설정 저장</Button></div>
          </form>
        </Card>
      ) : null}

      <Modal
        open={Boolean(editing)}
        title="계정 상세와 수정"
        size="lg"
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>취소</Button>
            {editing?.locked_at ? <Button variant="secondary" onClick={() => void accountAction("UNLOCK_USER")} disabled={saving}>잠금 해제</Button> : null}
            <Button variant="secondary" onClick={() => void accountAction("RESET_PASSWORD")} disabled={saving}>비밀번호 초기화</Button>
            <Button onClick={() => void updateUser()} disabled={saving}>저장</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="사용자 ID" required><TextInput value={editForm.user_id} onChange={(event) => setEditForm({ ...editForm, user_id: event.target.value })} /></Field>
          <Field label="사용자명" required><TextInput value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></Field>
          <Field label="사번" required><TextInput value={editForm.employee_no} onChange={(event) => setEditForm({ ...editForm, employee_no: event.target.value })} /></Field>
          <Field label="역할" required><Select value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}><option value="ADMIN">관리자 (ADMIN)</option><option value="TESTER">사용자 (TESTER)</option><option value="APPROVER">검토자 (APPROVER)</option></Select></Field>
          <RolePermissionSummary role={editForm.role} catalog={data?.permission_catalog || []} />
          <Field label="계정 상태" required><Select value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}><option value="ACTIVE">활성</option><option value="INACTIVE">비활성</option></Select></Field>
          <PermissionDropdown
            label="추가 허용 권한"
            hint="선택 역할의 기본 권한에 추가로 허용할 항목을 선택합니다."
            selected={editForm.allow}
            excluded={editForm.deny}
            catalog={data?.permission_catalog || []}
            onChange={(allow) => setEditForm({ ...editForm, allow })}
          />
          <PermissionDropdown
            label="추가 차단 권한"
            hint="선택 역할의 기본 허용보다 우선하여 차단할 항목을 선택합니다."
            selected={editForm.deny}
            excluded={editForm.allow}
            catalog={data?.permission_catalog || []}
            onChange={(deny) => setEditForm({ ...editForm, deny })}
          />
          <Field label="변경 사유" required hint="계정 수정, 잠금 해제, 비밀번호 초기화에 사용됩니다."><Textarea rows={3} value={editForm.reason} onChange={(event) => setEditForm({ ...editForm, reason: event.target.value })} /></Field>
        </div>
      </Modal>
    </>
  );
}
