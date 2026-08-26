import { getRows } from "@/lib/sheets";
import { normalizeEquipmentApplicability } from "@/lib/equipment";
import type { EquipmentRow, UseRecordRow } from "@/types";

import { D3_TABS } from "../approvals/_shared";

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const LOGBOOK_REVIEW_MESSAGE =
  "검토가 완료되지 않은 기록은 공식 로그북 출력 대상에 포함되지 않아야 한다.";

export type RemediationRow = Record<string, string> & {
  id: string;
  source_record_id: string;
  action_type: string;
  action_details: string;
  action_recorded_by_name: string;
  action_recorded_at: string;
};

export function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function kstCalendarDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function compactKstTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14);
}

export function buildDocumentNumber(
  equipmentCode: string,
  dateFrom: string,
  dateTo: string,
  printedAt: string,
): string {
  return `ELMS-LB-${equipmentCode}-${dateFrom.replaceAll("-", "")}-${dateTo.replaceAll("-", "")}-${compactKstTimestamp(printedAt)}`;
}

export async function loadOfficialLogbook(equipmentId: string, dateFrom: string, dateTo: string) {
  const [equipmentRows, recordRows, remediationRows] = await Promise.all([
    getRows(D3_TABS.equipment),
    getRows(D3_TABS.records),
    getRows(D3_TABS.remediations),
  ]);
  const equipment = (equipmentRows as EquipmentRow[])
    .map(normalizeEquipmentApplicability)
    .find((row) => row.id === equipmentId);
  if (!equipment) return null;

  const remediations = remediationRows as RemediationRow[];
  const records = (recordRows as UseRecordRow[])
    .filter((record) => {
      if (record.equipment_id !== equipmentId || record.record_status !== "REVIEWED") return false;
      const startedDate = kstCalendarDate(record.started_at);
      return startedDate >= dateFrom && startedDate <= dateTo;
    })
    .map((record) => ({
      ...record,
      corrective_actions: remediations
        .filter((row) => row.source_record_id === record.id)
        .sort((a, b) => a.action_recorded_at.localeCompare(b.action_recorded_at)),
    }))
    .sort((a, b) => a.started_at.localeCompare(b.started_at));

  return { equipment, records };
}
