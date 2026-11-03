import type { ResultUpload, SelectedQuestion } from './types';

// 외부로는 정해진 주제명과 응답 건수만 전달합니다. 원문과 이름은 포함하지 않습니다.
const TOPICS: Record<string, string[]> = {
  '소통·안내': ['소통', '안내', '알림', '통신문'],
  '수업·평가': ['수업', '평가', '학습', '숙제'],
  '안전·생활교육': ['안전', '폭력', '생활지도', '따돌림'],
  '마음건강·상담': ['상담', '마음', '정서', '스트레스'],
  '급식': ['급식', '식단'],
  '교육환경': ['시설', '화장실', '교실', '운동장'],
  '독서·도서관': ['독서', '도서관', '책읽기'],
  '체험·행사': ['체험', '행사', '현장학습'],
  '방과후·돌봄': ['방과후', '돌봄'],
};
export function summarizeFreeText(uploads: ResultUpload[], items: SelectedQuestion[]): string {
  const lines: string[] = [];
  for (const upload of uploads) {
    const texts: string[] = [];
    for (const entry of upload.mapping) {
      if (!items.some(q => q.id === entry.questionId && q.audience === upload.audience && q.responseType === 'text' && !q.deleted)) continue;
      const col = upload.headers.indexOf(entry.column);
      if (col < 0) continue;
      for (const row of upload.rows) if (row[col]?.trim()) texts.push(row[col]);
    }
    if (!texts.length) continue;
    const counts = Object.entries(TOPICS).map(([topic, words]) => [topic, texts.filter(t => words.some(w => t.includes(w))).length] as const).filter(([, n]) => n > 0);
    lines.push(`${upload.audience}: 서술형 응답 ${texts.length}건. ${counts.map(([topic,n]) => `${topic} 언급 ${n}건`).join(', ')}`);
  }
  return lines.join('\n');
}
