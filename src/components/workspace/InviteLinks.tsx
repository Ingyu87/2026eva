"use client";

import { useEffect, useState } from "react";
import { AUDIENCES, AUDIENCE_SHORT_LABELS, type Audience, type BuilderInvite } from "@/lib/types";

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

export function InviteLinks() {
  const [label, setLabel] = useState("");
  const [audience, setAudience] = useState<Audience | "">("");
  const [invites, setInvites] = useState<BuilderInvite[]>([]);
  const [created, setCreated] = useState<{ label: string; url: string; copied: boolean } | null>(null);
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
    setCreated(null);
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
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      // 복사가 막힌 환경에서는 아래 주소 칸에서 직접 복사합니다.
    }
    setCreated({ label: payload.data.invite.label, url, copied });
  }

  async function revoke(invite: BuilderInvite) {
    const ok = window.confirm(
      `${invite.label} 링크를 끊을까요?
작업 중이라도 바로 막히고 되돌릴 수 없습니다. 다시 쓰려면 새 링크를 만들어야 합니다.`
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

  return (
    <div className="ws-form">
      <p className="ws-hint">
        일반 부장에게 줄 링크입니다. 받은 사람은 문항 구성만 봅니다. 링크는 그 부장에게만 보내세요.
      </p>
      <p className="ws-hint">
        이 브라우저에서 링크를 열면 지금 계정이 로그아웃됩니다. 확인은 시크릿 창에서 하세요.
      </p>
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
      {created ? (
        <div className="ws-field">
          <span>
            {created.label} 링크를 만들었습니다{created.copied ? " (복사됨)" : ""}. 이 부장에게만 보내세요.
          </span>
          <input
            className="ws-input"
            readOnly
            value={created.url}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      ) : null}
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
                  onClick={() => void revoke(invite)}
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
