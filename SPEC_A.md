# SPEC A: Scope, RBAC, accounts, and equipment master data

## 1. System overview

**System title:** `CSV실습과정 2조 전자로그북`  
**TEAM_NO:** `2`  
**SYSTEM_NAME:** `전자로그북`

This Electronic Logbook Management System (ELMS) records GMP equipment and analytical-instrument use history for the CSV training course. A TESTER selects eligible equipment, registers use start and completion information, and an APPROVER completes review by electronic signature. The server must block use of equipment that is `사용중지`, `폐기`, calibration-expired, or already `사용중`; it must also preserve invalidated records rather than physically deleting them. An abnormal post-use result suspends the equipment until a separately recorded corrective action and APPROVER approval restore its use. The scope is the web application, Google Sheets data store, browser access on user PCs, and data-integrity controls; cloud-provider, infrastructure, disaster-recovery, and training-network controls are out of scope.  
**Basis:** URS §2.1, §2.2, §2.3, §2.4.

## 2. Roles and responsibilities

| Role code | Korean role name | Responsibilities that must be enabled or prevented |
| --- | --- | --- |
| `ADMIN` | 관리자 | Register and amend equipment master data with a modification reason; manage equipment `사용가능`, `사용중지`, and `폐기` use statuses; perform reasoned exceptional closure of an in-progress record; view the dashboard and records; print logbooks; view and print 감사추적 reports; create users, assign roles, activate or deactivate users, unlock accounts, reset passwords, and configure password and automatic-log-out settings. ADMIN must not register, complete, or review normal use records. |
| `TESTER` | 사용자 | Register equipment-use start; complete only records that the TESTER started, including `사용 후 상태` and `특이사항`; amend or invalidate own pre-review records with the required reason; record corrective action for `사용중지` equipment and request resumption; respond to an APPROVER modification request; view dashboard and records; print logbooks. |
| `APPROVER` | 검토자 | Electronically sign a `사용완료` record after re-entering the APPROVER password; request a correction with a reason; review abnormal-end details and corrective action; approve or reject a resumption request with a mandatory rejection reason; perform the second-person confirmation; view dashboard and records; print logbooks; view and print 감사추적 reports. |

**Basis:** URS §6.1. Role codes and Korean names are URS-defined, not defaults.

## 3. Accounts, authentication, and security settings

### 3.1 Required idempotent training accounts

The seed routine must use `user_id` as the natural key. It must append a row only when that `user_id` is absent and must not overwrite an existing account, password, role, or account status. `id` values below are deterministic only for initial seeding; normal account creation uses the standard generated row ID.

| id | user_id | display_name | employee_no | role_code | account_status | initial password |
| --- | --- | --- | --- | --- | --- | --- |
| `seed-user-admin` | `admin` | `관리자` | `EDU2-001` | `ADMIN` | `활성` | `1234` |
| `seed-user-user` | `user` | `사용자` | `EDU2-002` | `TESTER` | `활성` | `1234` |
| `seed-user-reviewer` | `reviewer` | `검토자` | `EDU2-003` | `APPROVER` | `활성` | `1234` |

The seed account IDs and roles are mandatory. The display names and employee numbers are **URS 근거 없음, 기본값** chosen to satisfy the required employee-number display rule. The first-build password `1234` is a harness-fixed value. Login account selection must remain in the order account selection, ID, password. Selecting a seed account fills its ID and initial password into a password-type control, so the password remains masked on screen.

**Basis:** URS-E-002, URS-F-008; harness fixed initial-password and login-flow rules.

### 3.2 `users` entity and account validation

| Field key | Korean label | Required | Format or allowed values | Server validation and behavior |
| --- | --- | --- | --- | --- |
| `id` | 내부 식별자 | Yes | generated immutable text | Primary row key. Do not change after creation. |
| `user_id` | 사용자 ID | Yes | trimmed text, case-sensitive canonical value | Unique across `USERS`; reject duplicate creation and duplicate amendment. |
| `display_name` | 사용자명 | Yes | text | Show user identification everywhere as `사용자명 (사번)`. |
| `employee_no` | 사번 | Yes | trimmed text | Required on create and amendment; include beside `display_name` in screens and output. |
| `role_code` | 역할 | Yes | `ADMIN`, `TESTER`, `APPROVER` | One predefined role is required. Apply the role matrix, then apply `permission_overrides`. |
| `permission_overrides` | 개별 권한 | No | serialized allow and deny permission codes | Only ADMIN may set it. The UI must use the labeled server permission catalog in Select controls and must not require direct permission-code entry. Deny overrides role grant. An allow may grant only a known permission code. Unknown, duplicate, or conflicting entries are rejected. |
| `account_status` | 계정 상태 | Yes | `ACTIVE` `활성`, `INACTIVE` `비활성` | An inactive account cannot create a new session. Deactivation preserves all authored and reviewed records. |
| `password` | 비밀번호 | Yes on create or reset | write-only password value | Never return through list, detail, session, audit before/after data, or print APIs. A password input is always masked. Education scope permits the configured storage simplification, but no API may disclose another user's password. |
| `password_changed_at` | 비밀번호 변경 일시 | Yes | server ISO timestamp | Server-generated and immutable by the client. |
| `password_expires_at` | 비밀번호 만료 일시 | Yes | server ISO timestamp | Recalculate on password set from the active policy. An expired account can access only password change and logout until the password is changed. |
| `failed_login_count` | 연속 로그인 실패 횟수 | Yes | non-negative integer | Increment server-side only for an existing active account on password mismatch; reset to `0` on successful login. |
| `locked_at` | 잠금 일시 | No | server ISO timestamp | Set when the configured failure threshold is reached. A locked account cannot log in until ADMIN unlocks it. |
| `created_at`, `updated_at` | 생성 일시, 수정 일시 | Yes | server ISO timestamps | Server generated. |

**Basis:** URS-F-008, URS-D-002. The exact field names and conflict precedence are **URS 근거 없음, 기본값**.

### 3.3 `security_settings` entity and seed policy

Maintain exactly one active settings row. ADMIN can change it through 관리자 설정; every relevant server route reads the current row before making the decision.

| Field key | Korean label | Seed value | Enforcement |
| --- | --- | --- | --- |
| `id` | 내부 식별자 | `security-settings-default` | Singleton row key. |
| `min_password_length` | 비밀번호 최소 길이 | `4` | Reject new, changed, and reset passwords shorter than the configured length. |
| `require_uppercase`, `require_lowercase`, `require_digit`, `require_special` | 문자 조합 | all `false` | Enforce each selected composition requirement on new, changed, and reset passwords. |
| `password_validity_days` | 비밀번호 유효기간 | `90` | Calculate expiry from the server password-change time. |
| `max_failed_login_attempts` | 잠금 기준 | `5` | Lock an account immediately when `failed_login_count >= 5`. |
| `idle_timeout_minutes` | 자동 로그아웃 시간 | `30` | Issue or refresh a server session with this inactivity limit. A request after expiry clears the session and requires login again. |

The seed values are **URS 근거 없음, 기본값**. They are intentionally compatible with the required first-build password `1234`; future changes must be validated against the active policy. The client may validate for usability, but the server is the enforcement point for all policy checks, password expiry, lockout, and session expiry.

**Basis:** URS-F-008; harness server-validation and httpOnly-session rules.

### 3.4 Authentication and account server blocking rules

1. Login accepts a selected or typed `user_id` and a password only through a server route. It first resolves the unique account, then blocks inactive or locked accounts before issuing a session.
2. A password mismatch increments the account failure counter without returning password details. Reaching the configured threshold locks the account, records the lock timestamp, audits the event, and raises the required ADMIN security alarm.
3. Successful login resets the failure count, writes a `LOGIN_SUCCESS` audit event, and creates an httpOnly session containing only the account identifier and role context. Failed login writes `LOGIN_FAILURE`; logout and automatic logout write their respective audit events.
4. A password-expired account must be redirected to 비밀번호 변경 and must not call business mutation APIs. Its successful password change updates expiry and restores normal access.
5. Only ADMIN may unlock an account, reset another account's password, change account active status, assign a role, set custom permissions, or change security settings. Each route must re-check the current session role and target account on the server.
6. User creation, role change, active or inactive change, password reset, account unlock, password policy change, automatic-log-out setting change, and training-profile change are changing operations. Each must call `lib/audit.ts` with actor, target, server timestamp, before value, after value, and reason where the action requires one.

**Basis:** URS-F-008. httpOnly session, server re-check, and audit helper are harness rules.

### 3.5 Training-profile entity

| Field key | Korean label | Required | Format | Access |
| --- | --- | --- | --- | --- |
| `id` | 내부 식별자 | Yes | singleton `training-profile-default` | ADMIN write; authenticated users may read the displayed organization information. |
| `team_no` | 소속 조 | Yes | text or numeric text | Seed `2`; this drives the training context but not `lib/brand.ts` directly. |
| `members_json` | 실습자 및 소속 회사 | Yes | JSON array of `{ id, company, name }`; at least one unique positive integer `id`; non-empty company and name | ADMIN adds, amends, or removes members. Authenticated users have read-only access. |
| `company_name`, `trainee_name` | 호환 회사명, 호환 실습자명 | Yes | first member values | Preserve the existing columns; server updates them from the first member for backward compatibility. |
| `updated_by`, `updated_at` | 수정자, 수정 일시 | Yes | server values | Audit every change. |

Seed values: `team_no=2` and six members named `실습자1` through `실습자6`, each with `company=한국제약바이오협회`. A missing or legacy `members_json` value uses the same six-member display default. Saving requires `수정 사유(Reason for Change)` and must audit the complete before and after arrays. These values and the variable-member structure are **URS 개정 대상**.  
**Basis:** URS-F-008 for ADMIN access; variable-member behavior is a user-requested URS revision target.

## 4. Screen and role matrix

The following is the URS §6.3 matrix. `O` means permitted, `△` means read-only, and `X` means unavailable by hidden menu or disabled control. If the matrix and an individual functional requirement conflict, the individual §7.1 requirement wins.

| 화면 | 기능 | ADMIN | TESTER | APPROVER | §6.2 implementation meaning and related clause |
| --- | --- | --- | --- | --- | --- |
| 로그인 | 로그인 및 로그아웃 | O | O | O | System-entry account and PW screen. URS-F-008. |
| 메인 | 대시보드 조회, 상태별 장비 목록 조회 | O | O | O | Dashboard is the post-login landing screen. URS-F-005. |
| 기준정보 | 장비 목록 (인벤토리) 조회 | O | △ 조회만 | △ 조회만 | Equipment inventory screen. URS-F-001. |
| 기준정보 | 장비 등록 및 수정 (수정 사유 기록), 사용 상태 변경 (사용가능, 사용중지, 폐기) | O | X | X | ADMIN equipment master screen. URS-F-001. |
| 사용등록 | 사용 시작 등록 | X (메뉴 표시, 비활성) | O | X | Equipment-use start and completion screen. URS-F-002. |
| 사용등록 | 사용 종료 등록 (본인이 시작한 기록에 한함, 사용 후 상태와 특이사항 기록) | X | O | X | Equipment-use start and completion screen. URS-F-003. |
| 사용기록 | 목록 조회, 조건 검색, 상세 조회 | O 조회만 | O | O | Record list, detail, amendment, and review screen. URS-F-007. |
| 사용기록 | 검토완료 전 본인 기록의 수정 (수정 사유 기록), 무효 처리 (무효 사유 기록) | X | O | X | Record amendment and invalidation. URS-F-009. |
| 사용기록 | 수정 요청된 본인 기록의 보완 (수정 사유 기록) | X | O | X | Record amendment after modification request. URS-F-006. |
| 사용기록 | 사용중 기록의 예외 종료 (사유 기록) | O | X | X | ADMIN exceptional closure. URS-F-003. |
| 사용기록 | 사용중지 장비의 조치 내용 기록, 사용 재개 요청 | X | O | X | Corrective-action and resumption-request flow. URS-F-003. |
| 사용기록 | 이상 종료 기록의 이상 내용과 조치 내용 확인 (제2자 확인), 사용 재개 승인 또는 반려 (반려 사유 기록) | X | X | O | Second-person confirmation and resumption decision. URS-F-003. |
| 사용기록 | 검토 완료 및 전자서명 (비밀번호 재입력), 수정 요청 (사유 기록) | X | X | O | Review and electronic-signature flow. URS-F-006. |
| 로그북 | 장비별 로그북 조회 및 인쇄 (검토완료 기록, 조회 기간 지정) | O | O | O | Approved-record equipment logbook. URS-F-007. |
| 알람 | 이상 발생 기록과 조치 내용, 사용 재개 이력 조회 | O | O | O | Abnormal-equipment, action, and resumption history. URS-F-003. |
| 비밀번호 변경 | 본인 비밀번호 변경 | O | O | O | Self-service password update. URS-F-008. |
| 감사추적 | 이력 조회 (기간, 행위자 조건), 감사추적 보고서 인쇄 | O | X | O | ADMIN and APPROVER audit history and report screen. URS-F-010. |
| 관리자 설정 | 계정 등록 및 역할 지정, 활성 또는 비활성 변경, 잠금 해제, 비밀번호 초기화 | O | X | X | Account administration. URS-F-008. |
| 관리자 설정 | 비밀번호 정책 (복잡성, 유효기간, 잠금 기준) 설정, 자동 로그아웃 시간 설정 | O | X | X | Security-settings administration. URS-F-008. |

**Basis:** URS §6.2, §6.3 and listed §7.1 clause IDs.

## 5. Equipment master data

### 5.1 `equipment` entity

| Field key | Korean label | Required | Format or allowed values | Server validation and meaning |
| --- | --- | --- | --- | --- |
| `id` | 내부 식별자 | Yes | generated immutable text | Primary row key. |
| `equipment_code` | 장비 코드 | Yes | trimmed text | Unique across `EQUIPMENT`. Reject empty and duplicate values on create or amendment. |
| `equipment_name` | 장비명 | Yes | text | Reject empty value. |
| `installation_location` | 설치 위치 | Yes | text | Reject empty value. |
| `calibration_required` | 교정 대상 여부 | Yes | independent checkbox stored as `REQUIRED` `대상` or `NOT_REQUIRED` `비대상` | Must be checked independently from qualification applicability. |
| `qualification_required` | 적격성평가 대상 여부 | Yes | independent checkbox stored as `REQUIRED` `대상` or `NOT_REQUIRED` `비대상` | Must be checked independently from calibration applicability. Selecting 대상 also makes `calibration_due_date` mandatory. |
| `calibration_due_date` | 교정 유효기간 | Conditional | `YYYY-MM-DD` date | Required and valid when either `calibration_required=REQUIRED` or `qualification_required=REQUIRED`; blank it only when both are `NOT_REQUIRED`. A calibration-required item with due date before server current date is calibration-expired. |
| `usage_status` | 사용 상태 | Yes | `AVAILABLE` `사용가능`, `SUSPENDED` `사용중지`, `RETIRED` `폐기` | Business availability status, separate from `occupancy_status`. |
| `occupancy_status` | 현재 점유 상태 | Yes | `FREE` `미사용`, `OCCUPIED` `사용중` | Controlled by use-record workflow only. Equipment-master edit must not set it. |
| `remarks` | 비고 | No | text | General master-data note. |
| `status_change_reason` | 사용 상태 변경 사유 | Conditional | text | Required for any manual use-status change. |
| `created_by`, `created_at`, `updated_by`, `updated_at` | 생성자, 생성 일시, 수정자, 수정 일시 | Yes | server identifiers and ISO timestamps | Client cannot supply values. |

**Basis:** URS-F-001 and the QA request for URS-F-006 and URS-F-007 review/output visibility. Splitting the original combined applicability field is an **URS 개정 대상**. Internal-key, code values, and date-storage format are **URS 근거 없음, 기본값** aligned to the Sheets contract.

### 5.2 Equipment state rules and server blocks

1. ADMIN is the only role permitted to create or amend equipment master data. TESTER and APPROVER receive read-only inventory data and cannot invoke write routes.
2. `usage_status` and `occupancy_status` must remain independent. `usage_status=사용가능` plus `occupancy_status=사용중` means an eligible device is currently reserved, not a suspended device.
3. A calibration target whose due date is earlier than the current KST date must automatically transition from `사용가능` to `사용중지`, be displayed as `사용중지` on every equipment read, and be audit-trailed with a SYSTEM actor. A use-start server route must still return the specific calibration-expiry blocking message before the generic stopped-equipment message. It must query the current `EQUIPMENT` row at write time, not rely on client display state.
4. ADMIN can transition `사용가능` and `사용중지` when the transition is not controlled by an abnormal-use resumption flow. `폐기` is a non-use state and its historical use records remain linked and readable. A direct status edit cannot erase, replace, or unlink historical records.
5. When the use workflow records `사용 후 상태=이상`, the workflow sets `usage_status=사용중지` while retaining the completed use record. A direct ADMIN change to `사용가능` must be blocked while a pending abnormal-use resumption request exists; only approved resumption may restore `사용가능`.
6. Only the use workflow sets `occupancy_status=사용중` at accepted start and `미사용` at normal completion, exceptional completion, or valid invalidation of an in-progress record. A master-data save must reject an occupancy patch.
7. A master amendment requires `수정 사유`, preserves before and after values, and records the modifying actor and server timestamp. Equipment is never physically deleted. To discontinue availability, set `usage_status` to `사용중지` or `폐기` with the reason; historical records remain intact.

**Basis:** URS-F-001, URS-F-002, URS §2.2 and the QA correction requiring calibration expiry to change the effective use status to `사용중지`. The automatic status transition extends the original restriction wording and is an **URS 개정 대상**.

### 5.3 Required idempotent equipment seeds

The seed routine must locate each row by `equipment_code`. It appends the row only if absent and never changes an existing row. All three rows must be present after a fresh seed. When an equipment date becomes expired, the first equipment, dashboard, alarm, or start-screen read persists `usage_status=사용중지` and its SYSTEM audit event so the status, block, and alarm remain consistent.

| id | equipment_code | equipment_name | installation_location | 교정 대상 | 적격성평가 대상 | calibration_due_date | usage_status | occupancy_status | remarks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `seed-equip-hplc-01` | `HPLC-01` | `HPLC 분석기 1호` | `분석실 A` | `대상` | `대상` | `2026-12-31` | `사용가능` | `미사용` | `정상 교정 유효 장비` |
| `seed-equip-bal-01` | `BAL-01` | `전자저울 1호` | `칭량실` | `대상` | `비대상` | `2025-12-31` | `사용중지` after expiry reconciliation | `미사용` | `교정 유효기간 경과 실습 장비` |
| `seed-equip-inc-01` | `INC-01` | `인큐베이터 1호` | `배양실` | `비대상` | `대상` | `2027-06-30` | `사용가능` | `미사용` | `적격성평가 대상 장비` |

The `BAL-01` date is deliberately expired as of this build and must be evaluated against server current date.  
**Basis:** URS-E-003, URS-F-001. Names, codes, locations, dates, and remarks are **URS 근거 없음, 기본값**.

### 5.4 Equipment and user reference contract

Each use record is owned by the D2 workflow but must contain its own immutable unique `id`, plus `equipment_id` and `user_id` identifier references to the selected `EQUIPMENT` and `USERS` rows. It may retain `equipment_code`, `equipment_name`, `display_name`, and `employee_no` snapshots for display, but the identifiers are the authoritative relationship keys. At use-start, the server must resolve both references from current master data and reject an unknown, inactive, or ineligible target before it creates the record. Deactivating a user or retiring or suspending equipment must never delete or rewrite a linked historical use record.  
**Basis:** URS-D-002, URS-F-001, URS-F-008. Snapshot fields and immutable-key implementation are **URS 근거 없음, 기본값**.

## 6. Access-control behavior

1. Render the side navigation and action controls from the current effective permission set. `X` means the menu is hidden or the control is disabled as permitted by URS §6.3; `△` exposes read-only list and detail operations only.
2. UI filtering is not authorization. Every page load, route handler, and changing API must resolve the httpOnly session and enforce role plus owner, record state, and target-resource conditions on the server.
3. On any authenticated but unauthorized page or function request, block the request, write an `UNAUTHORIZED_ACCESS` audit event, show the URS notice, then navigate to 메인: “권한이 없는 화면 또는 기능에 접근을 시도하면 접근이 차단되고 안내 메시지가 표시된 후 메인 화면으로 이동한다.”
4. On an unauthenticated request, clear any stale session and navigate to 로그인. Do not disclose whether a protected resource exists.
5. Count unauthorized-access attempts for security-alarm evaluation. When the configured failure threshold is exceeded, create an ADMIN-visible security warning in 알람 or dashboard alert area. This alarm must include the event time, attempted actor when identifiable, requested target, and trigger count.
6. Effective permission calculation is: active unlocked account required, predefined role matrix, then validated custom deny and allow overrides. Individual-record constraints remain mandatory after a role grant, including TESTER ownership and pre-review state conditions.

**Basis:** URS §6.3 and URS-F-008. The event payload and precedence calculation are **URS 근거 없음, 기본값**.

## 7. Audit-event contract for this scope

All changing APIs use `lib/audit.ts`; audit entries include actor, action, target record, ISO action time, before value, after value, and mandatory reason where applicable. Password values must be excluded from before and after values.

| Event action | Trigger | Required payload |
| --- | --- | --- |
| `EQUIPMENT_CREATED` | ADMIN creates equipment | equipment ID and code, full after value |
| `EQUIPMENT_UPDATED` | ADMIN changes equipment fields | before and after values, `수정 사유`, target equipment ID |
| `EQUIPMENT_USAGE_STATUS_CHANGED` | ADMIN changes use status or workflow suspends or restores it | before and after use status, reason or originating record ID |
| `USER_CREATED` | ADMIN creates account | target user ID, role, employee number, after value excluding password |
| `USER_ROLE_CHANGED` | ADMIN changes role or custom permissions | before and after effective-role inputs |
| `USER_STATUS_CHANGED` | ADMIN activates or deactivates account | before and after account status |
| `PASSWORD_CHANGED` | Account holder changes own password | actor and target only, no password values |
| `PASSWORD_RESET` | ADMIN resets password | actor and target only, no password values |
| `ACCOUNT_LOCKED` | Failure threshold reached | target, configured threshold, failure count |
| `ACCOUNT_UNLOCKED` | ADMIN unlocks account | unlock actor, target, unlock time |
| `SECURITY_SETTINGS_CHANGED` | ADMIN changes policy or timeout | before and after settings, actor |
| `TRAINING_PROFILE_CHANGED` | ADMIN changes the team or variable member list | complete before and after member arrays, modifier, server timestamp, and mandatory change reason |
| `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, `AUTO_LOGOUT` | Authentication or session event | actor when identifiable, outcome, event time |
| `UNAUTHORIZED_ACCESS` | Forbidden function or route request | actor when identifiable, target, effective permission result |

**Basis:** URS-F-001, URS-F-008, URS-F-010 and harness audit rule. Event strings are **URS 근거 없음, 기본값**.

## 8. Builder handoff and cross-owner requests

1. **Builder D1:** Own the equipment, account, password, and ADMIN settings UI and APIs. Enforce all create, amendment, duplicate, account status, password, lock, and role checks above on the server.
2. **Builder D2 and D3:** Must use the equipment eligibility and state contract. They must not offer or accept use start for blocked equipment and must call the designated state transition for normal, abnormal, exceptional, and approved-resumption outcomes.
3. **Builder D4:** The idempotent `/api/seed` implementation must seed the exact `USERS`, `EQUIPMENT`, `security_settings`, and `training_profile` values above by their stated natural keys. D4 must also expose audit logging and ADMIN security-alarm persistence or API support used by this specification.
4. **Orchestrator:** Maintain shared type, schema-header, brand, navigation, and central status changes. No shared-file change is made by this analysis role.

**Basis:** URS-F-001, URS-F-008, URS-E-002, URS-E-003, URS-D-002; file ownership is harness-defined.
