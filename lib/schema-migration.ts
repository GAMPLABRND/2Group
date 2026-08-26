import { google } from "googleapis";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const sheetId = process.env.GOOGLE_SHEET_ID!;

function columnName(index: number) {
  let value = index;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

export async function appendMissingHeaders(tab: string, expectedHeaders: readonly string[]) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tab}!1:1`,
  });
  const currentHeaders = (response.data.values?.[0] || []) as string[];
  const existing = new Set(currentHeaders);
  const missing = expectedHeaders.filter((header) => !existing.has(header));
  if (!missing.length) return [];

  const startColumn = columnName(currentHeaders.length + 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tab}!${startColumn}1`,
    valueInputOption: "RAW",
    requestBody: { values: [missing] },
  });
  return missing;
}
