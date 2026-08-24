import { google } from "googleapis";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

export async function getRows(tab: string): Promise<Record<string, string>[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `${tab}!A1:ZZ`,
  });
  const [header, ...rows] = res.data.values || [];
  if (!header) return [];
  return rows.map((r) =>
    Object.fromEntries(header.map((h: string, i: number) => [h, r[i] ?? ""]))
  );
}

export async function appendRow(tab: string, row: Record<string, unknown>) {
  const head = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `${tab}!1:1`,
  });
  const header = (head.data.values?.[0] || []) as string[];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID, range: `${tab}!A1`, valueInputOption: "RAW",
    requestBody: { values: [header.map((h) => String(row[h] ?? ""))] },
  });
}

export async function updateRowById(
  tab: string, id: string, patch: Record<string, unknown>
) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `${tab}!A1:ZZ`,
  });
  const values = res.data.values || [];
  const header = (values[0] || []) as string[];
  const idCol = header.indexOf("id");
  const rowIdx = values.findIndex((r, i) => i > 0 && r[idCol] === id);
  if (rowIdx < 0) throw new Error(`row not found: ${tab}/${id}`);
  const updated = header.map((h, i) =>
    h in patch ? String(patch[h]) : String(values[rowIdx][i] ?? "")
  );
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID, range: `${tab}!A${rowIdx + 1}`,
    valueInputOption: "RAW", requestBody: { values: [updated] },
  });
}

export async function ensureTab(tab: string, header: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === tab);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: `${tab}!A1`,
      valueInputOption: "RAW", requestBody: { values: [header] },
    });
  }
}
