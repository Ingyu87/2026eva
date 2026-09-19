import { jsonError, requireSchoolSession } from "@/lib/api";
import { canExport } from "@/lib/exportGate";
import { buildResultReportHtml, resultReportFileName } from "@/lib/resultReportHtml";
import { getDraftBundle, getResultUpload, getSurveyResult } from "@/lib/store";

/**
 * 설문 결과 보고서 HTML 내려받기 (spec.md 7.2).
 * 중간평가에서도 씁니다(2학기 교육 활동 보완용) — exportGate.ts에서 시기 제한 없음.
 */
export async function GET(request: Request) {
  const session = await requireSchoolSession();
  if ("status" in session) {
    return session;
  }

  const { draft, items } = await getDraftBundle(session.schoolId, session.schoolName);

  const gate = canExport("result-html", draft);
  if (!gate.allowed) {
    return jsonError(gate.reason ?? "지금은 결과 보고서를 만들 수 없습니다.", 403);
  }

  const url = new URL(request.url);
  const resultId = url.searchParams.get("resultId");
  const uploadIds = url.searchParams.get("uploadIds")?.split(",").filter(Boolean) ?? [];
  if (!resultId || uploadIds.length === 0) {
    return jsonError("집계 결과와 원본 업로드를 지정하세요.");
  }

  const result = await getSurveyResult(draft.id, resultId);
  if (!result) {
    return jsonError("집계 결과를 찾을 수 없습니다.", 404);
  }

  const uploads = await Promise.all(uploadIds.map((id) => getResultUpload(draft.id, id)));
  if (uploads.some((upload) => upload === null)) {
    return jsonError("업로드한 결과 파일 일부를 찾을 수 없습니다.", 404);
  }

  const html = buildResultReportHtml(draft, items, result, uploads as NonNullable<(typeof uploads)[number]>[]);
  const fileName = encodeURIComponent(resultReportFileName(draft));

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`
    }
  });
}
