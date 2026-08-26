"use client";

import { useState, type FormEvent } from "react";

import { Banner, Button, Card, Field, Table, Td, TextInput, StatusBadge } from "@/components/ui";
import { toKST } from "@/lib/kst";
import type { BackupRun } from "@/types";

function fileSize(bytes: number) {
  if (!bytes) return "해당 없음";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scopeLabel(value: string) {
  try {
    const tabs = JSON.parse(value) as unknown;
    return Array.isArray(tabs) ? `전체 관련 데이터 (${tabs.length}개 탭)` : value;
  } catch {
    return value || "전체 관련 데이터";
  }
}

function statusBadge(status: BackupRun["status"]) {
  if (status === "COMPLETED") return <StatusBadge value="APPROVED" label="완료" />;
  if (status === "FAILED") return <StatusBadge value="FAIL" label="실패" />;
  return <StatusBadge value="IN_USE" label="실행 중" />;
}

export default function BackupClient({ runs }: { runs: BackupRun[] }) {
  const [manualReason, setManualReason] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function runBackup(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!manualReason.trim()) {
      setMessage("수동 백업 실행 사유를 입력하세요.");
      return;
    }
    setWorking(true);
    try {
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: manualReason }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "백업 파일을 생성하지 못했습니다.");
      }
      const blob = await response.blob();
      const fileName = response.headers.get("X-Backup-Filename") || "backup.xlsx";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setManualReason("");
      setMessage(`백업이 완료되었습니다. 브라우저 다운로드에서 ${fileName} 파일을 사용자 PC에 저장하세요.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "백업을 실행하지 못했습니다.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="grid gap-6">
      {message ? <Banner kind={message.includes("완료") ? "success" : "error"}>{message}</Banner> : null}

      <Card title="백업 파일 생성 및 다운로드">
        <form onSubmit={runBackup} className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <Field label="실행 사유" required>
              <TextInput required value={manualReason} onChange={(event) => setManualReason(event.target.value)} />
            </Field>
          </div>
          <Button type="submit" disabled={working}>{working ? "백업 파일 생성 중" : "백업 완료 후 다운로드"}</Button>
        </form>
        <p className="mt-3 text-xs text-ink-muted">백업 파일은 시스템의 Google Drive 경로에 저장되지 않습니다. 생성이 완료되면 브라우저 다운로드 기능으로 사용자 PC에 직접 저장합니다.</p>
      </Card>

      <Card title={`백업 이력 ${runs.length}건`}>
        <Table columns={[
          { label: "백업 일자", width: "120px" },
          { label: "시작 일시", width: "190px" },
          { label: "완료 일시", width: "190px" },
          { label: "상태", width: "100px", align: "center" },
          { label: "백업 범위", width: "190px", nowrap: false },
          { label: "파일 형식", width: "100px", align: "center" },
          { label: "파일명", width: "245px", nowrap: false },
          { label: "파일 크기", width: "110px", align: "right" },
          { label: "오류 내용", width: "220px", nowrap: false },
          { label: "저장 방식", width: "150px", align: "center" },
        ]} empty="백업 실행 이력이 없습니다." density="compact">
          {runs.map((run) => (
            <tr key={run.id}>
              <Td nowrap code>{run.backupDate}</Td>
              <Td nowrap code>{run.startedAt ? toKST(run.startedAt, true) : "해당 없음"}</Td>
              <Td nowrap code>{run.completedAt ? toKST(run.completedAt, true) : "진행 중"}</Td>
              <Td align="center">{statusBadge(run.status)}</Td>
              <Td clamp={2}>{scopeLabel(run.backupScope)}</Td>
              <Td align="center" code>.xlsx</Td>
              <Td clamp={2} code>{run.fileName || "해당 없음"}</Td>
              <Td num>{fileSize(run.fileSizeBytes)}</Td>
              <Td clamp={2}>{run.errorMessage || "해당 없음"}</Td>
              <Td align="center">{run.status === "COMPLETED" ? "사용자 PC" : "해당 없음"}</Td>
            </tr>
          ))}
        </Table>
        <p className="mt-3 text-xs text-ink-muted">이력에는 생성 시각, 파일명, 크기와 SHA-256 해시만 저장합니다. 백업 파일 자체는 시스템에 보관하지 않으므로 과거 이력에서 다시 다운로드할 수 없습니다.</p>
      </Card>
    </div>
  );
}
