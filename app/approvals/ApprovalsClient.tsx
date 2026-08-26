"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Banner,
  Button,
  Card,
  DescList,
  Field,
  Modal,
  NoticeBox,
  PageTitle,
  StatusBadge,
  Table,
  Td,
  Textarea,
  TextInput,
} from "@/components/ui";
import { toKST } from "@/lib/kst";
import type { EquipmentRow, UseRecordRow } from "@/types";

type Remediation = Record<string, string> & {
  id: string;
  action_type: string;
  action_details: string;
  action_recorded_by_id: string;
  action_recorded_by_name: string;
  action_recorded_at: string;
  remediation_status: string;
};

type ResumeHistory = Record<string, string> & {
  id: string;
  request_sequence: string;
  resume_status: string;
  requested_by_id: string;
  requested_by_name: string;
  requested_at: string;
  confirmed_by_name: string;
  confirmed_at: string;
  confirmation_result: string;
  rejection_reason: string;
};

type ReviewRecord = UseRecordRow & {
  equipment: EquipmentRow | null;
  remediations: Remediation[];
  resume_requests: ResumeHistory[];
};

type ResumeRequest = ResumeHistory & {
  equipment_id: string;
  source_record_id: string;
  action_details_snapshot: string;
  equipment: EquipmentRow | null;
  remediation: Remediation | null;
  source_record: UseRecordRow | null;
};

type ApprovalData = {
  current_user: { user_id: string; name: string; role: string };
  review_records: ReviewRecord[];
  resume_requests: ResumeRequest[];
};

type BannerState = { kind: "error" | "success" | "info" | "warn"; text: string } | null;

const RECORD_STATUS_LABELS: Record<string, string> = {
  IN_USE: "사용중",
  COMPLETED: "사용완료",
  CHANGE_REQUESTED: "수정요청",
  REVIEWED: "검토완료",
  INVALID: "무효",
};

const RESUME_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "사용 재개 요청",
  APPROVED: "승인",
  REJECTED: "반려",
};

function statusLabel(value: string) {
  return RECORD_STATUS_LABELS[value] ?? RESUME_STATUS_LABELS[value] ?? value;
}

function afterUseLabel(value: string) {
  if (value === "NORMAL") return "정상";
  if (value === "ABNORMAL") return "이상";
  return value || "해당 없음";
}

function showTime(value: string) {
  return value ? toKST(value, true) : "해당 없음";
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error || "요청을 처리하지 못했습니다.");
  if (!body) throw new Error("서버 응답을 확인하지 못했습니다.");
  return body;
}

export default function ApprovalsClient() {
  const [data, setData] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);
  const [selectedRecord, setSelectedRecord] = useState<ReviewRecord | null>(null);
  const [recordDetailOpen, setRecordDetailOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [selectedResume, setSelectedResume] = useState<ResumeRequest | null>(null);
  const [resumeDetailOpen, setResumeDetailOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [decisionReason, setDecisionReason] = useState("");

  const loadQueues = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/approvals", { cache: "no-store" });
      setData(await readJson<ApprovalData>(response));
    } catch (error) {
      setBanner({ kind: "error", text: error instanceof Error ? error.message : "대기 목록을 조회하지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQueues(), 0);
    return () => window.clearTimeout(timer);
  }, [loadQueues]);

  const reviewItems = useMemo(
    () =>
      selectedRecord
        ? [
            { label: "사용 기록 ID", value: selectedRecord.id },
            { label: "장비", value: `${selectedRecord.equipment_code} ${selectedRecord.equipment_name}` },
            { label: "교정 대상", value: selectedRecord.equipment?.calibration_required === "REQUIRED" ? "대상" : "비대상" },
            { label: "적격성평가 대상", value: selectedRecord.equipment?.qualification_required === "REQUIRED" ? "대상" : "비대상" },
            { label: "사용자", value: `${selectedRecord.user_name} (${selectedRecord.user_id})` },
            { label: "사용 유형", value: selectedRecord.usage_type },
            { label: "사용 목적", value: selectedRecord.usage_purpose, full: true },
            { label: "참조번호", value: selectedRecord.reference_no || "해당 없음" },
            { label: "사용 시작 일시", value: showTime(selectedRecord.started_at) },
            { label: "사용 종료 일시", value: showTime(selectedRecord.ended_at) },
            { label: "사용 후 상태", value: afterUseLabel(selectedRecord.after_use_status) },
            { label: "기록 상태", value: statusLabel(selectedRecord.record_status) },
            { label: "이상 내용", value: selectedRecord.abnormality_details || "해당 없음", full: true },
            { label: "종료 방식", value: selectedRecord.end_method || "해당 없음" },
            { label: "예외 종료 사유", value: selectedRecord.exception_reason || "해당 없음", full: true },
            { label: "수정 요청 사유", value: selectedRecord.change_request_reason || "해당 없음", full: true },
          ]
        : [],
    [selectedRecord],
  );

  function openRecord(record: ReviewRecord) {
    setSelectedRecord(record);
    setRecordDetailOpen(true);
  }

  function openChangeRequest() {
    setRecordDetailOpen(false);
    setChangeReason("");
    setChangeOpen(true);
  }

  function openSignature() {
    setRecordDetailOpen(false);
    setPassword("");
    setSignatureOpen(true);
  }

  async function submitRecordAction(kind: "change" | "signature") {
    if (!selectedRecord || submitting) return;
    setSubmitting(true);
    setBanner(null);
    try {
      const endpoint =
        kind === "change"
          ? `/api/approvals/records/${encodeURIComponent(selectedRecord.id)}/change-request`
          : `/api/approvals/records/${encodeURIComponent(selectedRecord.id)}/review-signature`;
      const payload = kind === "change" ? { reason: changeReason } : { password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const result = await readJson<{ message: string }>(response);
      setChangeOpen(false);
      setSignatureOpen(false);
      setSelectedRecord(null);
      setPassword("");
      setBanner({ kind: "success", text: result.message });
      await loadQueues();
    } catch (error) {
      setBanner({ kind: "error", text: error instanceof Error ? error.message : "검토 작업을 저장하지 못했습니다." });
    } finally {
      setSubmitting(false);
    }
  }

  function openResume(request: ResumeRequest) {
    setSelectedResume(request);
    setResumeDetailOpen(true);
  }

  function openDecision(result: "APPROVED" | "REJECTED") {
    setResumeDetailOpen(false);
    setDecision(result);
    setDecisionReason("");
    setDecisionOpen(true);
  }

  async function submitDecision() {
    if (!selectedResume || submitting) return;
    setSubmitting(true);
    setBanner(null);
    try {
      const response = await fetch(
        `/api/approvals/resume-requests/${encodeURIComponent(selectedResume.id)}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result: decision, reason: decisionReason }),
          cache: "no-store",
        },
      );
      const result = await readJson<{ message: string }>(response);
      setDecisionOpen(false);
      setSelectedResume(null);
      setBanner({ kind: "success", text: result.message });
      await loadQueues();
    } catch (error) {
      setBanner({ kind: "error", text: error instanceof Error ? error.message : "사용 재개 결정을 저장하지 못했습니다." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageTitle
        title="검토와 승인"
        description="사용완료 기록의 전자서명 검토와 장비 사용 재개 제2자 확인을 수행합니다."
        actions={
          <Button type="button" variant="secondary" onClick={() => void loadQueues()} disabled={loading}>
            새로고침
          </Button>
        }
      />
      <NoticeBox title="검토 통제">
        검토 완료 전자서명에는 본인 비밀번호 재입력이 필요합니다. 검토완료 기록은 잠기며 기존 값을 직접 수정할 수 없습니다.
      </NoticeBox>
      {banner ? <Banner kind={banner.kind}>{banner.text}</Banner> : null}

      <Card title={`사용 기록 검토 대기 ${data?.review_records.length ?? 0}건`}>
        <Table
          columns={[
            { label: "기록 ID", width: "150px" },
            { label: "장비", width: "170px", nowrap: false },
            { label: "사용자", width: "120px", nowrap: false },
            { label: "시작과 종료", width: "230px", nowrap: false },
            { label: "사용 후 상태", width: "105px", align: "center" },
            { label: "기록 상태", width: "105px", align: "center" },
            { label: "동작", width: "88px", align: "center" },
          ]}
          empty={loading ? "조회 중입니다." : "검토 대기 기록이 없습니다."}
        >
          {data?.review_records.map((record) => (
            <tr key={record.id}>
              <Td code>{record.id}</Td>
              <Td clamp={2}>{record.equipment_code} {record.equipment_name}</Td>
              <Td clamp={2}>{record.user_name} ({record.user_id})</Td>
              <Td clamp={2}>{showTime(record.started_at)} / {showTime(record.ended_at)}</Td>
              <Td align="center">
                <StatusBadge value={record.after_use_status || "NORMAL"} label={afterUseLabel(record.after_use_status)} />
              </Td>
              <Td align="center">
                <StatusBadge value={record.record_status} label={statusLabel(record.record_status)} />
              </Td>
              <Td align="center">
                <Button type="button" size="sm" variant="secondary" onClick={() => openRecord(record)}>상세</Button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title={`사용 재개 승인 대기 ${data?.resume_requests.length ?? 0}건`}>
        <Table
          columns={[
            { label: "요청 ID", width: "150px" },
            { label: "장비", width: "165px", nowrap: false },
            { label: "요청자", width: "120px", nowrap: false },
            { label: "요청 일시", width: "205px" },
            { label: "요청 차수", width: "88px", align: "right" },
            { label: "상태", width: "115px", align: "center" },
            { label: "동작", width: "88px", align: "center" },
          ]}
          empty={loading ? "조회 중입니다." : "사용 재개 승인 대기가 없습니다."}
        >
          {data?.resume_requests.map((request) => (
            <tr key={request.id}>
              <Td code>{request.id}</Td>
              <Td clamp={2}>{request.equipment ? `${request.equipment.equipment_code} ${request.equipment.equipment_name}` : request.equipment_id}</Td>
              <Td clamp={2}>{request.requested_by_name} ({request.requested_by_id})</Td>
              <Td nowrap code>{showTime(request.requested_at)}</Td>
              <Td num>{request.request_sequence}</Td>
              <Td align="center"><StatusBadge value={request.resume_status} label={statusLabel(request.resume_status)} /></Td>
              <Td align="center"><Button type="button" size="sm" variant="secondary" onClick={() => openResume(request)}>상세</Button></Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal
        open={recordDetailOpen && !!selectedRecord}
        title="사용 기록 검토 상세"
        size="xl"
        onClose={() => setRecordDetailOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setRecordDetailOpen(false)}>닫기</Button>
            {selectedRecord?.record_status === "COMPLETED" ? (
              <>
                <Button type="button" variant="secondary" onClick={openChangeRequest}>수정 요청</Button>
                <Button type="button" onClick={openSignature}>검토 완료</Button>
              </>
            ) : null}
          </>
        }
      >
        <DescList items={reviewItems} />
        <div className="mt-5">
          <h3 className="mb-2 font-bold text-primary-dark">조치와 사용 재개 이력</h3>
          {selectedRecord?.remediations.length ? selectedRecord.remediations.map((row) => (
            <div key={row.id} className="mb-2 rounded-input border border-line bg-muted p-3 text-sm">
              <b>{row.action_type}</b> {row.action_details}<br />
              기록자 {row.action_recorded_by_name} ({row.action_recorded_by_id}), {showTime(row.action_recorded_at)}, 상태 {statusLabel(row.remediation_status)}
            </div>
          )) : <p className="text-sm text-ink-muted">등록된 조치가 없습니다.</p>}
          {selectedRecord?.resume_requests.map((row) => (
            <div key={row.id} className="mt-2 rounded-input border border-line p-3 text-sm">
              {row.request_sequence}차 요청, {statusLabel(row.resume_status)}, 요청자 {row.requested_by_name}, {showTime(row.requested_at)}
              {row.confirmed_at ? <><br />확인자 {row.confirmed_by_name}, {showTime(row.confirmed_at)}, 결과 {row.confirmation_result}{row.rejection_reason ? `, 반려 사유 ${row.rejection_reason}` : ""}</> : null}
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={changeOpen && !!selectedRecord}
        title="수정 요청"
        onClose={() => setChangeOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setChangeOpen(false)}>취소</Button>
            <Button type="button" onClick={() => void submitRecordAction("change")} disabled={submitting}>수정 요청 저장</Button>
          </>
        }
      >
        <NoticeBox title="정확성 확인">원래 기록과 요청 사유를 확인한 뒤 저장합니다. 저장 후 기록은 수정요청 상태로 전환됩니다.</NoticeBox>
        <DescList cols={1} items={[
          { label: "사용 기록 ID", value: selectedRecord?.id ?? "" },
          { label: "장비", value: selectedRecord ? `${selectedRecord.equipment_code} ${selectedRecord.equipment_name}` : "" },
          { label: "사용 후 상태", value: selectedRecord ? afterUseLabel(selectedRecord.after_use_status) : "" },
        ]} />
        <div className="mt-4">
          <Field label="수정 요청 사유" required>
            <Textarea rows={3} value={changeReason} onChange={(event) => setChangeReason(event.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={signatureOpen && !!selectedRecord}
        title="검토 완료 전자서명"
        size="xl"
        onClose={() => setSignatureOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setSignatureOpen(false)}>취소</Button>
            <Button type="button" onClick={() => void submitRecordAction("signature")} disabled={submitting}>전자서명</Button>
          </>
        }
      >
        <NoticeBox title="전자서명 고지">
          서명 의미는 검토 완료입니다. 서명자의 본인 비밀번호를 다시 확인한 경우에만 검토가 완료됩니다.
        </NoticeBox>
        <DescList items={reviewItems} />
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="서명자"><TextInput readOnly value={data ? `${data.current_user.name} (${data.current_user.user_id})` : ""} /></Field>
          <Field label="서명 의미"><TextInput readOnly value="검토 완료" /></Field>
          <Field label="비밀번호" required><TextInput type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
        </div>
      </Modal>

      <Modal
        open={resumeDetailOpen && !!selectedResume}
        title="사용 재개 요청 상세"
        size="lg"
        onClose={() => setResumeDetailOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setResumeDetailOpen(false)}>닫기</Button>
            <Button type="button" variant="danger" onClick={() => openDecision("REJECTED")}>반려</Button>
            <Button type="button" onClick={() => openDecision("APPROVED")}>승인</Button>
          </>
        }
      >
        <NoticeBox title="제2자 확인">요청자와 조치 기록자가 아닌 APPROVER가 이상 내용과 조치 내용을 확인해야 합니다.</NoticeBox>
        <DescList items={[
          { label: "요청 ID", value: selectedResume?.id ?? "" },
          { label: "장비", value: selectedResume?.equipment ? `${selectedResume.equipment.equipment_code} ${selectedResume.equipment.equipment_name}` : selectedResume?.equipment_id ?? "" },
          { label: "이상 내용", value: selectedResume?.source_record?.abnormality_details || "해당 없음", full: true },
          { label: "조치 유형", value: selectedResume?.remediation?.action_type || "해당 없음" },
          { label: "조치 내용", value: selectedResume?.action_details_snapshot || "해당 없음", full: true },
          { label: "조치 기록자", value: selectedResume?.remediation ? `${selectedResume.remediation.action_recorded_by_name} (${selectedResume.remediation.action_recorded_by_id})` : "해당 없음" },
          { label: "요청자", value: selectedResume ? `${selectedResume.requested_by_name} (${selectedResume.requested_by_id})` : "" },
          { label: "요청 일시", value: selectedResume ? showTime(selectedResume.requested_at) : "" },
          { label: "요청 차수", value: selectedResume?.request_sequence ?? "" },
        ]} />
      </Modal>

      <Modal
        open={decisionOpen && !!selectedResume}
        title={decision === "APPROVED" ? "사용 재개 승인 확인" : "사용 재개 반려 확인"}
        onClose={() => setDecisionOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDecisionOpen(false)}>취소</Button>
            <Button type="button" variant={decision === "REJECTED" ? "danger" : "primary"} onClick={() => void submitDecision()} disabled={submitting}>
              {decision === "APPROVED" ? "승인 저장" : "반려 저장"}
            </Button>
          </>
        }
      >
        <NoticeBox title="확인 결과">
          {decision === "APPROVED"
            ? "승인하면 장비가 사용가능과 미사용 상태로 복원됩니다."
            : "반려하면 장비는 사용중지 상태를 유지하며 조치 내용을 보완한 뒤 다시 요청할 수 있습니다."}
        </NoticeBox>
        <DescList cols={1} items={[
          { label: "장비", value: selectedResume?.equipment ? `${selectedResume.equipment.equipment_code} ${selectedResume.equipment.equipment_name}` : "" },
          { label: "조치 내용", value: selectedResume?.action_details_snapshot ?? "", full: true },
          { label: "확인자", value: data ? `${data.current_user.name} (${data.current_user.user_id})` : "" },
          { label: "확인 결과", value: decision === "APPROVED" ? "승인" : "반려" },
        ]} />
        <div className="mt-4">
          <Field label={decision === "REJECTED" ? "반려 사유" : "승인 의견"} required={decision === "REJECTED"}>
            <Textarea rows={3} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
