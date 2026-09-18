"use client";

import { useState } from "react";
import {
  isCurrentSubarea,
  requiresAllAreas,
  SUBAREA_CHANGES_2025_TO_2026
} from "@/lib/evaluationFramework";
import {
  AUDIENCE_LABELS,
  type Audience,
  type Presence,
  type SelectedQuestion
} from "@/lib/types";
import { previewOptions, ResponseTypeEditor } from "./ResponseTypeEditor";

/**
 * 우측 열 — 지금 대상의 선택 문항.
 *
 * 화면에 보이는 번호는 순서대로 다시 센 값이며 저장하지 않습니다.
 * 저장되는 order는 분수라서 순서를 바꿔도 자기 문서 하나만 고쳐집니다.
 */

/** 학생·학부모·교원은 Ⅰ·Ⅱ·Ⅲ 전 영역에 문항이 있어야 합니다(가이드북 Q9). 직원은 예외입니다. */
const REQUIRED_AREAS = ["Ⅰ", "Ⅱ", "Ⅲ"];

/**
 * 2025 자료로 담아 둔 문항을 찾아 안내 문구를 만듭니다.
 *
 * 자동으로 옮기지 않습니다. Ⅲ-2와 Ⅲ-3이 하나로 합쳐졌기 때문에 기계가 고르면
 * 엉뚱한 세부영역에 들어갑니다. 사람이 다시 고르게 하는 것이 안전합니다.
 */
function legacyNoticeFor(subarea: string): string | null {
  if (isCurrentSubarea(subarea) || subarea === "직접입력") {
    return null;
  }
  const change = SUBAREA_CHANGES_2025_TO_2026.find((entry) => entry.from === subarea);
  if (!change) {
    return "2026 세부영역 체계에 없는 값입니다. 문항을 다시 담아 주세요.";
  }
  return change.note
    ? `2025 분류입니다. ${change.to}로 바뀌었습니다. ${change.note}`
    : `2025 분류입니다. ${change.to}로 다시 담아 주세요.`;
}

function coverage(items: SelectedQuestion[]): Record<string, boolean> {
  return REQUIRED_AREAS.reduce<Record<string, boolean>>((acc, roman) => {
    acc[roman] = items.some((item) => item.area.startsWith(roman));
    return acc;
  }, {});
}

export function SelectedPanel({
  audience,
  items,
  presence,
  onPatch,
  onRemove,
  onMove,
  onReset,
  onEditingChange
}: {
  audience: Audience;
  items: SelectedQuestion[];
  presence: Presence[];
  onPatch: (id: string, patch: Partial<SelectedQuestion>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onReset: () => void;
  onEditingChange: (id: string | undefined) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEdit = (id: string) => {
    setEditingId(id);
    onEditingChange(id);
  };

  const stopEdit = () => {
    setEditingId(null);
    onEditingChange(undefined);
  };

  const covered = coverage(items);
  const missing = REQUIRED_AREAS.filter((roman) => !covered[roman]);
  const showWarning = requiresAllAreas(audience) && missing.length > 0;
  const legacyCount = items.filter((item) => legacyNoticeFor(item.subarea)).length;

  /** 다른 사람이 지금 보고 있는 문항을 표시합니다. */
  const editorOf = (itemId: string): string | null => {
    const found = presence.find((entry) => entry.editingItemId === itemId);
    if (!found) {
      return null;
    }
    return found.displayName || "다른 사용자";
  };

  return (
    <div className="ws-col ws-selected">
      <div className="ws-col-head">
        <h2>
          {AUDIENCE_LABELS[audience]}
          <span className="ws-count">{items.length}</span>
        </h2>
        {items.length > 0 ? (
          <button type="button" className="ws-link ws-link--danger" onClick={onReset}>
            모두 비우기
          </button>
        ) : null}
      </div>

      <div className="ws-col-body">
        {items.length === 0 ? (
          <div className="ws-empty">
            <p>담은 문항이 없습니다.</p>
            <p className="ws-hint">가운데에서 문항을 클릭하면 여기에 담깁니다.</p>
          </div>
        ) : (
          items.map((item, index) => {
            const editor = editorOf(item.id);
            const editing = editingId === item.id;
            const legacy = legacyNoticeFor(item.subarea);
            return (
              <div
                key={item.id}
                className={
                  [editing ? "is-editing" : "", legacy ? "is-legacy" : ""]
                    .filter(Boolean)
                    .reduce((acc, cls) => `${acc} ${cls}`, "ws-item")
                }
              >
                <div className="ws-item-head">
                  <span className="ws-item-no">{index + 1}</span>
                  <span className="ws-item-meta">{item.indicator}</span>
                  {editor ? <span className="ws-item-editor">{editor} 편집 중</span> : null}
                  <div className="ws-item-actions">
                    <button
                      type="button"
                      aria-label="위로"
                      disabled={index === 0}
                      onClick={() => onMove(item.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="아래로"
                      disabled={index === items.length - 1}
                      onClick={() => onMove(item.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={editing ? "편집 끝내기" : "수정"}
                      onClick={() => (editing ? stopEdit() : startEdit(item.id))}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      aria-label="삭제"
                      className="ws-item-delete"
                      onClick={() => onRemove(item.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {legacy ? <p className="ws-item-legacy">{legacy}</p> : null}

                {editing ? (
                  /*
                   * 예전에는 textarea에 onBlur로 편집을 닫았습니다. 그래서 유형 드롭다운을
                   * 누르는 순간 편집 영역이 사라져 5점 척도 말고는 고를 수가 없었습니다.
                   * 이제는 '완료'를 누르거나 Esc를 눌러야 닫힙니다.
                   */
                  <div
                    className="ws-item-edit"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        stopEdit();
                      }
                    }}
                  >
                    <textarea
                      className="ws-textarea"
                      rows={3}
                      autoFocus
                      value={item.editedQuestion}
                      onChange={(event) =>
                        onPatch(item.id, { editedQuestion: event.target.value })
                      }
                    />

                    <ResponseTypeEditor
                      responseType={item.responseType}
                      choices={item.choices}
                      onChange={(patch) => onPatch(item.id, patch)}
                    />

                    {/* 평가지표별 담당부서 지정 — 기본계획 Ⅴ-3-나-3, 서식1 */}
                    <input
                      className="ws-input"
                      value={item.department ?? ""}
                      placeholder="담당부서 (선택)"
                      onChange={(event) => onPatch(item.id, { department: event.target.value })}
                    />

                    <button type="button" className="ws-btn ws-btn--primary" onClick={stopEdit}>
                      완료
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="ws-item-text">{item.editedQuestion}</p>
                    <p className="ws-item-scale">
                      {previewOptions(item.responseType, item.choices)}
                    </p>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="ws-col-foot">
        <div className={showWarning ? "ws-coverage has-warning" : "ws-coverage"}>
          <div className="ws-coverage-row">
            {REQUIRED_AREAS.map((roman) => (
              <span
                key={roman}
                className={covered[roman] ? "ws-coverage-dot is-on" : "ws-coverage-dot"}
              >
                {roman}
              </span>
            ))}
            <span className="ws-coverage-label">영역 커버리지</span>
          </div>
          {showWarning ? (
            <p className="ws-coverage-warn">
              {missing.join("·")}영역 문항이 없습니다. 학생·학부모·교원은 전 영역을 평가해야 합니다.
            </p>
          ) : null}
          {legacyCount > 0 ? (
            <p className="ws-coverage-warn">
              2025 분류 문항 {legacyCount}개가 있습니다. 2026 체계로 다시 담아 주세요.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
