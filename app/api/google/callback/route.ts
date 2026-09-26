import { NextResponse } from "next/server";
import { createGoogleFormsByAudienceFromDraft, decodeGoogleState, exchangeGoogleCode } from "@/lib/googleForms";
import { AUDIENCES, type GoogleFormsByAudience } from "@/lib/types";
import { attachGoogleForms, getDraftBundle } from "@/lib/store";

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
    const { draft, items } = await getDraftBundle(state.schoolId, state.schoolName);
    const savedForms: GoogleFormsByAudience = { ...draft.googleFormsByAudience };
    await createGoogleFormsByAudienceFromDraft(draft, items, token.access_token, async (audience, info) => {
      savedForms[audience] = info;
      const firstAudience = AUDIENCES.find(target => savedForms[target]);
      await attachGoogleForms(draft.id, savedForms, firstAudience ? savedForms[firstAudience] : undefined);
    });
    return NextResponse.redirect(`${origin}/?google=success`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Forms 생성에 실패했습니다.";
    return NextResponse.redirect(`${origin}/?google=error&message=${encodeURIComponent(message)}`);
  }
}
