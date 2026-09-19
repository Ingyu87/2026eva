"use client";

import { useEffect, useRef, useState } from "react";
import {
  AUDIENCES,
  AUDIENCE_SHORT_LABELS,
  type Audience,
  type BuilderInviteSummary
} from "@/lib/types";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

/**
 * 연구부장이 일반 부장에게 줄 링크를 만들고, 누가 제출했는지 봅니다.
 * 부장이 담은 문항은 같은 초안에 모이므로 따로 합칠 필요가 없습니다.
 */
export function InviteLinks({ onChanged }: { onChanged?: (invites: BuilderInviteSummary[]) => void }) {
  const [rows, setRows] = useState<{ id: number; label: string; audience: Audience | "" }[]>([0, 1, 2, 3].map(id => ({ id, label: "", audience: "" })));
  const nextId = useRef(4);
  const creating = useRef(false);
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<BuilderInviteSummary[]>([]);
  const [error, setError] = useState("");

  async function reload() {
    const response = await fetch("/api/invite");
    const payload = (await response.json()) as ApiEnvelope<{ invites: BuilderInviteSummary[] }>;
    if (payload.ok) {
      setInvites(payload.data.invites);
      onChanged?.(payload.data.invites);
    }
  }

  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 20000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linkOf = (token: string) => `${window.location.origin}/?invite=${token}`;

  async function createLink() {
    if (creating.current) return;
    const pending = rows.filter(row => row.label.trim());
    if (!pending.length) return;
    const names = pending.map(row => row.label.trim());
    if (new Set(names).size !== names.length) { setError("역할 이름이 겹칩니다. 구분할 수 있게 이름을 바꿔 주세요."); return; }
    creating.current = true; setBusy(true); setError("");
    try {
      for (const row of pending) {
        const response = await fetch("/api/invite", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: row.label.trim(), audience: row.audience || undefined })
        });
        const payload = await response.json() as ApiEnvelope<{ invite: BuilderInviteSummary }>;
        if (!payload.ok) throw new Error(row.label + ": " + payload.error);
        setInvites(previous => [...previous, payload.data.invite]);
        setRows(previous => previous.filter(entry => entry.id !== row.id));
      }
      setRows(previous => previous.length ? previous : [{ id: nextId.current++, label: "", audience: "" }]);
    } catch (err) {
      setError((err instanceof Error ? err.message : "링크 생성 중 연결이 끊겼습니다.") + " 완료된 링크는 위 목록에 남아 있습니다. 다시 만들기 전에 목록을 확인하세요.");
    } finally {
      try { await reload(); } catch { setError("목록을 불러오지 못했습니다. 연결을 확인하고 다시 열어 생성된 링크를 확인하세요."); }
      creating.current = false; setBusy(false);
    }
  }

  async function revoke(invite: BuilderInviteSummary) {
    const ok = window.confirm(
      `${invite.label} 링크를 끊을까요?\n작업 중이라도 바로 막히고 되돌릴 수 없습니다. 다시 쓰려면 새 링크를 만들어야 합니다.`
    );
    if (!ok) {
      return;
    }
    await fetch("/api/invite", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: invite.token })
    });
    await reload();
  }

  const submitted = invites.filter((invite) => invite.submittedAt).length;

  return (
    <div className="ws-form">
      <p className="ws-hint">
        부장에게 링크를 하나씩 보내세요. 부장이 담은 문항은 이 설문에 바로 모이고, 제출을 누르면 아래에
        표시됩니다. 연구부장도 같은 화면에서 직접 문항을 담을 수 있습니다.
      </p>

      {invites.length > 0 ? (
        <>
          <p className="ws-invite-summary">
            제출 {submitted} / {invites.length}
          </p>
          <div className="ws-invite-list">
            {invites.map((invite) => (
              <div key={invite.token} className="ws-invite-row">
                <div className="ws-invite-info">
                  <strong>{invite.label}</strong>
                  <span className="ws-hint">
                    {invite.audience ? AUDIENCE_SHORT_LABELS[invite.audience] : "전체"} · {invite.itemCount}문항
                  </span>
                  <span className={invite.submittedAt ? "ws-invite-state is-done" : "ws-invite-state"}>
                    {invite.submittedAt ? `제출함 ${formatTime(invite.submittedAt)}` : "작성 중"}
                  </span>
                </div>
                <div className="ws-invite-actions">
                  <button
                    type="button"
                    className="ws-btn ws-btn--soft"
                    onClick={() => void navigator.clipboard.writeText(linkOf(invite.token))}
                  >
                    복사
                  </button>
                  <button type="button" className="ws-btn ws-btn--ghost" onClick={() => void revoke(invite)}>
                    끊기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <p className="ws-hint">
        이 브라우저에서 링크를 열면 지금 계정이 로그아웃됩니다. 확인은 시크릿 창에서 하세요.
      </p>
      <p className="ws-hint">부장 이름과 응답 대상을 여러 줄로 입력한 뒤 한 번에 만드세요. 이름이 빈 줄은 건너뜁니다. 만든 링크는 위 목록에서 부장별로 복사하세요.</p>
      <fieldset className="ra-editor-fieldset ws-form" disabled={busy}>
        {rows.map((row, index) => <div className="ws-invite-batch-row" key={row.id}>
          <label className="ws-field"><span>부장 이름 {index + 1}</span><input className="ws-input" value={row.label} placeholder={index === 0 ? "예: 교무부장" : "부장 이름"} maxLength={60} onChange={event => setRows(previous => previous.map(entry => entry.id === row.id ? { ...entry, label: event.target.value } : entry))} /></label>
          <label className="ws-field"><span>대상 {index + 1}</span><select className="ws-select" value={row.audience} onChange={event => setRows(previous => previous.map(entry => entry.id === row.id ? { ...entry, audience: event.target.value as Audience | "" } : entry))}>
            <option value="">전체</option>{AUDIENCES.map(entry => <option key={entry} value={entry}>{AUDIENCE_SHORT_LABELS[entry]}</option>)}
          </select></label>
          <button type="button" className="ws-btn ws-btn--ghost" aria-label={index + 1 + "행 삭제"} disabled={rows.length === 1} onClick={() => setRows(previous => previous.filter(entry => entry.id !== row.id))}>삭제</button>
        </div>)}
        <button type="button" className="ws-btn ws-btn--soft" disabled={rows.length >= 30} onClick={() => setRows(previous => [...previous, { id: nextId.current++, label: "", audience: "" }])}>＋ 부장 추가</button>
        <button type="button" className="ws-btn ws-btn--primary" disabled={busy || !rows.some(row => row.label.trim())} onClick={() => void createLink()}>{busy ? "링크 만드는 중…" : "입력한 " + rows.filter(row => row.label.trim()).length + "명 링크 한 번에 만들기"}</button>
      </fieldset>
      {error ? <p className="ws-custom-error">{error}</p> : null}
    </div>
  );
}
