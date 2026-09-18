import { NextResponse } from "next/server";
import { jsonError, requireSchoolSession } from "./api";
import { ConflictError, getOrCreateDraft, NotFoundError } from "./store";
import type { ApiResult } from "./types";

/**
 * 초안 쓰기 라우트가 공통으로 필요한 것: 세션 확인과 초안 id.
 * 실패하면 그대로 돌려줄 응답을 반환합니다.
 */
export async function resolveDraftContext(): Promise<
  | { draftId: string; schoolId: string; schoolName: string }
  | NextResponse<ApiResult<never>>
> {
  const session = await requireSchoolSession();
  if ("status" in session) {
    return session;
  }
  const draft = await getOrCreateDraft(session.schoolId, session.schoolName);
  return { draftId: draft.id, schoolId: session.schoolId, schoolName: session.schoolName };
}

/**
 * 낙관적 잠금 실패를 409로 변환합니다.
 *
 * 충돌을 조용히 덮어쓰지 않고 최신 문서를 함께 돌려주어, 클라이언트가 사용자에게
 * 선택지를 제시할 수 있게 합니다.
 */
export function draftWriteError(error: unknown): NextResponse<ApiResult<never>> {
  if (error instanceof ConflictError) {
    return NextResponse.json(
      {
        ok: false as const,
        error: "다른 사람이 먼저 수정했습니다.",
        reason: "conflict" as const,
        current: error.current
      },
      { status: 409 }
    );
  }
  if (error instanceof NotFoundError) {
    return jsonError(error.message, 404);
  }
  return jsonError(error instanceof Error ? error.message : "저장에 실패했습니다.", 500);
}

/** 요청 본문을 안전하게 읽습니다. */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/** `expectedRev`가 숫자인지 확인합니다. 없으면 덮어쓰기 사고로 이어지므로 필수입니다. */
export function requireRev(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
