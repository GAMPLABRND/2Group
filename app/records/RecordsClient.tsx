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
  Table,
  Td,
  Textarea,
  TextInput,
} from "@/components/ui";
import { toKST } from "@/lib/kst";
import type { EquipmentRow, Session, UseRecordRow } from "@/types";

type Remediation = {
  id: string;
  equipment_id: string;
  source_record_id: string;
  action_type: string;
  action_details: string;
  action_recorded_by_id: string;
  action_recorded_by_name: string;
  action_recorded_at: string;
  updated_at: string;
  remediation_status: string;
};
type ResumeRequest = {
  id: string;
  source_record_id: string;
  remediation_id: string;
  request_sequence: string;
  resume_status: string;
  requested_by_name: string;
  requested_at: string;
  confirmed_by_name: string;
  confirmed_at: string;
  confirmation_result: string;
  rejection_reason: string;
};
type RecordData = {
  records: UseRecordRow[];
  equipment: (EquipmentRow & { eligible: boolean; blocked_reason: string })[];
  users: { id: string; name: string }[];
  remediations: Remediation[];
  resume_requests: ResumeRequest[];
};
type Filters = {
  equipment_id: string;
  date_from: string;
  date_to: string;
  user_id: string;
  usage_type: string;
  record_status: string;
  after_use_status: string;
};
type ActionKind = "end" | "exception" | "edit" | "invalidate" | "remediation" | "resume";
type ActionState = { kind: ActionKind; record: UseRecordRow; remediation?: Remediation } | null;

const EMPTY_FILTERS: Filters = {
  equipment_id: "",
  date_from: "",
  date_to: "",
  user_id: "",
  usage_type: "",
  record_status: "",
  after_use_status: "",
};
const USAGE_TYPES = ["일반 사용", "시험/분석", "적격성평가/밸리데이션", "점검/유지보수", "기타"];
const STATUS_LABEL: Record<string, string> = {
  IN_USE: "사용중",
  COMPLETED: "사용완료",
  CHANGE_REQUESTED: "수정요청",
  REVIEWED: "검토완료",
  INVALID: "무효",
  NORMAL: "정상",
  ABNORMAL: "이상",
  ACTION_RECORDED: "조치기록",
  RESUME_REQUESTED: "재개요청됨",
  REQUESTED: "사용 재개 요청",
  APPROVED: "승인",
  REJECTED: "반려",
};

function label(value: string) {
  return STATUS_LABEL[value] || value || "해당 없음";
}

function formatTime(value: string) {
  return value ? toKST(value, true) : "해당 없음";
}

export default function RecordsClient({ session }: { session: Session }) {
  const router = useRouter();
  const [data, setData] = useState<RecordData>({ records: [], equipment: [], users: [], remediations: [], resume_requests: [] });
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [detail, setDetail] = useState<UseRecordRow | null>(null);
  const [action, setAction] = useState<ActionState>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async (query: Filters) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => value && params.set(key, value));
      const response = await fetch(`/api/records?${params.toString()}`, { cache: "no-store" });
      const body = (await response.json()) as RecordData & { error?: string };
      if (!response.ok) throw new Error(body.error || "사용 기록을 조회하지 못했습니다.");
      setData(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "사용 기록을 조회하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(EMPTY_FILTERS), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const equipmentById = useMemo(
    () => new Map(data.equipment.map((item) => [item.id, item])),
    [data.equipment],
  );

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters() {
    setAppliedFilters(filters);
    void load(filters);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    void load(EMPTY_FILTERS);
  }

  function openAction(kind: ActionKind, record: UseRecordRow, remediation?: Remediation) {
    setError("");
    setSuccess("");
    setConfirming(false);
    setAction({ kind, record, remediation });
    if (kind === "edit") {
      setForm({
        usage_type: record.usage_type,
        usage_purpose: record.usage_purpose,
        reference_no: record.reference_no,
        abnormality_details: record.abnormality_details,
        modification_reason: "",
      });
    } else if (kind === "end" || kind === "exception") {
      setForm({ after_use_status: "NORMAL", abnormality_details: "", exception_reason: "" });
    } else if (kind === "invalidate") {
      setForm({ invalidation_reason: "" });
    } else if (kind === "remediation") {
      setForm({ action_type: "INSPECTION", action_details: "" });
    } else {
      setForm({ remediation_id: remediation?.id || "" });
    }
  }

  function setValue(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateAction(): string {
    if (!action) return "처리할 기록을 선택해 주세요.";
    if ((action.kind === "end" || action.kind === "exception") && !form.after_use_status) return "사용 후 상태를 선택해 주세요.";
    if ((action.kind === "end" || action.kind === "exception") && form.after_use_status === "ABNORMAL" && !form.abnormality_details?.trim()) {
      return "사용 후 상태가 '이상'인 경우 특이사항을 필수로 기록해야 한다.";
    }
    if (action.kind === "exception" && !form.exception_reason?.trim()) return "예외 종료 사유를 입력해 주세요.";
    if (action.kind === "edit" && (!form.usage_type || !form.usage_purpose?.trim() || !form.modification_reason?.trim())) {
      return "사용 유형, 사용 목적, 수정 사유를 입력해 주세요.";
    }
    if (action.kind === "invalidate" && !form.invalidation_reason?.trim()) return "무효 사유를 입력해 주세요.";
    if (action.kind === "remediation" && (!form.action_type || !form.action_details?.trim())) return "조치 유형과 조치 내용을 입력해 주세요.";
    if (action.kind === "resume" && !form.remediation_id) return "조치 기록을 선택해 주세요.";
    return "";
  }

  async function submitAction() {
    if (!action) return;
    setSubmitting(true);
    setError("");
    try {
      let endpoint = "";
      let method = "POST";
      let payload: Record<string, string> = {};
      if (action.kind === "end") {
        endpoint = `/api/records/${action.record.id}/end`;
        payload = { after_use_status: form.after_use_status, abnormality_details: form.abnormality_details || "" };
      } else if (action.kind === "exception") {
        endpoint = `/api/records/${action.record.id}/exception-end`;
        payload = {
          after_use_status: form.after_use_status,
          abnormality_details: form.abnormality_details || "",
          exception_reason: form.exception_reason,
        };
      } else if (action.kind === "edit") {
        endpoint = `/api/records/${action.record.id}`;
        method = "PATCH";
        payload = {
          usage_type: form.usage_type,
          usage_purpose: form.usage_purpose,
          reference_no: form.reference_no || "",
          abnormality_details: form.abnormality_details || "",
          modification_reason: form.modification_reason,
        };
      } else if (action.kind === "invalidate") {
        endpoint = `/api/records/${action.record.id}/invalidate`;
        payload = { invalidation_reason: form.invalidation_reason };
      } else if (action.kind === "remediation") {
        endpoint = "/api/remediations";
        payload = {
          source_record_id: action.record.id,
          action_type: form.action_type,
          action_details: form.action_details,
        };
      } else {
        endpoint = "/api/resume-requests";
        payload = { remediation_id: form.remediation_id };
      }
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "요청을 처리하지 못했습니다.");
      const messages: Record<ActionKind, string> = {
        end: "사용 종료가 저장되었습니다.",
        exception: "예외 종료가 저장되었습니다.",
        edit: "사용 기록이 수정되었습니다.",
        invalidate: "사용 기록이 무효 처리되었습니다.",
        remediation: "조치 내용이 저장되었습니다.",
        resume: "사용 재개 확인 요청이 등록되었습니다.",
      };
      setSuccess(messages[action.kind]);
      setAction(null);
      setConfirming(false);
      setDetail(null);
      await load(appliedFilters);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "요청을 처리하지 못했습니다.");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  const actionTitle: Record<ActionKind, string> = {
    end: "사용 종료",
    exception: "예외 종료",
    edit: "사용 기록 수정",
    invalidate: "사용 기록 무효 처리",
    remediation: "이상 장비 조치 기록",
    resume: "사용 재개 확인 요청",
  };

  function detailItems(record: UseRecordRow) {
    return [
      { label: "사용 기록 ID", value: record.id },
      { label: "장비", value: `${record.equipment_code} ${record.equipment_name}` },
      { label: "사용자", value: `${record.user_name} (${record.user_id})` },
      { label: "사번", value: record.employee_no || "해당 없음" },
      { label: "사용 유형", value: record.usage_type },
      { label: "사용 목적", value: record.usage_purpose, full: true },
      { label: "참조번호", value: record.reference_no || "해당 없음" },
      { label: "시작 일시", value: formatTime(record.started_at) },
      { label: "종료 일시", value: formatTime(record.ended_at) },
      { label: "기록 상태", value: label(record.record_status) },
      { label: "사용 후 상태", value: label(record.after_use_status) },
      { label: "특이사항 또는 이상 내용", value: record.abnormality_details || "해당 없음", full: true },
      { label: "종료 방식", value: record.end_method || "해당 없음" },
      { label: "예외 종료자", value: record.exception_ended_by_name || "해당 없음" },
      { label: "예외 종료 일시", value: formatTime(record.exception_ended_at) },
      { label: "예외 종료 사유", value: record.exception_reason || "해당 없음", full: true },
      { label: "수정 요청 사유", value: record.change_request_reason || "해당 없음", full: true },
      { label: "검토자", value: record.reviewer_name || "해당 없음" },
      { label: "검토 일시", value: formatTime(record.reviewed_at) },
      { label: "서명 의미", value: record.signature_meaning || "해당 없음" },
      { label: "무효 처리자", value: record.invalidated_by || "해당 없음" },
      { label: "무효 처리 일시", value: formatTime(record.invalidated_at) },
      { label: "무효 사유", value: record.invalidation_reason || "해당 없음", full: true },
      { label: "최종 수정자", value: record.updated_by || "해당 없음" },
      { label: "최종 수정 일시", value: formatTime(record.updated_at) },
    ];
  }

  function actionInput() {
    if (!action) return null;
    if (action.kind === "end" || action.kind === "exception") {
      return (
        <div className="space-y-4">
          <Field label="사용 후 상태" required>
            <Select value={form.after_use_status || ""} onChange={(event) => setValue("after_use_status", event.target.value)}>
              <option value="NORMAL">정상</option><option value="ABNORMAL">이상</option>
            </Select>
          </Field>
          {form.after_use_status === "ABNORMAL" ? (
            <Field label="특이사항 또는 이상 내용" required><Textarea rows={3} value={form.abnormality_details || ""} onChange={(event) => setValue("abnormality_details", event.target.value)} /></Field>
          ) : null}
          {action.kind === "exception" ? (
            <Field label="예외 종료 사유" required><Textarea rows={3} value={form.exception_reason || ""} onChange={(event) => setValue("exception_reason", event.target.value)} /></Field>
          ) : null}
        </div>
      );
    }
    if (action.kind === "edit") {
      return (
        <div className="space-y-4">
          <Field label="사용 유형" required><Select value={form.usage_type || ""} onChange={(event) => setValue("usage_type", event.target.value)}>{USAGE_TYPES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="사용 목적" required><Textarea rows={3} value={form.usage_purpose || ""} onChange={(event) => setValue("usage_purpose", event.target.value)} /></Field>
          <Field label="참조번호"><TextInput value={form.reference_no || ""} onChange={(event) => setValue("reference_no", event.target.value)} /></Field>
          {action.record.after_use_status === "ABNORMAL" ? <Field label="특이사항 또는 이상 내용" required><Textarea rows={3} value={form.abnormality_details || ""} onChange={(event) => setValue("abnormality_details", event.target.value)} /></Field> : null}
          <Field label="수정 사유" required><Textarea rows={3} value={form.modification_reason || ""} onChange={(event) => setValue("modification_reason", event.target.value)} /></Field>
        </div>
      );
    }
    if (action.kind === "invalidate") return <Field label="무효 사유" required><Textarea rows={3} value={form.invalidation_reason || ""} onChange={(event) => setValue("invalidation_reason", event.target.value)} /></Field>;
    if (action.kind === "remediation") {
      return <div className="space-y-4"><Field label="조치 유형" required><Select value={form.action_type || ""} onChange={(event) => setValue("action_type", event.target.value)}><option value="INSPECTION">점검</option><option value="REPAIR">수리</option><option value="OTHER">기타</option></Select></Field><Field label="조치 내용" required><Textarea rows={4} value={form.action_details || ""} onChange={(event) => setValue("action_details", event.target.value)} /></Field></div>;
    }
    return <NoticeBox title="제2자 확인 필요">조치 내용을 바탕으로 사용 재개 확인을 요청합니다. 검토자가 승인하기 전까지 장비는 사용중지 상태로 유지됩니다.</NoticeBox>;
  }

  function confirmationItems() {
    if (!action) return [];
    const common = [
      { label: "사용 기록 ID", value: action.record.id },
      { label: "장비", value: `${action.record.equipment_code} ${action.record.equipment_name}` },
      { label: "현재 사용자", value: session.userId },
    ];
    return common.concat(
      Object.entries(form).map(([key, value]) => ({
        label: ({
          after_use_status: "사용 후 상태",
          abnormality_details: "특이사항 또는 이상 내용",
          exception_reason: "예외 종료 사유",
          usage_type: "사용 유형",
          usage_purpose: "사용 목적",
          reference_no: "참조번호",
          modification_reason: "수정 사유",
          invalidation_reason: "무효 사유",
          action_type: "조치 유형",
          action_details: "조치 내용",
          remediation_id: "조치 ID",
        } as Record<string, string>)[key] || key,
        value: key === "after_use_status" ? label(value) : value || "해당 없음",
        full: value.length > 40,
      })),
    );
  }

  return (
    <>
      <PageTitle title="사용기록" description="장비 사용 이력과 상태 전이를 조회하고 역할에 따라 기록을 처리합니다." actions={session.role === "TESTER" ? <Button onClick={() => router.push("/records/new")}>사용 시작 등록</Button> : undefined} />
      <NoticeBox title="데이터 완전성 안내">사용 기록은 삭제하지 않습니다. 잘못된 기록은 사유와 함께 무효 처리하며 검토완료 기록은 잠깁니다.</NoticeBox>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {success ? <Banner kind="success">{success}</Banner> : null}
      <Card title="조회 조건">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="장비"><Select value={filters.equipment_id} onChange={(event) => updateFilter("equipment_id", event.target.value)}><option value="">전체</option>{data.equipment.map((item) => <option key={item.id} value={item.id}>{item.equipment_code} {item.equipment_name}</option>)}</Select></Field>
          <Field label="조회 시작일"><TextInput type="date" value={filters.date_from} onChange={(event) => updateFilter("date_from", event.target.value)} /></Field>
          <Field label="조회 종료일"><TextInput type="date" value={filters.date_to} onChange={(event) => updateFilter("date_to", event.target.value)} /></Field>
          <Field label="사용자"><Select value={filters.user_id} onChange={(event) => updateFilter("user_id", event.target.value)}><option value="">전체</option>{data.users.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}</Select></Field>
          <Field label="사용 유형"><Select value={filters.usage_type} onChange={(event) => updateFilter("usage_type", event.target.value)}><option value="">전체</option>{USAGE_TYPES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="기록 상태"><Select value={filters.record_status} onChange={(event) => updateFilter("record_status", event.target.value)}><option value="">전체</option>{["IN_USE", "COMPLETED", "CHANGE_REQUESTED", "REVIEWED", "INVALID"].map((item) => <option key={item} value={item}>{label(item)}</option>)}</Select></Field>
          <Field label="사용 후 상태"><Select value={filters.after_use_status} onChange={(event) => updateFilter("after_use_status", event.target.value)}><option value="">전체</option><option value="NORMAL">정상</option><option value="ABNORMAL">이상</option></Select></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={resetFilters}>초기화</Button><Button variant="secondary" onClick={() => void load(appliedFilters)}>새로고침</Button><Button onClick={applyFilters}>조회</Button></div>
      </Card>
      <Card title={`사용 기록 목록 ${loading ? "조회 중" : `${data.records.length}건`}`}>
        <Table columns={[{ label: "기록 ID", width: "145px" }, { label: "장비", width: "150px", nowrap: false }, { label: "사용 유형", width: "135px", nowrap: false }, { label: "사용자", width: "110px", nowrap: false }, { label: "시작과 종료", width: "205px", nowrap: false }, { label: "상태", width: "105px", align: "center" }, { label: "동작", width: "235px", align: "center" }]} empty={loading ? "조회 중입니다." : "조회된 사용 기록이 없습니다."}>
          {data.records.map((record) => {
            const own = session.role === "TESTER" && record.user_id === session.userId;
            const mutable = own && !["REVIEWED", "INVALID"].includes(record.record_status);
            const latestRemediation = data.remediations.filter((item) => item.source_record_id === record.id).sort((a, b) => (b.updated_at || b.action_recorded_at).localeCompare(a.updated_at || a.action_recorded_at))[0];
            const equipment = equipmentById.get(record.equipment_id);
            const canRemediate = own && record.after_use_status === "ABNORMAL" && equipment?.availability_status === "SUSPENDED" && (!latestRemediation || latestRemediation.remediation_status === "REJECTED");
            const canResume = own && latestRemediation?.remediation_status === "ACTION_RECORDED";
            return <tr key={record.id}><Td code>{record.id}</Td><Td clamp={2}>{record.equipment_code}<br />{record.equipment_name}</Td><Td clamp={2}>{record.usage_type}</Td><Td clamp={2}>{record.user_name}<br />{record.user_id}</Td><Td code nowrap>{formatTime(record.started_at)}<br />{record.ended_at ? formatTime(record.ended_at) : "사용 중"}</Td><Td align="center"><StatusBadge value={record.record_status === "INVALID" ? "VOIDED" : record.record_status} label={label(record.record_status)} /></Td><Td align="center"><div className="flex flex-wrap justify-center gap-1"><Button size="sm" variant="secondary" onClick={() => setDetail(record)}>상세</Button>{own && record.record_status === "IN_USE" ? <Button size="sm" onClick={() => openAction("end", record)}>종료</Button> : null}{session.role === "ADMIN" && record.record_status === "IN_USE" ? <Button size="sm" variant="danger" onClick={() => openAction("exception", record)}>예외 종료</Button> : null}{mutable ? <Button size="sm" variant="secondary" onClick={() => openAction("edit", record)}>수정</Button> : null}{mutable ? <Button size="sm" variant="danger" onClick={() => openAction("invalidate", record)}>무효</Button> : null}{canRemediate ? <Button size="sm" onClick={() => openAction("remediation", record)}>{latestRemediation ? "조치 보완" : "조치"}</Button> : null}{canResume ? <Button size="sm" onClick={() => openAction("resume", record, latestRemediation)}>재개 요청</Button> : null}</div></Td></tr>;
          })}
        </Table>
      </Card>

      <Modal open={!!detail} title="사용 기록 상세" size="xl" onClose={() => setDetail(null)} footer={<Button variant="secondary" onClick={() => setDetail(null)}>닫기</Button>}>
        {detail ? <><DescList items={detailItems(detail)} />{data.remediations.filter((item) => item.source_record_id === detail.id).map((item) => <div key={item.id} className="mt-5"><h3 className="mb-2 font-bold text-primary-dark">조치 기록</h3><DescList items={[{ label: "조치 ID", value: item.id }, { label: "상태", value: label(item.remediation_status) }, { label: "조치 유형", value: item.action_type }, { label: "조치 내용", value: item.action_details, full: true }, { label: "기록자", value: item.action_recorded_by_name }, { label: "기록 일시", value: formatTime(item.action_recorded_at) }]} /></div>)}{data.resume_requests.filter((item) => item.source_record_id === detail.id).map((item) => <div key={item.id} className="mt-5"><h3 className="mb-2 font-bold text-primary-dark">사용 재개 요청 {item.request_sequence}차</h3><DescList items={[{ label: "요청 ID", value: item.id }, { label: "상태", value: label(item.resume_status) }, { label: "요청자", value: item.requested_by_name }, { label: "요청 일시", value: formatTime(item.requested_at) }, { label: "확인자", value: item.confirmed_by_name || "해당 없음" }, { label: "확인 일시", value: formatTime(item.confirmed_at) }, { label: "확인 결과", value: label(item.confirmation_result) }, { label: "반려 사유", value: item.rejection_reason || "해당 없음", full: true }]} /></div>)}</> : null}
      </Modal>

      <Modal open={!!action} title={action ? actionTitle[action.kind] : "기록 처리"} size="lg" onClose={() => { if (!submitting) { setAction(null); setConfirming(false); } }} footer={<><Button variant="secondary" disabled={submitting} onClick={() => { if (confirming) setConfirming(false); else setAction(null); }}>{confirming ? "입력 수정" : "취소"}</Button>{confirming ? <Button variant={action?.kind === "invalidate" || action?.kind === "exception" ? "danger" : "primary"} disabled={submitting} onClick={() => void submitAction()}>{submitting ? "처리 중" : "확정"}</Button> : <Button variant={action?.kind === "invalidate" || action?.kind === "exception" ? "danger" : "primary"} onClick={() => { const message = validateAction(); if (message) setError(message); else { setError(""); setConfirming(true); } }}>입력 확인</Button>}</>}>
        {error ? <Banner kind="error">{error}</Banner> : null}
        {action ? confirming ? <><NoticeBox title="저장 전 확인">아래 내용이 정확한지 확인해 주세요. 사용자와 처리 일시는 서버에서 자동 생성됩니다.</NoticeBox><DescList items={confirmationItems()} /></> : actionInput() : null}
      </Modal>
    </>
  );
}
