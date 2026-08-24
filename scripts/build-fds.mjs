#!/usr/bin/env node
// FDS 빌더: docs/FDS.md (하네스 FDS 양식, 목차 고정) → 검증 → Word 문서(.docx) 생성. 외부 패키지 없음.
//   npm run fds                 docs/FDS.md 검증 후 docs/KPBMA-EDU-00X-FDS_<조>조_<시스템명>_v<버전>.docx 생성
//   npm run fds -- --check      검증만 (docx 생성 없음)
//   npm run fds -- --sample     docs/FDS_TEMPLATE.md 로 docs/FDS_SAMPLE.docx 생성 (Word 출력 경로 점검용, 검증은 경고만)
//   npm run fds -- --in <md> --out <docx>
// 규칙은 docs/FDS_GUIDE.md, 양식은 docs/FDS_TEMPLATE.md 를 따른다.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const SAMPLE = args.includes("--sample");
const CHECK_ONLY = args.includes("--check");
const IN = path.resolve(ROOT, opt("--in", SAMPLE ? "docs/FDS_TEMPLATE.md" : "docs/FDS.md"));

// ------------------------------------------------------------------ 목차 (고정)
const TOC = [
  ["1", "서론 및 적용 범위 / Introduction and Scope"],
  ["1.1", "목적 / Purpose"],
  ["1.2", "범위 / Scope"],
  ["2", "시스템 개요 / System Overview"],
  ["2.1", "사용 목적 / Intended Use"],
  ["2.2", "시스템 설명 / System Description"],
  ["2.3", "시스템 구성 / System Configuration"],
  ["2.4", "시스템 컴포넌트 구성 / System Component Configuration"],
  ["2.5", "전체 업무 흐름 / Overall Workflow"],
  ["3", "기능 규격 / Functional Specification"],
  ["3.1", "접근 관리 및 보안 / Access Control & Security"],
  ["3.2", "(시스템 고유 기능 영역) / (System-Specific Functions)"],
  ["3.3", "데이터 처리 / Data Processing"],
  ["3.4", "전자기록 데이터 관리 / Electronic Records & Data Management"],
  ["3.5", "감사추적 / Audit Trail"],
  ["3.6", "전자서명 / Electronic Signatures"],
  ["3.7", "인터페이스 및 통신 / Interfaces & Communication"],
  ["3.8", "오류처리 및 무결성 통제 / Error Handling & Data Integrity Controls"],
  ["4", "설계 규격 / Design Specification"],
  ["4.1", "구성 / Configuration"],
  ["4.2", "데이터 설계 / Data Design"],
  ["4.3", "소스코드 통제 / Source Code Control"],
  ["5", "데이터 / Data"],
  ["6", "용어 정의 / Acronyms, Abbreviations, and Definitions"],
];
const FS_SECTIONS = ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"];
const DS_SECTIONS = ["4.1", "4.2", "4.3"];
const URS_ID_RE = /URS-[A-Z]-\d{3}/g;

// ------------------------------------------------------------------ 마크다운 파서 (부분집합)
function parseMarkdown(src) {
  src = src.replace(/\r\n/g, "\n").replace(/<!--[\s\S]*?-->/g, "");
  const lines = src.split("\n");
  const meta = {};
  let i = 0;
  if (lines[0] && lines[0].trim() === "---") {
    i = 1;
    while (i < lines.length && lines[i].trim() !== "---") {
      const m = lines[i].match(/^([^:]+):\s*(.*)$/);
      if (m) meta[m[1].trim()] = m[2].trim();
      i++;
    }
    i++;
  }
  const blocks = [];
  let para = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ type: "p", text: para.join(" ") });
      para = [];
    }
  };
  for (; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { flush(); continue; }
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flush(); blocks.push({ type: "h", level: h[1].length, text: h[2].trim() }); continue; }
    if (t.startsWith("|")) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const r = lines[i].trim();
        if (!/^\|?\s*:?-{2,}/.test(r.replace(/\|/g, "").trim()) || !/^[\s|:-]+$/.test(r)) {
          rows.push(splitRow(r));
        }
        i++;
      }
      i--;
      if (rows.length) blocks.push({ type: "table", rows });
      continue;
    }
    const b = t.match(/^[-*]\s+(.*)$/);
    if (b) { flush(); blocks.push({ type: "li", text: b[1].trim() }); continue; }
    const n = t.match(/^(\d+)[.)]\s+(.*)$/);
    if (n) { flush(); blocks.push({ type: "li", text: n[2].trim(), num: n[1] }); continue; }
    para.push(t);
  }
  flush();
  return { meta, blocks };
}

function splitRow(r) {
  let s = r.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

// ------------------------------------------------------------------ 절 구조화와 검증
function sectionize(blocks) {
  // 각 블록에 현재 절 번호를 붙인다 (제목 첫 토큰 "3.1" 또는 "3.1." 형태)
  const sections = new Map();
  let cur = null;
  for (const b of blocks) {
    if (b.type === "h") {
      const m = b.text.match(/^(\d+(?:\.\d+)*)\.?\s+(.*)$/);
      if (m) {
        cur = m[1];
        b.num = cur;
        b.title = m[2];
        if (!sections.has(cur)) sections.set(cur, { heading: b, blocks: [] });
        continue;
      }
    }
    if (cur) sections.get(cur).blocks.push(b);
  }
  return sections;
}

function loadUrsIds() {
  const dir = path.join(ROOT, "docs", "urs");
  const ids = new Set();
  if (!existsSync(dir)) return ids;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const txt = readFileSync(path.join(dir, f), "utf8");
    for (const m of txt.match(URS_ID_RE) || []) ids.add(m);
  }
  return ids;
}

function loadImplemented() {
  const p = path.join(ROOT, "IMPLEMENTED.md");
  const status = new Map();
  if (!existsSync(p)) return status;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = splitRow(line);
    const id = (cells[0] || "").match(/URS-[A-Z]-\d{3}/);
    if (!id) continue;
    const st = cells.find((c) => /^(구현|부분|미구현)$/.test(c.trim()));
    if (st) status.set(id[0], st.trim());
  }
  return status;
}

function validate(sections, meta) {
  const errors = [], warns = [];
  for (const [num, title] of TOC) {
    if (!sections.has(num)) errors.push(`목차 누락: ${num} ${title}`);
  }
  for (const num of sections.keys()) {
    if (!TOC.some(([n]) => n === num)) warns.push(`목차에 없는 절: ${num} (고정 목차 밖의 절은 Word 에는 들어가지만 양식과 다릅니다)`);
  }
  const fsIds = [], dsIds = [], refs = new Map(); // id -> [URS ids]
  const specRows = [];
  const collect = (num, prefix, seqList) => {
    const sec = sections.get(num);
    if (!sec) return;
    const tables = sec.blocks.filter((b) => b.type === "table");
    const specTables = tables.filter((t) => /^(FS|DS) ID/i.test((t.rows[0] || [])[1] || ""));
    if (!specTables.length) {
      const na = sec.blocks.some((b) => b.type === "p" && /해당 없음/.test(b.text));
      (na ? warns : errors).push(`${num} 절에 ${prefix} 규격 표가 없습니다${na ? " (해당 없음 처리)" : ". 표 머리글은 | No. | " + prefix + " ID | 규격 | 관련 URS | 입니다"}`);
      return;
    }
    for (const t of specTables) {
      t.spec = true;
      for (const row of t.rows.slice(1)) {
        const [, id, text, urs] = row;
        if (!id || !new RegExp(`^${prefix}-\\d{3}$`).test(id)) { errors.push(`${num} 절: ${prefix} ID 형식 오류 "${id}" (예: ${prefix}-001)`); continue; }
        if (seqList.includes(id)) errors.push(`${num} 절: ${id} 중복`);
        seqList.push(id);
        if (!text || text.length < 8) errors.push(`${num} 절: ${id} 규격 문장이 비어 있거나 너무 짧습니다`);
        const ids = (urs || "").match(URS_ID_RE) || [];
        const noBasis = /URS 근거 없음/.test(urs || "");
        if (!ids.length && !noBasis) errors.push(`${num} 절: ${id} 의 관련 URS 가 비어 있습니다 (URS-F-nnn 또는 "URS 근거 없음 (사유)")`);
        refs.set(id, ids);
        specRows.push({ num, id, text, ids, noBasis });
      }
    }
  };
  for (const s of FS_SECTIONS) collect(s, "FS", fsIds);
  for (const s of DS_SECTIONS) collect(s, "DS", dsIds);
  const seqCheck = (list, prefix) => {
    const nums = list.map((x) => Number(x.slice(3)));
    for (let k = 1; k < nums.length; k++) if (nums[k] !== nums[k - 1] + 1) { warns.push(`${prefix} ID 번호가 연속되지 않습니다: ${list[k - 1]} 다음 ${list[k]}`); break; }
  };
  seqCheck(fsIds, "FS"); seqCheck(dsIds, "DS");

  // URS 대조
  const ursIds = loadUrsIds();
  const status = loadImplemented();
  const referenced = new Set(specRows.flatMap((r) => r.ids));
  if (ursIds.size) {
    for (const id of referenced) if (!ursIds.has(id)) errors.push(`URS 에 없는 조항 ID 참조: ${id}`);
    const target = [...ursIds].filter((id) => id.startsWith("URS-F-")).filter((id) => !status.size || ["구현", "부분"].includes(status.get(id) || "구현"));
    const uncovered = target.filter((id) => !referenced.has(id));
    if (uncovered.length) warns.push(`FS 또는 DS 에 연결되지 않은 구현 조항 ${uncovered.length}건: ${uncovered.join(", ")}`);
    const unimpl = [...status.entries()].filter(([, s]) => s === "미구현").map(([id]) => id);
    const body = [...sections.values()].flatMap((s) => s.blocks).filter((b) => b.type === "p" || b.type === "li").map((b) => b.text).join("\n");
    const missingNote = unimpl.filter((id) => !body.includes(id));
    if (missingNote.length) warns.push(`미구현 조항이 1.2 범위의 제외 목록에 없습니다: ${missingNote.join(", ")}`);
    meta._coverage = { target: target.length, covered: target.length - uncovered.length, uncovered, unimpl };
  } else {
    warns.push("docs/urs/*.md 가 없어 URS 대조를 건너뜁니다");
  }
  // 자리표시 잔존
  const allText = [...sections.values()].flatMap((s) => [s.heading.text, ...s.blocks.flatMap((b) => b.type === "table" ? b.rows.flat() : [b.text])]).join("\n");
  const ph = allText.match(/\[[^\]\n]{1,40}\]/g) || [];
  const phs = [...new Set(ph)].filter((x) => !/^\[(x| |X)\]$/.test(x));
  if (phs.length) warns.push(`대괄호 자리표시가 남아 있습니다: ${phs.slice(0, 8).join(" ")}${phs.length > 8 ? " 외" : ""}`);
  for (const k of ["시스템명", "조"]) if (!meta[k]) warns.push(`머리말에 "${k}:" 값이 없습니다 (lib/brand.ts 값으로 대체)`);
  return { errors, warns, fsCount: fsIds.length, dsCount: dsIds.length };
}

// ------------------------------------------------------------------ brand.ts 읽기 (기본값)
function readBrand() {
  const b = { TEAM_NO: "1", SYSTEM_NAME: "GMP 교육 시스템", ORG_NAME: "한국제약바이오협회" };
  const p = path.join(ROOT, "lib", "brand.ts");
  if (!existsSync(p)) return b;
  const t = readFileSync(p, "utf8");
  for (const k of Object.keys(b)) {
    const m = t.match(new RegExp(`export const ${k}\\s*=\\s*"([^"]*)"`));
    if (m) b[k] = m[1];
  }
  return b;
}

// ------------------------------------------------------------------ DOCX 생성
const W = 9524; // 본문 폭 (twip): A4 11906 - 좌 1531 - 우 851
const xml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FONTS = `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="맑은 고딕" w:cs="Arial"/>`;

function runs(text, base = {}) {
  // **굵게** 와 `코드` 처리
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m;
  const push = (s, extra) => { if (s) out.push(run(s, { ...base, ...extra })); };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) push(tok.slice(2, -2), { bold: true });
    else push(tok.slice(1, -1), { code: true });
    last = m.index + tok.length;
  }
  push(text.slice(last));
  return out.join("");
}
function run(text, o = {}) {
  const pr = [];
  pr.push(o.code ? `<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="맑은 고딕"/>` : FONTS);
  if (o.bold) pr.push("<w:b/><w:bCs/>");
  if (o.color) pr.push(`<w:color w:val="${o.color}"/>`);
  if (o.size) pr.push(`<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>`);
  return `<w:r><w:rPr>${pr.join("")}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}
function para(inner, o = {}) {
  const pr = [];
  if (o.style) pr.push(`<w:pStyle w:val="${o.style}"/>`);
  if (o.keepNext) pr.push("<w:keepNext/>");
  if (o.pageBreakBefore) pr.push("<w:pageBreakBefore/>");
  if (o.align) pr.push(`<w:jc w:val="${o.align}"/>`);
  if (o.ind) pr.push(`<w:ind w:left="${o.ind}" w:hanging="${o.hanging || 0}"/>`);
  if (o.before != null || o.after != null) pr.push(`<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 120}" w:line="300" w:lineRule="auto"/>`);
  return `<w:p>${pr.length ? `<w:pPr>${pr.join("")}</w:pPr>` : ""}${inner}</w:p>`;
}
const pageBreak = () => `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;

function table(rows, o = {}) {
  const cols = Math.max(...rows.map((r) => r.length));
  const widths = o.widths && o.widths.length === cols ? o.widths.map((p) => Math.round(W * p)) : Array(cols).fill(Math.round(W / cols));
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  const border = `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="8A95A5"/>`).join("")}</w:tblBorders>`;
  const trs = rows.map((r, ri) => {
    const isHead = ri === 0 && o.header !== false;
    const tcs = widths.map((w, ci) => {
      const txt = r[ci] ?? "";
      const shade = isHead ? `<w:shd w:val="clear" w:color="auto" w:fill="EAF5FF"/>` : "";
      const align = o.center && o.center.includes(ci) && !isHead ? "center" : (isHead ? "center" : "left");
      // 셀 안 줄바꿈 (<br> 또는 " / " 는 그대로)
      const parts = String(txt).split(/<br\s*\/?>/i);
      const ps = parts.map((pt) => para(runs(pt, { bold: isHead, size: o.size || 18 }), { align, before: 20, after: 20 })).join("");
      return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${shade}<w:vAlign w:val="center"/></w:tcPr>${ps}</w:tc>`;
    }).join("");
    return `<w:tr>${isHead ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${tcs}</w:tr>`;
  }).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${W}" w:type="dxa"/>${border}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${trs}</w:tbl>${para("", { after: 120 })}`;
}

function buildDocument(parsed, info) {
  const { blocks } = parsed;
  const out = [];
  // ---- 표지
  if (info.ciRelId) {
    const cx = 5400000, cy = Math.round(cx * 56 / 444);
    out.push(para(`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="CI"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="kpbma-ci.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${info.ciRelId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`, { after: 700 }));
  }
  out.push(para(run("Functional Design Specification (FDS)", { size: 32, bold: true, color: "163A5F" }), { align: "left", after: 120 }));
  out.push(para(run("기능 및 설계 규격서", { size: 40, bold: true, color: "1F2933" }), { after: 240 }));
  out.push(para(run(`${info.org} ${info.team}조 ${info.system}${info.systemEn ? ` (${info.systemEn})` : ""}`, { size: 26, color: "163A5F" }), { after: 700 }));
  out.push(table([
    ["문서번호", info.docNo, "버전", info.version],
    ["시스템명", `${info.system}${info.systemEn ? ` (${info.systemEn})` : ""}`, "작성일", info.date],
    ["작성 주체", info.author, "문서 상태", info.status],
  ], { header: false, widths: [0.16, 0.44, 0.14, 0.26], size: 20 }));
  out.push(para(run("본 문서는 구현이 완료된 시점의 시스템 현재 상태를 AI Agent(공급자 역할)가 기술한 것이며, 조원의 검토와 승인 서명으로 발효된다. 교육용 문서로 실제 GMP 운영 시스템의 규격서가 아니다.", { size: 18, color: "667085" }), { after: 360 }));
  out.push(para(run("작성, 검토, 승인 / Author, Reviewer, Approver", { bold: true, size: 22 }), { after: 120 }));
  out.push(table([
    ["구분", "소속 (역할)", "성명", "서명", "일자"],
    ["작성자 Author", info.author, "", "", info.date],
    ["검토자 Reviewer", "", "", "", ""],
    ["승인자 Approver", "", "", "", ""],
  ], { widths: [0.2, 0.3, 0.16, 0.17, 0.17] }));
  out.push(para(run("Document History", { bold: true, size: 22 }), { after: 120 }));
  out.push(table([
    ["버전", "작성자", "작성일자", "제,개정 사유"],
    [info.version, info.author, info.date, info.historyNote],
  ], { widths: [0.12, 0.28, 0.2, 0.4] }));
  out.push(pageBreak());
  // ---- 목차 (Word 필드, 열 때 갱신)
  out.push(para(run("Table of Contents", { bold: true, size: 28, color: "163A5F" }), { after: 240 }));
  out.push(`<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${run("목차는 Word 에서 필드 갱신(F9) 시 생성됩니다.", { color: "667085" })}<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`);
  out.push(pageBreak());
  // ---- 본문
  let firstH1 = true;
  for (const b of blocks) {
    if (b.type === "h") {
      const style = b.level === 1 ? "Heading1" : b.level === 2 ? "Heading2" : "Heading3";
      const o = { style, keepNext: true };
      if (b.level === 1 && !firstH1) o.pageBreakBefore = false;
      firstH1 = false;
      out.push(para(runs(b.text), o));
    } else if (b.type === "p") {
      out.push(para(runs(b.text), { after: 120 }));
    } else if (b.type === "li") {
      out.push(para(runs((b.num ? `${b.num}. ` : "• ") + b.text), { ind: 420, hanging: 280, after: 60 }));
    } else if (b.type === "table") {
      const cols = b.rows[0].length;
      let widths = null, center = [0, 1];
      if (b.spec && cols === 4) widths = [0.06, 0.11, 0.6, 0.23];
      else if (cols === 4) widths = [0.22, 0.18, 0.42, 0.18];
      else if (cols === 2) widths = [0.25, 0.75];
      else if (cols === 3) widths = [0.2, 0.55, 0.25];
      if (!b.spec) center = [];
      out.push(table(b.rows, { widths, center }));
    }
  }
  return out.join("");
}

function docxParts(bodyXml, info, ciPng) {
  const NS = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rIdHdr"/><w:footerReference w:type="default" r:id="rIdFtr"/><w:headerReference w:type="first" r:id="rIdHdrF"/><w:footerReference w:type="first" r:id="rIdFtrF"/><w:titlePg/><w:pgSz w:w="11906" w:h="16838" w:code="9"/><w:pgMar w:top="1701" w:right="851" w:bottom="1134" w:left="1531" w:header="851" w:footer="600" w:gutter="0"/></w:sectPr>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${bodyXml}${sect}</w:body></w:document>`;
  const hdrTab = `<w:tabs><w:tab w:val="right" w:pos="${W}"/></w:tabs>`;
  const hdrCx = 1290000, hdrCy = Math.round(hdrCx * 56 / 444);
  const hdrCi = ciPng ? `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${hdrCx}" cy="${hdrCy}"/><wp:docPr id="2" name="CI-header"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="2" name="kpbma-ci.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdCiH"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${hdrCx}" cy="${hdrCy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>` : run(`${info.org}`, { size: 18, color: "163A5F", bold: true });
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}><w:p><w:pPr><w:pStyle w:val="Header"/>${hdrTab}<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="163A5F"/></w:pBdr></w:pPr>${hdrCi}<w:r><w:tab/></w:r>${run(`${info.docNo}  기능 및 설계 규격서  |  ${info.team}조 ${info.system}  v${info.version}`, { size: 16, color: "163A5F" })}</w:p></w:hdr>`;
  const emptyHF = (tag) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${tag} ${NS}><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p></w:${tag}>`;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/>${hdrTab}</w:pPr>${run("한국제약바이오협회 CSV 실습과정  교육용 문서", { size: 16, color: "667085" })}<w:r><w:tab/></w:r>${run("Page ", { size: 16, color: "667085" })}<w:r><w:rPr>${FONTS}<w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${run("1", { size: 16 })}<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${FONTS}<w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US" w:eastAsia="ko-KR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="480" w:after="200"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="163A5F"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="140"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="0072CE"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="1F2933"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:after="60"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${W}"/></w:tabs></w:pPr><w:rPr><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:after="40"/><w:ind w:left="240"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${W}"/></w:tabs></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TOC3"><w:name w:val="toc 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:after="40"/><w:ind w:left="480"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${W}"/></w:tabs></w:pPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;
  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rIdHdrF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/><Relationship Id="rIdFtrF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>${ciPng ? `<Relationship Id="rIdCi" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>` : ""}</Relationships>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(info.docNo)} 기능 및 설계 규격서 ${xml(info.team)}조 ${xml(info.system)}</dc:title><dc:creator>${xml(info.author)}</dc:creator><cp:lastModifiedBy>${xml(info.author)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>GMP MVP Harness build-fds</Application></Properties>`;
  const parts = [
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", rels],
    ["docProps/core.xml", core],
    ["docProps/app.xml", app],
    ["word/document.xml", document],
    ["word/styles.xml", styles],
    ["word/settings.xml", settings],
    ["word/header1.xml", header],
    ["word/footer1.xml", footer],
    ["word/_rels/document.xml.rels", docRels],
    ["word/header2.xml", emptyHF("hdr")],
    ["word/footer2.xml", emptyHF("ftr")],
  ];
  if (ciPng) {
    parts.push(["word/media/image1.png", ciPng]);
    parts.push(["word/_rels/header1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdCiH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>`]);
  }
  return parts;
}

// ------------------------------------------------------------------ ZIP (store + deflate)
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function dosTime(d) { return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff; }
function dosDate(d) { return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff; }
function zip(parts) {
  const now = new Date();
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of parts) {
    const nameBuf = Buffer.from(name, "utf8");
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const deflated = deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const payload = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(dosTime(now), 10); lh.writeUInt16LE(dosDate(now), 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(payload.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(dosTime(now), 12); ch.writeUInt16LE(dosDate(now), 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(payload.length, 20);
    ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameBuf, payload);
    centrals.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + payload.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6); eocd.writeUInt16LE(parts.length, 8); eocd.writeUInt16LE(parts.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, eocd]);
}

// ------------------------------------------------------------------ main
if (!existsSync(IN)) {
  console.log(`[fds] 입력 파일이 없습니다: ${path.relative(ROOT, IN)} (docs/FDS_TEMPLATE.md 를 docs/FDS.md 로 복사해 작성합니다)`);
  process.exit(1);
}
const parsed = parseMarkdown(readFileSync(IN, "utf8"));
const sections = sectionize(parsed.blocks);
const v = validate(sections, parsed.meta);
const brand = readBrand();
const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const info = {
  docNo: parsed.meta["문서번호"] || "KPBMA-EDU-00X-FDS",
  system: parsed.meta["시스템명"] || brand.SYSTEM_NAME,
  systemEn: parsed.meta["영문명칭"] || "",
  team: (parsed.meta["조"] || brand.TEAM_NO).replace(/조$/, ""),
  version: parsed.meta["버전"] || "1.0",
  date: parsed.meta["작성일"] || kst,
  author: parsed.meta["작성자"] || "AI Agent (공급자 역할, 소프트웨어개발팀)",
  status: parsed.meta["문서상태"] || "초안 (검토 대기)",
  historyNote: parsed.meta["개정사유"] || "최초 작성 (구현 완료 시점의 시스템 현재 상태)",
  org: brand.ORG_NAME,
};

console.log(`[fds] 입력: ${path.relative(ROOT, IN)}  FS ${v.fsCount}건, DS ${v.dsCount}건`);
if (parsed.meta._coverage) {
  const c = parsed.meta._coverage;
  console.log(`[fds] URS 대조: 구현 조항 ${c.covered}/${c.target} 건이 FS 또는 DS 에 연결됨${c.unimpl.length ? `, 미구현 ${c.unimpl.length}건` : ""}`);
}
for (const w of v.warns) console.log(`  WARN  ${w}`);
for (const e of v.errors) console.log(`  ERROR ${e}`);
if (v.errors.length && !SAMPLE) {
  console.log(`[fds] 오류 ${v.errors.length}건. docs/FDS.md 를 고친 뒤 다시 실행합니다 (docs/FDS_GUIDE.md 참조).`);
  process.exit(1);
}
if (CHECK_ONLY) {
  console.log(`[fds] 검증 통과 (경고 ${v.warns.length}건).`);
  process.exit(0);
}
const ciPath = path.join(ROOT, "public", "kpbma-ci.png");
const ciPng = existsSync(ciPath) ? readFileSync(ciPath) : null;
info.ciRelId = ciPng ? "rIdCi" : null;
const body = buildDocument(parsed, info);
const buf = zip(docxParts(body, info, ciPng));
const safe = (s) => s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
const outPath = path.resolve(ROOT, opt("--out", SAMPLE ? "docs/FDS_SAMPLE.docx" : `docs/${safe(info.docNo)}_${safe(info.team)}조_${safe(info.system)}_v${safe(info.version)}.docx`));
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, buf);
console.log(`[fds] 생성: ${path.relative(ROOT, outPath)} (${(buf.length / 1024).toFixed(0)} KB). Word 에서 열면 목차 갱신을 묻습니다 (예 선택).`);
if (v.warns.length) console.log(`[fds] 경고 ${v.warns.length}건은 위 목록을 확인합니다.`);
