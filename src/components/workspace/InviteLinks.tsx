"use client";

import { useEffect, useState } from "react";
import { AUDIENCES, AUDIENCE_SHORT_LABELS, type Audience, type BuilderInvite } from "@/lib/types";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

export function InviteLinks() {
  const [label, setLabel] = useState("");
  const [audience, setAudience] = useState<Audience | "">("");
  const [invites, setInvites] = useState<BuilderInvite[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    const response = await fetch("/api/invite");
    const payload = (await response.json()) as ApiEnvelope<{ invites: BuilderInvite[] }>;
    if (payload.ok) {
      setInvites(payload.data.invites);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function createLink() {
    setError("");
    setNotice("");
    const response = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, audience: audience || undefined })
    });
    const payload = (await response.json()) as ApiEnvelope<{ invite: BuilderInvite }>;
    if (!payload.ok) {
      setError(payload.error);
      return;
    }
    setLabel("");
    setAudience("");
    await reload();
    const url = `${window.location.origin}/?invite=${payload.data.invite.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("링크를 복사했습니다.");
    } catch {
      setNotice(url);
    }
  }

  return (
    <div className="ws-form">
      <p className="ws-hint">일반 부장에게 줄 링크입니다. 받은 사람은 문항 구성만 봅니다.</p>
      <label className="ws-field">
        <span>역할 이름</span>
        <input
          className="ws-input"
          value={label}
          placeholder="교무부장"
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <label className="ws-field">
        <span>대상</span>
        <select
          className="ws-select"
          value={audience}
          onChange={(event) => setAudience(event.target.value as Audience | "")}
        >
          <option value="">전체</option>
          {AUDIENCES.map((entry) => (
            <option key={entry} value={entry}>
              {AUDIENCE_SHORT_LABELS[entry]}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="ws-btn ws-btn--primary" disabled={!label.trim()} onClick={() => void createLink()}>
        링크 만들기
      </button>
      {notice ? <p className="ws-hint">{notice}</p> : null}
      {error ? <p className="ws-custom-error">{error}</p> : null}

      <div className="ws-invite-list">
        {invites.map((invite) => {
          const url = typeof window === "undefined" ? "" : `${window.location.origin}/?invite=${invite.token}`;
          return (
            <div key={invite.token} className="ws-invite-row">
              <div>
                <strong>{invite.label}</strong>
                <span className="ws-hint">
                  {invite.audience ? AUDIENCE_SHORT_LABELS[invite.audience] : "전체"}
                </span>
              </div>
              <div className="ws-invite-actions">
                <button
                  type="button"
                  className="ws-btn ws-btn--soft"
                  onClick={() => void navigator.clipboard.writeText(url)}
                >
                  복사
                </button>
                <button
                  type="button"
                  className="ws-btn ws-btn--ghost"
                  onClick={() => {
                    void fetch("/api/invite", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ token: invite.token })
                    }).then(() => reload());
                  }}
                >
                  끊기
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
