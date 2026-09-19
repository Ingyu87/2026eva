import { jsonError, jsonOk } from "@/lib/api";
import { draftWriteError, readJson, requireRev, resolveDraftContext } from "@/lib/draftApi";
import { patchDraftMeta } from "@/lib/store";
import type { SurveyDraftPatch } from "@/lib/types";

type Body = {
  expectedRev?: number;
  patch?: SurveyDraftPatch;
  updatedBy?: string;
};

/** 제목·안내문 등 메타를 항목 단위로 수정합니다. 문항은 건드리지 않습니다. */
export async function PATCH(request: Request) {
  const context = await resolveDraftContext({ leadOnly: true });
  if ("status" in context) {
    return context;
  }

  const body = await readJson<Body>(request);
  const expectedRev = requireRev(body?.expectedRev);
  if (!body?.patch || expectedRev === null) {
    return jsonError("수정할 내용과 버전 정보가 필요합니다.");
  }

  try {
    const draft = await patchDraftMeta(context.draftId, expectedRev, body.patch, body.updatedBy);
    return jsonOk({ draft });
  } catch (error) {
    return draftWriteError(error);
  }
}
