import { getRows } from "@/lib/sheets";
import { reconcileCalibrationExpiry } from "@/lib/equipment";
import type { EquipmentRow, UseRecordRow } from "@/types";

export type EquipmentStatistic = { equipmentId: string; equipmentCode: string; equipmentName: string; endedCount: number; abnormalCount: number; abnormalRate: string };
export type UsageTypeStatistic = {
  usageType: string;
  count: number;
  durationHours: string;
  abnormalCount: number;
  abnormalRate: string;
};
export type EquipmentUsageTypeStatistic = EquipmentStatistic & { usageTypeStatistics: UsageTypeStatistic[] };

function kstDateString(date = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function isCalibrationRequired(row: Record<string, string>) { return ["REQUIRED", "Y", "필수"].includes(row.calibration_required); }
function isAbnormal(row: Record<string, string>) { return ["ABNORMAL", "이상"].includes(row.after_use_status); }
function isEnded(row: Record<string, string>) { return Boolean(row.ended_at) && !["IN_USE", "INVALID", "사용중", "무효"].includes(row.record_status); }
function durationMs(row: Record<string, string>, now: number) { const started = Date.parse(row.started_at); const ended = row.ended_at ? Date.parse(row.ended_at) : now; return Number.isNaN(started) || Number.isNaN(ended) || ended < started ? 0 : ended - started; }
function summarizeUsage(rows: UseRecordRow[], equipmentId: string | undefined, now: number): UsageTypeStatistic[] {
  const map = new Map<string, { count: number; duration: number; abnormalCount: number }>();
  for (const row of rows) { if (equipmentId && row.equipment_id !== equipmentId) continue; if (["INVALID", "무효"].includes(row.record_status)) continue; const key = row.usage_type || "미지정"; const current = map.get(key) ?? { count: 0, duration: 0, abnormalCount: 0 }; current.count += 1; current.duration += durationMs(row, now); if (isAbnormal(row)) current.abnormalCount += 1; map.set(key, current); }
  return [...map.entries()].map(([usageType, value]) => ({
    usageType,
    count: value.count,
    durationHours: (value.duration / 3_600_000).toFixed(1),
    abnormalCount: value.abnormalCount,
    abnormalRate: value.count ? `${((value.abnormalCount / value.count) * 100).toFixed(1)}%` : "0%",
  })).sort((a, b) => b.count - a.count || a.usageType.localeCompare(b.usageType, "ko-KR"));
}

export async function getEquipmentUsageStatistics(equipmentId: string, startDate: string, endDate: string) {
  const [equipmentRows, useRows] = await Promise.all([getRows("EQUIPMENT"), getRows("USE_RECORDS")]);
  const equipment = await reconcileCalibrationExpiry(equipmentRows as EquipmentRow[]);
  const selected = equipment.find((item) => item.id === equipmentId);
  if (!selected) return { equipment: equipment.map((item) => ({ id: item.id, code: item.equipment_code, name: item.equipment_name })), selected: null, statistics: [] as UsageTypeStatistic[] };
  const start = startDate ? Date.parse(`${startDate}T00:00:00+09:00`) : Number.NEGATIVE_INFINITY;
  const end = endDate ? Date.parse(`${endDate}T23:59:59.999+09:00`) : Number.POSITIVE_INFINITY;
  const rows = (useRows as UseRecordRow[]).filter((row) => { const timestamp = Date.parse(row.started_at); return row.equipment_id === equipmentId && !["INVALID", "무효"].includes(row.record_status) && !Number.isNaN(timestamp) && timestamp >= start && timestamp <= end; });
  return { equipment: equipment.map((item) => ({ id: item.id, code: item.equipment_code, name: item.equipment_name })), selected: { id: selected.id, code: selected.equipment_code, name: selected.equipment_name, startDate, endDate }, statistics: summarizeUsage(rows, equipmentId, Date.now()) };
}

export async function getDashboardData() {
  const [equipmentRows, useRows] = await Promise.all([getRows("EQUIPMENT"), getRows("USE_RECORDS")]);
  const equipment = await reconcileCalibrationExpiry(equipmentRows as EquipmentRow[]); const uses = useRows as UseRecordRow[]; const today = kstDateString(); const now = Date.now();
  const counts = { total: equipment.length, available: equipment.filter((row) => row.availability_status === "AVAILABLE" && row.occupancy_status === "FREE").length, inUse: equipment.filter((row) => row.occupancy_status === "OCCUPIED").length, suspended: equipment.filter((row) => row.availability_status === "SUSPENDED").length, retired: equipment.filter((row) => row.availability_status === "RETIRED").length, calibrationExpired: equipment.filter((row) => isCalibrationRequired(row) && row.calibration_due_date && row.calibration_due_date < today).length };
  const equipmentStatistics: EquipmentStatistic[] = equipment.map((item) => { const ended = uses.filter((row) => row.equipment_id === item.id && isEnded(row)); const abnormalCount = ended.filter(isAbnormal).length; return { equipmentId: item.id, equipmentCode: item.equipment_code, equipmentName: item.equipment_name, endedCount: ended.length, abnormalCount, abnormalRate: ended.length ? `${((abnormalCount / ended.length) * 100).toFixed(1)}%` : "0.0%" }; });
  const usageTypeStatistics = summarizeUsage(uses, undefined, now);
  const equipmentUsageTypeStatistics = equipment.map((item) => ({ ...equipmentStatistics.find((statistic) => statistic.equipmentId === item.id)!, usageTypeStatistics: summarizeUsage(uses, item.id, now) }));
  return { counts, equipment, equipmentStatistics, usageTypeStatistics, equipmentUsageTypeStatistics, calculatedAt: new Date().toISOString() };
}
