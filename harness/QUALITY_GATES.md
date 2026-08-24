# 하네스 v3 품질 게이트

## 1. 판정 상태

| 상태 | 의미 |
|---|---|
| `COMPLETE` | 모든 기능 조항이 구현되고 코드 게이트와 실제 로컬 또는 연결 환경 스모크가 통과함 |
| `COMPLETE_WITH_ENV_VALIDATION_REQUIRED` | 모든 기능 조항의 코드와 정적 증거는 완료되었으나 외부 Sheets, 브라우저 또는 배포 환경 검증이 실행되지 않음 |
| `INCOMPLETE` | 구현 가능한 기능 조항이 남았거나 필수 코드 게이트가 실패함 |

부분 구현과 미구현 조항이 하나라도 있으면 이유를 기록했더라도 `COMPLETE`로 바꾸지 않는다. 환경 검증 대기는 조항 상태가 아니라 검증 상태로 관리한다.

## 2. G0, 템플릿 무결성

`npm.cmd run check:harness`가 다음을 확인한다.

- 루트 AGENTS.md가 Codex 기본 지시 크기 제한보다 충분히 작음
- v3 플레이북, 7개 역할, 상태와 증거 스크립트가 모두 존재함
- `.codex/agents/`의 7개 Codex 사용자 정의 역할과 동시 실행 설정이 유효함
- 오케스트레이터와 Builder는 Sol/high, Analyzer는 Terra/xhigh, 보조 기본값은 Terra/low로 고정되며 TOML 설정에 Luna가 없음
- `package.json`에 v3 명령이 있음
- `codex --full-auto` 같은 폐기된 시작 예시가 남아 있지 않음
- `CLAUDE.md`가 Codex 기준 파일인 것처럼 지시하지 않음
- v2 의도 매니페스트의 모든 근거 파일이 존재함
- `lib/sheets.ts` 규격 검사가 통과함

템플릿에는 URS가 없으므로 기본 검사는 구조만 판정한다.

## 3. G1, URS 인벤토리

- 기능 조항 ID가 1개 이상임
- ID 중복이 없음
- 원본 Markdown에서 탐지한 기능 ID와 `URS_STATUS.json`이 일치함
- 모든 기능 ID에 summary, source_file, source_line이 있음
- 모든 기능 ID에 분석 역할과 구현 역할이 배정됨

기능 ID가 누락되면 구현을 시작하지 않는다. 자동 번호 변환 문제를 먼저 해결한다.

## 4. G2, 분석 완전성

- `SPEC_A.md`, `SPEC_B.md`, `SPEC_C.md`가 존재함
- 모든 기능 조항 ID가 적어도 하나의 SPEC에 있음
- 역할, 화면, 필드, 상태, 계산, 차단, 감사추적, 시드 중 해당 요구의 구현 정보가 있음
- 각 analyzer 완료 파일의 스키마, 보고 파일, 담당 조항이 실제 산출물과 맞음

요약만 있고 필드나 상태가 빠진 SPEC은 통과하지 않는다.

## 5. G3, 설계와 소유권

- `PLAN.md`에 시트 탭과 헤더, 역할과 계정, 메뉴, 권한, 상태 머신, 파일 소유권이 있음
- 공유 파일과 역할 파일의 소유권이 겹치지 않음
- 모든 기능 조항의 구현 역할이 확정됨
- 역할과 계정이 URS와 일치함
- `lib/brand.ts` 제목 형식과 초기 비밀번호가 고정 규칙에 맞음
- `lib/sheets.ts`가 규격과 일치함

## 6. G4, 조항별 구현 증거

최종 모드의 각 기능 조항은 다음을 만족해야 한다.

1. 상태가 `implemented`임
2. `files`에 실제 존재하는 파일이 적어도 하나 있음
3. `interfaces`에 화면, API 또는 사용자 흐름이 적어도 하나 있음
4. `evidence`에 source, build, smoke, manual_review 중 적어도 하나의 실제 근거가 있음
5. `summary`와 구현 경로가 서로 모순되지 않음

최종 게이트는 각 기능 조항에 실제 존재하는 `source` 증거 파일을 반드시 요구한다. lint나 환경 대기 기록만으로는 구현 증거를 대체할 수 없다.

규칙 함수 하나나 타입 선언만으로 UI 요구를 PASS 처리하지 않는다. 가능한 증거 흐름은 다음과 같다.

```text
화면 렌더 -> 사용자 조작 -> API 핸들러 -> 서버 업무 규칙 -> Sheets 저장 또는 조회 -> 화면에서 관찰
```

환경을 실행할 수 없으면 마지막 두 구간을 `environment_pending`으로 표시하고 코드 경로 증거를 남긴다.

## 7. G5, 코드와 디자인

- `npm.cmd run lint` 통과
- `npm.cmd run build` 통과
- `npm.cmd run check:sheets` 통과
- 역할별 import와 경로가 실제 존재함
- 변경성 API의 권한 검사와 감사추적이 있음
- 계산, 판정, 차단과 상태 전이가 서버에서 검사됨
- 표 overflow 안전망과 상세 Modal 규격이 유지됨
- 로그인 계정 선택, 아이디, 비밀번호 흐름이 유지됨

빌드만 통과하고 조항별 증거가 없으면 G4 실패다.

## 8. G6, 실제 환경 스모크

환경이 준비되어 있으면 실제 반환 ID를 사용해 다음을 확인한다.

- seed가 멱등으로 성공함
- URS 계정으로 로그인함
- 역할별 메뉴와 직접 URL 접근 통제가 맞음
- 기준정보 또는 핵심 기록 저장 후 다른 세션이나 재조회에서 보임
- 대표 정상 흐름 하나가 상태 전이를 완료함
- 대표 비정상 조건 하나가 서버에서 차단됨
- AUDIT에 행위자, 전후 값, 사유, KST 시각이 남음

환경이 없으면 `not_run`으로 남긴다. `pass`로 바꾸지 않는다.

## 9. G7, 추적성과 보고

`npm.cmd run harness:sync`가 만든 다음 파일이 중앙 상태와 일치해야 한다.

- `IMPLEMENTED.md`
- `docs/generated/URS_TRACEABILITY.md`
- `docs/generated/URS_EVIDENCE.md`
- `docs/generated/URS_GAPS.md`

최종 보고는 구현, 남은 범위, 하네스 결과, 환경 결과를 분리한다. `docs/generated/URS_GAPS.md`의 기능 gap 절에 부분, 미구현, 진행 또는 대기 조항이 있으면 상태는 `INCOMPLETE`다. 환경 검증 대기만 있으면 구현 완료와 구분하여 보고한다.

## 10. G8, 릴리스와 FDS

릴리스 준비에서만 적용한다.

- `npm.cmd run check:commit` 통과
- 비밀과 빌드 산출물이 커밋 대상에 없음
- SPEC, PLAN, DECISIONS, CHANGELOG, URS, 상태, 추적성과 증거가 함께 포함됨
- `npm.cmd run fds` 오류 0건
- `v1.0` 태그가 IOQ 대상 코드에 붙음
- push는 사람이 수행함

배포 URL에서 수행한 IOQ와 VSR은 하네스 빌드 완료와 별도의 교육생 검증 활동이다.
