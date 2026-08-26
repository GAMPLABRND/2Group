export type TrainingMember = {
  id: number;
  company: string;
  name: string;
};

export type TrainingProfile = {
  id: string;
  teamNo: string;
  members: TrainingMember[];
  lastModifiedBy: string;
  lastModifiedAt: string;
};

export const DEFAULT_TRAINING_MEMBERS: TrainingMember[] = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  company: "한국제약바이오협회",
  name: `실습자${index + 1}`,
}));

function copyDefaultMembers() {
  return DEFAULT_TRAINING_MEMBERS.map((member) => ({ ...member }));
}

function normalizeMember(value: unknown): TrainingMember | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as { id?: unknown; company?: unknown; name?: unknown };
  const id = Number(source.id);
  const company = String(source.company ?? "").trim();
  const name = String(source.name ?? "").trim();
  if (!Number.isInteger(id) || id < 1 || !company || !name) return null;
  return { id, company, name };
}

export function parseStoredTrainingMembers(value: unknown): TrainingMember[] {
  if (!value) return copyDefaultMembers();
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.length < 1) return copyDefaultMembers();
    const members = parsed.map(normalizeMember);
    if (members.some((member) => member === null)) return copyDefaultMembers();
    const normalized = members as TrainingMember[];
    if (new Set(normalized.map((member) => member.id)).size !== normalized.length) return copyDefaultMembers();
    return normalized;
  } catch {
    return copyDefaultMembers();
  }
}

export function requireTrainingMembers(value: unknown): TrainingMember[] {
  if (!Array.isArray(value) || value.length < 1) {
    throw new Error("실습자는 최소 1명 이상이어야 합니다.");
  }
  const members = value.map((item, index) => {
    const member = normalizeMember(item);
    if (!member) throw new Error(`${index + 1}번 실습자의 회사명과 실습자명을 모두 입력하세요.`);
    return member;
  });
  if (new Set(members.map((member) => member.id)).size !== members.length) {
    throw new Error("실습자 식별자는 중복될 수 없습니다.");
  }
  return members;
}

export function trainingProfileFromRow(row?: Record<string, string> | null): TrainingProfile {
  return {
    id: row?.id || "training-profile-default",
    teamNo: row?.team_no || "2",
    members: parseStoredTrainingMembers(row?.members_json),
    lastModifiedBy: row?.updated_by || "SYSTEM",
    lastModifiedAt: row?.updated_at || "",
  };
}
