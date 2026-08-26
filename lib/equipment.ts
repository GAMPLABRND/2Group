import { logAudit } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { updateRowById } from "@/lib/sheets";
import type { EquipmentRow } from "@/types";

export function currentKstDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isCalibrationExpired(row: Pick<EquipmentRow, "calibration_required" | "calibration_due_date">) {
  return (
    row.calibration_required === "REQUIRED" &&
    Boolean(row.calibration_due_date) &&
    row.calibration_due_date < currentKstDate()
  );
}

export function normalizeEquipmentApplicability(row: EquipmentRow): EquipmentRow {
  const calibrationRequired = row.calibration_required || "NOT_REQUIRED";
  const normalized = {
    ...row,
    calibration_required: calibrationRequired,
    qualification_required: row.qualification_required || calibrationRequired,
  };
  return {
    ...normalized,
    availability_status:
      normalized.availability_status === "AVAILABLE" && isCalibrationExpired(normalized)
        ? "SUSPENDED"
        : normalized.availability_status,
  };
}

type CalibrationReconcileGlobal = typeof globalThis & {
  __calibrationExpiryReconcile?: Promise<EquipmentRow[]>;
};

const calibrationGlobal = globalThis as CalibrationReconcileGlobal;

export async function reconcileCalibrationExpiry(rows: EquipmentRow[]): Promise<EquipmentRow[]> {
  if (calibrationGlobal.__calibrationExpiryReconcile) {
    return calibrationGlobal.__calibrationExpiryReconcile;
  }

  const reconciliation = (async () => {
    const result: EquipmentRow[] = [];
    for (const row of rows) {
      const normalized = normalizeEquipmentApplicability(row);
      if (row.availability_status === "AVAILABLE" && normalized.availability_status === "SUSPENDED") {
        const timestamp = nowISO();
        const patch = {
          availability_status: "SUSPENDED",
          updated_by: "SYSTEM",
          updated_at: timestamp,
        };
        await updateRowById("EQUIPMENT", row.id, patch);
        const after = { ...normalized, ...patch } as EquipmentRow;
        await logAudit({
          category: "DATA",
          actor: { id: "SYSTEM", name: "System", role: "SYSTEM" },
          action: "DATA.EQUIPMENT_CALIBRATION_EXPIRED",
          target: row.id,
          before: JSON.stringify(row),
          after: JSON.stringify(after),
          reason: "교정 유효기간 만료에 따른 자동 사용중지",
        });
        result.push(after);
      } else {
        result.push(normalized);
      }
    }
    return result;
  })();

  calibrationGlobal.__calibrationExpiryReconcile = reconciliation;
  try {
    return await reconciliation;
  } finally {
    delete calibrationGlobal.__calibrationExpiryReconcile;
  }
}
