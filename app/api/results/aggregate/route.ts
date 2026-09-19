import { jsonError, jsonOk } from "@/lib/api";
import { resolveDraftContext } from "@/lib/draftApi";
import { aggregateResultUploads } from "@/lib/resultsAggregate";
import { getDraftBundle, getResultUpload, saveSurveyResult } from "@/lib/store";

type Body = {
  uploadIds?: string[];
};

/**
 * 확정된 결과 업로드들을 모아 4.8 계산을 실행합니다.
 * 여러 대상(교원/학부모/학생/직원) 파일을 한 번에 넘겨야 영역 평균이 제대로 나옵니다.
 */
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

  if (!Array.isArray(body?.uploadIds) || body.uploadIds.length === 0) {
    return jsonError("집계할 업로드가 없습니다.");
  }

  const uploads = await Promise.all(body.uploadIds.map((id) => getResultUpload(context.draftId, id)));
  const missing = uploads.some((upload) => upload === null);
  if (missing) {
    return jsonError("업로드한 결과 파일 일부를 찾을 수 없습니다.", 404);
  }

  if (new Set(body.uploadIds).size !== body.uploadIds.length || new Set(uploads.map(u => u!.audience)).size !== uploads.length) {
    return jsonError("대상별 결과 파일은 하나씩만 집계할 수 있습니다.");
  }
  const { draft, items } = await getDraftBundle(context.schoolId, context.schoolName);
  if (uploads.some(u => u!.mode !== draft.mode)) return jsonError('현재 평가 시기와 다른 응답 파일입니다. 해당 시기의 결과 파일을 다시 올려 주세요.');
  const aggregate = aggregateResultUploads(uploads as NonNullable<(typeof uploads)[number]>[], items);

  const result = await saveSurveyResult(context.draftId, {
    uploadedAt: new Date().toISOString(),
    mode: draft.mode,
    uploadIds: body.uploadIds,
    itemsSnapshot: items,
    uploadMappings: Object.fromEntries(uploads.map(u => [u!.id, u!.mapping])),
    ...aggregate
  });

  return jsonOk({ result });
}
