import { buildSurveyDocx, docxFileName } from "@/lib/docxExport";
import { surveyExportResponse } from "@/lib/surveyExportResponse";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return surveyExportResponse(request, buildSurveyDocx, docxFileName,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}
