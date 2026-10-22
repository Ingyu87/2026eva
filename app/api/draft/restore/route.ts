import { jsonError, jsonOk } from "@/lib/api";
import { draftWriteError, readJson, resolveDraftContext } from "@/lib/draftApi";
import { restoreDeletedItems } from "@/lib/store";
import { AUDIENCES, type Audience } from "@/lib/types";

export async function POST(request: Request) {
  const context = await resolveDraftContext({ leadOnly: true });
  if ("status" in context) {
    return context;
  }
  const body = await readJson<{ audience?: Audience }>(request);
  const audience = body?.audience;
  if (!audience || !(AUDIENCES as readonly string[]).includes(audience)) {
    return jsonError("되돌릴 대상을 지정하세요.");
  }
  try {
    const items = await restoreDeletedItems(context.draftId, audience);
    return jsonOk({ items });
  } catch (error) {
    return draftWriteError(error);
  }
}
