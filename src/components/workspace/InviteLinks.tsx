"use client";

import { useEffect, useState } from "react";
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
  const [label, setLabel] = useState("");
  const [audience, setAudience] = useState<Audience | "">("");
  const [invites, setInvites] = useState<BuilderInviteSummary[]>([]);
  const [created, setCreated] = useState<{ label: string; url: string; copied: boolean } | null>(null);
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
    setError("");
    setCreated(null);
    const response = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, audience: audience || undefined })
    });
    const payload = (await response.json()) as ApiEnvelope<{ invite: BuilderInviteSummary }>;
    if (!payload.ok) {
      setError(payload.error);
      return;
    }
    setLabel("");
    setAudience("");
    await reload();
    const url = linkOf(payload.data.invite.token);
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      // 복사가 막힌 환경에서는 아래 주소 칸에서 직접 복사합니다.
    }
    setCreated({ label: payload.data.invite.label, url, copied });
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
      <label className="ws-field">
        <span>새 링크의 역할 이름</span>
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
      <button
        type="button"
        className="ws-btn ws-btn--primary"
        disabled={!label.trim()}
        onClick={() => void createLink()}
      >
        링크 만들기
      </button>
      {error ? <p className="ws-custom-error">{error}</p> : null}
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
    </div>
  );
}
