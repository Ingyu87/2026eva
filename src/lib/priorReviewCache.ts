// 같은 탭의 설정 창 이동·새로고침에 대비합니다. 학교/초안별로 분리합니다.
const fallback = new Map<string, unknown>();
const keyOf = (draftId: string) => `prior-review:v1:${draftId}`;
export function readPriorReview<T>(draftId: string): T | null {
  const key = keyOf(draftId);
  if (fallback.has(key)) return fallback.get(key) as T;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!Array.isArray(value) || value.some(source => !source || typeof source.id !== "string" || typeof source.name !== "string" || !Array.isArray(source.items))) return null;
    return value as T;
  } catch { return null; }
}
export function writePriorReview(draftId: string, sources: unknown[]): boolean {
  const key = keyOf(draftId);
  fallback.set(key, sources);
  try {
    if (sources.length) window.sessionStorage.setItem(key, JSON.stringify(sources));
    else window.sessionStorage.removeItem(key);
    return true;
  } catch { return false; }
}
