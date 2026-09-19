import ExcelJS from "exceljs";
import { jsonError, jsonOk, requireAdminSession } from "@/lib/api";
import { scanIndicatorTemplate } from "@/lib/indicatorTemplate";
import { getIndicatorTemplate, saveIndicatorTemplate } from "@/lib/store";
import { AUDIENCE_SHORT_LABELS, AUDIENCES } from "@/lib/types";

/**
 * 평가지표 및 현황 XLSX 템플릿 등록 (spec.md 7.1 "템플릿 등록 화면").
 *
 * 올리자마자 구조를 스캔해 인식 결과를 보여줍니다. 실패하면 저장하지 않습니다 —
 * 잘못 인식된 템플릿을 그대로 저장해 두면 이후 모든 학교의 산출물이 잘못 나갑니다.
 */
export async function POST(request: Request) {
  const session = await requireAdminSession();
  if ("status" in session) {
    return session;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("파일 업로드 형식이 올바르지 않습니다.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("템플릿 파일을 첨부하세요.");
  }
  if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 600_000) {
    return jsonError("600KB 이하의 XLSX 양식을 첨부하세요.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    return jsonError("엑셀 파일을 열 수 없습니다.");
  }

  let map;
  try {
    map = scanIndicatorTemplate(workbook);
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? `템플릿 구조를 인식하지 못했습니다: ${error.message}`
        : "템플릿 구조를 인식하지 못했습니다."
    );
  }

  await saveIndicatorTemplate(file.name, buffer);

  return jsonOk({
    filename: file.name,
    recognized: {
      sheetName: map.sheetName,
      indicatorRowCount: map.rows.length,
      etcRowCount: map.rows.filter((row) => /기타/.test(row.indicator)).length,
      subjectColumnsFound: AUDIENCES.map((audience) => AUDIENCE_SHORT_LABELS[audience]),
      schoolNameCellFound: map.schoolNameCell !== null
    }
  });
}

export async function GET() {
  const session = await requireAdminSession();
  if ("status" in session) {
    return session;
  }

  const template = await getIndicatorTemplate();
  return jsonOk({
    template: template ? { filename: template.filename, uploadedAt: template.uploadedAt } : null
  });
}
