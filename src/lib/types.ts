export const AUDIENCES = ["teacher", "parent", "student", "staff"] as const;

/**
 * 평가 시기. 기본계획 p.11과 가이드북 p.10·56의 일정을 따릅니다.
 *
 *   interim  1학기 중간평가 (7월)      — 교육 활동을 고쳐 나가기 위한 점검
 *   annual   학년말 학교평가 (11~12월) — 제출 서류의 근거가 되는 최종 평가
 */
export const SURVEY_MODES = ["interim", "annual"] as const;

export type SurveyMode = (typeof SURVEY_MODES)[number];

export const SURVEY_MODE_LABELS: Record<SurveyMode, string> = {
  interim: "1학기 중간평가",
  annual: "학년말 학교평가"
};

export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  teacher: "교원용",
  parent: "학부모용",
  student: "학생용",
  staff: "교직원용"
};

export type ResponseType =
  | "likert_5"
  | "likert_3"
  | "yes_no"
  | "choice_single"
  | "checklist"
  | "text";

export const RESPONSE_TYPES: ResponseType[] = [
  "likert_5",
  "likert_3",
  "yes_no",
  "choice_single",
  "checklist",
  "text"
];

export const RESPONSE_TYPE_LABELS: Record<ResponseType, string> = {
  likert_5: "5점 척도",
  likert_3: "3점 척도",
  yes_no: "예 / 아니오",
  choice_single: "객관식 (하나 선택)",
  checklist: "객관식 (여러 개 선택)",
  text: "서술형"
};

/** 보기 목록을 학교가 직접 써야 하는 유형. */
export function needsChoices(type: ResponseType): boolean {
  return type === "choice_single" || type === "checklist";
}

/**
 * 영역 평균점수 계산에 들어가는 유형인지.
 *
 * 가이드북 p.9와 p.51은 정량평가를 **5단계 척도**로 전제합니다.
 * 4단계 환산 공식도 5점 기준이라, 다른 유형은 평균 계산에 넣을 수 없습니다.
 * 정성평가(서술형)와 선호도 조사(객관식)는 병행하되 집계와는 분리합니다.
 */
export function countsTowardAreaMean(type: ResponseType): boolean {
  return type === "likert_5";
}

/** 유형별 기본 보기. 유형을 바꿀 때 비어 있지 않게 채워 줍니다. */
export function defaultChoices(type: ResponseType): string[] | undefined {
  return needsChoices(type) ? ["", ""] : undefined;
}

/**
 * 교육청 예시자료에서 읽어온 읽기 전용 문항.
 *
 * 2026 예시자료에는 **평가주체 구분이 없습니다**(영역·세부영역·평가지표·예시문항 4열).
 * 2025처럼 대상별 시트로 나뉘어 있지 않으므로 풀은 하나이고,
 * 주체는 학교가 담을 때 지정합니다.
 */
export type QuestionBankItem = {
  id: string;
  year: number;
  schoolLevel: "elementary" | "middle" | "high" | "special";
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
  /**
   * 같은 예시문항을 여러 대상에 담았을 때 그 문항들을 묶는 값.
   *
   * 대상별로 문서를 따로 두는 이유는 두 가지입니다. 순서가 대상마다 달라야 하고,
   * 가이드북 41쪽이 **같은 지표라도 대상에 맞는 용어로 다르게 서술하라**고 하기 때문입니다.
   * 서식3-2의 '평가주체' 열과 지표별 주체 매트릭스는 이 값으로 모아서 만듭니다.
   */
  groupId: string;
  audience: Audience;
  sourceRow: number;
  area: string;
  subarea: string;
  indicator: string;
  originalQuestion: string;
  editedQuestion: string;
  responseType: ResponseType;
  /** 선택형일 때의 보기 목록. */
  choices?: string[];
  /** 평가지표 담당부서. (기본계획 Ⅴ-3-나-3, 서식1) */
  department?: string;
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
    | "choices"
    | "department"
  >
>;

/** 새 문항을 만들 때 클라이언트가 보내는 값. */
export type NewSelectedQuestion = Pick<
  SelectedQuestion,
  | "id"
  | "sourceQuestionId"
  | "groupId"
  | "audience"
  | "sourceRow"
  | "area"
  | "subarea"
  | "indicator"
  | "originalQuestion"
  | "editedQuestion"
  | "responseType"
  | "order"
> &
  Partial<Pick<SelectedQuestion, "choices" | "department">>;

/**
 * 문항 하나가 구글폼의 어느 문항으로 만들어졌는지 기록한 연결표.
 *
 * 폼 생성 시점에 실제로 보낸 제목(title) 문자열을 그대로 남겨 둡니다. 이후 학교가
 * 구글폼에서 문항을 직접 고치거나, 앱에서 `editedQuestion`을 다시 고쳐도
 * 이 스냅숏을 기준으로 결과 파일의 열 제목과 이어붙일 수 있습니다(spec.md 7.4).
 * 스냅숏과 결과 파일의 열 제목이 달라졌으면 자동 연결이 실패하고, S4의
 * 수동 연결 화면에서 사람이 골라야 합니다.
 */
export type GoogleFormQuestionLink = {
  itemId: string;
  selectedQuestionId: string;
  title: string;
};

/** 학생용 폼 맨 앞에 자동으로 넣는 학년 분류 문항의 연결 정보. */
export type GoogleFormGradeQuestion = {
  itemId: string;
  title: string;
  grades: number[];
};

export type GoogleFormInfo = {
  formId: string;
  editUrl: string;
  responderUrl?: string;
  createdAt: string;
  googleEmail?: string;
  questionLinks?: GoogleFormQuestionLink[];
  gradeQuestion?: GoogleFormGradeQuestion;
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
  /**
   * 평가 시기.
   *
   * 가이드북 Q12: 1학기 중간평가 결과는 학교평가서 평균점수에 반영하지 않고,
   * **학년말 최종 설문 결과만** 반영합니다. 제출 서류는 `annual`에서만 만듭니다.
   */
  mode: SurveyMode;
  title: string;
  surveyDate: string;
  introByAudience: Record<Audience, string>;
  /** 학생 설문을 받을 학년. 결과 보고서의 학년별 분해에 쓰입니다. */
  studentGrades?: number[];
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
    | "title"
    | "surveyDate"
    | "schoolName"
    | "introByAudience"
    | "draftAuthors"
    | "mode"
    | "studentGrades"
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

/** 5점 척도 응답 분포. 인덱스 0 = 5점 응답 수 ... 인덱스 4 = 1점 응답 수. */
export type Distribution5 = [number, number, number, number, number];

/** 문항 하나의 집계 결과. `src/lib/scoring.ts`가 계산하고 여기 그대로 저장합니다. */
export type QuestionStat = {
  questionId: string;
  audience: Audience;
  /** 학생 문항일 때만. 없으면 전체(학년 구분 없음) 집계입니다. */
  grade?: number;
  distribution: Distribution5;
  responseCount: number;
  /** 반올림 전 원값. 4단계 판정에는 이 값을 씁니다 (evaluationFramework.ts `toGrade`). */
  mean: number;
};

/** 4단계 판정 라벨. `src/lib/evaluationFramework.ts`의 `GradeLabel`과 같은 값입니다. */
export type Grade4 = "매우 우수" | "우수" | "보통" | "미흡";

/** 영역 × 평가주체 하나의 집계 결과 (서식3-1: 3영역 × 4주체 × 4단계). */
export type AreaStat = {
  area: string;
  audience: Audience;
  subtotal: Distribution5;
  /** 반올림 전 원값. */
  mean: number;
  /** 소수 첫째 자리. 화면 표시 전용, 판정에는 쓰지 않습니다. */
  meanRounded: number;
  grade4: Grade4;
};

/** 결과 파일의 열 하나를 어디에 연결했는지. `null`은 "이 열은 집계에 안 씀"(연결 안 됨/직접 제외). */
export type ResultColumnMapping = {
  column: string;
  questionId?: string;
  isGrade?: boolean;
};

/**
 * `surveyDrafts/{draftId}/resultUploads/{uploadId}` — 결과 파일 업로드 1건의 원본 + 연결 상태.
 *
 * 업로드 직후에는 열 제목을 자동 연결한 초안 상태이고, S4의 수동 연결 화면에서
 * 사람이 확인·수정한 뒤 확정합니다. 여러 대상(교원/학부모/학생/직원) 파일을 각각 올려
 * `POST /api/results/aggregate`에서 한 번에 계산합니다(spec.md 6.2).
 */
export type ResultUpload = {
  id: string;
  audience: Audience;
  filename: string;
  headers: string[];
  rows: string[][];
  mapping: ResultColumnMapping[];
  createdAt: string;
  updatedAt: string;
};

/** 서식3-1의 세 구분과 1:1 대응 (spec.md 4.9). */
export type AiFindingCategory = "우수한 점" | "개선할 점" | "컨설팅장학 등 교육청 지원이 필요한 부분";

/** AI가 문장에 붙이는 근거. `questionId`+`subject`로 실제 집계 결과와 대조합니다(환각 방지). */
export type AiEvidence = {
  questionId: string;
  /** 표시용 주체 라벨: "학생"·"학부모"·"교원"·"직원". */
  subject: string;
  value: number;
};

/** 원인 → 개선방안 4단 구조 중 결과·원인·방안 3단(가이드북 p.37). `evidence`는 필수입니다. */
export type AiFinding = {
  category: AiFindingCategory;
  subarea: string;
  indicator: string;
  content: string;
  cause?: string;
  action?: string;
  evidence: AiEvidence[];
  /** 환각 방지 검증에 최종 실패해 내용을 비운 경우. 화면에 "⚠ 확인 필요"로 표시합니다. */
  needsReview?: boolean;
};

export type AiFeaturedCase = {
  subarea: string;
  content: string;
};

export type AiAreaAnalysis = {
  area: string;
  findings: AiFinding[];
};

/** Gemini 해석 결과 (spec.md 4.9 출력 형식). 자유 산문이 아니라 구조화 JSON입니다. */
export type AiAnalysis = {
  areas: AiAreaAnalysis[];
  consultingNeeds: AiFinding[];
  featuredCases: AiFeaturedCase[];
  overallOpinion: string;
};

/** `surveyDrafts/{draftId}/results/{resultId}` — 결과 파일 업로드 1회의 집계 결과. */
export type SurveyResult = {
  id: string;
  uploadedAt: string;
  responsesByAudience: Partial<Record<Audience, number>>;
  questionStats: QuestionStat[];
  areaStats: AreaStat[];
  aiAnalysis?: AiAnalysis;
  aiGeneratedAt?: string;
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
