import { NextResponse } from "next/server";

import { authorizeRequest } from "@/app/api/admin/_utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const authorization = await authorizeRequest(
    "/api/backup/[backupId]/download",
    ["ADMIN"],
  );
  if (!authorization.ok) return authorization.response;

  return NextResponse.json(
    { error: "백업 파일은 시스템에 보관되지 않습니다. 백업 화면에서 새 파일을 생성하여 브라우저로 다운로드하세요." },
    { status: 410 },
  );
}
