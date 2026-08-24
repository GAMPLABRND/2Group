#!/usr/bin/env node
// 템플릿을 새 프로젝트 폴더로 복제한다.
// 사용법(Windows): npm.cmd run new -- <프로젝트명> [--dest <상위폴더>]
//   기본 대상: 템플릿 폴더의 옆(상위 폴더 아래) <프로젝트명>
//   복사하지 않는 것: node_modules, .next, .git, out, .env.local 등 env 파일, docs/urs 안의 URS 파일,
//                     이전 빌드 산출물(SPEC_*.md, PLAN.md, IMPLEMENTED.md, DECISIONS.md, CHANGELOG.md, docs/*_DRAFT.md)
//   AGENTS.md 끝에 next dev가 붙인 nextjs-agent-rules 블록과 이전 하네스 실행 상태도 제거해서 복사한다.

import { cp, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "out", "coverage", ".vercel", "urs_source"]);
const SKIP_FILES = new Set([
  "SPEC_A.md", "SPEC_B.md", "SPEC_C.md", "PLAN.md", "IMPLEMENTED.md", "DECISIONS.md", "CHANGELOG.md",
  "tsconfig.tsbuildinfo", "next-env.d.ts", ".DS_Store",
]);

function parseArgs(argv) {
  const args = { name: "", dest: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dest") args.dest = argv[++i] ?? "";
    else if (!a.startsWith("--") && !args.name) args.name = a;
  }
  return args;
}

function shouldSkip(src) {
  const rel = path.relative(TEMPLATE_DIR, src);
  if (!rel) return false;
  const parts = rel.split(path.sep);
  if (parts.some((p) => SKIP_DIRS.has(p))) return true;
  const base = parts[parts.length - 1];
  if (SKIP_FILES.has(base)) return true;
  if (/^\.env(\..+)?$/.test(base) && base !== ".env.example") return true;   // .env, .env.local 등
  if (parts[0] === "docs" && parts[1] === "urs" && base !== ".gitkeep") return true;  // 조별 URS는 복사 안 함
  if (parts[0] === "docs" && parts[1] === "generated" && base !== ".gitkeep") return true;
  if (parts[0] === "docs" && (base === "FDS.md" || base === "FDS_SAMPLE.docx" || /^KPBMA-.*-FDS_.*\.docx$/i.test(base))) return true;
  if (parts[0] === "harness" && ["state", "runs"].includes(parts[1]) && base !== ".gitkeep") return true;
  if (parts[0] === "docs" && /_DRAFT\.md$/.test(base)) return true;
  if (/^(service-account|credentials).*\.json$/i.test(base) || /(service-account|credentials).*\.json$/i.test(base)) return true;
  return false;
}

async function main() {
  const { name, dest } = parseArgs(process.argv.slice(2));
  if (!name || !/^[A-Za-z0-9._-]+$/.test(name)) {
    console.log("사용법: npm.cmd run new -- <프로젝트명> [--dest <상위폴더>]   (프로젝트명은 영문, 숫자, -, _ 만)");
    process.exitCode = 1;
    return;
  }
  const parent = dest ? path.resolve(dest) : path.resolve(TEMPLATE_DIR, "..");
  const target = path.join(parent, name);
  if (existsSync(target)) {
    console.log(`[new-project] 이미 존재합니다: ${target}`);
    process.exitCode = 1;
    return;
  }
  await mkdir(target, { recursive: true });
  await cp(TEMPLATE_DIR, target, { recursive: true, filter: (src) => !shouldSkip(src) });

  // AGENTS.md의 nextjs-agent-rules 블록 제거 (next dev가 다시 붙일 수 있으나 템플릿 사본은 깨끗하게)
  const agentsPath = path.join(target, "AGENTS.md");
  if (existsSync(agentsPath)) {
    const s = await readFile(agentsPath, "utf8");
    const cleaned = s.replace(/\n*<!-- BEGIN:nextjs-agent-rules -->[\s\S]*?<!-- END:nextjs-agent-rules -->\n*/g, "\n");
    if (cleaned !== s) await writeFile(agentsPath, cleaned.trimEnd() + "\n", "utf8");
  }
  // 새 프로젝트에서 비어 있어야 하는 폴더 보장
  for (const relative of [
    ["docs", "urs"],
    ["docs", "generated"],
    ["harness", "state"],
    ["harness", "runs"]
  ]) {
    const dir = path.join(target, ...relative);
    await mkdir(dir, { recursive: true });
    const keep = path.join(dir, ".gitkeep");
    if (!existsSync(keep)) await writeFile(keep, "", "utf8");
  }

  const st = await stat(target);
  if (!st.isDirectory()) throw new Error("복제 실패");
  console.log(`[new-project] 생성: ${target}`);
  console.log("다음 단계:");
  console.log(`  cd "${target}"`);
  console.log("  npm.cmd install");
  console.log("  Copy-Item .env.example .env.local   (PowerShell, 3종 값 입력)");
  console.log("  npm.cmd run dev  →  http://localhost:3000/api/seed  →  /login (계정 선택, 비밀번호 1234)");
  console.log("  Codex에서 이 폴더를 열고 URS .docx 를 docs/urs/ 에 넣은 뒤 \"하네스 절차대로 URS MVP 빌드를 시작해.\" 입력");
}

main().catch((err) => {
  console.error("[new-project] 실패:", err);
  process.exitCode = 1;
});
