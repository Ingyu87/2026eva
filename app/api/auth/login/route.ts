import { jsonError, jsonOk } from "@/lib/api";
import { verifyPassword } from "@/lib/password";
import { cookieOptions, createSchoolSession, SCHOOL_SESSION_COOKIE } from "@/lib/session";
import { getOrCreateDraft, getSchoolByName, touchSchoolLogin } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { schoolName?: string; password?: string };
    const schoolName = body.schoolName?.trim();
    const password = body.password?.trim();

    if (!schoolName || !password) {
      return jsonError("학교 이름과 비밀번호를 입력해 주세요.");
    }

    const school = await getSchoolByName(schoolName);
    if (!school || school.status !== "active") {
      return jsonError("등록된 활성 학교 계정을 찾을 수 없습니다.", 401);
    }

    const verified = await verifyPassword(password, school.passwordHash);
    if (!verified) {
      return jsonError("비밀번호가 올바르지 않습니다.", 401);
    }

    await touchSchoolLogin(school.id);
    const draft = await getOrCreateDraft(school.id, school.schoolName);
    const { passwordHash: _passwordHash, ...publicSchool } = school;
    const response = jsonOk({ school: publicSchool, draft });
    response.cookies.set(SCHOOL_SESSION_COOKIE, createSchoolSession(school.id, school.schoolName), cookieOptions());
    return response;
  } catch {
    return jsonError("로그인에 실패했습니다.", 500);
  }
}
