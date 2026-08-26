import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json(
    { error: "자동 백업은 중단되었습니다. ADMIN이 백업 화면에서 파일을 생성한 후 브라우저로 사용자 PC에 저장해야 합니다." },
    { status: 410 },
  );
}
