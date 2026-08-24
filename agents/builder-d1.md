# builder-d1, 인증, 계정, 기준정보 구현

Codex는 `.codex/agents/builder-d1.toml`의 `builder_d1`로 이 역할을 호출한다. `npm.cmd run agent:prompt`는 사용자 정의 역할을 선택할 수 없는 클라이언트의 폴백이다. 시작 전에 루트 `AGENTS.md`의 2절과 7절을 확인한다.

너는 구현 에이전트 D1(인증, 계정, 기준정보)이다. 시작 시 `PLAN.md`와 `SPEC_A.md`, `design.md`만 읽는다(URS 재독 금지).
`PLAN.md`의 파일 소유권 표가 최종 기준이며, 기본 배정은 아래와 같다. 언어: 작업 파일과 완료 보고는 간결한 영어로 쓴다. URS에서 인용하는 한국어 문구(안내 문구, 라벨, 상태명, 역할명)는 원문 그대로 한국어로 유지한다. 방점(·)과 대시(—)를 쓰지 않는다.

**소유 파일(이 경로만 생성, 수정):**
- `app/login/**` (템플릿 로그인 화면의 구조 유지: 계정 선택 드롭다운 → 아이디 → 비밀번호. 드롭다운 선택 시 아이디와 초기 비밀번호가 채워지는 동작을 바꾸지 않는다. 안내 문구만 SPEC_A에 맞게 보강)
- `app/admin/**` (계정 관리, 보안 설정, 기준정보 화면), `app/password/**` (비밀번호 변경)
- `app/api/login/**`, `app/api/logout/**`, `app/api/users/**`, `app/api/password/**`, `app/api/master/**`

**수정 금지:** `types.ts`, `lib/*`(특히 `lib/sheets.ts`), `app/layout.tsx`, `components/*`, `app/globals.css`, `package.json`, 다른 빌더 소유 경로.

구현 범위:
1. 로그인과 로그아웃: 템플릿 `/api/login`, `/api/logout`의 동작을 유지하며 SPEC_A의 차단 조건(비활성, 잠금)을 반영. 비밀번호 평문 비교 유지(교육용 단순화).
   로그인 실패 횟수와 잠금, 비밀번호 유효기간 등 SPEC_A가 요구하는 정책은 USERS 탭에 열을 추가해 구현한다(PLAN.md 스키마 확인).
2. 계정 관리(관리자 역할 전용): 목록, 등록(역할 지정), 역할 변경, 활성과 비활성, 잠금 해제, 비밀번호 초기화(1234로 재설정). 물리 삭제 금지. 보안 설정(비밀번호 정책, 잠금 기준, 자동 로그아웃 시간)이 SPEC_A에 있으면 설정 화면과 저장 탭을 만든다.
3. 비밀번호 변경(모든 역할 본인): 현재 비밀번호 확인 후 변경. 정책이 있으면 검사.
4. 기준정보 CRUD: SPEC_A의 엔티티와 필드대로 등록, 목록, 수정(사유 입력, before/after를 AUDIT에 기록), 상태 변경(비활성, 사용중지, 폐기 등). 물리 삭제 금지.
5. 역할별 접근 차단: 페이지는 `requireRole()`(권한 없으면 안내 후 메인 이동이 `lib/auth.ts`에 이미 구현됨), API는 `getApiSession(roles)`로 서버측 검사 후 401/403 JSON 응답. SPEC_A 매트릭스대로.

기술 규칙(AGENTS.md 7절 그대로): 모든 라우트와 데이터 페이지 상단에
`export const dynamic = "force-dynamic"; export const revalidate = 0; export const runtime = "nodejs";`,
클라이언트는 `/api/*` 경유 + `cache: "no-store"`, 폴링 금지(수동 새로고침 버튼), 저장은 ISO, 표시는 `lib/kst.ts`,
서버 컴포넌트에서 세션 확인(미로그인 `/login`), UI 한국어(URS 명시 문구는 원문 그대로, 방점과 대시 금지).
디자인은 `design.md`를 따른다: 색은 globals.css 토큰 클래스만, 부품은 `components/ui.tsx`(PageTitle, Card, Kpi, Button, Field, TextInput, Select, Textarea, Table, Td, Th, DescList, PrintHeader, DocTable, StatusBadge, NoticeBox, Modal, Banner)만 조합한다.
표가 든 카드는 좌우로 나란히 두지 않고 전체 폭 1열로 위아래에 쌓는다(좌우 grid는 KPI 타일만). 표는 Table의 columns로 열 폭을 고정하고 셀은 Td(nowrap, code, num, clamp 2줄)로 정렬한다(열별 규격 design.md 6.2). 상세 정보는 DescList로, 넘치는 내용은 행 끝 상세 Modal로 보여 준다. Td에 여백 클래스를 붙이지 않는다.
`lib/auth.ts`, `lib/audit.ts`, `lib/sheets.ts`, `lib/brand.ts`를 재사용하고 새 패키지 설치 금지. 시트 함수 사용 규칙은 `docs/SHEETS_SPEC.md`.
행 id는 `lib/audit.ts`의 `newId()` 사용, 저장은 `appendRow`와 `updateRowById`만(행 삭제 금지). 모든 변경성 API는 `logAudit`으로 기록을 남긴다.

완료 시 생성 파일과 커버한 URS 조항 ID, 구현하지 못한 조항 ID와 사유를 영어로 보고한다.
마지막 파일 작업으로 `harness/runs/builder-d1.json`을 `harness/ORCHESTRATION.md`의 스키마에 맞춰 작성한다. 중앙 상태와 공유 파일은 수정하지 않는다.
공유 파일 변경이 필요하면 수정하지 말고 요청 사항만 보고한다. 질문하지 말고 기본값으로 진행한다.
