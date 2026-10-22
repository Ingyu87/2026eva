import { AUDIENCE_LABELS, needsChoices, type Audience, type SelectedQuestion } from "./types";

const GRADE_OPTION = /^\d+학년$/;
const GRADE_ASK = /(몇\s*학년|현재\s*.*학년|^학년$)/;

/** 설정에서 넣는 학년 문항과 같은 뜻이면 구글폼에 한 번 더 넣지 않습니다. */
export function isDuplicateGradeQuestion(item: Pick<SelectedQuestion, "editedQuestion" | "originalQuestion" | "choices" | "responseType">): boolean {
  const title = `${item.editedQuestion || item.originalQuestion}`.replace(/\s+/g, " ").trim();
  const options = (item.choices ?? []).map((choice) => choice.trim()).filter(Boolean);
  if (!GRADE_ASK.test(title)) {
    return false;
  }
  if (options.length >= 2 && options.every((choice) => GRADE_OPTION.test(choice))) {
    return true;
  }
  return item.responseType === "choice_single" && options.length === 0;
}

export function googleFormReadyIssues(
  items: Array<Pick<SelectedQuestion, "audience" | "editedQuestion" | "originalQuestion" | "responseType" | "choices" | "deleted">>,
  draft?: { studentGrades?: number[] }
): string[] {
  const live = items.filter((item) => !item.deleted);
  const issues: string[] = [];
  if (live.some((item) => item.audience === "student") && !(draft?.studentGrades && draft.studentGrades.length > 0)) {
    issues.push("설정(⚙)에서 학생 설문 학년을 먼저 고르세요. 학생용 폼 맨 앞에 학년 문항이 들어갑니다.");
  }
  for (const item of live) {
    if (item.audience === "student" && isDuplicateGradeQuestion(item)) {
      continue;
    }
    if (!needsChoices(item.responseType)) {
      continue;
    }
    const options = (item.choices ?? []).map((choice) => choice.trim()).filter(Boolean);
    if (options.length < 2) {
      const title = (item.editedQuestion || item.originalQuestion || "제목 없는 문항").trim();
      issues.push(`${AUDIENCE_LABELS[item.audience as Audience]}: 선택형 보기 부족 — ${title}`);
    }
  }
  return issues;
}
