import { jsonError, jsonOk } from "@/lib/api";
import { resolveDraftContext, draftWriteError } from "@/lib/draftApi";
import { NotFoundError, updateSurveyResultAnalysis } from "@/lib/store";
import type { AiAnalysis } from "@/lib/types";
import { isAnalysisStructure } from '@/lib/reportReadiness';

type Body = {
  resultId?: string;
  expectedUpdatedAt?: string;
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

  if (typeof body?.resultId !== 'string' || !body.resultId.trim()
      || typeof body.expectedUpdatedAt !== 'string' || !body.expectedUpdatedAt.trim()) {
    return jsonError("수정할 결과와 내용이 필요합니다.");
  }
  if (!isAnalysisStructure(body.aiAnalysis)) {
    return jsonError('평가 의견의 자료 형식이 올바르지 않습니다. 영역·의견 구분·내용을 확인해 주세요.');
  }

  try {
    const result = await updateSurveyResultAnalysis(context.draftId, body.resultId, body.aiAnalysis, body.expectedUpdatedAt);
    return jsonOk({ result });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return jsonError(error.message, 404);
    }
    return draftWriteError(error);
  }
}
