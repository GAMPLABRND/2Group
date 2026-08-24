#!/usr/bin/env node
// 커밋 전 점검: git add -A 로 올라갈 파일 목록을 보고 비밀 파일, 빌드 산출물, 과대 파일이 끼어 있는지 확인한다.
//   node scripts/check-commit.mjs          문제가 있으면 목록을 출력하고 exit 1
//   node scripts/check-commit.mjs --list   올라갈 파일 목록 전체를 출력
// 산출물(IMPLEMENTED.md, PLAN.md, DECISIONS.md, CHANGELOG.md, SPEC_*.md, docs/urs/*,
// harness/state/*, harness/runs/*, docs/generated/*)은 추적성과 증거를 위해 의도적으로 커밋 대상이다.

import { execSync } from "node:child_process";
import { readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_BYTES = 5 * 1024 * 1024;

function listFiles() {
  // git 이 있으면 추적 중 + 무시되지 않은 미추적 파일 (= git add -A 대상)
  try {
    const out = execSync("git ls-files --cached --others --exclude-standard -z", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] });
    const files = out.toString("utf8").split("\0").filter(Boolean);
    return { files, viaGit: true };
  } catch {
    // git 저장소가 아니면 작업 트리를 직접 훑는다 (명백한 제외 폴더만 건너뜀)
    const skip = new Set(["node_modules", ".next", ".git", "out", "coverage", ".vercel"]);
    const files = [];
    const walk = (dir) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(ent.name)) continue;
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else files.push(path.relative(ROOT, p).split(path.sep).join("/"));
      }
    };
    walk(ROOT);
    return { files, viaGit: false };
  }
}

function isTextLike(file) {
  return /\.(md|ts|tsx|js|mjs|cjs|json|css|txt|toml|yml|yaml|env|example|local|html|csv|svg)$/i.test(file) || /(^|\/)\.env/.test(file);
}

function inspect(file) {
  const problems = [];
  const base = path.basename(file);
  if (/(^|\/)\.env(\..+)?$/.test(file) && base !== ".env.example") problems.push("환경 변수 파일(.env*)은 커밋하지 않는다");
  if (/(^|\/)(node_modules|\.next|out|\.vercel)\//.test(file)) problems.push("빌드 산출물 또는 의존성 폴더");
  if (/\.pem$/i.test(base)) problems.push("개인키 파일(.pem)");
  if (/(service-account|credentials|\.key)\.json$/i.test(base) || /service-account|credentials/i.test(base) && /\.json$/i.test(base)) problems.push("서비스 계정 키로 보이는 JSON");

  const abs = path.join(ROOT, file);
  if (!existsSync(abs)) return problems;
  let size = 0;
  try { size = statSync(abs).size; } catch { return problems; }
  if (size > MAX_BYTES) problems.push(`파일이 ${(size / 1024 / 1024).toFixed(1)}MB 로 너무 크다`);

  if (isTextLike(file) && size < 2 * 1024 * 1024) {
    let text = "";
    try { text = readFileSync(abs, "utf8"); } catch { return problems; }
    // 실제 개인키 본문: BEGIN PRIVATE KEY 와 긴 base64 덩어리가 함께 있을 때만 (안내 문구의 짧은 예시는 제외)
    if (/-----BEGIN (RSA |EC )?PRIVATE KEY-----/.test(text) && /[A-Za-z0-9+/=\\n]{300,}/.test(text.replace(/\s+/g, ""))) {
      problems.push("개인키 본문(BEGIN PRIVATE KEY)이 들어 있다");
    }
    if (/\.json$/i.test(base) && /"private_key"\s*:/.test(text) && /"client_email"\s*:/.test(text)) {
      problems.push("Google 서비스 계정 JSON 키 내용");
    }
    if (base !== ".env.example" && /^\s*GOOGLE_PRIVATE_KEY\s*=\s*["']?-----BEGIN/m.test(text)) {
      problems.push("GOOGLE_PRIVATE_KEY 실제 값이 들어 있다");
    }
  }
  return problems;
}

const { files, viaGit } = listFiles();
if (process.argv.includes("--list")) {
  for (const f of files) console.log(f);
  process.exit(0);
}

const findings = [];
for (const f of files) {
  const p = inspect(f);
  if (p.length) findings.push({ f, p });
}

console.log(`[check-commit] ${viaGit ? "git add -A 대상" : "작업 트리"} 파일 ${files.length}개 점검`);
if (findings.length === 0) {
  console.log("[check-commit] OK. 비밀 파일, 빌드 산출물, 과대 파일 없음. 상태, 역할 원장, IMPLEMENTED, 추적성, 증거, gaps, PLAN, SPEC은 함께 커밋된다.");
} else {
  console.log("[check-commit] 문제 발견. 아래 파일을 제외하거나 내용을 제거한 뒤 다시 실행한다 (.gitignore 확인, 이미 추적 중이면 git rm --cached <파일>).");
  for (const { f, p } of findings) console.log(`  - ${f}: ${p.join(", ")}`);
  process.exitCode = 1;
}
