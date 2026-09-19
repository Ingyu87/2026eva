import { jsonError, jsonOk } from "@/lib/api";
import { resolveDraftContext } from "@/lib/draftApi";
import { analyzeResults } from "@/lib/aiAnalysis";
import { maskPersonalInfo } from "@/lib/piiMask";
import { getDraftBundle, getResultUpload, getSurveyResult, updateSurveyResultAnalysis } from "@/lib/store";
import type { Audience, SelectedQuestion } from "@/lib/types";

type Body = {
  resultId?: string;
  uploadIds?: string[];
  schoolContext?: string;
};

/** 업로드된 서술형 응답을 마스킹해 모읍니다. 5점 척도 문항은 이미 questionStats에 있으므로 여기서 다루지 않습니다. */
function collectMaskedFreeText(
  uploads: Array<{ audience: Audience; headers: string[]; rows: string[][]; mapping: Array<{ questionId?: string }> }>,
  items: SelectedQuestion[]
): Array<{ audience: Audience; text: string }> {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const entries: Array<{ audience: Audience; text: string }> = [];

  for (const upload of uploads) {
    upload.mapping.forEach((entry, colIndex) => {
      const item = entry.questionId ? itemById.get(entry.questionId) : undefined;
      if (!item || item.responseType !== "text") {
        return;
      }
      for (const row of upload.rows) {
        const raw = (row[colIndex] ?? "").trim();
        if (raw) {
          entries.push({ audience: upload.audience, text: maskPersonalInfo(raw) });
        }
      }
    });
  }

  return entries;
}

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

  const result = await getSurveyResult(context.draftId, body.resultId);
  if (!result) {
    return jsonError("집계 결과를 찾을 수 없습니다.", 404);
  }

  const uploads = await Promise.all(body.uploadIds.map((id) => getResultUpload(context.draftId, id)));
  if (uploads.some((upload) => upload === null)) {
    return jsonError("업로드한 결과 파일 일부를 찾을 수 없습니다.", 404);
  }

  const { draft, items } = await getDraftBundle(context.schoolId, context.schoolName);
  const nonNullUploads = uploads as NonNullable<(typeof uploads)[number]>[];
  const maskedFreeText = collectMaskedFreeText(nonNullUploads, items);

  try {
    const aiAnalysis = await analyzeResults({
      schoolName: draft.schoolName,
      schoolContext: body.schoolContext,
      items,
      questionStats: result.questionStats,
      areaStats: result.areaStats,
      maskedFreeText
    });
    const updated = await updateSurveyResultAnalysis(context.draftId, result.id, aiAnalysis);
    return jsonOk({ result: updated });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "AI 해석에 실패했습니다.", 500);
  }
}
