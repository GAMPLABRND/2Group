# URS 구현 증거

생성 시각: 2026-08-26T15:08:16+09:00
상태 지문: 93f0360565b6b90fb9119dff16bf87a42412acd6a71d53a8da6bf3ab67675d09

## URS-F-001

- 상태: 구현
- 구현 파일: app/equipment/page.tsx, app/equipment/EquipmentConsole.tsx, app/api/equipment/route.ts, lib/equipment.ts, lib/schema.ts, lib/schema-migration.ts
- 화면 또는 API: /equipment, GET/POST/PATCH /api/equipment
- source: app/api/equipment/route.ts, ADMIN 권한과 필수 기준정보를 검증하고 교정 또는 적격성평가 대상 중 하나라도 선택되면 유효한 교정 유효기간을 필수로 검사하며 교정 대상 장비의 유효기간 만료 시 사용중지 자동 전환 및 SYSTEM 감사추적을 기록한다.
- smoke: 실제 Google Sheets 장비 기준정보 분리 저장, INC-01을 교정 비대상과 적격성평가 대상으로 독립 저장한 뒤 GET /api/equipment에서 두 값을 그대로 재조회했다.
- source: app/equipment/EquipmentConsole.tsx, 교정 또는 적격성평가 대상 중 하나라도 선택하면 교정 유효기간 date 입력을 필수로 표시하고 두 대상이 모두 해제될 때만 날짜를 비운다.
- smoke: 실제 Google Sheets 적격성평가 대상 필수 날짜 차단, 교정 비대상, 적격성평가 대상과 빈 교정 유효기간으로 신규 등록을 요청하여 HTTP 400과 필수 입력 오류를 확인했으며 장비 행은 생성되지 않았다.

## URS-F-002

- 상태: 구현
- 구현 파일: app/records/new/page.tsx, app/records/new/NewRecordClient.tsx, app/api/records/start/route.ts, app/api/records/_lib/service.ts, lib/equipment.ts
- 화면 또는 API: /records/new, POST /api/records/start
- source: app/api/records/start/route.ts, TESTER 권한, 장비 사용가능, 점유, 교정 유효성과 점유 토큰을 서버에서 재검사한 뒤 시작 기록을 생성한다.
- smoke: 실제 Google Sheets /api/records/start, 교정 만료 장비가 사용중지와 사용 불가로 조회되고 직접 사용 시작 요청이 교정 만료 사유와 HTTP 409로 차단됨을 확인했다.

## URS-F-003

- 상태: 구현
- 구현 파일: app/records/[recordId]/RecordDetailClient.tsx, app/api/records/[recordId]/end/route.ts, app/api/remediations/route.ts, app/api/resume-requests/route.ts, app/api/approvals/resume-requests/[request_id]/decision/route.ts
- 화면 또는 API: /records/[recordId], POST /api/records/[recordId]/end, POST /api/remediations, POST /api/resume-requests, POST /api/approvals/resume-requests/[request_id]/decision
- source: app/api/records/[recordId]/end/route.ts, 기록 소유자와 사용중 상태를 검사하고 정상 또는 이상 종료를 처리하며 이상 시 장비를 사용중지한다.
- source: app/api/approvals/resume-requests/[request_id]/decision/route.ts, APPROVER 제2자 확인과 승인 또는 반려를 서버에서 처리하고 승인 시에만 장비를 복원한다.
- smoke: 실제 Google Sheets 종료와 재조회, 생성한 기록을 NORMAL로 종료하고 COMPLETED 상태와 장비 점유 해제, 목록 재조회를 확인했다.

## URS-F-004

- 상태: 구현
- 구현 파일: app/records/new/NewRecordClient.tsx, app/api/records/start/route.ts, app/api/records/[recordId]/end/route.ts
- 화면 또는 API: /records/new, POST /api/records/start, POST /api/records/[recordId]/end
- source: app/api/records/start/route.ts, 필수값과 형식을 서버에서 검증하고 누락 필드를 식별할 수 있는 400 오류로 저장을 차단한다.

## URS-F-005

- 상태: 구현
- 구현 파일: app/page.tsx, app/api/dashboard/data.ts, app/api/dashboard/route.ts, app/alarms/page.tsx, app/equipment-stats/page.tsx, app/api/alarms/unread/route.ts, components/UnreadAlarmPopup.tsx, lib/alarm-notifications.ts, lib/equipment.ts, lib/schema.ts
- 화면 또는 API: /, GET /api/dashboard, /equipment-stats, /alarms, GET/POST /api/alarms/unread
- source: app/api/dashboard/data.ts, 교정 만료 장비를 사용중지로 자동 전환한 뒤 장비 전체, 사용가능, 사용중, 사용중지, 폐기와 교정 만료를 집계한다.
- smoke: 실제 Google Sheets GET /api/dashboard, 실제 교정 만료 장비 2건이 사용중지로 집계되고 자동 전환 감사추적 2건이 저장됨을 확인했다.
- source: app/api/dashboard/data.ts, 사용 유형별 사용 횟수와 이상 발생 횟수를 서버에서 집계하고 (이상 발생 횟수 / 사용 횟수) * 100으로 이상율을 계산하며 사용 횟수가 0건이면 0%로 표시한다.
- source: components/UnreadAlarmPopup.tsx, 미확인 알람 팝업에 발생 일시, 유형, 대상 장비 또는 사용자, 주요 내용을 표시하고 서버 저장 사용자별 읽음 처리와 상세 이동을 제공하며 일반 역할에서 ADMIN 전용 유형을 제외한다.
- smoke: 실제 Google Sheets 대시보드와 미확인 알람 API, 장비 4건의 코드, 위치, 사용가능 상태와 사용 유형 통계의 이상율 필드를 재조회하고 TESTER 알람 7건의 필수 표시 필드와 ADMIN 전용 유형 제외를 확인했다. 한 알람을 읽음 처리한 뒤 새 세션에서 미확인 목록이 6건으로 유지되어 서버 저장 지속성을 확인했다.

## URS-F-006

- 상태: 구현
- 구현 파일: app/approvals/page.tsx, app/approvals/ApprovalsClient.tsx, app/api/approvals/route.ts, app/api/approvals/records/[record_id]/review-signature/route.ts, app/api/approvals/records/[record_id]/change-request/route.ts
- 화면 또는 API: /approvals, POST /api/approvals/records/[record_id]/review-signature, POST /api/approvals/records/[record_id]/change-request
- source: app/api/approvals/records/[record_id]/review-signature/route.ts, APPROVER 역할, 사용완료 상태와 비밀번호를 서버에서 재검사하여 전자서명 후 기록을 잠근다.
- source: app/approvals/ApprovalsClient.tsx, 검토 상세에서 장비의 교정 대상 여부와 적격성평가 대상 여부를 독립 항목으로 표시한다.
- smoke: 실제 Google Sheets 전자서명, APPROVER가 TESTER의 완료 기록을 조회하고 비밀번호 재입력 후 REVIEWED 상태와 서명 의미를 저장했다.

## URS-F-007

- 상태: 구현
- 구현 파일: app/records/RecordsClient.tsx, app/api/records/route.ts, app/print/logbook/LogbookClient.tsx, app/api/print/logbook/route.ts
- 화면 또는 API: /records, GET /api/records, /print/logbook, GET /api/print/logbook
- source: app/api/records/route.ts, 장비, 상태, 사용자, 기간 조건으로 사용 기록을 서버에서 조회한다.
- source: app/api/print/logbook/route.ts, 검토완료 기록만 조건 조회하고 교정 및 적격성평가 대상 여부를 독립 항목으로 포함한 로그북 데이터를 제공한다.
- smoke: 실제 Google Sheets 로그북 조회, 장비와 기간 조건의 공식 로그북 응답에서 INC-01의 교정 비대상과 적격성평가 대상을 독립 값으로 재조회했다.

## URS-F-008

- 상태: 구현
- 구현 파일: app/admin/AdminConsole.tsx, app/about/AboutClient.tsx, app/api/admin/route.ts, app/api/login/route.ts, app/api/password/route.ts, app/api/session/refresh/route.ts, components/SessionTimeout.tsx, app/layout.tsx, lib/permissions.ts, lib/training-profile.ts, lib/schema.ts
- 화면 또는 API: /admin, POST/PATCH /api/admin, /about, POST /api/admin (UPDATE_TRAINING_PROFILE), /password, POST /api/password, POST /api/session/refresh
- source: app/api/admin/route.ts, ADMIN이 계정과 역할, 상태, 유효 권한을 관리하고 변경을 감사추적에 기록한다.
- source: app/api/login/route.ts, 로그인 실패 횟수, 계정 잠금, 비밀번호 만료와 서버 세션을 보안 설정에 따라 검사한다.
- source: app/api/admin/route.ts, ADMIN 실습 정보 변경 시 가변 실습자 배열과 최소 1명, 필수값, 수정 사유를 서버에서 검증하고 전체 전후 목록, 수정자, 수정 일시와 사유를 감사추적에 기록한다.
- smoke: 실제 Google Sheets About 가변 실습자 저장, ADMIN이 한국제약바이오협회 소속 실습자1부터 실습자6까지 배열을 저장하고 전용 조회 API에서 6명과 lastModifiedBy=admin을 재조회했다.
- smoke: 실제 Google Sheets 계정과 권한, ADMIN, TESTER, APPROVER 로그인을 확인하고 TESTER의 관리자 API 직접 접근이 403으로 차단되며 활동 시 세션 갱신이 성공함을 확인했다.
- source: app/layout.tsx, 활성 세션의 USERS 기준정보를 조회하여 상단 접속 ID 바로 뒤에 사번을 괄호로 일관 표시한다.
- smoke: 로컬 서버 ADMIN 대시보드 HTML, 로그인 후 서버 렌더링 결과에 admin (EDU2-001)이 표시됨을 확인했다.
- source: app/admin/AdminConsole.tsx, 계정 등록과 수정에서 역할은 ADMIN, TESTER, APPROVER Select로 지정하고 추가 허용 및 차단 권한은 서버 권한 카탈로그의 한글명과 코드를 표시하는 드롭다운으로 선택하며 동일 권한의 허용·차단 중복 선택을 방지한다.
- source: lib/permissions.ts, 사전 정의 권한 카탈로그와 역할별 기본 권한을 단일 정본으로 제공하고 기본 역할 적용 후 사용자별 allow 추가와 deny 제외 순서로 유효 권한을 계산한다.
- smoke: 실제 Google Sheets ADMIN 권한 카탈로그 조회, ADMIN 로그인 후 /api/admin에서 한글명, 권한 코드와 기본 역할 배열을 갖춘 사전 정의 권한 항목 19개를 재조회했다.

## URS-F-009

- 상태: 구현
- 구현 파일: app/records/[recordId]/RecordDetailClient.tsx, app/api/records/[recordId]/invalidate/route.ts, app/api/records/_lib/service.ts
- 화면 또는 API: /records/[recordId], POST /api/records/[recordId]/invalidate
- source: app/api/records/[recordId]/invalidate/route.ts, 물리 삭제 없이 허용 상태의 본인 기록만 필수 사유와 함께 무효 상태로 전환하고 변경 이력을 남긴다.

## URS-F-010

- 상태: 구현
- 구현 파일: lib/audit.ts, app/api/login/route.ts, app/api/logout/route.ts, app/audit/page.tsx, app/api/audit/route.ts, app/api/audit/export/route.ts
- 화면 또는 API: /audit, GET /api/audit, GET /api/audit/export, POST /api/login, POST /api/logout
- source: lib/audit.ts, 감사추적은 서버가 행 ID와 시각을 부여하고 재시도 후에도 저장 실패하면 변경 요청을 실패 처리한다.
- source: app/api/login/route.ts, 로그인 성공과 실패를 감사추적에 기록하며 잠금 임계 도달도 별도 기록한다.
- source: app/api/logout/route.ts, 세션 삭제 전에 USERS에서 표시명을 조회하여 일반 및 자동 로그아웃 감사추적에 이름과 ID를 함께 기록하고 상대 경로 /login으로 응답하여 접속 호스트를 유지한다.
- smoke: 실제 Google Sheets GET /api/audit, 로그인, 권한 거부, 기록 생성과 종료, 전자서명, 로그북 출력 이벤트를 포함한 감사추적 행을 APPROVER로 재조회했다.
- smoke: 실제 Google Sheets 로그아웃 감사추적, ADMIN 로그아웃 후 SECURITY.LOGOUT 최신 행의 actor_name=관리자와 actor_id=admin을 함께 재조회했다.
