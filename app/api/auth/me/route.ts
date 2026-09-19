import { getBuilderSession, getSchoolSession, jsonOk } from "@/lib/api";
import { getBuilderInvite, getOrCreateDraft, getSchoolById } from "@/lib/store";
import type { WorkspaceRole } from "@/lib/types";

export async function GET() {
  const schoolSession = await getSchoolSession();
  if (schoolSession?.role === "school") {
    const school = await getSchoolById(schoolSession.schoolId);
    if (!school || school.status !== "active") {
      return jsonOk({ school: null, draft: null, role: null });
    }
    const draft = await getOrCreateDraft(school.id, school.schoolName);
    const { passwordHash: _passwordHash, ...publicSchool } = school;
    return jsonOk({ school: publicSchool, draft, role: "lead" as WorkspaceRole });
  }

  const builder = await getBuilderSession();
  if (builder?.role === "builder") {
    const invite = await getBuilderInvite(builder.token);
    if (!invite || invite.revoked) {
      return jsonOk({ school: null, draft: null, role: null });
    }
    const school = await getSchoolById(builder.schoolId);
    if (!school || school.status !== "active") {
      return jsonOk({ school: null, draft: null, role: null });
    }
    const draft = await getOrCreateDraft(school.id, school.schoolName);
    const { passwordHash: _passwordHash, ...publicSchool } = school;
    return jsonOk({
      school: publicSchool,
      draft,
      role: "builder" as WorkspaceRole,
      builderLabel: invite.label,
      builderAudience: invite.audience ?? null
    });
  }

  return jsonOk({ school: null, draft: null, role: null });
}
