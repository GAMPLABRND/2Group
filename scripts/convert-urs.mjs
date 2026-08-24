#!/usr/bin/env node
// URS 변환기: docs/urs/*.docx (또는 urs_source/*.docx) → docs/urs/<이름>.md (mammoth 사용)
// 사용법: node scripts/convert-urs.mjs   (Windows: npm.cmd run urs)
//  - 표(URS No. / Requirement 등)를 GFM markdown 표로 보존한다.
//  - 변환 후 파일별 URS 조항 ID(예: URS-F-001, URS-E-002) 탐지 개수를 출력한다.
//  - KPBMA-EDU-001-URS 양식은 조항 ID가 표의 첫 열에 텍스트로 있어야 한다. Word 자동 번호는 변환되지 않는다.

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const SRC_DIRS = [path.join("docs", "urs"), "urs_source"];
const OUT_DIR = path.join("docs", "urs");
// URS-F-001, URS-E-002, ELB-FR-001, XYZ-001 형태를 모두 잡는다
const CLAUSE_ID_RE = /\b[A-Z][A-Z0-9]{1,7}(?:-[A-Z0-9]{1,6})*-\d{2,4}\b/g;
const BR = "\u0000BR\u0000"; // 태그 제거 단계에서 살아남기 위한 줄바꿈 플레이스홀더

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function stripInline(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// 표 셀: 단락 경계는 <br>로 보존, 파이프는 이스케이프
function cellText(html) {
  let s = html
    .replace(/<br\s*\/?>/gi, BR)
    .replace(/<\/p>\s*<p[^>]*>/gi, BR)
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s)
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return s.split(BR).map((t) => t.trim()).filter(Boolean).join("<br>");
}

function convertTable(tableHtml) {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((m) =>
      [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => cellText(c[1]))
    )
    .filter((r) => r.length > 0);
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const norm = rows.map((r) => {
    while (r.length < width) r.push("");
    return r;
  });
  const line = (r) => `| ${r.join(" | ")} |`;
  const sep = `| ${Array(width).fill("---").join(" | ")} |`;
  return [line(norm[0]), sep, ...norm.slice(1).map(line)].join("\n");
}

function htmlToMd(html) {
  const tables = [];
  let s = html.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, (m) => {
    tables.push(convertTable(m));
    return `\u0000TABLE${tables.length - 1}\u0000`;
  });
  // 목록은 1단계로 평탄화 (URS 본문 수준에서 충분)
  s = s.replace(/<li[^>]*>/gi, "\n- ").replace(/<\/li>/gi, "");
  s = s.replace(/<\/?[uo]l[^>]*>/gi, "\n");
  for (let i = 6; i >= 1; i--) {
    const re = new RegExp(`<h${i}[^>]*>([\\s\\S]*?)</h${i}>`, "gi");
    s = s.replace(re, (_, t) => `\n\n${"#".repeat(i)} ${stripInline(t)}\n\n`);
  }
  s = s
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<img[^>]*>/gi, "(이미지 생략)")
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  s = s.replace(/\u0000TABLE(\d+)\u0000/g, (_, i) => `\n\n${tables[Number(i)]}\n\n`);
  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

async function main() {
  const jobs = [];
  for (const dir of SRC_DIRS) {
    if (!existsSync(dir)) continue;
    const files = (await readdir(dir)).filter(
      (f) => f.toLowerCase().endsWith(".docx") && !f.startsWith("~$")
    );
    for (const f of files) jobs.push({ dir, f });
  }
  if (jobs.length === 0) {
    console.log(
      `[convert-urs] 변환할 .docx 가 없습니다. URS .docx 파일을 ${SRC_DIRS[0]}/ 에 넣고 다시 실행하세요.`
    );
    return;
  }
  const { default: mammoth } = await import("mammoth");
  await mkdir(OUT_DIR, { recursive: true });

  for (const { dir, f } of jobs) {
    const { value: html, messages } = await mammoth.convertToHtml({
      path: path.join(dir, f),
    });
    const md = htmlToMd(html);
    const outPath = path.join(OUT_DIR, `${path.basename(f, path.extname(f))}.md`);
    await writeFile(outPath, md, "utf8");

    const ids = [...new Set(md.match(CLAUSE_ID_RE) ?? [])];
    const tableCount = (md.match(/^\|(?:\s*-{3,}\s*\|)+\s*$/gm) ?? []).length;
    console.log(`[convert-urs] ${path.join(dir, f)} → ${outPath}`);
    console.log(
      `  - 조항 ID ${ids.length}개 탐지${ids.length ? ` (예: ${ids.slice(0, 5).join(", ")})` : ""}`
    );
    console.log(`  - markdown 표 ${tableCount}개, mammoth 경고 ${messages.length}건`);
    if (ids.length === 0) {
      console.log(
        "  (주의) 조항 ID가 탐지되지 않았습니다. URS 표의 첫 열에 조항 ID가 텍스트로 있는지(Word 자동 번호가 아닌지) 확인하세요."
      );
    }
  }
}

main().catch((err) => {
  console.error("[convert-urs] 변환 실패:", err);
  process.exitCode = 1;
});
