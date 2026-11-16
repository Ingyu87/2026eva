/** Google Forms의 응답 시각 열만 제외합니다. 질문 문장의 부분 일치는 제외하지 않습니다. */
export function isTimestampColumn(header: string): boolean {
  const name = String(header ?? '').replace(/^\uFEFF/, '').trim().toLowerCase();
  return name === '타임스탬프' || name === 'timestamp';
}
