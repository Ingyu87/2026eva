import { NextResponse } from "next/server";
import { clearSessionCookie, jsonOk } from "@/lib/api";
import { ADMIN_SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const response = jsonOk({ loggedOut: true });
  clearSessionCookie(response as NextResponse, ADMIN_SESSION_COOKIE);
  return response;
}
