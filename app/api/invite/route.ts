import { jsonError, jsonOk, requireSchoolSession } from "@/lib/api";
import { readJson } from "@/lib/draftApi";
import {
  createBuilderInvite,
  getOrCreateDraft,
  listBuilderInvites,
  revokeBuilderInvite
} from "@/lib/store";
import { AUDIENCES, type Audience } from "@/lib/types";

function isAudience(value: unknown): value is Audience {
  return typeof value === "string" && (AUDIENCES as readonly string[]).includes(value);
}

export async function GET() {
  const session = await requireSchoolSession();
  if ("status" in session) {
    return session;
  }
  const invites = await listBuilderInvites(session.schoolId);
  return jsonOk({ invites });
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
  const invite = await createBuilderInvite({
    schoolId: session.schoolId,
    schoolName: session.schoolName,
    draftId: draft.id,
    label,
    audience
  });
  return jsonOk({ invite });
}

export async function PATCH(request: Request) {
  const session = await requireSchoolSession();
  if ("status" in session) {
    return session;
  }
  const body = await readJson<{ token?: string }>(request);
  if (!body?.token) {
    return jsonError("링크를 지정하세요.");
  }
  try {
    await revokeBuilderInvite(session.schoolId, body.token);
    return jsonOk({ revoked: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "링크를 지울 수 없습니다.");
  }
}
