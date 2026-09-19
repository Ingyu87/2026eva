import { jsonError, jsonOk } from "@/lib/api";
import { resolveDraftContext, draftWriteError } from "@/lib/draftApi";
import { analyzeResults } from "@/lib/aiAnalysis";
import { maskPersonalInfo } from "@/lib/piiMask";
import { ConflictError, getDraftBundle, getSurveyResult, updateSurveyResultAnalysis } from "@/lib/store";
import type { Audience } from "@/lib/types";

type Body = {
  resultId?: string;
  uploadIds?: string[];
  schoolContext?: string;
  transmissionConfirmed?: boolean;
};

/** 7단계: 집계 결과를 Gemini로 해석합니다. 계산은 이미 끝난 상태로 들어갑니다(spec.md 4.9). */
export async function POST(request: Request) {
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

  if (!body?.resultId || !Array.isArray(body.uploadIds) || body.uploadIds.length === 0) {
    return jsonError("해석할 집계 결과와 원본 업로드를 지정하세요.");
  }
  if (body.transmissionConfirmed !== true) return jsonError('AI 전송 항목을 먼저 확인해 주세요.');

  const result = await getSurveyResult(context.draftId, body.resultId);
  if (!result) {
    return jsonError("집계 결과를 찾을 수 없습니다.", 404);
  }

  const { draft, items } = await getDraftBundle(context.schoolId, context.schoolName);
  // 선택적 AI 기능에는 원문·자동 가림에 의존한 서술형 응답을 보내지 않습니다.
  const maskedFreeText: Array<{ audience: Audience; text: string }> = [];

  try {
    const aiAnalysis = await analyzeResults({
      schoolName: draft.schoolName,
      schoolContext: body.schoolContext ? maskPersonalInfo(body.schoolContext) : undefined,
      items: result.itemsSnapshot ?? items,
      questionStats: result.questionStats,
      areaStats: result.areaStats,
      maskedFreeText
    });
    const updated = await updateSurveyResultAnalysis(context.draftId, result.id, aiAnalysis, result.updatedAt);
    return jsonOk({ result: updated });
  } catch (error) {
    if (error instanceof ConflictError) return draftWriteError(error);
    return jsonError(error instanceof Error ? error.message : "AI 해석에 실패했습니다.", 500);
  }
}
