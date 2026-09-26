import { jsonError, jsonOk } from "@/lib/api";
import { draftWriteError, readJson, resolveDraftContext } from "@/lib/draftApi";
import { assignDraftItems } from "@/lib/store";

export async function POST(request: Request) {
  const context = await resolveDraftContext({ leadOnly: true });
  if ("status" in context) return context;
  const body = await readJson<{ token?: unknown; items?: unknown }>(request);
  if (typeof body?.token !== "string" || !/^[a-zA-Z0-9-]+$/.test(body.token) || !Array.isArray(body.items) || !body.items.length || body.items.length > 200) return jsonError("부장 링크와 문항 1~200개를 선택하세요.");
  const rows = body.items as { id: string; rev: number }[];
  if (rows.some(row => !row || typeof row.id !== "string" || !/^[a-zA-Z0-9-]+$/.test(row.id) || !Number.isInteger(row.rev) || row.rev < 0) || new Set(rows.map(row => row.id)).size !== rows.length) return jsonError("문항과 버전 정보를 확인하세요.");
  try { return jsonOk({ items: await assignDraftItems(context.schoolId, context.draftId, body.token, rows) }); }
  catch (error) { return draftWriteError(error); }
}
