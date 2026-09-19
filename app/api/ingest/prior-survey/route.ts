import { jsonError, jsonOk } from "@/lib/api";
import { resolveDraftContext } from "@/lib/draftApi";
import { extractPriorSurveyPdf } from "@/lib/priorSurvey";

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const context = await resolveDraftContext({ leadOnly: true });
  if ("status" in context) {
    return context;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("파일을 첨부하세요.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("PDF를 선택하세요.");
  }
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return jsonError("PDF만 올릴 수 있습니다.");
  }
  if (file.size > MAX_BYTES) {
    return jsonError("파일이 너무 큽니다. 12MB 이하로 올려 주세요.");
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return jsonError("파일을 읽을 수 없습니다.");
  }

  try {
    const items = await extractPriorSurveyPdf(buffer);
    return jsonOk({ items });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "문항지를 읽지 못했습니다.");
  }
}
