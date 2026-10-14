import { buildSurveyHwpx, hwpxFileName } from "@/lib/hwpxExport";
import { surveyExportResponse } from "@/lib/surveyExportResponse";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return surveyExportResponse(request, buildSurveyHwpx, hwpxFileName, "application/hwp+zip");
}
