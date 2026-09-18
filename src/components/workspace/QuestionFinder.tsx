"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  needsChoices,
  type Audience,
  type QuestionBankItem,
  type ResponseType
} from "@/lib/types";
import type { TreeSelection } from "./IndicatorTree";
import { ResponseTypeEditor } from "./ResponseTypeEditor";

/**
 * 가운데 열 — 문항 찾기.
 *
 * 예전에는 검색이 아예 없어서 800개가 넘는 문항을 드롭다운으로만 뒤져야 했습니다.
 * 검색창에 자동으로 커서가 가 있으므로, 최단 경로는 "단어 입력 → 클릭 한 번"입니다.
 */

/** 공백으로 나눈 단어를 모두 포함해야 걸립니다(AND). */
function matches(haystack: string, terms: string[]): boolean {
  const lower = haystack.toLowerCase();
  return terms.every((term) => lower.includes(term));
}

/** 찾은 글자에 표시를 입힙니다. 어디가 걸렸는지 눈으로 확인할 수 있어야 합니다. */
function highlight(text: string, terms: string[]): ReactNode {
  if (terms.length === 0) {
    return text;
  }
  const escaped = terms
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter(Boolean);
  if (escaped.length === 0) {
    return text;
  }
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  return parts.map((part, index) =>
    escaped.some((term) => part.toLowerCase() === term.toLowerCase()) ? (
      <mark key={index}>{part}</mark>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

export function QuestionFinder({
  bank,
  selection,
  activeAudience,
  addedByAudience,
  onToggle,
  onAddCustom
}: {
  bank: QuestionBankItem[];
  selection: TreeSelection;
  activeAudience: Audience;
  /** 예시문항 id -> 이미 담아 둔 대상들 */
  addedByAudience: Map<string, Set<Audience>>;
  onToggle: (question: QuestionBankItem, audience: Audience) => void;
  onAddCustom: (text: string, responseType: ResponseType, choices?: string[]) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cursor, setCursor] = useState(0);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [customType, setCustomType] = useState<ResponseType>("likert_5");
  const [customChoices, setCustomChoices] = useState<string[] | undefined>(undefined);
  const [customError, setCustomError] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // 화면에 들어오면 바로 타이핑할 수 있게 커서를 둡니다.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), 150);
    return () => clearTimeout(timer);
  }, [keyword]);

  const terms = useMemo(
    () => debounced.toLowerCase().split(/\s+/).filter(Boolean),
    [debounced]
  );

  const results = useMemo(() => {
    return bank
      .filter((item) => !selection.area || item.area === selection.area)
      .filter((item) => !selection.subarea || item.subarea === selection.subarea)
      .filter((item) => !selection.indicator || item.indicator === selection.indicator)
      .filter(
        (item) =>
          terms.length === 0 ||
          matches(item.question, terms) ||
          matches(item.indicator, terms)
      );
  }, [bank, selection, terms]);

  useEffect(() => {
    setCursor(0);
  }, [debounced, selection]);

  /** 키보드만으로 고르고 담을 수 있게 합니다. 마우스 왕복을 없애는 것이 목적입니다. */
  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((current) => {
        const next = current + (event.key === "ArrowDown" ? 1 : -1);
        return Math.min(Math.max(next, 0), Math.max(results.length - 1, 0));
      });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const target = results[cursor];
      if (target) {
        onToggle(target, activeAudience);
      }
      return;
    }
    if (event.key === "Escape") {
      setKeyword("");
    }
  };

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>("[data-cursor='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const submitCustom = () => {
    const text = customText.trim();
    if (!text) {
      return;
    }
    // 보기가 필요한 유형인데 비어 있으면 담아 봐야 쓸 수 없는 문항이 됩니다.
    const filled = (customChoices ?? []).map((c) => c.trim()).filter(Boolean);
    if (needsChoices(customType) && filled.length < 2) {
      setCustomError("보기를 2개 이상 입력해 주세요.");
      return;
    }
    onAddCustom(text, customType, needsChoices(customType) ? filled : undefined);
    setCustomText("");
    setCustomType("likert_5");
    setCustomChoices(undefined);
    setCustomError("");
    setCustomOpen(false);
  };

  return (
    <div className="ws-col ws-finder">
      <div className="ws-search">
        <span className="ws-search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          ref={searchRef}
          className="ws-search-input"
          value={keyword}
          placeholder="문항 검색  (단어를 입력하세요)"
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={onSearchKeyDown}
          aria-label="문항 검색"
        />
        {keyword ? (
          <button
            type="button"
            className="ws-search-clear"
            aria-label="검색어 지우기"
            onClick={() => {
              setKeyword("");
              searchRef.current?.focus();
            }}
          >
            ✕
          </button>
        ) : null}
        <span className="ws-search-count">{results.length}</span>
      </div>

      <div className="ws-col-body" ref={listRef} aria-live="polite">
        {results.length === 0 ? (
          <div className="ws-empty">
            <p>{debounced ? `'${debounced}' 검색 결과가 없습니다.` : "문항이 없습니다."}</p>
            <button type="button" className="ws-btn ws-btn--soft" onClick={() => setCustomOpen(true)}>
              직접 문항 작성
            </button>
          </div>
        ) : (
          results.map((question, index) => {
            const takenBy = addedByAudience.get(question.id) ?? new Set<Audience>();
            const inActive = takenBy.has(activeAudience);
            return (
              <div
                key={question.id}
                data-cursor={index === cursor}
                className={
                  index === cursor
                    ? "ws-card ws-card--cursor"
                    : inActive
                      ? "ws-card ws-card--added"
                      : "ws-card"
                }
              >
                <div className="ws-card-meta">{highlight(question.indicator, terms)}</div>
                <button
                  type="button"
                  className="ws-card-body"
                  onClick={() => onToggle(question, activeAudience)}
                  aria-label={inActive ? "지금 대상에서 빼기" : "지금 대상에 담기"}
                >
                  {highlight(question.question, terms)}
                </button>

                {/*
                  가이드북 40쪽의 "평가 주체별 평가지표 구성" 표를 카드 안으로 가져온 것입니다.
                  대상마다 문서를 따로 만들므로 순서와 문장을 각각 다듬을 수 있습니다.
                */}
                <div className="ws-aud-chips" role="group" aria-label="평가 주체">
                  {AUDIENCES.map((audience) => (
                    <button
                      key={audience}
                      type="button"
                      className={
                        takenBy.has(audience)
                          ? audience === activeAudience
                            ? "ws-aud-chip is-on is-current"
                            : "ws-aud-chip is-on"
                          : audience === activeAudience
                            ? "ws-aud-chip is-current"
                            : "ws-aud-chip"
                      }
                      aria-pressed={takenBy.has(audience)}
                      onClick={() => onToggle(question, audience)}
                    >
                      {AUDIENCE_LABELS[audience].replace("용", "")}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="ws-col-foot">
        {customOpen ? (
          <div className="ws-custom">
            <textarea
              className="ws-textarea"
              rows={3}
              autoFocus
              value={customText}
              placeholder="문항 내용을 입력하세요"
              onChange={(event) => setCustomText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setCustomOpen(false);
                }
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  submitCustom();
                }
              }}
            />

            {/* 담기 전에 유형을 정합니다. 담고 나서 찾아 들어가지 않아도 되게 합니다. */}
            <ResponseTypeEditor
              responseType={customType}
              choices={customChoices}
              onChange={(patch) => {
                if (patch.responseType !== undefined) {
                  setCustomType(patch.responseType);
                }
                if ("choices" in patch) {
                  setCustomChoices(patch.choices);
                }
                setCustomError("");
              }}
            />

            {customError ? <p className="ws-custom-error">{customError}</p> : null}

            <div className="ws-custom-actions">
              <button type="button" className="ws-btn ws-btn--primary" onClick={submitCustom}>
                담기
              </button>
              <button
                type="button"
                className="ws-btn ws-btn--ghost"
                onClick={() => setCustomOpen(false)}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="ws-btn ws-btn--soft" onClick={() => setCustomOpen(true)}>
            ＋ 직접 문항 작성
          </button>
        )}
      </div>
    </div>
  );
}
