import { jsonError, jsonOk, requireSchoolSession } from "@/lib/api";
import { getOrCreateDraft, saveDraft } from "@/lib/store";
import type { SurveyDraft } from "@/lib/types";

export async function GET() {
  const session = await requireSchoolSession();
  if ("status" in session) {
    return session;
  }

  const draft = await getOrCreateDraft(session.schoolId, session.schoolName);
  return jsonOk({ draft });
}

export async function PUT(request: Request) {
  const session = await requireSchoolSession();
  if ("status" in session) {
    return session;
  }

  const body = (await request.json()) as { draft?: SurveyDraft };
  if (!body.draft || body.draft.schoolId !== session.schoolId) {
    return jsonError("저장할 설문 초안이 올바르지 않습니다.");
  }

  const draft = await saveDraft({
    ...body.draft,
    schoolId: session.schoolId,
    schoolName: body.draft.schoolName?.trim() || session.schoolName
  });
  return jsonOk({ draft });
}
