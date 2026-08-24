# SHEETS_SPEC: 구글 시트를 데이터베이스처럼 다루는 규격 코드

`lib/sheets.ts`는 구글 시트(Google Sheets API v4)를 표 단위 데이터 저장소로 쓰기 위한 규격 코드다. 하네스의 모든 데이터 접근은 이 파일의
네 함수로만 이루어지며, 누구도 이 파일을 수정하지 않는다. 이 문서는 그 함수의 사용 규칙과 원문, 무결성 확인 방법을 적는다.
FDS의 설계 규격(데이터 층)을 쓸 때 이 문서를 그대로 옮겨 적을 수 있다.

## 1. 데이터 모델 규칙

| 규칙 | 내용 |
|---|---|
| 탭 = 표 | 스프레드시트의 탭 하나가 표(테이블) 하나다. 탭명은 영문 대문자(USERS, AUDIT, EQUIPMENT 등) |
| 1행 = 헤더 | 1행이 열 이름이며 snake_case 영문이다. 모든 읽기와 쓰기는 헤더 이름으로 열을 찾는다(열 순서에 의존하지 않는다) |
| 첫 열 = id | 모든 탭의 첫 열은 `id`다. 값은 `lib/audit.ts`의 `newId()`(타임스탬프와 난수)로 만든다 |
| Append-only | 행 삭제 함수가 없다. 삭제는 상태 변경(`status` 등)과 AUDIT 기록 추가로만 표현한다 |
| 수정은 id 기준 | 행 수정은 `updateRowById`로만 한다. 바꾸는 열만 patch 에 넣고, 나머지 열은 그대로 유지된다 |
| 이력은 AUDIT | 누가 언제 무엇을 바꿨는지는 `lib/audit.ts`의 `logAudit`으로 AUDIT 탭에 남긴다(before_value, after_value, reason) |
| 값은 문자열 | 시트의 값은 모두 문자열로 읽힌다. 숫자, 날짜는 코드에서 변환한다. 저장 시각은 ISO, 표시는 `lib/kst.ts` |

## 2. 네 함수

| 함수 | 역할 | 주의 |
|---|---|---|
| `getRows(tab)` | 탭 전체를 읽어 `{헤더: 값}` 객체 배열로 돌려준다 | 탭이 비어 있거나 헤더가 없으면 빈 배열. 한 번에 전체를 읽으므로 큰 탭은 호출 횟수를 줄인다 |
| `appendRow(tab, row)` | 1행(헤더)을 읽고 헤더 순서대로 값을 맞춰 한 행을 추가한다 | 헤더에 없는 키의 값은 저장되지 않는다. 새 열이 필요하면 시트 1행에 열을 먼저 추가한다 |
| `updateRowById(tab, id, patch)` | id 로 행을 찾아 patch 의 열만 바꿔 쓴다 | 없는 id 면 오류(`row not found`). 동시 수정은 마지막 저장이 우선한다 |
| `ensureTab(tab, header)` | 탭이 없으면 만들고 1행에 헤더를 쓴다 | 이미 있는 탭의 헤더는 바꾸지 않는다(열 추가는 수동). `/api/seed`에서 모든 탭에 대해 호출한다 |

## 3. 사용 규칙

- 서버에서만 호출한다. 화면(클라이언트)은 반드시 `/api/*` 라우트를 거친다(`fetch`는 `cache: "no-store"`).
- 폴링(setInterval)을 쓰지 않는다. Sheets API 읽기 쿼터(분당 프로젝트 300회, 사용자 60회)를 넘기면 429 가 난다. 목록에는 수동 새로고침 버튼을 둔다.
- 한 요청에서 같은 탭을 여러 번 읽지 않는다. `getRows` 한 번으로 받아 코드에서 거른다.
- 차단 규칙과 상태 전이 검사는 서버 라우트에서 `getRows`로 현재 값을 읽어 판단한 뒤 `appendRow` 또는 `updateRowById`를 호출한다.
- 환경 변수 3종(`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`)이 필요하고, 대상 시트는 서비스 계정 이메일에 편집자로 공유되어야 한다.
- 열 추가가 필요하면 코드의 헤더 배열에 열을 추가하고, 기존 탭은 시트 1행 맨 끝에 같은 이름의 열을 손으로 추가한다. 열 이름 변경과 삭제는 하지 않는다.

## 4. 무결성 확인과 복원

- 기준 원문의 SHA-256(줄바꿈 LF 정규화): `45baa697290e715702cd87d0c715fc41e44ba7c06c56377f57e9ec03cdf88278`
- 확인: `npm run check:sheets` (`node scripts/check-sheets.mjs`). OK 가 아니면 파일이 바뀐 것이다. 원샷 빌드 STEP 4 와 커밋 준비 전에 실행한다.
- 복원: `npm run check:sheets -- --restore`. 스크립트 안의 기준 원문으로 `lib/sheets.ts`를 다시 쓴다. 복원 뒤 `npm run build`로 확인한다.
- 이 문서의 원문과 `scripts/check-sheets.mjs`의 원문은 같다. 규격 코드를 바꿔야 하는 일이 생기면(하네스 개정) 두 곳과 해시를 함께 바꾼다.

## 5. 원문 (lib/sheets.ts)

```ts
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
```
