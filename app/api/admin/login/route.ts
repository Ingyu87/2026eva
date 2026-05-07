import { jsonError, jsonOk } from "@/lib/api";
import { ADMIN_SESSION_COOKIE, cookieOptions, createAdminSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminPassword) {
    return jsonError("서버에 ADMIN_PASSWORD가 설정되지 않았습니다.", 500);
  }

  if (!body.password || body.password !== adminPassword) {
    return jsonError("관리자 비밀번호가 올바르지 않습니다.", 401);
  }

  const response = jsonOk({ authenticated: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSession(), cookieOptions());
  return response;
}
