import { getAlarmData } from "@/app/api/alarms/data";
import { newId } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { TAB_HEADERS } from "@/lib/schema";
import { appendMissingHeaders } from "@/lib/schema-migration";
import { appendRow, ensureTab, getRows } from "@/lib/sheets";
import type { Role } from "@/types";

export type UnreadAlarm = {
  key: string;
  occurredAt: string;
  type: string;
  target: string;
  content: string;
  detailHref: string;
};

let alarmAckTabPromise: Promise<void> | null = null;

async function ensureAlarmAckTab() {
  if (!alarmAckTabPromise) {
    alarmAckTabPromise = (async () => {
      await ensureTab("ALARM_ACKS", [...TAB_HEADERS.ALARM_ACKS]);
      await appendMissingHeaders("ALARM_ACKS", TAB_HEADERS.ALARM_ACKS);
    })().catch((error) => {
      alarmAckTabPromise = null;
      throw error;
    });
  }
  await alarmAckTabPromise;
}

function alarmTimestamp(value: string, fallback: string) {
  return value || fallback;
}

export async function getCurrentAlarmNotifications(role: Role): Promise<UnreadAlarm[]> {
  const data = await getAlarmData(role === "ADMIN");
  const fallback = data.calculatedAt;
  const alarms: UnreadAlarm[] = [
    ...data.calibration.map((row) => ({
      key: `CALIBRATION:${row.id}:${row.severity}:${row.dueDate}`,
      occurredAt: `${row.dueDate}T00:00:00+09:00`,
      type: row.severity === "EXPIRED" ? "교정 만료" : "교정 만료 임박",
      target: `${row.equipmentCode} / ${row.equipmentName}`,
      content: row.daysRemaining < 0
        ? `교정 유효기간이 ${Math.abs(row.daysRemaining)}일 경과했습니다.`
        : `교정 유효기간이 ${row.daysRemaining}일 남았습니다.`,
      detailHref: "/equipment",
    })),
    ...data.suspended.map((row) => ({
      key: `SUSPENDED:${row.id}:${row.updatedAt}`,
      occurredAt: alarmTimestamp(row.updatedAt, fallback),
      type: "장비 사용중지",
      target: `${row.equipmentCode} / ${row.equipmentName}`,
      content: row.remarks || "장비가 사용불가 상태로 전환되었습니다.",
      detailHref: "/equipment",
    })),
    ...data.abnormalHistory.map((row) => ({
      key: `ABNORMAL:${row.id}:${row.endedAt}`,
      occurredAt: alarmTimestamp(row.endedAt, fallback),
      type: "이상 발생",
      target: `${row.equipmentCode} / ${row.equipmentName}`,
      content: row.abnormalityDetails || "장비 사용 종료 시 이상 상태가 기록되었습니다.",
      detailHref: `/records/${encodeURIComponent(row.id)}`,
    })),
  ];

  if (role === "ADMIN") {
    alarms.push(
      ...data.security.map((row) => ({
        key: `SECURITY:${row.id}:${row.lockedAt}:${row.failedCount}`,
        occurredAt: alarmTimestamp(row.lockedAt, fallback),
        type: "계정 잠금",
        target: `${row.name} / ${row.userId}`,
        content: `로그인 실패 ${row.failedCount}회로 계정 확인이 필요합니다.`,
        detailHref: "/admin",
      })),
      ...data.accessWarnings.map((row) => ({
        key: `ACCESS:${row.actorId}:${row.latestAt}:${row.count}`,
        occurredAt: alarmTimestamp(row.latestAt, fallback),
        type: "권한 없는 접근 반복",
        target: `${row.actorName} / ${row.actorId}`,
        content: `${row.count}회 발생, 최근 대상: ${row.latestTarget || "해당 없음"}`,
        detailHref: "/audit",
      })),
      ...data.backup.map((row) => ({
        key: `BACKUP:${row.id}`,
        occurredAt: alarmTimestamp(row.completedAt, fallback),
        type: row.result === "COMPLETED" ? "백업 완료" : "백업 실패",
        target: row.fileName || `백업 ${row.backupDate}`,
        content: row.errorMessage || "서버 보호 저장소에 백업본 생성이 완료되었습니다.",
        detailHref: "/backup",
      })),
    );
  }

  return alarms.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export async function getUnreadAlarms(role: Role, userId: string) {
  await ensureAlarmAckTab();
  const [alarms, acknowledgements] = await Promise.all([
    getCurrentAlarmNotifications(role),
    getRows("ALARM_ACKS"),
  ]);
  const acknowledged = new Set(
    acknowledgements.filter((row) => row.user_id === userId).map((row) => row.alarm_key),
  );
  return alarms.filter((alarm) => !acknowledged.has(alarm.key));
}

export async function acknowledgeAlarm(role: Role, userId: string, alarmKey: string) {
  const key = alarmKey.trim();
  if (!key) throw new Error("확인할 알람 키가 필요합니다.");
  await ensureAlarmAckTab();
  const [alarms, acknowledgements] = await Promise.all([
    getCurrentAlarmNotifications(role),
    getRows("ALARM_ACKS"),
  ]);
  const alarm = alarms.find((item) => item.key === key);
  if (!alarm) throw new Error("현재 조회 가능한 알람이 아닙니다.");
  const existing = acknowledgements.find((row) => row.user_id === userId && row.alarm_key === key);
  if (existing) return { alarm, acknowledgedAt: existing.acknowledged_at, created: false };

  const timestamp = nowISO();
  await appendRow("ALARM_ACKS", {
    id: newId(),
    alarm_key: key,
    user_id: userId,
    acknowledged_at: timestamp,
    alarm_type: alarm.type,
    target: alarm.target,
    created_at: timestamp,
  });
  return { alarm, acknowledgedAt: timestamp, created: true };
}
