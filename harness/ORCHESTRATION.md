# Codex 멀티에이전트 오케스트레이션

## 1. 원칙

v3는 분석 3역할과 구현 4역할이라는 v2의 분업 의도를 유지한다. Codex가 실제로 제공하는 동시 슬롯 수에 맞춰 실행 웨이브만 조정한다. 서브에이전트가 없는 환경에서는 같은 역할을 오케스트레이터가 순차 수행한다.

프로젝트 범위 사용자 정의 역할은 `.codex/agents/*.toml`에 등록되어 있다. 각 TOML은 대응하는 `agents/*.md` 역할 전문과 공통 계약을 반드시 읽게 한다. 교육 실행의 재현성을 위해 모델과 추론 강도도 역할 파일에 명시한다.

| 실행 범위 | 모델 | 추론 강도 | 허용 작업 |
|---|---|---|---|
| 오케스트레이터 | `gpt-5.6-sol` | `high` | 통합, 공유 파일, 상태 관리, 최종 판정 |
| analyzer-a부터 c | `gpt-5.6-terra` | `xhigh` | URS 해석, SPEC 작성, 누락과 모순 분석 |
| builder-d1부터 d4 | `gpt-5.6-sol` | `high` | 코드 구현, 자체 점검, 역할 완료 보고 |
| 이름 없는 보조 서브에이전트 | `gpt-5.6-terra` | `low` | 비판단성 파일 정리와 기계적 반복 점검만 허용 |

보조 기본값은 핵심 7역할의 폴백이 아니다. URS 해석, 코드 작성이나 검토, GxP 또는 CSV 문서 내용, 중앙 상태와 최종 게이트에는 사용하지 않는다. Luna 계열 모델은 사용하지 않는다. 핵심 역할이 지정 모델로 시작되지 않으면 오케스트레이터가 Sol/high로 같은 역할을 순차 수행하고 예외를 `DECISIONS.md`에 기록한다.

`.codex/config.toml`의 `max_concurrent_threads_per_session = 7`은 분석 3역할과 구현 4역할의 열린 스레드를 보존하기 위한 상한이다. 동시에 실행할 역할 수를 뜻하지 않는다. 실제 실행 웨이브는 현재 클라이언트가 제공하는 활성 슬롯 수에 맞춘다.

## 2. 역할과 산출물

| 역할 | 입력 | 쓰기 범위 | 완료 표시 |
|---|---|---|---|
| analyzer-a | URS §2, §6, 배정 7.1, 계정 | `SPEC_A.md` | `harness/runs/analyzer-a.json` |
| analyzer-b | URS §6.2, 배정 7.1 | `SPEC_B.md` | `harness/runs/analyzer-b.json` |
| analyzer-c | 배정 7.1, §7.2부터 §7.8 | `SPEC_C.md` | `harness/runs/analyzer-c.json` |
| builder-d1 | PLAN, SPEC_A, design | D1 소유 앱과 API | `harness/runs/builder-d1.json` |
| builder-d2 | PLAN, SPEC_B, design | D2 소유 앱과 API | `harness/runs/builder-d2.json` |
| builder-d3 | PLAN, SPEC_B, design | D3 소유 앱과 API | `harness/runs/builder-d3.json` |
| builder-d4 | PLAN, SPEC_C, design | D4 소유 앱과 API, README | `harness/runs/builder-d4.json` |

중앙 상태와 공유 파일은 오케스트레이터만 쓴다.

## 3. Codex 네이티브 역할과 폴백 프롬프트

우선 다음 사용자 정의 역할을 선택하여 서브에이전트를 만든다.

| 실행 역할 ID | Codex 사용자 정의 역할 | 모델과 추론 | 설정 파일 |
|---|---|---|---|
| analyzer-a | `analyzer_a` | Terra/xhigh | `.codex/agents/analyzer-a.toml` |
| analyzer-b | `analyzer_b` | Terra/xhigh | `.codex/agents/analyzer-b.toml` |
| analyzer-c | `analyzer_c` | Terra/xhigh | `.codex/agents/analyzer-c.toml` |
| builder-d1 | `builder_d1` | Sol/high | `.codex/agents/builder-d1.toml` |
| builder-d2 | `builder_d2` | Sol/high | `.codex/agents/builder-d2.toml` |
| builder-d3 | `builder_d3` | Sol/high | `.codex/agents/builder-d3.toml` |
| builder-d4 | `builder_d4` | Sol/high | `.codex/agents/builder-d4.toml` |

작업 메시지에는 담당 조항 또는 PLAN 범위, 허용 파일, 완료 JSON 경로를 명시한다. 여러 역할을 시작했으면 모두 완료될 때까지 기다린 뒤 통합한다.

프로젝트 사용자 정의 역할을 선택할 수 없는 클라이언트에서만 다음 명령의 표준 출력을 일반 서브에이전트 작업 메시지로 사용한다.

```powershell
npm.cmd run agent:prompt -- --role analyzer-a --assignment "담당 소절: 7.1.1, 7.1.4"
npm.cmd run agent:prompt -- --role builder-d1 --assignment "PLAN.md 소유권 표와 SPEC_A.md 전체"
```

폴백 명령은 다음 세 부분을 결합한다.

1. 실행별 assignment
2. `harness/SUBAGENT_CONTRACT.md` 공통 계약
3. `agents/<role>.md` 역할 전문

오케스트레이터가 역할 파일을 요약하거나 기술 규칙을 생략하지 않는다.

## 4. 슬롯 인식 실행 웨이브

### 분석

- 자식 슬롯 3개 이상: analyzer-a, analyzer-b, analyzer-c 동시 실행
- 자식 슬롯 2개: A와 B 동시, 완료 후 C
- 자식 슬롯 1개 또는 멀티에이전트 없음: A, B, C 순차

### 구현

- 자식 슬롯 4개 이상: D1, D2, D3, D4 동시 실행
- 자식 슬롯 3개: D1, D2, D3 동시 실행, 통합 확인 후 D4 실행
- 자식 슬롯 2개: D1과 D2, 이후 D3과 D4
- 자식 슬롯 1개 또는 멀티에이전트 없음: D1, D2, D3, D4 순차

D4는 대시보드와 시드가 통합 스키마에 의존하므로 두 번째 웨이브로 이동해도 역할 의도가 손상되지 않는다.

## 5. 실행 생명주기

1. 역할을 시작하기 전에 대상 완료 파일이 과거 실행의 것인지 확인한다. URS가 바뀌었으면 이전 완료 파일을 근거로 재사용하지 않는다.
2. 역할별 작업 메시지에 담당 조항 또는 PLAN과 SPEC 경로를 명시한다.
3. 각 역할은 자기 소유 파일만 수정한다.
4. 진행 중인 역할을 시간 예산 때문에 중단하지 않는다.
5. 역할이 `complete` 또는 구체적인 `blocked` 완료 파일을 쓸 때까지 기다린다.
6. 오케스트레이터는 완료 파일, 실제 diff, 조항 ID를 대조한다.
7. 공유 파일 변경 요청은 오케스트레이터가 통합 단계에서 반영한다.
8. 모든 역할이 끝난 뒤 중앙 상태를 한 번에 갱신한다.

## 6. 역할 완료 파일

각 서브에이전트는 마지막 파일 작업으로 자기 JSON 하나만 작성한다.

```json
{
  "schema_version": 1,
  "role": "builder-d2",
  "status": "complete",
  "assignment": "PLAN.md 소유권 표와 SPEC_B.md 전체",
  "files_created": ["app/records/page.tsx"],
  "files_modified": ["app/api/records/route.ts"],
  "clauses_covered": ["URS-F-021"],
  "clauses_unresolved": [],
  "shared_change_requests": [],
  "checks_run": [
    {"command": "npx tsc --noEmit", "result": "pass"}
  ],
  "blocker": null
}
```

`status`는 `complete` 또는 `blocked`다. 파일 일부를 만들었다는 이유로 `complete`를 쓰지 않는다. `blocked`에는 원인, 영향 조항, 오케스트레이터가 할 수 있는 다음 조치를 적는다.

## 7. 충돌 예방

- 분석 역할은 각각 다른 SPEC 하나만 쓴다.
- 구현 역할은 PLAN 소유권 표에 없는 파일을 수정하지 않는다.
- 공유 타입, 브랜드, 메뉴, 공용 UI, 패키지, 중앙 상태는 오케스트레이터 전용이다.
- 두 역할이 같은 라우트나 API가 필요하면 PLAN에서 한 역할을 소유자로 정하고 다른 역할은 `shared_change_requests`로 요청한다.
- 서브에이전트는 커밋, 태그, push를 하지 않는다.
- 서브에이전트는 추가 하위 에이전트를 만들지 않는다.
- apply_patch 컨텍스트가 한 번 실패하면 최신 파일을 다시 읽고 더 작은 패치로 적용한다. 전체 파일 재작성은 해당 역할이 파일 전체를 소유할 때만 허용한다.

## 8. 조기 종료 방지

다음은 역할 완료가 아니다.

- 구현 계획만 보고함
- 핵심 화면 한 개만 만들고 나머지를 다음 작업으로 넘김
- build가 통과했지만 담당 조항의 상태 전이나 차단이 없음
- 공유 파일이 필요하다는 이유만으로 담당 파일 구현도 멈춤
- 시간 예산을 이유로 남은 조항을 미구현 처리함

오케스트레이터는 구현 가능한 항목을 직접 이어서 처리하고 최종 게이트를 통과하기 전에는 완료 답변을 내지 않는다.
