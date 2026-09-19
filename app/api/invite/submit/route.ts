import { getDraftAccess, jsonError, jsonOk } from "@/lib/api";
import {
  countOwnedItems,
  getBuilderInvite,
  getOrCreateDraft,
  inviteOwnerId,
  submitBuilderInvite
} from "@/lib/store";

/** 부장이 자기 링크의 제출 상태와 담은 문항 수를 봅니다. */
export async function GET() {
  const access = await getDraftAccess();
  if (!access || access.role !== "builder" || !access.inviteToken) {
    return jsonError("부장 링크로 들어온 경우에만 쓸 수 있습니다.", 401);
  }
  const [invite, draft] = await Promise.all([
    getBuilderInvite(access.inviteToken),
    getOrCreateDraft(access.schoolId, access.schoolName)
  ]);
  const counts = await countOwnedItems(draft.id);
  return jsonOk({
    submittedAt: invite?.submittedAt ?? null,
    itemCount: counts[inviteOwnerId(access.inviteToken)] ?? 0
  });
}

/** 부장이 작성을 마쳤다고 표시합니다. 이후 문항을 고치면 다시 '작성 중'이 됩니다. */
export async function POST() {
  const access = await getDraftAccess();
  if (!access || access.role !== "builder" || !access.inviteToken) {
    return jsonError("부장 링크로 들어온 경우에만 쓸 수 있습니다.", 401);
  }
  const invite = await submitBuilderInvite(access.inviteToken);
  return jsonOk({ submittedAt: invite.submittedAt ?? null });
}
