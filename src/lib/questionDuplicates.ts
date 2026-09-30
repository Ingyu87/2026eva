/** 같은 응답 대상 안에서만 비교합니다. 판정이 아니라 추가 전 확인용 후보입니다. */
export function similarQuestion(a: string, b: string): boolean {
  const normalize = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
  const left = normalize(a), right = normalize(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (Math.min(left.length, right.length) < 10) return false;
  const pairs = (s: string) => new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)));
  const x = pairs(left), y = pairs(right);
  const overlap = [...x].filter(pair => y.has(pair)).length;
  return 2 * overlap / (x.size + y.size) >= 0.82;
}
