import { jsonError, requireSchoolSession } from "@/lib/api";
import { buildSurveyDocx, docxFileName } from "@/lib/docxExport";
import { getOrCreateDraft } from "@/lib/store";

export async function GET() {
  const session = await requireSchoolSession();
  if ("status" in session) {
    return session;
  }

  const draft = await getOrCreateDraft(session.schoolId, session.schoolName);
  const buffer = await buildSurveyDocx(draft);
  const fileName = encodeURIComponent(docxFileName(draft));

  if (!buffer.length) {
    return jsonError("DOCX 파일 생성에 실패했습니다.", 500);
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`
    }
  });
}
