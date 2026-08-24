#!/usr/bin/env node

import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(tmpdir(), "codex-harness-v3-gate-"));
const fixture = path.join(tempRoot, "fixture");
const skipDirs = new Set(["node_modules", ".next", ".git", "out", "coverage", ".vercel"]);
const skipRootFiles = new Set(["SPEC_A.md", "SPEC_B.md", "SPEC_C.md", "PLAN.md", "IMPLEMENTED.md", "DECISIONS.md", "CHANGELOG.md", "next-env.d.ts", "tsconfig.tsbuildinfo"]);

function run(script, args = []) {
  return spawnSync(process.execPath, [path.join(fixture, "scripts", script), ...args], {
    cwd: fixture,
    encoding: "utf8",
    windowsHide: true
  });
}

function assertRun(result, expectedCode, marker) {
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (result.status !== expectedCode || !output.includes(marker)) {
    throw new Error(`명령 판정 불일치, expected=${expectedCode}/${marker}, actual=${result.status}\n${output}`);
  }
}

try {
  await cp(root, fixture, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(root, source);
      if (!relative) return true;
      const parts = relative.split(path.sep);
      if (parts.some((part) => skipDirs.has(part))) return false;
      const base = parts.at(-1);
      if (parts.length === 1 && skipRootFiles.has(base)) return false;
      if (/^\.env(?:\..+)?$/.test(base) && base !== ".env.example") return false;
      if (parts[0] === "docs" && ["urs", "generated"].includes(parts[1]) && base !== ".gitkeep") return false;
      if (parts[0] === "harness" && ["state", "runs"].includes(parts[1]) && base !== ".gitkeep") return false;
      return true;
    }
  });

  const ursDir = path.join(fixture, "docs", "urs");
  await mkdir(ursDir, { recursive: true });
  await writeFile(path.join(ursDir, "sample.md"), `# KPBMA-EDU-001-URS Sample

## 7.1 Functional Requirements

| URS ID | Requirement |
|---|---|
| URS-F-001 | 사용자는 장비 사용 기록을 등록할 수 있어야 한다. |
| URS-F-002 | 검토자는 전자서명으로 기록을 승인하여야 한다. |
`, "utf8");

  assertRun(run("harness-init.mjs"), 0, "기능 조항 2개");
  assertRun(run("check-harness.mjs", ["--final"]), 1, "INCOMPLETE");

  const documents = {
    "SPEC_A.md": "# SPEC A\n\n할당된 기능 조항 없음.\n",
    "SPEC_B.md": "# SPEC B\n\n- URS-F-001: 기록 등록\n- URS-F-002: 전자서명 승인\n",
    "SPEC_C.md": "# SPEC C\n\n할당된 기능 조항 없음.\n",
    "PLAN.md": "# PLAN\n\n## 역할과 계정\n\n| 계정 ID | 이름 | 역할 코드 | 역할명 | 초기 비밀번호 | URS |\n|---|---|---|---|---|---|\n| TESTER | 시험자 | TESTER | 사용자 | 1234 | URS-F-001 |\n\n## 시트 스키마\n\n| 탭 | 헤더 | 쓰는 흐름 | 소유 역할 | URS |\n|---|---|---|---|---|\n| RECORDS | id | 등록 | builder-d2 | URS-F-001 |\n\n## 메뉴와 권한\n\n| 메뉴 | 경로 | 허용 역할 | 기능 | URS |\n|---|---|---|---|---|\n| 기록 | / | TESTER | 등록 | URS-F-001 |\n\n## 파일 소유권\n\n| 역할 | 생성 또는 수정 경로 | 금지 경로 | 의존 입력 |\n|---|---|---|---|\n| builder-d2 | app/page.tsx | lib/sheets.ts | SPEC_B.md |\n",
    "DECISIONS.md": "# DECISIONS\n\n| 번호 | 결정 | 근거 | 영향 파일 | 날짜 |\n|---|---|---|---|---|\n| D-001 | 자가시험 fixture | URS 근거 없음, 기본값 | harness/state | 2026-08-24 |\n",
    "CHANGELOG.md": "# CHANGELOG\n\n| 일시 (KST) | 분류 | 요청 요약 | 변경 파일 | 관련 조항 ID |\n|---|---|---|---|---|\n| 2026-08-24 00:00 | 원샷 빌드 | 하네스 게이트 자가시험 | harness/state | URS-F-001, URS-F-002 |\n"
  };
  await Promise.all(Object.entries(documents).map(([name, content]) => writeFile(path.join(fixture, name), content, "utf8")));

  const statePath = path.join(fixture, "harness", "state", "URS_STATUS.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  for (const clause of state.clauses.filter((item) => item.kind === "functional")) {
    const first = clause.id === "URS-F-001";
    clause.status = "implemented";
    clause.interfaces = [first ? "/" : "POST /api/login"];
    clause.files = [first ? "app/page.tsx" : "app/api/login/route.ts"];
    clause.evidence = [{ kind: "source", ref: clause.files[0], result: "게이트 계약 자가시험용 source 증거" }];
  }
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  const coverage = {
    "analyzer-a": [],
    "analyzer-b": ["URS-F-001", "URS-F-002"],
    "analyzer-c": [],
    "builder-d1": [],
    "builder-d2": ["URS-F-001"],
    "builder-d3": ["URS-F-002"],
    "builder-d4": []
  };
  const reportedFiles = {
    "analyzer-a": ["SPEC_A.md"],
    "analyzer-b": ["SPEC_B.md"],
    "analyzer-c": ["SPEC_C.md"],
    "builder-d1": [],
    "builder-d2": ["app/page.tsx"],
    "builder-d3": ["app/api/login/route.ts"],
    "builder-d4": []
  };
  const runsDir = path.join(fixture, "harness", "runs");
  await mkdir(runsDir, { recursive: true });
  await Promise.all(Object.keys(coverage).map((role) => writeFile(path.join(runsDir, `${role}.json`), `${JSON.stringify({
    schema_version: 1,
    role,
    status: "complete",
    assignment: "하네스 최종 게이트 자가시험",
    files_created: role.startsWith("analyzer") ? reportedFiles[role] : [],
    files_modified: role.startsWith("builder") ? reportedFiles[role] : [],
    clauses_covered: coverage[role],
    clauses_unresolved: [],
    shared_change_requests: [],
    checks_run: [{ command: "test fixture", result: "pass" }],
    blocker: null
  }, null, 2)}\n`, "utf8")));

  assertRun(run("sync-harness-report.mjs"), 0, "기능 조항 2개: 구현 2");
  const changedAfterSync = JSON.parse(await readFile(statePath, "utf8"));
  changedAfterSync.clauses.find((clause) => clause.id === "URS-F-001").notes = "파생 문서 생성 뒤 중앙 상태 변경";
  await writeFile(statePath, `${JSON.stringify(changedAfterSync, null, 2)}\n`, "utf8");
  assertRun(run("check-harness.mjs", ["--final"]), 1, "상태 지문이 일치하지 않습니다");
  assertRun(run("sync-harness-report.mjs"), 0, "기능 조항 2개: 구현 2");
  assertRun(run("check-harness.mjs", ["--final"]), 0, "COMPLETE_WITH_ENV_VALIDATION_REQUIRED");
  console.log("[test:harness:gate] FAIL_CLOSED_AND_COMPLETE_OK 누락 상태, 오래된 파생 문서 차단과 완전한 fixture 통과를 확인했습니다.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
