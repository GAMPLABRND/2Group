# SPEC_B: Equipment use, review, dashboard, and logbook workflow

## 1. Scope and implementation boundary

This specification covers `URS-F-002` through `URS-F-007`, Section 2.2, and the related Section 6.1 through 6.3 workflow and access rules. It is implementation-ready for the equipment-use record, abnormal-equipment recovery, dashboard, review, electronic-signature, query, and logbook functions.

The canonical business flow is:

`사용가능 + 미사용` equipment -> `사용중` record and `사용중` occupancy -> `사용완료` record and `미사용` occupancy -> optional `수정요청` -> `사용완료` -> `검토완료`.

An `이상` end additionally changes equipment availability to `사용중지`. A TESTER records corrective action and makes a resume request. Only an APPROVER second-person decision can change the equipment back to `사용가능`. [URS-F-002] [URS-F-003] [URS-F-006]

`URS-F-009` invalidation and record amendment are outside this assignment. Their state transitions must be merged by builder-d2 without weakening the state locks and occupancy-release rules stated here. The governing rule is that an invalidated `사용중` record releases its equipment occupancy. [URS-F-009, cross-reference only]

All persisted data travels through server-side `/api/*` route handlers to Google Sheets. Client fetches use `cache: "no-store"`; client code never calls Google Sheets. All data pages and route handlers use `dynamic = "force-dynamic"`, `revalidate = 0`, and `runtime = "nodejs"`. ISO timestamps are stored, and `lib/kst.ts` renders `YYYY-MM-DD HH:MM:SS` in KST. [URS-I-001] [URS-D-001] [URS-T-002]

## 2. Screens and server access control

Screens follow the required design order. Each server page and every mutating route must verify the httpOnly-cookie session role; hiding a menu item is not authorization. An unauthorized direct route or API request is rejected, displays the access notice, and the page flow returns to the main screen. [Section 6.3]

| Order | Korean screen name | Proposed route | Roles and allowed actions | Clauses |
| --- | --- | --- | --- | --- |
| 1 | 로그인 | `/login` | ADMIN, TESTER, APPROVER enter the system. | Section 6.2 |
| 2 | 메인 | `/` | ADMIN, TESTER, APPROVER view KPI cards and an equipment master-data table containing code, name, location, availability, and occupancy. The authenticated header renders `user_id (employee_no)`. | URS-F-005, URS-F-008, URS 개정 대상 |
| 3 | 기준정보 | `/equipment` | ADMIN manages equipment. TESTER and APPROVER have read-only inventory access. The use workflow reads its selectable equipment from this screen's data. | Section 6.2, URS-F-002 |
| 4 | 사용등록 | `/records/new` | TESTER alone creates a use-start record and selects only eligible equipment. ADMIN menu is visible but disabled as specified by the matrix. | URS-F-002, URS-F-004 |
| 5 | 사용기록 | `/records` and `/records/[record_id]` | All roles query and view detail. TESTER ends own `사용중` records, records corrective action, and requests resumption. ADMIN performs an exceptional end. APPROVER opens the review detail and recovery decision. | URS-F-002, URS-F-003, URS-F-004, URS-F-006, URS-F-007 |
| 6 | 검토와 승인 | `/approvals` and `/approvals/[record_id]` | APPROVER-only review queue for `사용완료`, modification request, electronic signature, and usage-resumption approval or rejection. It may link to the same record detail rather than duplicate the record data. | URS-F-003, URS-F-006 |
| 7 | 로그북 | `/print/logbook` | ADMIN, TESTER, APPROVER select equipment and a date range, view eligible `검토완료` records, and print. | URS-F-007 |
| 8 | 알람 | `/alarms` and `/api/alarms/unread` | ADMIN, TESTER, APPROVER view abnormal or `사용중지` equipment, actions, resume history including approved history, calibration-expired alerts, and 90-day expiry warnings. A login-layout popup shows occurrence time, type, equipment/user target, and key content. The user can persist `확인(읽음)` or acknowledge then navigate to the detail route. ADMIN-only backup and security alarms are excluded for other roles. | URS-F-003, URS-F-005, URS 개정 대상 |
| 9 | 감사추적 | `/audit` | ADMIN and APPROVER only. The use workflow sends its event evidence to this screen. TESTER has no route or API access. | Section 6.2, URS-F-010 cross-reference |
| 10 | 비밀번호 변경 | `/password` | Each logged-in account changes its own password. This route provides the current credential used by the electronic-signature verification. | Section 6.2 |
| 11 | 관리자 설정 | `/admin` | ADMIN only. The use workflow does not expose account or security administration. | Section 6.2 |

Each screen uses `PageTitle`, optional `NoticeBox`, then one to three vertically stacked cards. Record and alarm tables are full-width single-column cards, with fixed-width columns, no polling, a manual `새로고침` action, and a detail modal or page for fields beyond seven table columns. [design.md 5.4, 6.2]

The equipment-statistics result table groups records by usage type and returns use count, abnormal occurrence count, abnormal rate, and duration. The server calculates `abnormal rate = abnormal occurrence count / use count * 100`; a zero use count is rendered as `0%`. The client does not recalculate this GMP-relevant statistic. [URS-F-005, URS 개정 대상]

## 3. Business entities and Sheet headers

### 3.1 `EQUIPMENT` dependency

`EQUIPMENT` is owned by the equipment-master implementation. The following fields are the immutable integration contract needed by this specification. Equipment availability and occupancy are distinct fields and must never be inferred from one another. [URS-F-002] [URS-F-003] [URS-F-005]

| Key | Korean label | Required | Format or permitted value | Default or writer |
| --- | --- | --- | --- | --- |
| `id` | 장비 식별자 | Yes | opaque unique identifier | auto |
| `equipment_code` | 장비 코드 | Yes | unique text | master-data value |
| `equipment_name` | 장비명 | Yes | text | master-data value |
| `location` | 설치 위치 | Yes | text | master-data value |
| `calibration_required` | 교정 대상 여부 | Yes | independent checkbox, `대상` or `비대상` | master-data value |
| `qualification_required` | 적격성평가 대상 여부 | Yes | independent checkbox, `대상` or `비대상` | master-data value |
| `calibration_due_date` | 교정 유효기간 | Conditional | `YYYY-MM-DD`; required when `calibration_required` is `대상` | master-data value |
| `availability_status` | 사용 상태 | Yes | `사용가능`, `사용중지`, `폐기` | `사용가능` for a new valid equipment |
| `occupancy_status` | 현재 점유 상태 | Yes | `미사용`, `사용중` | `미사용` |
| `occupancy_record_id` | 점유 사용 기록 ID | Conditional | usage-record `id`; blank when `미사용` | auto |
| `occupied_by_user_id` | 현재 사용자 ID | Conditional | user identifier; blank when `미사용` | auto |
| `occupied_by_user_name` | 현재 사용자 | Conditional | snapshot text; blank when `미사용` | auto |
| `occupied_at` | 사용 시작 일시 | Conditional | ISO timestamp; blank when `미사용` | auto |

The first four master fields, plus calibration and qualification applicability fields, originate in `URS-F-001`; separate visibility during review and logbook output supports the QA request for `URS-F-006` and `URS-F-007`. The split from the original combined field is an `URS 개정 대상`.

### 3.2 `USE_RECORDS`

Every use-start action appends one row. Updates retain the same `id`; changes require AUDIT before/after values. `id` is the first Sheet header and is the unique record identifier. [URS-F-002] [URS-F-003] [URS-F-004] [URS-F-006] [URS-F-007] [URS-D-002]

| Key | Korean label | Required | Format or permitted value | Default or writer |
| --- | --- | --- | --- | --- |
| `id` | 사용 기록 ID | Yes | opaque unique identifier | auto |
| `equipment_id` | 장비 식별자 | Yes | FK to `EQUIPMENT.id`, selected from server-supplied list | request input after server validation |
| `equipment_code` | 장비 코드 | Yes | equipment-code snapshot | auto from selected equipment |
| `equipment_name` | 장비명 | Yes | equipment-name snapshot | auto from selected equipment |
| `user_id` | 사용자 ID | Yes | FK to current account | auto from session |
| `user_name` | 사용자 | Yes | account-name snapshot | auto from session |
| `usage_type` | 사용 유형 | Yes | `일반 사용`, `시험/분석`, `적격성평가/밸리데이션`, `점검/유지보수`, `기타` | select input |
| `usage_purpose` | 사용 목적 | Yes | specific work-purpose text | request input |
| `reference_no` | 참조번호 | No | text for 제조번호, 시험번호, 작업번호, or 프로토콜 번호 | blank |
| `started_at` | 사용 시작 일시 | Yes | ISO timestamp | auto at successful server save |
| `ended_at` | 사용 종료 일시 | Conditional | ISO timestamp | auto at normal or exceptional end |
| `record_status` | 기록 상태 | Yes | `사용중`, `사용완료`, `수정요청`, `검토완료`; invalidation integration may add `무효` | `사용중` on start |
| `after_use_status` | 사용 후 상태 | Conditional | `정상` or `이상` | required at end |
| `abnormality_details` | 특이사항 또는 이상 내용 | Conditional | text; required when `after_use_status` is `이상` | blank |
| `end_method` | 종료 방식 | Conditional | `정상 종료` or `예외 종료` | auto |
| `exception_ended_by_id` | 예외 종료자 ID | Conditional | ADMIN identifier | auto for exceptional end |
| `exception_ended_by_name` | 예외 종료자 | Conditional | ADMIN name snapshot | auto for exceptional end |
| `exception_ended_at` | 예외 종료 일시 | Conditional | ISO timestamp | auto for exceptional end |
| `exception_reason` | 예외 종료 사유 | Conditional | non-empty text for exceptional end | request input |
| `change_request_reason` | 수정 요청 사유 | Conditional | non-empty text while `수정요청` | APPROVER input |
| `reviewer_id` | 검토자 ID | Conditional | APPROVER identifier | auto after valid signature |
| `reviewer_name` | 검토자 | Conditional | APPROVER name snapshot | auto after valid signature |
| `reviewed_at` | 검토 일시 | Conditional | ISO timestamp | auto after valid signature |
| `signature_meaning` | 서명 의미 | Conditional | exact text `검토 완료` | auto after valid signature |

`started_at`, `ended_at`, reviewer fields, and all session-derived actor fields are read-only in the user interface and are ignored or rejected if supplied by a client request. [URS-F-002] [URS-F-003] [URS-F-004] [URS-F-006]

### 3.3 `EQUIPMENT_REMEDIATIONS`

This table records corrective action against a specific abnormal use record. It is required to distinguish the action itself from each subsequent second-person resume decision. It provides a durable link for alarms and review detail. [URS-F-003]

| Key | Korean label | Required | Format or permitted value | Default or writer |
| --- | --- | --- | --- | --- |
| `id` | 조치 ID | Yes | opaque unique identifier | auto |
| `equipment_id` | 장비 식별자 | Yes | FK to `EQUIPMENT.id` | route parameter after server lookup |
| `source_record_id` | 이상 종료 사용 기록 ID | Yes | FK to `USE_RECORDS.id` with `after_use_status = 이상` | route parameter |
| `action_type` | 조치 유형 | Yes | `점검`, `수리`, `기타` | select. URS 근거 없음, 기본값 for normalized type |
| `action_details` | 조치 내용 | Yes | non-empty text | TESTER input |
| `action_recorded_by_id` | 조치 기록자 ID | Yes | current TESTER identifier | auto from session |
| `action_recorded_by_name` | 조치 기록자 | Yes | current TESTER name snapshot | auto from session |
| `action_recorded_at` | 조치 기록 일시 | Yes | ISO timestamp | auto |
| `updated_by_id` | 조치 보완자 ID | Conditional | current TESTER identifier | auto when revised after rejection |
| `updated_at` | 조치 보완 일시 | Conditional | ISO timestamp | auto when revised after rejection |
| `remediation_status` | 조치 상태 | Yes | `조치기록`, `재개요청됨`, `반려`, `승인` | `조치기록` |

### 3.4 `EQUIPMENT_RESUME_REQUESTS`

Each resume attempt is a new, append-only row. A rejected prior request remains queryable, and a re-request references the revised remediation. This prevents loss of the required approval and rejection history in the alarm screen. [URS-F-003]

| Key | Korean label | Required | Format or permitted value | Default or writer |
| --- | --- | --- | --- | --- |
| `id` | 사용 재개 요청 ID | Yes | opaque unique identifier | auto |
| `equipment_id` | 장비 식별자 | Yes | FK to `EQUIPMENT.id` | auto from remediation |
| `source_record_id` | 이상 종료 사용 기록 ID | Yes | FK to `USE_RECORDS.id` | auto from remediation |
| `remediation_id` | 조치 ID | Yes | FK to `EQUIPMENT_REMEDIATIONS.id` | route input after server validation |
| `action_details_snapshot` | 조치 내용 스냅샷 | Yes | text | auto copied from remediation |
| `request_sequence` | 요청 차수 | Yes | positive integer by equipment incident | auto, beginning at `1` |
| `resume_status` | 사용 재개 상태 | Yes | `사용 재개 요청`, `승인`, `반려` | `사용 재개 요청` |
| `requested_by_id` | 요청자 ID | Yes | TESTER identifier | auto from session |
| `requested_by_name` | 요청자 | Yes | TESTER name snapshot | auto from session |
| `requested_at` | 요청 일시 | Yes | ISO timestamp | auto |
| `confirmed_by_id` | 확인자 ID | Conditional | APPROVER identifier | auto on decision |
| `confirmed_by_name` | 확인자 | Conditional | APPROVER name snapshot | auto on decision |
| `confirmed_at` | 확인 일시 | Conditional | ISO timestamp | auto on decision |
| `confirmation_result` | 확인 결과 | Conditional | `승인` or `반려` | auto from decision |
| `rejection_reason` | 반려 사유 | Conditional | non-empty text when rejected | APPROVER input |

The resumption tables are an implementation data model for the URS requirement to retain action, request, approval, and rejection history. `action_type`, `request_sequence`, and separate row design are marked `URS 근거 없음, 기본값`; no URS field is replaced or omitted.

### 3.5 Query, dashboard, and print request fields

These are request parameters, not business data rows. Empty filters mean no restriction. All non-empty filters combine with logical AND. [URS-F-005] [URS-F-007]

| Key | Korean label | Required | Format or permitted value | Default |
| --- | --- | --- | --- | --- |
| `equipment_id` | 장비 | No for records, Yes for logbook | equipment identifier | empty for records |
| `date_from` | 조회 시작일 | No | `YYYY-MM-DD` | empty |
| `date_to` | 조회 종료일 | No | `YYYY-MM-DD` and not before `date_from` | empty |
| `user_id` | 사용자 | No | account identifier | empty |
| `usage_type` | 사용 유형 | No | the standard use-type list | empty |
| `record_status` | 기록 상태 | No | record-state list | empty |
| `after_use_status` | 사용 후 상태 | No | `정상` or `이상` | empty |
| `status_filter` | 장비 상태 | No | dashboard display category | empty |

For a date or range filter, the implementation compares the KST calendar date of `started_at`. This is `URS 근거 없음, 기본값`; the filter remains capable of satisfying a specific date or a query period. The user may clear all inputs to re-query every record. [URS-F-007]

## 4. State machines

### 4.1 Use-record state machine

| Code | Korean status | Meaning |
| --- | --- | --- |
| `IN_USE` | 사용중 | A successful start reserves one equipment. |
| `COMPLETED` | 사용완료 | A normal, abnormal, or exceptional end has been saved. |
| `CHANGE_REQUESTED` | 수정요청 | APPROVER requires a TESTER correction before review continues. |
| `REVIEWED` | 검토완료 | APPROVER completed a valid electronic signature. It is locked. |
| `INVALID` | 무효 | `URS-F-009` integration state, outside this assignment. |

| From -> To | Actor | Server condition and effect | Clause |
| --- | --- | --- | --- |
| none -> `IN_USE` | TESTER | Valid start request, eligible equipment, all mandatory fields present, no active equipment occupancy, and auto actor/time fields assigned. Set equipment occupancy to `사용중`. | URS-F-002, URS-F-004 |
| `IN_USE` -> `COMPLETED` | initiating TESTER | Only the same `user_id`; valid normal or abnormal end fields. Set occupancy to `미사용`. An abnormal end also sets availability to `사용중지`. | URS-F-003 |
| `IN_USE` -> `COMPLETED` | ADMIN | Exceptional end only, with a non-empty reason. Store exceptional actor/time/reason and set occupancy to `미사용`. | URS-F-003 |
| `COMPLETED` -> `CHANGE_REQUESTED` | APPROVER | Non-empty correction reason. Existing end information remains visible. | URS-F-006 |
| `CHANGE_REQUESTED` -> `COMPLETED` | original TESTER | Original author provides correction and a non-empty correction reason. Save before/after values in AUDIT. | URS-F-006; amendment detail cross-reference URS-F-009 |
| `COMPLETED` -> `REVIEWED` | APPROVER | Password re-entry succeeds and signature data is written by the server. | URS-F-006 |
| any non-`REVIEWED` allowed by URS-F-009 -> `INVALID` | original TESTER | Out-of-assignment integration. If source state is `IN_USE`, atomically release equipment occupancy. | URS-F-009 cross-reference |

No transition from `REVIEWED` is allowed. No second end is allowed from `COMPLETED`, `CHANGE_REQUESTED`, or `REVIEWED`. Any unlisted transition receives the URS error message described in Section 6. [URS-F-003] [URS-F-006]

### 4.2 Equipment availability and occupancy state machine

Availability and occupancy are a paired state. The only valid operational pairs created by this workflow are `사용가능 + 미사용`, `사용가능 + 사용중`, and `사용중지 + 미사용`. `폐기 + 미사용` is master-data controlled and cannot start use. [URS-F-002] [URS-F-003]

| From pair -> To pair | Actor | Server condition and effect | Clause |
| --- | --- | --- | --- |
| `사용가능 + 미사용` -> `사용가능 + 사용중` | TESTER | Successful use start. Persist the record ID, current user, and start timestamp on equipment. | URS-F-002 |
| `사용가능 + 사용중` -> `사용가능 + 미사용` | initiating TESTER or ADMIN exceptional end | Successful normal end or exceptional end. Clear all occupancy association fields. | URS-F-003 |
| `사용가능 + 사용중` -> `사용중지 + 미사용` | initiating TESTER | Successful abnormal end. Clear occupancy and preserve the abnormal use record link for remediation. | URS-F-003 |
| `사용중지 + 미사용` -> `사용중지 + 미사용` | TESTER or APPROVER | Record action, submit a request, or reject a request. Availability remains stopped. | URS-F-003 |
| `사용중지 + 미사용` -> `사용가능 + 미사용` | APPROVER | Approve a valid current resume request after second-person confirmation. | URS-F-003 |

An availability-status change to `폐기` or manual `사용중지` is equipment-master functionality. It must preserve historical use records and must not create an impossible occupancy pair. [URS-F-001 cross-reference]

### 4.3 Corrective-action and resume-request state machine

| Entity and code | Korean status | Meaning |
| --- | --- | --- |
| remediation `ACTION_RECORDED` | 조치기록 | TESTER recorded inspection, repair, or other corrective action. |
| remediation `RESUME_REQUESTED` | 재개요청됨 | One current resume request exists. |
| remediation `REJECTED` | 반려 | The current request was rejected; action must be supplemented before another request. |
| remediation `APPROVED` | 승인 | Current request was approved and equipment is usable. |
| request `REQUESTED` | 사용 재개 요청 | Waiting for APPROVER confirmation. |
| request `APPROVED` | 승인 | Second-person confirmation approved resumption. |
| request `REJECTED` | 반려 | Second-person confirmation rejected resumption with reason. |

| From -> To | Actor | Server condition and effect | Clause |
| --- | --- | --- | --- |
| none -> `ACTION_RECORDED` | TESTER | Equipment is `사용중지` because of an abnormal source record; action details are non-empty. | URS-F-003 |
| `ACTION_RECORDED` or `REJECTED` -> `RESUME_REQUESTED` | TESTER | Create a new append-only request using current corrective-action content. No other request for the same incident may be pending. | URS-F-003 |
| request `REQUESTED` -> `APPROVED` and remediation -> `APPROVED` | APPROVER | Abnormality and action content were reviewed; confirmer is a second person; set confirmation fields and change equipment to `사용가능 + 미사용`. | URS-F-003 |
| request `REQUESTED` -> `REJECTED` and remediation -> `REJECTED` | APPROVER | Non-empty rejection reason; set confirmation fields. Equipment remains `사용중지 + 미사용`. | URS-F-003 |
| `REJECTED` -> `ACTION_RECORDED` | TESTER | Supplement corrective-action content with audit evidence before re-requesting. | URS-F-003 |

Approver identity must differ from the TESTER who recorded the corrective action and from the resume requester. This enforces the stated `제2자 확인`; it is a direct role-separation interpretation of URS-F-003.

## 5. Calculations, judgement, and alarms

### 5.1 Dashboard KPI and status-filter calculations

All dashboard results are calculated from the latest server read and returned with the list data in the same response so figures and status lists agree. Refresh after use start, end, abnormal end, and resumption approval. [URS-F-005]

| Output | Calculation and linked list |
| --- | --- |
| 전체 장비 수 | Count all `EQUIPMENT` rows, including `폐기`. Clicking opens the complete inventory list. |
| 사용가능 수 | Count `availability_status = 사용가능` and `occupancy_status = 미사용`. Clicking opens that exact pair. |
| 사용중 수 | Count `occupancy_status = 사용중`. Detail shows `occupied_by_user_name` and `occupied_at`. Clicking opens this list. |
| 사용중지 수 | Count `availability_status = 사용중지`, including abnormal-originated status. Clicking opens stopped equipment with abnormality and current action information. |
| 폐기 수 | Count `availability_status = 폐기`. Clicking opens retired equipment. |
| 교정 만료 수 | Count `calibration_required = 대상` and `calibration_due_date < current KST date`. This is a separate restricted-use count, not a replacement for the availability categories. Clicking opens the expired-calibration alert list. |

Status appears as Korean text plus `StatusBadge`, never color alone. `사용중지`, `이상`, and expired calibration are visually marked as use-restricted. [URS-F-005]

### 5.2 Equipment statistics

| Output | Input -> output calculation | Boundary and rounding |
| --- | --- | --- |
| equipment abnormal-event count | completed use records grouped by `equipment_id` where `after_use_status = 이상` -> count | Includes every saved abnormal end in the chosen reporting scope. |
| cumulative abnormal history | all abnormal source records grouped by equipment -> chronological list with corrective action and every resume decision | Includes approved historical requests as well as pending and rejected requests. |
| abnormal-event rate | abnormal-event count / number of ended records for the same equipment * 100 -> percentage | If denominator is 0, show `0.0%`. Display one decimal place. `URS 근거 없음, 기본값` for formula display precision. |
| use count by type | usage records grouped by `equipment_id`, `usage_type` -> count | Use types are the URS select list. |
| operating time by type | each ended record: `ended_at - started_at` -> duration minutes; sum by equipment and `usage_type` | Reject a non-positive duration. Store and total whole minutes, display `N시간 M분`. `URS 근거 없음, 기본값` for minute rounding. |

The only URS-specified calibration alert boundaries are applied exactly as follows:

| Alert | Rule |
| --- | --- |
| 교정 만료 | `calibration_due_date < current KST date`, because the date is `지난 경우`. It blocks a new use start. |
| 교정 만료 임박 | `0 <= calibration_due_date - current KST date <= 90 days`, because the URS requires alerting from `3개월(90일) 전부터`. A date already past is shown only as `교정 만료`, which has higher severity. |

### 5.3 Alarm-screen data set

The alarm list returns, without hiding approved historical events:

- each equipment with `availability_status = 사용중지`, its source abnormal `USE_RECORDS` row, abnormality details, latest action, and latest resume-request state;
- all abnormal incidents for each equipment, including `승인` past resumption history and `반려` reason;
- calibration-expired equipment and 90-day calibration-expiry warnings;
- status, action actor/time, requester/time, second confirmer/time, result, and rejection reason where present.

Equipment use status and calibration alert category remain visibly separate. A resumption approval removes the current stop restriction but does not remove its alarm history. [URS-F-003] [URS-F-005]

## 6. Blocking rules and validation order

All validation is repeated on the server route. The UI may pre-validate to identify fields, but a disabled client button is never the enforcing control. Server responses use the quoted URS wording as `Banner error` text, adding the Korean missing field labels only where the URS requires them to be identified. [URS-F-004] [design.md 6.4]

| Priority | Condition | Exact blocking notice | Server enforcement point |
| --- | --- | --- | --- |
| 1 | No authenticated session, wrong role, or direct unauthorized access | `권한이 없는 화면 또는 기능에 접근을 시도하면 접근이 차단되고 안내 메시지가 표시된 후 메인 화면으로 이동한다.` | Every `/api/*` route before reading or writing; page server guard. |
| 2 | Start caller is not TESTER, or end caller is neither the initiating TESTER nor ADMIN exceptional-end path | `사용중 기록은 해당 사용을 시작한 사용자만 정상적으로 종료할 수 있어야 한다.` | `POST /api/records/[record_id]/end`; exceptional-end route separately checks ADMIN. |
| 3 | Calibration target has passed its due date | `교정 대상 장비의 교정 유효기간이 지난 경우 새로운 사용을 시작할 수 없어야 한다.` | Equipment reads automatically persist `사용중지`; `POST /api/records/start` checks calibration before the generic status block. |
| 4 | Equipment cannot be found, availability is `사용중지` or `폐기` for a non-calibration reason | `사용중지 또는 폐기 상태인 장비는 새로운 사용을 시작할 수 없어야 한다.` | `POST /api/records/start` after reading current equipment. |
| 5 | Equipment is marked occupied or any `IN_USE` record already refers to it | `동일 장비에 사용중 상태의 기록이 존재하는 경우 새로운 사용 시작을 등록할 수 없어야 한다.` | `POST /api/records/start`; check both current equipment and active records. |
| 6 | A required start, end, action, request, correction, rejection, or exception field is blank | `필수 입력 항목이 누락된 경우 기록을 저장할 수 없으며 누락된 항목을 안내해야 한다.` | Every mutating route before persistence. Response includes `누락 항목: ...`. |
| 7 | Client supplies a time, actor, equipment snapshot, or state that is server-owned, or a standard field is not from its list | `시스템이 자동 생성하는 사용자 및 일시 정보는 사용자가 임의로 변경할 수 없어야 한다.` | Every mutating route; construct server-owned values, do not trust request copies. |
| 8 | `after_use_status = 이상` and `abnormality_details` is blank | `사용 후 상태가 '이상'인 경우 특이사항을 필수로 기록해야 한다.` | `POST /api/records/[record_id]/end`. |
| 9 | A second end is attempted after leaving `사용중` | `사용완료 상태의 기록에는 동일한 사용 종료를 다시 등록할 수 없어야 한다.` | `POST /api/records/[record_id]/end` and exceptional-end route. |
| 10 | A request is submitted without corrective action, for a non-stopped equipment, or while a request for that incident is pending | `조치 완료 후 사용자는 장비의 사용 재개 확인을 요청할 수 있어야 한다.` | Corrective-action and resume-request POST routes; a non-pending state is required. |
| 11 | An APPROVER makes a resume decision without a result, or rejects with blank reason, or is not a second person | `사용 재개를 반려하는 경우 반려 사유를 필수로 입력해야 하며, 반려된 장비는 조치 내용을 보완하여 다시 사용 재개를 요청할 수 있어야 한다.` | `POST /api/resume-requests/[request_id]/decision`. |
| 12 | A review action does not originate at `사용완료`, a correction does not originate at `수정요청`, or any unlisted transition is requested | `허용되지 않은 상태 전이는 차단되어야 한다.` | Record transition service used by end, correction, review, resume, and invalidation routes. |
| 13 | Electronic-signature password is absent or fails the current user account verification | `올바른 경우에만 검토가 완료되어야 한다.` | `POST /api/records/[record_id]/review-signature`; compare server-side only. |
| 14 | Direct amendment, correction, end, invalidation, or signature is attempted for `검토완료` | `검토완료 (전자서명 완료) 된 기록은 기존 값을 직접 수정할 수 없어야 한다.` | Every record mutation route before update. |
| 15 | Logbook print set includes anything except `검토완료` | `검토가 완료되지 않은 기록은 공식 로그북 출력 대상에 포함되지 않아야 한다.` | `GET /api/logbook` and print audit POST before browser print. |

The start route must read the current equipment and active-record state immediately before append/update, write the use record and occupancy state in one controlled server operation, then re-read and compensate a detected duplicate claim as an invalid request. The fixed Sheets helpers do not provide a conditional atomic compare-and-set across Vercel instances. This is a shared implementation risk: the orchestrator must decide and document the strongest feasible serialisation strategy; builder-d2 must not claim multi-instance atomicity without evidence. [URS-F-002]

## 7. Confirmation, review, electronic signature, and audit events

### 7.1 Accuracy confirmation controls

Before a mutating request, the client presents a confirmation `Modal` with server-calculated and user-entered values. The server repeats all checks after confirmation. [URS-F-004]

| Action | Confirmation content |
| --- | --- |
| 사용 시작 등록 | selected equipment code/name, usage type, use purpose, reference number, read-only current user, and read-only server-assigned start time placeholder |
| 사용 종료 | record ID, equipment, start user/time, selected `정상` or `이상`, and abnormality details where applicable |
| 예외 종료 | record ID, equipment, active user/start time, ADMIN actor, and required reason |
| 조치 기록 and 사용 재개 요청 | source abnormality, equipment, action type/details, requester, and the fact that approval is required to resume use |
| 수정 요청 and tester correction | original record values, requested change, reason, and prior reviewer request reason |
| 검토 완료 전자서명 | complete use record including abnormality and action data, signer, exact meaning `검토 완료`, and password entry |

### 7.2 Electronic signature

The only electronic-signature action in this scope is APPROVER review completion for a `사용완료` use record. [URS-F-006]

1. The review page displays all start, end, after-use, abnormality, corrective-action, and relevant resume data.
2. The APPROVER opens the modal titled `검토 완료 전자서명` and sees a notice that the signature meaning is `검토 완료` and that the actor's password must be re-entered.
3. The request contains `password` only for immediate server-side verification. The password is not written to `USE_RECORDS`, the signature row, client storage, or AUDIT.
4. On success, the server alone writes `record_status = 검토완료`, `reviewer_id`, `reviewer_name`, `reviewed_at`, and `signature_meaning = 검토 완료`, and writes an audit event.
5. On failure, the record remains `사용완료`; the response uses the blocking message in Section 6. On success, show `전자서명이 되었습니다.` [design.md 6.3]

The signature preserves signer, timestamp, and meaning required by the URS. Approver recovery approval is a recorded `제2자 확인`, but it is not described as an electronic signature requirement; it stores confirmation identity, time, and `승인` or `반려` result as defined in `EQUIPMENT_RESUME_REQUESTS`. [URS-F-003] [URS-F-006]

### 7.3 Required audit calls

Every mutable route calls `lib/audit.ts` after the operation succeeds, recording actor, role, action, target record, timestamp, reason where applicable, and before/after values when data changed. Required action names may use the following stable codes: `USAGE_STARTED`, `USAGE_ENDED_NORMAL`, `USAGE_ENDED_ABNORMAL`, `USAGE_EXCEPTIONALLY_ENDED`, `EQUIPMENT_SUSPENDED`, `REMEDIATION_RECORDED`, `RESUME_REQUESTED`, `RESUME_APPROVED`, `RESUME_REJECTED`, `REVIEW_CHANGE_REQUESTED`, `REVIEW_COMPLETED_E_SIGNATURE`, and `LOGBOOK_PRINTED`. [URS-F-003] [URS-F-006] [URS-F-007] [URS-F-010 cross-reference]

## 8. Query and logbook print contract

### 8.1 Record query

`GET /api/records` accepts the Section 3.5 filters. It returns all matching record data needed to show:

- use start, use end, after-use status, abnormality details, corrective-action details, and review information;
- usage type in every record-list result;
- combined filters with AND semantics;
- a fully reset result when all filters are empty.

The standard list uses at most seven data columns: record ID, equipment, usage type, user, start/end summary, status, and after-use status. A `상세` action opens full `DescList` detail. [URS-F-007] [design.md 6.2, 6.6]

### 8.2 Official logbook retrieval and output

`GET /api/logbook?equipment_id=...&date_from=...&date_to=...` requires an equipment and accepts a requested date range. The server returns only rows with `record_status = 검토완료`. It returns the selected equipment code/name, period, use-history rows, review signature information, output requester identity, and generated output time. [URS-F-007]

The print view uses `PrintHeader`, `DocTable`, A4 10mm margins, repeated table headers, and an audit-before-print `PrintButton`. It includes at least:

- 장비 코드
- 장비명
- 조회 기간
- use-history fields: use-record ID, usage type, user, use purpose, reference number, start/end time, after-use status, abnormality details, and corrective-action detail when present
- review information: reviewer, review time, and signature meaning
- 출력자 and 출력 일시

Document number rule: `ELMS-LB-{equipment_code}-{date_from_YYYYMMDD}-{date_to_YYYYMMDD}-{printed_at_YYYYMMDDHHMMSS}`. This is `URS 근거 없음, 기본값`; it ensures each print event is traceable. The browser print request is recorded as `LOGBOOK_PRINTED` before `window.print()` opens. [URS-F-007] [design.md 8]

Official logbook content cannot contain a non-reviewed record, so it normally has no DRAFT watermark. If the application exposes a non-official record print preview, every state other than `검토완료` must visibly carry the `DRAFT` watermark required by the design guide, and it must not be labelled as the official logbook. [URS-F-007] [design.md 8]

## 9. API interface map

Route names are proposed integration paths. A builder may consolidate handlers only if authorization, validation, audit, and response contracts stay distinct.

| Route | Method | Server responsibility | Roles |
| --- | --- | --- | --- |
| `/api/equipment/available` | GET | Return selectable eligible equipment and blocked-status metadata for start form. | TESTER |
| `/api/records` | GET | Filtered record query, current status, full-detail references. | ADMIN, TESTER, APPROVER |
| `/api/records/start` | POST | Validate and create `IN_USE`; claim occupancy; audit use start. | TESTER |
| `/api/records/[record_id]/end` | POST | Validate own active record; normal or abnormal end; release occupancy; suspend on abnormal; audit. | initiating TESTER |
| `/api/records/[record_id]/exception-end` | POST | Validate ADMIN reason; end active record; release occupancy; audit. | ADMIN |
| `/api/records/[record_id]/change-request` | POST | Validate `COMPLETED`; save request reason and status. | APPROVER |
| `/api/records/[record_id]/review-signature` | POST | Validate password and state; save electronic-signature fields and audit. | APPROVER |
| `/api/equipment/[equipment_id]/remediations` | GET, POST | List abnormal incident actions or add a corrective action for stopped equipment. | all read, TESTER write |
| `/api/equipment/[equipment_id]/resume-requests` | GET, POST | Return all request history or create a request from current action. | all read, TESTER write |
| `/api/resume-requests/[request_id]/decision` | POST | Validate second-person approver decision; approve or reject; change equipment availability only on approval; audit. | APPROVER |
| `/api/dashboard` | GET | KPI counts, state-linked equipment lists, statistics, and calibration-alert summary. | ADMIN, TESTER, APPROVER |
| `/api/alarms` | GET | Abnormal, stopped, remediation, resumption-history, expired, and 90-day warning data. | ADMIN, TESTER, APPROVER |
| `/api/logbook` | GET | Validated official print data for one equipment and a date range. | ADMIN, TESTER, APPROVER |
| `/api/logbook/print-audit` | POST | Persist `LOGBOOK_PRINTED` before opening browser print. | ADMIN, TESTER, APPROVER |

All routes respond with an identifiable validation error rather than an unhandled system error for required-field, state, list-value, and date-format failures. [URS-N-001]

## 10. Seed data required for the workflow

At first startup, seed the three exact accounts required by the URS: `admin` with `ADMIN`, `user` with `TESTER`, and `reviewer` with `APPROVER`. Initial password `1234` is the harness fixed default. [URS-E-002]

Seed at least three educational equipment rows. One row must be a calibration target with `calibration_due_date` generated as the KST current date minus one day, `availability_status = 사용가능`, and `occupancy_status = 미사용`; this supplies the mandatory expired-calibration block and alert. At least one other row must be a currently valid `사용가능 + 미사용` equipment, so the normal start/end/review flow can be exercised. A third equipment row supplies a separate inventory item. Equipment codes and names use non-production training examples only. The number and expired calibration condition are from URS-E-003; relative-date generation and individual sample values are `URS 근거 없음, 기본값`.

No initial active use record is required. The normal validation demonstration is: TESTER starts a valid equipment, ends it `정상`, APPROVER signs it, then all roles query and print it. The abnormal demonstration is: TESTER ends a valid equipment `이상` with details, records action, requests resumption, and APPROVER either rejects with reason or approves. [URS-F-002] [URS-F-003] [URS-F-006] [URS-F-007]

## 11. Cross-team implementation requests

1. Orchestrator and builder-d1 must replace template role codes `USER` and `REVIEWER` with the URS codes `TESTER` and `APPROVER` in shared types, session guards, navigation, and seeded accounts. [Section 6.1, URS-E-002]
2. Orchestrator must add the headers from Sections 3.2 through 3.4 to the seed schema before builders use them. Existing Sheet headers must only receive appended fields. [URS-T-002]
3. Builder-d2 and builder-d3 must agree on the single ownership of resume-decision and signature routes before implementation. D2 owns use record and recovery data flow; D3 owns review, electronic-signature, and print UI/API under the file-ownership contract.
4. The fixed Google Sheets helper contract has no distributed compare-and-set. The orchestrator must record the chosen evidence-backed strategy for the strict same-equipment concurrent-start requirement. [URS-F-002]
