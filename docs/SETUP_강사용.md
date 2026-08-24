# SETUP 가이드 (강사용): 조별 하네스 준비 절차

교육 전날까지 6개 조 각각에 대해 아래 ①~⑦을 완료한다.
**조당 총 예상 소요: 약 30~35분** (Google Cloud, Vercel, GitHub 계정이 이미 있을 때 기준).

## 사전 준비물 체크리스트

| 항목 | 확인 |
|---|---|
| 이 템플릿 리포 (빌드 통과 상태) | ☐ |
| Google 계정 (조별 GCP 프로젝트를 만들 수 있는 계정) | ☐ |
| Vercel 계정 (조별 프로젝트 6개 생성 가능) | ☐ |
| GitHub 계정 또는 조직 (조별 리포 6개) | ☐ |
| GAMPLAB 제공 조별 개발 환경: Node 22 LTS 이상, git, VSCode, Codex 로그인 | ☐ |
| 수강생 노트북: Chrome, Microsoft Word | ☐ |
| 조별 URS .docx (당일 조가 확정해 `docs/urs/`에 넣는다) | ☐ |

조 배정: 같은 시스템을 두 조가 서로 다른 도구로 만든다(1, 2조 전자로그북, 3, 4조 세척밸리데이션 관리, 5, 6조 실험실 재고관리).
도구 배정은 당일 확정한다.

---

## ① 템플릿을 조별 리포로 복제, 6개 (조당 약 3분)

방법 A(권장): GitHub에 이 템플릿을 push → 리포 Settings에서 **Template repository** 체크 →
조별로 **Use this template → Create a new repository** (`team01` ~ `team06`).

방법 B(오프라인): 템플릿 폴더에서 `npm.cmd run new -- team01` 을 실행하면 옆 폴더에 `team01`이 만들어진다
(node_modules, .git, .env.local, 빌드 산출물은 복사하지 않는다). 조별 폴더에서 `git init` 후 GitHub 리포에 연결한다.

```bash
git clone <템플릿-리포-URL> team01        # 방법 A
npm.cmd run new -- team01                 # 방법 B (템플릿 폴더 안에서 실행)
```

복제 후 조별 폴더에서 의존성 설치(당일 시간 절약을 위해 **전날 반드시 실행**):

```bash
npm.cmd install
npm.cmd run build
```

**실패 시 점검 포인트**
- `node_modules`를 통째로 복사하지 말 것. 반드시 조별 폴더에서 `npm.cmd install`을 새로 실행.
- 회사 프록시 환경이면 npm 레지스트리 접근 확인 (`npm ping`).
- 폴더명에 한글이나 공백이 있어도 동작하지만, 문제 최소화를 위해 영문 소문자 폴더명(team01) 권장.

## ② 조별 Google Cloud 프로젝트 분리 (조당 약 5분)

[console.cloud.google.com](https://console.cloud.google.com) → 새 프로젝트 6개
(`csv-edu-team01` ~ `csv-edu-team06`) → 각 프로젝트에서 **API 및 서비스 → 라이브러리 →
"Google Sheets API" → 사용 설정**.

프로젝트를 조별로 분리하는 이유는 API 쿼터, 권한, 장애 범위를 조별로 격리하기 위해서다.
한 프로젝트에 6개 조를 몰아넣으면 동시 실습 중 한 조의 과다 호출이나 권한 문제가 다른 조까지 영향을 줄 수 있다.

**실패 시 점검 포인트**
- 나중에 API 호출이 403 `Google Sheets API has not been used in project...`로 실패하면
  이 단계의 "사용 설정"이 누락된 것. 에러 메시지 안의 활성화 링크를 클릭하면 바로 해결.

## ③ 서비스 계정 생성 + JSON 키 발급 (조당 약 5분)

각 프로젝트에서 **IAM 및 관리자 → 서비스 계정 → 서비스 계정 만들기**
(이름 예: `sheets-bot`). 역할(권한)은 **아무것도 부여하지 않아도 된다.**
시트 접근 권한은 ④의 "시트 공유"로 부여된다.

생성 후 해당 서비스 계정 → **키 → 키 추가 → 새 키 만들기 → JSON** → 다운로드.
JSON 안의 `client_email`과 `private_key` 두 값을 ⑤에서 쓴다.

**실패 시 점검 포인트**
- JSON 키 파일을 리포 폴더 안에 두지 말 것(커밋 사고 방지). 부득이 두더라도 리포 루트에 둔다. `.gitignore`가 루트의 `*.json`(package.json, package-lock.json,
  tsconfig.json 제외)을 무시하고, 커밋 준비 때 `npm.cmd run check:commit`이 키 내용이 든 파일을 한 번 더 막는다.
- 조직 정책으로 키 발급이 막힌 경우: 개인 GCP 계정으로 우회(교육용 임시)하고 교육 후 폐기.

## ④ 조별 Google Sheet 생성 + 편집자 공유 (조당 약 3분)

[sheets.new](https://sheets.new)로 새 스프레드시트 생성(이름 예: `TEAM01-GMP-DATA`) →
우측 상단 **공유** → ③의 서비스 계정 이메일(`...@...iam.gserviceaccount.com`) 입력 →
권한 **편집자** → 전송(알림 체크 해제 가능).

시트 URL에서 `/d/`와 `/edit` 사이 문자열이 `GOOGLE_SHEET_ID`다.

**실패 시 점검 포인트**
- **뷰어**로 공유하면 읽기는 되고 쓰기(시드, 저장)가 403으로 실패한다. 반드시 편집자.
- 탭(USERS 등)은 미리 만들 필요 없음. `/api/seed`가 자동 생성한다.

## ⑤ .env.local 작성 (조당 약 3분)

조별 리포 루트에서 `.env.example`을 복사해 `.env.local` 생성 후 3종 입력:

```bash
cp .env.example .env.local
```

| 변수 | 값 |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | JSON 키의 `client_email` 값 |
| `GOOGLE_PRIVATE_KEY` | JSON 키의 `private_key` 값을 **따옴표 포함 원문 그대로 한 줄로** |
| `GOOGLE_SHEET_ID` | ④에서 확인한 시트 ID |

`GOOGLE_PRIVATE_KEY`는 JSON 파일에 있는 형태 그대로
`"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`. `\n` 이스케이프를
풀어서 여러 줄로 만들지 말 것(코드가 `\n`을 실제 줄바꿈으로 치환한다).

**실패 시 점검 포인트**
- 로그인 시 `error:1E08010C DECODER routines` 또는 `Invalid PEM` → private key 붙여넣기 형식 문제.
  JSON에서 값을 다시 복사(따옴표 포함)한다.
- `.env.local` 수정 후에는 `npm.cmd run dev` 재시작 필수.
- `.env.local`은 `.gitignore`에 포함되어 커밋되지 않는다. 조별 PC마다 직접 만들어야 한다.

## ⑥ GitHub 리포와 Vercel 프로젝트 연결 + 환경 변수 3종 등록 (조당 약 7분)

조별 GitHub 리포(①)에 `main` 브랜치를 push해 둔다. [vercel.com](https://vercel.com) → **Add New → Project** →
조별 GitHub 리포 Import → Framework: Next.js 자동 인식 → **Environment Variables**에 3종 등록 → Deploy.

이렇게 연결해 두면 2일차에 조원이 터미널에서 `git push`를 하는 순간 Vercel이 자동으로 재배포한다.
조별 PC에서 `git push`가 되도록 GitHub 인증(HTTPS 토큰 또는 SSH 키)을 전날 확인한다. 푸시는 사람이 직접 한다(AI 도구는 커밋까지).

Vercel 환경 변수 입력 요령:
- `GOOGLE_PRIVATE_KEY`: JSON의 `private_key` **값 부분만**(감싸는 따옴표 제외) 붙여넣는다.
  `\n` 이스케이프가 포함된 한 줄이든, 실제 줄바꿈이 있는 여러 줄이든 둘 다 동작한다(코드가 두 형태를 모두 처리).
- 나머지 2종은 값 그대로.

**실패 시 점검 포인트**
- 배포 후 데이터 호출이 500이면: Vercel → 프로젝트 → Settings → Environment Variables 3종 확인 →
  값 수정 시 **재배포(Redeploy)** 해야 반영된다.
- 데이터가 안 보이거나 옛날 데이터가 보이면: 이 템플릿은 모든 라우트에 `force-dynamic`이 들어가 있어 정상 동작해야 한다.
  교육생이 새 페이지를 만들며 이 3종 export를 빼먹었는지 확인(AGENTS.md 기술 규칙).

## ⑦ 배포 확인: 시드 → 로그인 (조당 약 5분)

1. 브라우저에서 `https://<조별-배포-URL>/api/seed` 호출 →
   `{"ok":true,"created":["admin","user","reviewer"],...}` 확인.
2. Google Sheet에 `USERS`, `AUDIT` 탭이 생기고 계정 3행이 들어갔는지 확인.
3. `/login`에서 계정을 고르면 비밀번호 `1234`가 자동 입력된다. 로그인 → 대시보드 진입 확인.
4. (로컬도 동일: `npm.cmd run dev` → `http://localhost:3000/api/seed` → 로그인.)

**실패 시 점검 포인트**
- `/api/seed`가 `환경 변수 누락` 응답 → ⑤, ⑥ 재확인.
- `Unable to parse range: USERS!A1:ZZ` → 시드 전에 로그인부터 시도한 것. `/api/seed` 먼저.
- 403 권한 오류 → ④ 편집자 공유, ② API 사용 설정 재확인.
- 재호출해도 계정이 중복 생성되지 않는다(멱등). `skipped`로 표시되면 정상.
- 원샷 빌드 뒤에는 계정 ID, 이름, 역할 코드가 URS §6.1과 §7.6대로 바뀐다(템플릿의 admin, user, reviewer는 자리표시). 비밀번호는 모두 1234이며 배포 전에 조가 바꾼다.

---

## Codex 실행, 현재 앱과 CLI 기준

이 폴더는 Codex 전용이다. Codex가 루트 `AGENTS.md`를 자동 인식하며, 상세 절차는 `harness/`에 있다.

- 앱: Codex 앱에서 조별 폴더를 작업 폴더로 연다. 루트에 `AGENTS.md`가 보이는지 확인한다.
- CLI: 조별 폴더에서 `codex -C . -s workspace-write -a never`를 실행한다. Codex CLI 0.149.0에는 과거 `--full-auto` 옵션이 없으므로 사용하지 않는다.
- `npm.cmd run build`, `npm.cmd run dev`, `node scripts/convert-urs.mjs`가 작업 폴더 안에서 실행되어야 한다. 네트워크가 제한된 환경에서는 전날 `npm.cmd install`을 끝낸다.
- 모델 설정은 프로젝트의 `.codex/config.toml`과 `.codex/agents/*.toml`에 고정되어 있다. 오케스트레이터와 Builder는 `gpt-5.6-sol`/`high`, Analyzer는 `gpt-5.6-terra`/`xhigh`, 이름 없는 단순 정리와 반복 점검 보조 역할은 `gpt-5.6-terra`/`low`다. Luna는 사용하지 않는다. 개인 `~/.codex/config.toml`로 이 역할 설정을 덮어쓰지 않고 프로젝트 폴더를 trusted로 둔다.
- 모델 접근성 사전 점검: 교육 전날 각 조의 Codex 계정에서 Sol, Terra와 Terra의 xhigh를 선택 또는 실행할 수 있는지 확인한다. `npm.cmd run check:harness`는 설정 파일의 고정값은 검사하지만 계정별 모델 제공 여부는 검사하지 못한다.
- 서브에이전트: 프로젝트의 `.codex/config.toml`은 7개 역할 스레드를 열어 둘 수 있게 하고 `.codex/agents/`에 7개 사용자 정의 역할을 등록한다. 실제 동시 실행은 가용 슬롯에 따라 최대 4개 웨이브로 제한한다. 현재 Codex 릴리스는 이 기능을 기본 활성화하며, `codex features list`에서도 `multi_agent` 상태를 확인할 수 있다. 지원하지 않는 클라이언트에서는 `agent:prompt` 폴백 또는 순차 실행을 사용한다.
- 재개: 세션이 바뀌면 `RUN_STATE.json`과 `URS_STATUS.json`을 읽고 마지막 미완료 단계부터 재개하도록 지시한다. 완료 게이트 전에는 단순 중간 보고를 완료로 보지 않는다.
- 줄바꿈: `.gitattributes`가 LF를 강제한다. 조별 PC의 git이 `core.autocrlf=true`여도 작업 트리는 LF로 유지된다.
- sandbox에서 Google Sheets 외부 연결이 막히면 위험한 우회 옵션을 사용하지 않는다. 코드 구현을 완료하고 Sheets 스모크를 `environment_pending`으로 기록한다.

**푸시와 배포는 AI가 하지 않는다.** AI는 커밋과 태그까지만 만들고, 조원이 터미널에서 `git push origin main --tags`를 실행한다(AGENTS.md 10절).

## 보안 주의

- `.env.local`과 서비스 계정 JSON 키는 **절대 커밋 금지** (`.gitignore`에 이미 포함). 커밋 준비 때 AI가 `npm.cmd run check:commit`으로 비밀 파일과 빌드 산출물을 점검한다.
  준비 중 `git status`에 env나 키 파일이 보이면 즉시 중단하고 확인한다. 산출물(IMPLEMENTED.md, PLAN.md, SPEC_*.md 등)은 함께 커밋한다.
- 교육생 리포가 공개될 수 있으므로, **교육 종료 후 서비스 계정 키를 폐기**(GCP 콘솔에서 키 삭제)한다.
- 시드 계정 비밀번호가 평문(교육용 단순화)이므로 실데이터를 넣지 않는다.

## 조별 준비 완료 판정 (전날 밤 기준)

- [ ] `npm.cmd install` 완료, `npm.cmd run build` 통과
- [ ] `npm.cmd run fds -- --sample` 로 `docs/FDS_SAMPLE.docx` 가 생기고 조별 PC 의 Word 에서 열린다 (2일차 FDS 작성 모드의 출력 점검. 확인 후 삭제)
- [ ] `.env.local` 3종 입력, 로컬 `/api/seed` + 로그인 성공
- [ ] GitHub 리포 push 성공(터미널에서 직접), Vercel 배포 URL에서 `/api/seed` + 로그인 성공
- [ ] Codex 앱 또는 `codex -C . -s workspace-write -a never`에서 루트 AGENTS.md 인식 확인
- [ ] `npm.cmd run check:harness` 결과 `TEMPLATE_READY`
