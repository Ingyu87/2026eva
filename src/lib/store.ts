import { nextWorkStatus, defaultWorkColor, type WorkActor, type WorkColor } from "./workStatus";
import { createHash, randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { isCurrentSubarea, placementFromSubarea } from "./evaluationFramework";
import { getFirebaseDb } from "./firebaseAdmin";
import {
  AUDIENCES,
  type Audience,
  type BuilderInvite,
  type DraftBundle,
  type GoogleFormInfo,
  type GoogleFormsByAudience,
  type NewSelectedQuestion,
  type Presence,
  type PublicSchool,
  type School,
  type SelectedQuestion,
  type SelectedQuestionPatch,
  type ResultUpload,
  type SurveyDraft,
  type SurveyDraftAuthor,
  type SurveyDraftPatch,
  type SurveyResult,
  type SyncResponse
} from "./types";

const SCHOOLS = "schools";
const DRAFTS = "surveyDrafts";

type MemoryState = {
  schools: Map<string, School>;
};

const memoryState: MemoryState = globalThis.__schoolEvalMemoryState ?? {
  schools: new Map<string, School>()
};

globalThis.__schoolEvalMemoryState = memoryState;

declare global {
  // eslint-disable-next-line no-var
  var __schoolEvalMemoryState: MemoryState | undefined;
  // eslint-disable-next-line no-var
  var __schoolEvalIndicatorTemplate: StoredIndicatorTemplate | null | undefined;
}

/**
 * 평가지표 및 현황 XLSX 템플릿 원본. 학교마다 다른 게 아니라 앱 전체가 공유하는
 * 값이라 학교 문서가 아니라 `adminSettings` 싱글턴 문서에 둡니다(spec.md 7.1 "템플릿 등록 화면").
 * 파일이 수십 KB 수준이라 별도 스토리지 없이 Firestore 문서에 base64로 둡니다.
 */
export type StoredIndicatorTemplate = {
  filename: string;
  base64: string;
  uploadedAt: string;
};

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

const DEFAULT_DRAFT_AUTHOR_TITLES = [
  "교무부장",
  "교육연구부장",
  "생활인성부장",
  "진로복지부장",
  "문예체부장",
  "과학정보부장"
];

function createDefaultDraftAuthors(): SurveyDraftAuthor[] {
  return DEFAULT_DRAFT_AUTHOR_TITLES.map((title) => ({
    id: randomUUID(),
    title,
    done: false
  }));
}

function ensureDraftAuthors(draft: SurveyDraft): SurveyDraft {
  if (Array.isArray(draft.draftAuthors) && draft.draftAuthors.length > 0) {
    return draft;
  }
  return { ...draft, draftAuthors: createDefaultDraftAuthors() };
}

export function createDefaultDraft(schoolId: string, schoolName: string): SurveyDraft {
  const now = nowIso();

  const introByAudience: Record<Audience, string> = {
    teacher:
      "안녕하십니까. 우리 학교 교육 발전을 위해 헌신적으로 노력하시는 선생님들께 감사드립니다. 이 설문은 학교 교육 활동에 대한 의견을 수렴하고 다음 학기 교육 활동을 준비하기 위한 것입니다.",
    parent:
      "안녕하십니까. 학교 교육에 관심을 갖고 협조해주신 학부모님께 감사드립니다. 이 설문은 학교 교육 활동에 대한 의견을 수렴하고 다음 학기 교육 활동을 준비하기 위한 기초자료로 활용됩니다.",
    student:
      "학생 여러분 안녕하십니까. 이 설문은 우리 학교 교육 활동을 되돌아보고 다음 학기 학교 교육활동 운영에 여러분의 의견을 반영하기 위한 기초 자료로 활용됩니다.",
    staff:
      "안녕하십니까. 학교 교육 발전을 위해 노력하시는 직원분들께 감사드립니다. 이 설문은 학교 교육 활동에 대한 의견을 수렴하고 다음 학기 교육 활동을 준비하기 위한 것입니다."
  };

  return {
    id: randomUUID(),
    schoolId,
    schoolName,
    // 기본값은 중간평가입니다. 제출 서류는 학년말로 바꿔야 열립니다(가이드북 Q12).
    mode: "interim",
    title: "2026학년도 1학기 학교교육과정 운영 평가 설문",
    surveyDate: "2026-06-30",
    rev: 0,
    introByAudience,
    draftAuthors: createDefaultDraftAuthors(),
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
    await db.collection(SCHOOLS).doc(id).update({ status: 'inactive' });
    const drafts = await db.collection(DRAFTS).where("schoolId", "==", id).get();
    for (const doc of drafts.docs) await db.recursiveDelete(doc.ref);
    const invites = await db.collection(INVITES).where('schoolId', '==', id).get();
    for (const doc of invites.docs) await doc.ref.delete();
    await db.collection(SCHOOLS).doc(id).delete();
    return;
  }

  memoryState.schools.delete(id);
  for (const [token, invite] of memoryInvites) if (invite.schoolId === id) memoryInvites.delete(token);
  for (const [draftId, state] of memoryDrafts.entries()) {
    if (state.draft.schoolId === id) {
      memoryDrafts.delete(draftId);
    }
  }
}

/* ------------------------------------------------------------------ *
 * 설문 초안 (메타 + 문항 서브컬렉션)
 *
 * 메타와 문항을 별도 문서로 두는 것이 동시 작업의 핵심입니다. Firestore는 문서 단위로
 * 원자성을 보장하므로, 서로 다른 문항을 편집하면 충돌이 구조적으로 발생하지 않습니다.
 * ------------------------------------------------------------------ */

const ITEMS = "items";
const PRESENCE = "presence";
const RESULTS = "results";
const RESULT_UPLOADS = "resultUploads";
const RESULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const resultExpired = (value: { createdAt: string }) => Date.now() - Date.parse(value.createdAt) >= RESULT_RETENTION_MS;
function readUpload(value: unknown): ResultUpload {
  const data = plain(value) as ResultUpload & { rowsJson?: string };
  return { ...data, rows: data.rowsJson ? JSON.parse(data.rowsJson) : data.rows };
}
function uploadDocument(upload: ResultUpload) {
  const { rows, ...meta } = upload;
  return plain({ ...meta, rowsJson: JSON.stringify(rows) });
}
const ADMIN_SETTINGS = "adminSettings";
const INDICATOR_TEMPLATE_DOC = "indicatorTemplate";

/** presence 하트비트가 이 시간 이상 끊기면 접속이 끝난 것으로 봅니다. */
const PRESENCE_TTL_MS = 30_000;

/** 삭제 표식을 실제로 지우기까지의 보관 기간. */
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 낙관적 잠금 실패. 호출한 쪽에서 409로 변환합니다. */
export class ConflictError<T> extends Error {
  readonly current: T | null;

  constructor(current: T | null) {
    super("다른 사람이 먼저 수정했습니다.");
    this.name = "ConflictError";
    this.current = current;
  }
}

export class ForbiddenError extends Error {
  constructor(message = "이 링크로는 할 수 없는 작업입니다.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** 부장 링크로 쓰는 쓰기의 제한. 자기가 담은 문항만, 지정된 대상 안에서만 고칠 수 있습니다. */
export type WriteGuard = { ownerId: string; audience?: Audience };

/** 링크 토큰은 비밀이라 문항에 싣지 않고, 되돌릴 수 없는 짧은 식별자만 싣습니다. */
export function inviteOwnerId(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

function assertWriteAllowed(
  current: SelectedQuestion,
  guard: WriteGuard | undefined,
  patch?: SelectedQuestionPatch
): void {
  if (!guard) {
    return;
  }
  if (current.ownerId !== guard.ownerId) {
    throw new ForbiddenError("다른 사람이 담은 문항은 고칠 수 없습니다.");
  }
  if (guard.audience && (current.audience !== guard.audience || (patch?.audience && patch.audience !== guard.audience))) {
    throw new ForbiddenError("이 링크로는 지정된 대상의 문항만 고칠 수 있습니다.");
  }
}

export class NotFoundError extends Error {
  constructor(message = "대상을 찾을 수 없습니다.") {
    super(message);
    this.name = "NotFoundError";
  }
}

type MemoryDraftState = {
  draft: SurveyDraft;
  items: Map<string, SelectedQuestion>;
  presence: Map<string, Presence>;
  results: Map<string, SurveyResult>;
  resultUploads: Map<string, ResultUpload>;
};

const memoryDrafts: Map<string, MemoryDraftState> =
  globalThis.__schoolEvalMemoryDrafts ?? new Map<string, MemoryDraftState>();

globalThis.__schoolEvalMemoryDrafts = memoryDrafts;

declare global {
  // eslint-disable-next-line no-var
  var __schoolEvalMemoryDrafts: Map<string, MemoryDraftState> | undefined;
}

function hydrateDraft(id: string, data: FirebaseFirestore.DocumentData): SurveyDraft {
  const fallback = createDefaultDraft(String(data.schoolId ?? ""), String(data.schoolName ?? ""));
  const merged = {
    ...fallback,
    ...plain(data),
    id
  } as SurveyDraft & { itemsByAudience?: unknown };
  // 옛 구조의 잔재가 남아 있어도 메타에는 싣지 않습니다.
  delete merged.itemsByAudience;
  merged.rev = typeof merged.rev === "number" ? merged.rev : 0;
  // mode가 없던 시절의 초안은 중간평가로 봅니다. 제출 서류를 실수로 열지 않기 위함입니다.
  merged.mode = merged.mode === "annual" ? "annual" : "interim";
  return ensureDraftAuthors(merged);
}

function hydrateItem(id: string, data: FirebaseFirestore.DocumentData): SelectedQuestion {
  const item = plain(data) as SelectedQuestion;
  return {
    ...item,
    id,
    rev: typeof item.rev === "number" ? item.rev : 0,
    order: typeof item.order === "number" ? item.order : 0,
    // 옛 문서에는 groupId가 없습니다. 원본 문항 id로 되살려 두어야
    // 서식3-2의 평가주체 열을 만들 때 대상별 문항이 한 줄로 모입니다.
    groupId: item.groupId || item.sourceQuestionId || id,
    updatedAt: String(item.updatedAt ?? nowIso())
  };
}

/**
 * 옛 구조(`itemsByAudience` 배열)를 문항 서브컬렉션으로 옮깁니다.
 * 읽기 시점에 한 번만 수행하므로 서비스 중단이 필요 없습니다.
 */
async function migrateLegacyItems(
  db: FirebaseFirestore.Firestore,
  draftId: string,
  data: FirebaseFirestore.DocumentData
): Promise<void> {
  const legacy = data.itemsByAudience as Record<string, unknown[]> | undefined;
  if (!legacy) {
    return;
  }

  const draftRef = db.collection(DRAFTS).doc(draftId);
  const existing = await draftRef.collection(ITEMS).limit(1).get();
  if (!existing.empty) {
    // 이미 옮겨졌는데 옛 필드만 남은 경우입니다.
    await draftRef.update({ itemsByAudience: FieldValue.delete() });
    return;
  }

  const now = nowIso();
  const batch = db.batch();
  let order = 0;

  for (const audience of AUDIENCES) {
    for (const raw of legacy[audience] ?? []) {
      const item = raw as SelectedQuestion;
      order += 1;
      const id = item.id || randomUUID();
      batch.set(draftRef.collection(ITEMS).doc(id), {
        ...item,
        id,
        audience,
        groupId: item.groupId || item.sourceQuestionId || id,
        rev: 0,
        order,
        createdAt: item.createdAt ?? now,
        updatedAt: now
      });
    }
  }

  batch.update(draftRef, { itemsByAudience: FieldValue.delete() });
  await batch.commit();
}

async function findDraftRef(
  db: FirebaseFirestore.Firestore,
  schoolId: string,
  schoolName: string
): Promise<FirebaseFirestore.DocumentReference> {
  const snapshot = await db.collection(DRAFTS).where("schoolId", "==", schoolId).limit(1).get();
  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    await migrateLegacyItems(db, doc.id, doc.data());
    return doc.ref;
  }

  const draft = createDefaultDraft(schoolId, schoolName);
  const ref = db.collection(DRAFTS).doc(draft.id);
  await ref.set(draft);
  return ref;
}

/** 초안 메타를 가져오거나 새로 만듭니다. 문항은 포함하지 않습니다. */
export async function getOrCreateDraft(schoolId: string, schoolName: string): Promise<SurveyDraft> {
  const db = getFirebaseDb();
  if (db) {
    const ref = await findDraftRef(db, schoolId, schoolName);
    const doc = await ref.get();
    return hydrateDraft(doc.id, doc.data() ?? {});
  }

  const existing = Array.from(memoryDrafts.values()).find(
    (state) => state.draft.schoolId === schoolId
  );
  if (existing) {
    return ensureDraftAuthors(existing.draft);
  }

  const draft = createDefaultDraft(schoolId, schoolName);
  memoryDrafts.set(draft.id, {
    draft,
    items: new Map<string, SelectedQuestion>(),
    presence: new Map<string, Presence>(),
    results: new Map<string, SurveyResult>(),
    resultUploads: new Map<string, ResultUpload>()
  });
  return draft;
}

function memoryStateFor(draftId: string): MemoryDraftState {
  const state = memoryDrafts.get(draftId);
  if (!state) {
    throw new NotFoundError("설문 초안을 찾을 수 없습니다.");
  }
  return state;
}

/**
 * 초안 전체(메타 + 살아 있는 문항)와 다음 동기화 커서를 돌려줍니다.
 * 커서는 실제로 본 가장 늦은 `updatedAt`이므로, 아직 도착하지 않은 쓰기를 건너뛰지 않습니다.
 */
export async function getDraftBundle(schoolId: string, schoolName: string): Promise<DraftBundle> {
  const draft = await getOrCreateDraft(schoolId, schoolName);
  const db = getFirebaseDb();

  const items: SelectedQuestion[] = db
    ? (await db.collection(DRAFTS).doc(draft.id).collection(ITEMS).get()).docs
        .map((doc) => hydrateItem(doc.id, doc.data()))
        .filter((item) => !item.deleted)
    : Array.from(memoryStateFor(draft.id).items.values()).filter((item) => !item.deleted);

  const since = [draft.updatedAt, ...items.map((item) => item.updatedAt)].reduce(
    (max, value) => (value > max ? value : max),
    draft.updatedAt
  );

  return { draft, items, since };
}

/**
 * `since` 이후에 바뀐 것만 돌려줍니다.
 *
 * 경계값에서 같은 밀리초에 쓰인 문서를 놓치지 않도록 `>=`로 조회합니다. 같은 문서를 다시
 * 받아도 클라이언트가 멱등하게 반영하므로 문제가 없습니다.
 */
export async function syncDraft(
  draftId: string,
  since: string | null,
  sessionId: string | null
): Promise<SyncResponse> {
  const db = getFirebaseDb();
  const changed: SelectedQuestion[] = [];
  const deleted: string[] = [];
  let draft: SurveyDraft | null = null;
  let maxSeen = since ?? "";

  if (db) {
    const draftRef = db.collection(DRAFTS).doc(draftId);
    const [draftDoc, itemDocs] = await Promise.all([
      draftRef.get(),
      since
        ? draftRef.collection(ITEMS).where("updatedAt", ">=", since).get()
        : draftRef.collection(ITEMS).get()
    ]);

    if (draftDoc.exists) {
      const meta = hydrateDraft(draftDoc.id, draftDoc.data() ?? {});
      if (!since || meta.updatedAt >= since) {
        draft = meta;
      }
      if (meta.updatedAt > maxSeen) {
        maxSeen = meta.updatedAt;
      }
    }

    for (const doc of itemDocs.docs) {
      const item = hydrateItem(doc.id, doc.data());
      if (item.updatedAt > maxSeen) {
        maxSeen = item.updatedAt;
      }
      if (item.deleted) {
        deleted.push(item.id);
      } else {
        changed.push(item);
      }
    }
  } else {
    const state = memoryStateFor(draftId);
    if (!since || state.draft.updatedAt >= since) {
      draft = state.draft;
    }
    if (state.draft.updatedAt > maxSeen) {
      maxSeen = state.draft.updatedAt;
    }
    for (const item of state.items.values()) {
      if (since && item.updatedAt < since) {
        continue;
      }
      if (item.updatedAt > maxSeen) {
        maxSeen = item.updatedAt;
      }
      if (item.deleted) {
        deleted.push(item.id);
      } else {
        changed.push(item);
      }
    }
  }

  return {
    nextSince: maxSeen || nowIso(),
    draft,
    changed,
    deleted,
    presence: await listPresence(draftId, sessionId)
  };
}

/** 메타를 부분 수정합니다. `expectedRev`가 맞지 않으면 ConflictError를 던집니다. */
export async function patchDraftMeta(
  draftId: string,
  expectedRev: number,
  patch: SurveyDraftPatch,
  updatedBy?: string
): Promise<SurveyDraft> {
  const db = getFirebaseDb();
  const now = nowIso();

  if (db) {
    const ref = db.collection(DRAFTS).doc(draftId);
    return db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) {
        throw new NotFoundError("설문 초안을 찾을 수 없습니다.");
      }
      const current = hydrateDraft(doc.id, doc.data() ?? {});
      if (current.rev !== expectedRev) {
        throw new ConflictError(current);
      }
      const next: SurveyDraft = {
        ...current,
        ...patch,
        rev: current.rev + 1,
        updatedAt: now,
        updatedBy
      };
      tx.set(ref, next, { merge: true });
      return next;
    });
  }

  const state = memoryStateFor(draftId);
  if (state.draft.rev !== expectedRev) {
    throw new ConflictError(state.draft);
  }
  state.draft = {
    ...state.draft,
    ...patch,
    rev: state.draft.rev + 1,
    updatedAt: now,
    updatedBy
  };
  return state.draft;
}

/** 문항을 한 번에 여러 개 추가합니다. 새 문서라 충돌이 발생하지 않습니다. */
function withLegalPlacement<T extends { area: string; subarea: string }>(item: T): T {
  const placement = placementFromSubarea(item.subarea);
  if (!placement) {
    throw new Error("2026 세부영역을 선택하세요. 영역·세부영역은 학교가 바꿀 수 없습니다.");
  }
  return { ...item, area: placement.area, subarea: placement.subarea };
}

/** 세부영역을 바꿀 때만 법정 목록을 강제합니다. 옛 '직접입력' 문항은 문장만 고쳐도 저장됩니다. */
function applyItemPatch(current: SelectedQuestion, rawPatch: SelectedQuestionPatch): SelectedQuestion {
  // 서버가 관리하는 값은 요청으로 바꿀 수 없습니다.
  const {
    id: _id,
    rev: _rev,
    deleted: _deleted,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    updatedBy: _updatedBy,
    ownerId: _ownerId,
    ownerLabel: _ownerLabel,
    workStatus: _workStatus,
    confirmReview: _confirmReview,
    ...patch
  } = rawPatch as SelectedQuestionPatch & Record<string, unknown>;
  const merged = { ...current, ...patch };
  if (patch.subarea !== undefined) {
    return withLegalPlacement(merged);
  }
  if (isCurrentSubarea(current.subarea)) {
    const placement = placementFromSubarea(current.subarea);
    if (placement) {
      return { ...merged, area: placement.area, subarea: placement.subarea };
    }
  }
  return merged;
}

export async function createDraftItems(
  draftId: string,
  items: NewSelectedQuestion[],
  updatedBy?: string,
  owner?: { id: string; label: string }
): Promise<SelectedQuestion[]> {
  const now = nowIso();
  const prepared: SelectedQuestion[] = items.map((item) => {
    // 담은 사람 표시는 서버만 정합니다. 요청에 실려 온 값은 버립니다.
    const { ownerId: _ownerId, ownerLabel: _ownerLabel, workStatus: _workStatus, ...clean } = item as NewSelectedQuestion & {
      workStatus?: unknown;
      ownerId?: string;
      ownerLabel?: string;
    };
    const legal = withLegalPlacement(clean);
    return {
      ...legal,
      ...(owner ? { ownerId: owner.id, ownerLabel: owner.label } : {}),
      id: legal.id || randomUUID(),
      groupId: legal.groupId || legal.sourceQuestionId,
      rev: 0,
      createdAt: now,
      updatedAt: now,
      updatedBy
    };
  });

  const db = getFirebaseDb();
  if (db) {
    const collection = db.collection(DRAFTS).doc(draftId).collection(ITEMS);
    const batch = db.batch();
    for (const item of prepared) {
      batch.set(collection.doc(item.id), item);
    }
    await batch.commit();
    return prepared;
  }

  const state = memoryStateFor(draftId);
  for (const item of prepared) {
    state.items.set(item.id, item);
  }
  return prepared;
}

/** 문항 하나를 부분 수정합니다. `expectedRev`가 맞지 않으면 ConflictError를 던집니다. */
export async function patchDraftItem(
  draftId: string,
  itemId: string,
  expectedRev: number,
  patch: SelectedQuestionPatch,
  updatedBy?: string,
  guard?: WriteGuard,
  actor: WorkActor = { id: "lead", label: updatedBy || "연구부장", color: "purple" }
): Promise<SelectedQuestion> {
  const db = getFirebaseDb();
  const now = nowIso();

  if (db) {
    const ref = db.collection(DRAFTS).doc(draftId).collection(ITEMS).doc(itemId);
    return db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) {
        throw new NotFoundError("문항을 찾을 수 없습니다.");
      }
      const current = hydrateItem(doc.id, doc.data() ?? {});
      if (current.deleted) {
        throw new NotFoundError("이미 삭제된 문항입니다.");
      }
      assertWriteAllowed(current, guard, patch);
      if (current.rev !== expectedRev) {
        throw new ConflictError(current);
      }
      const next: SelectedQuestion = {
        ...applyItemPatch(current, patch),
        workStatus: nextWorkStatus(current, patch, actor, now),
        rev: current.rev + 1,
        updatedAt: now,
        updatedBy
      };
      tx.set(ref, next, { merge: true });
      return next;
    });
  }

  const state = memoryStateFor(draftId);
  const current = state.items.get(itemId);
  if (!current || current.deleted) {
    throw new NotFoundError("문항을 찾을 수 없습니다.");
  }
  assertWriteAllowed(current, guard, patch);
  if (current.rev !== expectedRev) {
    throw new ConflictError(current);
  }
  const next: SelectedQuestion = {
    ...applyItemPatch(current, patch),
    workStatus: nextWorkStatus(current, patch, actor, now),
    rev: current.rev + 1,
    updatedAt: now,
    updatedBy
  };
  state.items.set(itemId, next);
  return next;
}

/**
 * 문항을 삭제합니다. 문서를 지우면 동기화가 삭제 사실을 전달할 수 없으므로
 * `deleted` 표식을 남깁니다.
 */
export async function deleteDraftItem(
  draftId: string,
  itemId: string,
  expectedRev: number,
  updatedBy?: string,
  guard?: WriteGuard
): Promise<void> {
  const db = getFirebaseDb();
  const now = nowIso();

  if (db) {
    const ref = db.collection(DRAFTS).doc(draftId).collection(ITEMS).doc(itemId);
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) {
        return;
      }
      const current = hydrateItem(doc.id, doc.data() ?? {});
      if (current.deleted) {
        return;
      }
      assertWriteAllowed(current, guard);
      if (current.rev !== expectedRev) {
        throw new ConflictError(current);
      }
      tx.set(ref, { ...current, deleted: true, rev: current.rev + 1, updatedAt: now, updatedBy });
    });
    return;
  }

  const state = memoryStateFor(draftId);
  const current = state.items.get(itemId);
  if (!current || current.deleted) {
    return;
  }
  assertWriteAllowed(current, guard);
  if (current.rev !== expectedRev) {
    throw new ConflictError(current);
  }
  state.items.set(itemId, {
    ...current,
    deleted: true,
    rev: current.rev + 1,
    updatedAt: now,
    updatedBy
  });
}

/** 보관 기간이 지난 삭제 표식을 정리합니다. */
export async function purgeTombstones(draftId: string): Promise<number> {
  const cutoff = new Date(Date.now() - TOMBSTONE_TTL_MS).toISOString();
  const db = getFirebaseDb();

  if (db) {
    const snapshot = await db
      .collection(DRAFTS)
      .doc(draftId)
      .collection(ITEMS)
      .where("deleted", "==", true)
      .where("updatedAt", "<", cutoff)
      .get();
    if (snapshot.empty) {
      return 0;
    }
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return snapshot.size;
  }

  const state = memoryStateFor(draftId);
  let removed = 0;
  for (const [id, item] of state.items.entries()) {
    if (item.deleted && item.updatedAt < cutoff) {
      state.items.delete(id);
      removed += 1;
    }
  }
  return removed;
}

/** 접속 상태를 갱신하고 현재 접속자 목록을 돌려줍니다. */
export async function upsertPresence(
  draftId: string,
  presence: Omit<Presence, "updatedAt">
): Promise<Presence[]> {
  const now = nowIso();
  const record: Presence = { ...presence, updatedAt: now };
  const db = getFirebaseDb();

  if (db) {
    await db
      .collection(DRAFTS)
      .doc(draftId)
      .collection(PRESENCE)
      .doc(presence.sessionId)
      .set(record);
  } else {
    memoryStateFor(draftId).presence.set(presence.sessionId, record);
  }

  return listPresence(draftId, presence.sessionId);
}

/** 살아 있는 접속자 목록. 자기 자신(`excludeSessionId`)은 제외합니다. */
export async function listPresence(
  draftId: string,
  excludeSessionId: string | null
): Promise<Presence[]> {
  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS).toISOString();
  const db = getFirebaseDb();

  const all: Presence[] = db
    ? (await db.collection(DRAFTS).doc(draftId).collection(PRESENCE).get()).docs.map(
        (doc) => doc.data() as Presence
      )
    : Array.from(memoryDrafts.get(draftId)?.presence.values() ?? []);

  return all.filter(
    (entry) => entry.updatedAt >= cutoff && entry.sessionId !== excludeSessionId
  );
}

/**
 * 생성된 Google Forms 정보를 메타에 기록합니다.
 *
 * 사용자 편집과 경쟁하지 않는 서버 주도 갱신이라 `expectedRev`를 받지 않고,
 * 대신 트랜잭션 안에서 현재 rev를 읽어 올립니다.
 */
export async function attachGoogleForms(
  draftId: string,
  googleFormsByAudience: GoogleFormsByAudience,
  googleForm?: GoogleFormInfo
): Promise<SurveyDraft> {
  const db = getFirebaseDb();
  const now = nowIso();

  if (db) {
    const ref = db.collection(DRAFTS).doc(draftId);
    return db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) {
        throw new NotFoundError("설문 초안을 찾을 수 없습니다.");
      }
      const current = hydrateDraft(doc.id, doc.data() ?? {});
      const next: SurveyDraft = {
        ...current,
        googleFormsByAudience,
        googleForm: googleForm ?? current.googleForm,
        rev: current.rev + 1,
        updatedAt: now
      };
      tx.set(ref, next, { merge: true });
      return next;
    });
  }

  const state = memoryStateFor(draftId);
  state.draft = {
    ...state.draft,
    googleFormsByAudience,
    googleForm: googleForm ?? state.draft.googleForm,
    rev: state.draft.rev + 1,
    updatedAt: now
  };
  return state.draft;
}

/* ------------------------------------------------------------------ *
 * 결과 집계 (6단계)
 *
 * 업로드 1회 = 문서 1개. 초안 문항과 달리 동시에 여러 사람이 같은 결과 파일을
 * 편집하지 않으므로 rev/트랜잭션 없이 단순 저장으로 충분합니다.
 * ------------------------------------------------------------------ */

/** 결과 파일을 올린 직후, 자동 연결 결과를 담아 저장합니다(spec.md `/api/results/upload`). */
export async function saveResultUpload(
  draftId: string,
  input: Omit<ResultUpload, "id" | "createdAt" | "updatedAt">
): Promise<ResultUpload> {
  const db = getFirebaseDb();
  const now = nowIso();
  const upload: ResultUpload = {
    ...input,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now
  };

  if (db) {
    const draftDoc = await db.collection(DRAFTS).doc(draftId).get();
    if (!draftDoc.exists) {
      throw new NotFoundError("설문 초안을 찾을 수 없습니다.");
    }
    await db.collection(DRAFTS).doc(draftId).collection(RESULT_UPLOADS).doc(upload.id).set(uploadDocument(upload));
    return upload;
  }

  memoryStateFor(draftId).resultUploads.set(upload.id, upload);
  return upload;
}

export async function getResultUpload(draftId: string, uploadId: string): Promise<ResultUpload | null> {
  const db = getFirebaseDb();
  if (db) {
    const doc = await db.collection(DRAFTS).doc(draftId).collection(RESULT_UPLOADS).doc(uploadId).get();
    if (!doc.exists) return null;
    const upload = readUpload(doc.data());
    if (resultExpired(upload)) { await doc.ref.delete(); return null; }
    return upload;
  }
  const upload = memoryStateFor(draftId).resultUploads.get(uploadId);
  if (upload && resultExpired(upload)) { memoryStateFor(draftId).resultUploads.delete(uploadId); return null; }
  return upload ?? null;
}

export async function listResultUploads(draftId: string): Promise<ResultUpload[]> {
  const db = getFirebaseDb();
  const uploads = db
    ? (await db.collection(DRAFTS).doc(draftId).collection(RESULT_UPLOADS).get()).docs.map(
        (doc) => readUpload(doc.data())
      )
    : Array.from(memoryStateFor(draftId).resultUploads.values());

  for (const u of uploads.filter(resultExpired)) {
    if (db) await db.collection(DRAFTS).doc(draftId).collection(RESULT_UPLOADS).doc(u.id).delete();
    else memoryStateFor(draftId).resultUploads.delete(u.id);
  }
  return uploads.filter(u => !resultExpired(u)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** S4 수동 연결 화면에서 사람이 고친 연결표로 덮어씁니다(spec.md `/api/results/map`). */
export async function updateResultUploadMapping(
  draftId: string,
  uploadId: string,
  mapping: ResultUpload["mapping"]
): Promise<ResultUpload> {
  const db = getFirebaseDb();
  const now = nowIso();

  if (db) {
    const ref = db.collection(DRAFTS).doc(draftId).collection(RESULT_UPLOADS).doc(uploadId);
    const doc = await ref.get();
    if (!doc.exists) {
      throw new NotFoundError("업로드한 결과 파일을 찾을 수 없습니다.");
    }
    const updated = { ...readUpload(doc.data()), mapping, updatedAt: now };
    await ref.set(uploadDocument(updated));
    return updated;
  }

  const state = memoryStateFor(draftId);
  const existing = state.resultUploads.get(uploadId);
  if (!existing) {
    throw new NotFoundError("업로드한 결과 파일을 찾을 수 없습니다.");
  }
  const updated = { ...existing, mapping, updatedAt: now };
  state.resultUploads.set(uploadId, updated);
  return updated;
}

/** 집계 결과를 새로 저장합니다. 같은 초안에 다시 올리면 이전 결과 옆에 나란히 쌓입니다. */
export async function saveSurveyResult(
  draftId: string,
  input: Omit<SurveyResult, "id" | "createdAt" | "updatedAt">
): Promise<SurveyResult> {
  const db = getFirebaseDb();
  const now = nowIso();
  const result: SurveyResult = {
    ...input,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now
  };

  if (db) {
    const ref = db.collection(DRAFTS).doc(draftId).collection(RESULTS).doc(result.id);
    const draftDoc = await db.collection(DRAFTS).doc(draftId).get();
    if (!draftDoc.exists) {
      throw new NotFoundError("설문 초안을 찾을 수 없습니다.");
    }
    await ref.set(plain(result));
    return result;
  }

  memoryStateFor(draftId).results.set(result.id, result);
  return result;
}

export async function getSurveyResult(draftId: string, resultId: string): Promise<SurveyResult | null> {
  const db = getFirebaseDb();
  if (db) {
    const doc = await db.collection(DRAFTS).doc(draftId).collection(RESULTS).doc(resultId).get();
    if (!doc.exists) return null;
    const result = plain(doc.data()) as SurveyResult;
    if (resultExpired(result)) { await doc.ref.delete(); return null; }
    return result;
  }
  const result = memoryStateFor(draftId).results.get(resultId);
  if (result && resultExpired(result)) { memoryStateFor(draftId).results.delete(resultId); return null; }
  return result ?? null;
}

/** 7단계 Gemini 해석 결과를 기존 집계 결과에 붙입니다(spec.md `/api/results/analyze`·`/analysis`). */
export async function updateSurveyResultAnalysis(
  draftId: string,
  resultId: string,
  aiAnalysis: SurveyResult["aiAnalysis"],
  expectedUpdatedAt: string
): Promise<SurveyResult> {
  return updateResultRecord(draftId, resultId, expectedUpdatedAt, existing => ({
    ...existing, aiAnalysis, review: existing.review ? { ...existing.review, checked: [] } : undefined
  }));
}

export async function updateSurveyResultReview(
  draftId: string, resultId: string, expectedUpdatedAt: string,
  metadata: Pick<SurveyResult, 'label' | 'review'>
): Promise<SurveyResult> {
  return updateResultRecord(draftId, resultId, expectedUpdatedAt, existing => ({ ...existing, ...metadata }));
}

async function updateResultRecord(
  draftId: string, resultId: string, expectedUpdatedAt: string,
  patch: (existing: SurveyResult) => SurveyResult
): Promise<SurveyResult> {
  const db = getFirebaseDb();
  const update = (existing: SurveyResult): SurveyResult => {
    if (resultExpired(existing)) throw new NotFoundError("보관 기간이 지난 결과입니다.");
    if (existing.updatedAt !== expectedUpdatedAt) throw new ConflictError(existing);
    const now = new Date(Math.max(Date.now(), Date.parse(existing.updatedAt) + 1)).toISOString();
    return { ...patch(existing), updatedAt: now };
  };
  if (db) {
    const ref = db.collection(DRAFTS).doc(draftId).collection(RESULTS).doc(resultId);
    return db.runTransaction(async tx => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new NotFoundError("집계 결과를 찾을 수 없습니다.");
      const next = update(plain(doc.data()) as SurveyResult);
      tx.set(ref, plain(next));
      return next;
    });
  }
  const state = memoryStateFor(draftId);
  const existing = state.results.get(resultId);
  if (!existing) throw new NotFoundError("집계 결과를 찾을 수 없습니다.");
  const next = update(existing);
  state.results.set(resultId, next);
  return next;
}

/** 최근 업로드 순으로 돌려줍니다. 결과 화면은 가장 최근 것을 기본으로 보여줍니다. */
export async function listSurveyResults(draftId: string): Promise<SurveyResult[]> {
  const db = getFirebaseDb();
  const results = db
    ? (await db.collection(DRAFTS).doc(draftId).collection(RESULTS).get()).docs.map(
        (doc) => plain(doc.data()) as SurveyResult
      )
    : Array.from(memoryStateFor(draftId).results.values());

  for (const r of results.filter(resultExpired)) {
    if (db) await db.collection(DRAFTS).doc(draftId).collection(RESULTS).doc(r.id).delete();
    else memoryStateFor(draftId).results.delete(r.id);
  }
  return results.filter(r => !resultExpired(r)).sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
}

/** 담당자가 보고서 보관 후 실행합니다. 선택 문항과 설문 설정은 유지합니다. */
export async function deleteResultData(draftId: string): Promise<void> {
  const db = getFirebaseDb();
  if (db) {
    for (const collection of [RESULT_UPLOADS, RESULTS]) {
      const docs = await db.collection(DRAFTS).doc(draftId).collection(collection).get();
      for (const doc of docs.docs) await doc.ref.delete();
    }
  } else {
    memoryStateFor(draftId).resultUploads.clear();
    memoryStateFor(draftId).results.clear();
  }
}

/** 관리자가 올린 평가지표 및 현황 템플릿을 저장합니다(8-1). 새로 올리면 이전 것을 덮어씁니다. */
export async function saveIndicatorTemplate(filename: string, buffer: Buffer): Promise<StoredIndicatorTemplate> {
  const template: StoredIndicatorTemplate = {
    filename,
    base64: buffer.toString("base64"),
    uploadedAt: nowIso()
  };

  const db = getFirebaseDb();
  if (db) {
    await db.collection(ADMIN_SETTINGS).doc(INDICATOR_TEMPLATE_DOC).set(template);
    return template;
  }

  globalThis.__schoolEvalIndicatorTemplate = template;
  return template;
}

export async function getIndicatorTemplate(): Promise<StoredIndicatorTemplate | null> {
  const db = getFirebaseDb();
  if (db) {
    const doc = await db.collection(ADMIN_SETTINGS).doc(INDICATOR_TEMPLATE_DOC).get();
    return doc.exists ? (plain(doc.data()) as StoredIndicatorTemplate) : null;
  }
  return globalThis.__schoolEvalIndicatorTemplate ?? null;
}

const INVITES = "builderInvites";

const memoryInvites: Map<string, BuilderInvite> =
  globalThis.__schoolEvalInvites ?? new Map<string, BuilderInvite>();

globalThis.__schoolEvalInvites = memoryInvites;

declare global {
  // eslint-disable-next-line no-var
  var __schoolEvalInvites: Map<string, BuilderInvite> | undefined;
}

export async function createBuilderInvite(input: {
  schoolId: string;
  schoolName: string;
  draftId: string;
  label: string;
  color?: WorkColor;
  audience?: Audience;
}): Promise<BuilderInvite> {
  const invite: BuilderInvite = {
    token: randomUUID(),
    schoolId: input.schoolId,
    schoolName: input.schoolName,
    draftId: input.draftId,
    label: input.label.trim(),
    color: input.color ?? defaultWorkColor(input.label),
    ...(input.audience ? { audience: input.audience } : {}),
    revoked: false,
    createdAt: nowIso()
  };

  const db = getFirebaseDb();
  if (db) {
    await db.collection(INVITES).doc(invite.token).set(invite);
    return invite;
  }
  memoryInvites.set(invite.token, invite);
  return invite;
}

export async function listBuilderInvites(schoolId: string): Promise<BuilderInvite[]> {
  const db = getFirebaseDb();
  const rows = db
    ? (await db.collection(INVITES).where("schoolId", "==", schoolId).get()).docs.map(
        (doc) => plain(doc.data()) as BuilderInvite
      )
    : Array.from(memoryInvites.values()).filter((invite) => invite.schoolId === schoolId);

  return rows
    .filter((invite) => !invite.revoked)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getBuilderInvite(token: string): Promise<BuilderInvite | null> {
  const db = getFirebaseDb();
  if (db) {
    const doc = await db.collection(INVITES).doc(token).get();
    return doc.exists ? (plain(doc.data()) as BuilderInvite) : null;
  }
  return memoryInvites.get(token) ?? null;
}

async function saveInvite(invite: BuilderInvite): Promise<void> {
  const db = getFirebaseDb();
  if (db) {
    await db.collection(INVITES).doc(invite.token).set(invite);
    return;
  }
  memoryInvites.set(invite.token, invite);
}

/** 부장이 제출을 누릅니다. */
export async function submitBuilderInvite(token: string): Promise<BuilderInvite> {
  const current = await getBuilderInvite(token);
  if (!current || current.revoked) {
    throw new NotFoundError("링크를 찾을 수 없습니다.");
  }
  const next = { ...current, submittedAt: nowIso() };
  await saveInvite(next);
  return next;
}

/** 제출한 부장이 문항을 다시 고치면 '작성 중'으로 돌아갑니다. */
export async function markInviteEdited(token: string): Promise<void> {
  const current = await getBuilderInvite(token);
  if (!current || !current.submittedAt) {
    return;
  }
  const { submittedAt: _submittedAt, ...rest } = current;
  await saveInvite(rest);
}

/** 부장 링크별로 담은 문항 수를 셉니다. 삭제된 문항은 뺍니다. */
export async function countOwnedItems(draftId: string): Promise<Record<string, number>> {
  const db = getFirebaseDb();
  const items: SelectedQuestion[] = db
    ? (await db.collection(DRAFTS).doc(draftId).collection(ITEMS).get()).docs.map((doc) =>
        hydrateItem(doc.id, doc.data())
      )
    : Array.from(memoryStateFor(draftId).items.values());
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (item.deleted || !item.ownerId) {
      continue;
    }
    counts[item.ownerId] = (counts[item.ownerId] ?? 0) + 1;
  }
  return counts;
}

export async function revokeBuilderInvite(schoolId: string, token: string): Promise<void> {
  const current = await getBuilderInvite(token);
  if (!current || current.schoolId !== schoolId) {
    throw new NotFoundError("링크를 찾을 수 없습니다.");
  }
  const next = { ...current, revoked: true };
  const db = getFirebaseDb();
  if (db) {
    await db.collection(INVITES).doc(token).set(next);
    return;
  }
  memoryInvites.set(token, next);
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

/** 연구부장 전용 배정. 문항 버전과 링크 유효성을 같은 트랜잭션에서 확인합니다. */
export async function assignDraftItems(schoolId: string, draftId: string, token: string, rows: { id: string; rev: number }[]): Promise<SelectedQuestion[]> {
  const prepare = (invite: BuilderInvite | null, items: SelectedQuestion[]): SelectedQuestion[] => {
    if (!invite || invite.revoked || invite.schoolId !== schoolId || invite.draftId !== draftId) throw new ForbiddenError("이 학교의 사용 중인 부장 링크를 선택하세요.");
    return items.map((item, index) => {
      if (item.deleted) throw new NotFoundError("삭제된 문항은 배정할 수 없습니다.");
      if (item.rev !== rows[index].rev) throw new ConflictError(item);
      if (invite.audience && invite.audience !== item.audience) throw new ForbiddenError("부장 링크의 대상과 문항 대상이 다릅니다.");
      return { ...item, ownerId: inviteOwnerId(token), ownerLabel: invite.label, rev: item.rev + 1, updatedAt: nowIso() };
    });
  };
  const db = getFirebaseDb();
  if (db) return db.runTransaction(async tx => {
    const inviteRef = db.collection(INVITES).doc(token);
    const inviteDoc = await tx.get(inviteRef);
    const refs = rows.map(row => db.collection(DRAFTS).doc(draftId).collection(ITEMS).doc(row.id));
    const docs = await tx.getAll(...refs);
    if (docs.some(doc => !doc.exists)) throw new NotFoundError("문항을 찾을 수 없습니다.");
    const next = prepare(inviteDoc.exists ? plain(inviteDoc.data()) as BuilderInvite : null, docs.map(doc => hydrateItem(doc.id, doc.data() ?? {})));
    next.forEach((item, index) => tx.set(refs[index], item));
    tx.update(inviteRef, { submittedAt: FieldValue.delete() });
    return next;
  });
  const state = memoryStateFor(draftId);
  const current = rows.map(row => state.items.get(row.id));
  if (current.some(item => !item)) throw new NotFoundError("문항을 찾을 수 없습니다.");
  const invite = memoryInvites.get(token) ?? null;
  const next = prepare(invite, current as SelectedQuestion[]);
  next.forEach(item => state.items.set(item.id, item));
  if (invite) { const { submittedAt: _submitted, ...rest } = invite; memoryInvites.set(token, rest); }
  return next;
}

/** 색상 변경은 링크 권한·제출 상태를 건드리지 않습니다. */
export async function setBuilderInviteColor(schoolId: string, token: string, color: WorkColor): Promise<void> {
  const validate = (invite: BuilderInvite | null) => {
    if (!invite || invite.schoolId !== schoolId || invite.revoked) throw new ForbiddenError("사용 중인 부장 링크를 선택하세요.");
  };
  const db = getFirebaseDb();
  if (db) {
    const ref = db.collection(INVITES).doc(token);
    await db.runTransaction(async tx => { const doc = await tx.get(ref); validate(doc.exists ? plain(doc.data()) as BuilderInvite : null); tx.update(ref, { color }); });
  } else { const invite = memoryInvites.get(token) ?? null; validate(invite); memoryInvites.set(token, { ...invite!, color }); }
}
