"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Banner,
  Button,
  Card,
  DocTable,
  Field,
  NoticeBox,
  PageTitle,
  PrintButton,
  PrintHeader,
  Select,
  TextInput,
} from "@/components/ui";
import { toKST } from "@/lib/kst";
import type { UseRecordRow } from "@/types";

type EquipmentOption = {
  id: string;
  equipment_code: string;
  equipment_name: string;
  availability_status: string;
};

type CorrectiveAction = {
  id: string;
  action_type: string;
  action_details: string;
  action_recorded_by_name: string;
  action_recorded_at: string;
};

type LogbookRecord = UseRecordRow & { corrective_actions: CorrectiveAction[] };

type LogbookData = {
  document_number: string;
  printed_at: string;
  printed_by: { user_id: string; name: string; role: string };
  period: { date_from: string; date_to: string };
  equipment: {
    id: string;
    equipment_code: string;
    equipment_name: string;
    calibration_required: string;
    qualification_required: string;
  };
  records: LogbookRecord[];
  official_status: "REVIEWED_ONLY";
};

function currentKstDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function showTime(value: string) {
  return value ? toKST(value, true) : "해당 없음";
}

function afterUseLabel(value: string) {
  if (value === "NORMAL") return "정상";
  if (value === "ABNORMAL") return "이상";
  return value || "해당 없음";
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error || "요청을 처리하지 못했습니다.");
  if (!body) throw new Error("서버 응답을 확인하지 못했습니다.");
  return body;
}

export default function LogbookClient() {
  const [equipment, setEquipment] = useState<EquipmentOption[]>([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [dateFrom, setDateFrom] = useState(currentKstDate());
  const [dateTo, setDateTo] = useState(currentKstDate());
  const [logbook, setLogbook] = useState<LogbookData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadEquipment = useCallback(async () => {
    try {
      const response = await fetch("/api/print/equipment", { cache: "no-store" });
      const result = await readJson<{ equipment: EquipmentOption[] }>(response);
      setEquipment(result.equipment);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "장비 목록을 조회하지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEquipment(), 0);
    return () => window.clearTimeout(timer);
  }, [loadEquipment]);

  async function queryLogbook() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        equipment_id: equipmentId,
        date_from: dateFrom,
        date_to: dateTo,
      });
      const response = await fetch(`/api/print/logbook?${params.toString()}`, { cache: "no-store" });
      setLogbook(await readJson<LogbookData>(response));
    } catch (queryError) {
      setLogbook(null);
      setError(queryError instanceof Error ? queryError.message : "공식 로그북을 조회하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function resetQuery() {
    setEquipmentId("");
    setDateFrom(currentKstDate());
    setDateTo(currentKstDate());
    setLogbook(null);
    setError("");
  }

  const correctiveActionText = (record: LogbookRecord) =>
    record.corrective_actions.length
      ? record.corrective_actions
          .map(
            (row) =>
              `${row.action_type}: ${row.action_details} (${row.action_recorded_by_name}, ${showTime(row.action_recorded_at)})`,
          )
          .join("\n")
      : "해당 없음";

  return (
    <>
      <div className="no-print">
        <PageTitle title="로그북" description="검토완료 기록만 공식 전자로그북으로 조회하고 출력합니다." />
        <NoticeBox title="공식 출력 범위">
          검토가 완료되지 않은 기록은 공식 로그북 출력 대상에 포함되지 않습니다. 조회 결과에는 DRAFT 기록이 표시되지 않습니다.
        </NoticeBox>
        {error ? <Banner kind="error">{error}</Banner> : null}
        <Card title="로그북 조회 조건">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="장비" required>
              <Select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)}>
                <option value="">장비 선택</option>
                {equipment.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.equipment_code} {row.equipment_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="조회 시작일" required>
              <TextInput type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </Field>
            <Field label="조회 종료일" required>
              <TextInput type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={resetQuery}>초기화</Button>
            <Button type="button" variant="secondary" onClick={() => void queryLogbook()} disabled={loading || !equipmentId}>새로고침</Button>
            <Button type="button" onClick={() => void queryLogbook()} disabled={loading || !equipmentId}>{loading ? "조회 중" : "조회"}</Button>
          </div>
        </Card>
      </div>

      {logbook ? (
        <section className="print-area print-landscape mb-6 rounded-card border border-line bg-white p-6 shadow-card text-black">
          <div className="no-print mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-primary-dark">공식 로그북 출력 미리보기</h2>
              <p className="mt-1 text-xs text-ink-muted">브라우저 인쇄 옵션에서 머리글과 바닥글을 설정하면 페이지 정보를 함께 표시할 수 있습니다.</p>
            </div>
            <PrintButton
              auditEndpoint="/api/print/logbook/audit"
              auditPayload={{
                equipment_id: logbook.equipment.id,
                date_from: logbook.period.date_from,
                date_to: logbook.period.date_to,
                document_number: logbook.document_number,
                printed_at: logbook.printed_at,
                record_ids: logbook.records.map((record) => record.id),
              }}
              label="로그북 인쇄"
            />
          </div>

          <PrintHeader
            title="장비 사용 전자로그북"
            docNo={logbook.document_number}
            printedBy={`${logbook.printed_by.name} (${logbook.printed_by.user_id})`}
            printedAt={showTime(logbook.printed_at)}
          />

          <div className="print-avoid-break mb-4 grid grid-cols-5 border border-black text-[12px]">
            <div className="border-r border-black p-2"><b>장비 코드</b><br />{logbook.equipment.equipment_code}</div>
            <div className="border-r border-black p-2"><b>장비명</b><br />{logbook.equipment.equipment_name}</div>
            <div className="border-r border-black p-2"><b>교정 대상</b><br />{logbook.equipment.calibration_required === "REQUIRED" ? "대상" : "비대상"}</div>
            <div className="border-r border-black p-2"><b>적격성평가 대상</b><br />{logbook.equipment.qualification_required === "REQUIRED" ? "대상" : "비대상"}</div>
            <div className="p-2"><b>조회 기간</b><br />{logbook.period.date_from}부터 {logbook.period.date_to}까지</div>
          </div>

          <DocTable
            columns={[
              { label: "사용 기록 ID", width: "12%" },
              { label: "사용자와 사용 유형", width: "13%", nowrap: false },
              { label: "사용 목적과 참조번호", width: "16%", nowrap: false },
              { label: "사용 시작과 종료", width: "16%", nowrap: false },
              { label: "사용 후 상태와 이상 내용", width: "14%", nowrap: false },
              { label: "조치 내용", width: "15%", nowrap: false },
              { label: "검토 전자서명", width: "14%", nowrap: false },
            ]}
          >
            {logbook.records.length ? logbook.records.map((record) => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.user_name} ({record.user_id})<br />{record.usage_type}</td>
                <td>{record.usage_purpose}<br />참조번호: {record.reference_no || "해당 없음"}</td>
                <td>{showTime(record.started_at)}<br />{showTime(record.ended_at)}</td>
                <td>{afterUseLabel(record.after_use_status)}<br />{record.abnormality_details || "해당 없음"}</td>
                <td className="whitespace-pre-line">{correctiveActionText(record)}</td>
                <td>{record.reviewer_name} ({record.reviewer_id})<br />{showTime(record.reviewed_at)}<br />의미: {record.signature_meaning}</td>
              </tr>
            )) : (
              <tr><td colSpan={7} className="text-center">조회 기간에 검토완료 기록이 없습니다.</td></tr>
            )}
          </DocTable>

          <div className="print-avoid-break mt-5">
            <h2 className="mb-2 text-[13px] font-bold text-black">전자서명 정보</h2>
            <DocTable
              columns={[
                { label: "사용 기록 ID", width: "25%" },
                { label: "검토자", width: "25%" },
                { label: "검토 일시", width: "30%" },
                { label: "서명 의미", width: "20%" },
              ]}
            >
              {logbook.records.length ? logbook.records.map((record) => (
                <tr key={`signature-${record.id}`}>
                  <td>{record.id}</td>
                  <td>{record.reviewer_name} ({record.reviewer_id})</td>
                  <td>{showTime(record.reviewed_at)}</td>
                  <td>{record.signature_meaning}</td>
                </tr>
              )) : <tr><td colSpan={4} className="text-center">전자서명 정보가 없습니다.</td></tr>}
            </DocTable>
          </div>

          <div className="print-avoid-break mt-5 grid grid-cols-2 border-[1.5px] border-black text-[12px]">
            <div className="min-h-20 border-r border-black p-3">
              <b>검토자 서명 정보</b><br />개별 사용 기록의 검토자, 검토 일시, 서명 의미는 전자서명 정보 표와 같습니다.
            </div>
            <div className="min-h-20 p-3">
              <b>출력 확인 정보</b><br />출력자: {logbook.printed_by.name} ({logbook.printed_by.user_id})<br />출력 일시: {showTime(logbook.printed_at)}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
