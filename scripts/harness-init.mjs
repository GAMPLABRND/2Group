#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import {
  ROOT,
  STATUS_PATH,
  RUN_STATE_PATH,
  findRequirementFiles,
  parseRequirementFiles,
  readJsonIfExists,
  writeJson,
  arrayOf,
  nowKst,
  mergeClauseState
} from "./lib/harness-utils.mjs";

const files = await findRequirementFiles();
if (files.length === 0) {
  console.error("[harness:init] docs/urs/에 변환된 URS Markdown이 없습니다. URS .docx 또는 .md를 넣고 다시 실행하세요.");
  process.exit(1);
}

const parsed = await parseRequirementFiles(files);
const functional = parsed.clauses.filter((clause) => clause.kind === "functional");
if (functional.length === 0) {
  console.error("[harness:init] 기능 조항 ID를 찾지 못했습니다. URS 표 첫 열의 URS-F-nnn 또는 *-FR-nnn 텍스트를 확인하세요.");
  process.exit(1);
}

const crossFileDuplicates = Object.entries(parsed.occurrences)
  .map(([id, occurrences]) => ({ id, files: [...new Set(occurrences.map((item) => item.source_file))] }))
  .filter((item) => item.files.length > 1);
if (crossFileDuplicates.length > 0) {
  console.error("[harness:init] 서로 다른 URS 파일에 같은 조항 ID가 있습니다:");
  for (const item of crossFileDuplicates) console.error(`  - ${item.id}: ${item.files.join(", ")}`);
  process.exit(1);
}

const previous = await readJsonIfExists(STATUS_PATH, { clauses: [], retired_clauses: [] });
const previousById = new Map(arrayOf(previous.clauses).map((clause) => [clause.id, clause]));
const currentIds = new Set(parsed.clauses.map((clause) => clause.id));
const retired = [
  ...arrayOf(previous.retired_clauses).filter((clause) => !currentIds.has(clause.id)),
  ...arrayOf(previous.clauses)
    .filter((clause) => !currentIds.has(clause.id))
    .map((clause) => ({ ...clause, retired_at: nowKst() }))
];

const clauses = parsed.clauses.map((source) => {
  return mergeClauseState(source, previousById.get(source.id) || {});
});

const now = nowKst();
const state = {
  schema_version: 1,
  harness_version: "3.0.0",
  created_at: previous.created_at || now,
  updated_at: now,
  source_files: files.map((file) => path.relative(ROOT, file).split(path.sep).join("/")),
  counts: {
    total: clauses.length,
    functional: clauses.filter((clause) => clause.kind === "functional").length,
    supplemental: clauses.filter((clause) => clause.kind !== "functional").length
  },
  clauses,
  retired_clauses: retired
};

await writeJson(STATUS_PATH, state);

if (!existsSync(RUN_STATE_PATH)) {
  await writeJson(RUN_STATE_PATH, {
    harness_version: "3.0.0",
    mode: "one_shot_build",
    phase: "analysis",
    status: "in_progress",
    last_completed_step: "STEP_0",
    next_action: "Run analyzer roles",
    environment: {
      env_file_present: existsSync(path.join(ROOT, ".env.local")),
      sheets_smoke: "not_run",
      browser_smoke: "not_run",
      deployment_smoke: "not_run"
    }
  });
}

const byAnalysis = Object.groupBy(clauses.filter((clause) => clause.kind === "functional"), (clause) => clause.analysis_owner);
const byBuilder = Object.groupBy(clauses.filter((clause) => clause.kind === "functional"), (clause) => clause.implementation_owner);
console.log(`[harness:init] URS 파일 ${files.length}개, 전체 조항 ${clauses.length}개, 기능 조항 ${functional.length}개`);
console.log(`[harness:init] 분석 배정: ${Object.entries(byAnalysis).map(([key, value]) => `${key} ${value.length}`).join(", ")}`);
console.log(`[harness:init] 구현 배정: ${Object.entries(byBuilder).map(([key, value]) => `${key} ${value.length}`).join(", ")}`);
console.log(`[harness:init] 상태 파일: ${path.relative(ROOT, STATUS_PATH)}`);
