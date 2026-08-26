# URS gaps와 환경 검증 대기

생성 시각: 2026-08-26T15:08:16+09:00
상태 지문: 93f0360565b6b90fb9119dff16bf87a42412acd6a71d53a8da6bf3ab67675d09

## 기능 gap

기능 조항의 부분 구현 또는 미구현 gap이 없습니다.

## 환경 검증 대기

- permission_dropdown_static_validation: pass: TypeScript, lint, production build
- permission_catalog_live_smoke: pass: 19 labeled permissions
- qualification_due_date_negative_smoke: pass: HTTP 400, no row created
- employee_number_header_smoke: pass: admin (EDU2-001)
- logout_actor_name_and_id_smoke: pass: 관리자/admin
- backup_failure_alarm_smoke: pass: prior flow evidence
- backup_storage_smoke: not_applicable: no server or Google Drive backup file storage
- scheduler_smoke: not_applicable: browser download requires manual ADMIN execution
- browser_backup_download_smoke: blocked: Google Drive API export returned 403 accessNotConfigured
- browser_smoke: blocked
- deployment_smoke: blocked
