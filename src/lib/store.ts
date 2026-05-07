import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseDb } from "./firebaseAdmin";
import { AUDIENCES, type Audience, type PublicSchool, type School, type SurveyDraft } from "./types";

const SCHOOLS = "schools";
const DRAFTS = "surveyDrafts";

type MemoryState = {
  schools: Map<string, School>;
  drafts: Map<string, SurveyDraft>;
};

const memoryState: MemoryState = globalThis.__schoolEvalMemoryState ?? {
  schools: new Map<string, School>(),
  drafts: new Map<string, SurveyDraft>()
};

globalThis.__schoolEvalMemoryState = memoryState;

declare global {
  // eslint-disable-next-line no-var
  var __schoolEvalMemoryState: MemoryState | undefined;
}

export function normalizeSchoolName(name: string): string {
  return name.replace(/\s+/g, "").trim().toLocaleLowerCase("ko-KR");
}

function nowIso(): string {
  return new Date().toISOString();
}

function toPublicSchool(school: School): PublicSchool {
  const { passwordHash: _passwordHash, ...publicSchool } = school;
  return publicSchool;
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDefaultDraft(schoolId: string, schoolName: string): SurveyDraft {
  const now = nowIso();
  const emptyByAudience = AUDIENCES.reduce(
    (acc, audience) => {
      acc[audience] = [];
      return acc;
    },
    {} as SurveyDraft["itemsByAudience"]
  );

  const introByAudience: Record<Audience, string> = {
    teacher:
      "안녕하십니까. 우리 학교 교육 발전을 위해 헌신적으로 노력하시는 선생님들께 감사드립니다. 이 설문은 학교 교육 활동에 대한 의견을 수렴하고 다음 학기 교육 활동을 준비하기 위한 것입니다.",
    parent:
      "안녕하십니까. 학교 교육에 관심을 갖고 협조해주신 학부모님께 감사드립니다. 이 설문은 학교 교육 활동에 대한 의견을 수렴하고 다음 학기 교육 활동을 준비하기 위한 기초자료로 활용됩니다.",
    student:
      "학생 여러분 안녕하십니까. 이 설문은 우리 학교 교육 활동을 되돌아보고 다음 학기 학교 교육활동 운영에 여러분의 의견을 반영하기 위한 기초 자료로 활용됩니다.",
    staff:
      "안녕하십니까. 학교 교육 발전을 위해 노력하시는 교직원분들께 감사드립니다. 이 설문은 학교 교육 활동에 대한 의견을 수렴하고 다음 학기 교육 활동을 준비하기 위한 것입니다."
  };

  return {
    id: randomUUID(),
    schoolId,
    schoolName,
    title: "2026학년도 1학기 학교교육과정 운영 평가 설문",
    surveyDate: "2026-06-30",
    introByAudience,
    itemsByAudience: emptyByAudience,
    createdAt: now,
    updatedAt: now
  };
}

function hydrateSchool(id: string, data: FirebaseFirestore.DocumentData): School {
  return {
    id,
    schoolName: String(data.schoolName ?? ""),
    schoolNameNormalized: String(data.schoolNameNormalized ?? ""),
    passwordHash: String(data.passwordHash ?? ""),
    status: data.status === "inactive" ? "inactive" : "active",
    createdAt: String(data.createdAt ?? nowIso()),
    updatedAt: String(data.updatedAt ?? nowIso()),
    lastLoginAt: data.lastLoginAt ? String(data.lastLoginAt) : undefined
  };
}

export async function createSchool(schoolName: string, passwordHash: string): Promise<PublicSchool> {
  const db = getFirebaseDb();
  const trimmedName = schoolName.trim();
  const schoolNameNormalized = normalizeSchoolName(trimmedName);
  const now = nowIso();

  if (db) {
    const existing = await db
      .collection(SCHOOLS)
      .where("schoolNameNormalized", "==", schoolNameNormalized)
      .limit(1)
      .get();
    if (!existing.empty) {
      throw new Error("이미 등록된 학교 이름입니다.");
    }

    const ref = db.collection(SCHOOLS).doc();
    const school: School = {
      id: ref.id,
      schoolName: trimmedName,
      schoolNameNormalized,
      passwordHash,
      status: "active",
      createdAt: now,
      updatedAt: now
    };
    await ref.set(school);
    return toPublicSchool(school);
  }

  for (const school of memoryState.schools.values()) {
    if (school.schoolNameNormalized === schoolNameNormalized) {
      throw new Error("이미 등록된 학교 이름입니다.");
    }
  }

  const school: School = {
    id: randomUUID(),
    schoolName: trimmedName,
    schoolNameNormalized,
    passwordHash,
    status: "active",
    createdAt: now,
    updatedAt: now
  };
  memoryState.schools.set(school.id, school);
  return toPublicSchool(school);
}

export async function getSchoolByName(schoolName: string): Promise<School | null> {
  const db = getFirebaseDb();
  const normalized = normalizeSchoolName(schoolName);

  if (db) {
    const snapshot = await db
      .collection(SCHOOLS)
      .where("schoolNameNormalized", "==", normalized)
      .limit(1)
      .get();
    if (snapshot.empty) {
      return null;
    }
    const doc = snapshot.docs[0];
    return hydrateSchool(doc.id, doc.data());
  }

  return (
    Array.from(memoryState.schools.values()).find(
      (school) => school.schoolNameNormalized === normalized
    ) ?? null
  );
}

export async function getSchoolById(id: string): Promise<School | null> {
  const db = getFirebaseDb();
  if (db) {
    const doc = await db.collection(SCHOOLS).doc(id).get();
    return doc.exists ? hydrateSchool(doc.id, doc.data() ?? {}) : null;
  }
  return memoryState.schools.get(id) ?? null;
}

export async function touchSchoolLogin(id: string): Promise<void> {
  const now = nowIso();
  const db = getFirebaseDb();
  if (db) {
    await db.collection(SCHOOLS).doc(id).update({
      lastLoginAt: now,
      updatedAt: now
    });
    return;
  }

  const school = memoryState.schools.get(id);
  if (school) {
    school.lastLoginAt = now;
    school.updatedAt = now;
  }
}

export async function listSchools(): Promise<PublicSchool[]> {
  const db = getFirebaseDb();
  if (db) {
    const snapshot = await db.collection(SCHOOLS).orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => toPublicSchool(hydrateSchool(doc.id, doc.data())));
  }

  return Array.from(memoryState.schools.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPublicSchool);
}

export async function updateSchoolPassword(id: string, passwordHash: string): Promise<void> {
  const now = nowIso();
  const db = getFirebaseDb();
  if (db) {
    await db.collection(SCHOOLS).doc(id).update({
      passwordHash,
      updatedAt: now
    });
    return;
  }

  const school = memoryState.schools.get(id);
  if (!school) {
    throw new Error("학교 계정을 찾을 수 없습니다.");
  }
  school.passwordHash = passwordHash;
  school.updatedAt = now;
}

export async function setSchoolStatus(id: string, status: School["status"]): Promise<void> {
  const now = nowIso();
  const db = getFirebaseDb();
  if (db) {
    await db.collection(SCHOOLS).doc(id).update({
      status,
      updatedAt: now
    });
    return;
  }

  const school = memoryState.schools.get(id);
  if (!school) {
    throw new Error("학교 계정을 찾을 수 없습니다.");
  }
  school.status = status;
  school.updatedAt = now;
}

export async function deleteSchool(id: string): Promise<void> {
  const db = getFirebaseDb();
  if (db) {
    const batch = db.batch();
    batch.delete(db.collection(SCHOOLS).doc(id));
    const drafts = await db.collection(DRAFTS).where("schoolId", "==", id).get();
    drafts.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return;
  }

  memoryState.schools.delete(id);
  for (const [draftId, draft] of memoryState.drafts.entries()) {
    if (draft.schoolId === id) {
      memoryState.drafts.delete(draftId);
    }
  }
}

function hydrateDraft(id: string, data: FirebaseFirestore.DocumentData): SurveyDraft {
  const fallback = createDefaultDraft(String(data.schoolId ?? ""), String(data.schoolName ?? ""));
  return {
    ...fallback,
    ...plain(data),
    id
  } as SurveyDraft;
}

export async function getOrCreateDraft(schoolId: string, schoolName: string): Promise<SurveyDraft> {
  const db = getFirebaseDb();
  if (db) {
    const snapshot = await db.collection(DRAFTS).where("schoolId", "==", schoolId).limit(1).get();
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return hydrateDraft(doc.id, doc.data());
    }

    const draft = createDefaultDraft(schoolId, schoolName);
    await db.collection(DRAFTS).doc(draft.id).set(draft);
    return draft;
  }

  const existing = Array.from(memoryState.drafts.values()).find(
    (draft) => draft.schoolId === schoolId
  );
  if (existing) {
    return existing;
  }

  const draft = createDefaultDraft(schoolId, schoolName);
  memoryState.drafts.set(draft.id, draft);
  return draft;
}

export async function saveDraft(draft: SurveyDraft): Promise<SurveyDraft> {
  const updatedDraft = {
    ...draft,
    updatedAt: nowIso()
  };
  const db = getFirebaseDb();
  if (db) {
    await db.collection(DRAFTS).doc(updatedDraft.id).set(updatedDraft, { merge: true });
    return updatedDraft;
  }

  memoryState.drafts.set(updatedDraft.id, updatedDraft);
  return updatedDraft;
}

export async function attachGoogleForm(
  schoolId: string,
  googleForm: NonNullable<SurveyDraft["googleForm"]>
): Promise<SurveyDraft> {
  const draft = await getOrCreateDraft(schoolId, "");
  const updated = await saveDraft({
    ...draft,
    googleForm,
    updatedAt: nowIso()
  });
  return updated;
}

export async function logAdminAction(action: string, targetSchoolId?: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) {
    return;
  }
  await db.collection("adminLogs").add({
    action,
    targetSchoolId: targetSchoolId ?? null,
    createdAt: FieldValue.serverTimestamp()
  });
}
