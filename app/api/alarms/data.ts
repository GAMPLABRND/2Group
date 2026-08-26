import { getRows } from "@/lib/sheets";
import { reconcileCalibrationExpiry } from "@/lib/equipment";
import { ensureBackupTabs } from "@/lib/backup";
import type { EquipmentRow } from "@/types";

function currentKstDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function dayDifference(date: string, today: string) {
  return Math.floor((Date.parse(`${date}T00:00:00+09:00`) - Date.parse(`${today}T00:00:00+09:00`)) / 86_400_000);
}

function required(value: string) {
  return ["REQUIRED", "Y", "대상"].includes(value);
}

function abnormal(value: string) {
  return ["ABNORMAL", "이상"].includes(value);
}

export async function getAlarmData(includeBackup = false) {
  if (includeBackup) await ensureBackupTabs();
  const [equipmentRows, uses, remediations, requests, users, settings, audit, backupAlarmRows] = await Promise.all([
    getRows("EQUIPMENT"),
    getRows("USE_RECORDS"),
    getRows("EQUIPMENT_REMEDIATIONS"),
    getRows("EQUIPMENT_RESUME_REQUESTS"),
    getRows("USERS"),
    getRows("SECURITY_SETTINGS"),
    getRows("AUDIT"),
    includeBackup ? getRows("BACKUP_ALARMS") : Promise.resolve([]),
  ]);
  const equipment = await reconcileCalibrationExpiry(equipmentRows as EquipmentRow[]);
  const today = currentKstDate();
  const equipmentById = new Map(equipment.map((row) => [row.id, row]));
  const maxFailures = Number(settings[0]?.max_failed_login_attempts || "5");

  const calibration = equipment
    .filter((row) => required(row.calibration_required) && row.calibration_due_date)
    .map((row) => ({
      id: row.id,
      equipmentCode: row.equipment_code,
      equipmentName: row.equipment_name,
      dueDate: row.calibration_due_date,
      daysRemaining: dayDifference(row.calibration_due_date, today),
    }))
    .filter((row) => row.daysRemaining <= 90)
    .map((row) => ({ ...row, severity: row.daysRemaining < 0 ? "EXPIRED" : "EXPIRING" }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const abnormalHistory = uses
    .filter((row) => abnormal(row.after_use_status))
    .map((row) => {
      const item = equipmentById.get(row.equipment_id);
      const actions = remediations
        .filter((action) => action.source_record_id === row.id)
        .sort((a, b) => Date.parse(a.action_recorded_at) - Date.parse(b.action_recorded_at));
      const decisions = requests
        .filter((request) => request.source_record_id === row.id)
        .sort((a, b) => Number(a.request_sequence || "0") - Number(b.request_sequence || "0"));
      const latestAction = actions.at(-1);
      const latestDecision = decisions.at(-1);
      return {
        id: row.id,
        equipmentCode: row.equipment_code || item?.equipment_code || row.equipment_id,
        equipmentName: row.equipment_name || item?.equipment_name || "",
        endedAt: row.ended_at,
        abnormalityDetails: row.abnormality_details,
        latestAction: latestAction?.action_details || "조치 미등록",
        actionAt: latestAction?.action_recorded_at || "",
        latestResumeStatus: latestDecision?.resume_status || "재개 요청 없음",
        latestDecisionAt: latestDecision?.confirmed_at || latestDecision?.requested_at || "",
        rejectionReason: latestDecision?.rejection_reason || "",
        decisions: decisions.map((decision) => ({
          id: decision.id,
          status: decision.resume_status,
          requestedAt: decision.requested_at,
          confirmedAt: decision.confirmed_at,
          confirmedBy: decision.confirmed_by_name || decision.confirmed_by_id,
          rejectionReason: decision.rejection_reason,
        })),
      };
    })
    .sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));

  const suspended = equipment
    .filter((row) => ["SUSPENDED", "사용중지"].includes(row.availability_status))
    .map((row) => ({
      id: row.id,
      equipmentCode: row.equipment_code,
      equipmentName: row.equipment_name,
      occupancyStatus: row.occupancy_status,
      updatedAt: row.updated_at,
      remarks: row.remarks,
    }));

  const security = users
    .filter((row) => Boolean(row.locked_at) || Number(row.failed_login_count || "0") >= maxFailures)
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      role: row.role,
      failedCount: Number(row.failed_login_count || "0"),
      lockedAt: row.locked_at,
    }));

  const deniedByActor = new Map<string, { actorId: string; actorName: string; role: string; count: number; latestAt: string; latestTarget: string }>();
  for (const row of audit.filter(
    (item) => item.category === "SECURITY" && ["SECURITY.ACCESS_DENIED", "UNAUTHORIZED_ACCESS"].includes(item.action),
  )) {
    const key = row.actor_id || "UNKNOWN";
    const current = deniedByActor.get(key) ?? {
      actorId: key,
      actorName: row.actor_name || key,
      role: row.role || "ANONYMOUS",
      count: 0,
      latestAt: "",
      latestTarget: "",
    };
    current.count += 1;
    if (!current.latestAt || Date.parse(row.timestamp_kst) >= Date.parse(current.latestAt)) {
      current.latestAt = row.timestamp_kst;
      current.latestTarget = row.target;
      current.actorName = row.actor_name || current.actorName;
      current.role = row.role || current.role;
    }
    deniedByActor.set(key, current);
  }
  const accessWarnings = [...deniedByActor.values()]
    .filter((item) => item.count >= maxFailures)
    .sort((a, b) => Date.parse(b.latestAt) - Date.parse(a.latestAt));

  const backup = backupAlarmRows
    .map((row) => ({
      id: row.id,
      backupId: row.backup_id,
      backupDate: row.backup_date,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      result: row.result,
      backupType: row.backup_type,
      fileName: row.file_name,
      errorMessage: row.error_message,
      downloadable: false,
    }))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));

  return { calibration, abnormalHistory, suspended, security, accessWarnings, backup, maxFailures, calculatedAt: new Date().toISOString() };
}
