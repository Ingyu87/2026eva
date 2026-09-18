import { jsonOk } from "@/lib/api";
import { draftWriteError, resolveDraftContext } from "@/lib/draftApi";
import { syncDraft } from "@/lib/store";

/**
 * `since` 이후의 변경분만 내려줍니다. 클라이언트가 3초마다 호출합니다.
 *
 * `since`는 서버가 지난 응답에서 준 `nextSince`를 그대로 되돌려 보낸 값입니다.
 * 브라우저 시계를 쓰지 않으므로 기기 간 시각 차이 문제가 없습니다.
 */
export async function GET(request: Request) {
  const context = await resolveDraftContext();
  if ("status" in context) {
    return context;
  }

  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  const sessionId = url.searchParams.get("sessionId");

  try {
    return jsonOk(await syncDraft(context.draftId, since, sessionId));
  } catch (error) {
    return draftWriteError(error);
  }
}
