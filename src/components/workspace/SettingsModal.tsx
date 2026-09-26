"use client";

import { useEffect, useState } from "react";
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  SURVEY_MODES,
  SURVEY_MODE_LABELS,
  type Audience,
  type GoogleFormsByAudience,
  type SurveyDraft,
  type SurveyMode
} from "@/lib/types";
import { InviteLinks } from "./InviteLinks";
import { PriorSurveyImport, type PriorSurveyCommit } from "./PriorSurveyImport";

/**
 * 설문 설정 모달.
 *
 * 제목·안내문·작성 분담을 본 화면에서 빼내 여기로 옮겼습니다.
 * 그래야 작업 화면이 "고르고 담는다"는 한 가지 일만 하게 되고 세로 스크롤이 사라집니다.
 *
 * 각 항목은 따로 저장되므로 두 사람이 서로 다른 항목을 동시에 고쳐도 부딪히지 않습니다.
 */

export type SettingsTab = "survey" | "intro" | "invites" | "account";
type Tab = SettingsTab;

export function SettingsModal({
  draft,
  displayName,
  googleForms,
  onClose,
  onMeta,
  onDisplayName,
  onSwitchedToAnnual,
  itemCount,
  onResetItems,
  onImportPrior,
  initialTab = "survey"
}: {
  draft: SurveyDraft;
  displayName: string;
  googleForms: GoogleFormsByAudience;
  onClose: () => void;
  onMeta: (patch: Partial<SurveyDraft>) => void;
  onDisplayName: (name: string) => void;
  onSwitchedToAnnual?: () => void;
  itemCount: number;
  onResetItems: () => void;
  onImportPrior: (items: PriorSurveyCommit[]) => void;
  initialTab?: SettingsTab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
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
              ["invites", "부장 작업"],
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
              {/*
                평가 시기에 따라 만들 수 있는 산출물이 달라집니다.
                가이드북 Q12: 학교평가서에는 학년말 최종 설문 결과를 반영합니다.
              */}
              <div className="ws-field">
                <span>평가 시기</span>
                <div className="ws-radio-row">
                  {SURVEY_MODES.map((mode) => (
                    <label
                      key={mode}
                      className={draft.mode === mode ? "ws-radio is-on" : "ws-radio"}
                    >
                      <input
                        type="radio"
                        name="survey-mode"
                        checked={draft.mode === mode}
                        onChange={() => {
                          onMeta({ mode: mode as SurveyMode });
                          if (mode === "annual") {
                            onSwitchedToAnnual?.();
                          }
                        }}
                      />
                      {SURVEY_MODE_LABELS[mode]}
                    </label>
                  ))}
                </div>
                <p className="ws-hint">
                  {draft.mode === "annual"
                    ? "중간평가 문항은 남습니다. 제출 서류는 올해 학년말 결과로만 만듭니다. (가이드북 Q12)"
                    : "중간 점검용입니다. 제출 서류는 학년말에서만 만듭니다. 학년말로 바꾸면 문항은 남기고, 다음에 할 일만 보여 줍니다."}
                </p>
              </div>

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

              {/* 학년별 결과 분해를 하려면 설문에 학년 문항이 들어가야 합니다. */}
              <div className="ws-field">
                <span>학생 설문 학년</span>
                <div className="ws-grade-row">
                  {[1, 2, 3, 4, 5, 6].map((grade) => {
                    const on = (draft.studentGrades ?? []).includes(grade);
                    return (
                      <label key={grade} className={on ? "ws-grade is-on" : "ws-grade"}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(event) => {
                            const current = new Set(draft.studentGrades ?? []);
                            if (event.target.checked) {
                              current.add(grade);
                            } else {
                              current.delete(grade);
                            }
                            onMeta({
                              studentGrades: Array.from(current).sort((a, b) => a - b)
                            });
                          }}
                        />
                        {grade}학년
                      </label>
                    );
                  })}
                </div>
                <p className="ws-hint">
                  고른 학년이 학생용 설문의 첫 문항으로 들어가고, 결과를 학년별로 나눠 봅니다.
                </p>
              </div>

              <div className="ws-field">
                <span>작년 설문을 가져와 수정하기</span>
                <PriorSurveyImport key={draft.id} draftId={draft.id} onCommit={onImportPrior} />
              </div>

              <div className="ws-field">
                <span>문항 초기화</span>
                <button
                  type="button"
                  className="ws-btn ws-btn--danger"
                  disabled={itemCount === 0}
                  onClick={onResetItems}
                >
                  담은 문항 모두 비우기
                </button>
                <p className="ws-hint">
                  교원·학부모·학생·직원 문항을 한꺼번에 비웁니다. 다른 부장이 담은 것도 사라집니다.
                  설문 제목·안내문·결과는 그대로입니다.
                </p>
              </div>

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

          {tab === "invites" ? <InviteLinks /> : null}

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
