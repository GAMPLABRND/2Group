import { getRows } from "@/lib/sheets";
import type { AuditRow } from "@/types";

export type AuditFilters = {
  category: string;
  from: string;
  to: string;
  actor: string;
  action: string;
};

export async function auditActor(userId: string, role: string) {
  const users = await getRows("USERS");
  const user = users.find((row) => row.user_id === userId);
  return { id: userId, name: user?.name || userId, role };
}

const CATEGORIES = new Set(["", "SECURITY", "DATA", "SYSTEM"]);
const DATE_INPUT = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/;

export function auditFiltersFrom(input: URLSearchParams | Record<string, string | string[] | undefined>): AuditFilters {
  const value = (key: keyof AuditFilters) => {
    if (input instanceof URLSearchParams) return input.get(key)?.trim() ?? "";
    const raw = input[key];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  };
  return {
    category: value("category"),
    from: value("from"),
    to: value("to"),
    actor: value("actor"),
    action: value("action"),
  };
}

function kstBoundary(value: string, end: boolean): number | null {
  if (!value) return null;
  if (!DATE_INPUT.test(value)) throw new Error("조회 기간 형식이 올바르지 않습니다.");
  const normalized = value.includes("T")
    ? `${value.length === 16 ? `${value}:${end ? "59.999" : "00"}` : value}+09:00`
    : `${value}T${end ? "23:59:59.999" : "00:00:00.000"}+09:00`;
  const timestamp = Date.parse(normalized);
  if (Number.isNaN(timestamp)) throw new Error("조회 기간 형식이 올바르지 않습니다.");
  return timestamp;
}

export function validateAuditFilters(filters: AuditFilters) {
  if (!CATEGORIES.has(filters.category)) throw new Error("지원하지 않는 감사추적 분류입니다.");
  const from = kstBoundary(filters.from, false);
  const to = kstBoundary(filters.to, true);
  if (from !== null && to !== null && from > to) {
    throw new Error("조회 시작 일시는 종료 일시보다 늦을 수 없습니다.");
  }
  return { from, to };
}

function asAuditRow(row: Record<string, string>): AuditRow {
  return {
    id: row.id ?? "",
    category: row.category ?? "",
    actor_id: row.actor_id ?? "",
    actor_name: row.actor_name ?? "",
    role: row.role ?? "",
    action: row.action ?? "",
    target: row.target ?? "",
    before_value: row.before_value ?? "",
    after_value: row.after_value ?? "",
    reason: row.reason ?? "",
    timestamp_kst: row.timestamp_kst ?? "",
  };
}

export async function queryAudit(filters: AuditFilters): Promise<AuditRow[]> {
  const range = validateAuditFilters(filters);
  const rows = (await getRows("AUDIT")).map(asAuditRow);
  const actor = filters.actor.toLocaleLowerCase("ko-KR");
  const action = filters.action.toLocaleLowerCase("ko-KR");
  return rows
    .filter((row) => {
      const at = Date.parse(row.timestamp_kst);
      if (filters.category && row.category !== filters.category) return false;
      if (actor && !`${row.actor_id} ${row.actor_name}`.toLocaleLowerCase("ko-KR").includes(actor)) return false;
      if (action && !row.action.toLocaleLowerCase("ko-KR").includes(action)) return false;
      if (range.from !== null && (Number.isNaN(at) || at < range.from)) return false;
      if (range.to !== null && (Number.isNaN(at) || at > range.to)) return false;
      return true;
    })
    .sort((a, b) => Date.parse(b.timestamp_kst) - Date.parse(a.timestamp_kst));
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function auditCsv(rows: AuditRow[]): string {
  const headers: (keyof AuditRow)[] = [
    "id", "category", "actor_id", "actor_name", "role", "action", "target",
    "before_value", "after_value", "reason", "timestamp_kst",
  ];
  return `\uFEFF${[
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\r\n")}`;
}
