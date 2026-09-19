import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  BUILDER_SESSION_COOKIE,
  cookieOptions,
  decodeSignedToken,
  SCHOOL_SESSION_COOKIE,
  type AdminSession,
  type BuilderSession,
  type SchoolSession
} from "./session";
import { getBuilderInvite } from "./store";
import type { Audience } from "./types";
import type { ApiResult } from "./types";

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<ApiResult<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(error: string, status = 400): NextResponse<ApiResult<never>> {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function getSchoolSession(): Promise<SchoolSession | null> {
  const cookieStore = await cookies();
  return decodeSignedToken<SchoolSession>(cookieStore.get(SCHOOL_SESSION_COOKIE)?.value);
}

export async function requireSchoolSession(): Promise<SchoolSession | NextResponse<ApiResult<never>>> {
  const session = await getSchoolSession();
  if (!session || session.role !== "school") {
    return jsonError("로그인이 필요합니다.", 401);
  }
  return session;
}

export async function getBuilderSession(): Promise<BuilderSession | null> {
  const cookieStore = await cookies();
  const session = decodeSignedToken<BuilderSession>(cookieStore.get(BUILDER_SESSION_COOKIE)?.value);
  return session?.role === "builder" ? session : null;
}

export type DraftAccess = {
  schoolId: string;
  schoolName: string;
  role: "lead" | "builder";
  label?: string;
  audience?: Audience;
  /** 부장 링크 토큰. 서버 안에서만 쓰고 응답에는 싣지 않습니다. */
  inviteToken?: string;
};

export async function getDraftAccess(): Promise<DraftAccess | null> {
  const school = await getSchoolSession();
  if (school?.role === "school") {
    return { schoolId: school.schoolId, schoolName: school.schoolName, role: "lead" };
  }
  const builder = await getBuilderSession();
  if (builder?.role === "builder") {
    // 연구부장이 링크를 끊으면 이미 들어온 사람도 바로 막습니다.
    const invite = await getBuilderInvite(builder.token);
    if (!invite || invite.revoked) {
      return null;
    }
    return {
      schoolId: builder.schoolId,
      schoolName: builder.schoolName,
      role: "builder",
      label: invite.label,
      audience: invite.audience,
      inviteToken: invite.token
    };
  }
  return null;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  return decodeSignedToken<AdminSession>(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdminSession(): Promise<AdminSession | NextResponse<ApiResult<never>>> {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return jsonError("관리자 로그인이 필요합니다.", 401);
  }
  return session;
}

export function clearSessionCookie(response: NextResponse, name: string): void {
  response.cookies.set(name, "", {
    ...cookieOptions(),
    maxAge: 0
  });
}
