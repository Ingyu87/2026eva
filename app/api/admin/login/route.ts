import { createHash, timingSafeEqual } from "node:crypto";
import { jsonError, jsonOk } from "@/lib/api";
import { ADMIN_SESSION_COOKIE, cookieOptions, createAdminSession } from "@/lib/session";

function samePassword(given: string, expected: string): boolean {
  const left = createHash("sha256").update(given).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminPassword) {
    return jsonError("서버에 ADMIN_PASSWORD가 설정되지 않았습니다.", 500);
  }

  if (!body.password || !samePassword(body.password, adminPassword)) {
    return jsonError("관리자 비밀번호가 올바르지 않습니다.", 401);
  }

  const response = jsonOk({ authenticated: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSession(), cookieOptions());
  return response;
}
