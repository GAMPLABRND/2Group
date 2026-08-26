"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banner,
  Button,
  Card,
  DescList,
  Field,
  Modal,
  NoticeBox,
  PageTitle,
  Select,
  StatusBadge,
  Textarea,
  TextInput,
} from "@/components/ui";
import type { EquipmentRow, Session } from "@/types";

type EquipmentOption = EquipmentRow & { eligible: boolean; blocked_reason: string };
type RecordsResponse = {
  equipment: EquipmentOption[];
  actor: { user_id: string; name: string; role: string };
  error?: string;
};

const USAGE_TYPES = ["일반 사용", "시험/분석", "적격성평가/밸리데이션", "점검/유지보수", "기타"];

export default function NewRecordClient({ session }: { session: Session }) {
  const router = useRouter();
  const [equipment, setEquipment] = useState<EquipmentOption[]>([]);
  const [actorName, setActorName] = useState(session.userId);
  const [equipmentId, setEquipmentId] = useState("");
  const [usageType, setUsageType] = useState("");
  const [usagePurpose, setUsagePurpose] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");

  const loadEquipment = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/records", { cache: "no-store" });
      const body = (await response.json()) as RecordsResponse;
      if (!response.ok) throw new Error(body.error || "장비 목록을 조회하지 못했습니다.");
      setEquipment(body.equipment || []);
      setActorName(body.actor?.name || session.userId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "장비 목록을 조회하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [session.userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEquipment(), 0);
    return () => window.clearTimeout(timer);
  }, [loadEquipment]);

  const selected = useMemo(
    () => equipment.find((item) => item.id === equipmentId),
    [equipment, equipmentId],
  );

  function validate() {
    const missing = [
      !equipmentId ? "장비" : "",
      !usageType ? "사용 유형" : "",
      !usagePurpose.trim() ? "사용 목적" : "",
    ].filter(Boolean);
    if (missing.length) {
      setError(`필수 입력 항목이 누락된 경우 기록을 저장할 수 없으며 누락된 항목을 안내해야 한다. 누락 항목: ${missing.join(", ")}`);
      return;
    }
    if (!selected?.eligible) {
      setError(selected?.blocked_reason || "선택한 장비는 사용을 시작할 수 없습니다.");
      return;
    }
    setError("");
    setConfirmOpen(true);
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/records/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: equipmentId,
          usage_type: usageType,
          usage_purpose: usagePurpose,
          reference_no: referenceNo,
        }),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as { error?: string; record?: { id: string } } | null;
      if (!response.ok) throw new Error(body?.error || "사용 시작을 등록하지 못했습니다.");
      router.push(`/records/${body?.record?.id || ""}`);
      router.refresh();
    } catch (reason) {
      setConfirmOpen(false);
      setError(reason instanceof Error ? reason.message : "사용 시작을 등록하지 못했습니다.");
      await loadEquipment();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageTitle title="사용등록" description="사용가능하고 미사용인 장비의 사용 시작을 등록합니다." actions={<Button variant="secondary" onClick={() => router.push("/records")}>목록</Button>} />
      <NoticeBox title="등록 전 확인">교정 유효기간, 사용 상태, 점유 상태와 중복 사용 기록은 저장 직전에 서버에서 다시 확인합니다.</NoticeBox>
      {error ? <Banner kind="error">{error}</Banner> : null}
      <Card title="사용 시작 정보">
        <div className="space-y-5">
          <Field label="작성자"><TextInput readOnly value={`${actorName} (${session.userId})`} /></Field>
          <Field label="사용 시작 일시"><TextInput readOnly value="저장 성공 시 서버 일시 자동 생성" /></Field>
          <Field label="장비" required hint="차단된 장비는 사유를 확인할 수 있으며 선택할 수 없습니다.">
            <Select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} disabled={loading}>
              <option value="">{loading ? "장비 조회 중" : "장비 선택"}</option>
              {equipment.map((item) => (
                <option key={item.id} value={item.id} disabled={!item.eligible}>
                  {item.equipment_code} {item.equipment_name}{item.eligible ? "" : ` [차단: ${item.blocked_reason}]`}
                </option>
              ))}
            </Select>
          </Field>
          {selected ? (
            <div className="rounded-input border border-line bg-muted p-4">
              <DescList cols={2} items={[
                { label: "설치 위치", value: selected.location },
                { label: "사용 상태", value: <StatusBadge value={selected.availability_status} label={selected.availability_status === "AVAILABLE" ? "사용가능" : selected.availability_status === "SUSPENDED" ? "사용중지" : "폐기"} /> },
                { label: "점유 상태", value: selected.occupancy_status === "FREE" ? "미사용" : "사용중" },
                { label: "교정 대상", value: selected.calibration_required === "REQUIRED" ? "대상" : "비대상" },
                { label: "적격성평가 대상", value: selected.qualification_required === "REQUIRED" ? "대상" : "비대상" },
                { label: "교정 유효기간", value: selected.calibration_due_date || "비대상" },
                { label: "사용 가능 여부", value: selected.eligible ? "사용 가능" : selected.blocked_reason, full: true },
              ]} />
            </div>
          ) : null}
          <Field label="사용 유형" required><Select value={usageType} onChange={(event) => setUsageType(event.target.value)}><option value="">사용 유형 선택</option>{USAGE_TYPES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="사용 목적" required><Textarea rows={4} value={usagePurpose} onChange={(event) => setUsagePurpose(event.target.value)} /></Field>
          <Field label="참조번호" hint="제조번호, 시험번호, 작업번호 또는 프로토콜 번호를 입력할 수 있습니다."><TextInput value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={() => router.push("/records")}>취소</Button><Button onClick={validate} disabled={loading}>사용 시작 등록</Button></div>
      </Card>
      <Modal open={confirmOpen} title="사용 시작 등록 확인" size="lg" onClose={() => { if (!submitting) setConfirmOpen(false); }} footer={<><Button variant="secondary" disabled={submitting} onClick={() => setConfirmOpen(false)}>입력 수정</Button><Button disabled={submitting} onClick={() => void submit()}>{submitting ? "등록 중" : "확정"}</Button></>}>
        <NoticeBox title="정확성 확인">장비와 사용 정보를 확인해 주세요. 작성자와 시작 일시는 서버에서 확정합니다.</NoticeBox>
        <DescList items={[
          { label: "장비", value: selected ? `${selected.equipment_code} ${selected.equipment_name}` : "해당 없음", full: true },
          { label: "사용 유형", value: usageType },
          { label: "사용 목적", value: usagePurpose, full: true },
          { label: "참조번호", value: referenceNo || "해당 없음" },
          { label: "작성자", value: `${actorName} (${session.userId})` },
          { label: "사용 시작 일시", value: "저장 성공 시 서버 일시 자동 생성" },
        ]} />
      </Modal>
    </>
  );
}
