"use client";

// 공용 UI 최소 세트. 공유 파일이므로 오케스트레이터만 수정한다 (CLAUDE.md 파일 소유권 규칙).
// 빌더 에이전트는 이 컴포넌트들을 그대로 조합해 화면을 만든다. 모양은 design.md 의 토큰과 컴포넌트 규격을 따르며,
// 색상은 globals.css 의 @theme 토큰 클래스(bg-primary, text-ink-muted, border-line 등)만 쓴다. UI는 Tailwind만 사용.

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useState } from "react";

import { CI_SRC, ORG_NAME } from "@/lib/brand";

/** 화면 제목 영역: 제목(네이비 24px) + 한 줄 설명 + 우측 동작 버튼 */
export function PageTitle({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

/** 문서형 카드: 흰 바탕, 16px 라운드, 얇은 테두리, 은은한 그림자. title 은 카드 안 소제목(15px) */
export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-6 rounded-card border border-line bg-white p-6 shadow-card ${className}`}>
      {title ? <h2 className="mb-4 text-[15px] font-bold text-primary-dark">{title}</h2> : null}
      {children}
    </section>
  );
}

/** 대시보드 집계 타일: 라벨(회색 12.5px) + 값(네이비 26px). tone 으로 값 색을 바꾼다 */
export function Kpi({
  label,
  value,
  tone = "navy",
}: {
  label: string;
  value: ReactNode;
  tone?: "navy" | "primary" | "success" | "warning" | "danger";
}) {
  const color = {
    navy: "text-primary-dark",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];
  return (
    <div className="rounded-xl border border-line bg-muted p-4 text-center">
      <div className="text-[12.5px] font-semibold text-ink-muted">{label}</div>
      <div className={`mt-1.5 text-[26px] font-extrabold leading-tight ${color}`}>{value}</div>
    </div>
  );
}

const BUTTON_STYLES = {
  primary: "bg-primary text-white hover:bg-[#005bb2]",
  secondary: "border border-line bg-white text-ink hover:bg-muted",
  danger: "bg-danger text-white hover:bg-[#d32f2f]",
} as const;

/** 알약형 버튼. primary(주 동작), secondary(취소, 보조), danger(반려, 무효 처리) */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_STYLES;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-3 py-1 text-xs" : "px-5 py-2 text-sm";
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-semibold transition-colors active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${pad} ${BUTTON_STYLES[variant]} ${className}`}
    />
  );
}

/** 폼 한 줄: 라벨(굵게, 필수는 빨간 별표) + 입력 + 도움말 또는 오류 */
export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[13.5px] font-bold text-ink">
        {label} {required ? <span className="text-danger">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-semibold text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-muted">{hint}</span>
      ) : null}
    </label>
  );
}

const INPUT_CLASS =
  "w-full rounded-input border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition " +
  "focus:border-primary focus:ring-[3px] focus:ring-primary/15 disabled:bg-muted read-only:bg-muted";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_CLASS} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT_CLASS} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT_CLASS} ${props.className ?? ""}`} />;
}

/** 목록 표의 열 규격. width 로 열 폭을 고정하고 align 으로 머리글 정렬을 정한다 (design.md 6.2) */
export type TableColumn = {
  label: string;
  width?: string; // colgroup 인라인 style 로 적용. "120px", "12%" 형식
  align?: "left" | "center" | "right"; // 머리글 정렬. 기본 left
  nowrap?: boolean; // 머리글 줄바꿈 금지. 기본 true 동작을 유지한다
};

// 정렬 클래스는 정적 분기로 만든다. Tailwind 는 컴파일 시점에 클래스를 생성하므로 템플릿 문자열로 만들지 않는다.
const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

const CLAMP_CLASS = {
  1: "cell-clamp-1",
  2: "cell-clamp-2",
  3: "cell-clamp-3",
} as const;

/** 목록 테이블. columns(열 폭과 정렬) 또는 headers 순서에 맞춰 <tr><td>…</td></tr> 행들을 children 으로 넣는다. 셀 여백은 Table 이 소유한다 */
export function Table({
  headers,
  columns,
  children,
  empty,
  density = "normal",
}: {
  headers?: string[];
  columns?: TableColumn[];
  children?: ReactNode;
  empty?: string;
  density?: "normal" | "compact";
}) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);
  const cols: TableColumn[] | undefined = columns ?? headers?.map((h) => ({ label: h }));
  const colSpan = columns?.length ?? headers?.length ?? 1;
  // 안전망: 항상 overflow 상자 + table-fixed. 열 폭이 어긋나도 표는 카드 폭을 넘지 못하고 카드 안 스크롤로 갇힌다.
  const wrapClass = "overflow-x-auto rounded-lg border border-line bg-white print:rounded-none print:border-0";
  const tableClass = "w-full table-fixed text-left text-[13.5px]";
  const headCellClass = density === "compact" ? "px-3 py-2.5 font-bold" : "px-4 py-3 font-bold";
  const bodyCellClass =
    density === "compact"
      ? "[&_td]:align-top [&_td]:px-3 [&_td]:py-2 [&_td]:overflow-hidden [&_td]:break-words"
      : "[&_td]:align-top [&_td]:px-4 [&_td]:py-2.5 [&_td]:overflow-hidden [&_td]:break-words";
  return (
    <div className={wrapClass}>
      <table className={tableClass}>
        {columns ? (
          <colgroup>
            {columns.map((c, i) => (
              <col key={`${c.label}-${i}`} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>
        ) : null}
        {cols ? (
          <thead className="border-b border-line bg-muted text-primary-dark">
            <tr>
              {cols.map((c, i) => (
                <th
                  key={`${c.label}-${i}`}
                  className={`${c.nowrap === false ? "" : "cell-nowrap "}${headCellClass} ${
                    ALIGN_CLASS[c.align ?? "left"]
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody className={`divide-y divide-line [&>tr:hover]:bg-primary-soft ${bodyCellClass}`}>
          {isEmpty ? (
            <tr>
              <td colSpan={colSpan} className="text-center text-ink-muted">
                {/* 셀 여백은 tbody 가 소유하므로 빈 상태의 위아래 여백은 안쪽 div 로 준다 */}
                <div className="py-7">{empty ?? "데이터가 없습니다."}</div>
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

/** 표 본문 셀. 정렬과 줄바꿈만 담당한다(여백은 Table 소유). num 은 오른쪽 정렬과 자릿수 고정, code 는 코드와 문서번호, clamp 는 줄 수 상한 */
export function Td({
  align = "left",
  nowrap,
  num,
  code,
  clamp,
  colSpan,
  className = "",
  children,
}: {
  align?: "left" | "center" | "right";
  nowrap?: boolean;
  num?: boolean;
  code?: boolean;
  clamp?: 1 | 2 | 3;
  colSpan?: number;
  className?: string;
  children?: ReactNode;
}) {
  const alignClass = num ? "cell-num" : ALIGN_CLASS[align];
  const nowrapClass = nowrap ? "cell-nowrap" : "";
  const codeClass = code ? "cell-code" : "";
  const clampClass = clamp ? CLAMP_CLASS[clamp] : "";
  // clamp 는 셀 안쪽 요소에 붙인다. display: -webkit-box 를 td 에 직접 주면 table-cell 이 풀려 표 레이아웃이 깨진다.
  return (
    <td colSpan={colSpan} className={`${alignClass} ${nowrapClass} ${codeClass} ${className}`}>
      {clampClass ? <span className={clampClass}>{children}</span> : children}
    </td>
  );
}

/** 표 머리글 셀. Table 의 thead 밖에서 머리글을 직접 만들 때 쓴다 */
export function Th({
  align = "left",
  nowrap = true,
  className = "",
  children,
}: {
  align?: "left" | "center" | "right";
  nowrap?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const alignClass = ALIGN_CLASS[align];
  const nowrapClass = nowrap ? "whitespace-nowrap" : "";
  return <th className={`px-4 py-3 font-bold ${alignClass} ${nowrapClass} ${className}`}>{children}</th>;
}

/** 상세 정보 목록. 라벨 160px 고정 + 값 좌측 정렬의 정의형 목록이며 긴 값은 full 로 두 열을 다 쓴다 (design.md 6.6) */
export function DescList({
  items,
  cols = 2,
}: {
  items: { label: string; value: ReactNode; full?: boolean }[];
  cols?: 1 | 2;
}) {
  // 브레이크포인트가 아니라 컨테이너 폭을 기준으로 전환한다. 좁은 모달 안에서 2열이 되면 값이 세로로 쪼개진다.
  return (
    <div className="@container">
      <dl className={cols === 2 ? "grid gap-x-8 @3xl:grid-cols-2" : "grid"}>
        {items.map((item, i) => (
          <div
            key={`${item.label}-${i}`}
            className={`grid grid-cols-1 gap-1 border-b border-line py-2.5 text-sm @xs:grid-cols-[128px_1fr] @xs:gap-4 ${
              item.full ? "@3xl:col-span-2" : ""
            }`}
          >
            <dt className="text-[13.5px] font-bold text-ink-muted">{item.label}</dt>
            <dd className="break-words text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** 인쇄물 머리글. 파란 CI 와 문서번호, 출력자, 출력 일시를 얹고 아래에 문서 제목을 둔다. 출력 일시는 서버에서 계산해 prop 으로 받는다 (design.md 8절) */
export function PrintHeader({
  title,
  docNo,
  printedBy,
  printedAt,
}: {
  title: string;
  docNo?: string;
  printedBy?: string;
  printedAt?: string;
}) {
  return (
    <div className="mb-4 border-b-[1.5px] border-black pb-3">
      <div className="flex items-start justify-between gap-4">
        {/* 인쇄에서 안정적으로 나오도록 next/image 를 쓰지 않고 img 를 쓴다 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CI_SRC} alt={ORG_NAME} className="h-7 w-auto" />
        <div className="text-right text-[12px] leading-relaxed text-black">
          {docNo ? <div>문서번호: {docNo}</div> : null}
          {printedBy ? <div>출력자: {printedBy}</div> : null}
          {printedAt ? <div>출력 일시: {printedAt}</div> : null}
        </div>
      </div>
      <h1 className="mt-3 text-[17px] font-bold text-black">{title}</h1>
    </div>
  );
}

/** 인쇄용 문서 표. 검정 테두리와 여백은 globals.css 의 .doc-table 이 담당하며 본문 행은 children 으로 받는다 */
export function DocTable({
  columns,
  children,
  className = "",
}: {
  columns: TableColumn[];
  children?: ReactNode;
  className?: string;
}) {
  return (
    <table className={`doc-table ${className}`}>
      <colgroup>
        {columns.map((c, i) => (
          <col key={`${c.label}-${i}`} style={c.width ? { width: c.width } : undefined} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th
              key={`${c.label}-${i}`}
              className={`${ALIGN_CLASS[c.align ?? "left"]} ${c.nowrap ? "cell-nowrap" : ""}`}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

// 상태 코드 → 배지 색. 의미가 같은 상태는 같은 색을 쓴다 (design.md 4절 배지 전용 색).
const BADGE_COLORS: Record<string, string> = {
  DRAFT: "bg-[#FEF08A] text-[#854D0E]",
  IN_USE: "bg-[#FEF08A] text-[#854D0E]",
  SUBMITTED: "bg-[#BFDBFE] text-[#1E40AF]",
  REQUESTED: "bg-[#BFDBFE] text-[#1E40AF]",
  COMPLETED: "bg-[#BFDBFE] text-[#1E40AF]",
  APPROVED: "bg-[#A7F3D0] text-[#065F46]",
  REVIEWED: "bg-[#A7F3D0] text-[#065F46]",
  ACTIVE: "bg-[#A7F3D0] text-[#065F46]",
  AVAILABLE: "bg-[#A7F3D0] text-[#065F46]",
  PASS: "bg-[#A7F3D0] text-[#065F46]",
  PRINTED: "bg-[#DDD6FE] text-[#5B21B6]",
  REJECTED: "bg-[#FCA5A5] text-[#991B1B]",
  FAIL: "bg-[#FCA5A5] text-[#991B1B]",
  ABNORMAL: "bg-[#FCA5A5] text-[#991B1B]",
  VOIDED: "bg-[#FCA5A5] text-[#991B1B]",
  SUSPENDED: "bg-[#FED7AA] text-[#9A3412]",
  CHANGE_REQUESTED: "bg-[#FED7AA] text-[#9A3412]",
  INACTIVE: "bg-gray-200 text-gray-600",
  DISPOSED: "bg-gray-200 text-gray-600",
};

/** 상태 배지(알약형, 11px 굵게). 미등록 상태는 회색. label 로 한글 표기를 넘긴다 (색만으로 상태를 구분하지 않는다) */
export function StatusBadge({ value, label }: { value: string; label?: string }) {
  const color = BADGE_COLORS[value] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block rounded-pill px-2.5 py-1 text-[11px] font-bold uppercase ${color}`}>
      {label ?? value}
    </span>
  );
}

/** 안내 상자(연파랑): 규정 고지, 작성 안내, 차단 규칙 설명 */
export function NoticeBox({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mb-6 flex gap-3 rounded-xl border border-[#b3d7ff] bg-primary-soft px-5 py-4 text-[13px] leading-relaxed text-[#1a4975]">
      <div>
        {title ? <div className="mb-1 text-[14.5px] font-bold text-primary-dark">{title}</div> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

// 모달 폭. 항목이 많은 상세(감사추적 11필드 등)는 lg 또는 xl 로 넓혀 값이 세로로 쪼개지지 않게 한다.
const MODAL_SIZES = {
  md: "max-w-lg",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
} as const;

/** 확인, 전자서명 등에 쓰는 모달. open=false 면 렌더하지 않는다. 덮개는 네이비 반투명. size 로 폭을 고른다 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof MODAL_SIZES;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary-dark/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={`w-full ${MODAL_SIZES[size]} rounded-card border border-line bg-white p-7 shadow-modal`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-[17px] font-bold text-primary-dark">{title}</h2>
        <div className="text-sm text-ink">{children}</div>
        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/** 한 줄 알림(정보, 주의, 오류, 성공). 차단 안내 문구는 URS 원문 그대로 넣는다 */
export function Banner({
  kind = "info",
  children,
}: {
  kind?: "info" | "warn" | "error" | "success";
  children: ReactNode;
}) {
  const styles = {
    info: "border-[#b3d7ff] bg-primary-soft text-[#1a4975]",
    warn: "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]",
    error: "border-[#FCA5A5] bg-[#FFF5F5] text-[#991B1B]",
    success: "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]",
  } as const;
  return <div className={`mb-4 rounded-input border px-3.5 py-2.5 text-sm ${styles[kind]}`}>{children}</div>;
}

/** 감사추적 보고서 인쇄용 행 형식 (AUDIT 탭 11필드) */
export type AuditPrintRow = {
  id: string;
  category: string;
  actor_id: string;
  actor_name: string;
  role: string;
  action: string;
  target: string;
  before_value: string;
  after_value: string;
  reason: string;
  timestamp_kst: string;
};

function auditPrintValue(value: string) {
  return value.trim() || "해당 없음";
}

function auditActor(row: AuditPrintRow) {
  const name = row.actor_name.trim();
  const id = row.actor_id.trim();
  if (name && id) return `${name} (${id})`;
  return name || id || "해당 없음";
}

/** 감사추적 보고서 인쇄 표. 요약 5열 + 기록별 대상, 변경 전후, 사유 블록. print-area 안에서 print-landscape 와 함께 쓴다 (design.md 8절) */
export function AuditPrintTable({ rows }: { rows: AuditPrintRow[] }) {
  return (
    <div className="audit-print-preview">
      <table className="audit-print-table" aria-label="감사추적 보고서">
        <colgroup>
          <col className="audit-print-col-timestamp" />
          <col className="audit-print-col-category" />
          <col className="audit-print-col-actor" />
          <col className="audit-print-col-role" />
          <col className="audit-print-col-action" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">기록 일시</th>
            <th scope="col">분류</th>
            <th scope="col">행위자</th>
            <th scope="col">역할</th>
            <th scope="col">행위 유형</th>
          </tr>
        </thead>
        {rows.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={5} className="audit-print-empty">
                조회된 감사추적이 없습니다.
              </td>
            </tr>
          </tbody>
        ) : (
          rows.map((row) => (
            <tbody key={row.id} className="audit-print-entry">
              <tr>
                <td className="audit-print-code">{auditPrintValue(row.timestamp_kst)}</td>
                <td className="audit-print-code">{auditPrintValue(row.category)}</td>
                <td className="audit-print-text">{auditActor(row)}</td>
                <td className="audit-print-code">{auditPrintValue(row.role)}</td>
                <td className="audit-print-code">{auditPrintValue(row.action)}</td>
              </tr>
              <tr>
                <td colSpan={5} className="audit-print-details-cell">
                  <div className="audit-print-target">
                    <span className="audit-print-detail-label">대상</span>
                    <span className="audit-print-code">{auditPrintValue(row.target)}</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td colSpan={5} className="audit-print-details-cell">
                  <div className="audit-print-details">
                    <div className="audit-print-detail">
                      <span className="audit-print-detail-label">변경 전</span>
                      <span className="audit-print-code">{auditPrintValue(row.before_value)}</span>
                    </div>
                    <div className="audit-print-detail">
                      <span className="audit-print-detail-label">변경 후</span>
                      <span className="audit-print-code">{auditPrintValue(row.after_value)}</span>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td colSpan={5} className="audit-print-details-cell">
                  <div className="audit-print-reason">
                    <span className="audit-print-detail-label">사유</span>
                    <span className="audit-print-text">{auditPrintValue(row.reason)}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          ))
        )}
      </table>
    </div>
  );
}

/** 인쇄 버튼. auditEndpoint 를 주면 출력 감사추적을 먼저 기록한 뒤 브라우저 인쇄창을 연다 (URS 의 출력 기록 요구 대응) */
export function PrintButton({
  auditEndpoint,
  auditPayload,
  label = "인쇄",
}: {
  auditEndpoint?: string;
  auditPayload?: Record<string, unknown>;
  label?: string;
}) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState("");

  async function handlePrint() {
    if (isPrinting) return;
    setIsPrinting(true);
    setError("");
    try {
      if (auditEndpoint) {
        const response = await fetch(auditEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(auditPayload ?? {}),
          cache: "no-store",
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "인쇄 감사추적을 기록하지 못했습니다.");
        }
      }
      window.print();
    } catch (err) {
      setError(err instanceof Error ? err.message : "인쇄를 시작하지 못했습니다.");
    } finally {
      setIsPrinting(false);
    }
  }

  return (
    <div className="no-print flex flex-col items-end gap-2">
      <Button type="button" onClick={handlePrint} disabled={isPrinting} aria-busy={isPrinting}>
        {isPrinting ? "인쇄 준비 중" : label}
      </Button>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
