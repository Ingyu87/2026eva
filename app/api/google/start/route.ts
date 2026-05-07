import { NextResponse } from "next/server";
import { requireSchoolSession } from "@/lib/api";
import { createGoogleAuthUrl } from "@/lib/googleForms";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  const session = await requireSchoolSession();
  if ("status" in session) {
    return NextResponse.redirect(
      `${origin}/?google=error&message=${encodeURIComponent("로그인이 필요합니다. 로그인 후 다시 시도해 주세요.")}`
    );
  }

  try {
    const authUrl = createGoogleAuthUrl(session.schoolId, session.schoolName, origin);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google OAuth를 시작할 수 없습니다.";
    return NextResponse.redirect(`${origin}/?google=error&message=${encodeURIComponent(message)}`);
  }
}
