import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getRows } from "@/lib/sheets";
import { APP_NAME, APP_SUBTITLE, CI_SRC, FOOTER_NOTICE, INITIAL_PASSWORD, INITIAL_PASSWORD_NOTICE, ORG_NAME } from "@/lib/brand";
import type { AccountOption } from "@/types";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const REQUIRED_ENV = [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_SHEET_ID",
] as const;

/** 계정 선택 목록: USERS 탭의 활성 계정(아이디, 이름, 역할, 초기 비밀번호 여부). 비밀번호 값은 내려보내지 않는다. */
async function loadAccounts(): Promise<{ accounts: AccountOption[]; error: string }> {
  try {
    const rows = await getRows("USERS");
    const accounts = rows
      .filter((r) => !r.status || r.status === "ACTIVE")
      .map((r) => ({ user_id: r.user_id, name: r.name, role: r.role, initial: r.password === INITIAL_PASSWORD }));
    return { accounts, error: "" };
  } catch (err) {
    return { accounts: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  const { accounts, error } = missing.length === 0 ? await loadAccounts() : { accounts: [], error: "" };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="aurora-bg" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
      </div>

      <div className="relative z-10 w-[560px] max-w-full rounded-card border border-white/10 bg-white/95 p-12 shadow-[0_30px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="mb-6 flex justify-center">
          <Image src={CI_SRC} alt={ORG_NAME} width={444} height={56} className="h-auto w-full max-w-[420px]" priority />
        </div>
        <h1 className="text-center text-[18.5px] font-bold text-primary-dark">{APP_NAME}</h1>
        <p className="mb-7 mt-2 text-center text-[12.5px] text-ink-muted">{APP_SUBTITLE}</p>

        {missing.length > 0 ? (
          <div className="mb-4 rounded-input border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-xs leading-5 text-[#92400E]">
            <b>Google Sheets 연동 환경 변수가 설정되지 않았습니다.</b>
            <br />
            누락: {missing.join(", ")}
            <br />
            로컬은 <code>.env.example</code>을 복사해 <code>.env.local</code>을 만들고 값을 채운 뒤 서버를
            재시작합니다. Vercel은 프로젝트 Settings의 Environment Variables에 3종을 등록하고 재배포합니다.
            (docs/SETUP_강사용.md ⑤, ⑥ 단계)
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-input border border-[#FCA5A5] bg-[#FFF5F5] px-3.5 py-2.5 text-xs leading-5 text-[#991B1B]">
            계정 목록을 불러오지 못했습니다: {error}
            <br />
            <code>/api/seed</code>를 먼저 호출했는지, 시트 공유(서비스 계정 편집자)와 시트 ID를 확인합니다.
          </div>
        ) : null}

        <LoginForm accounts={accounts} />

        <div className="mt-5 rounded-input border border-line bg-muted px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-muted">
          <b className="text-primary-dark">교육용 계정 안내</b>
          <br />
          계정은 최초 1회 <code>/api/seed</code> 호출로 준비됩니다. 계정 선택에서 계정을 고르면 아이디가 입력되고, 초기 비밀번호 상태인 계정은 비밀번호도 함께 입력됩니다. 비밀번호를 바꾼 계정은 직접 입력합니다.
          <br />
          {INITIAL_PASSWORD_NOTICE}
        </div>
        <p className="mt-4 text-center text-[11px] text-ink-muted">{FOOTER_NOTICE}</p>
      </div>
    </div>
  );
}
