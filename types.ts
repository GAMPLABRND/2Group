// 공통 타입. 공유 파일이므로 오케스트레이터만 수정한다 (CLAUDE.md 파일 소유권 규칙).
// 역할 코드, 한글 명칭, 계정은 조가 제공한 URS (§6.1 역할 정의, §7.6 시드 계정) 를 따른다.
// 아래는 URS 를 읽기 전의 자리표시 기본값이며, STEP 2 에서 URS 값으로 교체한다. 업무 엔티티 타입도 STEP 2 에서 추가한다.

export const ROLES = ["ADMIN", "USER", "REVIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "관리자",
  USER: "작업자",
  REVIEWER: "검토자",
};

export type Session = { userId: string; role: Role };

// USERS 탭 (1행 헤더: id, user_id, name, password, role, status, created_at)
export type UserRow = {
  id: string;
  user_id: string;
  name: string;
  password: string;
  role: string;
  status: string; // ACTIVE | INACTIVE
  created_at: string; // ISO 저장, 표시는 lib/kst.ts
};

// 로그인 화면의 계정 선택 목록에 쓰는 공개 정보 (비밀번호 제외). initial 은 비밀번호가 아직 초기값(1234)인지 여부이며,
// 초기값인 계정을 고르면 로그인 화면이 비밀번호를 자동으로 채운다 (QA 편의). 비밀번호를 바꾸면 자동 입력이 꺼진다.
export type AccountOption = { user_id: string; name: string; role: string; initial: boolean };

// AUDIT 탭 (1행 헤더: id, category, actor_id, actor_name, role, action,
//           target, before_value, after_value, reason, timestamp_kst)
export type AuditCategory = "SECURITY" | "DATA";
export type AuditRow = {
  id: string;
  category: string;
  actor_id: string;
  actor_name: string;
  role: string;
  action: string;
  target: string;
  before_value: string;
  after_value: string;
  reason: string;
  timestamp_kst: string;
};
