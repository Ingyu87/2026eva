"use client";

import type { SaveState } from "@/hooks/useDraftWorkspace";
import type { Presence } from "@/lib/types";

/**
 * 저장 상태를 화면에 항상 띄웁니다.
 *
 * "저장됐나?"를 사용자가 의심하지 않게 하는 것이 목적입니다. 특히 전송하지 못한 편집이
 * 남아 있을 때는 건수를 보여주고 눌러서 바로 다시 보낼 수 있게 합니다.
 */
export function SaveStateBadge({
  state,
  onRetry
}: {
  state: SaveState;
  onRetry: () => void;
}) {
  if (state.kind === "saving") {
    return (
      <span className="save-state saving" role="status">
        저장 중…
      </span>
    );
  }

  if (state.kind === "error") {
    const label =
      state.pending > 0 ? `미전송 ${state.pending}건 · 재시도` : "저장 실패 · 재시도";
    return (
      <button type="button" className="save-state failed" onClick={onRetry} title={state.message}>
        {label} — {state.message}
      </button>
    );
  }

  const savedAt = state.savedAt
    ? new Date(state.savedAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    : null;

  return (
    <span className="save-state saved" role="status">
      {savedAt ? `저장됨 ${savedAt}` : "저장됨"}
    </span>
  );
}

/** 같은 초안을 함께 보고 있는 사람. 이름은 표시용 라벨이며 인증 수단이 아닙니다. */
export function PresenceBadge({ presence }: { presence: Presence[] }) {
  if (presence.length === 0) {
    return null;
  }

  const names = presence
    .map((entry, index) => entry.displayName || `사용자 ${index + 2}`)
    .join(", ");

  return (
    <span className="presence-badge" title={names}>
      함께 작업 중 {presence.length}
    </span>
  );
}
