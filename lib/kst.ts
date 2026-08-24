// 시각 규칙: 저장은 ISO(UTC), 표시는 KST (CLAUDE.md 기술 규칙).

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function nowISO(): string {
  return new Date().toISOString();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO 저장값 → "YYYY-MM-DD HH:mm (KST)" 표기. withSeconds는 감사추적처럼 초가 필요한 곳에 사용. */
export function toKST(iso: string | Date, withSeconds = false): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return String(iso);
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  const base = `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(
    k.getUTCDate()
  )} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
  return withSeconds ? `${base}:${pad(k.getUTCSeconds())} (KST)` : `${base} (KST)`;
}

export function nowKST(withSeconds = false): string {
  return toKST(new Date(), withSeconds);
}
