import { jsonError, jsonOk } from "@/lib/api";
import { resolveDraftContext } from "@/lib/draftApi";
import { NotFoundError, updateResultUploadMapping } from "@/lib/store";
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
    const upload = await updateResultUploadMapping(context.draftId, body.uploadId, body.mapping);
    return jsonOk({ upload });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return jsonError(error.message, 404);
    }
    return jsonError(error instanceof Error ? error.message : "연결표 저장에 실패했습니다.", 500);
  }
}
