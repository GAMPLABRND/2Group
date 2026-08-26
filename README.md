# CSV실습과정 2조 전자로그북

본 애플리케이션은 KPBMA 교육용 URS를 기준으로 구현한 전자로그북 MVP이다. Next.js App Router, TypeScript, Tailwind, Google Sheets, Vercel 구조를 사용한다. 실데이터를 입력하지 않으며 실제 GMP 운영 시스템으로 사용하지 않는다.

버전은 `3.0.0`이다.

## 로컬 실행

Node.js 22 이상과 인터넷에 연결된 교육장 PC가 필요하다. 현재 Chrome 계열 브라우저를 기본 지원하며 인쇄는 Chrome과 Edge에서 확인한다. 배포 환경에서는 교육생이 접근할 수 있는 HTTPS URL이 필요하다. Firefox 인쇄는 용지 방향 차이가 있으므로 필수 출력 검증에 사용하지 않는다. [URS-E-001, URS-T-001, URS-T-003]

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

브라우저에서 `http://localhost:3000/api/seed`를 한 번 호출한 뒤 `http://localhost:3000/login`에서 계정을 선택하여 로그인한다. 최초 시드는 세션 없이 실행할 수 있고, 계정이 생성된 뒤 재실행은 ADMIN 로그인 세션이 필요하다. 시드는 없는 탭과 행만 추가하며 기존 값, 상태, 비밀번호를 덮어쓰거나 행을 삭제하지 않는다. 같은 시드를 다시 실행하면 생성 건수는 0건이며 중복 행과 중복 시드 감사추적을 만들지 않는다. [URS-E-002, URS-E-003, URS-F-009]

초기 비밀번호는 모든 교육 계정에 `1234`를 사용한다. 배포 전에 각 계정으로 로그인하여 비밀번호 변경 화면에서 변경한다.

| 계정 ID | 표시명 | 역할 코드 | 역할명 |
|---|---|---|---|
| `admin` | 관리자 (EDU2-001) | `ADMIN` | 관리자 |
| `user` | 사용자 (EDU2-002) | `TESTER` | 사용자 |
| `reviewer` | 검토자 (EDU2-003) | `APPROVER` | 검토자 |

## Google Sheets 설정

다음 환경 변수를 로컬 `.env.local`과 Vercel 프로젝트 설정에 등록한다. 값은 문서, 화면, 로그와 저장소에 기록하지 않는다.

| 환경 변수 | 용도 |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Cloud 서비스 계정 이메일 |
| `GOOGLE_PRIVATE_KEY` | 서비스 계정 개인키 |
| `GOOGLE_SHEET_ID` | 운영 데이터 스프레드시트 ID |

Google Sheets API와 Google Drive API를 활성화하고 운영 시트를 `GOOGLE_SERVICE_ACCOUNT_EMAIL` 계정에 편집자로 공유한다. Drive API는 운영 Google Spreadsheet를 XLSX로 내보내는 데만 사용하며 시스템 내 Google Drive 경로에 백업 파일을 생성하지 않는다. 브라우저에는 서비스 계정 정보, 시트 ID와 토큰을 전달하지 않는다. [URS-T-002, URS-I-001, URS-C-001, URS 개정 대상]

시드가 생성하는 탭은 다음과 같다. 열 정본은 `lib/schema.ts`이며 기존 탭의 열 이름을 변경하거나 삭제하지 않는다.

| 탭 | 저장 내용 |
|---|---|
| `USERS` | 계정, 역할, 상태, 로그인 보안 정보 |
| `SECURITY_SETTINGS` | 비밀번호, 잠금, 자동 로그아웃 설정 |
| `TRAINING_PROFILE` | 가변 실습자와 소속 회사 배열, 조 정보, 최종 수정 정보 |
| `TRAINING_HISTORY` | 사용자별 교육 완료 이력 |
| `EQUIPMENT` | 장비 기준정보, 독립된 교정 및 적격성평가 대상 여부, 교정 유효기간, 사용과 점유 상태 |
| `USE_RECORDS` | 장비 사용 시작, 종료, 검토, 무효 이력 |
| `EQUIPMENT_REMEDIATIONS` | 이상 발생 조치 이력 |
| `EQUIPMENT_RESUME_REQUESTS` | 사용 재개 요청, 제2자 확인, 승인과 반려 이력 |
| `BACKUP_SETTINGS` | 이전 자동 백업 설정과 비활성 상태를 보존하는 호환 이력 |
| `BACKUP_RUNS` | 백업 시작과 완료, 파일 메타데이터, SHA-256 해시와 오류 이력 |
| `BACKUP_ALARMS` | ADMIN 전용 백업 완료 및 실패 알람 |
| `ALARM_ACKS` | 사용자별 미확인 알람 확인 시각, 유형과 대상 |
| `AUDIT` | 보안, 데이터, 시스템 감사추적 |

`/api/seed`는 교육 계정, 비밀번호와 잠금 기본값, 한국제약바이오협회 소속 기본 실습자 6명과 2조 교육 정보, 교육 완료 이력, 장비 3건을 멱등 방식으로 생성한다. 장비 시드에는 정상 흐름용 장비와 교정 만료 차단 및 알람 시험용 장비가 포함된다. 응답이나 감사추적에는 비밀번호 값을 기록하지 않는다. [URS-E-002, URS-E-003, URS-L-002, URS 개정 대상]

교정 대상 장비의 교정 유효기간이 KST 현재 날짜보다 과거가 되면 시스템은 해당 장비를 `사용중지`로 자동 전환하고 SYSTEM 감사추적을 기록한다. 기준정보, 사용 시작, 대시보드와 알람은 같은 판정 결과를 사용하며 사용 시작 API는 교정 만료 사유로 요청을 차단한다. [URS-F-001, URS-F-002, URS-F-005, URS 개정 대상]

로그인 화면 이후 상단 사용자 식별은 `아이디 (사번)` 형식으로 표시한다. 대시보드는 장비 코드, 장비명, 위치, 사용가능 상태와 현재 사용 상태를 직접 조회할 수 있는 기준정보 표를 제공한다. 장비 사용 통계의 이상율은 사용 유형별 `(이상 발생 횟수 / 장비 사용 횟수) * 100`으로 계산하고 사용 횟수가 0건이면 `0%`로 표시한다. [URS-F-005, URS-F-008, URS 개정 대상]

미확인 알람은 로그인 후 서버 API에서 한 번 조회하며 자동 폴링하지 않는다. 팝업은 알람 발생 일시, 구분, 대상 장비 또는 사용자, 주요 내용을 표시하고 `확인(읽음)` 또는 읽음 처리 후 상세 화면 이동을 지원한다. 읽음 이력은 `ALARM_ACKS`에 사용자별로 저장되고 확인 행위는 감사추적에 기록된다. 일반 역할에는 백업, 계정 잠금과 권한 없는 접근 반복 같은 ADMIN 전용 알람을 반환하지 않는다. [URS-F-005, URS-F-010, URS 개정 대상]

## 브라우저 백업과 복구 확인

ADMIN은 `/backup`에서 실행 사유를 입력하고 `백업 완료 후 다운로드`를 선택한다. 서버는 운영 Google Spreadsheet 전체를 메모리에서 `.xlsx`로 생성하고 이력과 SHA-256을 기록한 뒤 같은 응답으로 파일을 반환한다. 클라이언트는 응답을 Blob으로 변환하여 브라우저 다운로드 기능을 호출하므로 사용자가 PC의 저장 위치를 직접 선택하거나 브라우저 기본 다운로드 폴더에 저장한다. [URS-D-003, URS 개정 대상]

첫 파일은 `Back-Up YYYY-MM-DD.xlsx`, 같은 날짜의 추가 파일은 `Back-up YYYY-MM-DD_HH-mm-ss.xlsx`로 생성한다. `BACKUP_RUNS`에는 파일명, 크기, SHA-256, 시작과 완료 시각, 실행자와 결과만 기록하며 XLSX 본문과 PC 저장 경로는 저장하지 않는다. 완료 및 실패 알람은 ADMIN에게만 제공한다. 과거 이력은 파일 저장소가 아니므로 다시 다운로드할 수 없고 새 백업을 생성해야 한다. [URS-D-003, URS-L-001, URS 개정 대상]

백업 파일 생성과 다운로드는 다음 요청 하나로 처리한다.

```text
POST /api/backup
```

백업 실행 시작, 생성 완료, 실패, 목록 조회와 다운로드 제공은 감사추적에 기록한다. 자동 스케줄러와 과거 Drive 파일 다운로드 경로는 `410 Gone`으로 차단한다. 실제 배포 전에는 ADMIN 역할 차단, 브라우저 다운로드, 생성된 XLSX 열기와 복구 가능성을 사람이 확인하며 확인 전 상태는 `environment_pending`이다.

## Vercel 배포 절차

1. 사람이 저장소를 원격 저장소에 push하고 Vercel 프로젝트를 연결한다.
2. Vercel Settings의 Environment Variables에 Google Sheets 3종을 등록한다.
3. 운영 시트에 서비스 계정의 필요한 권한을 부여한다.
4. 최초 배포 URL에서 `/api/seed`, 계정 선택 로그인, 저장, 수동 새로고침 재조회, 역할별 접근, 감사추적, CSV와 인쇄를 확인한다.
5. ADMIN 백업 화면에서 XLSX를 생성하고 브라우저 다운로드, 파일 열기와 복구 시험을 수행한다.

AI는 `git push`와 Vercel 배포를 실행하지 않는다. 실제 URL, Google Sheets 공유 권한, 브라우저 다운로드, Chrome과 Edge 인쇄, 화면 전환 5초 이내 목표는 배포 환경에서 사람이 검증한다. [URS-N-002, URS-T-003]

## 품질 확인

```powershell
npm.cmd run check:sheets
npm.cmd run lint
npm.cmd run build
```

Google Sheets나 배포 환경을 사용할 수 없으면 코드 구현과 정적 검사를 계속하고 실제 시드, 저장, 재조회, 브라우저 백업, 복구 읽기, 브라우저 성능과 인쇄 검증은 별도의 `environment_pending` 증거로 관리한다. 네트워크, Google Sheets API 가용성, 서비스 계정 공유와 Vercel URL은 애플리케이션 외부 의존성이다. 연결 실패 시 성공을 보고하지 않으며 사용자가 다시 시도할 수 있는 식별 가능한 한국어 오류를 반환한다. [URS-I-001, URS-N-001, URS-C-001]
