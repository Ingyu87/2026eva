import { jsonError, jsonOk } from "@/lib/api";
import { resolveDraftContext } from "@/lib/draftApi";
import { parseResultFile } from "@/lib/resultsFile";
import { matchColumns } from "@/lib/resultsMatching";
import { getDraftBundle, saveResultUpload } from "@/lib/store";
import { itemsForAudience } from "@/lib/draftItems";
import { AUDIENCES, type Audience, type ResultColumnMapping } from "@/lib/types";

function isAudience(value: unknown): value is Audience {
  return typeof value === "string" && (AUDIENCES as readonly string[]).includes(value);
}

/**
 * 결과 파일(XLSX/CSV) 올리기 → 열 제목을 문항에 자동 연결한 뒤 업로드 상태로 저장합니다.
 * 연결에 실패한 열은 `mapping`에 questionId 없이 남아, S4 화면에서 사람이 고릅니다(spec.md 9장).
 */
export async function POST(request: Request) {
  const context = await resolveDraftContext();
  if ("status" in context) {
    return context;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("파일 업로드 형식이 올바르지 않습니다.");
  }

  const audience = form.get("audience");
  if (!isAudience(audience)) {
    return jsonError("평가주체를 선택하세요.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("파일을 첨부하세요.");
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return jsonError("파일을 읽을 수 없습니다.");
  }

  let parsed;
  try {
    parsed = await parseResultFile(buffer, file.name);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "파일을 해석할 수 없습니다.");
  }

  const { draft, items } = await getDraftBundle(context.schoolId, context.schoolName);
  const audienceItems = itemsForAudience(items, audience);
  const formInfo = draft.googleFormsByAudience?.[audience];

  const matched = matchColumns(parsed.headers, audienceItems, formInfo);
  const mapping: ResultColumnMapping[] = matched.map(({ column, match }) => ({
    column,
    questionId: match.status === "question" ? match.questionId : undefined,
    isGrade: match.status === "grade" ? true : undefined
  }));

  const upload = await saveResultUpload(draft.id, {
    audience,
    filename: file.name,
    headers: parsed.headers,
    rows: parsed.rows,
    mapping
  });

  return jsonOk({
    uploadId: upload.id,
    audience: upload.audience,
    filename: upload.filename,
    responseCount: upload.rows.length,
    columns: matched.map(({ column, match }) => ({ column, match }))
  });
}
