import { NextResponse } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import { cookieOptions, createSchoolSession, SCHOOL_SESSION_COOKIE } from "@/lib/session";
import { createSchool, getOrCreateDraft } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { schoolName?: string; password?: string };
    const schoolName = body.schoolName?.trim();
    const password = body.password?.trim();

    if (!schoolName || !password) {
      return jsonError("학교 이름과 비밀번호를 입력해 주세요.");
    }
    if (password.length < 2) {
      return jsonError("비밀번호는 2자 이상 입력해 주세요.");
    }

    const passwordHash = await hashPassword(password);
    const school = await createSchool(schoolName, passwordHash);
    const draft = await getOrCreateDraft(school.id, school.schoolName);

    const response = jsonOk({ school, draft });
    response.cookies.set(SCHOOL_SESSION_COOKIE, createSchoolSession(school.id, school.schoolName), cookieOptions());
    return response;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "학교 등록에 실패했습니다.");
  }
}
