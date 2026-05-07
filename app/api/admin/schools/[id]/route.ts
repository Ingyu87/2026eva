import { jsonOk, requireAdminSession } from "@/lib/api";
import { deleteSchool, logAdminAction } from "@/lib/store";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if ("status" in session) {
    return session;
  }

  const { id } = await context.params;
  await deleteSchool(id);
  await logAdminAction("delete_school", id);
  return jsonOk({ deleted: true });
}
