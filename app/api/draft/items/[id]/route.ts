import { jsonError, jsonOk } from "@/lib/api";
import {
  draftWriteError,
  readJson,
  requireRev,
  resolveDraftContext,
  writeGuardOf
} from "@/lib/draftApi";
import { deleteDraftItem, markInviteEdited, patchDraftItem } from "@/lib/store";
import type { SelectedQuestionPatch } from "@/lib/types";

type PatchBody = {
  expectedRev?: number;
  patch?: SelectedQuestionPatch;
  updatedBy?: string;
};

type DeleteBody = {
  expectedRev?: number;
  updatedBy?: string;
};

type Params = { params: Promise<{ id: string }> };

/**
 * 문항 하나를 수정합니다.
 *
 * `expectedRev`가 현재 값과 다르면 409와 최신 문서를 돌려줍니다. 조용히 덮어쓰지 않는 것이
 * 이 API의 핵심입니다.
 */
export async function PATCH(request: Request, { params }: Params) {
  const context = await resolveDraftContext();
  if ("status" in context) {
    return context;
  }

  const { id } = await params;
  const body = await readJson<PatchBody>(request);
  const expectedRev = requireRev(body?.expectedRev);
  if (!body?.patch || expectedRev === null) {
    return jsonError("수정할 내용과 버전 정보가 필요합니다.");
  }

  try {
    const item = await patchDraftItem(
      context.draftId,
      id,
      expectedRev,
      body.patch,
      body.updatedBy,
      writeGuardOf(context)
    );
    if (context.builder) {
      await markInviteEdited(context.builder.token);
    }
    return jsonOk({ item });
  } catch (error) {
    return draftWriteError(error);
  }
}

/** 문항을 삭제합니다. 동기화가 삭제를 전달할 수 있도록 표식만 남깁니다. */
export async function DELETE(request: Request, { params }: Params) {
  const context = await resolveDraftContext();
  if ("status" in context) {
    return context;
  }

  const { id } = await params;
  const body = await readJson<DeleteBody>(request);
  const expectedRev = requireRev(body?.expectedRev);
  if (expectedRev === null) {
    return jsonError("버전 정보가 필요합니다.");
  }

  try {
    await deleteDraftItem(context.draftId, id, expectedRev, body?.updatedBy, writeGuardOf(context));
    if (context.builder) {
      await markInviteEdited(context.builder.token);
    }
    return jsonOk({ id });
  } catch (error) {
    return draftWriteError(error);
  }
}
