# 하네스 v3 산출물 계약

## 1. 정본과 파생 문서

| 파일 | 성격 | 작성자 |
|---|---|---|
| `docs/urs/*.docx` | 사용자 제공 원본 | 사람 |
| `docs/urs/*.md` | 변환본 | `convert-urs.mjs` |
| `harness/state/URS_STATUS.json` | 조항 상태와 증거 정본 | 오케스트레이터 |
| `harness/state/RUN_STATE.json` | 현재 단계와 환경 검증 상태 | 오케스트레이터 |
| `SPEC_A.md`, `SPEC_B.md`, `SPEC_C.md` | 구현 스펙 | analyzer 역할 |
| `PLAN.md` | 통합 설계와 소유권 | 오케스트레이터 |
| `DECISIONS.md` | 기본값과 변경 결정 | 오케스트레이터 |
| `CHANGELOG.md` | 변경 이력 | 오케스트레이터 |
| `IMPLEMENTED.md` | 상태 요약 | `harness:sync` |
| `docs/generated/*` | 추적성, 증거, gaps | `harness:sync` |
| `harness/runs/*.json` | 역할 수행 원장 | 각 역할 |

파생 문서를 직접 고쳐 중앙 상태와 다르게 만들지 않는다. 조항 상태를 바꾼 뒤 `npm.cmd run harness:sync`를 실행한다.

네 파생 문서에는 기능 조항 상태와 환경 검증 상태로 계산한 동일한 SHA-256 `상태 지문`이 들어간다. 최종 게이트는 이 지문을 다시 계산하여 오래된 IMPLEMENTED, 추적성, 증거 또는 gaps 문서를 차단한다.

## 2. URS_STATUS.json 조항 스키마

```json
{
  "id": "URS-F-001",
  "kind": "functional",
  "summary": "요구사항 요약",
  "source_file": "docs/urs/example.md",
  "source_line": 120,
  "analysis_owner": "analyzer-a",
  "implementation_owner": "builder-d1",
  "status": "implemented",
  "interfaces": ["/admin/equipment", "POST /api/master/equipment"],
  "files": ["app/admin/equipment/page.tsx"],
  "evidence": [
    {
      "kind": "source",
      "ref": "app/api/master/equipment/route.ts",
      "result": "server validates required fields and appends AUDIT"
    }
  ],
  "blocker": null,
  "notes": ""
}
```

허용 상태는 `pending`, `in_progress`, `implemented`, `partial`, `not_implemented`다. 최종 게이트는 기능 조항의 `implemented`만 허용한다.

`harness:init`을 다시 실행했을 때 같은 조항 ID의 요구 문구나 종류가 바뀌면 상태, 파일, 인터페이스, 증거를 `pending` 기준으로 초기화하고 `notes`에 변경 사실을 남긴다. ID만 같다는 이유로 과거 구현 증거를 재사용하지 않는다.

증거 종류:

- `source`: 구현 파일과 동작 설명
- `lint`: lint 또는 타입 검사 결과
- `build`: 빌드 결과
- `smoke`: 실제 API, Sheets, 브라우저 흐름 결과
- `manual_review`: 화면, 권한, 인쇄 또는 문서 검토
- `environment_pending`: 실행하지 못한 외부 환경 검증과 이유

`environment_pending`만으로 기능 구현을 증명할 수 없다. source 증거가 먼저 있어야 한다.

## 3. PLAN.md 필수 표

### 역할과 계정

| 계정 ID | 이름 | 역할 코드 | 역할명 | 초기 비밀번호 | URS |
|---|---|---|---|---|---|

### 시트 스키마

| 탭 | 헤더 | 쓰는 흐름 | 소유 역할 | URS |
|---|---|---|---|---|

### 메뉴와 권한

| 메뉴 | 경로 | 허용 역할 | 기능 | URS |
|---|---|---|---|---|

### 파일 소유권

| 역할 | 생성 또는 수정 경로 | 금지 경로 | 의존 입력 |
|---|---|---|---|

## 4. DECISIONS.md

| 번호 | 결정 | 근거 | 영향 파일 | 날짜 |
|---|---|---|---|---|

URS 근거가 없는 항목은 근거에 `URS 근거 없음, 기본값`을 적는다. 사용자 요청으로 URS 밖 기능을 추가하면 `URS 개정 대상`을 함께 적는다.

## 5. CHANGELOG.md

| 일시 (KST) | 분류 | 요청 요약 | 변경 파일 | 관련 조항 ID |
|---|---|---|---|---|

분류는 원샷 빌드, 결함 수정, 개선, URS 외 요청, FDS, 릴리스 준비 중 하나다.

## 6. 완료 보고 최소 내용

1. 실행 방법과 로컬 URL
2. URS 계정표와 초기 비밀번호 변경 안내
3. 기능 조항 총수, 구현 수, 부분 수, 미구현 수
4. 시트 탭 구성
5. 구현 범위
6. 남은 범위와 조항별 사유
7. 하네스 게이트 결과
8. 실제 환경 검증 결과와 실행하지 않은 항목
9. 산출물 위치
10. 다음 사람의 작업

앱 코드, 하네스 감사, 외부 환경 검증을 한 문장으로 합쳐 완료라고 표현하지 않는다.
