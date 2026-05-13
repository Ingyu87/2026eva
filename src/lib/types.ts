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

export type SelectedQuestion = {
  id: string;
  sourceQuestionId: string;
  audience: Audience;
  sourceRow: number;
  area: string;
  subarea: string;
  indicator: string;
  originalQuestion: string;
  editedQuestion: string;
  responseType: ResponseType;
  order: number;
  createdAt: string;
  updatedAt: string;
};

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

export type SurveyDraft = {
  id: string;
  schoolId: string;
  schoolName: string;
  title: string;
  surveyDate: string;
  introByAudience: Record<Audience, string>;
  itemsByAudience: Record<Audience, SelectedQuestion[]>;
  /** 비어 있으면 서버/클라이언트에서 기본 6개 역할로 채움 */
  draftAuthors?: SurveyDraftAuthor[];
  googleForm?: GoogleFormInfo;
  googleFormsByAudience?: GoogleFormsByAudience;
  createdAt: string;
  updatedAt: string;
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
