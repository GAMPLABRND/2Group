"use client";

import { useState } from "react";
import { Banner, Button } from "@/components/ui";
import type { AuditFilters } from "@/app/api/audit/query";

export default function AuditActions({ filters }: { filters: AuditFilters }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function downloadCsv() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/audit/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "CSV 파일을 만들지 못했습니다.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "audit-report.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV 파일을 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" variant="secondary" onClick={downloadCsv} disabled={busy}>
        {busy ? "CSV 준비 중" : "CSV 내보내기"}
      </Button>
      {error ? <Banner kind="error">{error}</Banner> : null}
    </div>
  );
}
