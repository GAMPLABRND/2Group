#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/harness-utils.mjs";

const args = process.argv.slice(2);
function valueOf(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] || "" : "";
}

const role = valueOf("--role");
const assignment = valueOf("--assignment");
const allowed = new Set([
  "analyzer-a",
  "analyzer-b",
  "analyzer-c",
  "builder-d1",
  "builder-d2",
  "builder-d3",
  "builder-d4"
]);

if (!allowed.has(role) || !assignment.trim()) {
  console.error("사용법: npm.cmd run agent:prompt -- --role <analyzer-a|...|builder-d4> --assignment \"<담당 범위>\"");
  process.exit(1);
}

const contractPath = path.join(ROOT, "harness", "SUBAGENT_CONTRACT.md");
const rolePath = path.join(ROOT, "agents", `${role}.md`);
if (!existsSync(contractPath) || !existsSync(rolePath)) {
  console.error(`[agent:prompt] 필요한 파일이 없습니다: ${contractPath} 또는 ${rolePath}`);
  process.exit(1);
}

const [contract, roleText] = await Promise.all([
  readFile(contractPath, "utf8"),
  readFile(rolePath, "utf8")
]);

process.stdout.write([
  `# Assignment\n\nRole: ${role}\nAssignment: ${assignment.trim()}\nRepository root: ${ROOT}`,
  contract.trim(),
  roleText.trim(),
  `# Completion reminder\n\nFinish the full assignment, write harness/runs/${role}.json last, and then report the exact files, clauses, checks, and blockers.`
].join("\n\n") + "\n");
