/** 학교 내부 검토 기록이며 교육청의 추가 의무 항목을 뜻하지 않습니다. */
export const REVIEW_CHECKS = [
  { id: 'evidence', label: '평가 의견을 실제 활동 자료·회의록·설문 결과와 대조했습니다.' },
  { id: 'coverage', label: '대상별 실시 문항과 누락·제외한 응답 열을 확인했습니다.' },
  { id: 'followup', label: '개선 과제의 담당·시기와 다음 연도 교육계획 반영 방법을 검토했습니다.' },
  { id: 'document', label: '내려받은 문서의 학교명·학년도·표·쪽 나눔을 확인했습니다.' }
] as const;

export function validResultReview(value: unknown): value is { label: string; review: { note: string; checked: string[] } } {
  if (!value || typeof value !== 'object') return false;
  const data = value as { label?: unknown; review?: { note?: unknown; checked?: unknown } };
  return typeof data.label === 'string' && data.label.trim().length <= 60
    && !!data.review && typeof data.review.note === 'string' && data.review.note.length <= 5000
    && Array.isArray(data.review.checked) && new Set(data.review.checked).size === data.review.checked.length
    && data.review.checked.every(id => REVIEW_CHECKS.some(check => check.id === id));
}
