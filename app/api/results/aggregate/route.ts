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

  const { items } = await getDraftBundle(context.schoolId, context.schoolName);
  const aggregate = aggregateResultUploads(uploads as NonNullable<(typeof uploads)[number]>[], items);

  const result = await saveSurveyResult(context.draftId, {
    uploadedAt: new Date().toISOString(),
    ...aggregate
  });

  return jsonOk({ result });
}
