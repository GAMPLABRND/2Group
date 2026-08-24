# GMP MVP 하네스 템플릿 v3, Codex 전용

KPBMA-EDU-001-URS를 기준으로 Next.js, TypeScript, Tailwind, Google Sheets, Vercel 기반 교육용 GMP MVP를 만드는 Codex 전용 템플릿입니다. `05 Harness-codex v2`의 앱, 디자인, FDS, CSV 실습 흐름을 보존하면서 Codex가 실제로 읽고 재개하고 검증할 수 있는 구조로 재설계하였습니다.

v3의 핵심 변화는 다음과 같습니다.

- Codex가 자동으로 읽는 루트 `AGENTS.md`를 짧은 실행 계약으로 만들고 상세 절차를 `harness/` 플레이북으로 분리하였습니다.
- 분석 3역할과 구현 4역할은 유지하되 사용 가능한 동시 슬롯에 맞춰 실행 웨이브를 조정합니다.
- 7개 역할을 프로젝트 범위 `.codex/agents/*.toml` 사용자 정의 에이전트로 등록했습니다. `agent:prompt`는 이를 선택할 수 없는 클라이언트의 폴백입니다.
- 실행 재현성을 위해 오케스트레이터와 Builder는 Sol/high, Analyzer는 Terra/xhigh로 고정했습니다. 이름 없는 보조 작업만 Terra/low를 사용하며 Luna는 사용하지 않습니다.
- URS 전 조항을 `harness/state/URS_STATUS.json`으로 관리하고 조항별 파일, 화면 또는 API, 실행 증거가 없으면 완료로 판정하지 않습니다.
- 중앙 상태와 파생 문서에 동일한 상태 지문을 사용하여 동기화되지 않은 IMPLEMENTED, 추적성, 증거, gaps 문서를 차단합니다.
- 빌드 완료와 실제 Google Sheets 또는 배포 환경 검증을 분리하여 보고합니다.
- 현재 Codex CLI에서 지원하지 않는 `--full-auto` 예시를 제거하였습니다.

기존 의도의 위치별 보존 결과는 [V3_REDESIGN.md](docs/V3_REDESIGN.md)에서 확인할 수 있습니다.

## 가장 쉬운 시작

1. Codex 앱에서 이 폴더를 작업 폴더로 엽니다.
2. 조별 URS `.docx`를 `docs/urs/`에 넣습니다.
3. 다음 한 문장을 입력합니다.

   ```text
   하네스 절차대로 URS MVP 빌드를 시작해.
   ```

Codex는 루트 `AGENTS.md`를 자동으로 읽고 URS 변환, 조항 인벤토리, 분석, 설계, 구현, 하네스 감사, 빌드와 가능한 환경 스모크까지 진행합니다. 멀티에이전트를 사용할 수 없는 환경에서도 같은 7역할을 순차 수행합니다.

프로젝트 설정은 `.codex/config.toml`과 `.codex/agents/*.toml`에 고정되어 있습니다. 교육 전날 해당 Codex 계정에서 `gpt-5.6-sol`, `gpt-5.6-terra`, Terra의 `xhigh` 추론 수준을 사용할 수 있는지 확인합니다. 모델 접근이 없으면 설정이 자동으로 다른 모델로 안전하게 대체된다고 가정하지 않습니다.

현재 CLI에서 직접 열 때는 다음처럼 작업 폴더, sandbox, 승인 정책을 명시할 수 있습니다.

```powershell
codex -C . -s workspace-write -a never
```

외부 Google Sheets 연결이 sandbox에서 막히면 위험한 우회 옵션을 사용하지 않고 환경 검증 대기로 기록합니다. 의존성은 교육 전날 설치해 둡니다.

## 시스템과 구현 기준

하나의 하네스로 다음 3종을 만듭니다.

- 장비사용기록서, 전자로그북
- 세척밸리데이션 관리
- 실험실 재고관리, 시약과 표준품

시스템명, 업무 엔티티, 역할, 계정, 화면, 상태, 차단 규칙은 URS가 결정합니다. 구현 정본은 Section 2, Section 6, Section 7.1이며 Section 7.2부터 7.8은 보조 기준입니다.

고정 운영 원칙:

- 첫 빌드 비밀번호는 모두 `1234`이며 배포 전에 변경합니다.
- 로그인은 계정 선택, 아이디, 비밀번호 순서입니다.
- 제목은 `CSV실습과정 [조번호]조 [시스템명]` 형식입니다.
- 모든 7.1 조항이 구현 대상입니다.
- AI는 push와 Vercel 배포를 하지 않습니다.
- IOQ는 사람이 실제 배포 URL의 고정 `v1.0`을 시험합니다.

## 실행 모드

| 모드 | 트리거 예시 | 결과 |
|---|---|---|
| 원샷 빌드 | `하네스 절차대로 URS MVP 빌드를 시작해.` | 앱, SPEC, PLAN, 조항 상태, 추적성, 증거, gaps |
| QA 수정 | `수정 요청: 출고 화면에서 기한 경과품이 저장돼.` | 결함 재현, 최소 수정, 관련 조항과 CHANGELOG 갱신 |
| FDS | `FDS를 작성해줘.` | as-built `docs/FDS.md`, 검증된 Word DOCX |
| CSV 문서 | `IOQ 시나리오 초안을 만들어줘.` | DQ, IOQ, RTM 초안 지원 |
| 릴리스 준비 | `커밋 준비해.` | 비밀 점검, 최종 게이트, build, 커밋과 태그 준비 |

## 주요 명령

```powershell
npm.cmd install
npm.cmd run harness:init
npm.cmd run agent:prompt -- --role analyzer-a --assignment "담당 소절: 7.1.1, 7.1.4"
npm.cmd run harness:sync
npm.cmd run check:harness
npm.cmd run test:harness
npm.cmd run test:harness:gate
npm.cmd run check:harness -- --final
npm.cmd run check:sheets
npm.cmd run check:commit
npm.cmd run fds -- --sample
npm.cmd run build
npm.cmd run dev
```

`check:harness`는 URS가 없는 템플릿 상태에서는 구조와 의도 보존을 점검합니다. `--final`은 URS 상태, 7개 역할 완료 파일, SPEC, PLAN, 구현 파일, 조항별 증거와 파생 문서를 모두 확인합니다.

`test:harness`는 URS ID 파서와 URS 변경 시 증거 초기화를 확인합니다. `test:harness:gate`는 누락 산출물과 오래된 파생 문서를 실제로 차단하고, 완전한 fixture만 `COMPLETE_WITH_ENV_VALIDATION_REQUIRED`로 통과시키는 end-to-end 자가시험입니다.

## 폴더 구성

| 경로 | 역할 |
|---|---|
| `AGENTS.md` | Codex가 자동으로 읽는 실행 계약과 불변 규칙 |
| `.codex/config.toml`, `.codex/agents/` | 역할별 모델, 추론 강도, 동시 실행 설정과 7개 사용자 정의 역할 |
| `harness/WORKFLOW.md` | 원샷, QA, FDS, 릴리스 상세 절차 |
| `harness/ORCHESTRATION.md` | 슬롯 인식형 분석 3역할, 구현 4역할 실행 |
| `harness/QUALITY_GATES.md` | 템플릿, 조항, 코드, 환경, 릴리스 게이트 |
| `harness/OUTPUT_CONTRACTS.md` | 상태 JSON과 산출물 형식 |
| `harness/state/` | URS 상태와 현재 단계 정본 |
| `harness/runs/` | 역할별 완료 원장 |
| `agents/` | analyzer-a/b/c, builder-d1/d2/d3/d4 역할 전문 |
| `scripts/harness-init.mjs` | URS ID 인벤토리와 초기 상태 생성 |
| `scripts/sync-harness-report.mjs` | IMPLEMENTED, 추적성, 증거, gaps 생성 |
| `scripts/check-harness.mjs` | 의도 보존과 최종 완료 감사 |
| `scripts/test-harness-parser.mjs` | URS ID 인벤토리, 표 정본 우선순위와 역할 배정 자가시험 |
| `scripts/test-harness-gate.mjs` | 누락 상태의 fail-closed와 완전한 fixture의 최종 게이트 자가시험 |
| `scripts/render-agent-prompt.mjs` | 사용자 정의 역할을 선택할 수 없을 때 쓰는 완전한 폴백 프롬프트 생성 |
| `design.md`, `components/ui.tsx` | KPBMA CI 디자인과 표 overflow 안전망 |
| `docs/FDS_*`, `scripts/build-fds.mjs` | as-built FDS 검증과 Word 생성 |
| `docs/SETUP_강사용.md`, `docs/RUNBOOK_당일운영.md` | 조별 환경 준비와 교육 당일 운영 |

## 조별 프로젝트 복제

템플릿 옆에 새 폴더를 만들 때 다음 명령을 사용합니다.

```powershell
npm.cmd run new -- team01
Set-Location ..\team01
npm.cmd install
Copy-Item .env.example .env.local
```

복제 스크립트는 `node_modules`, `.git`, `.env.local`, 조별 URS, 이전 상태, 역할 실행 원장, 생성된 추적성 문서를 복사하지 않습니다.

## 보안과 검증 경계

- `.env.local`, 서비스 계정 JSON, 개인키, 토큰을 커밋하지 않습니다.
- 교육용 평문 비밀번호를 사용하므로 실데이터를 넣지 않습니다.
- Google Sheets 저장과 동기화는 실제 seed, 로그인, 저장, 재조회, 감사추적 흐름으로 확인합니다.
- 환경이 없으면 코드와 정적 증거를 완료한 뒤 `COMPLETE_WITH_ENV_VALIDATION_REQUIRED`로 구분합니다.
- FDS DOCX의 구조 검증과 실제 Word 시각 검증을 같은 것으로 보고하지 않습니다.

자세한 첫 실행은 [CODEX_START_여기서.md](docs/CODEX_START_여기서.md)를 확인합니다.
