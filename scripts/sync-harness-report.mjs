#!/usr/bin/env node

import path from "node:path";
import {
  ROOT,
  STATUS_PATH,
  RUN_STATE_PATH,
  readJsonIfExists,
  writeText,
  escapeMarkdown,
  arrayOf,
  nowKst,
  reportFingerprint
} from "./lib/harness-utils.mjs";

const state = await readJsonIfExists(STATUS_PATH);
if (!state) {
  console.error("[harness:sync] harness/state/URS_STATUS.json이 없습니다. 먼저 npm.cmd run harness:init을 실행하세요.");
  process.exit(1);
}
const runState = await readJsonIfExists(RUN_STATE_PATH, { environment: {} });
const clauses = arrayOf(state.clauses).filter((clause) => clause.kind === "functional");
const label = {
  pending: "대기",
  in_progress: "진행 중",
  implemented: "구현",
  partial: "부분",
  not_implemented: "미구현"
};
const counts = Object.fromEntries(Object.keys(label).map((key) => [key, clauses.filter((clause) => clause.status === key).length]));
const generatedAt = nowKst();
const fingerprint = reportFingerprint(clauses, runState.environment || {});

const implementedRows = clauses.map((clause) => {
  const interfaces = arrayOf(clause.interfaces).join("<br>") || "없음";
  const files = arrayOf(clause.files).join("<br>") || "없음";
  const evidence = arrayOf(clause.evidence).map((item) => `${item.kind}: ${item.ref || item.result || ""}`).join("<br>") || "없음";
  return `| ${escapeMarkdown(clause.id)} | ${escapeMarkdown(clause.summary)} | ${label[clause.status] || clause.status} | ${escapeMarkdown(interfaces)} | ${escapeMarkdown(files)} | ${escapeMarkdown(evidence)} |`;
}).join("\n");

const gaps = clauses.filter((clause) => clause.status !== "implemented");
const gapDetails = gaps.length === 0
  ? "기능 조항의 부분 구현 또는 미구현 gap이 없습니다."
  : gaps.map((clause) => {
      const blocker = clause.blocker || {};
      return `### ${clause.id}\n\n- 요구사항: ${clause.summary}\n- 상태: ${label[clause.status] || clause.status}\n- 사유: ${blocker.reason || "사유가 기록되지 않았습니다."}\n- 다음 조치: ${blocker.next_action || "다음 조치가 기록되지 않았습니다."}`;
    }).join("\n\n");

const environmentPending = clauses.flatMap((clause) => arrayOf(clause.evidence)
  .filter((item) => item.kind === "environment_pending")
  .map((item) => `- ${clause.id}: ${item.result || item.ref || "환경 검증 대기"}`));
for (const [key, value] of Object.entries(runState.environment || {})) {
  if (value !== "pass" && key !== "env_file_present") environmentPending.push(`- ${key}: ${value}`);
}

const implementedDoc = `# URS 구현 현황\n\n생성 시각: ${generatedAt}\n상태 지문: ${fingerprint}\n\n## 집계\n\n- 전체 기능 조항: ${clauses.length}\n- 구현: ${counts.implemented}\n- 부분: ${counts.partial}\n- 미구현: ${counts.not_implemented}\n- 진행 중: ${counts.in_progress}\n- 대기: ${counts.pending}\n\n## 조항별 현황\n\n| URS 조항 ID | 요구 요약 | 상태 | 화면 또는 API | 파일 | 증거 |\n|---|---|---|---|---|---|\n${implementedRows}\n\n## 미구현 및 부분 구현 항목\n\n${gapDetails}\n`;

const traceRows = clauses.map((clause) => `| ${escapeMarkdown(clause.id)} | ${escapeMarkdown(clause.summary)} | ${clause.analysis_owner || "미배정"} | ${clause.implementation_owner || "미배정"} | ${escapeMarkdown(arrayOf(clause.interfaces).join("<br>") || "없음")} | ${escapeMarkdown(arrayOf(clause.files).join("<br>") || "없음")} |`).join("\n");
const traceDoc = `# URS 추적성\n\n생성 시각: ${generatedAt}\n상태 지문: ${fingerprint}\n\n| URS 조항 ID | 요구 요약 | 분석 역할 | 구현 역할 | 화면 또는 API | 구현 파일 |\n|---|---|---|---|---|---|\n${traceRows}\n`;

const evidenceSections = clauses.map((clause) => {
  const items = arrayOf(clause.evidence);
  const lines = items.length
    ? items.map((item) => `- ${item.kind}: ${item.ref || "근거 위치 없음"}, ${item.result || "결과 설명 없음"}`).join("\n")
    : "- 기록된 증거가 없습니다.";
  return `## ${clause.id}\n\n- 상태: ${label[clause.status] || clause.status}\n- 구현 파일: ${arrayOf(clause.files).join(", ") || "없음"}\n- 화면 또는 API: ${arrayOf(clause.interfaces).join(", ") || "없음"}\n${lines}`;
}).join("\n\n");
const evidenceDoc = `# URS 구현 증거\n\n생성 시각: ${generatedAt}\n상태 지문: ${fingerprint}\n\n${evidenceSections}\n`;

const gapsDoc = `# URS gaps와 환경 검증 대기\n\n생성 시각: ${generatedAt}\n상태 지문: ${fingerprint}\n\n## 기능 gap\n\n${gapDetails}\n\n## 환경 검증 대기\n\n${environmentPending.length ? [...new Set(environmentPending)].join("\n") : "환경 검증 대기가 없습니다."}\n`;

await Promise.all([
  writeText(path.join(ROOT, "IMPLEMENTED.md"), implementedDoc),
  writeText(path.join(ROOT, "docs", "generated", "URS_TRACEABILITY.md"), traceDoc),
  writeText(path.join(ROOT, "docs", "generated", "URS_EVIDENCE.md"), evidenceDoc),
  writeText(path.join(ROOT, "docs", "generated", "URS_GAPS.md"), gapsDoc)
]);

console.log(`[harness:sync] 기능 조항 ${clauses.length}개: 구현 ${counts.implemented}, 부분 ${counts.partial}, 미구현 ${counts.not_implemented}, 진행 ${counts.in_progress}, 대기 ${counts.pending}`);
console.log("[harness:sync] IMPLEMENTED.md와 docs/generated 추적성, 증거, gaps 문서를 갱신했습니다.");
