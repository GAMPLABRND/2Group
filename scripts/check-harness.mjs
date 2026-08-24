#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import {
  ROOT,
  STATUS_PATH,
  RUN_STATE_PATH,
  ALL_STATUSES,
  findRequirementFiles,
  parseRequirementFiles,
  readJsonIfExists,
  arrayOf,
  reportFingerprint
} from "./lib/harness-utils.mjs";

const finalMode = process.argv.includes("--final");
const errors = [];
const warnings = [];
const pass = [];
let finalRunState = null;

function requireFile(relative) {
  const absolute = path.join(ROOT, relative);
  if (!existsSync(absolute)) errors.push(`필수 파일 없음: ${relative}`);
  return absolute;
}

async function walkTextFiles(dir, output = []) {
  if (!existsSync(dir)) return output;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "out"].includes(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkTextFiles(absolute, output);
    else if (/\.(md|json|mjs|toml|ts|tsx|css)$/i.test(entry.name) || entry.name === ".gitignore") output.push(absolute);
  }
  return output;
}

const manifestPath = requireFile("harness/intent-manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, "utf8")) : { required_roles: [], intents: [] };
const structural = [
  ".codex/config.toml",
  "AGENTS.md",
  "README.md",
  "CLAUDE.md",
  "design.md",
  "harness/WORKFLOW.md",
  "harness/ORCHESTRATION.md",
  "harness/QUALITY_GATES.md",
  "harness/OUTPUT_CONTRACTS.md",
  "harness/SUBAGENT_CONTRACT.md",
  "scripts/harness-init.mjs",
  "scripts/test-harness-parser.mjs",
  "scripts/test-harness-gate.mjs",
  "scripts/check-harness.mjs",
  "scripts/sync-harness-report.mjs",
  "scripts/render-agent-prompt.mjs",
  "scripts/check-sheets.mjs",
  "scripts/check-commit.mjs",
  "scripts/build-fds.mjs",
  "docs/FDS_GUIDE.md",
  "docs/FDS_TEMPLATE.md",
  "docs/DRAFTS.md",
  "docs/SETUP_강사용.md",
  "docs/RUNBOOK_당일운영.md",
  "docs/GUIDE_실습흐름_URS에서VSR까지.md"
];
for (const relative of structural) requireFile(relative);

const nativeRoleNames = {
  "analyzer-a": "analyzer_a",
  "analyzer-b": "analyzer_b",
  "analyzer-c": "analyzer_c",
  "builder-d1": "builder_d1",
  "builder-d2": "builder_d2",
  "builder-d3": "builder_d3",
  "builder-d4": "builder_d4"
};
const expectedRoleModels = {
  "analyzer-a": { model: "gpt-5.6-terra", effort: "xhigh" },
  "analyzer-b": { model: "gpt-5.6-terra", effort: "xhigh" },
  "analyzer-c": { model: "gpt-5.6-terra", effort: "xhigh" },
  "builder-d1": { model: "gpt-5.6-sol", effort: "high" },
  "builder-d2": { model: "gpt-5.6-sol", effort: "high" },
  "builder-d3": { model: "gpt-5.6-sol", effort: "high" },
  "builder-d4": { model: "gpt-5.6-sol", effort: "high" }
};
let roleModelRoutingValid = true;
for (const role of manifest.required_roles || []) {
  requireFile(`agents/${role}.md`);
  const tomlPath = requireFile(`.codex/agents/${role}.toml`);
  if (!existsSync(tomlPath)) continue;
  const toml = await readFile(tomlPath, "utf8");
  const expectedName = nativeRoleNames[role];
  if (!expectedName || !new RegExp(`^name\\s*=\\s*["']${expectedName}["']`, "m").test(toml)) errors.push(`${role}: Codex 사용자 정의 역할 name이 올바르지 않습니다.`);
  if (!/^description\s*=\s*["']/m.test(toml)) errors.push(`${role}: Codex 사용자 정의 역할 description이 없습니다.`);
  if (!/^developer_instructions\s*=\s*"""[\s\S]+"""\s*$/m.test(toml)) errors.push(`${role}: Codex 사용자 정의 역할 developer_instructions가 없습니다.`);
  const expectedRouting = expectedRoleModels[role];
  const configuredModel = toml.match(/^model\s*=\s*["']([^"']+)["']\s*$/m)?.[1];
  const configuredEffort = toml.match(/^model_reasoning_effort\s*=\s*["']([^"']+)["']\s*$/m)?.[1];
  if (!expectedRouting || configuredModel !== expectedRouting.model || configuredEffort !== expectedRouting.effort) {
    roleModelRoutingValid = false;
    errors.push(`${role}: 모델 라우팅은 ${expectedRouting?.model || "정의 없음"}/${expectedRouting?.effort || "정의 없음"}여야 합니다.`);
  }
  if (configuredModel?.includes("luna")) {
    roleModelRoutingValid = false;
    errors.push(`${role}: Luna 계열 모델은 이 하네스에서 허용되지 않습니다.`);
  }
}
const codexConfigPath = path.join(ROOT, ".codex", "config.toml");
if (existsSync(codexConfigPath)) {
  const config = await readFile(codexConfigPath, "utf8");
  if (!/^\[agents\]\s*$/m.test(config) || !/^enabled\s*=\s*true\s*$/m.test(config)) errors.push(".codex/config.toml에서 Codex 서브에이전트가 활성화되지 않았습니다.");
  const threads = Number(config.match(/^max_concurrent_threads_per_session\s*=\s*(\d+)\s*$/m)?.[1] || 0);
  if (threads !== 7) errors.push(".codex/config.toml의 열린 자식 역할 스레드 상한은 v2 역할 수와 같은 7이어야 합니다.");
  const parentModel = config.match(/^model\s*=\s*["']([^"']+)["']\s*$/m)?.[1];
  const parentEffort = config.match(/^model_reasoning_effort\s*=\s*["']([^"']+)["']\s*$/m)?.[1];
  const defaultModel = config.match(/^default_subagent_model\s*=\s*["']([^"']+)["']\s*$/m)?.[1];
  const defaultEffort = config.match(/^default_subagent_reasoning_effort\s*=\s*["']([^"']+)["']\s*$/m)?.[1];
  if (parentModel !== "gpt-5.6-sol" || parentEffort !== "high") errors.push(".codex/config.toml의 오케스트레이터 모델은 gpt-5.6-sol/high여야 합니다.");
  if (defaultModel !== "gpt-5.6-terra" || defaultEffort !== "low") errors.push(".codex/config.toml의 보조 서브에이전트 기본값은 gpt-5.6-terra/low여야 합니다.");
  if ([parentModel, defaultModel].some((value) => value?.includes("luna"))) errors.push(".codex/config.toml에 Luna 계열 모델을 설정할 수 없습니다.");
  if (roleModelRoutingValid && parentModel === "gpt-5.6-sol" && parentEffort === "high" && defaultModel === "gpt-5.6-terra" && defaultEffort === "low") {
    pass.push("Codex 모델 라우팅: 오케스트레이터와 Builder Sol/high, Analyzer Terra/xhigh, 보조 Terra/low, Luna 미사용");
  }
}
for (const intent of manifest.intents || []) {
  if (!intent.id || !intent.name || !Array.isArray(intent.evidence_files) || intent.evidence_files.length === 0) {
    errors.push(`의도 매니페스트 항목 형식 오류: ${JSON.stringify(intent)}`);
    continue;
  }
  for (const evidence of intent.evidence_files) requireFile(evidence);
}

const agentsPath = path.join(ROOT, "AGENTS.md");
if (existsSync(agentsPath)) {
  const text = await readFile(agentsPath, "utf8");
  const baseText = text.replace(/\n*<!-- BEGIN:nextjs-agent-rules -->[\s\S]*?<!-- END:nextjs-agent-rules -->\n*/g, "\n");
  const baseSize = Buffer.byteLength(baseText, "utf8");
  const totalSize = statSync(agentsPath).size;
  if (baseSize > 20 * 1024) errors.push(`AGENTS.md 본문이 ${baseSize}바이트로 v3 목표 20KiB를 넘습니다. 상세 규칙을 harness/로 분리하세요.`);
  if (totalSize > 32 * 1024) errors.push(`AGENTS.md 전체가 ${totalSize}바이트로 Codex 기본 32KiB 한도를 넘습니다. nextjs-agent-rules 블록을 제거하거나 지시를 더 분리하세요.`);
  if (baseSize <= 20 * 1024 && totalSize <= 32 * 1024) pass.push(`AGENTS.md 본문 ${baseSize}바이트, 전체 ${totalSize}바이트`);
}

const packagePath = requireFile("package.json");
if (existsSync(packagePath)) {
  const pkg = JSON.parse(await readFile(packagePath, "utf8"));
  const requiredScripts = ["harness:init", "harness:sync", "check:harness", "test:harness", "test:harness:gate", "agent:prompt", "check:sheets", "check:commit", "fds"];
  for (const name of requiredScripts) if (!pkg.scripts?.[name]) errors.push(`package.json script 없음: ${name}`);
  if (!String(pkg.name || "").includes("v3")) errors.push("package.json name에 v3 식별자가 없습니다.");
}

const textFiles = await walkTextFiles(ROOT);
for (const file of textFiles) {
  const relative = path.relative(ROOT, file).split(path.sep).join("/");
  if (relative.startsWith("docs/urs/") || relative.startsWith("docs/generated/") || relative.startsWith("harness/state/") || relative.startsWith("harness/runs/")) continue;
  const text = await readFile(file, "utf8");
  if (relative === "scripts/check-harness.mjs") continue;
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.includes("codex --full-auto")) continue;
    if (!/(지원되지|지원하지|폐기|제거|인식되지|과거)/.test(line)) errors.push(`폐기된 Codex 시작 명령이 남아 있습니다: ${relative}: ${line.trim()}`);
  }
  if (/^tools:\s*(Read|Write|Edit|Grep|Glob)/m.test(text)) errors.push(`Claude 역할 frontmatter가 남아 있습니다: ${relative}`);
}

const claudePath = path.join(ROOT, "CLAUDE.md");
if (existsSync(claudePath)) {
  const text = await readFile(claudePath, "utf8");
  if (!text.includes("AGENTS.md") || !text.includes("호환")) errors.push("CLAUDE.md는 AGENTS.md를 가리키는 호환 안내문이어야 합니다.");
}

const state = await readJsonIfExists(STATUS_PATH);
if (!state) {
  if (finalMode) errors.push("최종 게이트에 필요한 harness/state/URS_STATUS.json이 없습니다.");
  else pass.push("템플릿 구조 모드, URS 상태 파일 없음");
} else {
  const requirementFiles = await findRequirementFiles();
  if (requirementFiles.length === 0) errors.push("상태 파일은 있지만 docs/urs Markdown이 없습니다.");
  const parsed = requirementFiles.length ? await parseRequirementFiles(requirementFiles) : { clauses: [] };
  const sourceIds = new Set(parsed.clauses.map((clause) => clause.id));
  const stateIds = new Set(arrayOf(state.clauses).map((clause) => clause.id));
  for (const id of sourceIds) if (!stateIds.has(id)) errors.push(`URS_STATUS.json 누락 조항: ${id}`);
  for (const id of stateIds) if (!sourceIds.has(id)) errors.push(`현재 URS에 없는 활성 상태 조항: ${id}`);

  const clauses = arrayOf(state.clauses);
  const functional = clauses.filter((clause) => clause.kind === "functional");
  if (functional.length === 0) errors.push("기능 조항이 0개입니다.");
  const seen = new Set();
  for (const clause of clauses) {
    if (seen.has(clause.id)) errors.push(`상태 파일 중복 조항: ${clause.id}`);
    seen.add(clause.id);
    if (!clause.summary || !clause.source_file || !Number.isInteger(clause.source_line)) errors.push(`${clause.id}: source와 summary가 불완전합니다.`);
    if (!ALL_STATUSES.has(clause.status)) errors.push(`${clause.id}: 허용되지 않은 상태 ${clause.status}`);
    if (!clause.analysis_owner || !clause.implementation_owner) errors.push(`${clause.id}: 역할 소유자가 미배정입니다.`);
  }

  if (finalMode) {
    const finalArtifacts = [
      "harness/state/RUN_STATE.json",
      "SPEC_A.md",
      "SPEC_B.md",
      "SPEC_C.md",
      "PLAN.md",
      "DECISIONS.md",
      "CHANGELOG.md",
      "IMPLEMENTED.md",
      "docs/generated/URS_TRACEABILITY.md",
      "docs/generated/URS_EVIDENCE.md",
      "docs/generated/URS_GAPS.md"
    ];
    for (const relative of finalArtifacts) requireFile(relative);

    finalRunState = await readJsonIfExists(RUN_STATE_PATH);
    if (!finalRunState) {
      errors.push("최종 게이트에 필요한 RUN_STATE.json을 읽을 수 없습니다.");
    } else {
      if (finalRunState.harness_version !== "3.0.0") errors.push("RUN_STATE.json의 harness_version이 3.0.0이 아닙니다.");
      const environment = finalRunState.environment;
      if (!environment || typeof environment.env_file_present !== "boolean") errors.push("RUN_STATE.json의 environment.env_file_present가 boolean이 아닙니다.");
      const allowedEnvironment = new Set(["not_run", "pass", "fail", "blocked"]);
      for (const key of ["sheets_smoke", "browser_smoke", "deployment_smoke"]) {
        if (!allowedEnvironment.has(environment?.[key])) errors.push(`RUN_STATE.json의 environment.${key} 상태가 올바르지 않습니다.`);
      }
    }

    const specs = [];
    for (const relative of ["SPEC_A.md", "SPEC_B.md", "SPEC_C.md"]) {
      const absolute = path.join(ROOT, relative);
      specs.push(existsSync(absolute) ? await readFile(absolute, "utf8") : "");
    }
    const specText = specs.join("\n");
    for (const clause of functional) {
      if (!specText.includes(clause.id)) errors.push(`${clause.id}: SPEC_A/B/C에 조항 ID가 없습니다.`);
      if (clause.status !== "implemented") errors.push(`${clause.id}: 최종 게이트 상태가 ${clause.status}입니다.`);
      const files = arrayOf(clause.files);
      const interfaces = arrayOf(clause.interfaces);
      const evidence = arrayOf(clause.evidence);
      if (files.length === 0) errors.push(`${clause.id}: 구현 파일 증거가 없습니다.`);
      if (interfaces.length === 0) errors.push(`${clause.id}: 화면 또는 API 연결이 없습니다.`);
      if (!evidence.some((item) => item?.kind === "source")) errors.push(`${clause.id}: source 구현 증거가 없습니다.`);
      for (const file of files) {
        const clean = String(file).replace(/:\d+$/, "");
        if (!existsSync(path.join(ROOT, clean))) errors.push(`${clause.id}: 보고된 구현 파일이 없습니다: ${file}`);
      }
      for (const item of evidence.filter((entry) => entry?.kind === "source")) {
        const clean = String(item.ref || "").replace(/:\d+$/, "");
        if (!clean || !existsSync(path.join(ROOT, clean))) errors.push(`${clause.id}: source 증거 파일이 없습니다: ${item.ref || "빈 ref"}`);
      }
    }

    const runRecords = new Map();
    for (const role of manifest.required_roles || []) {
      const runPath = path.join(ROOT, "harness", "runs", `${role}.json`);
      if (!existsSync(runPath)) {
        errors.push(`역할 완료 파일 없음: harness/runs/${role}.json`);
        continue;
      }
      try {
        const run = JSON.parse(await readFile(runPath, "utf8"));
        if (run.role !== role || run.status !== "complete") errors.push(`${role}: 완료 파일 status 또는 role이 올바르지 않습니다.`);
        if (run.schema_version !== 1 || !String(run.assignment || "").trim()) errors.push(`${role}: 완료 파일 schema_version 또는 assignment가 올바르지 않습니다.`);
        for (const key of ["files_created", "files_modified", "clauses_covered", "clauses_unresolved", "shared_change_requests", "checks_run"]) {
          if (!Array.isArray(run[key])) errors.push(`${role}: 완료 파일 ${key}가 배열이 아닙니다.`);
        }
        if (arrayOf(run.clauses_unresolved).length > 0) errors.push(`${role}: 해결되지 않은 조항이 남아 있습니다: ${arrayOf(run.clauses_unresolved).join(", ")}`);
        if (arrayOf(run.shared_change_requests).length > 0) errors.push(`${role}: 통합되지 않은 공유 변경 요청이 남아 있습니다.`);
        if (run.blocker) errors.push(`${role}: complete 완료 파일에 blocker가 남아 있습니다.`);
        for (const file of [...arrayOf(run.files_created), ...arrayOf(run.files_modified)]) {
          const clean = String(file).replace(/:\d+$/, "");
          if (!existsSync(path.join(ROOT, clean))) errors.push(`${role}: 완료 파일에 보고한 경로가 없습니다: ${file}`);
        }
        runRecords.set(role, run);
      } catch (error) {
        errors.push(`${role}: 완료 파일 JSON을 읽을 수 없습니다: ${error.message}`);
      }
    }

    for (const clause of functional) {
      const analysisRun = runRecords.get(clause.analysis_owner);
      const implementationRun = runRecords.get(clause.implementation_owner);
      if (analysisRun && !arrayOf(analysisRun.clauses_covered).includes(clause.id)) errors.push(`${clause.id}: ${clause.analysis_owner} 완료 원장에 분석 커버리지가 없습니다.`);
      if (implementationRun && !arrayOf(implementationRun.clauses_covered).includes(clause.id)) errors.push(`${clause.id}: ${clause.implementation_owner} 완료 원장에 구현 커버리지가 없습니다.`);
    }

    const expectedFingerprint = reportFingerprint(functional, finalRunState?.environment || {});
    for (const relative of ["IMPLEMENTED.md", "docs/generated/URS_TRACEABILITY.md", "docs/generated/URS_EVIDENCE.md", "docs/generated/URS_GAPS.md"]) {
      const absolute = path.join(ROOT, relative);
      if (!existsSync(absolute)) continue;
      const text = await readFile(absolute, "utf8");
      if (!text.includes(`상태 지문: ${expectedFingerprint}`)) errors.push(`${relative}: 중앙 상태와 환경 상태 지문이 일치하지 않습니다. harness:sync를 다시 실행하세요.`);
    }

    for (const relative of ["IMPLEMENTED.md", "docs/generated/URS_TRACEABILITY.md", "docs/generated/URS_EVIDENCE.md"]) {
      const absolute = path.join(ROOT, relative);
      if (!existsSync(absolute)) continue;
      const text = await readFile(absolute, "utf8");
      for (const clause of functional) if (!text.includes(clause.id)) errors.push(`${relative}: ${clause.id}가 없습니다.`);
    }
  }
}

let completion = "TEMPLATE_READY";
if (state && finalMode) {
  const environment = finalRunState?.environment || {};
  const pending = ["sheets_smoke", "browser_smoke", "deployment_smoke"].some((key) => environment[key] !== "pass");
  completion = pending ? "COMPLETE_WITH_ENV_VALIDATION_REQUIRED" : "COMPLETE";
}

if (errors.length > 0) completion = "INCOMPLETE";
console.log(`[check:harness] ${completion}`);
console.log(`[check:harness] intent ${manifest.intents?.length || 0}개, 역할 ${manifest.required_roles?.length || 0}개, 오류 ${errors.length}개, 경고 ${warnings.length}개`);
for (const item of pass) console.log(`  PASS: ${item}`);
for (const item of warnings) console.log(`  WARN: ${item}`);
for (const item of errors) console.log(`  ERROR: ${item}`);
if (errors.length > 0) process.exitCode = 1;
