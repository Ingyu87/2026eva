import { randomInt } from "node:crypto";
import { WORK_COLORS, defaultWorkColor } from "@/lib/workStatus";
import { jsonError, jsonOk, requireSchoolSession } from "@/lib/api";
import { readJson } from "@/lib/draftApi";
import {
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
  const body = await readJson<{ label?: string; audience?: Audience }>(request);
  const label = body?.label?.trim();
  if (!label) {
    return jsonError("역할 이름을 적으세요.");
  }
  const audience = isAudience(body?.audience) ? body.audience : undefined;
  const draft = await getOrCreateDraft(session.schoolId, session.schoolName);
  const existing = await listBuilderInvites(session.schoolId);
  const counts = WORK_COLORS.map(color => existing.filter(invite => (invite.color ?? defaultWorkColor(invite.label)) === color).length);
  const leastUsed = WORK_COLORS.filter((_, index) => counts[index] === Math.min(...counts));
  const color = leastUsed[randomInt(leastUsed.length)];
  const invite = await createBuilderInvite({
    schoolId: session.schoolId,
    schoolName: session.schoolName,
    draftId: draft.id,
    label,
    color,
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
    if ("color" in body) return jsonError("표시 색상은 자동으로 배정됩니다.");
    await revokeBuilderInvite(session.schoolId, body.token);
    return jsonOk({ revoked: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "링크를 지울 수 없습니다.");
  }
}
