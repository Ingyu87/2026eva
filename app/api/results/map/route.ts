import { jsonError, jsonOk } from "@/lib/api";
import { resolveDraftContext } from "@/lib/draftApi";
import { getDraftBundle, getResultUpload, NotFoundError, updateResultUploadMapping } from "@/lib/store";
import type { ResultColumnMapping } from "@/lib/types";

type Body = {
  uploadId?: string;
  mapping?: ResultColumnMapping[];
};

/** S4 수동 연결 화면에서 사람이 고친 열 ↔ 문항 연결표를 확정합니다. */
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

  if (!body?.uploadId || !Array.isArray(body.mapping)) {
    return jsonError("연결표가 올바르지 않습니다.");
  }

  try {
    const previous = await getResultUpload(context.draftId, body.uploadId);
    if (!previous) return jsonError('응답 파일을 찾을 수 없습니다.', 404);
    const { items } = await getDraftBundle(context.schoolId, context.schoolName);
    const ids = new Set<string>();
    let grades = 0;
    if (body.mapping.length !== previous.headers.length) return jsonError('응답 열 수와 연결표가 다릅니다.');
    for (let i = 0; i < body.mapping.length; i++) {
      const entry = body.mapping[i];
      if (!entry || entry.column !== previous.headers[i]) return jsonError('응답 열 순서가 올바르지 않습니다.');
      if (entry.isGrade && (++grades > 1 || previous.audience !== 'student' || entry.questionId)) return jsonError('학년 열은 학생용에서 하나만 지정하세요.');
      if (entry.questionId) {
        if (ids.has(entry.questionId) || !items.some(item => !item.deleted && item.id === entry.questionId && item.audience === previous.audience)) return jsonError('한 문항에 여러 열을 연결하거나 다른 대상 문항을 연결할 수 없습니다.');
        ids.add(entry.questionId);
      }
    }
    const upload = await updateResultUploadMapping(context.draftId, body.uploadId, body.mapping);
    return jsonOk({ upload });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return jsonError(error.message, 404);
    }
    return jsonError(error instanceof Error ? error.message : "연결표 저장에 실패했습니다.", 500);
  }
}
