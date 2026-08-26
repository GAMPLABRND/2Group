# URS 기반 전자로그북 MVP 통합 계획

## 1. 시스템 개요와 핵심 흐름

시스템 제목은 `CSV실습과정 2조 전자로그북`이다. TESTER가 사용가능하고 미사용인 장비의 사용 시작을 등록하고, 본인이 시작한 기록을 정상 또는 이상으로 종료한다. 이상 종료 시 장비는 사용중지되며 조치 기록과 사용 재개 요청 후 APPROVER의 제2자 확인 승인을 받아야 사용가능으로 복원된다. 사용완료 기록은 APPROVER가 비밀번호를 재입력하여 검토완료 전자서명하고 이후 잠긴다. 잘못된 기록은 삭제하지 않고 사유와 함께 무효 처리한다. [URS-F-001부터 URS-F-010]

## 2. 역할과 계정

| 계정 ID | 이름 | 역할 코드 | 역할명 | 초기 비밀번호 | URS |
|---|---|---|---|---|---|
| admin | 관리자 (EDU2-001) | ADMIN | 관리자 | 1234 | URS-E-002, URS-F-008 |
| user | 사용자 (EDU2-002) | TESTER | 사용자 | 1234 | URS-E-002, URS-F-002, URS-F-003 |
| reviewer | 검토자 (EDU2-003) | APPROVER | 검토자 | 1234 | URS-E-002, URS-F-006 |

ADMIN은 기준정보와 계정, 보안 설정, 예외 종료를 관리한다. 계정 등록과 수정의 기본 역할은 ADMIN, TESTER, APPROVER Select로 지정하고 개별 추가 허용 및 차단 권한은 서버 권한 카탈로그의 한글명과 코드를 표시하는 드롭다운에서 선택한다. TESTER는 사용 시작과 종료, 본인 기록의 수정과 무효, 조치와 재개 요청을 수행한다. APPROVER는 수정 요청, 검토완료 전자서명, 사용 재개 승인 또는 반려를 수행한다. 모든 권한은 서버에서 다시 검사한다. [URS §6.1, §6.3, URS-F-008, URS 개정 대상]

## 3. 메뉴와 권한

| 메뉴 | 경로 | 허용 역할 | 기능 | URS |
|---|---|---|---|---|
| 대시보드 | `/` | ADMIN, TESTER, APPROVER | 장비 코드, 위치, 사용가능 상태 기준정보와 현황, 상태별 목록, 통계 | URS-F-005, URS 개정 대상 |
| 기준정보 | `/equipment` | 전체 조회, ADMIN 변경 | 장비 등록, 수정, 상태 관리 | URS-F-001 |
| 사용등록 | `/records/new` | TESTER, ADMIN은 비활성 메뉴 | 사용 시작 | URS-F-002, URS-F-004 |
| 사용기록 | `/records` | 전체 조회, 역할별 변경 | 종료, 수정, 무효, 예외 종료, 조치 | URS-F-003, URS-F-007, URS-F-009 |
| 검토와 승인 | `/approvals` | APPROVER | 수정 요청, 검토완료, 재개 결정 | URS-F-003, URS-F-006 |
| 로그북 | `/print/logbook` | ADMIN, TESTER, APPROVER | 검토완료 기록 조회와 인쇄 | URS-F-007 |
| 알람 | `/alarms` | ADMIN, TESTER, APPROVER | 이상, 사용중지, 교정 알람과 이력, 로그인 후 미확인 알람 팝업과 사용자별 읽음 처리 | URS-F-003, URS-F-005, URS 개정 대상 |
| 감사추적 | `/audit` | ADMIN, APPROVER | 조건 조회, 상세, CSV, 인쇄 | URS-F-010 |
| 백업 | `/backup` | ADMIN | XLSX 생성, 브라우저 다운로드, 실행 이력 | URS-D-003, URS 개정 대상 |
| 비밀번호 변경 | `/password` | ADMIN, TESTER, APPROVER | 본인 비밀번호 변경 | URS-F-008 |
| 관리자 설정 | `/admin` | ADMIN | 계정, 보안 설정, 실습 정보 | URS-F-008 |

## 4. Google Sheets 스키마

열의 구현 정본은 `lib/schema.ts`다. 모든 탭의 첫 열은 `id`이며 행은 물리 삭제하지 않는다.

| 탭 | 헤더 요약 | 쓰는 흐름 | 소유 역할 | URS |
|---|---|---|---|---|
| USERS | id, user_id, name, password, role, status, created_at 뒤 employee_no와 보안 열 | 로그인과 계정 관리 | D1 | URS-F-008, URS-E-002 |
| SECURITY_SETTINGS | id, 비밀번호 정책, 잠금 기준, 자동 로그아웃, 수정 정보 | 보안 설정 | D1 | URS-F-008 |
| TRAINING_PROFILE | id, 기존 company_name과 trainee_name, team_no, 수정 정보 뒤 members_json | 가변 실습자와 회사 정보, 기존 열 호환 | D1 | URS-F-008, URS 개정 대상 |
| TRAINING_HISTORY | id, user_id, course_name, completed_at, recorded_by, status | 교육 이력 | D4 | URS-L-002 |
| EQUIPMENT | id, 장비 정보, 교정 또는 적격성평가 대상일 때 필수인 교정 유효기간, 사용 상태, 점유 상태, 점유 연결, 변경 정보 | 기준정보와 점유 | D1 | URS-F-001, URS-F-006, URS-F-007, URS-E-003, URS 개정 대상 |
| USE_RECORDS | id, 장비와 사용자 참조, 사용 정보, 종료, 검토, 무효, 변경 정보 | 사용 기록 전체 | D2 | URS-F-002부터 URS-F-004, URS-F-006, URS-F-007, URS-F-009 |
| EQUIPMENT_REMEDIATIONS | id, 장비와 이상 기록, 조치 내용, 상태 | 이상 조치 | D2 | URS-F-003 |
| EQUIPMENT_RESUME_REQUESTS | id, 조치 연결, 요청, 제2자 확인, 승인과 반려 | D2 생성, D3 결정 | D2와 D3 | URS-F-003 |
| BACKUP_SETTINGS | id, interval_days, execution_time, enabled, timezone, 수정 정보 | 이전 자동 백업 설정의 비활성 호환 이력 | D4 | URS-D-003, URS 개정 대상 |
| BACKUP_RUNS | id, 백업 일자와 시각, 상태, 범위, XLSX 메타데이터, 빈 Drive ID, SHA-256, 트리거 | 브라우저 수동 백업 이력 | D4 | URS-D-003, URS 개정 대상 |
| BACKUP_ALARMS | id, backup_id, 결과, 백업본 형태, 파일명, 오류와 생성 시각 | ADMIN 전용 완료 및 실패 알람 | D4 | URS-D-003, URS 개정 대상 |
| ALARM_ACKS | id, alarm_key, user_id, acknowledged_at, 알람 유형과 대상 | 사용자별 미확인 알람 읽음 이력 | D4 | URS-F-005, URS 개정 대상 |
| AUDIT | id, category, actor_id, actor_name, role, action, target, before_value, after_value, reason, timestamp_kst | 변경과 보안 이력 | D4, 모든 변경 API 호출 | URS-F-010 |

## 5. 상태 머신과 서버 차단

사용 기록은 `IN_USE 사용중` → `COMPLETED 사용완료` → `REVIEWED 검토완료` 순서다. 수정 요청은 `COMPLETED` → `CHANGE_REQUESTED 수정요청` → `COMPLETED`로 돌아간다. 허용된 검토완료 전 본인 기록만 `INVALID 무효`로 전환하며 사용중 기록을 무효 처리하면 점유를 해제한다. 검토완료와 무효 상태는 변경하지 않는다. [URS-F-003, URS-F-006, URS-F-009]

장비 사용 상태는 `AVAILABLE 사용가능`, `SUSPENDED 사용중지`, `RETIRED 폐기`, 점유 상태는 `FREE 미사용`, `OCCUPIED 사용중`으로 분리한다. 교정 대상 장비의 유효기간이 KST 현재 날짜보다 과거가 되면 장비 조회, 대시보드, 알람 또는 사용 시작 조회 시 `SUSPENDED 사용중지`로 자동 전환하고 SYSTEM 감사추적을 남긴다. 사용 시작 시 교정 만료 사유를 일반 사용중지보다 먼저 검사한다. 동시 시작은 후보 기록 ID를 점유 토큰으로 먼저 기록하고 재조회하여 토큰 소유를 확인한 요청만 기록을 추가한다. 실패 시 자기 토큰인 경우에만 점유를 복원한다. [URS-F-001, URS-F-002, URS 개정 대상]

이상 종료는 `AVAILABLE + OCCUPIED` → `SUSPENDED + FREE`로 전환한다. 조치와 재개 요청 또는 반려 중에는 사용중지를 유지하고 APPROVER 승인만 `AVAILABLE + FREE`로 복원한다. 반려 사유, 예외 종료 사유, 수정 사유, 무효 사유는 필수다. 전자서명은 APPROVER 본인 비밀번호를 서버에서 확인한 뒤 서명자, 시각, 의미를 기록한다. [URS-F-003, URS-F-006]

## 6. 대시보드와 알람 집계

대시보드는 전체, 사용가능, 사용중, 사용중지, 폐기, 교정 만료 수와 장비 코드, 장비명, 위치, 사용가능 상태를 표시한다. 장비 사용 통계는 사용 유형별 사용 횟수와 이상 발생 횟수로 `(이상 발생 횟수 / 사용 횟수) * 100`을 계산하고 분모가 0건이면 `0%`로 표시하며 서버 시각 기준 가동 시간을 함께 제공한다. 교정 만료와 90일 이내 만료 임박, 이상과 재개 이력, 보안 잠금 경고를 알람에 표시한다. 로그인 후 서버 저장 읽음 이력을 기준으로 미확인 알람 팝업을 한 번 조회하고 발생 일시, 유형, 대상, 주요 내용을 표시하며 읽음 처리 또는 상세 이동을 제공한다. 백업 완료와 실패 알람은 ADMIN에게만 표시하고 완료 파일 다운로드도 ADMIN만 허용한다. 자동 폴링은 없고 수동 새로고침을 제공한다. [URS-F-005, URS-F-008, URS-D-003, URS 개정 대상]

## 7. 파일 소유권

| 역할 | 생성 또는 수정 경로 | 금지 경로 | 의존 입력 |
|---|---|---|---|
| 오케스트레이터 | `types.ts`, `lib/*`, `app/layout.tsx`, `components/*`, `app/globals.css`, 문서와 중앙 상태 | `lib/sheets.ts` 직접 수정 | 세 SPEC |
| D1 | `app/login/**`, `app/admin/**`, `app/password/**`, `app/equipment/**`, `app/api/login/**`, `app/api/logout/**`, `app/api/admin/**`, `app/api/password/**`, `app/api/equipment/**` | 공유 파일과 다른 역할 경로 | PLAN, SPEC_A |
| D2 | `app/records/**`, `app/api/records/**`, `app/api/remediations/**`, `app/api/resume-requests/**` | approvals, print, audit, seed, 공유 파일 | PLAN, SPEC_B, SPEC_C의 무효 규칙 |
| D3 | `app/approvals/**`, `app/print/**`, `app/api/approvals/**`, `app/api/print/**` | records 데이터 변경 소유 경로와 공유 파일 | PLAN, SPEC_B |
| D4 | `app/page.tsx`, `app/audit/**`, `app/alarms/**`, `app/api/audit/**`, `app/api/alarms/**`, `app/api/dashboard/**`, `app/api/seed/**`, `app/api/backup/**`, `README.md` | 공유 파일과 다른 역할 경로 | PLAN, SPEC_C, 통합 스키마 |

## 8. 고유 결정과 기본값

시스템명과 조번호는 URS 본문과 표지의 `2조 전자로그북`을 따른다. 파일명의 `1조`는 문서 본문과 불일치하므로 사용하지 않는다. 시드 표시명, 사번, 장비 코드와 위치, 비밀번호 정책 기본값은 `DECISIONS.md`에 `URS 근거 없음, 기본값`으로 기록한다. 백업은 사용자의 최신 변경 요청에 따라 자동 스케줄과 Google Drive 파일 저장을 사용하지 않고 ADMIN의 브라우저에서 수동 생성 후 사용자 PC에 저장한다. 실제 브라우저 다운로드와 XLSX 복구 검증은 외부 환경 증거로 구분한다. [URS-D-003, URS 개정 대상]

## 9. 구현 순서와 통합 의존성

1. 오케스트레이터가 역할 코드, 브랜드, 메뉴, 스키마를 고정한다.
2. D1부터 D4가 겹치지 않는 경로를 병렬 구현한다.
3. 오케스트레이터가 import, 상태 코드, 시트 헤더와 공유 변경 요청을 통합한다.
4. 기능 조항마다 화면 또는 API, 서버 규칙, source 증거를 중앙 상태에 기록한다.
5. 실제 Sheets에서 seed, 로그인, 저장, 재조회, 상태 전이 또는 차단, 감사추적을 확인한다.
6. 추적성 동기화 후 최종 하네스, Sheets, lint, build 게이트를 수행한다.
