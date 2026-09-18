export const AUDIENCES = ["teacher", "parent", "student", "staff"] as const;

export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  teacher: "교원용",
  parent: "학부모용",
  student: "학생용",
  staff: "교직원용"
};

export type ResponseType = "likert_5" | "likert_3" | "yes_no" | "checklist" | "text";

export const RESPONSE_TYPE_LABELS: Record<ResponseType, string> = {
  likert_5: "5점 척도",
  likert_3: "3점 척도",
  yes_no: "예/아니오",
  checklist: "체크리스트",
  text: "서술형"
};

export type QuestionBankItem = {
  id: string;
  audience: Audience;
  audienceLabel: string;
  sourceSheet: string;
  sourceRow: number;
  area: string;
  subarea: string;
  indicator: string;
  question: string;
};

/**
 * 선택 문항. Firestore에서 `surveyDrafts/{draftId}/items/{id}` 문서 하나에 대응합니다.
 * 문서를 쪼개 두어야 서로 다른 문항을 동시에 편집해도 덮어쓰기가 발생하지 않습니다.
 */
export type SelectedQuestion = {
  id: string;
  /** 충돌 감지 전용. 저장할 때마다 1 증가하며 동기화 커서로 쓰지 않습니다. */
  rev: number;
  sourceQuestionId: string;
  audience: Audience;
  sourceRow: number;
  area: string;
  subarea: string;
  indicator: string;
  originalQuestion: string;
  editedQuestion: string;
  responseType: ResponseType;
  /** 분수 인덱스. 이동·삽입 시 자기 문서 하나만 쓰기 위해 실수를 사용합니다. */
  order: number;
  /** 삭제 표식. 문서를 지우면 동기화가 삭제를 전달할 수 없어 tombstone으로 남깁니다. */
  deleted?: boolean;
  createdAt: string;
  /** 서버가 찍는 ISO 문자열. 동기화 커서로 사용합니다. */
  updatedAt: string;
  /** 마지막 수정자 표시 이름. 인증이 아니라 안내용 라벨입니다. */
  updatedBy?: string;
};

/** 문항에 넣을 수 있는 수정 항목. id·rev·createdAt 등은 서버가 관리합니다. */
export type SelectedQuestionPatch = Partial<
  Pick<
    SelectedQuestion,
    | "editedQuestion"
    | "responseType"
    | "order"
    | "area"
    | "subarea"
    | "indicator"
    | "audience"
  >
>;

/** 새 문항을 만들 때 클라이언트가 보내는 값. */
export type NewSelectedQuestion = Pick<
  SelectedQuestion,
  | "id"
  | "sourceQuestionId"
  | "audience"
  | "sourceRow"
  | "area"
  | "subarea"
  | "indicator"
  | "originalQuestion"
  | "editedQuestion"
  | "responseType"
  | "order"
>;

export type GoogleFormInfo = {
  formId: string;
  editUrl: string;
  responderUrl?: string;
  createdAt: string;
  googleEmail?: string;
};

export type GoogleFormsByAudience = Partial<Record<Audience, GoogleFormInfo>>;

/** 설문 초안 작성·검토 분담(역할명은 학교에서 수정 가능) */
export type SurveyDraftAuthor = {
  id: string;
  title: string;
  done: boolean;
};

/**
 * 설문 초안의 메타 정보. 선택 문항은 별도 문서로 분리되어 있습니다.
 * @see SelectedQuestion
 */
export type SurveyDraft = {
  id: string;
  schoolId: string;
  schoolName: string;
  /** 충돌 감지 전용. 문항의 rev와는 별개로 돕니다. */
  rev: number;
  title: string;
  surveyDate: string;
  introByAudience: Record<Audience, string>;
  /** 비어 있으면 서버/클라이언트에서 기본 6개 역할로 채움 */
  draftAuthors?: SurveyDraftAuthor[];
  googleForm?: GoogleFormInfo;
  googleFormsByAudience?: GoogleFormsByAudience;
  createdAt: string;
  /** 서버가 찍는 ISO 문자열. 동기화 커서로 사용합니다. */
  updatedAt: string;
  updatedBy?: string;
};

/** 메타에 넣을 수 있는 수정 항목. */
export type SurveyDraftPatch = Partial<
  Pick<
    SurveyDraft,
    "title" | "surveyDate" | "schoolName" | "introByAudience" | "draftAuthors"
  >
>;

/** 초안 전체를 한 번에 내려줄 때 쓰는 묶음. */
export type DraftBundle = {
  draft: SurveyDraft;
  items: SelectedQuestion[];
  /** 다음 동기화 요청에 그대로 되돌려 보낼 커서. */
  since: string;
};

/** 같은 초안을 보고 있는 다른 사람. 30초간 갱신이 없으면 사라집니다. */
export type Presence = {
  sessionId: string;
  /** 표시용 라벨. 인증이 아니므로 권한 판단에 쓰지 않습니다. */
  displayName: string;
  audience: Audience;
  editingItemId?: string;
  updatedAt: string;
};

/** 폴링 응답. 변경분만 담습니다. */
export type SyncResponse = {
  /** 다음 요청에 그대로 보낼 커서. 실제로 본 것보다 앞서지 않습니다. */
  nextSince: string;
  /** 메타가 바뀌었을 때만 채워집니다. */
  draft: SurveyDraft | null;
  changed: SelectedQuestion[];
  deleted: string[];
  presence: Presence[];
};

/** 낙관적 잠금이 실패했을 때 서버가 돌려주는 본문. */
export type ConflictPayload<T> = {
  reason: "conflict";
  current: T | null;
};

export type School = {
  id: string;
  schoolName: string;
  schoolNameNormalized: string;
  passwordHash: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

export type PublicSchool = Omit<School, "passwordHash">;

export type ApiResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

export const LIKERT_5_OPTIONS = [
  "매우 그렇다",
  "그렇다",
  "보통이다",
  "그렇지 않다",
  "전혀 그렇지 않다"
];

export const LIKERT_3_OPTIONS = ["그렇다", "보통이다", "그렇지 않다"];

export const YES_NO_OPTIONS = ["예", "아니오"];
