import { jsonError, jsonOk } from "@/lib/api";
import { draftWriteError, readJson, resolveDraftContext } from "@/lib/draftApi";
import { createDraftItems } from "@/lib/store";
import type { NewSelectedQuestion } from "@/lib/types";

type Body = {
  items?: NewSelectedQuestion[];
  updatedBy?: string;
};

/**
 * 문항을 추가합니다. 새 문서를 만드는 것이라 다른 사람의 작업과 충돌하지 않습니다.
 * 여러 개를 한 번에 보낼 수 있어, 한 예시문항을 여러 대상에 담을 때 한 번만 호출합니다.
 */
export async function POST(request: Request) {
  const context = await resolveDraftContext();
  if ("status" in context) {
    return context;
  }

  const body = await readJson<Body>(request);
  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return jsonError("추가할 문항이 없습니다.");
  }

  if (context.audience && body.items.some((item) => item.audience !== context.audience)) {
    return jsonError("이 링크로는 지정된 대상의 문항만 담을 수 있습니다.", 403);
  }

  try {
    const items = await createDraftItems(context.draftId, body.items, body.updatedBy);
    return jsonOk({ items });
  } catch (error) {
    return draftWriteError(error);
  }
}
