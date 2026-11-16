import { buildVisualResultReport } from './resultVisualReport';
import type { SurveyDraft, SelectedQuestion, SurveyResult, ResultUpload } from './types';
export { splitChecklistAnswer } from './checklistAnswers';

export function buildResultReportHtml(draft: SurveyDraft, items: SelectedQuestion[], result: SurveyResult, uploads: ResultUpload[]): string {
  return buildVisualResultReport(draft, items, result, uploads);
}

export function resultReportFileName(draft: SurveyDraft): string {
  const safe = draft.schoolName.replace(/[<>:"/\\|?*\s]+/g, "_");
  return `설문결과_${safe}.html`;
}
