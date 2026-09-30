"use client";

import { defaultWorkColor } from "@/lib/workStatus";
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
  const [copyMessage, setCopyMessage] = useState("");
  const [copyFallback, setCopyFallback] = useState("");

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

  async function copyLinks(text: string, message: string) {
    setCopyMessage(""); setCopyFallback("");
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(message);
    } catch {
      setCopyFallback(text);
      setCopyMessage("아래 내용을 선택해 복사하세요.");
    }
  }

  function copyAllLinks() {
    const text = ["학교평가 문항 작성 링크", "본인 부장 이름의 링크로 들어가 문항을 작성한 뒤 제출해 주세요.", "",
      ...invites.map(invite => `${invite.label} (${invite.audience ? AUDIENCE_SHORT_LABELS[invite.audience] : "전체 대상"})\n${linkOf(invite.token)}`)
    ].join("\n\n");
    void copyLinks(text, `${invites.length}명 링크를 복사했습니다. 메신저에 붙여넣으세요.`);
  }

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
        전체 링크를 복사해 메신저로 안내하세요. 부장이 담은 문항은 이 설문에 바로 모이고, 제출을 누르면 아래에
        표시됩니다. 연구부장도 같은 화면에서 직접 문항을 담을 수 있습니다.
      </p>

      {invites.length > 0 ? (
        <>
          <p className="ws-invite-summary">
            제출 {submitted} / {invites.length}
          </p>
          <button type="button" className="ws-btn ws-btn--primary" disabled={busy} onClick={copyAllLinks}>전체 링크 복사</button>
          {copyMessage && <p className="ws-hint" role="status">{copyMessage}</p>}
          {copyFallback && <textarea className="ws-textarea" aria-label="복사할 링크" readOnly rows={6} value={copyFallback} onFocus={event=>event.currentTarget.select()} />}
          <div className="ws-invite-list">
            {invites.map((invite) => (
              <div key={invite.token} className="ws-invite-row">
                <div className="ws-invite-info">
                  <strong className={`work-badge work-color-${invite.color ?? defaultWorkColor(invite.label)}`}>{invite.label}</strong>
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
                    onClick={() => void copyLinks(linkOf(invite.token), `${invite.label} 링크를 복사했습니다.`)}
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
      <p className="ws-hint">부장 이름과 응답 대상을 입력한 뒤 링크를 만드세요. 이름이 빈 줄은 건너뜁니다. 전체 또는 부장별로 복사할 수 있습니다.</p>
      <fieldset className="ra-editor-fieldset ws-form" disabled={busy}>
        {rows.map((row, index) => <div className="ws-invite-batch-row" key={row.id}>
          <label className="ws-field"><span>부장 이름 {index + 1}</span><input className="ws-input" value={row.label} placeholder={index === 0 ? "예: 교무부장" : "부장 이름"} maxLength={60} onChange={event => setRows(previous => previous.map(entry => entry.id === row.id ? { ...entry, label: event.target.value } : entry))} /></label>
          <label className="ws-field"><span>대상 {index + 1}</span><select className="ws-select" value={row.audience} onChange={event => setRows(previous => previous.map(entry => entry.id === row.id ? { ...entry, audience: event.target.value as Audience | "" } : entry))}>
            <option value="">전체</option>{AUDIENCES.map(entry => <option key={entry} value={entry}>{AUDIENCE_SHORT_LABELS[entry]}</option>)}
          </select></label>
          <button type="button" className="ws-btn ws-btn--ghost" aria-label={index + 1 + "행 삭제"} disabled={rows.length === 1} onClick={() => setRows(previous => previous.filter(entry => entry.id !== row.id))}>삭제</button>
        </div>)}
        <button type="button" className="ws-btn ws-btn--soft" disabled={rows.length >= 30} onClick={() => setRows(previous => [...previous, { id: nextId.current++, label: "", audience: "" }])}>＋ 부장 추가</button>
        <button type="button" className="ws-btn ws-btn--primary" disabled={busy || !rows.some(row => row.label.trim())} onClick={() => void createLink()}>{busy ? "링크 만드는 중…" : "링크 만들기"}</button>
        {!rows.some(row => row.label.trim()) && <span className="ws-hint">부장 이름을 입력하세요.</span>}
      </fieldset>
      {error ? <p className="ws-custom-error">{error}</p> : null}
    </div>
  );
}
