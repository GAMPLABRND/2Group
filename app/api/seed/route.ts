import { NextResponse } from "next/server";
import { appendRow, ensureTab, getRows } from "@/lib/sheets";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { INITIAL_PASSWORD } from "@/lib/brand";
import { nowISO } from "@/lib/kst";
import { SEED_EQUIPMENT, SEED_USERS, TAB_HEADERS, type TabName } from "@/lib/schema";
import { appendMissingHeaders } from "@/lib/schema-migration";
import { DEFAULT_TRAINING_MEMBERS } from "@/lib/training-profile";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const REQUIRED_ENV = ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_SHEET_ID"] as const;

type SeedRow = Record<string, unknown> & { id: string };

async function appendMissing(tab: TabName, seeds: SeedRow[], naturalKey = "id") {
  const existing = await getRows(tab);
  const existingKeys = new Set(existing.map((row) => row[naturalKey]).filter(Boolean));
  const created: string[] = [];
  const skipped: string[] = [];
  for (const seed of seeds) {
    const key = String(seed[naturalKey] ?? seed.id);
    if (existingKeys.has(key)) {
      skipped.push(seed.id);
      continue;
    }
    await appendRow(tab, seed);
    existingKeys.add(key);
    created.push(seed.id);
  }
  return { created, skipped };
}

async function runSeed() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    return NextResponse.json(
      { ok: false, error: "Google Sheets 연결 환경 변수가 누락되었습니다. 설정을 완료한 후 다시 시도하세요." },
      { status: 503 },
    );
  }

  for (const [tab, header] of Object.entries(TAB_HEADERS) as [TabName, readonly string[]][]) {
    await ensureTab(tab, [...header]);
    await appendMissingHeaders(tab, header);
  }

  const existingUsers = await getRows("USERS");
  const session = await getSession();
  if (existingUsers.length > 0 && (!session || session.role !== "ADMIN")) {
    if (session) {
      await logAudit({
        category: "SECURITY",
        actor: { id: session.userId, name: session.userId, role: session.role },
        action: "SECURITY.ACCESS_DENIED",
        target: "API:/api/seed",
        reason: "초기화된 시스템의 시드 재실행은 관리자만 할 수 있습니다.",
      });
    }
    return NextResponse.json(
      { ok: false, error: "초기화된 시스템의 시드 재실행은 관리자만 할 수 있습니다." },
      { status: session ? 403 : 401 },
    );
  }

  const startedAt = nowISO();
  const passwordExpiresAt = new Date(
    new Date(startedAt).getTime() + 90 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const userSeeds: SeedRow[] = SEED_USERS.map((user) => ({
    ...user,
    password: INITIAL_PASSWORD,
    status: "ACTIVE",
    permission_overrides: "",
    password_changed_at: startedAt,
    password_expires_at: passwordExpiresAt,
    failed_login_count: "0",
    locked_at: "",
    created_at: startedAt,
    updated_at: startedAt,
  }));
  const equipmentSeeds: SeedRow[] = SEED_EQUIPMENT.map((equipment) => ({
    ...equipment,
    availability_status: "AVAILABLE",
    occupancy_status: "FREE",
    occupancy_record_id: "",
    occupied_by_user_id: "",
    occupied_by_user_name: "",
    occupied_at: "",
    created_by: "SYSTEM",
    created_at: startedAt,
    updated_by: "SYSTEM",
    updated_at: startedAt,
  }));
  const securitySeeds: SeedRow[] = [{
    id: "security-settings-default",
    min_password_length: "4",
    require_uppercase: "false",
    require_lowercase: "false",
    require_digit: "false",
    require_special: "false",
    password_validity_days: "90",
    max_failed_login_attempts: "5",
    idle_timeout_minutes: "30",
    updated_by: "SYSTEM",
    updated_at: startedAt,
  }];
  const profileSeeds: SeedRow[] = [{
    id: "training-profile-default",
    company_name: "한국제약바이오협회",
    trainee_name: "실습자1",
    team_no: "2",
    updated_by: "SYSTEM",
    updated_at: startedAt,
    members_json: JSON.stringify(DEFAULT_TRAINING_MEMBERS),
  }];
  const backupSettingsSeeds: SeedRow[] = [{
    id: "backup-settings-default",
    interval_days: "1",
    execution_time: "13:00",
    enabled: "false",
    timezone: "Asia/Seoul",
    updated_by: "SYSTEM",
    updated_at: startedAt,
  }];
  const historySeeds: SeedRow[] = SEED_USERS.map((user) => ({
    id: `TRAINING-${user.user_id.toUpperCase()}`,
    user_id: user.user_id,
    course_name: "CSV실습과정 2조 전자로그북",
    completed_at: startedAt,
    recorded_by: "SYSTEM",
    status: "COMPLETED",
  }));

  const results = {
    USERS: await appendMissing("USERS", userSeeds, "user_id"),
    SECURITY_SETTINGS: await appendMissing("SECURITY_SETTINGS", securitySeeds),
    TRAINING_PROFILE: await appendMissing("TRAINING_PROFILE", profileSeeds),
    TRAINING_HISTORY: await appendMissing("TRAINING_HISTORY", historySeeds),
    EQUIPMENT: await appendMissing("EQUIPMENT", equipmentSeeds, "equipment_code"),
    BACKUP_SETTINGS: await appendMissing("BACKUP_SETTINGS", backupSettingsSeeds),
  };
  const createdCount = Object.values(results).reduce((sum, result) => sum + result.created.length, 0);
  const skippedCount = Object.values(results).reduce((sum, result) => sum + result.skipped.length, 0);

  if (createdCount > 0) {
    await logAudit({
      category: "DATA",
      actor: { id: "SYSTEM", name: "System", role: "SYSTEM" },
      action: "DATA.SEED_COMPLETED",
      target: "SYSTEM:FIRST_START",
      after: JSON.stringify({ created_count: createdCount, tabs: Object.keys(TAB_HEADERS) }),
      reason: "교육용 기준정보 최초 생성",
    });
  }

  return NextResponse.json({
    ok: true,
    tabs: Object.keys(TAB_HEADERS),
    created_count: createdCount,
    skipped_count: skippedCount,
    results,
    message: `시드가 완료되었습니다. 로그인 화면에서 계정을 선택하고 초기 비밀번호 ${INITIAL_PASSWORD}로 로그인하세요.`,
  });
}

export async function GET() {
  try {
    return await runSeed();
  } catch {
    return NextResponse.json(
      { ok: false, error: "시드를 완료하지 못했습니다. 시트 공유와 Google Sheets API 설정을 확인한 후 다시 시도하세요." },
      { status: 503 },
    );
  }
}

export async function POST() {
  return GET();
}
