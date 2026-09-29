import { jsonError, jsonOk } from "@/lib/api";
import { resolveDraftContext, readJson } from "@/lib/draftApi";
import { recommendPriorSubareas } from "@/lib/priorSurvey";
export async function POST(request: Request) {
  const context = await resolveDraftContext({ leadOnly: true });
  if ("status" in context) return context;
  const body = await readJson<{questions?: unknown}>(request);
  if (!Array.isArray(body?.questions) || !body.questions.length || body.questions.length > 200 || body.questions.some(q => typeof q !== "string" || q.length > 10000)) return jsonError("문항을 1~200개 선택하세요.");
  try { return jsonOk({ subareas: await recommendPriorSubareas(body.questions) }); }
  catch { return jsonError("AI 분류 추천에 실패했습니다. 그대로 가져온 뒤 수정할 수 있습니다."); }
}
