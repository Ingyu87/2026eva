import { jsonError, jsonOk, requireAdminSession } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import { logAdminAction, updateSchoolPassword } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if ("status" in session) {
    return session;
  }

  const body = (await request.json()) as { password?: string };
  const password = body.password?.trim();
  if (!password) {
    return jsonError("새 비밀번호를 입력해 주세요.");
  }

  const { id } = await context.params;
  await updateSchoolPassword(id, await hashPassword(password));
  await logAdminAction("reset_school_password", id);
  return jsonOk({ updated: true });
}
