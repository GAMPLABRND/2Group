"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, Card, DescList, PageTitle, StatusBadge } from "@/components/ui";
import { toKST } from "@/lib/kst";
import type { EquipmentRow, UseRecordRow } from "@/types";

type DetailResponse = {
  record: UseRecordRow;
  equipment: EquipmentRow | null;
  remediations: Array<Record<string, string>>;
  resume_requests: Array<Record<string, string>>;
  error?: string;
};
const LABELS: Record<string, string> = {
  IN_USE: "사용중", COMPLETED: "사용완료", CHANGE_REQUESTED: "수정요청", REVIEWED: "검토완료", INVALID: "무효",
  NORMAL: "정상", ABNORMAL: "이상", AVAILABLE: "사용가능", SUSPENDED: "사용중지", RETIRED: "폐기", FREE: "미사용", OCCUPIED: "사용중",
  ACTION_RECORDED: "조치기록", RESUME_REQUESTED: "재개요청됨", REQUESTED: "사용 재개 요청", APPROVED: "승인", REJECTED: "반려",
};
const show = (value: string) => LABELS[value] || value || "해당 없음";
const time = (value: string) => value ? toKST(value, true) : "해당 없음";

export default function RecordDetailClient({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/records/${encodeURIComponent(recordId)}`, { cache: "no-store" });
      const body = (await response.json()) as DetailResponse;
      if (!response.ok) throw new Error(body.error || "사용 기록 상세를 조회하지 못했습니다.");
      setData(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "사용 기록 상세를 조회하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [recordId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const record = data?.record;
  return <>
    <PageTitle title="사용 기록 상세" description="사용 시작부터 종료, 검토, 무효와 이상 조치 이력을 확인합니다." actions={<><Button variant="secondary" onClick={() => router.push("/records")}>목록</Button><Button variant="secondary" onClick={() => void load()}>새로고침</Button></>} />
    {error ? <Banner kind="error">{error}</Banner> : null}
    {loading ? <Card>상세 기록을 조회하고 있습니다.</Card> : null}
    {record ? <>
      <Card title="사용 기록"><DescList items={[
        { label: "사용 기록 ID", value: record.id }, { label: "기록 상태", value: <StatusBadge value={record.record_status === "INVALID" ? "VOIDED" : record.record_status} label={show(record.record_status)} /> },
        { label: "장비", value: `${record.equipment_code} ${record.equipment_name}`, full: true }, { label: "사용자", value: `${record.user_name} (${record.user_id})` }, { label: "사번", value: record.employee_no || "해당 없음" },
        { label: "사용 유형", value: record.usage_type }, { label: "참조번호", value: record.reference_no || "해당 없음" }, { label: "사용 목적", value: record.usage_purpose, full: true },
        { label: "시작 일시", value: time(record.started_at) }, { label: "종료 일시", value: time(record.ended_at) }, { label: "사용 후 상태", value: show(record.after_use_status) }, { label: "종료 방식", value: record.end_method || "해당 없음" },
        { label: "특이사항 또는 이상 내용", value: record.abnormality_details || "해당 없음", full: true }, { label: "예외 종료자", value: record.exception_ended_by_name || "해당 없음" }, { label: "예외 종료 일시", value: time(record.exception_ended_at) }, { label: "예외 종료 사유", value: record.exception_reason || "해당 없음", full: true },
        { label: "수정 요청 사유", value: record.change_request_reason || "해당 없음", full: true }, { label: "검토자", value: record.reviewer_name || "해당 없음" }, { label: "검토 일시", value: time(record.reviewed_at) }, { label: "서명 의미", value: record.signature_meaning || "해당 없음" },
        { label: "무효 처리자", value: record.invalidated_by || "해당 없음" }, { label: "무효 처리 일시", value: time(record.invalidated_at) }, { label: "무효 사유", value: record.invalidation_reason || "해당 없음", full: true }, { label: "최종 수정자", value: record.updated_by || "해당 없음" }, { label: "최종 수정 일시", value: time(record.updated_at) },
      ]} /></Card>
      {data?.equipment ? <Card title="현재 장비 상태"><DescList items={[{ label: "장비 코드", value: data.equipment.equipment_code }, { label: "설치 위치", value: data.equipment.location }, { label: "사용 상태", value: show(data.equipment.availability_status) }, { label: "점유 상태", value: show(data.equipment.occupancy_status) }, { label: "점유 기록 ID", value: data.equipment.occupancy_record_id || "해당 없음" }, { label: "교정 대상", value: data.equipment.calibration_required === "REQUIRED" ? "대상" : "비대상" }, { label: "적격성평가 대상", value: data.equipment.qualification_required === "REQUIRED" ? "대상" : "비대상" }, { label: "교정 유효기간", value: data.equipment.calibration_due_date || "비대상" }]} /></Card> : null}
      {data?.remediations.map((item) => <Card key={item.id} title="이상 장비 조치"><DescList items={[{ label: "조치 ID", value: item.id }, { label: "조치 상태", value: show(item.remediation_status) }, { label: "조치 유형", value: item.action_type }, { label: "조치 내용", value: item.action_details, full: true }, { label: "기록자", value: item.action_recorded_by_name }, { label: "기록 일시", value: time(item.action_recorded_at) }, { label: "보완 일시", value: time(item.updated_at) }]} /></Card>)}
      {data?.resume_requests.map((item) => <Card key={item.id} title={`사용 재개 요청 ${item.request_sequence}차`}><DescList items={[{ label: "요청 ID", value: item.id }, { label: "상태", value: show(item.resume_status) }, { label: "조치 내용", value: item.action_details_snapshot, full: true }, { label: "요청자", value: item.requested_by_name }, { label: "요청 일시", value: time(item.requested_at) }, { label: "확인자", value: item.confirmed_by_name || "해당 없음" }, { label: "확인 일시", value: time(item.confirmed_at) }, { label: "확인 결과", value: show(item.confirmation_result) }, { label: "반려 사유", value: item.rejection_reason || "해당 없음", full: true }]} /></Card>)}
    </> : null}
  </>;
}
