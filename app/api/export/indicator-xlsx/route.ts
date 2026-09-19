import ExcelJS from "exceljs";
import { jsonError, requireSchoolSession } from "@/lib/api";
import { canExport } from "@/lib/exportGate";
import { fillIndicatorTemplate, scanIndicatorTemplate } from "@/lib/indicatorTemplate";
import { getDraftBundle, getIndicatorTemplate, getSurveyResult } from "@/lib/store";
import { resultDataIssues } from "@/lib/reportReadiness";

function indicatorXlsxFileName(schoolName: string): string {
  const safe = schoolName.replace(/[<>:"/\\|?*\s]+/g, "_");
  return `평가지표및현황_${safe}.xlsx`;
}

/**
 * 평가지표 및 현황 XLSX 내려받기 (spec.md 7.1, 8-1).
 * 학년말 모드 + 집계 완료가 조건입니다(exportGate.ts, 가이드북 Q12).
 */
export async function GET(request: Request) {
  const session = await requireSchoolSession();
  if ("status" in session) {
    return session;
  }

  const { draft, items } = await getDraftBundle(session.schoolId, session.schoolName);

  const gate = canExport("indicator-xlsx", draft);
  if (!gate.allowed) {
    return jsonError(gate.reason ?? "지금은 평가지표 및 현황을 만들 수 없습니다.", 403);
  }

  const resultId = new URL(request.url).searchParams.get("resultId");
  if (!resultId) {
    return jsonError("집계 결과를 먼저 선택하세요.");
  }
  const result = await getSurveyResult(draft.id, resultId);
  if (!result) {
    return jsonError("집계 결과를 찾을 수 없습니다.", 404);
  }

  const template = await getIndicatorTemplate();
  const resultGate = canExport("indicator-xlsx", draft, result);
  if (!resultGate.allowed) return jsonError(resultGate.reason!, 403);
  const issues = resultDataIssues(result);
  if (issues.length) return jsonError(`제출 전 확인: ${issues.join(' ')}`);
  if (!template) {
    return jsonError("관리자가 아직 평가지표 및 현황 템플릿을 등록하지 않았습니다.", 404);
  }

  try {
  const workbook = new ExcelJS.Workbook();
  const templateBuffer = Buffer.from(template.base64, "base64");
  await workbook.xlsx.load(templateBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const map = scanIndicatorTemplate(workbook);
  // 못 채운 지표는 해당 칸을 비워 둡니다. 학교가 파일을 열어 빈칸을 보고 바로 확인할 수 있습니다
  // (spec.md 9장: 자동 연결 실패 시 사람이 확인, 조용히 숫자를 지어내지 않음).
  fillIndicatorTemplate(workbook, map, {
    schoolName: draft.schoolName,
    items: result.itemsSnapshot ?? items,
    areaStats: result.areaStats
  });

  const outputBuffer = await workbook.xlsx.writeBuffer();
  const fileName = encodeURIComponent(indicatorXlsxFileName(draft.schoolName));

  return new Response(new Uint8Array(outputBuffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`
    }
  });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "양식을 확인하지 못했습니다. 관리자에게 문의하세요.", 400);
  }
}
