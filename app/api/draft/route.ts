import { getDraftAccess, jsonError, jsonOk } from "@/lib/api";
import { getDraftBundle } from "@/lib/store";

/**
 * 초안 전체(메타 + 문항 + 동기화 커서)를 내려줍니다.
 *
 * 쓰기는 `/api/draft/meta`, `/api/draft/items`로 나뉘어 있습니다. 예전의 전체 덮어쓰기
 * PUT은 다른 사람의 작업을 지우기 때문에 폐기했습니다.
 */
export async function GET() {
  const access = await getDraftAccess();
  if (!access) {
    return jsonError("로그인이 필요합니다.", 401);
  }

  const bundle = await getDraftBundle(access.schoolId, access.schoolName);
  return jsonOk(bundle);
}
