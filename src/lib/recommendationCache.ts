type Input = { question: string; choices?: string[]; responseType?: string };
type Recommendation = { subarea: string; responseType: string | null };
const pending = new Map<string, Promise<Recommendation[]>>();
const memory = new Map<string, { at: number; rows: Recommendation[] }>();
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** 학교 초안·내용·분류 버전이 같으면 재접속해도 추천 결과를 재사용합니다. */
export async function cachedRecommendations(scope: string, items: Input[]): Promise<Recommendation[]> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(items)));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const key = `classification-2026-v1:${scope}:${hash}`;
  let cached = memory.get(key);
  try { cached ??= JSON.parse(localStorage.getItem(key) ?? "null"); } catch { /* 메모리로 계속 작업 */ }
  if (cached && Date.now() - cached.at < MAX_AGE && Array.isArray(cached.rows) && cached.rows.length === items.length) return cached.rows;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    const response = await fetch("/api/ingest/prior-survey/review", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }), signal: AbortSignal.timeout(120000)
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok || !Array.isArray(payload.data?.items) || payload.data.items.length !== items.length) throw new Error("분류 실패");
    const value = { at: Date.now(), rows: payload.data.items as Recommendation[] };
    memory.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 제한 시 메모리 캐시 유지 */ }
    return value.rows;
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}
