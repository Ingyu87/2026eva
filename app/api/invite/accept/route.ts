import { NextResponse } from "next/server";
import { getSchoolById, getBuilderInvite } from "@/lib/store";
import {
  BUILDER_SESSION_COOKIE,
  cookieOptions,
  createBuilderSession,
  SCHOOL_SESSION_COOKIE
} from "@/lib/session";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  const origin = new URL(request.url).origin;
  if (!token) {
    return NextResponse.redirect(`${origin}/?invite=missing`);
  }

  const invite = await getBuilderInvite(token);
  if (!invite || invite.revoked) {
    return NextResponse.redirect(`${origin}/?invite=invalid`);
  }

  const school = await getSchoolById(invite.schoolId);
  if (!school || school.status !== "active") {
    return NextResponse.redirect(`${origin}/?invite=invalid`);
  }

  const response = NextResponse.redirect(`${origin}/`);
  response.cookies.set(SCHOOL_SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  response.cookies.set(
    BUILDER_SESSION_COOKIE,
    createBuilderSession({
      schoolId: invite.schoolId,
      schoolName: invite.schoolName,
      token: invite.token,
      label: invite.label,
      audience: invite.audience
    }),
    cookieOptions()
  );
  return response;
}
