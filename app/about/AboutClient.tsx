"use client";

import { useState, type FormEvent } from "react";

import { Banner, Button, Card, Field, Table, Td, TextInput } from "@/components/ui";
import type { TrainingMember, TrainingProfile } from "@/lib/training-profile";

type EditForm = {
  teamNo: string;
  members: TrainingMember[];
  reason: string;
};

function editFormFromProfile(profile: TrainingProfile): EditForm {
  return {
    teamNo: profile.teamNo,
    members: profile.members.map((member) => ({ ...member })),
    reason: "",
  };
}

function teamLabel(value: string) {
  const label = value.trim();
  if (!label) return "미설정";
  return label.endsWith("조") ? label : `${label}조`;
}

export default function AboutClient({ profile, canEdit }: { profile: TrainingProfile; canEdit: boolean }) {
  const [savedProfile, setSavedProfile] = useState(profile);
  const [form, setForm] = useState<EditForm>(() => editFormFromProfile(profile));
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const visibleMembers = editing ? form.members : savedProfile.members;

  function startEditing() {
    setForm(editFormFromProfile(savedProfile));
    setMessage("");
    setEditing(true);
  }

  function cancelEditing() {
    setForm(editFormFromProfile(savedProfile));
    setMessage("");
    setEditing(false);
  }

  function updateMember(id: number, key: "company" | "name", value: string) {
    setForm((current) => ({
      ...current,
      members: current.members.map((member) => member.id === id ? { ...member, [key]: value } : member),
    }));
  }

  function addMember() {
    setForm((current) => ({
      ...current,
      members: [
        ...current.members,
        {
          id: Math.max(0, ...current.members.map((member) => member.id)) + 1,
          company: "",
          name: "",
        },
      ],
    }));
  }

  function removeMember(id: number) {
    setForm((current) => {
      if (current.members.length <= 1) return current;
      return { ...current, members: current.members.filter((member) => member.id !== id) };
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!form.reason.trim()) {
      setMessage("수정 사유(Reason for Change)를 입력하세요.");
      return;
    }
    if (form.members.length < 1) {
      setMessage("실습자는 최소 1명 이상이어야 합니다.");
      return;
    }
    if (!form.teamNo.trim() || form.members.some((member) => !member.company.trim() || !member.name.trim())) {
      setMessage("소속 조, 회사명과 실습자명을 모두 입력하세요.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_TRAINING_PROFILE",
          team_no: form.teamNo,
          members: form.members,
          reason: form.reason,
        }),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; training_profile?: TrainingProfile };
      if (!response.ok || !body.training_profile) {
        setMessage(body.error || "저장하지 못했습니다.");
        return;
      }
      setSavedProfile(body.training_profile);
      setForm(editFormFromProfile(body.training_profile));
      setMessage("실습 및 조직 정보가 저장되었습니다.");
      setEditing(false);
    } catch {
      setMessage("저장 중 네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="실습 및 조직 정보">
      {message ? <Banner kind={message.includes("저장") ? "success" : "error"}>{message}</Banner> : null}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-ink-muted">소속 조</p>
          <p className="mt-1 text-lg font-bold text-primary-dark">{teamLabel(editing ? form.teamNo : savedProfile.teamNo)}</p>
        </div>
        <h3 className="text-[15px] font-bold text-primary-dark">실습자 및 소속 회사 현황 ({visibleMembers.length}명)</h3>
      </div>

      {!editing ? (
        <>
          <Table columns={[
            { label: "No", width: "72px", align: "center" },
            { label: "회사명", width: "52%" },
            { label: "실습자명" },
          ]}>
            {savedProfile.members.map((member, index) => (
              <tr key={member.id}>
                <Td align="center">{index + 1}</Td>
                <Td>{member.company}</Td>
                <Td>{member.name}</Td>
              </tr>
            ))}
          </Table>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p><span className="font-semibold text-ink-muted">최종 수정자</span> <span className="ml-2 text-ink">{savedProfile.lastModifiedBy || "미설정"}</span></p>
            {canEdit ? <Button type="button" variant="secondary" onClick={startEditing}>정보 수정</Button> : null}
          </div>
        </>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <Field label="소속 조" required>
            <TextInput value={form.teamNo} onChange={(event) => setForm({ ...form, teamNo: event.target.value })} />
          </Field>
          <Table columns={[
            { label: "No", width: "64px", align: "center" },
            { label: "회사명", width: "43%" },
            { label: "실습자명", width: "37%" },
            { label: "삭제", width: "104px", align: "center" },
          ]}>
            {form.members.map((member, index) => (
              <tr key={member.id}>
                <Td align="center">{index + 1}</Td>
                <Td>
                  <TextInput
                    aria-label={`${index + 1}번 회사명`}
                    required
                    value={member.company}
                    onChange={(event) => updateMember(member.id, "company", event.target.value)}
                  />
                </Td>
                <Td>
                  <TextInput
                    aria-label={`${index + 1}번 실습자명`}
                    required
                    value={member.name}
                    onChange={(event) => updateMember(member.id, "name", event.target.value)}
                  />
                </Td>
                <Td align="center">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={form.members.length <= 1}
                    onClick={() => removeMember(member.id)}
                    aria-label={`${index + 1}번 실습자 삭제`}
                    title={form.members.length <= 1 ? "최소 1명은 유지해야 합니다." : "실습자 삭제"}
                  >
                    삭제 (✕)
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
          <Button type="button" variant="secondary" onClick={addMember}>+ 실습자 추가</Button>
          <Field label="수정 사유(Reason for Change)" required>
            <TextInput
              required
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
              placeholder="변경 사유를 입력하세요."
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={cancelEditing} disabled={saving}>취소</Button>
            <Button type="submit" disabled={saving}>{saving ? "저장 중" : "저장"}</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
