---
문서번호: KPBMA-EDU-00X-FDS
시스템명: [시스템명]
영문명칭: [영문 약어, 예: ELMS]
조: [N]
버전: 1.0
작성일: [YYYY-MM-DD]
작성자: AI Agent (공급자 역할, 소프트웨어개발팀)
문서상태: 초안 (검토 대기)
개정사유: 최초 작성 (구현 완료 시점의 시스템 현재 상태)
---
<!--
이 파일은 docs/FDS.md 의 양식이다. 복사해서 채운다. 규칙은 docs/FDS_GUIDE.md.
  - 제목(#, ##)의 번호와 이름은 바꾸지 않는다. 3.2 의 괄호 부분만 시스템 고유 기능 영역명으로 바꾼다.
  - 3.1 ~ 3.8 은 FS 표, 4.1 ~ 4.3 은 DS 표를 반드시 둔다. 표 머리글은 그대로 둔다.
  - 주석(<!-- -->)과 대괄호 자리표시는 모두 실제 내용으로 바꾼다. npm run fds 가 검증한다.
  - 문체는 규격서 평서형("~한다", "~된다"). 방점과 대시를 쓰지 않는다.
-->

# 1. 서론 및 적용 범위 / Introduction and Scope

## 1.1 목적 / Purpose

본 기능 및 설계 규격서(Functional Design Specification, 이하 FDS)는 한국제약바이오협회 CSV 실습과정 [N]조가 GMP 교육 목적으로 자체 개발한 [시스템명]([영문 약어])의 기능 규격과 설계 규격을 정의한다. 본 문서는 사용자 요구사항 규격서(URS)의 요구가 구현되었는지 확인하는 설계 적격성평가(DQ)의 대조 기준이며, 설치 및 운전 적격성평가(IOQ) 계획의 기초 자료로 활용된다. 본 프로젝트에서는 기능 규격서(FS)와 설계 규격서(DS)를 하나의 문서로 통합한다.

## 1.2 범위 / Scope

본 문서는 [시스템명]을 구성하는 웹 애플리케이션과 데이터 저장소(구글 시트)의 기능 및 설계 규격에 적용된다. 본 문서는 [YYYY-MM-DD] 기준 구현 완료 상태(버전 [v1.0])를 기술한다.

<!-- 미구현 조항이 있으면 아래 문단과 목록을 쓴다. 없으면 "본 버전에서 구현 범위에서 제외된 URS 조항은 없다." 한 문장만 남긴다. -->
다음 URS 조항은 본 버전에서 구현되지 않아 본 문서의 범위에서 제외된다. 사유는 IMPLEMENTED.md 와 같다.

- URS-F-0XX: [요구 요약]. [미구현 사유 한 문장].

# 2. 시스템 개요 / System Overview

## 2.1 사용 목적 / Intended Use

[URS §2.2 사용 목적을 근거로 시스템이 무엇을 위해 쓰이는지 3~5문장으로 쓴다. 관련 URS: URS §2.2]

[시스템명]은 GMP 교육 목적으로 자체 개발된(GAMP Category 5) 시스템이다.

## 2.2 시스템 설명 / System Description

[구현된 구조를 간결하게 쓴다. 예: 사용자는 웹 브라우저로 접속하여 역할에 따라 허용된 화면을 사용하며, 모든 데이터는 서버 측 API 를 거쳐 구글 시트에 저장된다.]

## 2.3 시스템 구성 / System Configuration

[전체 구성을 쓴다. 예: 본 시스템은 사용자 PC 의 웹 브라우저, Vercel 에 배포된 Next.js 웹 애플리케이션(서버 라우트 포함), 데이터 저장용 구글 스프레드시트로 구성된다.]

## 2.4 시스템 컴포넌트 구성 / System Component Configuration

| 컴포넌트 / Component | 구분 / Type | 주요 역할 / Primary Role | 비고 / Remarks |
|---|---|---|---|
| 웹 애플리케이션 (Next.js) | 클라이언트 화면과 서버 API | [화면 제공, 입력 검증, 상태 전이, 인쇄] | 배포: Vercel |
| 구글 스프레드시트 | 데이터 저장 | [탭 목록을 간단히] | 서비스 계정 편집자 공유 |
| 웹 브라우저 | 사용자 접속 | 화면 표시와 입력 | Chrome 최신 버전 |

## 2.5 전체 업무 흐름 / Overall Workflow

[사용자 관점의 전체 흐름을 한 줄 화살표와 3~6개 문장으로 쓴다. 예: 로그인 → 기준정보 등록 → 기록 등록 → 검토 요청 → 전자서명 검토 완료 → 조회와 출력]

# 3. 기능 규격 / Functional Specification

## 3.1 접근 관리 및 보안 / Access Control & Security

[인증 방식, 역할과 권한, 세션, 비밀번호 규칙을 구현된 대로 2~4문장으로 쓴다.]

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-001 | [구현된 기능을 한 문장으로. 입력, 처리, 출력 또는 차단 문구 원문] | URS-F-0XX |

## 3.2 [시스템 고유 기능 영역] / [System-Specific Functions]

<!-- 3.2 제목의 대괄호는 시스템 고유 기능 영역명으로 바꾼다. 예: "## 3.2 장비 사용 기록 관리 / Equipment Usage Records". 기능 영역이 여러 개면 ### 3.2.1, ### 3.2.2 소절로 나눈다. -->

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-0XX | [고유 업무 기능] | URS-F-0XX, URS-F-0XX |

## 3.3 데이터 처리 / Data Processing

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-0XX | [자동 계산, 판정, 필수값 검증, 중복 검사 등] | URS-F-0XX |

## 3.4 전자기록 데이터 관리 / Electronic Records & Data Management

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-0XX | [저장, 잠금, 무효 처리, 수정 사유, 보존] | URS-F-0XX |

## 3.5 감사추적 / Audit Trail

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-0XX | [기록 대상 행위, 기록 항목, 조회와 출력] | URS-F-0XX |

## 3.6 전자서명 / Electronic Signatures

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-0XX | [서명 시점, 비밀번호 재입력, 서명 항목(서명자, 일시, 의미)과 표시] | URS-F-0XX |

## 3.7 인터페이스 및 통신 / Interfaces & Communication

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-0XX | [구글 시트 API 연동 방식, 클라이언트와 서버 사이 API] | URS-T-0XX |

## 3.8 오류처리 및 무결성 통제 / Error Handling & Data Integrity Controls

| No. | FS ID | 기능 규격 / Functional Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | FS-0XX | [차단 규칙과 안내 문구 원문, 권한 없는 접근 처리, 시각 기준] | URS-F-0XX |

# 4. 설계 규격 / Design Specification

본 장은 기능 규격이 어떻게 구현되는지를 기술하며, 설치 및 운전 적격성평가(IOQ)의 설치 확인 기준으로 활용된다.

## 4.1 구성 / Configuration

| No. | DS ID | 설계 규격 / Design Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | DS-001 | [역할별 권한 구성. URS §6.3 매트릭스대로 화면과 기능별 허용 역할] | URS-F-0XX |
| 2 | DS-002 | [애플리케이션과 운영 환경: Next.js(App Router) 버전, Node 버전, Vercel 배포, 환경 변수 이름 3종(값은 기재하지 않음)] | URS-T-0XX |
| 3 | DS-003 | [API 라우트 목록과 역할 검사 위치] | URS-F-0XX |

## 4.2 데이터 설계 / Data Design

[구글 시트 한 파일 안의 탭 구성을 쓴다. 탭마다 DS 행 하나. 규격 칸에 컬럼명을 순서대로 나열한다.]

| No. | DS ID | 설계 규격 / Design Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | DS-0XX | USERS 탭: id, user_id, name, password, role, status, created_at | URS-F-0XX |
| 2 | DS-0XX | AUDIT 탭: id, category, actor_id, actor_name, role, action, target, before_value, after_value, reason, timestamp_kst | URS-F-0XX |

## 4.3 소스코드 통제 / Source Code Control

| No. | DS ID | 설계 규격 / Design Specification | 관련 URS / URS Ref. |
|---|---|---|---|
| 1 | DS-0XX | 소스코드는 GitHub 저장소 [GAMPLABRND/team0N] 의 main 브랜치에서 관리되며, IOQ 대상 버전은 태그 [v1.0] 으로 식별된다. | URS-L-0XX |
| 2 | DS-0XX | 변경은 커밋 단위로 기록되며 커밋 메시지에 관련 URS 조항 ID 를 병기한다. 데이터 접근 규격 코드(lib/sheets.ts)는 해시 확인(check:sheets)으로 변경을 통제한다. | URS-L-0XX |

# 5. 데이터 / Data

본 시스템에서 생성, 관리되는 데이터는 3.4절 전자기록 데이터 관리에서 정의한 전자기록 분류를 따른다.

[전자기록의 분류(기준정보, 업무 기록, 감사추적, 계정)와 보존 방법(행 삭제 없음, 상태 변경과 무효 처리, 구글 시트 보존)을 3~5문장으로 쓴다.]

# 6. 용어 정의 / Acronyms, Abbreviations, and Definitions

| 약어 / Term | 정의 / Definition |
|---|---|
| API | Application Programming Interface |
| Audit Trail | 감사추적 |
| CSV | Computerized System Validation |
| FDS | Functional Design Specification, 기능 및 설계 규격서 |
| IOQ | Installation and Operational Qualification |
| URS | User Requirements Specification, 사용자 요구사항 규격서 |
