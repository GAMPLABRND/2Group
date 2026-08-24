# 하네스 v3 실행 워크플로우

## 1. 목적과 시간 목표

이 워크플로우는 KPBMA-EDU-001-URS를 읽고 Next.js, TypeScript, Tailwind, Google Sheets, Vercel 기반 교육용 GMP MVP를 만드는 절차다. 전자로그북, 세척밸리데이션 관리, 실험실 재고관리 중 어느 시스템인지는 URS가 결정한다.

교육 운영 목표는 60분이다.

| 단계 | 목표 시간 | 종료 조건 |
|---|---:|---|
| STEP 0 | 3분 | URS 변환, 조항 인벤토리, 환경 상태 확인 |
| STEP 1 | 6분 | SPEC_A, SPEC_B, SPEC_C 완성, 전 조항 분석 소유자 배정 |
| STEP 2 | 6분 | PLAN, 시트 스키마, 역할, 계정, 메뉴, 파일 소유권 확정 |
| STEP 3 | 33분 | D1부터 D4 구현 완료, 구현 파일과 조항 보고 수집 |
| STEP 4 | 12분 | 통합, 하네스 감사, 빌드, 기동, 가능한 스모크, 산출물 동기화 |

시간은 진행 우선순위를 정하는 기준이다. 완료 가능한 기능을 미구현으로 남기거나 서브에이전트를 중단하는 기준으로 사용하지 않는다.

## 2. STEP 0, 입력과 상태 초기화

1. `docs/urs/`에서 `.docx`와 `.md`를 찾는다. Word 잠금 파일은 무시한다.
2. 다음 명령을 실행한다.

   ```powershell
   npm.cmd run harness:init
   ```

3. 명령은 `.docx`를 Markdown으로 변환하고 `harness/state/URS_STATUS.json`을 만든다. 기존 상태가 있으면 같은 ID와 같은 문구의 상태와 증거를 보존하고 새 ID를 추가한다. 같은 ID의 문구나 종류가 바뀌면 이전 완료 증거를 재사용하지 않고 `pending`으로 초기화한다.
4. 출력된 전체 조항 수와 기능 조항 수를 URS 표와 대조한다. 기능 ID가 0개이거나 중복 ID가 있으면 구현으로 넘어가지 않는다.
5. 조항 ID가 Word 자동 번호라 변환에서 사라졌다면 URS 표 첫 열에 텍스트 ID가 있는지 확인한다. 원본을 임의로 고치지 않고 변환본에 임시 ID를 부여할 때는 `DECISIONS.md`에 기록한다.
6. `.env.local`에 `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`가 있는지만 확인한다. 값은 출력하지 않는다. 누락되어도 코드 구현은 계속하고 실제 Sheets 스모크만 환경 대기로 남긴다.
7. `harness/state/RUN_STATE.json`을 다음 형태로 만든다.

   ```json
   {
     "harness_version": "3.0.0",
     "mode": "one_shot_build",
     "phase": "analysis",
     "status": "in_progress",
     "last_completed_step": "STEP_0",
     "next_action": "Run analyzer roles",
     "environment": {
       "env_file_present": false,
       "sheets_smoke": "not_run",
       "browser_smoke": "not_run",
       "deployment_smoke": "not_run"
     }
   }
   ```

## 3. STEP 1, URS 분석

`harness/ORCHESTRATION.md`에 따라 analyzer-a, analyzer-b, analyzer-c를 최대 3개 동시 실행한다.

- analyzer-a: Section 2, Section 6 전체, 기준정보, 계정, 보안, 접근 관련 7.1, 환경의 시드 계정
- analyzer-b: 기록, 등록, 입출고, 재고, 계산, 판정, 워크플로우, 검토, 승인, 전자서명, 조회, 출력, 대시보드, 알람 관련 7.1
- analyzer-c: 데이터 완전성, 감사추적, 보존, 백업 관련 7.1과 Section 7.2부터 7.8

애매한 업무 기능은 analyzer-b에 둔다. 조항을 중복 배정할 수는 있지만 미배정 기능 조항은 허용하지 않는다.

분석 결과는 요약이 아니라 바로 구현 가능한 수준이어야 한다.

- 필드: snake_case 키, 한국어 라벨, 필수 여부, 형식, 자동 입력 여부
- 역할과 권한: 화면과 기능별 O, 조건부, X
- 상태: 코드, 한국어 표시, 허용 전이, 역할, 차단 조건
- 계산: 입력, 산식, 단위, 반올림, 경계값, 판정
- 차단: 서버 검사 위치와 URS 원문 안내 문구
- 감사추적: 이벤트, 행위자, before, after, 사유, 시각
- 시드: 탭과 행 수준의 구체 값, 멱등 조건

오케스트레이터는 세 SPEC에서 모든 기능 ID가 적어도 한 번 등장하는지 확인하고 중앙 상태의 `analysis_owner`와 `implementation_owner`를 확정한다.

## 4. STEP 2, 통합 설계 고정

오케스트레이터가 단독으로 `PLAN.md`와 공유 파일을 정비한다.

`PLAN.md` 필수 항목:

1. 시스템 개요와 핵심 흐름
2. URS §6.1 역할 코드, 한국어 역할명, 권한 요약
3. URS 계정표와 초기 비밀번호 1234
4. URS §6.2, §6.3 메뉴와 화면 권한
5. Google Sheets 탭별 헤더, 첫 열 `id`, 업무키, 상태, 감사추적 연결
6. 상태 머신과 서버 차단 규칙
7. D1부터 D4의 겹치지 않는 파일 소유권
8. 시스템 고유 결정과 URS 근거가 없는 기본값
9. 대시보드와 알람 집계 항목
10. 구현 순서와 통합 의존성

공통 탭의 최소 스키마:

- `USERS`: `id`, `user_id`, `name`, `password`, `role`, `status`, `created_at`
- `AUDIT`: `id`, `category`, `actor_id`, `actor_name`, `role`, `action`, `target`, `before_value`, `after_value`, `reason`, `timestamp_kst`

업무 탭은 SPEC대로 확정한다. 행은 물리 삭제하지 않는다. 기존 열 이름을 바꾸거나 삭제하지 않는다.

오케스트레이터만 다음 공유 파일을 수정한다.

- `types.ts`: URS 역할, 역할 라벨, 상태, 엔티티 타입
- `lib/brand.ts`: TEAM_NO, SYSTEM_NAME
- `app/layout.tsx`: MENUS와 권한
- 필요한 경우 `components/*`, `app/globals.css`

`lib/sheets.ts`는 수정하지 않는다. 다음 명령이 실패하면 복원하고 다시 확인한다.

```powershell
npm.cmd run check:sheets
npm.cmd run check:sheets -- --restore
```

## 5. STEP 3, 구현

`harness/ORCHESTRATION.md`의 슬롯 인식 웨이브로 builder-d1부터 builder-d4를 실행한다.

### D1, 인증과 기준정보

- 계정 선택, 아이디, 비밀번호 순서의 로그인 구조 유지
- 비활성, 잠금, 비밀번호 정책을 서버에서 검사
- 계정 등록, 역할 변경, 활성과 비활성, 잠금 해제, 비밀번호 초기화
- 본인 비밀번호 변경
- 기준정보 등록, 조회, 수정, 상태 전환
- 페이지와 API의 역할 검사

### D2, 핵심 업무 기록

- URS 필드 전부를 포함한 등록, 목록, 상세
- 작성자와 시각의 서버 자동 부여
- 계산과 판정의 서버 재계산
- 필수값과 경계값 검사
- 음수 재고, 기한 경과품, 교정 만료, 중복 사용, 시간 역전 등 시스템별 차단
- 승인 전 수정, 사유 기반 무효 처리, 연동 상태 복원

### D3, 워크플로우와 전자서명

- 허용 상태 전이 화이트리스트와 역할 검사
- 요청, 승인, 반려, 수정 요청
- 승인 후 잠금
- 비밀번호 재입력 전자서명과 서명 의미 기록
- 문서번호, 인쇄 대상 조건, DRAFT 워터마크, CI, 서명란
- 인쇄 행위 감사추적

### D4, 감사추적과 운영 화면

- SECURITY와 DATA 감사추적 조회, 조건 검색, 상세 Modal
- 인쇄 보고서와 CSV 내보내기
- 전체 탭 생성과 URS 계정, 시드 데이터의 멱등 시드
- 대시보드와 알람
- 앱 README

각 변경성 API는 성공한 변경뿐 아니라 URS가 요구한 권한 거부나 로그인 실패 등 보안 이벤트도 필요한 범위에서 기록한다. 서버 차단 없이 UI 버튼만 숨기는 구현은 완료 증거가 아니다.

## 6. STEP 4, 통합과 검증

### 6.1 역할 결과 수거

1. `harness/runs/analyzer-*.json`, `builder-*.json`이 모두 존재하는지 확인한다.
2. 각 파일의 `status`가 `complete`인지 확인한다. `blocked`이면 오케스트레이터가 안전하게 해결 가능한 범위를 이어서 처리한다.
3. 보고된 파일이 실제 존재하는지, 보고된 조항이 실제 코드 경로에 연결되는지 확인한다.
4. import, 타입, 메뉴, 경로, 시트 헤더, 상태 코드의 교차 불일치를 통합한다.

### 6.2 중앙 상태와 산출물

오케스트레이터가 `harness/state/URS_STATUS.json`의 각 기능 조항을 갱신한다.

- `implemented`: 코드가 있고 검증 가능한 증거가 있음
- `partial`: 일부 동작만 있으며 완료로 보고할 수 없음
- `not_implemented`: 코드가 없음
- `pending`, `in_progress`: 작업 중

`implemented`에는 적어도 하나의 실제 파일과 하나의 증거가 필요하다. 실제 환경을 실행하지 못한 것은 코드 상태를 낮추지 않고 `environment_pending` 증거로 구분한다.

다음 명령으로 사람이 읽는 산출물을 생성한다.

```powershell
npm.cmd run harness:sync
```

생성 대상:

- `IMPLEMENTED.md`
- `docs/generated/URS_TRACEABILITY.md`
- `docs/generated/URS_EVIDENCE.md`
- `docs/generated/URS_GAPS.md`

### 6.3 코드 게이트

다음 순서로 실행한다.

```powershell
npm.cmd run check:sheets
npm.cmd run lint
npm.cmd run build
npm.cmd run check:harness -- --final
```

초기 시간 안에는 전체 빌드 수정 사이클을 두 번 이내로 유지한다. 이후에는 오류 파일을 직접 검사하고 타입 또는 lint를 좁혀 수정한 뒤 최종 빌드를 다시 통과시킨다. 실패 기능을 숨기거나 주석 처리해 완료로 바꾸지 않는다.

### 6.4 실제 Google Sheets 스모크

`.env.local`이 있을 때 다음 한 흐름을 실제 ID로 수행한다.

1. `/api/seed`
2. URS 계정 선택, 비밀번호 1234 로그인
3. 기준정보 또는 핵심 기록 1건 저장
4. 다른 역할 또는 재조회에서 같은 행 확인
5. 관련 상태 전이 또는 차단 규칙 1건 확인
6. AUDIT 행 확인

HTTP 200이나 화면 렌더만으로 저장과 동기화를 증명하지 않는다. 응답 구조를 먼저 읽고 반환된 실제 ID를 다음 요청에 사용한다.

환경이 없거나 외부 연결이 막히면 실행하지 않은 항목을 `RUN_STATE.json`에 `not_run`과 이유로 남긴다. 가짜 PASS를 만들지 않는다.

### 6.5 화면 점검

- 로그인 선택 시 아이디와 초기 비밀번호가 함께 채워지는지 확인한다.
- 각 역할의 메뉴와 직접 URL 접근이 권한 매트릭스와 맞는지 확인한다.
- 표가 든 카드는 전체 폭 1열인지 확인한다.
- 열 폭 실수 시에도 표가 카드 밖으로 나오지 않는지 확인한다.
- 긴 ID와 URL은 말줄임되고 상세 Modal에서 전체 값이 보이는지 확인한다.
- 인쇄 화면의 CI, 문서번호, 출력자, 출력 시각, 서명란, DRAFT 조건을 확인한다.

## 7. QA 수정 모드

1. 보고된 역할, 계정, 데이터 상태에서 재현한다.
2. 결함 수정, URS 범위 개선, URS 외 요청 중 하나로 분류한다.
3. 관련 조항과 사용자 흐름 전체를 확인한다. 공용 Modal이나 표 문제는 모든 호출부를 감사한다.
4. 최소 변경 후 변경 파일의 lint 또는 타입 검사, 관련 API와 화면 흐름을 확인한다.
5. `URS_STATUS.json`, `CHANGELOG.md`를 갱신하고 `harness:sync`를 실행한다.
6. 변경한 동작, 확인 방법, 남은 환경 검증을 한국어 보고체로 보고한다.

URS 외 요청은 구현할 수 있지만 `DECISIONS.md`에 `URS 개정 대상`으로 기록한다. 정식 IOQ 범위에 자동으로 포함시키지 않는다.

## 8. FDS 작성 모드

QA가 끝나고 현재 코드 상태가 안정된 뒤 수행한다.

1. `docs/FDS_GUIDE.md`를 끝까지 읽는다.
2. 근거 우선순위는 현재 코드, `URS_STATUS.json`, `IMPLEMENTED.md`, `PLAN.md`, `DECISIONS.md`, `CHANGELOG.md`, URS다.
3. 고정 목차로 `docs/FDS.md`를 작성한다.
4. `npm.cmd run fds`를 실행해 FS, DS, URS 연결 오류가 0건이 될 때까지 수정한다.
5. 생성된 DOCX가 열리는지 확인한다. 구조 검증만 수행했으면 시각 검증을 완료했다고 보고하지 않는다.

## 9. 릴리스 준비 모드

사용자가 명시적으로 요청했을 때만 수행한다.

1. `npm.cmd run check:commit`
2. `npm.cmd run check:sheets`
3. `npm.cmd run check:harness -- --final`
4. `npm.cmd run build`
5. `IMPLEMENTED.md`, 추적성, 증거, gaps, PLAN, DECISIONS, CHANGELOG, SPEC, URS 변환본이 최신인지 확인한다.
6. 한국어 커밋 메시지로 커밋한다.
7. 배포 준비 요청이면 `v1.0` 태그를 만든다.
8. `git push`는 실행하지 않고 사람이 실행할 명령만 안내한다.

## 10. 재개 규칙

새 턴이나 새 세션에서 `계속` 요청을 받으면 다음 순서로 복원한다.

1. `AGENTS.md`
2. `harness/state/RUN_STATE.json`
3. `harness/state/URS_STATUS.json`
4. `PLAN.md`, SPEC, 역할 완료 파일
5. `git status --short` 또는 현재 파일 변경 상태

이미 완료된 분석이나 구현을 처음부터 반복하지 않는다. 마지막 미완료 게이트부터 이어서 수행한다.
