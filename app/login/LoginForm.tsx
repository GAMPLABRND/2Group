"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Select, TextInput } from "@/components/ui";
import { INITIAL_PASSWORD } from "@/lib/brand";
import type { AccountOption } from "@/types";

/**
 * 로그인 폼 (design.md 7절). 구조는 고정이다: 계정 선택(드롭다운) → 아이디 → 비밀번호 → 로그인.
 * 드롭다운에서 계정을 고르면 아이디 칸이 그 계정으로 채워지고, 비밀번호가 아직 초기값(1234)인 계정이면 비밀번호 칸도 채워진다.
 * 아이디와 비밀번호는 직접 고쳐 쓸 수 있다(비밀번호를 바꾼 계정, 목록에 없는 계정). 비밀번호는 마스킹 입력(URS 평문 표시 금지).
 * 계정 목록이 비어 있으면(시드 전) 드롭다운은 숨기고 아이디 직접 입력만 남긴다.
 */
export default function LoginForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const hasList = accounts.length > 0;
  const [selected, setSelected] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [autofilled, setAutofilled] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function selectAccount(id: string) {
    setSelected(id);
    const acc = accounts.find((a) => a.user_id === id);
    if (!acc) return;
    setUserId(acc.user_id);
    const fill = acc.initial;
    setPassword(fill ? INITIAL_PASSWORD : "");
    setAutofilled(fill);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ user_id: userId.trim(), password }),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `로그인 실패 (HTTP ${res.status})`);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(`요청 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {hasList ? (
        <Field label="계정 선택" hint="계정을 고르면 아이디가 입력되고, 초기 비밀번호 상태인 계정은 비밀번호도 입력됩니다.">
          <Select value={selected} onChange={(e) => selectAccount(e.target.value)} autoFocus>
            <option value="">계정을 선택하세요</option>
            {accounts.map((a) => (
              <option key={a.user_id} value={a.user_id}>
                {a.name} ({a.user_id}, {a.role})
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="아이디" required hint={hasList ? undefined : "계정 목록이 없어 아이디를 직접 입력합니다. /api/seed 를 먼저 호출했는지 확인하세요."}>
        <TextInput
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          autoFocus={!hasList}
          autoComplete="username"
          placeholder="아이디 입력"
        />
      </Field>
      <Field label="비밀번호" required hint={autofilled ? "초기 비밀번호가 자동 입력되었습니다. 배포 전에 비밀번호 변경 화면에서 바꿉니다." : undefined}>
        <TextInput
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setAutofilled(false);
          }}
          autoComplete="current-password"
          placeholder="비밀번호 입력"
        />
      </Field>
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
      <Button type="submit" disabled={loading || !userId.trim() || !password} className="w-full !rounded-input py-3">
        {loading ? "확인 중" : "로그인"}
      </Button>
    </form>
  );
}
