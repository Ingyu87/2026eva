"use client";

import { useEffect, useState } from "react";
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  type Audience,
  type GoogleFormsByAudience,
  type SurveyDraft,
  type SurveyDraftAuthor
} from "@/lib/types";

/**
 * 설문 설정 모달.
 *
 * 제목·안내문·작성 분담을 본 화면에서 빼내 여기로 옮겼습니다.
 * 그래야 작업 화면이 "고르고 담는다"는 한 가지 일만 하게 되고 세로 스크롤이 사라집니다.
 *
 * 각 항목은 따로 저장되므로 두 사람이 서로 다른 항목을 동시에 고쳐도 부딪히지 않습니다.
 */

type Tab = "survey" | "intro" | "authors" | "account";

export function SettingsModal({
  draft,
  displayName,
  googleForms,
  onClose,
  onMeta,
  onDisplayName
}: {
  draft: SurveyDraft;
  displayName: string;
  googleForms: GoogleFormsByAudience;
  onClose: () => void;
  onMeta: (patch: Partial<SurveyDraft>) => void;
  onDisplayName: (name: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("survey");
  const [introFor, setIntroFor] = useState<Audience>("teacher");
  const [nameDraft, setNameDraft] = useState(displayName);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const authors = draft.draftAuthors ?? [];

  const patchAuthors = (rows: SurveyDraftAuthor[]) => onMeta({ draftAuthors: rows });

  const formEntries = AUDIENCES.map((audience) => ({
    audience,
    form: googleForms[audience]
  })).filter((entry) => entry.form);

  return (
    <div className="ws-overlay" role="dialog" aria-modal="true" aria-label="설문 설정">
      <div className="ws-modal">
        <div className="ws-modal-head">
          <h2>설문 설정</h2>
          <button type="button" className="ws-icon-btn" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="ws-modal-tabs">
          {(
            [
              ["survey", "설문 정보"],
              ["intro", "안내문"],
              ["authors", "작성 분담"],
              ["account", "내 표시 이름"]
            ] as Array<[Tab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={tab === key ? "ws-modal-tab is-active" : "ws-modal-tab"}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ws-modal-body">
          {tab === "survey" ? (
            <div className="ws-form">
              <label className="ws-field">
                <span>설문 제목</span>
                <input
                  className="ws-input"
                  value={draft.title}
                  onChange={(event) => onMeta({ title: event.target.value })}
                />
              </label>
              <label className="ws-field">
                <span>학교명</span>
                <input
                  className="ws-input"
                  value={draft.schoolName}
                  onChange={(event) => onMeta({ schoolName: event.target.value })}
                />
              </label>
              <label className="ws-field">
                <span>기준일</span>
                <input
                  className="ws-input"
                  type="date"
                  value={draft.surveyDate}
                  onChange={(event) => onMeta({ surveyDate: event.target.value })}
                />
              </label>

              {formEntries.length > 0 ? (
                <div className="ws-form-block">
                  <span className="ws-group-title">생성된 Google Forms</span>
                  <div className="ws-form-links">
                    {formEntries.map(({ audience, form }) => (
                      <div key={audience} className="ws-form-link-row">
                        <strong>{AUDIENCE_LABELS[audience]}</strong>
                        <a href={form!.editUrl} target="_blank" rel="noreferrer">
                          편집
                        </a>
                        {form!.responderUrl ? (
                          <a href={form!.responderUrl} target="_blank" rel="noreferrer">
                            응답
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "intro" ? (
            <div className="ws-form">
              <div className="ws-subtabs">
                {AUDIENCES.map((audience) => (
                  <button
                    key={audience}
                    type="button"
                    className={introFor === audience ? "ws-subtab is-active" : "ws-subtab"}
                    onClick={() => setIntroFor(audience)}
                  >
                    {AUDIENCE_LABELS[audience]}
                  </button>
                ))}
              </div>
              <textarea
                className="ws-textarea"
                rows={8}
                value={draft.introByAudience[introFor]}
                onChange={(event) =>
                  onMeta({
                    introByAudience: {
                      ...draft.introByAudience,
                      [introFor]: event.target.value
                    }
                  })
                }
              />
            </div>
          ) : null}

          {tab === "authors" ? (
            <div className="ws-form">
              <p className="ws-hint">
                담당을 나누면 접속자 표시에도 쓰입니다. 완료한 역할에 체크하세요.
              </p>
              <div className="ws-author-list">
                {authors.map((row) => (
                  <div key={row.id} className="ws-author-row">
                    <input
                      className="ws-input"
                      value={row.title}
                      placeholder="역할 이름"
                      onChange={(event) =>
                        patchAuthors(
                          authors.map((entry) =>
                            entry.id === row.id ? { ...entry, title: event.target.value } : entry
                          )
                        )
                      }
                    />
                    <label className="ws-check">
                      <input
                        type="checkbox"
                        checked={row.done}
                        onChange={(event) =>
                          patchAuthors(
                            authors.map((entry) =>
                              entry.id === row.id
                                ? { ...entry, done: event.target.checked }
                                : entry
                            )
                          )
                        }
                      />
                      완료
                    </label>
                    <button
                      type="button"
                      className="ws-icon-btn"
                      aria-label="행 삭제"
                      disabled={authors.length <= 1}
                      onClick={() => patchAuthors(authors.filter((entry) => entry.id !== row.id))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="ws-btn ws-btn--soft"
                onClick={() =>
                  patchAuthors([
                    ...authors,
                    { id: crypto.randomUUID(), title: "", done: false }
                  ])
                }
              >
                ＋ 역할 추가
              </button>
            </div>
          ) : null}

          {tab === "account" ? (
            <div className="ws-form">
              <p className="ws-hint">
                같이 작업하는 분들에게 보이는 이름입니다. 로그인 정보와는 별개입니다.
              </p>
              <label className="ws-field">
                <span>표시 이름</span>
                <input
                  className="ws-input"
                  maxLength={20}
                  value={nameDraft}
                  placeholder="예: 교무부장"
                  onChange={(event) => setNameDraft(event.target.value)}
                  list="ws-author-titles"
                />
              </label>
              <datalist id="ws-author-titles">
                {authors.map((row) => (
                  <option key={row.id} value={row.title} />
                ))}
              </datalist>
              <button
                type="button"
                className="ws-btn ws-btn--primary"
                onClick={() => {
                  onDisplayName(nameDraft);
                  onClose();
                }}
              >
                저장
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
