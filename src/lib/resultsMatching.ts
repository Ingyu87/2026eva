/**
 * 결과 파일의 열 제목을 문항에 연결합니다 (spec.md 3.3 S4-2, 7.4-4, 9장).
 *
 * 우선순위:
 *   1. 구글폼 생성 시점의 제목 스냅숏(`GoogleFormInfo.questionLinks`/`gradeQuestion`)
 *      — 학교가 나중에 앱에서 문항을 고쳐도 이 스냅숏은 그대로라 흔들리지 않습니다.
 *   2. 지금 앱에 저장된 문항 텍스트 — 구글폼을 안 쓰고 다른 방식으로 설문했을 때의 대비책입니다.
 * 그래도 못 찾으면 `unmatched`로 남기고, 사람이 S4의 수동 연결 화면에서 고릅니다.
 * 자동 연결에 실패해도 업로드 자체는 막지 않습니다(spec.md 9장 "문항 연결 실패").
 */

import type { GoogleFormInfo, SelectedQuestion } from "./types";

/** Google Forms API가 제목에 줄바꿈을 허용하지 않아 만든 것과 같은 정규화. googleForms.ts 참고. */
function normalize(text: string): string {
  return String(text ?? "")
    .replace(/\r\n?|\n/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export type ColumnMatch =
  | { status: "question"; questionId: string; matchedBy: "form-snapshot" | "current-text" }
  | { status: "grade"; matchedBy: "form-snapshot" }
  | { status: "unmatched" };

export function matchColumnToQuestion(
  columnHeader: string,
  audienceItems: SelectedQuestion[],
  formInfo?: GoogleFormInfo
): ColumnMatch {
  const normalizedHeader = normalize(columnHeader);
  if (!normalizedHeader) {
    return { status: "unmatched" };
  }

  if (formInfo?.gradeQuestion && normalize(formInfo.gradeQuestion.title) === normalizedHeader) {
    return { status: "grade", matchedBy: "form-snapshot" };
  }

  const link = formInfo?.questionLinks?.find((candidate) => normalize(candidate.title) === normalizedHeader);
  if (link) {
    return { status: "question", questionId: link.selectedQuestionId, matchedBy: "form-snapshot" };
  }

  const item = audienceItems.find(
    (candidate) => normalize(candidate.editedQuestion || candidate.originalQuestion) === normalizedHeader
  );
  if (item) {
    return { status: "question", questionId: item.id, matchedBy: "current-text" };
  }

  return { status: "unmatched" };
}

export type MatchedColumn = {
  column: string;
  match: ColumnMatch;
};

export function matchColumns(
  columnHeaders: string[],
  audienceItems: SelectedQuestion[],
  formInfo?: GoogleFormInfo
): MatchedColumn[] {
  return columnHeaders.map((column) => ({
    column,
    match: matchColumnToQuestion(column, audienceItems, formInfo)
  }));
}
