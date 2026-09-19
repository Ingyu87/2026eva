import { NextResponse } from "next/server";
import { clearSessionCookie, jsonOk } from "@/lib/api";
import { BUILDER_SESSION_COOKIE, SCHOOL_SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const response = jsonOk({ loggedOut: true });
  clearSessionCookie(response as NextResponse, SCHOOL_SESSION_COOKIE);
  clearSessionCookie(response as NextResponse, BUILDER_SESSION_COOKIE);
  return response;
}
