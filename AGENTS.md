# URS 기반 GMP MVP 하네스 v3, Codex 전용

이 파일은 Codex가 프로젝트를 열 때 자동으로 읽는 루트 지시 파일이다. 상세 절차는 `harness/` 아래에 분리되어 있다. Codex는 현재 모드에 필요한 파일을 작업 전에 끝까지 읽고 수행한다. `CLAUDE.md`는 호환 안내문일 뿐이며 Codex의 기준은 이 파일이다.

공식 Codex 지시 파일 규칙: <https://developers.openai.com/codex/agent-configuration/agents-md>
공식 Codex 서브에이전트 규칙: <https://learn.chatgpt.com/docs/agent-configuration/subagents>

## 0. 모드 라우팅

| 사용자 요청 | 모드 | 먼저 읽을 파일 |
|---|---|---|
| `하네스 절차대로 URS MVP 빌드를 시작해.` | 원샷 빌드 | `harness/WORKFLOW.md`, `harness/ORCHESTRATION.md`, `harness/QUALITY_GATES.md`, `harness/OUTPUT_CONTRACTS.md`, `design.md`, `docs/SHEETS_SPEC.md` |
| `수정 요청: ...`, 오류나 화면 수정 | QA 수정 | `harness/WORKFLOW.md`의 QA 절, `harness/QUALITY_GATES.md`, 기존 `PLAN.md`, `IMPLEMENTED.md`, `harness/state/URS_STATUS.json` |
| `FDS를 작성해줘` | FDS | `docs/FDS_GUIDE.md`, `docs/FDS_TEMPLATE.md`, 현재 코드와 추적성 산출물 |
| DQ, IOQ, RTM 초안 요청 | CSV 문서 초안 | `docs/DRAFTS.md`, `docs/GUIDE_실습흐름_URS에서VSR까지.md` |
| `커밋해`, `커밋 준비해`, `배포 준비해` | 릴리스 준비 | `harness/WORKFLOW.md`의 릴리스 절, `harness/QUALITY_GATES.md`, `docs/SETUP_강사용.md` |

원샷 빌드에서는 사용자의 추가 확인을 기다리지 않는다. 필요한 기본값은 `DECISIONS.md`에 근거와 함께 기록하고 계속한다. 수정, FDS, 문서, 릴리스 모드는 해당 요청 범위만 수행한다.

## 1. 완료 계약

1. 60분은 교육 운영 목표다. 중단 기준이나 요구사항 축소 근거가 아니다.
2. URS 7.1의 모든 기능 조항을 상태 목록에 넣는다. 구현 가능한 조항이 `pending`, `in_progress`, `partial`, `not_implemented`로 남아 있으면 완료라고 보고하지 않는다.
3. 빌드 성공은 완료의 일부 증거일 뿐이다. 조항별 코드 경로, 사용자 흐름 또는 API 증거, 빌드 결과, 가능한 경우 실제 Google Sheets 스모크가 함께 있어야 한다.
4. `.env.local`, Google Sheets, 브라우저 또는 배포 환경이 없으면 코드 구현을 계속하고 환경 검증만 `environment_pending`으로 구분한다. 이때 최종 상태는 `COMPLETE_WITH_ENV_VALIDATION_REQUIRED`일 수 있다.
5. 코드가 남았거나 빌드가 실패하면 최종 상태는 `INCOMPLETE`다. 시간 초과, 에이전트 종료, 모델 한계는 미구현 사유로 허용하지 않는다.
6. 최종 보고 전에 `npm.cmd run harness:sync`, `npm.cmd run check:harness -- --final`, `npm.cmd run check:sheets`, `npm.cmd run build`를 실행한다. 한 명령이라도 실패하면 실패 원인과 남은 범위를 보고하고 완료 표현을 쓰지 않는다.
7. 구현 범위, 남은 범위, 하네스 감사 결과, 실제 환경 검증 결과를 서로 분리해 보고한다.

## 2. 언어와 표기

- 진행 메시지, `SPEC_A.md`, `SPEC_B.md`, `SPEC_C.md`, 서브에이전트 완료 보고는 간결한 영어로 쓴다. URS에서 가져온 한국어 라벨, 상태명, 안내 문구는 원문을 유지한다.
- `PLAN.md`, `IMPLEMENTED.md`, `DECISIONS.md`, `CHANGELOG.md`, README와 최종 보고는 한국어 보고체로 쓴다. FDS 본문만 규격서 평서형으로 쓴다.
- 한국어는 `데이터 완전성`, `비정상 조건 시험`, `규격서`, `감사추적`, `전자서명`, `기준정보`, `조항 ID`를 사용한다.
- 산출물에는 URS 조항 ID를 병기한다. 근거가 없으면 `URS 근거 없음, 기본값`으로 적는다.
- 방점과 장식용 긴 대시는 쓰지 않는다. 하이픈은 파일명, 코드, 영문 복합어와 목록 기호에만 쓴다.
- 커밋 메시지는 한국어로 `무엇을 왜 (URS-F-nnn)` 형식을 사용한다.

## 3. URS와 고정 기본값

- 입력은 `docs/urs/`의 KPBMA-EDU-001-URS `.docx` 또는 변환된 `.md`다.
- 구현 정본은 Section 2, Section 6, Section 7.1이다. Section 7.2부터 7.8은 데이터, 기술, 인터페이스, 비기능, 환경, 제약, 라이프사이클 보조 기준이다.
- 역할 코드, 역할명, 계정, 메뉴, 권한은 URS를 따른다. 템플릿의 ADMIN, USER, REVIEWER와 admin, user, reviewer는 자리표시다.
- URS에 계정이 없을 때만 역할별 계정 하나를 만들고 `DECISIONS.md`에 기록한다.
- 첫 빌드 비밀번호는 모두 `1234`다. 배포 전에 비밀번호 변경 화면에서 변경한다.
- 시스템 제목은 `CSV실습과정 [조번호]조 [시스템명]`으로 고정한다. `lib/brand.ts`의 `TEAM_NO`와 `SYSTEM_NAME`만 바꾼다.
- `lib/sheets.ts`는 규격 코드다. 직접 수정하지 않고 `npm.cmd run check:sheets -- --restore`로 복원한다.

## 4. 원샷 빌드 시작 계약

원샷 빌드 트리거를 받으면 다음 순서를 지킨다.

1. 필요한 플레이북을 모두 읽는다.
2. `npm.cmd run harness:init`으로 URS를 변환하고 `harness/state/URS_STATUS.json`을 만든다. 탐지한 조항 수가 URS와 맞지 않으면 변환 문제를 먼저 고친다.
3. 작업 계획을 만들고 현재 단계를 `harness/state/RUN_STATE.json`에 기록한다.
4. 분석 역할 3개, 구현 역할 4개를 `harness/ORCHESTRATION.md`대로 실행한다. 멀티에이전트를 쓸 수 없으면 같은 역할을 순차 수행한다.
5. 오케스트레이터가 결과를 통합하고 중앙 상태, 공유 파일, 추적성 산출물을 직접 관리한다.
6. 품질 게이트를 통과할 때까지 구현 가능한 조항을 계속 처리한다.

중간에 턴이 다시 시작되면 새로 분석하지 않는다. `harness/state/RUN_STATE.json`, `harness/state/URS_STATUS.json`, `PLAN.md`, 역할 완료 파일을 읽고 마지막 미완료 단계부터 재개한다.

## 5. Codex 멀티에이전트 규칙

- Codex 네이티브 역할은 `.codex/agents/*.toml`의 `analyzer_a`, `analyzer_b`, `analyzer_c`, `builder_d1`, `builder_d2`, `builder_d3`, `builder_d4`다. 상세 역할 전문은 대응하는 `agents/*.md`에 있으며 역할 자체와 범위는 v2와 동일하다.
- 모델 라우팅은 설정 파일에 고정한다. 오케스트레이터와 builder-d1부터 d4는 `gpt-5.6-sol`의 `high`, analyzer-a부터 c는 `gpt-5.6-terra`의 `xhigh`를 사용한다.
- 이름 없는 보조 서브에이전트의 기본값 `gpt-5.6-terra`의 `low`는 파일 목록화, 형식 정리, 생성 산출물의 반복 존재 확인처럼 해석과 판단이 없는 작업에만 사용한다. URS 해석, SPEC과 PLAN, 코드 구현과 검토, GxP 또는 CSV 문서 내용 작성, 중앙 상태 갱신, 최종 완료 판정에는 사용하지 않는다.
- Luna 계열 모델은 이 하네스에서 사용하지 않는다. 핵심 사용자 정의 역할이 모델 접근 문제로 시작되지 않으면 보조 기본 역할로 낮추지 않고 오케스트레이터가 같은 역할 계약을 Sol/high로 순차 수행하며 `DECISIONS.md`에 예외를 기록한다.
- 서브에이전트를 만들 때 대응하는 네이티브 역할을 선택하고, 작업 메시지에 담당 조항, 읽을 SPEC 또는 PLAN, 허용 파일, 완료 JSON, 모든 역할을 기다릴 조건을 명시한다.
- 프로젝트 사용자 정의 역할을 선택할 수 없는 클라이언트에서만 `npm.cmd run agent:prompt -- --role <역할> --assignment "<담당 범위>"`의 전체 출력을 일반 서브에이전트 작업 메시지로 사용한다. 역할 전문을 임의로 요약하지 않는다.
- 사용 가능한 동시 슬롯 수를 넘지 않는다. 분석은 최대 3개 동시 실행한다. 구현은 자식 슬롯이 4개 이상이면 4개 동시, 3개이면 D1, D2, D3를 먼저 실행하고 D4를 두 번째 웨이브로 실행한다.
- 역할 파일에는 파일 소유권이 있다. 서브에이전트는 자기 경로만 수정하고 공유 파일과 중앙 상태는 수정하지 않는다. 자기 역할의 `harness/runs/<role>.json`만 기록한다.
- 시간 예산 때문에 서브에이전트를 중단하지 않는다. 완료 또는 구체적 차단 보고가 올 때까지 기다린다.
- 오케스트레이터는 역할 보고만 믿지 않는다. 변경 파일, 조항 ID, 실행 결과를 직접 대조한 뒤 중앙 상태를 갱신한다.
- 서브에이전트가 없거나 실패해도 사용자에게 선택을 묻지 않고 같은 역할 계약을 순차 수행한다.

## 6. 파일 소유권

- 오케스트레이터 전용: `types.ts`, `lib/*`, `app/layout.tsx`, `components/*`, `app/globals.css`, `package.json`, `PLAN.md`, `IMPLEMENTED.md`, `DECISIONS.md`, `CHANGELOG.md`, `harness/state/*`, `docs/generated/*`.
- D1: `app/login/**`, `app/admin/**`, `app/password/**`, 관련 인증, 사용자, 비밀번호, 기준정보 API.
- D2: PLAN에 배정된 핵심 업무 기록 화면과 API.
- D3: `app/approvals/**`, `app/print/**`, 워크플로우, 전자서명, 출력 API.
- D4: `app/audit/**`, `app/alarms/**`, `app/page.tsx`, 감사추적과 시드 API, 앱 README.
- 구체 경로가 겹치면 STEP 2의 `PLAN.md` 소유권 표가 우선한다. 공유 변경 요청은 서브에이전트가 보고하고 오케스트레이터가 반영한다.

## 7. 기술, 보안, 디자인 불변 규칙

- Next.js App Router, TypeScript, Tailwind, Google Sheets, Vercel 구조를 유지한다. `googleapis` 외 런타임 패키지를 추가하지 않는다.
- 라우트 핸들러와 데이터 페이지는 `dynamic = "force-dynamic"`, `revalidate = 0`, `runtime = "nodejs"`를 사용한다.
- 클라이언트에서 Google Sheets를 직접 호출하지 않는다. `/api/*`를 사용하고 fetch는 `cache: "no-store"`로 한다.
- 폴링을 만들지 않는다. 목록에 수동 새로고침을 제공한다.
- 저장 시각은 ISO, 표시는 `lib/kst.ts`를 사용한다. 세션은 httpOnly 쿠키를 사용하고 서버에서 역할을 검사한다.
- localStorage와 sessionStorage에 업무 데이터를 저장하지 않는다.
- 모든 변경성 API는 `lib/audit.ts`로 감사추적을 남긴다. 물리 삭제 대신 상태 전환과 사유를 기록한다.
- 계산, 판정, 차단, 상태 전이, 전자서명 비밀번호 확인은 서버에서 다시 검사한다.
- 교육용 단순화 범위는 평문 비밀번호, 서버 시각, 마지막 저장 우선이다. 실데이터를 넣지 않는다.
- `design.md`와 `components/ui.tsx`를 따른다. 표가 든 카드는 전체 폭 1열로 쌓고, Table의 overflow 안전망, 고정 열 폭, 말줄임, 상세 Modal을 유지한다.
- 로그인은 계정 선택, 아이디, 비밀번호 순서를 유지한다. 계정 선택 시 아이디와 초기 비밀번호가 채워지는 동작을 제거하지 않는다.
- `.env.local`, 서비스 계정 JSON, 개인키, 토큰을 출력하거나 커밋하지 않는다.

## 8. QA 수정 모드

한 번에 한 요청을 결함 수정, URS 범위 개선, URS 외 요청으로 분류한다. 관련 `PLAN.md`, `IMPLEMENTED.md`, SPEC, 상태 파일과 대상 코드만 읽는다. 최소 변경 후 관련 조항 상태와 증거, `CHANGELOG.md`를 갱신한다. 시트 열은 변경하거나 삭제하지 않고 필요한 열만 끝에 추가한다. 실제 역할과 상태의 전체 흐름에서 재현하고 확인한다.

## 9. FDS와 CSV 문서

- FDS는 QA 완료 후 현재 코드의 as-built 상태를 작성한다. `docs/FDS_GUIDE.md`와 고정 목차를 지키고 `npm.cmd run fds` 오류 0건까지 수정한다.
- 구현된 7.1 조항은 FS 또는 DS에 빠짐없이 연결한다. 미구현 조항은 범위 제외 목록에 사유와 함께 적는다.
- DQ, IOQ, RTM은 `docs/DRAFTS.md`를 따른다. IOQ는 사람이 실제 배포 URL의 고정 v1.0을 시험한다.

## 10. 릴리스 경계

- AI는 `git push`와 Vercel 배포를 실행하지 않는다.
- 명시적 요청이 있을 때만 `npm.cmd run check:commit`, `npm.cmd run check:sheets`, `npm.cmd run check:harness -- --final`, `npm.cmd run build`를 실행하고 커밋과 `v1.0` 태그를 준비한다.
- 산출물, SPEC, URS 변환본, 추적성, 증거 문서를 코드와 함께 커밋한다. 비밀과 빌드 산출물은 제외한다.
- 사람이 `git push origin main --tags`를 실행한다. 배포 후 `/api/seed`, 로그인, 저장, 재조회, 역할별 접근을 실제 환경에서 확인한다.

## 11. 최종 보고

최종 보고에는 실행 방법과 계정표, URS 기능 조항 총수와 상태 집계, 생성한 시트 탭, 구현 범위, 남은 범위와 사유, 하네스 게이트 결과, 실제 환경 검증 여부, 산출물 경로, 다음 사람의 작업을 포함한다. 구현한 조항을 채팅에 전부 나열하지 않고 `IMPLEMENTED.md`와 추적성 문서를 가리킨다.
