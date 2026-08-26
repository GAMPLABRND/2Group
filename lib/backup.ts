import { createHash } from "node:crypto";

import { google } from "googleapis";

import { logAudit, newId } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { TAB_HEADERS } from "@/lib/schema";
import { appendMissingHeaders } from "@/lib/schema-migration";
import { appendRow, ensureTab, getRows, updateRowById } from "@/lib/sheets";
import type { BackupRun } from "@/types";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const BACKUP_SCOPE = JSON.stringify(Object.keys(TAB_HEADERS));

export type BackupActor = { id: string; name: string; role: string };

export class BackupOperationError extends Error {
  constructor(message: string, public readonly status = 503) {
    super(message);
  }
}

function driveClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

function kstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
    timeWithSeconds: `${value("hour")}-${value("minute")}-${value("second")}`,
  };
}

function rowToRun(row: Record<string, string>): BackupRun {
  return {
    id: row.id,
    backupDate: row.backup_date,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status as BackupRun["status"],
    backupScope: row.backup_scope,
    fileFormat: "XLSX",
    fileName: row.file_name,
    fileSizeBytes: Number(row.file_size_bytes || "0"),
    errorMessage: row.error_message,
    driveFileId: row.drive_file_id,
    sha256: row.sha256,
    triggerType: row.trigger_type as BackupRun["triggerType"],
    triggeredBy: row.triggered_by,
    scheduleKey: row.schedule_key,
  };
}

function runToRow(run: BackupRun) {
  return {
    id: run.id,
    backup_date: run.backupDate,
    started_at: run.startedAt,
    completed_at: run.completedAt,
    status: run.status,
    backup_scope: run.backupScope,
    file_format: run.fileFormat,
    file_name: run.fileName,
    file_size_bytes: run.fileSizeBytes,
    error_message: run.errorMessage,
    drive_file_id: run.driveFileId,
    sha256: run.sha256,
    trigger_type: run.triggerType,
    triggered_by: run.triggeredBy,
    schedule_key: run.scheduleKey,
  };
}

let backupTabsReady = false;
let backupTabsPromise: Promise<void> | null = null;

export async function ensureBackupTabs() {
  if (backupTabsReady) return;
  if (!backupTabsPromise) {
    backupTabsPromise = (async () => {
      for (const tab of ["BACKUP_SETTINGS", "BACKUP_RUNS", "BACKUP_ALARMS"] as const) {
        await ensureTab(tab, [...TAB_HEADERS[tab]]);
        await appendMissingHeaders(tab, TAB_HEADERS[tab]);
      }
      backupTabsReady = true;
    })();
  }
  try {
    await backupTabsPromise;
  } finally {
    backupTabsPromise = null;
  }
}

export async function getBackupRuns() {
  await ensureBackupTabs();
  const rows = await getRows("BACKUP_RUNS");
  return rows.map(rowToRun).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

function backupFileName(date: string, timeWithSeconds: string, runs: BackupRun[]) {
  const hasBackupForDate = runs.some((run) => run.backupDate === date && run.fileName && run.status === "COMPLETED");
  return hasBackupForDate ? `Back-up ${date}_${timeWithSeconds}.xlsx` : `Back-Up ${date}.xlsx`;
}

function safeError(error: unknown) {
  if (error instanceof BackupOperationError) return error.message;
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message.includes("File not found")) return "운영 스프레드시트에 접근할 수 없습니다.";
  if (message.includes("exportSizeLimitExceeded")) return "스프레드시트가 XLSX 내보내기 크기 제한을 초과했습니다.";
  return "Google Sheets 데이터를 XLSX 파일로 생성하지 못했습니다.";
}

async function createBackupAlarm(run: BackupRun) {
  await appendRow("BACKUP_ALARMS", {
    id: newId(),
    backup_id: run.id,
    backup_date: run.backupDate,
    started_at: run.startedAt,
    completed_at: run.completedAt,
    result: run.status,
    backup_type: run.fileFormat,
    file_name: run.fileName,
    error_message: run.errorMessage,
    drive_file_id: run.driveFileId,
    created_at: nowISO(),
  });
}

export type BackupArtifact = { run: BackupRun; bytes: Buffer };

let activeBackup: Promise<BackupArtifact> | null = null;

async function executeBackupInternal(actor: BackupActor, reason: string) {
  await ensureBackupTabs();
  const runs = await getBackupRuns();
  const recentInProgress = runs.find(
    (run) => run.status === "IN_PROGRESS" && Date.now() - Date.parse(run.startedAt) < 30 * 60 * 1000,
  );
  if (recentInProgress) throw new BackupOperationError("이미 실행 중인 백업 작업이 있습니다.", 409);

  const clock = kstParts();
  const startedAt = nowISO();
  const run: BackupRun = {
    id: newId(),
    backupDate: clock.date,
    startedAt,
    completedAt: "",
    status: "IN_PROGRESS",
    backupScope: BACKUP_SCOPE,
    fileFormat: "XLSX",
    fileName: backupFileName(clock.date, clock.timeWithSeconds, runs),
    fileSizeBytes: 0,
    errorMessage: "",
    driveFileId: "",
    sha256: "",
    triggerType: "MANUAL",
    triggeredBy: actor.id,
    scheduleKey: "",
  };
  await appendRow("BACKUP_RUNS", runToRow(run));
  await logAudit({
    category: "SYSTEM",
    actor,
    action: "SYSTEM.BACKUP_STARTED",
    target: `BACKUP:${run.id}`,
    after: JSON.stringify({ trigger_type: "MANUAL", delivery_method: "BROWSER_DOWNLOAD", file_name: run.fileName, scope: JSON.parse(BACKUP_SCOPE) }),
    reason,
  });

  try {
    const sourceId = process.env.GOOGLE_SHEET_ID || "";
    if (!sourceId) {
      throw new BackupOperationError("운영 Google Sheet ID 설정이 누락되었습니다.");
    }
    const drive = driveClient();
    const exported = await drive.files.export(
      { fileId: sourceId, mimeType: XLSX_MIME },
      { responseType: "arraybuffer" },
    );
    const bytes = Buffer.from(exported.data as ArrayBuffer);
    if (!bytes.length) throw new BackupOperationError("생성된 XLSX 백업 파일이 비어 있습니다.");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    run.completedAt = nowISO();
    run.status = "COMPLETED";
    run.fileSizeBytes = bytes.length;
    run.driveFileId = "";
    run.sha256 = sha256;
    await updateRowById("BACKUP_RUNS", run.id, runToRow(run));
    await createBackupAlarm(run);
    await logAudit({
      category: "SYSTEM",
      actor,
      action: "SYSTEM.BACKUP_COMPLETED",
      target: `BACKUP:${run.id}`,
      after: JSON.stringify({ file_name: run.fileName, file_size_bytes: run.fileSizeBytes, sha256, format: run.fileFormat, delivery_method: "BROWSER_DOWNLOAD" }),
      reason,
    });
    return { run, bytes };
  } catch (error) {
    run.completedAt = nowISO();
    run.status = "FAILED";
    run.errorMessage = safeError(error);
    try {
      await updateRowById("BACKUP_RUNS", run.id, runToRow(run));
      await createBackupAlarm(run);
      await logAudit({
        category: "SYSTEM",
        actor,
        action: "SYSTEM.BACKUP_FAILED",
        target: `BACKUP:${run.id}`,
        after: JSON.stringify({ file_name: run.fileName, format: run.fileFormat }),
        reason: run.errorMessage,
      });
    } catch {
      // The primary data store may be the failing dependency; preserve the original safe error.
    }
    throw new BackupOperationError(run.errorMessage);
  }
}

export async function executeBackup(
  actor: BackupActor,
  reason: string,
) {
  if (activeBackup) throw new BackupOperationError("이미 실행 중인 백업 작업이 있습니다.", 409);
  activeBackup = executeBackupInternal(actor, reason);
  try {
    return await activeBackup;
  } finally {
    activeBackup = null;
  }
}
