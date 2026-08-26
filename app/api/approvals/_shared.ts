import { NextResponse } from "next/server";

import { getApiSession } from "@/lib/auth";
import { TAB_HEADERS } from "@/lib/schema";
import { getRows } from "@/lib/sheets";
import type { Role, UserRow } from "@/types";

export const ACCESS_DENIED_MESSAGE =
  "권한이 없는 화면 또는 기능에 접근을 시도하면 접근이 차단되고 안내 메시지가 표시된 후 메인 화면으로 이동한다.";
export const REQUIRED_FIELD_MESSAGE =
  "필수 입력 항목이 누락된 경우 기록을 저장할 수 없으며 누락된 항목을 안내해야 한다.";
export const INVALID_TRANSITION_MESSAGE = "허용되지 않은 상태 전이는 차단되어야 한다.";
export const REVIEWED_LOCK_MESSAGE =
  "검토완료 (전자서명 완료) 된 기록은 기존 값을 직접 수정할 수 없어야 한다.";

type CanonicalTab = keyof typeof TAB_HEADERS;
export const D3_TABS = {
  users: "USERS",
  equipment: "EQUIPMENT",
  records: "USE_RECORDS",
  remediations: "EQUIPMENT_REMEDIATIONS",
  resumeRequests: "EQUIPMENT_RESUME_REQUESTS",
} satisfies Record<string, CanonicalTab>;

export type AuthenticatedActor = {
  id: string;
  name: string;
  role: Role;
  password: string;
};

export function errorResponse(error: string, status: number, fields?: string[]) {
  return NextResponse.json(fields?.length ? { error, fields } : { error }, { status });
}

export async function authenticateActor(
  roles: Role[],
  permission?: string,
  target?: string,
): Promise<{ actor: AuthenticatedActor } | { response: NextResponse }> {
  const session = await getApiSession(roles, permission, target);
  if (!session) return { response: errorResponse(ACCESS_DENIED_MESSAGE, 403) };

  const users = (await getRows(D3_TABS.users)) as UserRow[];
  const user = users.find((row) => row.user_id === session.userId);
  if (!user || user.status !== "ACTIVE" || user.role !== session.role) {
    return { response: errorResponse(ACCESS_DENIED_MESSAGE, 403) };
  }

  return {
    actor: {
      id: user.user_id,
      name: user.name,
      role: session.role,
      password: user.password,
    },
  };
}

export function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
