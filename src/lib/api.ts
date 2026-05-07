import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  cookieOptions,
  decodeSignedToken,
  SCHOOL_SESSION_COOKIE,
  type AdminSession,
  type SchoolSession
} from "./session";
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
