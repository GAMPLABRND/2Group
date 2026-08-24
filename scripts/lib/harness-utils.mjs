import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const STATUS_PATH = path.join(ROOT, "harness", "state", "URS_STATUS.json");
export const RUN_STATE_PATH = path.join(ROOT, "harness", "state", "RUN_STATE.json");
export const CLAUSE_ID_RE = /\b[A-Z][A-Z0-9]{1,11}(?:-[A-Z0-9]{1,8})*-\d{2,4}\b/g;
export const TERMINAL_STATUSES = new Set(["implemented", "partial", "not_implemented"]);
export const ALL_STATUSES = new Set(["pending", "in_progress", ...TERMINAL_STATUSES]);

export function toPosix(value) {
  return value.split(path.sep).join("/");
}

export function relativeToRoot(value) {
  return toPosix(path.relative(ROOT, value));
}

export function isFunctionalId(id) {
  return /-(?:F|FR)-\d{2,4}$/.test(id);
}

export function kindFromId(id) {
  if (isFunctionalId(id)) return "functional";
  const parts = id.split("-");
  const code = parts.at(-2) || "OTHER";
  const kinds = {
    D: "data",
    DI: "data_integrity",
    AT: "audit_trail",
    T: "technical",
    I: "interface",
    N: "nonfunctional",
    E: "environment",
    EN: "environment",
    C: "constraint",
    L: "lifecycle"
  };
  return kinds[code] || "other";
}

function splitMarkdownRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, "|").trim());
}

function stripMarkdown(value) {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/[`*_>#]/g, "")
    .replace(/\[[^\]]+\]\([^\)]+\)/g, (match) => match.replace(/^\[|\]\(.+$/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function summaryFromLine(line, id, heading) {
  if (line.trim().startsWith("|")) {
    const cells = splitMarkdownRow(line);
    const index = cells.findIndex((cell) => cell.includes(id));
    if (index >= 0) {
      const candidate = cells
        .slice(index + 1)
        .map(stripMarkdown)
        .find((cell) => cell && (cell.match(CLAUSE_ID_RE) || []).length === 0 && !/^[-:]+$/.test(cell));
      if (candidate) return candidate.slice(0, 500);
    }
  }
  const withoutId = stripMarkdown(line.replaceAll(id, ""));
  return (withoutId || heading || id).slice(0, 500);
}

function occurrenceRank(line, id) {
  if (line.trim().startsWith("|")) {
    const firstCell = splitMarkdownRow(line)[0] || "";
    if ((firstCell.match(CLAUSE_ID_RE) || []).includes(id)) return 3;
  }
  const plain = stripMarkdown(line).replace(/^(?:[-+*]|\d+[.)])\s+/, "");
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`^${escapedId}(?:\\s|[:：.])`).test(plain)) return 2;
  return 1;
}

function suggestOwners(text) {
  const value = text.toLowerCase();
  const c = /(데이터 완전성|감사추적|감사 추적|보존|백업|복구|audit|integrity|retention|backup)/i.test(value);
  const a = /(역할|권한|계정|사용자 관리|사용자 등록|사용자 계정|로그인|로그아웃|비밀번호|잠금|기준정보|마스터|장비 기준|품목 기준|시약 기준|role|permission|account|password|master data)/i.test(value);
  const d3 = /(승인|검토|반려|수정 요청|전자서명|서명|출력|인쇄|문서번호|상태 전이|approval|review|signature|print|workflow)/i.test(value);
  if (c) return { analysis_owner: "analyzer-c", implementation_owner: "builder-d4" };
  if (d3) return { analysis_owner: "analyzer-b", implementation_owner: "builder-d3" };
  if (a) return { analysis_owner: "analyzer-a", implementation_owner: "builder-d1" };
  return { analysis_owner: "analyzer-b", implementation_owner: "builder-d2" };
}

export async function findRequirementFiles() {
  const dir = path.join(ROOT, "docs", "urs");
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md") && entry.name !== ".gitkeep")
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

export async function parseRequirementFiles(files = null) {
  files ??= await findRequirementFiles();
  const byId = new Map();
  const occurrences = new Map();

  for (const file of files) {
    const text = await readFile(file, "utf8");
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let heading = "";
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
      if (headingMatch) heading = stripMarkdown(headingMatch[1]);
      const ids = [...new Set(line.match(CLAUSE_ID_RE) || [])];
      for (const id of ids) {
        const source = relativeToRoot(file);
        const inferredKind = kindFromId(id);
        const rank = occurrenceRank(line, id);
        const kind = inferredKind === "other" && /^7\.1(?:\s|\.|$)/.test(heading) && rank >= 2 ? "functional" : inferredKind;
        if (kind === "other") continue;
        const occurrence = { source_file: source, source_line: index + 1 };
        const list = occurrences.get(id) || [];
        list.push(occurrence);
        occurrences.set(id, list);
        const summary = summaryFromLine(line, id, heading);
        const owner = suggestOwners(`${heading} ${summary}`);
        const candidate = {
          id,
          kind,
          summary,
          source_file: source,
          source_line: index + 1,
          section_heading: heading,
          ...owner
        };
        const previous = byId.get(id);
        const previousRank = previous?._source_rank || 0;
        if (!previous || rank > previousRank || (rank === previousRank && candidate.summary.length > previous.summary.length)) {
          byId.set(id, { ...candidate, _source_rank: rank });
        }
      }
    }
  }

  return {
    clauses: [...byId.values()]
      .map((clause) => {
        const output = { ...clause };
        delete output._source_rank;
        return output;
      })
      .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })),
    occurrences: Object.fromEntries([...occurrences.entries()])
  };
}

export async function readJsonIfExists(file, fallback = null) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8"));
}

export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, value.replace(/\r\n/g, "\n").replace(/\s+$/u, "") + "\n", "utf8");
}

export function escapeMarkdown(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

export function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

export function mergeClauseState(source, old = {}, changedAt = nowKst()) {
  const requirementChanged = Boolean(old.summary) && (old.summary !== source.summary || old.kind !== source.kind);
  const resetNote = requirementChanged
    ? `[${changedAt}] 같은 조항 ID의 URS 문구 또는 종류가 변경되어 이전 상태 ${old.status || "없음"}와 증거를 재검증 대기로 초기화함.`
    : "";
  return {
    ...source,
    analysis_owner: old.analysis_owner || source.analysis_owner,
    implementation_owner: old.implementation_owner || source.implementation_owner,
    status: requirementChanged ? "pending" : old.status || "pending",
    interfaces: requirementChanged ? [] : arrayOf(old.interfaces),
    files: requirementChanged ? [] : arrayOf(old.files),
    evidence: requirementChanged ? [] : arrayOf(old.evidence),
    blocker: requirementChanged ? null : old.blocker ?? null,
    notes: [old.notes || "", resetNote].filter(Boolean).join("\n")
  };
}

export function reportFingerprint(clauses, environment = {}) {
  const normalized = {
    clauses: arrayOf(clauses).map((clause) => ({
      id: clause.id,
      kind: clause.kind,
      summary: clause.summary,
      analysis_owner: clause.analysis_owner,
      implementation_owner: clause.implementation_owner,
      status: clause.status,
      interfaces: arrayOf(clause.interfaces),
      files: arrayOf(clause.files),
      evidence: arrayOf(clause.evidence).map((item) => ({
        kind: item?.kind,
        ref: item?.ref,
        result: item?.result
      })),
      blocker: clause.blocker ?? null,
      notes: clause.notes || ""
    })),
    environment: {
      env_file_present: Boolean(environment.env_file_present),
      sheets_smoke: environment.sheets_smoke || "not_run",
      browser_smoke: environment.browser_smoke || "not_run",
      deployment_smoke: environment.deployment_smoke || "not_run"
    }
  };
  return createHash("sha256").update(JSON.stringify(normalized), "utf8").digest("hex");
}

export function nowKst() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date()).replace(" ", "T") + "+09:00";
}
