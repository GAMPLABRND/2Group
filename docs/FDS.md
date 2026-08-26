---
문서번호: KPBMA-EDU-00X-FDS
시스템명: 전자로그북
영문명칭: ELMS
조: 2
버전: 1.2
작성일: 2026-08-26
작성자: AI Agent (공급자 역할, 소프트웨어개발팀)
문서상태: 초안 (검토 대기)
개정사유: v1.0의 URS 연결과 규격 내용을 기준으로 v1.1 공식 양식 적용
---

# 1. 서론 및 적용 범위 / Introduction and Scope

## 1.1 목적 / Purpose

본 기능 및 설계 규격서(Functional Design Specification, 이하 FDS)는 한국제약바이오협회 CSV 실습과정 2조가 GMP 교육 목적으로 자체 개발한 전자로그북(ELMS)의 기능 규격과 설계 규격을 정의한다. 본 문서는 사용자 요구사항 규격서(URS)의 요구가 구현되었는지 확인하는 설계 적격성평가(DQ)의 대조 기준이며, 설치 및 운전 적격성평가(IOQ) 계획의 기초 자료로 활용된다. 본 프로젝트에서는 기능 규격서(FS)와 설계 규격서(DS)를 하나의 문서로 통합한다.

## 1.2 범위 / Scope

본 문서는 전자로그북을 구성하는 웹 애플리케이션과 데이터 저장소인 구글 시트의 기능 및 설계 규격에 적용된다. 본 문서는 2026-08-26 기준 구현 완료 상태인 버전 1.2를 기술한다. 본 버전의 URS 7.1 기능 요구사항에서 구현 범위에서 제외된 조항은 없다.

# 2. 시스템 개요 / System Overview

## 2.1 사용 목적 / Intended Use

전자로그북은 GMP 설비와 분석기기의 사용 이력을 전자기록으로 관리한다. 사용자는 장비 사용 시작과 종료, 사용 후 상태 및 특이사항을 기록하고, 검토자는 사용완료 기록을 전자서명으로 검토한다. 시스템은 교정 만료 장비와 중복 사용을 차단하고 이상 장비를 사용중지로 전환하며, 조치와 제2자 승인 후 사용 재개를 허용한다. 검토완료 기록은 잠그고 잘못 등록된 기록은 삭제하지 않고 사유와 함께 무효 처리하며, 조건별 조회와 로그북 출력을 제공한다. 전자로그북은 GMP 교육 목적으로 자체 개발된 GAMP Category 5 시스템이다.

## 2.2 시스템 설명 / System Description

사용자는 교육장 PC의 웹 브라우저로 접속하여 계정과 역할 및 개별 권한에 따라 허용된 화면을 사용한다. 클라이언트 화면은 업무 요청을 동일 애플리케이션의 서버 API로 전송하고, 서버 API는 세션과 역할, 입력값, 상태 전이 및 전자서명 비밀번호를 다시 검사한다. 서버는 서비스 계정으로 구글 시트 API를 호출하여 한 개의 스프레드시트에 기준정보, 업무 기록, 계정, 감사추적 및 운영 기록을 저장한다. 클라이언트는 구글 시트를 직접 호출하지 않는다.

## 2.3 시스템 구성 / System Configuration

본 시스템은 사용자 PC의 최신 Chrome 웹 브라우저, Vercel에 배포되는 Next.js App Router 웹 애플리케이션과 서버 라우트, 데이터 저장용 구글 스프레드시트 한 개로 구성된다. 사용자는 배포 URL로 접속하며 모든 데이터 경로는 서버의 `/api/*` 라우트를 거친다. 개발 환경에서는 동일한 Next.js 애플리케이션을 로컬 URL로 실행할 수 있다.

## 2.4 시스템 컴포넌트 구성 / System Component Configuration

| 컴포넌트 / Component | 구분 / Type | 주요 역할 / Primary Role | 비고 / Remarks |
|---|---|---|---|
| 웹 애플리케이션 (Next.js 16.3.1) | 클라이언트 화면과 서버 API | 화면 제공, 세션과 권한 검사, 입력 검증, 상태 전이, 전자서명, 조회와 출력 | 배포 대상: Vercel |
| 구글 스프레드시트 | 데이터 저장 | 계정, 기준정보, 사용 기록, 검토와 조치, 운영 설정, 감사추적 저장 | 서비스 계정 편집자 공유 |
| Google Sheets API | 서버 인터페이스 | 서버 애플리케이션과 구글 스프레드시트 사이의 조회, 추가 및 갱신 | `googleapis` 사용 |
| 웹 브라우저 | 사용자 접속 | 화면 표시, 입력, 인쇄 및 백업 파일 저장 | Chrome 최신 버전 |

## 2.5 전체 업무 흐름 / Overall Workflow

로그인 → 장비 기준정보 확인 → 사용 시작 → 사용 종료 → 조치와 사용 재개 승인 → 검토와 전자서명 → 조회와 출력 순서로 처리한다. ADMIN은 장비, 계정, 보안 설정 및 실습 정보를 관리하고 사용중 기록을 사유와 함께 예외 종료할 수 있다. TESTER는 사용 가능한 장비를 선택하여 사용 기록을 시작하고 본인 기록을 종료, 수정, 무효 처리하며 이상 장비의 조치와 사용 재개를 요청한다. APPROVER는 사용완료 기록을 수정 요청하거나 비밀번호 재입력으로 검토 완료하고 사용 재개 요청을 승인 또는 반려한다. 모든 역할은 허용된 범위에서 대시보드, 장비, 기록, 로그북과 알람을 조회하며 ADMIN과 APPROVER는 감사추적을 조회하고 출력한다.

# 3. 기능 규격 / Functional Specification

## 3.1 접근 관리 및 보안 / Access Control & Security

시스템은 ADMIN, TESTER, APPROVER 역할과 계정별 추가 허용 및 차단 권한을 적용한다. 로그인 성공 시 httpOnly 세션 쿠키를 발급하고, 서버는 활성 상태, 잠금 상태, 역할 및 비밀번호 유효기간을 확인한다. 역할과 유효 권한은 메뉴 표시와 페이지 접근 및 API 실행에서 각각 검사한다.

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-001 | 로그인 화면은 계정 선택, 아이디, 비밀번호 순서로 입력받고 선택한 실습 계정의 아이디와 초기 비밀번호를 채우며, 서버는 아이디와 비밀번호 및 계정 상태를 확인하여 세션을 생성한다. | URS-F-008 |
| 2 | FS-002 | 로그인 성공, 아이디 또는 비밀번호 불일치, 비활성 계정, 잠긴 계정 및 로그아웃 행위는 행위자, 결과와 시각을 감사추적에 기록한다. | URS-F-010 |
| 3 | FS-003 | 로그인 실패가 설정 횟수에 도달하면 계정을 잠그고 잠긴 계정입니다. 관리자에게 잠금 해제를 요청하세요.를 표시하며, ADMIN은 계정 잠금 해제와 비밀번호 초기화를 수행할 수 있다. | URS-F-008 |
| 4 | FS-004 | ADMIN은 사용자 ID, 이름, 사번, 역할, 활성 상태와 개별 추가 허용 및 차단 권한을 등록 또는 수정하며, 중복 사용자 ID와 누락된 사번은 저장하지 않는다. | URS-F-008 |
| 5 | FS-005 | 모든 사용자는 현재 비밀번호 확인과 새 비밀번호 정책 검증을 거쳐 본인 비밀번호를 변경하며, 서버는 최소 길이와 문자 조합, 유효기간, 실패 잠금 기준 및 미활동 자동 로그아웃 시간을 ADMIN 설정값으로 적용한다. | URS-F-008 |
| 6 | FS-006 | 역할 또는 유효 권한이 없는 페이지는 대시보드로 이동하고 API는 요청을 거부하며 권한이 없는 화면 또는 기능에 접근을 시도하면 접근이 차단되고 안내 메시지가 표시된 후 메인 화면으로 이동한다.를 반환한다. | URS-F-008 |
| 7 | FS-007 | 로그인 후 상단 영역은 접속 ID와 사번을 `ID (사번)` 형식으로 표시하고 서버에 저장된 활동 시각을 기준으로 세션을 갱신하거나 설정된 미활동 시간이 지나면 로그아웃한다. | URS-F-008, URS 근거 없음 (DECISIONS.md DEC-004, 수정 요청 2026-08-26) |
| 8 | FS-008 | ADMIN은 회사명, 조번호와 한 명 이상의 실습자 이름 및 소속을 수정 사유와 함께 저장하며, 전체 변경 전후 목록과 수정자를 감사추적에 기록한다. | URS-F-008, URS 근거 없음 (DECISIONS.md DEC-011, 수정 요청 2026-08-26) |

## 3.2 전자로그북 및 장비 운영 / Electronic Logbook and Equipment Operations

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-009 | ADMIN은 장비 코드, 장비명, 설치 위치, 교정 대상 여부, 적격성평가 대상 여부, 교정 유효기간, 사용 상태와 비고를 등록 또는 수정 사유와 함께 저장하고, TESTER와 APPROVER는 장비 목록을 조회한다. | URS-F-001, URS 근거 없음 (DECISIONS.md DEC-009, DEC-014, 수정 요청 2026-08-26) |
| 2 | FS-010 | 교정 대상 또는 적격성평가 대상 장비는 교정 유효기간을 필수로 입력하며, 교정 대상 장비의 유효기간이 KST 현재 날짜보다 과거이면 서버가 사용중지로 전환하고 SYSTEM 행위자의 감사추적을 남긴다. | URS-F-001, URS-F-002, URS 근거 없음 (DECISIONS.md DEC-010, DEC-014, 수정 요청 2026-08-26) |
| 3 | FS-011 | TESTER는 사용가능하고 미사용이며 교정이 유효한 장비를 기준정보 목록에서 선택하고 사용 유형, 사용 목적과 선택적 참조번호를 입력하여 사용중 기록을 시작한다. 서버는 로그인 사용자와 시작 시각을 자동 저장한다. | URS-F-002 |
| 4 | FS-012 | 사용중 기록의 소유자는 사용 후 상태를 정상 또는 이상으로 선택하여 종료하며, 이상을 선택하면 특이사항을 필수로 저장하고 장비를 사용중지 및 미사용 상태로 전환한다. | URS-F-003, URS-F-004 |
| 5 | FS-013 | ADMIN은 TESTER가 종료하지 못한 사용중 기록을 사유와 함께 예외 종료하며, 정상 종료는 장비 점유를 해제하고 이상 종료는 장비를 사용중지한다. | URS-F-003 |
| 6 | FS-014 | TESTER는 이상 종료된 장비에 점검, 수리 또는 기타 조치 내용을 기록하고 사용 재개를 요청하며, APPROVER는 제2자 확인 후 승인 또는 반려한다. 승인하면 장비를 사용가능 및 미사용 상태로 복원하고 반려하면 사용중지를 유지하며 반려 사유를 저장한다. | URS-F-003 |
| 7 | FS-015 | APPROVER는 사용완료 기록을 검토하여 사유와 함께 수정요청 상태로 전환하고, 기록 소유자가 수정 사유와 보완 내용을 저장하면 사용완료 상태로 복귀시킨다. | URS-F-006 |
| 8 | FS-016 | 대시보드는 전체, 사용가능, 사용중, 사용중지, 폐기 및 교정 만료 장비 수와 장비 코드, 장비명, 위치, 사용가능 상태 및 사용 유형별 통계를 표시한다. | URS-F-005 |
| 9 | FS-017 | 알람 화면은 교정 만료와 만료 임박, 이상 종료, 조치와 사용 재개 이력 및 보안 경고를 표시하며, 로그인 후 미확인 알람 팝업은 발생 일시, 유형, 대상과 주요 내용을 표시하고 사용자별 읽음 상태를 서버에 저장한다. | URS-F-005, URS-F-008, URS 근거 없음 (DECISIONS.md DEC-013, 수정 요청 2026-08-26) |
| 10 | FS-018 | 사용 기록 목록은 장비, 기록 상태, 사용자, 사용 후 상태와 기간 조건으로 조회하고 각 기록의 상세, 조치 및 사용 재개 이력을 표시한다. | URS-F-007 |
| 11 | FS-019 | 로그북은 장비와 조회 기간 조건에 맞는 검토완료 기록만 조회하고 교정 및 적격성평가 대상 여부, 출력자와 출력 시각 및 고유 문서번호를 포함하여 브라우저 인쇄를 제공한다. | URS-F-007, URS 근거 없음 (DECISIONS.md DEC-007, 수정 요청 2026-08-25) |
| 12 | FS-020 | ADMIN이 백업 화면에서 백업을 실행하면 서버가 운영 스프레드시트의 XLSX 파일과 SHA-256을 생성하여 같은 응답으로 브라우저에 전달하고, 브라우저는 파일을 사용자 PC에 저장한다. 서버 또는 Google Drive에는 백업 파일을 보관하지 않는다. | URS-D-003, URS 근거 없음 (DECISIONS.md DEC-015, 수정 요청 2026-08-26) |

## 3.3 데이터 처리 / Data Processing

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-021 | 서버는 사용 시작과 종료, 수정, 무효, 수정 요청, 사용 재개 및 관리자 작업의 필수 입력값을 검사하고 누락 시 필수 입력 항목이 누락된 경우 기록을 저장할 수 없으며 누락된 항목을 안내해야 한다.와 누락 항목명을 반환한다. | URS-F-004, URS-N-001 |
| 2 | FS-022 | 서버는 사용 유형을 일반 사용, 시험/분석, 적격성평가/밸리데이션, 점검/유지보수 및 기타 목록으로 제한하고, 장비, 사용자와 시각은 기준정보 또는 현재 세션 및 서버 시각에서 생성한다. | URS-F-002, URS-F-004 |
| 3 | FS-023 | 사용 시작 시 서버는 장비 사용 상태, 점유 상태, 교정 유효기간과 기존 사용중 기록을 다시 조회하고 점유 토큰을 확인하여 동일 장비의 동시 사용 시작을 한 건으로 제한한다. | URS-F-002 |
| 4 | FS-024 | 사용 종료 시 서버는 기록 소유자, 사용중 상태, 장비 점유 일치와 종료 시각이 시작 시각 이후인지 검사하고, 정상 또는 이상 결과에 따라 기록 및 장비 상태를 함께 갱신한다. | URS-F-003 |
| 5 | FS-025 | 서버는 사용중 → 사용완료 → 검토완료 상태 전이와 사용완료 → 수정요청 → 사용완료 상태 전이만 허용하고 허용되지 않은 상태 전이는 차단되어야 한다.를 반환한다. | URS-F-006 |
| 6 | FS-026 | 장비 사용 통계는 무효 기록을 제외하고 사용 유형별 사용 횟수와 이상 발생 횟수를 집계하며, 이상율은 `(이상 발생 횟수 / 사용 횟수) * 100`으로 계산하고 사용 횟수가 0이면 0%로 표시한다. | URS-F-005, URS 근거 없음 (DECISIONS.md DEC-013, 수정 요청 2026-08-26) |
| 7 | FS-027 | 조회 기간은 YYYY-MM-DD 형식과 시작일이 종료일보다 늦지 않은지 검사하고, 로그북은 서버 시각을 포함한 문서번호 `ELMS-LB-장비코드-시작일-종료일-출력시각`을 생성한다. | URS-F-007, URS-D-001, URS 근거 없음 (DECISIONS.md DEC-007, 수정 요청 2026-08-25) |

## 3.4 전자기록 데이터 관리 / Electronic Records & Data Management

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-028 | 신규 계정, 장비, 사용 기록, 조치, 재개 요청, 백업 이력, 알람 확인 및 감사추적은 고유 ID와 함께 해당 구글 시트 탭에 새 행으로 추가하고 기존 업무 기록의 물리 삭제 API는 제공하지 않는다. | URS-F-009, URS-D-002, URS-T-002 |
| 2 | FS-029 | TESTER는 검토완료 전 본인 기록만 수정 사유와 함께 수정하거나 무효 사유와 함께 무효 처리하며, 사용중 기록을 무효 처리하면 장비 점유를 미사용으로 해제한다. | URS-F-009 |
| 3 | FS-030 | 검토완료 기록은 직접 수정과 재검토를 차단하고 검토완료 (전자서명 완료) 된 기록은 기존 값을 직접 수정할 수 없어야 한다.를 반환한다. 무효 기록은 다시 변경하지 않는다. | URS-F-006, URS-F-009 |
| 4 | FS-031 | 장비, 사용 기록과 계정의 변경은 기존 행을 식별자로 갱신하되 변경 전후 값, 변경자, 변경 시각과 사유를 감사추적의 새 행으로 보존한다. | URS-F-001, URS-F-008, URS-F-009, URS-F-010 |
| 5 | FS-032 | 백업 이력은 파일명, 크기, 해시, 실행자, 실행 시각과 성공 또는 실패 상태만 구글 시트에 보존하며 백업 파일은 ADMIN의 브라우저 다운로드 응답에서만 전달한다. | URS-D-003, URS 근거 없음 (DECISIONS.md DEC-015, 수정 요청 2026-08-26) |

## 3.5 감사추적 / Audit Trail

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-033 | 로그인 성공과 실패, 로그아웃, 비인가 접근, 계정 잠금 및 보안 설정 변경은 SECURITY 범주의 감사추적에 기록한다. | URS-F-008, URS-F-010 |
| 2 | FS-034 | 장비 등록과 수정, 사용 시작과 종료, 기록 수정과 무효, 조치와 사용 재개, 수정 요청과 검토 완료, 출력 및 백업 작업은 DATA 또는 SYSTEM 범주의 감사추적에 기록한다. | URS-F-001, URS-F-002, URS-F-003, URS-F-006, URS-F-007, URS-F-008, URS-F-009, URS-F-010 |
| 3 | FS-035 | 감사추적 행은 고유 ID, 범주, 행위자 ID와 이름, 역할, 행위, 대상, 변경 전 값, 변경 후 값, 사유와 KST 표시용 시각을 포함하고 애플리케이션에서 수정 또는 삭제하지 않는다. | URS-F-010 |
| 4 | FS-036 | ADMIN과 APPROVER는 기간, 행위자, 범주, 행위와 대상 조건으로 감사추적을 조회하고 CSV 내보내기 또는 인쇄용 보고서를 생성하며, TESTER의 접근은 차단한다. | URS-F-010 |
| 5 | FS-037 | 변경성 API는 업무 데이터 변경 후 감사추적 저장을 시도하고 감사추적 저장이 실패하면 성공 응답을 반환하지 않는다. | URS-F-010 |

## 3.6 전자서명 / Electronic Signatures

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-038 | APPROVER는 사용완료 기록의 주요 정보를 확인한 뒤 본인 비밀번호를 다시 입력하고, 서버가 활성 계정의 비밀번호와 일치함을 확인한 경우에만 전자서명을 완료한다. | URS-F-006 |
| 2 | FS-039 | 전자서명 완료 시 기록 상태를 검토완료로 전환하고 서명자 ID와 이름, 서명 시각 및 서명 의미 검토 완료를 기록과 감사추적에 저장한다. | URS-F-006 |
| 3 | FS-040 | 비밀번호가 없거나 일치하지 않으면 올바른 경우에만 검토가 완료되어야 한다.를 표시하고 기록 상태를 변경하지 않는다. | URS-F-006 |

## 3.7 인터페이스 및 통신 / Interfaces & Communication

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-041 | 서버는 `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID` 환경 변수로 Google Sheets API에 인증하고 지정한 스프레드시트의 탭과 행을 조회, 추가 및 갱신한다. | URS-I-001, URS-T-002 |
| 2 | FS-042 | 브라우저는 동일 애플리케이션의 `/api/*` 경로에 `cache: no-store` 요청을 보내고, 서버 API만 구글 시트와 통신한다. | URS-I-001, URS-T-002 |
| 3 | FS-043 | 데이터 화면은 서버에서 동적 렌더링하고 캐시 재검증을 사용하지 않으며, 목록 화면은 자동 폴링 대신 사용자의 수동 새로고침으로 최신 데이터를 다시 조회한다. | URS-T-003, URS 근거 없음 (기술 기본값, 2026-08-26) |

## 3.8 오류처리 및 무결성 통제 / Error Handling & Data Integrity Controls

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-044 | 사용 시작 대상이 교정 만료이면 교정 대상 장비의 교정 유효기간이 지난 경우 새로운 사용을 시작할 수 없어야 한다.를 표시하고, 사용중지 또는 폐기이면 사용중지 또는 폐기 상태인 장비는 새로운 사용을 시작할 수 없어야 한다.를 표시한다. | URS-F-002, URS-N-001 |
| 2 | FS-045 | 동일 장비에 사용중 기록이 있으면 동일 장비에 사용중 상태의 기록이 존재하는 경우 새로운 사용 시작을 등록할 수 없어야 한다.를 표시하고 새 기록 저장을 차단한다. | URS-F-002, URS-N-001 |
| 3 | FS-046 | 이상 종료에 특이사항이 없으면 사용 후 상태가 '이상'인 경우 특이사항을 필수로 기록해야 한다.를 표시하고 종료 저장을 차단한다. | URS-F-003, URS-F-004, URS-N-001 |
| 4 | FS-047 | 사용 기록 삭제 요청에는 사용 기록은 물리적으로 삭제할 수 없으며 사유와 함께 무효 처리해야 합니다.를 반환하고 HTTP 405로 처리한다. | URS-F-009, URS-N-001 |
| 5 | FS-048 | 인증되지 않은 API 요청은 로그인이 필요합니다.를 반환하고 권한이 없는 페이지 또는 API 접근은 차단하며, 비인가 접근 시도는 가능한 경우 감사추적에 기록한다. | URS-F-008, URS-F-010, URS-N-001 |
| 6 | FS-049 | 저장 시각은 ISO 형식의 서버 시각으로 생성하고 화면과 출력물은 `YYYY-MM-DD HH:MM:SS (KST)` 또는 초를 생략한 KST 형식으로 표시하며 사용자가 자동 시각을 입력하거나 수정하지 못하게 한다. | URS-D-001, URS-F-004 |
| 7 | FS-050 | Google Sheets 조회 또는 저장 실패와 서버 예외는 식별 가능한 한국어 오류 메시지와 4xx 또는 5xx 상태로 반환하고, 사용자는 수동 새로고침 또는 연결 설정 확인 후 다시 시도한다. | URS-N-001, URS-C-001 |

# 4. 설계 규격 / Design Specification

본 장은 기능 규격이 어떻게 구현되는지를 기술하며, 설치 및 운전 적격성평가(IOQ)의 설치 확인 기준으로 활용된다.

## 4.1 구성 / Configuration

| No. | DS ID | 설계 규격 / Design Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | DS-001 | ADMIN 역할은 대시보드, 장비 조회와 관리, 기록 조회와 예외 종료, 로그북, 알람, 감사추적, 백업, 비밀번호 변경 및 관리자 설정을 사용하고 사용 시작과 검토 전자서명은 기본 권한에서 제외한다. | URS-F-001, URS-F-005, URS-F-007, URS-F-008, URS-F-010 |
| 2 | DS-002 | TESTER 역할은 대시보드, 장비 조회, 사용 시작과 종료, 본인 기록 수정과 무효, 조치와 재개 요청, 기록 조회, 로그북, 알람과 비밀번호 변경을 사용하고 관리자 설정, 감사추적 및 검토 전자서명은 기본 권한에서 제외한다. | URS-F-002, URS-F-003, URS-F-005, URS-F-007, URS-F-008, URS-F-009 |
| 3 | DS-003 | APPROVER 역할은 대시보드, 장비와 기록 조회, 수정 요청, 검토 전자서명, 사용 재개 결정, 로그북, 알람, 감사추적과 비밀번호 변경을 사용하고 장비 및 계정 관리와 사용 기록 작성은 기본 권한에서 제외한다. | URS-F-005, URS-F-006, URS-F-007, URS-F-008, URS-F-010 |
| 4 | DS-004 | 권한 카탈로그의 19개 권한 코드는 역할 기본 권한을 적용한 뒤 계정별 allow 권한을 추가하고 deny 권한을 제외하는 순서로 유효 권한을 계산한다. | URS-F-008 |
| 5 | DS-005 | 애플리케이션은 Next.js 16.3.1 App Router, React 19.2.8 및 Node.js 22 이상으로 구성하고 Vercel 배포를 대상으로 한다. 런타임 연결 설정은 `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID` 이름만 사용한다. | URS-T-001, URS-T-003, URS-E-001 |
| 6 | DS-006 | 로그인과 세션 API는 `/api/login`, `/api/logout`, `/api/password`, `/api/session/refresh`로 구성하고, 계정과 기준정보 API는 `/api/admin`, `/api/admin/training-profile`, `/api/equipment`, `/api/seed`로 구성한다. 인증 및 관리 라우트는 활성 사용자, 역할과 유효 권한을 서버에서 검사한다. | URS-F-001, URS-F-008, URS-F-010 |
| 7 | DS-007 | 사용 기록 API는 `/api/records`, `/api/records/start`, `/api/records/{recordId}`, 종료, 예외 종료와 무효 하위 경로, `/api/remediations`, `/api/resume-requests`로 구성하고 각 변경 라우트가 소유자, 상태와 권한을 서버에서 검사한다. | URS-F-002, URS-F-003, URS-F-004, URS-F-009 |
| 8 | DS-008 | 검토 API는 `/api/approvals`, 기록별 수정 요청과 전자서명 하위 경로 및 재개 요청별 결정 하위 경로로 구성하고 APPROVER 역할과 비밀번호 또는 상태 전이를 서버에서 검사한다. | URS-F-006 |
| 9 | DS-009 | 조회와 운영 API는 `/api/dashboard`, `/api/alarms`, `/api/alarms/unread`, `/api/audit`, 감사추적 내보내기와 인쇄 하위 경로, `/api/print/logbook`, `/api/backup`으로 구성하고 각 라우트가 역할과 유효 권한을 서버에서 검사한다. | URS-F-005, URS-F-007, URS-F-010, URS-D-003 |
| 10 | DS-010 | 초기화 API는 admin, user, reviewer 계정과 세 건의 장비 기준정보를 멱등하게 준비하며, 교정 유효기간이 지난 교정 대상 장비 한 건을 포함한다. | URS-E-002, URS-E-003 |

## 4.2 데이터 설계 / Data Design

데이터는 구글 스프레드시트 한 파일 안의 다음 탭에 저장한다. 각 행은 첫 번째 `id` 열 또는 해당 탭의 업무 식별자로 구분한다.

| No. | DS ID | 설계 규격 / Design Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | DS-011 | USERS 탭: id, user_id, name, password, role, status, created_at, employee_no, permission_overrides, password_changed_at, password_expires_at, failed_login_count, locked_at, updated_at | URS-F-008, URS-D-002 |
| 2 | DS-012 | SECURITY_SETTINGS 탭: id, min_password_length, require_uppercase, require_lowercase, require_digit, require_special, password_validity_days, max_failed_login_attempts, idle_timeout_minutes, updated_by, updated_at | URS-F-008 |
| 3 | DS-013 | TRAINING_PROFILE 탭: id, company_name, trainee_name, team_no, updated_by, updated_at, members_json | URS-F-008, URS 근거 없음 (DECISIONS.md DEC-011, 수정 요청 2026-08-26) |
| 4 | DS-014 | TRAINING_HISTORY 탭: id, user_id, course_name, completed_at, recorded_by, status | URS-L-002 |
| 5 | DS-015 | EQUIPMENT 탭: id, equipment_code, equipment_name, location, calibration_required, calibration_due_date, availability_status, occupancy_status, occupancy_record_id, occupied_by_user_id, occupied_by_user_name, occupied_at, remarks, created_by, created_at, updated_by, updated_at, qualification_required | URS-F-001, URS-F-002, URS-D-002 |
| 6 | DS-016 | USE_RECORDS 탭: id, equipment_id, equipment_code, equipment_name, user_id, user_name, employee_no, usage_type, usage_purpose, reference_no, started_at, ended_at, record_status, after_use_status, abnormality_details, end_method, exception_ended_by_id, exception_ended_by_name, exception_ended_at, exception_reason, change_request_reason, reviewer_id, reviewer_name, reviewed_at, signature_meaning, invalidated_by, invalidated_at, invalidation_reason, updated_by, updated_at | URS-F-002, URS-F-003, URS-F-006, URS-F-009, URS-D-002 |
| 7 | DS-017 | EQUIPMENT_REMEDIATIONS 탭: id, equipment_id, source_record_id, action_type, action_details, action_recorded_by_id, action_recorded_by_name, action_recorded_at, updated_by_id, updated_at, remediation_status | URS-F-003, URS-D-002 |
| 8 | DS-018 | EQUIPMENT_RESUME_REQUESTS 탭: id, equipment_id, source_record_id, remediation_id, action_details_snapshot, request_sequence, resume_status, requested_by_id, requested_by_name, requested_at, confirmed_by_id, confirmed_by_name, confirmed_at, confirmation_result, rejection_reason | URS-F-003, URS-D-002 |
| 9 | DS-019 | BACKUP_SETTINGS 탭: id, interval_days, execution_time, enabled, timezone, updated_by, updated_at | URS-D-003, URS 근거 없음 (DECISIONS.md DEC-015, 수정 요청 2026-08-26) |
| 10 | DS-020 | BACKUP_RUNS 탭: id, backup_date, started_at, completed_at, status, backup_scope, file_format, file_name, file_size_bytes, error_message, drive_file_id, sha256, trigger_type, triggered_by, schedule_key | URS-D-003, URS 근거 없음 (DECISIONS.md DEC-015, 수정 요청 2026-08-26) |
| 11 | DS-021 | BACKUP_ALARMS 탭: id, backup_id, backup_date, started_at, completed_at, result, backup_type, file_name, error_message, drive_file_id, created_at | URS-D-003, URS 근거 없음 (DECISIONS.md DEC-015, 수정 요청 2026-08-26) |
| 12 | DS-022 | ALARM_ACKS 탭: id, alarm_key, user_id, acknowledged_at, alarm_type, target, created_at | URS-F-005, URS 근거 없음 (DECISIONS.md DEC-013, 수정 요청 2026-08-26) |
| 13 | DS-023 | AUDIT 탭: id, category, actor_id, actor_name, role, action, target, before_value, after_value, reason, timestamp_kst | URS-F-010 |

## 4.3 소스코드 통제 / Source Code Control

| No. | DS ID | 설계 규격 / Design Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | DS-024 | 소스코드는 GitHub 저장소 `GAMPLABRND/2Group`의 `main` 브랜치에서 관리하며, IOQ 대상 승인 버전은 검토 후 `v1.0` 태그로 식별한다. | URS-L-001 |
| 2 | DS-025 | 변경은 커밋 단위로 기록하고 커밋 메시지는 한국어로 무엇을 왜와 관련 URS 기능 조항 ID를 병기하며, 변경 내역은 CHANGELOG.md에 기록한다. | URS-L-001 |
| 3 | DS-026 | 구글 시트 접근 규격 코드 `lib/sheets.ts`는 `npm.cmd run check:sheets`의 기준 해시로 변경을 통제하고, 릴리스 전 하네스 최종 검사와 프로덕션 빌드를 수행한다. | URS-L-001, URS-I-001, URS-T-002 |

# 5. 데이터 / Data

본 시스템에서 생성, 관리되는 데이터는 3.4절 전자기록 데이터 관리에서 정의한 전자기록 분류를 따른다. 기준정보에는 장비, 계정, 보안 설정과 실습 정보가 포함되고 업무 기록에는 장비 사용, 조치, 재개 요청, 전자서명, 알람 확인과 백업 이력이 포함된다. 감사추적은 보안, 데이터 및 시스템 행위를 별도 AUDIT 탭의 추가 행으로 보존한다. 업무 기록은 물리 삭제하지 않고 상태 변경, 수정 사유와 무효 처리로 이력을 유지하며, 모든 탭은 지정된 구글 스프레드시트에 보존한다. 백업 파일은 ADMIN이 생성한 응답을 브라우저로 사용자 PC에 저장하고 시스템에는 파일 메타데이터와 해시만 유지한다.

# 6. 용어 정의 / Acronyms, Abbreviations, and Definitions

| 약어 / Term | 정의 / Definition |
|---|---|
| API | Application Programming Interface |
| Audit Trail | 감사추적 |
| CSV | Computerized System Validation |
| DQ | Design Qualification, 설계 적격성평가 |
| DS | Design Specification, 설계 규격서 |
| ELMS | Electronic Logbook Management System, 전자로그북 관리 시스템 |
| FDS | Functional Design Specification, 기능 및 설계 규격서 |
| FS | Functional Specification, 기능 규격서 |
| GAMP | Good Automated Manufacturing Practice |
| GMP | Good Manufacturing Practice |
| ID / PW | Identification / Password |
| IOQ | Installation and Operational Qualification |
| KST | Korea Standard Time |
| RBAC | Role-Based Access Control |
| SHA-256 | Secure Hash Algorithm 256-bit |
| URL | Uniform Resource Locator |
| URS | User Requirements Specification, 사용자 요구사항 규격서 |
| XLSX | Office Open XML Spreadsheet |
