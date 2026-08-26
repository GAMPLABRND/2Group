# URS 구현 현황

생성 시각: 2026-08-26T15:08:16+09:00
상태 지문: 93f0360565b6b90fb9119dff16bf87a42412acd6a71d53a8da6bf3ab67675d09

## 집계

- 전체 기능 조항: 10
- 구현: 10
- 부분: 0
- 미구현: 0
- 진행 중: 0
- 대기: 0

## 조항별 현황

| URS 조항 ID | 요구 요약 | 상태 | 화면 또는 API | 파일 | 증거 |
|---|---|---|---|---|---|
| URS-F-001 | ADMIN은 장비 기준정보를 신규 등록할 수 있어야 한다. | 구현 | /equipment<br>GET/POST/PATCH /api/equipment | app/equipment/page.tsx<br>app/equipment/EquipmentConsole.tsx<br>app/api/equipment/route.ts<br>lib/equipment.ts<br>lib/schema.ts<br>lib/schema-migration.ts | source: app/api/equipment/route.ts<br>smoke: 실제 Google Sheets 장비 기준정보 분리 저장<br>source: app/equipment/EquipmentConsole.tsx<br>smoke: 실제 Google Sheets 적격성평가 대상 필수 날짜 차단 |
| URS-F-002 | TESTER는 사용 가능한 장비에 대해 사용 시작 기록을 등록할 수 있어야 한다. | 구현 | /records/new<br>POST /api/records/start | app/records/new/page.tsx<br>app/records/new/NewRecordClient.tsx<br>app/api/records/start/route.ts<br>app/api/records/_lib/service.ts<br>lib/equipment.ts | source: app/api/records/start/route.ts<br>smoke: 실제 Google Sheets /api/records/start |
| URS-F-003 | 장비 사용을 시작한 사용자는 사용중 기록에 대해 사용 종료를 등록할 수 있어야 한다. | 구현 | /records/[recordId]<br>POST /api/records/[recordId]/end<br>POST /api/remediations<br>POST /api/resume-requests<br>POST /api/approvals/resume-requests/[request_id]/decision | app/records/[recordId]/RecordDetailClient.tsx<br>app/api/records/[recordId]/end/route.ts<br>app/api/remediations/route.ts<br>app/api/resume-requests/route.ts<br>app/api/approvals/resume-requests/[request_id]/decision/route.ts | source: app/api/records/[recordId]/end/route.ts<br>source: app/api/approvals/resume-requests/[request_id]/decision/route.ts<br>smoke: 실제 Google Sheets 종료와 재조회 |
| URS-F-004 | 필수 입력 항목이 누락된 경우 기록을 저장할 수 없으며 누락된 항목을 안내해야 한다. | 구현 | /records/new<br>POST /api/records/start<br>POST /api/records/[recordId]/end | app/records/new/NewRecordClient.tsx<br>app/api/records/start/route.ts<br>app/api/records/[recordId]/end/route.ts | source: app/api/records/start/route.ts |
| URS-F-005 | 사용자는 대시보드에서 등록된 장비의 전체 현황을 확인할 수 있어야 한다. | 구현 | /<br>GET /api/dashboard<br>/equipment-stats<br>/alarms<br>GET/POST /api/alarms/unread | app/page.tsx<br>app/api/dashboard/data.ts<br>app/api/dashboard/route.ts<br>app/alarms/page.tsx<br>app/equipment-stats/page.tsx<br>app/api/alarms/unread/route.ts<br>components/UnreadAlarmPopup.tsx<br>lib/alarm-notifications.ts<br>lib/equipment.ts<br>lib/schema.ts | source: app/api/dashboard/data.ts<br>smoke: 실제 Google Sheets GET /api/dashboard<br>source: app/api/dashboard/data.ts<br>source: components/UnreadAlarmPopup.tsx<br>smoke: 실제 Google Sheets 대시보드와 미확인 알람 API |
| URS-F-006 | APPROVER는 사용완료 상태의 사용 기록을 검토할 수 있어야 한다. | 구현 | /approvals<br>POST /api/approvals/records/[record_id]/review-signature<br>POST /api/approvals/records/[record_id]/change-request | app/approvals/page.tsx<br>app/approvals/ApprovalsClient.tsx<br>app/api/approvals/route.ts<br>app/api/approvals/records/[record_id]/review-signature/route.ts<br>app/api/approvals/records/[record_id]/change-request/route.ts | source: app/api/approvals/records/[record_id]/review-signature/route.ts<br>source: app/approvals/ApprovalsClient.tsx<br>smoke: 실제 Google Sheets 전자서명 |
| URS-F-007 | 사용 기록은 장비를 조건으로 조회할 수 있어야 한다. | 구현 | /records<br>GET /api/records<br>/print/logbook<br>GET /api/print/logbook | app/records/RecordsClient.tsx<br>app/api/records/route.ts<br>app/print/logbook/LogbookClient.tsx<br>app/api/print/logbook/route.ts | source: app/api/records/route.ts<br>source: app/api/print/logbook/route.ts<br>smoke: 실제 Google Sheets 로그북 조회 |
| URS-F-008 | ADMIN은 사용자 계정을 등록하고 사용자 역할을 지정할 수 있어야 한다. | 구현 | /admin<br>POST/PATCH /api/admin<br>/about<br>POST /api/admin (UPDATE_TRAINING_PROFILE)<br>/password<br>POST /api/password<br>POST /api/session/refresh | app/admin/AdminConsole.tsx<br>app/about/AboutClient.tsx<br>app/api/admin/route.ts<br>app/api/login/route.ts<br>app/api/password/route.ts<br>app/api/session/refresh/route.ts<br>components/SessionTimeout.tsx<br>app/layout.tsx<br>lib/permissions.ts<br>lib/training-profile.ts<br>lib/schema.ts | source: app/api/admin/route.ts<br>source: app/api/login/route.ts<br>source: app/api/admin/route.ts<br>smoke: 실제 Google Sheets About 가변 실습자 저장<br>smoke: 실제 Google Sheets 계정과 권한<br>source: app/layout.tsx<br>smoke: 로컬 서버 ADMIN 대시보드 HTML<br>source: app/admin/AdminConsole.tsx<br>source: lib/permissions.ts<br>smoke: 실제 Google Sheets ADMIN 권한 카탈로그 조회 |
| URS-F-009 | 등록된 사용 기록은 영구적으로 삭제할 수 없어야 한다. | 구현 | /records/[recordId]<br>POST /api/records/[recordId]/invalidate | app/records/[recordId]/RecordDetailClient.tsx<br>app/api/records/[recordId]/invalidate/route.ts<br>app/api/records/_lib/service.ts | source: app/api/records/[recordId]/invalidate/route.ts |
| URS-F-010 | 사용자의 로그인 성공, 로그인 실패 및 로그아웃 행위를 감사추적에 기록해야 한다. | 구현 | /audit<br>GET /api/audit<br>GET /api/audit/export<br>POST /api/login<br>POST /api/logout | lib/audit.ts<br>app/api/login/route.ts<br>app/api/logout/route.ts<br>app/audit/page.tsx<br>app/api/audit/route.ts<br>app/api/audit/export/route.ts | source: lib/audit.ts<br>source: app/api/login/route.ts<br>source: app/api/logout/route.ts<br>smoke: 실제 Google Sheets GET /api/audit<br>smoke: 실제 Google Sheets 로그아웃 감사추적 |

## 미구현 및 부분 구현 항목

기능 조항의 부분 구현 또는 미구현 gap이 없습니다.
