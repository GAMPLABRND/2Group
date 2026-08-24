# Codex 시작 가이드, 여기서 시작합니다

## 1. 준비

이 하네스를 조별 프로젝트로 복제한 뒤 조별 GAMPLAB 제공 개발 환경에서 다음을 확인합니다.

```powershell
node --version
npm.cmd --version
codex --version
npm.cmd install
npm.cmd run check:harness
npm.cmd run build
```

수강생 개인 노트북에는 개발 환경을 설치하지 않습니다. 수강생은 Chrome으로 조별 시스템을 확인하고 Word로 CSV 문서를 작성합니다. Codex, Node.js, Git, Google Sheets 서비스 계정과 Vercel 환경은 GAMPLAB 제공 조별 개발 환경에 준비합니다.

## 2. Codex에서 폴더 열기

Codex 앱에서는 `team01` 같은 조별 프로젝트 폴더를 작업 폴더로 엽니다. 루트에 `AGENTS.md`, `.codex/config.toml`, `.codex/agents/`가 보이는지 확인합니다. 프로젝트 설정은 오케스트레이터와 Builder를 Sol/high, Analyzer를 Terra/xhigh로 고정합니다. 이름 없는 보조 서브에이전트는 Terra/low지만 단순 파일 정리와 기계적 반복 점검에만 사용하며 Luna는 사용하지 않습니다. 권한과 sandbox는 부모 세션을 상속합니다.

교육 전날 해당 Codex 계정에 Sol, Terra와 Terra의 xhigh가 보이는지 확인합니다. 모델 접근성은 `check:harness`가 검증할 수 없는 계정 환경 항목입니다.

CLI를 사용할 때는 조별 폴더에서 다음 명령을 사용할 수 있습니다.

```powershell
codex -C . -s workspace-write -a never
```

Codex CLI 0.149.0 기준으로 `--full-auto`는 지원되지 않습니다. 위험한 sandbox 우회 옵션은 사용하지 않습니다. 외부 연결이 제한되면 Sheets 스모크를 환경 검증 대기로 남깁니다.

## 3. URS 넣기

조별 확정 URS `.docx`를 `docs/urs/`에 넣습니다. 임시 Word 잠금 파일인 `~$...docx`는 넣지 않습니다.

URS 표의 첫 열에 `URS-F-001` 같은 조항 ID가 텍스트로 있어야 합니다. Word 자동 번호만 있으면 Markdown 변환 후 ID가 사라질 수 있습니다.

## 4. 한 문장으로 시작

Codex에 다음 문장을 입력합니다.

```text
하네스 절차대로 URS MVP 빌드를 시작해.
```

Codex는 다음을 자동으로 수행합니다.

1. URS Word를 Markdown으로 변환합니다.
2. 모든 조항을 `harness/state/URS_STATUS.json`에 등록합니다.
3. 분석 3역할로 SPEC_A, SPEC_B, SPEC_C를 만듭니다.
4. PLAN과 공통 시트, 역할, 계정, 메뉴를 확정합니다.
5. 구현 4역할로 앱을 만듭니다.
6. 조항별 코드와 증거를 대조합니다.
7. lint, build, 하네스 최종 게이트를 실행합니다.
8. 환경이 있으면 seed, 로그인, 저장, 재조회, 감사추적 스모크를 수행합니다.

## 5. 중간에 세션이 끊겼을 때

새 Codex 세션에서 같은 조별 폴더를 열고 다음처럼 입력합니다.

```text
하네스 상태 파일을 읽고 마지막 미완료 단계부터 계속해. 구현 가능한 요구사항이 남아 있으면 최종 게이트까지 진행해.
```

Codex는 `RUN_STATE.json`, `URS_STATUS.json`, PLAN, SPEC, 역할 완료 파일을 읽고 재개합니다. 처음부터 다시 분석하지 않습니다.

## 6. 1일차 QA

개발 서버를 확인합니다.

```powershell
npm.cmd run dev
```

기본 URL은 `http://localhost:3000`입니다. env가 있으면 먼저 `http://localhost:3000/api/seed`를 호출합니다. 로그인 화면에서 계정을 고르면 아이디와 초기 비밀번호 1234가 채워집니다.

수정 요청은 한 번에 하나씩 보냅니다.

```text
수정 요청: 검토자 계정으로 승인 대기 화면에 직접 접속하면 404가 나와. 역할 메뉴와 직접 URL 흐름 전체를 확인해서 고쳐줘.
```

## 7. 2일차 FDS와 배포 준비

QA가 끝나면 다음 순서로 진행합니다.

```text
FDS를 작성해줘.
```

```text
커밋 준비해.
```

AI는 커밋과 `v1.0` 태그까지만 준비합니다. 조원 또는 조교가 직접 다음 명령을 실행합니다.

```powershell
git push origin main --tags
```

Vercel 배포가 끝난 실제 URL이 IOQ 시험 대상입니다.

## 8. 완료 판정 읽기

- `COMPLETE`: 코드와 실제 연결 환경 스모크까지 통과하였습니다.
- `COMPLETE_WITH_ENV_VALIDATION_REQUIRED`: 코드와 조항 증거는 완료되었으나 Sheets, 브라우저 또는 배포 검증이 남았습니다.
- `INCOMPLETE`: 구현 가능한 조항이나 필수 코드 게이트가 남았습니다.

빌드 성공 한 줄만으로 완료를 판단하지 않습니다. `IMPLEMENTED.md`, `docs/generated/URS_TRACEABILITY.md`, `URS_EVIDENCE.md`, `URS_GAPS.md`를 함께 확인합니다.
