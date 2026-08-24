#!/usr/bin/env node

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mergeClauseState, parseRequirementFiles } from "./lib/harness-utils.mjs";

const dir = await mkdtemp(path.join(tmpdir(), "codex-harness-v3-"));
const file = path.join(dir, "sample-urs.md");

try {
  await writeFile(file, `# KPBMA-EDU-001-URS

## 7.1 Functional Requirements

| URS ID | Requirement | Verification |
|---|---|---|
| URS-F-001 | 사용자는 장비 사용 기록을 등록할 수 있어야 한다. | 저장 후 목록 확인 |
| ELB-001 | 검토자는 전자서명으로 기록을 승인하여야 한다. | 승인 상태 확인 |

URS-F-001은 아래 검증 문서에서 매우 길고 상세하게 다시 참조하지만 요구사항 정본 행은 아니다.
SOP-001은 단순 참조 문서이므로 기능 조항으로 등록하지 않는다.

## 7.2 Data Requirements

| URS ID | Requirement |
|---|---|
| URS-D-001 | 저장 시각은 서버 시각으로 기록하여야 한다. |
`, "utf8");

  const parsed = await parseRequirementFiles([file]);
  const byId = new Map(parsed.clauses.map((clause) => [clause.id, clause]));
  const expected = ["ELB-001", "URS-D-001", "URS-F-001"];
  const actual = [...byId.keys()];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`조항 목록 불일치: ${actual.join(", ")}`);
  if (byId.get("URS-F-001")?.summary !== "사용자는 장비 사용 기록을 등록할 수 있어야 한다.") throw new Error("표 정본보다 교차 참조 문구가 선택되었습니다.");
  if (byId.get("URS-F-001")?.implementation_owner !== "builder-d2") throw new Error("일반 기록 요구사항 소유자 배정 오류");
  if (byId.get("ELB-001")?.kind !== "functional" || byId.get("ELB-001")?.implementation_owner !== "builder-d3") throw new Error("7.1 사용자 정의 ID 또는 승인 흐름 배정 오류");
  if (byId.has("KPBMA-EDU-001") || byId.has("SOP-001")) throw new Error("문서 ID 또는 단순 참조 ID가 조항으로 등록되었습니다.");

  const old = {
    ...byId.get("URS-F-001"),
    status: "implemented",
    interfaces: ["/records"],
    files: ["app/records/page.tsx"],
    evidence: [{ kind: "source", ref: "app/records/page.tsx" }],
    blocker: null,
    notes: "기존 검증"
  };
  const unchanged = mergeClauseState(byId.get("URS-F-001"), old, "2026-08-24T00:00:00+09:00");
  if (unchanged.status !== "implemented" || unchanged.evidence.length !== 1) throw new Error("변경되지 않은 조항의 상태 보존 오류");
  const changed = mergeClauseState({ ...byId.get("URS-F-001"), summary: "변경된 요구 문구" }, old, "2026-08-24T00:00:00+09:00");
  if (changed.status !== "pending" || changed.evidence.length !== 0 || !changed.notes.includes("재검증 대기")) throw new Error("변경된 조항의 증거 초기화 오류");
  console.log("[test:harness] PARSER_OK ID 인벤토리, 표 정본 우선순위, 역할 배정, URS 변경 시 증거 초기화를 확인했습니다.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
