import { jsonError, jsonOk } from "@/lib/api";
import { resolveDraftContext } from "@/lib/draftApi";
import { NotFoundError, updateSurveyResultAnalysis } from "@/lib/store";
import type { AiAnalysis } from "@/lib/types";

type Body = {
  resultId?: string;
  aiAnalysis?: AiAnalysis;
};

/** 사용자가 AI 해석 결과를 직접 고친 내용을 저장합니다(spec.md `/api/results/analysis`). */
export async function PATCH(request: Request) {
  const context = await resolveDraftContext({ leadOnly: true });
  if ("status" in context) {
    return context;
  }

  let body: Body | null;
  try {
    body = (await request.json()) as Body;
  } catch {
    body = null;
  }

  if (!body?.resultId || !body.aiAnalysis) {
    return jsonError("수정할 결과와 내용이 필요합니다.");
  }

  try {
    const result = await updateSurveyResultAnalysis(context.draftId, body.resultId, body.aiAnalysis);
    return jsonOk({ result });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return jsonError(error.message, 404);
    }
    return jsonError(error instanceof Error ? error.message : "저장에 실패했습니다.", 500);
  }
}
