import { NextResponse } from "next/server";

import { auditActor, authorizeRequest } from "@/app/api/admin/_utils";
import {
  BackupOperationError,
  executeBackup,
  getBackupRuns,
} from "@/lib/backup";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

async function authorize() {
  return authorizeRequest("/api/backup", ["ADMIN"]);
}

function errorResponse(error: unknown) {
  if (error instanceof BackupOperationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "백업 작업을 처리하지 못했습니다." }, { status: 503 });
}

export async function GET() {
  const authorization = await authorize();
  if (!authorization.ok) return authorization.response;
  try {
    const runs = await getBackupRuns();
    await logAudit({
      category: "SYSTEM",
      actor: auditActor(authorization.value.user),
      action: "SYSTEM.BACKUP_VIEWED",
      target: "BACKUP:LIST",
      after: JSON.stringify({ count: runs.length }),
    });
    return NextResponse.json({ runs });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const authorization = await authorize();
  if (!authorization.ok) return authorization.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const reason = String(body.reason ?? "").trim();
    if (!reason) throw new BackupOperationError("수동 백업 실행 사유를 입력하세요.", 400);
    const actor = auditActor(authorization.value.user);
    const { run, bytes } = await executeBackup(actor, reason);
    await logAudit({
      category: "SYSTEM",
      actor,
      action: "SYSTEM.BACKUP_DOWNLOADED",
      target: `BACKUP:${run.id}`,
      after: JSON.stringify({ file_name: run.fileName, file_size_bytes: bytes.length, sha256: run.sha256, delivery_method: "BROWSER_DOWNLOAD" }),
    });
    return new NextResponse(new Uint8Array(bytes), {
      status: 201,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${run.fileName}"`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Backup-Filename": run.fileName,
        "X-Backup-Id": run.id,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorize();
  if (!authorization.ok) return authorization.response;
  void request;
  return NextResponse.json(
    { error: "백업은 브라우저에서 사용자가 직접 실행하고 PC에 저장하는 방식으로만 제공됩니다." },
    { status: 410 },
  );
}
