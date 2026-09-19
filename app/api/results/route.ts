import { jsonOk, jsonError } from '@/lib/api';
import { resolveDraftContext, draftWriteError } from '@/lib/draftApi';
import { deleteResultData, listResultUploads, listSurveyResults, updateSurveyResultReview } from '@/lib/store';
import { validResultReview } from '@/lib/reviewChecklist';

/** 같은 학교의 저장된 작업만 복원. 응답 원문은 브라우저로 다시 보내지 않습니다. */
export async function GET() {
  const context = await resolveDraftContext({ leadOnly: true });
  if ('status' in context) return context;
  const [uploads, results] = await Promise.all([
    listResultUploads(context.draftId), listSurveyResults(context.draftId)
  ]);
  return jsonOk({
    uploads: uploads.map(u => ({
      uploadId: u.id, audience: u.audience, filename: u.filename,
      responseCount: u.rows.length,
      columns: u.mapping.map(m => ({ column: m.column, questionId: m.questionId,
        isGrade: m.isGrade, status: m.isGrade ? 'grade' : m.questionId ? 'question' : 'unmatched' }))
    })), results
  });
}

export async function DELETE() {
  const context = await resolveDraftContext({ leadOnly: true });
  if ('status' in context) return context;
  await deleteResultData(context.draftId);
  return jsonOk({ deleted: true });
}

export async function PATCH(request: Request) {
  const context = await resolveDraftContext({ leadOnly: true });
  if ('status' in context) return context;
  const body = await request.json().catch(() => null);
  const resultId = body?.resultId;
  const expectedUpdatedAt = body?.expectedUpdatedAt;
  if (!validResultReview(body) || typeof resultId !== 'string' || !resultId
      || typeof expectedUpdatedAt !== 'string' || !expectedUpdatedAt) {
    return jsonError('집계 이름은 60자, 검토 메모는 5,000자 이내로 입력하세요.');
  }
  try {
    const result = await updateSurveyResultReview(context.draftId, resultId, expectedUpdatedAt,
      { label: body.label.trim(), review: body.review });
    return jsonOk({ result });
  } catch (error) { return draftWriteError(error); }
}
