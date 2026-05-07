import { createHmac, timingSafeEqual } from "node:crypto";

export const SCHOOL_SESSION_COOKIE = "school_eval_session";
export const ADMIN_SESSION_COOKIE = "school_eval_admin";

const DEFAULT_MAX_AGE = 60 * 60 * 8;

export type SchoolSession = {
  role: "school";
  schoolId: string;
  schoolName: string;
  exp: number;
};

export type AdminSession = {
  role: "admin";
  exp: number;
};

type SignedPayload = Record<string, unknown>;

function secret(): string {
  return process.env.SESSION_SECRET || "local-dev-session-secret-change-before-production";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSignedToken(payload: SignedPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSignedToken<T extends SignedPayload>(token?: string): T | null {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [body, signature] = token.split(".");
  const expected = sign(body);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    if (exp && exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createSchoolSession(schoolId: string, schoolName: string): string {
  return encodeSignedToken({
    role: "school",
    schoolId,
    schoolName,
    exp: Math.floor(Date.now() / 1000) + DEFAULT_MAX_AGE
  });
}

export function createAdminSession(): string {
  return encodeSignedToken({
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + DEFAULT_MAX_AGE
  });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: DEFAULT_MAX_AGE
  };
}
