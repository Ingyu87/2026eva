import { jsonError, requireSchoolSession } from "@/lib/api";
import { canExport } from "@/lib/exportGate";
import { buildReportDocxInternal, buildReportDocxSubmit, reportDocxFileName, type ReportDocxType } from "@/lib/reportDocx";
import { getDraftBundle, getSurveyResult } from "@/lib/store";

function isReportType(value: string | null): value is ReportDocxType {
  return value === "submit" || value === "internal";
}

/**
 * 학교평가서 DOCX 내려받기 (spec.md 7.3). 학년말 모드만 허용(exportGate.ts, 가이드북 Q12).
 * 제출용은 AI 해석 결과가 있어야 만들 수 있습니다 — 없으면 구분/세부영역/지표 칸이 빈 채로 나갑니다.
 */
export async function GET(request: Request) {
  const session = await requireSchoolSession();
  if ("status" in session) {
    return session;
  }

  const { draft, items } = await getDraftBundle(session.schoolId, session.schoolName);

  const gate = canExport("report-docx", draft);
  if (!gate.allowed) {
    return jsonError(gate.reason ?? "지금은 학교평가서를 만들 수 없습니다.", 403);
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (!isReportType(type)) {
    return jsonError("제출용(submit) 또는 교내 보관용(internal)을 지정하세요.");
  }

  const resultId = url.searchParams.get("resultId");
  if (!resultId) {
    return jsonError("집계 결과를 먼저 선택하세요.");
  }
  const result = await getSurveyResult(draft.id, resultId);
  if (!result) {
    return jsonError("집계 결과를 찾을 수 없습니다.", 404);
  }

  if (type === "submit" && !result.aiAnalysis) {
    return jsonError("제출용 학교평가서는 AI 해석을 먼저 실행해야 만들 수 있습니다.", 400);
  }

  const buffer =
    type === "submit"
      ? await buildReportDocxSubmit(draft, items, result)
      : await buildReportDocxInternal(draft, items, result);

  const fileName = encodeURIComponent(reportDocxFileName(draft, type));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`
    }
  });
}
