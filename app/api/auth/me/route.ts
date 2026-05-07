import { getSchoolSession, jsonOk } from "@/lib/api";
import { getOrCreateDraft, getSchoolById } from "@/lib/store";

export async function GET() {
  const session = await getSchoolSession();
  if (!session || session.role !== "school") {
    return jsonOk({ school: null, draft: null });
  }

  const school = await getSchoolById(session.schoolId);
  if (!school || school.status !== "active") {
    return jsonOk({ school: null, draft: null });
  }

  const draft = await getOrCreateDraft(school.id, school.schoolName);
  const { passwordHash: _passwordHash, ...publicSchool } = school;
  return jsonOk({ school: publicSchool, draft });
}
