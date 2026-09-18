"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { orderForAppend, orderForMove, sortByOrder } from "@/lib/order";
import {
  acknowledge,
  discard,
  enqueue,
  readOutbox,
  retryDelay,
  type DraftOp
} from "@/lib/outbox";
import type {
  Audience,
  DraftBundle,
  NewSelectedQuestion,
  Presence,
  SelectedQuestion,
  SelectedQuestionPatch,
  SurveyDraft,
  SurveyDraftPatch,
  SyncResponse
} from "@/lib/types";

/**
 * 설문 초안 작업 공간의 상태를 한곳에서 관리합니다.
 *
 * 세 가지를 동시에 해냅니다.
 * 1. 편집을 로컬 큐에 먼저 적어 두고 순서대로 서버에 보냅니다. (유실 방지)
 * 2. 3초마다 남의 변경을 받아 화면에 반영합니다. (동시 작업)
 * 3. 같은 문항이 겹치면 조용히 덮어쓰지 않고 사용자에게 선택을 받습니다.
 */

const SYNC_INTERVAL_ACTIVE_MS = 3_000;
const SYNC_INTERVAL_HIDDEN_MS = 15_000;
const DISPLAY_NAME_KEY = "school-eval-display-name";
const SESSION_ID_KEY = "school-eval-session-id";

export type SaveState =
  | { kind: "idle"; savedAt: string | null }
  | { kind: "saving" }
  | { kind: "error"; pending: number; message: string };

export type DraftConflict = {
  op: DraftOp;
  /** 서버에 저장되어 있는 최신 문항. 없으면 이미 삭제된 것입니다. */
  current: SelectedQuestion | null;
  /** 내가 보내려던 값. 나란히 비교할 때 씁니다. */
  mine: SelectedQuestionPatch | null;
};

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; reason?: string; current?: unknown };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.ok) {
    const error = new Error(payload.error) as Error & {
      reason?: string;
      current?: unknown;
      status?: number;
    };
    error.reason = payload.reason;
    error.current = payload.current;
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

function readStored(key: string, storage: "local" | "session"): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const store = storage === "local" ? window.localStorage : window.sessionStorage;
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string, storage: "local" | "session"): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const store = storage === "local" ? window.localStorage : window.sessionStorage;
    store.setItem(key, value);
  } catch {
    /* 저장이 막혀도 화면은 계속 동작해야 합니다. */
  }
}

/** 브라우저 탭마다 하나. 접속자 목록에서 나를 제외하는 데 씁니다. */
function ensureSessionId(): string {
  const existing = readStored(SESSION_ID_KEY, "session");
  if (existing) {
    return existing;
  }
  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeStored(SESSION_ID_KEY, created, "session");
  return created;
}

function newOpId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useDraftWorkspace(enabled: boolean) {
  const [draft, setDraft] = useState<SurveyDraft | null>(null);
  const [items, setItems] = useState<SelectedQuestion[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle", savedAt: null });
  const [conflict, setConflict] = useState<DraftConflict | null>(null);
  const [displayName, setDisplayNameState] = useState<string>("");
  const [pendingCount, setPendingCount] = useState(0);

  const sinceRef = useRef<string | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const itemsRef = useRef<SelectedQuestion[]>([]);
  const draftRef = useRef<SurveyDraft | null>(null);
  const flushingRef = useRef(false);
  const attemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string>("");
  const audienceRef = useRef<Audience>("teacher");
  const editingItemIdRef = useRef<string | undefined>(undefined);
  const conflictRef = useRef<DraftConflict | null>(null);

  itemsRef.current = items;
  draftRef.current = draft;
  conflictRef.current = conflict;

  useEffect(() => {
    sessionIdRef.current = ensureSessionId();
    setDisplayNameState(readStored(DISPLAY_NAME_KEY, "local") ?? "");
  }, []);

  const setDisplayName = useCallback((name: string) => {
    const trimmed = name.trim().slice(0, 20);
    setDisplayNameState(trimmed);
    writeStored(DISPLAY_NAME_KEY, trimmed, "local");
  }, []);

  /** 서버에서 받은 문항을 로컬에 멱등하게 반영합니다. 같은 것을 두 번 받아도 안전합니다. */
  const applyChanges = useCallback((changed: SelectedQuestion[], deleted: string[]) => {
    if (changed.length === 0 && deleted.length === 0) {
      return;
    }
    setItems((current) => {
      const map = new Map(current.map((item) => [item.id, item]));
      for (const incoming of changed) {
        const mine = map.get(incoming.id);
        // 내가 지금 고치고 있는 문항은 덮어쓰지 않습니다. 배지로만 알립니다.
        if (mine && editingItemIdRef.current === incoming.id) {
          continue;
        }
        map.set(incoming.id, incoming);
      }
      for (const id of deleted) {
        map.delete(id);
      }
      return Array.from(map.values());
    });
  }, []);

  /* ---------------- 아웃박스 전송 ---------------- */

  const refreshPending = useCallback((draftId: string) => {
    const count = readOutbox(draftId).length;
    setPendingCount(count);
    return count;
  }, []);

  const sendOp = useCallback(async (op: DraftOp): Promise<void> => {
    if (op.kind === "meta") {
      const current = draftRef.current;
      if (!current) {
        return;
      }
      const data = await call<{ draft: SurveyDraft }>("/api/draft/meta", {
        method: "PATCH",
        body: JSON.stringify({
          expectedRev: current.rev,
          patch: op.patch,
          updatedBy: readStored(DISPLAY_NAME_KEY, "local") ?? undefined
        })
      });
      setDraft(data.draft);
      return;
    }

    if (op.kind === "create") {
      const data = await call<{ items: SelectedQuestion[] }>("/api/draft/items", {
        method: "POST",
        body: JSON.stringify({
          items: op.items,
          updatedBy: readStored(DISPLAY_NAME_KEY, "local") ?? undefined
        })
      });
      applyChanges(data.items, []);
      return;
    }

    const target = itemsRef.current.find((item) => item.id === op.itemId);
    if (!target) {
      return;
    }

    if (op.kind === "patch") {
      const data = await call<{ item: SelectedQuestion }>(`/api/draft/items/${op.itemId}`, {
        method: "PATCH",
        body: JSON.stringify({
          expectedRev: target.rev,
          patch: op.patch,
          updatedBy: readStored(DISPLAY_NAME_KEY, "local") ?? undefined
        })
      });
      applyChanges([data.item], []);
      return;
    }

    await call<{ id: string }>(`/api/draft/items/${op.itemId}`, {
      method: "DELETE",
      body: JSON.stringify({
        expectedRev: target.rev,
        updatedBy: readStored(DISPLAY_NAME_KEY, "local") ?? undefined
      })
    });
    applyChanges([], [op.itemId]);
  }, [applyChanges]);

  /**
   * 큐를 앞에서부터 하나씩 보냅니다.
   *
   * 순서대로 보내야 같은 문항에 대한 연속 수정이 올바른 rev로 나갑니다.
   * 충돌이 나면 멈추고 사용자에게 물어봅니다.
   */
  const flush = useCallback(async (): Promise<void> => {
    const draftId = draftIdRef.current;
    if (!draftId || flushingRef.current || conflictRef.current) {
      return;
    }

    let queue = readOutbox(draftId);
    if (queue.length === 0) {
      setPendingCount(0);
      return;
    }

    flushingRef.current = true;
    setSaveState({ kind: "saving" });

    try {
      while (queue.length > 0) {
        const op = queue[0];
        try {
          await sendOp(op);
          queue = acknowledge(draftId, op.opId);
          setPendingCount(queue.length);
        } catch (error) {
          const typed = error as Error & { reason?: string; current?: unknown };
          if (typed.reason === "conflict") {
            const next: DraftConflict = {
              op,
              current: (typed.current as SelectedQuestion | null) ?? null,
              mine: op.kind === "patch" ? op.patch : null
            };
            setConflict(next);
            conflictRef.current = next;
            setSaveState({
              kind: "error",
              pending: queue.length,
              message: "다른 사람이 먼저 수정했습니다."
            });
            return;
          }
          throw typed;
        }
      }

      attemptRef.current = 0;
      setSaveState({ kind: "idle", savedAt: new Date().toISOString() });
    } catch (error) {
      attemptRef.current += 1;
      const pending = refreshPending(draftId);
      setSaveState({
        kind: "error",
        pending,
        message: error instanceof Error ? error.message : "저장에 실패했습니다."
      });
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      retryTimerRef.current = setTimeout(() => void flush(), retryDelay(attemptRef.current));
    } finally {
      flushingRef.current = false;
    }
  }, [refreshPending, sendOp]);

  /** 편집을 큐에 넣고 곧바로 전송을 시도합니다. */
  const push = useCallback(
    (op: DraftOp) => {
      const draftId = draftIdRef.current;
      if (!draftId) {
        return;
      }
      const queue = enqueue(draftId, op);
      setPendingCount(queue.length);
      void flush();
    },
    [flush]
  );

  /* ---------------- 최초 적재 ---------------- */

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const bundle = await call<DraftBundle>("/api/draft");
        if (cancelled) {
          return;
        }
        draftIdRef.current = bundle.draft.id;
        sinceRef.current = bundle.since;
        setDraft(bundle.draft);
        setItems(bundle.items);
        // 지난번에 못 보낸 편집이 남아 있으면 자동으로 이어서 보냅니다.
        if (refreshPending(bundle.draft.id) > 0) {
          void flush();
        }
      } catch (error) {
        if (!cancelled) {
          setSaveState({
            kind: "error",
            pending: 0,
            message: error instanceof Error ? error.message : "초안을 불러오지 못했습니다."
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, flush, refreshPending]);

  /* ---------------- 폴링 + 접속자 ---------------- */

  useEffect(() => {
    if (!enabled || !draft) {
      return;
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (stopped) {
        return;
      }
      try {
        const params = new URLSearchParams({ sessionId: sessionIdRef.current });
        if (sinceRef.current) {
          params.set("since", sinceRef.current);
        }
        const data = await call<SyncResponse>(`/api/draft/sync?${params.toString()}`);
        if (stopped) {
          return;
        }
        sinceRef.current = data.nextSince;
        if (data.draft) {
          setDraft((current) =>
            current && data.draft && data.draft.rev >= current.rev ? data.draft : current
          );
        }
        applyChanges(data.changed, data.deleted);
        setPresence(data.presence);

        await call<{ presence: Presence[] }>("/api/draft/presence", {
          method: "POST",
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            displayName: readStored(DISPLAY_NAME_KEY, "local") ?? "",
            audience: audienceRef.current,
            editingItemId: editingItemIdRef.current
          })
        });
      } catch {
        /* 동기화 실패는 조용히 넘깁니다. 저장 상태는 아웃박스가 따로 알립니다. */
      } finally {
        if (!stopped) {
          const delay =
            typeof document !== "undefined" && document.visibilityState === "hidden"
              ? SYNC_INTERVAL_HIDDEN_MS
              : SYNC_INTERVAL_ACTIVE_MS;
          timer = setTimeout(() => void tick(), delay);
        }
      }
    };

    timer = setTimeout(() => void tick(), SYNC_INTERVAL_ACTIVE_MS);

    return () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [applyChanges, draft, enabled]);

  /* ---------------- 네트워크 복귀 · 이탈 경고 ---------------- */

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onOnline = () => void flush();
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const draftId = draftIdRef.current;
      if (draftId && readOutbox(draftId).length > 0) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [enabled, flush]);

  useEffect(
    () => () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    },
    []
  );

  /* ---------------- 편집 동작 ---------------- */

  const setMeta = useCallback(
    (patch: SurveyDraftPatch) => {
      setDraft((current) => (current ? { ...current, ...patch } : current));
      push({ kind: "meta", opId: newOpId(), patch });
    },
    [push]
  );

  const addItems = useCallback(
    (drafts: Array<Omit<NewSelectedQuestion, "id" | "order">>) => {
      const existing = itemsRef.current;
      let cursor = orderForAppend(existing);
      const prepared: NewSelectedQuestion[] = drafts.map((entry) => {
        const sameAudience = existing.filter((item) => item.audience === entry.audience);
        cursor = Math.max(cursor, orderForAppend(sameAudience));
        const order = cursor;
        cursor += 1;
        return { ...entry, id: newOpId(), order };
      });

      const now = new Date().toISOString();
      const optimistic: SelectedQuestion[] = prepared.map((entry) => ({
        ...entry,
        rev: 0,
        createdAt: now,
        updatedAt: now
      }));
      setItems((current) => [...current, ...optimistic]);
      push({ kind: "create", opId: newOpId(), items: prepared });
    },
    [push]
  );

  const patchItem = useCallback(
    (itemId: string, patch: SelectedQuestionPatch) => {
      setItems((current) =>
        current.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
      );
      push({ kind: "patch", opId: newOpId(), itemId, patch });
    },
    [push]
  );

  const removeItem = useCallback(
    (itemId: string) => {
      setItems((current) => current.filter((item) => item.id !== itemId));
      push({ kind: "delete", opId: newOpId(), itemId });
    },
    [push]
  );

  /**
   * 문항을 한 칸 옮깁니다.
   *
   * 옮기는 문항의 order 하나만 바꿉니다. 전체에 번호를 다시 매기지 않으므로
   * 다른 사람이 같은 순간에 문항을 추가해도 충돌하지 않습니다.
   */
  const moveItem = useCallback(
    (itemId: string, delta: number) => {
      const target = itemsRef.current.find((item) => item.id === itemId);
      if (!target) {
        return;
      }
      const siblings = itemsRef.current.filter(
        (item) => item.audience === target.audience && !item.deleted
      );
      const order = orderForMove(siblings, itemId, delta);
      if (order === null) {
        return;
      }
      patchItem(itemId, { order });
    },
    [patchItem]
  );

  /* ---------------- 충돌 해결 ---------------- */

  const resolveConflict = useCallback(
    (choice: "mine" | "theirs") => {
      const draftId = draftIdRef.current;
      const active = conflictRef.current;
      if (!draftId || !active) {
        return;
      }

      if (choice === "theirs") {
        discard(draftId, active.op.opId);
        if (active.current) {
          applyChanges([active.current], []);
        } else if (active.op.kind !== "meta" && active.op.kind !== "create") {
          applyChanges([], [active.op.itemId]);
        }
      } else if (active.current) {
        // 상대의 최신 rev를 받아들인 뒤 내 수정을 다시 올립니다.
        applyChanges([active.current], []);
        if (active.mine) {
          setItems((current) =>
            current.map((item) =>
              item.id === active.current?.id ? { ...item, ...active.mine } : item
            )
          );
        }
      }

      setConflict(null);
      conflictRef.current = null;
      attemptRef.current = 0;
      setPendingCount(readOutbox(draftId).length);
      void flush();
    },
    [applyChanges, flush]
  );

  const retryNow = useCallback(() => {
    attemptRef.current = 0;
    void flush();
  }, [flush]);

  const setActiveAudience = useCallback((audience: Audience) => {
    audienceRef.current = audience;
  }, []);

  const setEditingItemId = useCallback((itemId: string | undefined) => {
    editingItemIdRef.current = itemId;
  }, []);

  const sortedItems = useMemo(() => sortByOrder(items.filter((item) => !item.deleted)), [items]);

  return {
    draft,
    items: sortedItems,
    presence,
    saveState,
    pendingCount,
    conflict,
    displayName,
    setDisplayName,
    setMeta,
    addItems,
    patchItem,
    removeItem,
    moveItem,
    resolveConflict,
    retryNow,
    setActiveAudience,
    setEditingItemId
  };
}
