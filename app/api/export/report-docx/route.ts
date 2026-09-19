import { jsonError, requireSchoolSession } from "@/lib/api";
import { canExport } from "@/lib/exportGate";
import { buildReportDocxInternal, buildReportDocxSubmit, reportDocxFileName, type ReportDocxType } from "@/lib/reportDocx";
import { getDraftBundle, getSurveyResult } from "@/lib/store";
import { reportReadiness } from '@/lib/reportReadiness';

function isReportType(value: string | null): value is ReportDocxType {
  return value === "submit" || value === "internal" || value === "draft";
}

/**
 * 학교평가서 DOCX 내려받기 (spec.md 7.3). 학년말 모드만 허용(exportGate.ts, 가이드북 Q12).
 * 제출용은 응답과 평가 의견의 필수 검사를 통과해야 합니다. AI 사용은 필수가 아닙니다.
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
    return jsonError("작성용(draft), 제출용(submit), 교내 보관용(internal)을 지정하세요.");
  }

  const resultId = url.searchParams.get("resultId");
  if (!resultId) {
    return jsonError("집계 결과를 먼저 선택하세요.");
  }
  const result = await getSurveyResult(draft.id, resultId);
  if (!result) {
    return jsonError("집계 결과를 찾을 수 없습니다.", 404);
  }

  const resultGate = canExport("report-docx", draft, result);
  if (!resultGate.allowed) return jsonError(resultGate.reason!, 403);
  if (type === 'submit') {
    const issues = reportReadiness(result);
    if (issues.length) return jsonError(`제출 전 확인: ${issues.join(' ')} 작성용 DOCX를 내려받아 보완할 수도 있습니다.`);
  }

  const buffer =
    type !== "internal"
      ? await buildReportDocxSubmit(draft, result.itemsSnapshot ?? items, result)
      : await buildReportDocxInternal(draft, result.itemsSnapshot ?? items, result);

  const fileName = encodeURIComponent(reportDocxFileName(draft, type));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`
    }
  });
}
