"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Banner, Button, Card, Field, NoticeBox, PageTitle, TextInput } from "@/components/ui";

type PasswordPolicy = {
  min_password_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_digit: boolean;
  require_special: boolean;
  password_validity_days: number;
};

type PasswordInfo = {
  user: { user_id: string; name: string; employee_no: string; role: string };
  policy: PasswordPolicy;
  password_expired: boolean;
};

export default function PasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [info, setInfo] = useState<PasswordInfo | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/password", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as PasswordInfo & { error?: string };
        if (!response.ok) throw new Error(body.error || "비밀번호 정책을 불러오지 못했습니다.");
        if (active) setInfo(body);
      })
      .catch((error) => active && setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || "비밀번호를 변경하지 못했습니다.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ kind: "success", text: "비밀번호가 변경되었습니다." });
      router.refresh();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  const expired = searchParams.get("expired") === "1" || info?.password_expired;
  const requirements = info
    ? [
        `${info.policy.min_password_length}자 이상`,
        info.policy.require_uppercase ? "영문 대문자 포함" : null,
        info.policy.require_lowercase ? "영문 소문자 포함" : null,
        info.policy.require_digit ? "숫자 포함" : null,
        info.policy.require_special ? "특수문자 포함" : null,
        `유효기간 ${info.policy.password_validity_days}일`,
      ]
        .filter(Boolean)
        .join(", ")
    : "정책을 불러오는 중입니다.";

  return (
    <>
      <PageTitle title="비밀번호 변경" description="현재 비밀번호를 확인한 후 본인 계정의 비밀번호를 변경합니다." />
      {expired ? <Banner kind="warn">비밀번호 유효기간이 만료되었습니다. 비밀번호 변경 후 업무를 계속하세요.</Banner> : null}
      {message ? <Banner kind={message.kind}>{message.text}</Banner> : null}
      <Card title="본인 확인과 새 비밀번호">
        <NoticeBox title="비밀번호 정책">
          {requirements}. 비밀번호 값은 화면, 응답, 감사추적에 표시하거나 기록하지 않습니다.
        </NoticeBox>
        {info ? (
          <p className="mb-5 text-sm text-ink-muted">
            변경 대상: <strong className="text-ink">{info.user.name} ({info.user.employee_no})</strong> {info.user.user_id}
          </p>
        ) : null}
        <form onSubmit={submit} className="max-w-2xl space-y-4">
          <Field label="현재 비밀번호" required>
            <TextInput type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </Field>
          <Field label="새 비밀번호" required hint={requirements}>
            <TextInput type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </Field>
          <Field label="새 비밀번호 확인" required>
            <TextInput type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading || saving || !currentPassword || !newPassword || !confirmPassword}>
              {saving ? "변경 중" : "비밀번호 변경"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
