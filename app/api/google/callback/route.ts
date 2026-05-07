import { NextResponse } from "next/server";
import { createGoogleFormFromDraft, decodeGoogleState, exchangeGoogleCode } from "@/lib/googleForms";
import { getOrCreateDraft, saveDraft } from "@/lib/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = decodeGoogleState(url.searchParams.get("state"));
  const origin = url.origin;

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/?google=error&message=${encodeURIComponent("Google 인증 정보가 올바르지 않습니다.")}`);
  }

  try {
    const token = await exchangeGoogleCode(code, origin);
    const draft = await getOrCreateDraft(state.schoolId, state.schoolName);
    const form = await createGoogleFormFromDraft(draft, token.access_token);
    await saveDraft({
      ...draft,
      googleForm: {
        ...form,
        createdAt: new Date().toISOString()
      }
    });
    return NextResponse.redirect(`${origin}/?google=success`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Forms 생성에 실패했습니다.";
    return NextResponse.redirect(`${origin}/?google=error&message=${encodeURIComponent(message)}`);
  }
}
