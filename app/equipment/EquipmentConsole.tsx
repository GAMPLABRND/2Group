"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Banner,
  Button,
  Card,
  Checkbox,
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
import type { EquipmentRow, Role } from "@/types";

type EquipmentForm = {
  equipment_code: string;
  equipment_name: string;
  location: string;
  calibration_required: string;
  calibration_due_date: string;
  qualification_required: string;
  availability_status: string;
  remarks: string;
  modification_reason: string;
  status_change_reason: string;
};

const EMPTY_FORM: EquipmentForm = {
  equipment_code: "",
  equipment_name: "",
  location: "",
  calibration_required: "NOT_REQUIRED",
  calibration_due_date: "",
  qualification_required: "NOT_REQUIRED",
  availability_status: "AVAILABLE",
  remarks: "",
  modification_reason: "",
  status_change_reason: "",
};

const AVAILABILITY_LABELS: Record<string, string> = { AVAILABLE: "사용가능", SUSPENDED: "사용중지", RETIRED: "폐기" };
const OCCUPANCY_LABELS: Record<string, string> = { FREE: "미사용", OCCUPIED: "사용중" };
const CALIBRATION_LABELS: Record<string, string> = { REQUIRED: "대상", NOT_REQUIRED: "비대상" };

function isCalibrationExpired(row: EquipmentRow) {
  if (row.calibration_required !== "REQUIRED" || !row.calibration_due_date) return false;
  const today = new Date();
  const currentDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return row.calibration_due_date < currentDate;
}

export default function EquipmentConsole({ role }: { role: Role }) {
  const router = useRouter();
  const [canManage, setCanManage] = useState(role === "ADMIN");
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<EquipmentRow | null>(null);
  const [form, setForm] = useState<EquipmentForm>(EMPTY_FORM);
  const [mode, setMode] = useState<"create" | "detail">("detail");
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/equipment", { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as { equipment?: EquipmentRow[]; can_manage?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || "장비 기준정보를 불러오지 못했습니다.");
      setEquipment(body.equipment ?? []);
      setCanManage(Boolean(body.can_manage));
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(
    () => equipment.filter((row) => filter === "ALL" || row.availability_status === filter || row.occupancy_status === filter),
    [equipment, filter],
  );

  function openCreate() {
    setMode("create");
    setSelected(null);
    setForm(EMPTY_FORM);
    setEditing(true);
  }

  function openDetail(row: EquipmentRow) {
    setMode("detail");
    setSelected(row);
    setEditing(false);
    setForm({
      equipment_code: row.equipment_code,
      equipment_name: row.equipment_name,
      location: row.location,
      calibration_required: row.calibration_required,
      calibration_due_date: row.calibration_due_date,
      qualification_required: row.qualification_required,
      availability_status: row.availability_status,
      remarks: row.remarks,
      modification_reason: "",
      status_change_reason: "",
    });
  }

  function closeModal() {
    setSelected(null);
    setEditing(false);
    setMode("detail");
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/equipment", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(mode === "create" ? form : { id: selected?.id, ...form }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; password_expired?: boolean };
      if (!response.ok) {
        if (body.password_expired) router.push("/password?expired=1");
        throw new Error(body.error || "장비 기준정보를 저장하지 못했습니다.");
      }
      setMessage({ kind: "success", text: mode === "create" ? "장비 기준정보가 등록되었습니다." : "장비 기준정보가 수정되었습니다." });
      closeModal();
      await load();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  const modalOpen = mode === "create" || Boolean(selected);
  const formFields = (
    <div className="space-y-4">
      <Field label="장비 코드" required><TextInput value={form.equipment_code} onChange={(event) => setForm({ ...form, equipment_code: event.target.value })} /></Field>
      <Field label="장비명" required><TextInput value={form.equipment_name} onChange={(event) => setForm({ ...form, equipment_name: event.target.value })} /></Field>
      <Field label="설치 위치" required><TextInput value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field>
      <fieldset>
        <legend className="mb-1 block text-[13.5px] font-bold text-ink">대상 구분</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Checkbox
            label="교정 대상"
            checked={form.calibration_required === "REQUIRED"}
            onChange={(event) => setForm({
              ...form,
              calibration_required: event.target.checked ? "REQUIRED" : "NOT_REQUIRED",
              calibration_due_date:
                event.target.checked || form.qualification_required === "REQUIRED"
                  ? form.calibration_due_date
                  : "",
            })}
          />
          <Checkbox
            label="적격성평가 대상"
            checked={form.qualification_required === "REQUIRED"}
            onChange={(event) => setForm({
              ...form,
              qualification_required: event.target.checked ? "REQUIRED" : "NOT_REQUIRED",
              calibration_due_date:
                event.target.checked || form.calibration_required === "REQUIRED"
                  ? form.calibration_due_date
                  : "",
            })}
          />
        </div>
        <p className="mt-1 text-xs text-ink-muted">교정과 적격성평가 적용 여부를 각각 선택합니다. 어느 하나라도 대상이면 교정 유효기간이 필수입니다.</p>
      </fieldset>
      {form.calibration_required === "REQUIRED" || form.qualification_required === "REQUIRED" ? <Field label="교정 유효기간" required><TextInput required type="date" value={form.calibration_due_date} onChange={(event) => setForm({ ...form, calibration_due_date: event.target.value })} /></Field> : null}
      <Field label="사용 상태" required>
        <Select value={form.availability_status} onChange={(event) => setForm({ ...form, availability_status: event.target.value })}>
          <option value="AVAILABLE">사용가능</option><option value="SUSPENDED">사용중지</option><option value="RETIRED">폐기</option>
        </Select>
      </Field>
      <Field label="비고"><Textarea rows={3} value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} /></Field>
      {mode === "detail" ? <Field label="수정 사유" required><Textarea rows={3} value={form.modification_reason} onChange={(event) => setForm({ ...form, modification_reason: event.target.value })} /></Field> : null}
      {mode === "detail" && selected?.availability_status !== form.availability_status ? <Field label="사용 상태 변경 사유" required><Textarea rows={3} value={form.status_change_reason} onChange={(event) => setForm({ ...form, status_change_reason: event.target.value })} /></Field> : null}
    </div>
  );

  return (
    <>
      <PageTitle
        title="기준정보"
        description="장비 목록과 교정 및 적격성평가 정보, 사용 상태와 현재 점유 상태를 확인합니다."
        actions={<><Button variant="secondary" onClick={() => void load()} disabled={loading}>새로고침</Button>{canManage ? <Button onClick={openCreate}>장비 등록</Button> : null}</>}
      />
      {message ? <Banner kind={message.kind}>{message.text}</Banner> : null}
      <NoticeBox title="장비 사용 차단 기준">
        사용중지, 폐기, 교정 유효기간 경과 또는 현재 사용중인 장비는 사용 시작이 차단됩니다. 현재 점유 상태는 사용 기록 흐름에서만 변경됩니다.
      </NoticeBox>
      <Card title="장비 인벤토리">
        <div className="mb-4 flex items-end gap-3">
          <div className="w-56">
            <Field label="상태 조건">
              <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="ALL">전체</option><option value="AVAILABLE">사용가능</option><option value="SUSPENDED">사용중지</option><option value="RETIRED">폐기</option><option value="FREE">미사용</option><option value="OCCUPIED">사용중</option>
              </Select>
            </Field>
          </div>
          <Button variant="secondary" onClick={() => setFilter("ALL")}>초기화</Button>
        </div>
        <Table
          columns={[
            { label: "장비 코드", width: "120px" }, { label: "장비와 위치", width: "220px", nowrap: false },
            { label: "교정", width: "165px", nowrap: false }, { label: "적격성평가", width: "115px", align: "center" }, { label: "사용 상태", width: "110px", align: "center" },
            { label: "점유 상태", width: "105px", align: "center" }, { label: "수정 일시", width: "190px" },
            { label: "동작", width: "88px", align: "center" },
          ]}
          empty={loading ? "장비 목록을 불러오는 중입니다." : "조회된 장비가 없습니다."}
        >
          {filtered.map((row) => (
            <tr key={row.id}>
              <Td code>{row.equipment_code}</Td>
              <Td clamp={2}>{row.equipment_name}<br /><span className="text-ink-muted">{row.location}</span></Td>
              <Td clamp={2}>{CALIBRATION_LABELS[row.calibration_required] ?? row.calibration_required}{row.calibration_due_date ? ` ${row.calibration_due_date}` : ""}{isCalibrationExpired(row) ? <span className="font-semibold text-danger"> 유효기간 경과</span> : null}</Td>
              <Td align="center">{CALIBRATION_LABELS[row.qualification_required] ?? row.qualification_required}</Td>
              <Td align="center"><StatusBadge value={row.availability_status} label={AVAILABILITY_LABELS[row.availability_status] ?? row.availability_status} /></Td>
              <Td align="center"><StatusBadge value={row.occupancy_status} label={OCCUPANCY_LABELS[row.occupancy_status] ?? row.occupancy_status} /></Td>
              <Td nowrap code>{row.updated_at ? toKST(row.updated_at) : "미기록"}</Td>
              <Td align="center"><Button size="sm" variant="secondary" onClick={() => openDetail(row)}>상세</Button></Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal
        open={modalOpen}
        title={mode === "create" ? "장비 등록" : editing ? "장비 기준정보 수정" : "장비 상세"}
        size="lg"
        onClose={closeModal}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>닫기</Button>
            {mode === "detail" && canManage && !editing ? <Button onClick={() => setEditing(true)}>수정</Button> : null}
            {(mode === "create" || editing) && canManage ? <Button onClick={() => void save()} disabled={saving}>{saving ? "저장 중" : "저장"}</Button> : null}
          </>
        }
      >
        {mode === "create" || editing ? formFields : selected ? (
          <DescList
            items={[
              { label: "장비 코드", value: selected.equipment_code }, { label: "장비명", value: selected.equipment_name },
              { label: "설치 위치", value: selected.location }, { label: "교정 대상", value: CALIBRATION_LABELS[selected.calibration_required] ?? selected.calibration_required },
              { label: "적격성평가 대상", value: CALIBRATION_LABELS[selected.qualification_required] ?? selected.qualification_required }, { label: "교정 유효기간", value: selected.calibration_due_date || "해당 없음" },
              { label: "사용 상태", value: AVAILABILITY_LABELS[selected.availability_status] ?? selected.availability_status },
              { label: "현재 점유 상태", value: OCCUPANCY_LABELS[selected.occupancy_status] ?? selected.occupancy_status }, { label: "점유 기록", value: selected.occupancy_record_id || "해당 없음" },
              { label: "비고", value: selected.remarks || "해당 없음", full: true }, { label: "생성자", value: selected.created_by || "미기록" },
              { label: "생성 일시", value: selected.created_at ? toKST(selected.created_at) : "미기록" }, { label: "수정자", value: selected.updated_by || "미기록" },
              { label: "수정 일시", value: selected.updated_at ? toKST(selected.updated_at) : "미기록" },
            ]}
          />
        ) : null}
      </Modal>
    </>
  );
}
