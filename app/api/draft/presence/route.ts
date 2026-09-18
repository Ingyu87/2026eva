import { jsonError, jsonOk } from "@/lib/api";
import { draftWriteError, readJson, resolveDraftContext } from "@/lib/draftApi";
import { upsertPresence } from "@/lib/store";
import { AUDIENCES, type Audience } from "@/lib/types";

type Body = {
  sessionId?: string;
  displayName?: string;
  audience?: Audience;
  editingItemId?: string;
};

/**
 * 접속 상태를 알리고 다른 접속자를 받아옵니다.
 *
 * `displayName`은 사용자가 스스로 정한 표시용 라벨입니다. 인증 수단이 아니므로
 * 권한 판단에 쓰지 않습니다. 권한은 학교 세션 쿠키로만 확인합니다.
 */
export async function POST(request: Request) {
  const context = await resolveDraftContext();
  if ("status" in context) {
    return context;
  }

  const body = await readJson<Body>(request);
  if (!body?.sessionId) {
    return jsonError("세션 정보가 필요합니다.");
  }

  const audience: Audience = AUDIENCES.includes(body.audience as Audience)
    ? (body.audience as Audience)
    : "teacher";

  try {
    const presence = await upsertPresence(context.draftId, {
      sessionId: body.sessionId,
      displayName: (body.displayName ?? "").slice(0, 20),
      audience,
      editingItemId: body.editingItemId
    });
    return jsonOk({ presence });
  } catch (error) {
    return draftWriteError(error);
  }
}
