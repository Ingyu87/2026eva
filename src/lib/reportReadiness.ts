import { AREAS, isCurrentSubarea } from './evaluationFramework';
import { AUDIENCE_SHORT_LABELS, type AiAnalysis, type SurveyResult } from './types';

const categories = ['우수한 점', '개선할 점', '컨설팅장학 등 교육청 지원이 필요한 부분'];
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';

/** 작성 중인 빈칸은 허용하되, 화면·DOCX 생성에 필요한 자료 구조는 저장 전에 검증합니다. */
export function isAnalysisStructure(value: unknown): value is AiAnalysis {
  if (!record(value) || !Array.isArray(value.areas) || !Array.isArray(value.consultingNeeds)
      || !Array.isArray(value.featuredCases) || !text(value.overallOpinion)) return false;
  const finding = (f: unknown): boolean => {
    if (!record(f) || !text(f.category) || !categories.includes(f.category)
        || !text(f.subarea) || !text(f.indicator) || !text(f.content)
        || (f.cause !== undefined && !text(f.cause)) || (f.action !== undefined && !text(f.action))
        || (f.needsReview !== undefined && typeof f.needsReview !== 'boolean')
        || !Array.isArray(f.evidence)) return false;
    return f.evidence.every(e => record(e) && text(e.questionId) && text(e.subject)
      && typeof e.value === 'number' && Number.isFinite(e.value));
  };
  const seen = new Set<string>();
  for (const area of value.areas) {
    if (!record(area) || !text(area.area) || !AREAS.some(a => a.name === area.area)
        || seen.has(area.area) || !Array.isArray(area.findings) || !area.findings.every(finding)) return false;
    seen.add(area.area);
  }
  return value.consultingNeeds.every(f => finding(f) && f.category === categories[2])
    && value.featuredCases.every(c => record(c) && text(c.subarea) && text(c.content));
}

export function reportReadiness(result: SurveyResult): string[] {
  const issues: string[] = [];
  if (result.aiAnalysis !== undefined && !isAnalysisStructure(result.aiAnalysis)) {
    return ['저장된 평가 의견의 자료 형식이 올바르지 않습니다. 평가 의견을 다시 작성하거나 수정해 주세요.'];
  }
  issues.push(...resultDataIssues(result));
  for (const area of AREAS) {
    const findings = result.aiAnalysis?.areas.find(a => a.area === area.name)?.findings ?? [];
    if (!findings.some(f => f.content.trim() && f.indicator.trim() && area.subareas.includes(f.subarea))) issues.push(`${area.code}영역의 평가 의견·세부영역·평가지표를 작성하세요.`);
  }
  for (const area of result.aiAnalysis?.areas ?? []) {
    for (const finding of area.findings) {
      if (!finding.content.trim() && !finding.indicator.trim() && !finding.cause?.trim() && !finding.action?.trim()) continue;
      if (!finding.content.trim() || !finding.indicator.trim() || !AREAS.find(a => a.name === area.area)?.subareas.includes(finding.subarea)) issues.push('작성한 평가 의견의 내용·평가지표·해당 영역의 세부영역을 모두 확인하세요.');
    }
  }
  for (const finding of result.aiAnalysis?.consultingNeeds ?? []) {
    const started = [finding.content, finding.indicator, finding.subarea, finding.cause, finding.action].some(v => v?.trim());
    if (started && (!finding.content.trim() || !finding.indicator.trim() || !isCurrentSubarea(finding.subarea))) issues.push('작성한 교육청 지원 요청의 내용·세부영역·평가지표를 모두 확인하세요.');
  }
  for (const entry of result.aiAnalysis?.featuredCases ?? []) {
    if ((entry.content.trim() || entry.subarea.trim()) && (!entry.content.trim() || !isCurrentSubarea(entry.subarea))) issues.push('작성한 특색사례의 내용과 세부영역을 확인하세요.');
  }
  const findings = [...(result.aiAnalysis?.areas.flatMap(a => a.findings) ?? []), ...(result.aiAnalysis?.consultingNeeds ?? [])];
  if (findings.some(f => f.needsReview)) issues.push('AI가 확인을 요청한 평가 의견의 근거를 검토하세요.');
  return [...new Set(issues)];
}

/** 제출 서류 공통: 평가 대상·영역·실시 문항의 유효 응답 확인. */
export function resultDataIssues(result: SurveyResult): string[] {
  const issues: string[] = [];
  for (const audience of ['teacher', 'parent', 'student'] as const) {
    const missing = AREAS.filter(area => !result.areaStats.some(s => s.audience === audience && s.area === area.name && s.subtotal.reduce((a,b) => a+b,0) > 0));
    if (missing.length) issues.push(`${AUDIENCE_SHORT_LABELS[audience]}: ${missing.map(a => a.code).join('·')}영역의 5점 척도 응답이 없습니다.`);
  }
  for (const item of result.itemsSnapshot ?? []) {
    if (item.deleted || item.responseType !== 'likert_5') continue;
    if (!result.questionStats.some(s => s.questionId === item.id && s.audience === item.audience && s.grade === undefined && s.responseCount > 0)) issues.push(`${AUDIENCE_SHORT_LABELS[item.audience]} 문항 ‘${item.editedQuestion || item.originalQuestion}’의 유효 응답이 없습니다. 연결 상태와 응답 파일을 확인하세요.`);
  }
  return issues;
}
