import { appendRow, ensureTab } from "@/lib/sheets";
import { nowISO } from "@/lib/kst";
import type { AuditCategory } from "@/types";

export const AUDIT_TAB = "AUDIT";
export const AUDIT_HEADER = [
  "id",
  "category",
  "actor_id",
  "actor_name",
  "role",
  "action",
  "target",
  "before_value",
  "after_value",
  "reason",
  "timestamp_kst",
];

/** 행 id 규칙: 타임스탬프+난수 (CLAUDE.md STEP 2 시트 스키마 규칙). 모든 탭에서 이 함수를 쓴다. */
export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type AuditEntry = {
  category: AuditCategory;
  actor: { id: string; name?: string; role?: string };
  action: string;
  target?: string;
  before?: string;
  after?: string;
  reason?: string;
};

/** AUDIT 탭에 1행 append. 탭 생성 재시도 뒤에도 실패하면 변경 API가 성공을 보고하지 않도록 오류를 전달한다. */
export async function logAudit(e: AuditEntry) {
  const row = {
    id: newId(),
    category: e.category,
    actor_id: e.actor.id,
    actor_name: e.actor.name ?? "",
    role: e.actor.role ?? "",
    action: e.action,
    target: e.target ?? "",
    before_value: e.before ?? "",
    after_value: e.after ?? "",
    reason: e.reason ?? "",
    timestamp_kst: nowISO(),
  };
  try {
    await appendRow(AUDIT_TAB, row);
  } catch {
    try {
      await ensureTab(AUDIT_TAB, AUDIT_HEADER);
      await appendRow(AUDIT_TAB, row);
    } catch (err) {
      console.error("[audit] 감사추적 기록 실패:", err);
      throw err;
    }
  }
}
