import { NextResponse } from "next/server";
import { appendRow, ensureTab, getRows } from "@/lib/sheets";
import { AUDIT_HEADER, AUDIT_TAB, logAudit, newId } from "@/lib/audit";
import { nowISO } from "@/lib/kst";
import { INITIAL_PASSWORD } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const USERS_TAB = "USERS";
const USERS_HEADER = ["id", "user_id", "name", "password", "role", "status", "created_at"];

// 시드 계정. 계정 ID, 이름, 역할 코드는 조가 제공한 URS (§6.1 역할 정의, §7.6 시드 계정) 를 따르며 STEP 2~3 에서
// builder-d4 가 이 배열을 URS 값으로 바꾼다. 아래는 URS 를 읽기 전의 자리표시 기본값이다.
// 첫 빌드에서는 모든 계정의 비밀번호를 lib/brand.ts 의 INITIAL_PASSWORD("1234") 로 통일한다 (QA 편의). 배포 전에 비밀번호 변경 화면에서 바꾼다.
const SEED_USERS = [
  { user_id: "admin", name: "관리자", role: "ADMIN" },
  { user_id: "user", name: "작업자", role: "USER" },
  { user_id: "reviewer", name: "검토자", role: "REVIEWER" },
];

const REQUIRED_ENV = [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_SHEET_ID",
] as const;

async function runSeed() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `Google Sheets 환경 변수 누락: ${missing.join(
          ", "
        )}. .env.local(또는 Vercel 환경 변수) 설정 후 다시 호출하세요.`,
      },
      { status: 500 }
    );
  }

  await ensureTab(USERS_TAB, USERS_HEADER);
  await ensureTab(AUDIT_TAB, AUDIT_HEADER);

  // 멱등성: 이미 있는 user_id는 건너뛴다 (재호출 시 중복 생성 금지)
  const existing = await getRows(USERS_TAB);
  const created: string[] = [];
  const skipped: string[] = [];
  for (const u of SEED_USERS) {
    if (existing.some((r) => r.user_id === u.user_id)) {
      skipped.push(u.user_id);
      continue;
    }
    await appendRow(USERS_TAB, {
      id: newId(),
      ...u,
      password: INITIAL_PASSWORD,
      status: "ACTIVE",
      created_at: nowISO(),
    });
    created.push(u.user_id);
  }

  if (created.length > 0) {
    await logAudit({
      category: "DATA",
      actor: { id: "system", name: "seed" },
      action: "SEED_USERS",
      after: created.join(","),
    });
  }

  // TODO(builder-d4): URS MVP 빌드 STEP 3에서 업무 탭 전체 ensureTab + URS §7.6 시드 데이터
  // (예: 장비 3건, 그중 교정 만료 1건)를 여기에 추가한다 (멱등성 유지 필수, 재호출 시 중복 생성 금지).
  // 시드 계정의 비밀번호는 INITIAL_PASSWORD 를 그대로 둔다.

  return NextResponse.json({
    ok: true,
    tabs: [USERS_TAB, AUDIT_TAB],
    created,
    skipped,
    message: `시드 완료. 로그인 화면에서 계정을 선택하고 비밀번호 ${INITIAL_PASSWORD} 로 확인하세요.`,
  });
}

export async function GET() {
  try {
    return await runSeed();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        error: `시드 실패: ${msg}. 시트 공유(서비스 계정 편집자), GOOGLE_SHEET_ID, Sheets API 활성화 여부를 확인하세요.`,
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
