import { NextResponse } from "next/server";
import { createGoogleFormsByAudienceFromDraft, decodeGoogleState, exchangeGoogleCode } from "@/lib/googleForms";
import { AUDIENCES, type GoogleFormsByAudience } from "@/lib/types";
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
    const formsByAudience = await createGoogleFormsByAudienceFromDraft(draft, token.access_token);
    const createdAt = new Date().toISOString();
    const normalizedFormsByAudience: GoogleFormsByAudience = {};
    for (const audience of AUDIENCES) {
      const info = formsByAudience[audience];
      if (!info) {
        continue;
      }
      normalizedFormsByAudience[audience] = {
        ...info,
        createdAt
      };
    }
    const firstAudience = AUDIENCES.find((audience) => normalizedFormsByAudience[audience]);
    const firstForm = firstAudience ? normalizedFormsByAudience[firstAudience] : undefined;
    await saveDraft({
      ...draft,
      googleFormsByAudience: normalizedFormsByAudience,
      googleForm: firstForm
    });
    return NextResponse.redirect(`${origin}/?google=success`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Forms 생성에 실패했습니다.";
    return NextResponse.redirect(`${origin}/?google=error&message=${encodeURIComponent(message)}`);
  }
}
