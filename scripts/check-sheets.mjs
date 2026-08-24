#!/usr/bin/env node
// lib/sheets.ts 무결성 확인과 복원.
//   node scripts/check-sheets.mjs            현재 파일의 SHA-256 을 기준값과 비교한다 (줄바꿈은 LF 로 정규화).
//   node scripts/check-sheets.mjs --restore  기준 원문으로 lib/sheets.ts 를 다시 쓴다.
//   node scripts/check-sheets.mjs --print    기준 원문을 출력한다.
// 기준값과 원문은 docs/SHEETS_SPEC.md 와 같다. 원문을 바꿀 일이 생기면 두 곳을 함께 바꾼다.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "lib", "sheets.ts");
const EXPECTED_SHA256 = "45baa697290e715702cd87d0c715fc41e44ba7c06c56377f57e9ec03cdf88278";
const CANONICAL_SOURCE = JSON.parse("\"import { google } from \\\"googleapis\\\";\\n\\nconst auth = new google.auth.JWT({\\n  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,\\n  key: (process.env.GOOGLE_PRIVATE_KEY || \\\"\\\").replace(/\\\\\\\\n/g, \\\"\\\\n\\\"),\\n  scopes: [\\\"https://www.googleapis.com/auth/spreadsheets\\\"],\\n});\\nconst sheets = google.sheets({ version: \\\"v4\\\", auth });\\nconst SHEET_ID = process.env.GOOGLE_SHEET_ID!;\\n\\nexport async function getRows(tab: string): Promise<Record<string, string>[]> {\\n  const res = await sheets.spreadsheets.values.get({\\n    spreadsheetId: SHEET_ID, range: `${tab}!A1:ZZ`,\\n  });\\n  const [header, ...rows] = res.data.values || [];\\n  if (!header) return [];\\n  return rows.map((r) =>\\n    Object.fromEntries(header.map((h: string, i: number) => [h, r[i] ?? \\\"\\\"]))\\n  );\\n}\\n\\nexport async function appendRow(tab: string, row: Record<string, unknown>) {\\n  const head = await sheets.spreadsheets.values.get({\\n    spreadsheetId: SHEET_ID, range: `${tab}!1:1`,\\n  });\\n  const header = (head.data.values?.[0] || []) as string[];\\n  await sheets.spreadsheets.values.append({\\n    spreadsheetId: SHEET_ID, range: `${tab}!A1`, valueInputOption: \\\"RAW\\\",\\n    requestBody: { values: [header.map((h) => String(row[h] ?? \\\"\\\"))] },\\n  });\\n}\\n\\nexport async function updateRowById(\\n  tab: string, id: string, patch: Record<string, unknown>\\n) {\\n  const res = await sheets.spreadsheets.values.get({\\n    spreadsheetId: SHEET_ID, range: `${tab}!A1:ZZ`,\\n  });\\n  const values = res.data.values || [];\\n  const header = (values[0] || []) as string[];\\n  const idCol = header.indexOf(\\\"id\\\");\\n  const rowIdx = values.findIndex((r, i) => i > 0 && r[idCol] === id);\\n  if (rowIdx < 0) throw new Error(`row not found: ${tab}/${id}`);\\n  const updated = header.map((h, i) =>\\n    h in patch ? String(patch[h]) : String(values[rowIdx][i] ?? \\\"\\\")\\n  );\\n  await sheets.spreadsheets.values.update({\\n    spreadsheetId: SHEET_ID, range: `${tab}!A${rowIdx + 1}`,\\n    valueInputOption: \\\"RAW\\\", requestBody: { values: [updated] },\\n  });\\n}\\n\\nexport async function ensureTab(tab: string, header: string[]) {\\n  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });\\n  const exists = meta.data.sheets?.some((s) => s.properties?.title === tab);\\n  if (!exists) {\\n    await sheets.spreadsheets.batchUpdate({\\n      spreadsheetId: SHEET_ID,\\n      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },\\n    });\\n    await sheets.spreadsheets.values.update({\\n      spreadsheetId: SHEET_ID, range: `${tab}!A1`,\\n      valueInputOption: \\\"RAW\\\", requestBody: { values: [header] },\\n    });\\n  }\\n}\\n\"");

function sha256(text) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

const arg = process.argv[2] || "";
if (arg === "--print") {
  process.stdout.write(CANONICAL_SOURCE);
} else if (arg === "--restore") {
  writeFileSync(TARGET, CANONICAL_SOURCE, "utf8");
  console.log(`[check-sheets] restored lib/sheets.ts from canonical source (sha256 ${EXPECTED_SHA256.slice(0, 12)}...)`);
} else {
  if (!existsSync(TARGET)) {
    console.log("[check-sheets] MISSING lib/sheets.ts. Run: npm run check:sheets -- --restore");
    process.exitCode = 1;
  } else {
    const actual = sha256(readFileSync(TARGET, "utf8"));
    if (actual === EXPECTED_SHA256) {
      console.log(`[check-sheets] OK lib/sheets.ts unchanged (sha256 ${actual.slice(0, 12)}...)`);
    } else {
      console.log(`[check-sheets] MISMATCH lib/sheets.ts was modified (sha256 ${actual.slice(0, 12)}... expected ${EXPECTED_SHA256.slice(0, 12)}...)`);
      console.log("  lib/sheets.ts must not be modified. Restore with: npm run check:sheets -- --restore");
      process.exitCode = 1;
    }
  }
}
