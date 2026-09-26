import { isWorkColor, type WorkColor } from "@/lib/workStatus";
import { jsonError, jsonOk, requireSchoolSession } from "@/lib/api";
import { readJson } from "@/lib/draftApi";
import {
  setBuilderInviteColor,
  countOwnedItems,
  createBuilderInvite,
  getOrCreateDraft,
  inviteOwnerId,
  listBuilderInvites,
  revokeBuilderInvite
} from "@/lib/store";
import { AUDIENCES, type Audience, type BuilderInviteSummary } from "@/lib/types";

function isAudience(value: unknown): value is Audience {
  return typeof value === "string" && (AUDIENCES as readonly string[]).includes(value);
}

export async function GET() {
  const session = await requireSchoolSession();
  if ("status" in session) {
    return session;
  }
  const [invites, draft] = await Promise.all([
    listBuilderInvites(session.schoolId),
    getOrCreateDraft(session.schoolId, session.schoolName)
  ]);
  const counts = await countOwnedItems(draft.id);
  const summaries: BuilderInviteSummary[] = invites.map((invite) => ({
    ...invite,
    itemCount: counts[inviteOwnerId(invite.token)] ?? 0
  }));
  return jsonOk({ invites: summaries });
}

export async function POST(request: Request) {
  const session = await requireSchoolSession();
  if ("status" in session) {
    return session;
  }
  const body = await readJson<{ label?: string; audience?: Audience; color?: WorkColor }>(request);
  const label = body?.label?.trim();
  if (!label) {
    return jsonError("역할 이름을 적으세요.");
  }
  const audience = isAudience(body?.audience) ? body.audience : undefined;
  const draft = await getOrCreateDraft(session.schoolId, session.schoolName);
  const invite = await createBuilderInvite({
    schoolId: session.schoolId,
    schoolName: session.schoolName,
    draftId: draft.id,
    label,
    color: isWorkColor(body?.color) ? body.color : undefined,
    audience
  });
  return jsonOk({ invite });
}

export async function PATCH(request: Request) {
  const session = await requireSchoolSession();
  if ("status" in session) {
    return session;
  }
  const body = await readJson<{ token?: string; color?: unknown }>(request);
  if (!body?.token) {
    return jsonError("링크를 지정하세요.");
  }
  try {
    if ("color" in body) {
      if (!isWorkColor(body.color)) return jsonError("표시 색상을 선택하세요.");
      await setBuilderInviteColor(session.schoolId, body.token, body.color);
      return jsonOk({ updated: true });
    }
    await revokeBuilderInvite(session.schoolId, body.token);
    return jsonOk({ revoked: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "링크를 지울 수 없습니다.");
  }
}
