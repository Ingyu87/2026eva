"use client";

import {
  countsTowardAreaMean,
  defaultChoices,
  LIKERT_3_OPTIONS,
  LIKERT_5_OPTIONS,
  needsChoices,
  RESPONSE_TYPES,
  RESPONSE_TYPE_LABELS,
  YES_NO_OPTIONS,
  type ResponseType
} from "@/lib/types";

/**
 * 응답 유형과 보기 목록을 고르는 부분.
 *
 * 문항을 담은 뒤 수정할 때와 직접 작성할 때 똑같이 씁니다.
 * 두 곳에 따로 두면 한쪽만 고쳐져 어긋납니다.
 */

/** 유형별로 응답자가 보게 될 보기. 고정 유형은 문구가 정해져 있습니다. */
export function previewOptions(type: ResponseType, choices?: string[]): string {
  if (type === "likert_5") return LIKERT_5_OPTIONS.join(" · ");
  if (type === "likert_3") return LIKERT_3_OPTIONS.join(" · ");
  if (type === "yes_no") return YES_NO_OPTIONS.join(" · ");
  if (type === "text") return "서술형 답변";
  const filled = (choices ?? []).map((c) => c.trim()).filter(Boolean);
  return filled.length > 0 ? filled.join(" · ") : "보기를 입력하세요";
}

export function ResponseTypeEditor({
  responseType,
  choices,
  onChange
}: {
  responseType: ResponseType;
  choices?: string[];
  onChange: (patch: { responseType?: ResponseType; choices?: string[] }) => void;
}) {
  const list = choices ?? [];

  const changeType = (next: ResponseType) => {
    // 보기가 필요한 유형으로 바꾸면 빈 칸을 미리 만들어 줍니다.
    // 반대로 고정 유형으로 가면 쓰지 않는 보기를 남겨 두지 않습니다.
    onChange({
      responseType: next,
      choices: needsChoices(next) ? (list.length > 0 ? list : defaultChoices(next)) : undefined
    });
  };

  const setChoice = (index: number, value: string) => {
    const next = [...list];
    next[index] = value;
    onChange({ choices: next });
  };

  return (
    <div className="ws-type-editor">
      <select
        className="ws-select"
        value={responseType}
        onChange={(event) => changeType(event.target.value as ResponseType)}
        aria-label="응답 유형"
      >
        {RESPONSE_TYPES.map((type) => (
          <option key={type} value={type}>
            {RESPONSE_TYPE_LABELS[type]}
          </option>
        ))}
      </select>

      {needsChoices(responseType) ? (
        <div className="ws-choices">
          {list.map((choice, index) => (
            <div key={index} className="ws-choice-row">
              <span className="ws-choice-mark" aria-hidden="true">
                {responseType === "checklist" ? "☐" : "○"}
              </span>
              <input
                className="ws-input"
                value={choice}
                placeholder={`보기 ${index + 1}`}
                onChange={(event) => setChoice(index, event.target.value)}
              />
              <button
                type="button"
                className="ws-icon-btn"
                aria-label="보기 삭제"
                disabled={list.length <= 2}
                onClick={() => onChange({ choices: list.filter((_, i) => i !== index) })}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="ws-btn ws-btn--soft"
            onClick={() => onChange({ choices: [...list, ""] })}
          >
            ＋ 보기 추가
          </button>
        </div>
      ) : (
        <p className="ws-type-preview">{previewOptions(responseType, choices)}</p>
      )}

      {!countsTowardAreaMean(responseType) ? (
        <p className="ws-type-note">
          이 유형은 영역 평균점수 계산에 들어가지 않습니다. 정량평가는 5점 척도로 구성하세요.
          (가이드북 p.9 · p.51)
        </p>
      ) : null}
    </div>
  );
}
