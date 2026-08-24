# 05 Harness-codex v3 재설계 기록

## 1. 기준과 목표

기준 폴더는 `05 Harness-codex v2`입니다. v2의 교육 운영, URS 해석, 앱 스캐폴드, 디자인, Google Sheets 규격, FDS와 CSV 문서, 보안, 사람 중심 배포 의도를 모두 유지하였습니다.

재설계 목표는 Codex가 다음을 안정적으로 수행하게 하는 것입니다.

- 루트 지시를 빠짐없이 읽습니다.
- 현재 동시 슬롯 수에 맞춰 역할을 실행합니다.
- 서브에이전트 프롬프트를 임의로 요약하지 않아 세부 규칙을 잃지 않습니다.
- 역할별 모델과 추론 강도를 명시하여 조별 실행 차이를 줄입니다.
- 세션이 바뀌어도 마지막 상태에서 재개합니다.
- 구현 가능한 URS 조항이 남은 상태를 완료라고 보고하지 않습니다.
- 코드 구현과 외부 환경 검증을 구분합니다.

Codex의 공식 `AGENTS.md` 탐색 규칙은 루트에서 현재 작업 디렉터리까지 지시를 합치며 기본 프로젝트 지시 크기 제한을 적용합니다. v3는 루트 파일을 실행 계약으로 줄이고 상세 규칙을 필요한 모드에서 읽도록 분리하였습니다.

공식 문서: <https://developers.openai.com/codex/agent-configuration/agents-md>, <https://learn.chatgpt.com/docs/agent-configuration/subagents>

## 2. 확인한 v2 적용 문제와 v3 대응

| v2 적용 문제 | 영향 | v3 대응 |
|---|---|---|
| 약 25KB의 단일 AGENTS.md | Next.js 규칙이 추가되면 하단 FDS와 완료 규칙이 지시 한도에 가까워짐 | 루트 계약과 `harness/` 플레이북 분리, 구조 검사에서 20KiB 상한 적용 |
| `codex --full-auto` 실행 예시 | Codex CLI 0.149.0에서 인식되지 않음 | `codex -C . -s workspace-write -a never`로 갱신 |
| 구현 서브에이전트 4개 동시 고정 | 부모를 포함한 실제 동시 슬롯이 부족하면 실행 실패 또는 조기 수거 | 슬롯 수에 따라 4개, 3+1, 2+2, 순차 웨이브 사용 |
| 역할 정의 전문을 사람이 프롬프트에 넣는 규칙 | 누락, 요약, 기술 규칙 유실 가능 | `.codex/agents/*.toml` 네이티브 역할 등록, `agent:prompt`는 폴백 |
| 부모 모델과 추론 강도 상속 | 조별 세션 선택에 따라 분석과 구현 품질이 달라질 수 있음 | 오케스트레이터와 Builder Sol/high, Analyzer Terra/xhigh, 비판단성 보조만 Terra/low로 고정하고 Luna 제외 |
| 수동 IMPLEMENTED 표 | 조항 누락과 근거 없는 PASS 가능 | `URS_STATUS.json` 정본, 자동 추적성, 증거, gaps 생성 |
| 상태 수정 뒤 오래된 보고서 사용 | 중앙 상태와 사람이 읽는 문서가 달라도 놓칠 수 있음 | 네 파생 문서에 상태 지문을 넣고 최종 게이트에서 재계산 |
| STEP 시간 초과 시 범위 축소 | 구현 가능한 조항이 남아도 완료 보고 가능 | 60분을 목표로만 사용, 최종 게이트는 전 기능 조항 구현 요구 |
| 빌드 중심 완료 | 실제 저장, 역할 흐름, Sheets 동기화가 증명되지 않음 | 조항별 파일, 인터페이스, 증거와 실제 환경 스모크를 분리 |
| 중간 세션 종료 | 처음부터 재분석하거나 미완료 상태를 잃음 | `RUN_STATE.json`, `URS_STATUS.json`, 역할 완료 원장으로 재개 |

## 3. v2 의도 보존 매트릭스

| ID | v2 의도 | v3 위치 | 결과 |
|---|---|---|---|
| V2-01 | URS Section 2, 6, 7.1 기반의 범용 구축 | `AGENTS.md`, `harness/WORKFLOW.md` | 보존 |
| V2-02 | 전자로그북, 세척밸리데이션, 실험실 재고관리 3종 | `README.md`, 역할 정의 | 보존 |
| V2-03 | Next.js, TypeScript, Tailwind, Sheets, Vercel | 앱 스캐폴드, `package.json`, `lib/sheets.ts` | 원본 보존 |
| V2-04 | KPBMA CI와 교육 포털 디자인 | `design.md`, `components/ui.tsx`, `public/` | 원본 보존 |
| V2-05 | 표 열 폭, 말줄임, 상세 Modal, overflow 안전망 | `design.md`, `components/ui.tsx`, 품질 게이트 | 원본 보존, 게이트 강화 |
| V2-06 | URS 역할, 계정, 메뉴, 권한 | analyzer-a, builder-d1, PLAN 계약 | 보존 |
| V2-07 | 초기 비밀번호 1234와 로그인 순서 | `AGENTS.md`, `app/login`, `lib/brand.ts` | 보존 |
| V2-08 | `CSV실습과정 N조 시스템명` 제목 | `AGENTS.md`, `lib/brand.ts` | 보존 |
| V2-09 | 7.1 전 조항 대상과 미구현 사유 | 중앙 상태, 추적성, gaps, 최종 감사 | 강화 |
| V2-10 | 60분 원샷 빌드 | `harness/WORKFLOW.md` 시간표 | 보존, 중단 기준과 분리 |
| V2-11 | 분석 3역할, 구현 4역할 | `.codex/agents/`, `harness/ORCHESTRATION.md`, `agents/` | 보존, Codex 네이티브 슬롯 인식형과 명시적 모델 라우팅으로 전환 |
| V2-12 | 조기 수거 금지와 순차 폴백 | 오케스트레이션, 공통 역할 계약 | 강화 |
| V2-13 | LF, UTF-8과 Windows 패치 안정성 | `.gitattributes`, `.editorconfig` | 보존 |
| V2-14 | `lib/sheets.ts` 수정 금지와 복원 | `SHEETS_SPEC`, `check:sheets` | 원본 보존 |
| V2-15 | 서버 권한, 계산, 차단, 상태, 감사추적 | AGENTS 기술 규칙, D1부터 D4 | 보존 |
| V2-16 | 한국어 보고체, 표준 용어, 조항 ID | AGENTS, 산출물 계약 | 보존 |
| V2-17 | 개발 서버 QA 수정 루프 | WORKFLOW QA 절, CHANGELOG | 보존 |
| V2-18 | 현재 상태 기반 FDS와 Word 자동 생성 | FDS Guide, Template, build-fds | 원본 보존 |
| V2-19 | DQ, IOQ, RTM 초안 | `docs/DRAFTS.md`, 전체 실습 가이드 | 보존 |
| V2-20 | 사람이 push, v1.0 고정본 IOQ | AGENTS 릴리스 경계, RUNBOOK | 보존 |
| V2-21 | 비밀과 커밋 대상 점검 | `.gitignore`, `check-commit` | 원본 보존 |
| V2-22 | 비밀, URS, 이전 산출물 없는 프로젝트 복제 | `new-project.mjs` | 보존, v3 상태 폴더 추가 |
| V2-23 | 강사용 준비와 당일 운영 | SETUP, RUNBOOK | 보존, 현재 Codex와 운영 전제 반영 |
| V2-24 | 구현 상태와 환경 검증 상태 분리 | QUALITY_GATES, OUTPUT_CONTRACTS | 신규 명문화 |
| V3-01 | 역할별 모델과 추론 강도 고정 | `.codex/config.toml`, `.codex/agents/`, 모델 라우팅 게이트 | 신규 명문화 |

기계 판독 정본은 `harness/intent-manifest.json`입니다. `npm.cmd run check:harness`가 모든 의도 ID의 근거 파일 존재를 확인합니다.

## 4. 변경하지 않은 핵심 자산

다음 자산은 v2를 그대로 복제하여 기능 의도를 보존하였습니다.

- Next.js 앱 골든 스캐폴드
- Google Sheets 인증, 세션, 감사추적, KST 헬퍼
- 계정 선택 로그인 화면
- KPBMA CI 이미지와 파비콘
- 공용 UI와 표, 상세, 인쇄 부품
- design.md의 화면과 인쇄 규격
- URS DOCX의 HTML, Markdown 변환 알고리즘
- Sheets 규격, 체크섬과 복원 스크립트
- FDS 고정 템플릿, 검증기, Word 생성기

`convert-urs.mjs`는 준비된 Markdown을 의존성 설치 전에도 인벤토리할 수 있도록 Mammoth 로딩 시점만 늦췄습니다. `check-commit.mjs`는 v3 상태와 증거 산출물의 커밋 범위를 검사하도록 확장했고, `new-project.mjs`는 `.codex` 역할 설정은 복사하면서 이전 URS, 상태, 역할 원장과 생성 FDS는 제외하도록 변경했습니다.

## 5. 새 기계적 완료 증거

v3는 다음 정본과 파생 문서를 추가합니다.

```text
docs/urs/*.md
  -> harness/state/URS_STATUS.json
  -> SPEC_A/B/C + PLAN
  -> app and api implementation
  -> harness/runs/*.json
  -> IMPLEMENTED.md
  -> docs/generated/URS_TRACEABILITY.md
  -> docs/generated/URS_EVIDENCE.md
  -> docs/generated/URS_GAPS.md
  -> check:harness --final
```

이 구조는 조항 존재, 분석 소유자, 구현 소유자, 구현 파일, 화면 또는 API, 실행 증거, 환경 검증 대기를 분리합니다.

## 6. 완료 경계

v3가 템플릿으로 정상이라는 사실은 특정 URS 앱의 구현 완료를 의미하지 않습니다. 다음 세 경계를 구분합니다.

1. 템플릿 구조 검증: v3 파일, 역할, 스크립트, v2 의도 근거가 존재합니다.
2. 조별 앱 구현 검증: 조별 URS 전 기능 조항과 코드 증거, lint, build가 통과합니다.
3. 외부 환경 검증: 실제 Sheets, 역할별 브라우저 흐름, Vercel 배포 URL을 확인합니다.

외부 환경이 없으면 2번까지 완료한 뒤 `COMPLETE_WITH_ENV_VALIDATION_REQUIRED`로 보고합니다.
