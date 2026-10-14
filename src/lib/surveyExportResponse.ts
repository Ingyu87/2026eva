import { jsonError, requireSchoolSession } from "@/lib/api";
import { getDraftBundle } from "@/lib/store";
import { audienceFileName, parseExportAudience, selectExportItems } from "./surveyExport";
import type { SelectedQuestion, SurveyDraft } from "./types";

export async function surveyExportResponse(
  request: Request | undefined,
  build: (draft: SurveyDraft, items: SelectedQuestion[]) => Promise<Buffer>,
  name: (draft: SurveyDraft) => string,
  contentType: string
): Promise<Response> {
  const session = await requireSchoolSession();
  if ("status" in session) return session;
  let audience;
  try {
    audience = parseExportAudience(request ? new URL(request.url).searchParams.get("audience") : null);
  } catch {
    return jsonError("다운로드할 대상을 다시 선택해 주세요.", 400);
  }
  try {
    const { draft, items } = await getDraftBundle(session.schoolId, session.schoolName);
    const selected = selectExportItems(items, audience);
    if (!selected.length) return jsonError("선택한 대상에 저장된 문항이 없습니다.", 400);
    const buffer = await build(draft, selected);
    if (!buffer.length) throw new Error("Empty survey export");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(audienceFileName(name(draft), audience))}`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch {
    return jsonError("설문지 파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}
