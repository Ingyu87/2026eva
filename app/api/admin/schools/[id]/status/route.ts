import { jsonError, jsonOk, requireAdminSession } from "@/lib/api";
import { logAdminAction, setSchoolStatus } from "@/lib/store";
import type { School } from "@/lib/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if ("status" in session) {
    return session;
  }

  const body = (await request.json()) as { status?: School["status"] };
  if (body.status !== "active" && body.status !== "inactive") {
    return jsonError("상태 값이 올바르지 않습니다.");
  }

  const { id } = await context.params;
  await setSchoolStatus(id, body.status);
  await logAdminAction(`set_school_${body.status}`, id);
  return jsonOk({ updated: true });
}
