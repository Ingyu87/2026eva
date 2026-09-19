import { SURVEY_MODE_LABELS, type SurveyDraft, type SurveyResult } from "./types";

/**
 * 어떤 산출물을 지금 만들 수 있는지 판단합니다.
 *
 * 가이드북 Q12가 못박은 규칙 때문입니다.
 *   "중간평가는 학교교육활동에 대한 중간 점검의 과정입니다.
 *    학교평가서에는 학년말 최종 설문 평가 결과를 반영하도록 합니다."
 *
 * 즉 1학기 중간평가 결과로 제출 서류를 만들면 규정 위반입니다.
 * 화면 여러 곳에서 같은 판단을 하게 되므로 여기 한곳에 모읍니다.
 */

export type ExportKind =
  /** 설문지 DOCX — 시기와 무관하게 필요합니다. */
  | "survey-docx"
  /** 구글폼 — 시기와 무관합니다. */
  | "google-forms"
  /** 설문 결과 보고서 HTML — 중간평가에서도 씁니다(2학기 교육 활동 보완용). */
  | "result-html"
  /** 평가지표 및 현황 XLSX — 교육지원청 제출. 학년말만. */
  | "indicator-xlsx"
  /** 학교평가서 DOCX — 교육지원청 제출·누리집 탑재. 학년말만. */
  | "report-docx";

export type ExportAvailability = {
  allowed: boolean;
  /** 잠긴 이유. 버튼 툴팁에 그대로 씁니다. */
  reason?: string;
};

/** 학년말 학교평가에서만 만들 수 있는 산출물. */
const ANNUAL_ONLY: ExportKind[] = ["indicator-xlsx", "report-docx"];

export function canExport(
  kind: ExportKind,
  draft: Pick<SurveyDraft, "mode">,
  result?: Pick<SurveyResult, "mode">
): ExportAvailability {
  if (ANNUAL_ONLY.includes(kind) && result && result.mode !== 'annual') {
    return { allowed: false, reason: '학년말에 집계한 결과가 필요합니다. 시기만 바꾼 중간평가 결과나 시기가 기록되지 않은 예전 결과는 제출할 수 없습니다.' };
  }
  if (ANNUAL_ONLY.includes(kind) && draft.mode !== "annual") {
    return {
      allowed: false,
      reason: `지금은 '${SURVEY_MODE_LABELS[draft.mode]}'입니다. 제출 서류는 '${SURVEY_MODE_LABELS.annual}'에서만 만들 수 있습니다. (가이드북 Q12)`
    };
  }
  return { allowed: true };
}

/**
 * 지금 만들 수 없는 산출물 목록. 내보내기 화면에서 잠긴 버튼을 그릴 때 씁니다.
 *
 * 중간평가에서도 설문지와 결과 보고서는 필요하므로 화면 자체는 엽니다.
 * 잠기는 것은 그 안의 제출 서류 버튼입니다.
 */
export function blockedExports(
  draft: Pick<SurveyDraft, "mode">
): Array<{ kind: ExportKind; reason: string }> {
  return ANNUAL_ONLY.map((kind) => ({ kind, availability: canExport(kind, draft) }))
    .filter((entry) => !entry.availability.allowed)
    .map((entry) => ({ kind: entry.kind, reason: entry.availability.reason ?? "" }));
}
