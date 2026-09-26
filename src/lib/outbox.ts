import type { NewSelectedQuestion, SelectedQuestionPatch, SurveyDraftPatch } from "./types";

/**
 * 보내지 못한 편집을 브라우저에 쌓아 두는 큐.
 *
 * 편집은 서버로 보내기 **전에** 먼저 여기 기록합니다. 그래야 학교 내부망에서 서버 접속이
 * 막히거나 브라우저가 갑자기 닫혀도 작업이 남습니다. 서버가 받았다고 응답하면 그때 지웁니다.
 */

type DraftOperation =
  | { kind: "meta"; opId: string; patch: SurveyDraftPatch }
  | { kind: "create"; opId: string; items: NewSelectedQuestion[] }
  | { kind: "patch"; opId: string; itemId: string; patch: SelectedQuestionPatch }
  | { kind: "delete"; opId: string; itemId: string };

export type DraftOp = DraftOperation & { rejected?: string };
const fallback = new Map<string, DraftOp[]>();

export function outboxStorageFailed(draftId: string): boolean { return fallback.has(draftId); }

const PREFIX = "school-eval-outbox";

function key(draftId: string): string {
  return `${PREFIX}-${draftId}`;
}

/** 사생활 보호 모드 등에서 localStorage 접근이 막힐 수 있어 항상 감쌉니다. */
function safeRead(draftId: string): DraftOp[] {
  const retained = fallback.get(draftId);
  if (retained) return retained.slice();
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(key(draftId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DraftOp[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(draftId: string, ops: DraftOp[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (ops.length === 0) {
      window.localStorage.removeItem(key(draftId));
      fallback.delete(draftId);
      return;
    }
    window.localStorage.setItem(key(draftId), JSON.stringify(ops));
    fallback.delete(draftId);
  } catch {
    fallback.set(draftId, ops.slice());
  }
}

export function readOutbox(draftId: string): DraftOp[] {
  return safeRead(draftId);
}

/**
 * 큐에 하나 넣습니다.
 *
 * 같은 항목을 연속으로 고칠 때 요청이 쌓이지 않도록, 아직 보내지 않은 같은 대상의
 * 수정 작업이 있으면 하나로 합칩니다. 순서는 유지합니다.
 */
export function enqueue(draftId: string, op: DraftOp): DraftOp[] {
  const ops = safeRead(draftId);

  if (op.kind === "meta") {
    const index = ops.findIndex((entry) => entry.kind === "meta" && !entry.rejected);
    if (index >= 0) {
      const previous = ops[index] as Extract<DraftOp, { kind: "meta" }>;
      ops[index] = { ...previous, opId: op.opId, rejected: undefined, patch: { ...previous.patch, ...op.patch } };
      safeWrite(draftId, ops);
      return ops;
    }
  }

  if (op.kind === "patch") {
    const index = ops.findIndex(
      (entry) => entry.kind === "patch" && entry.itemId === op.itemId && !entry.rejected
    );
    if (index >= 0) {
      const previous = ops[index] as Extract<DraftOp, { kind: "patch" }>;
      ops[index] = { ...previous, opId: op.opId, rejected: undefined, patch: { ...previous.patch, ...op.patch } };
      safeWrite(draftId, ops);
      return ops;
    }
  }

  if (op.kind === "delete") {
    // 아직 못 보낸 수정은 삭제 앞에서 의미가 없습니다.
    const filtered = ops.filter(
      (entry) => !(entry.kind === "patch" && entry.itemId === op.itemId)
    );
    filtered.push(op);
    safeWrite(draftId, filtered);
    return filtered;
  }

  ops.push(op);
  safeWrite(draftId, ops);
  return ops;
}

/** 서버가 받아들인 작업을 큐에서 지웁니다. */
export function acknowledge(draftId: string, opId: string): DraftOp[] {
  const ops = safeRead(draftId).filter((op) => op.opId !== opId);
  safeWrite(draftId, ops);
  return ops;
}

/** 사용자가 "상대 수정 유지"를 골랐을 때처럼 작업을 버립니다. */
export const discard = acknowledge;

export function clearOutbox(draftId: string): void {
  safeWrite(draftId, []);
}

/** 재시도 간격. 계속 실패해도 8초 이상 벌어지지 않게 합니다. */
export function retryDelay(attempt: number): number {
  return Math.min(8000, 1000 * 2 ** Math.max(0, attempt - 1));
}

/** 권한 거절 내용은 성공 처리하지 않고 재시도·복사를 위해 보관합니다. */
export function rejectOperation(draftId: string, opId: string, reason: string): void {
  safeWrite(draftId, safeRead(draftId).map(op => op.opId === opId ? { ...op, rejected: reason } : op));
}
export function retryRejected(draftId: string): void {
  safeWrite(draftId, safeRead(draftId).map(({ rejected: _reason, ...op }) => op));
}
