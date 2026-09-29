import { jsonError, jsonOk } from "@/lib/api";
import { resolveDraftContext, readJson } from "@/lib/draftApi";
import { recommendPriorQuestions } from "@/lib/priorSurvey";
export async function POST(request: Request) {
 const context = await resolveDraftContext();
 if ("status" in context) return context;
 const body = await readJson<{items?: {question: string; choices?: string[]; responseType?: string}[]}>(request);
 if (!Array.isArray(body?.items) || !body.items.length || body.items.length > 50 || body.items.some(i => !i || typeof i.question !== "string" || i.question.length > 10000 || (i.responseType !== undefined && typeof i.responseType !== "string") || (i.choices !== undefined && (!Array.isArray(i.choices) || i.choices.length > 100 || i.choices.some(c => typeof c !== "string" || c.length > 2000))))) return jsonError("검토할 문항을 확인하세요.");
 try { return jsonOk({items: await recommendPriorQuestions(body.items)}); }
 catch { return jsonError("AI 추천을 불러오지 못했습니다. 다시 시도하거나 직접 분류하세요."); }
}
