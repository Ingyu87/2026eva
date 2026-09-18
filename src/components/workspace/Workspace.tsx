"use client";

import { useEffect, useMemo, useState } from "react";
import { ConflictDialog, DisplayNamePrompt, PresenceBadge, SaveStateBadge } from "@/components/ui";
import { useDraftWorkspace } from "@/hooks/useDraftWorkspace";
import { countByAudience, itemsForAudience } from "@/lib/draftItems";
import { questionBank } from "@/lib/questionBank";
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  RESPONSE_TYPE_LABELS,
  type Audience,
  type PublicSchool,
  type QuestionBankItem,
  type SelectedQuestion
} from "@/lib/types";
import { EMPTY_SELECTION, IndicatorTree, type TreeSelection } from "./IndicatorTree";
import { QuestionFinder } from "./QuestionFinder";
import { SelectedPanel } from "./SelectedPanel";
import { SettingsModal } from "./SettingsModal";

/**
 * 문항 구성 작업 화면.
 *
 * 24인치 모니터 한 화면에 전부 들어가야 하므로 페이지 자체는 절대 스크롤하지 않고,
 * 안쪽 세 열만 각각 스크롤합니다. 높이를 픽셀로 고정하지 않는 것이 핵심입니다.
 */
export function Workspace({
  school,
  onLogout
}: {
  school: PublicSchool;
  onLogout: () => void;
}) {
  const workspace = useDraftWorkspace(true);
  const draft = workspace.draft;

  const [activeAudience, setActiveAudience] = useState<Audience>("teacher");
  const [selection, setSelection] = useState<TreeSelection>(EMPTY_SELECTION);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [namePromptDone, setNamePromptDone] = useState(false);
  const [notice, setNotice] = useState("");

  const syncAudience = workspace.setActiveAudience;
  useEffect(() => {
    syncAudience(activeAudience);
  }, [activeAudience, syncAudience]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  /** 대상 탭은 Tab 키로도 넘깁니다. 마우스 왕복을 줄이기 위함입니다. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "Tab" && !typing) {
        event.preventDefault();
        setActiveAudience((current) => {
          const index = AUDIENCES.indexOf(current);
          const next = event.shiftKey ? index - 1 : index + 1;
          return AUDIENCES[(next + AUDIENCES.length) % AUDIENCES.length];
        });
      }

      if (event.key === "/" && !typing) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".ws-search-input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const bankForAudience = useMemo(
    () => questionBank.filter((item) => item.audience === activeAudience),
    [activeAudience]
  );

  const selectedItems = useMemo(
    () => itemsForAudience(workspace.items, activeAudience),
    [activeAudience, workspace.items]
  );

  const counts = useMemo(() => countByAudience(workspace.items), [workspace.items]);

  const addedSourceIds = useMemo(
    () => new Set(selectedItems.map((item) => item.sourceQuestionId)),
    [selectedItems]
  );

  const addQuestion = (question: QuestionBankItem) => {
    workspace.addItems([
      {
        sourceQuestionId: question.id,
        audience: question.audience,
        sourceRow: question.sourceRow,
        area: question.area,
        subarea: question.subarea,
        indicator: question.indicator,
        originalQuestion: question.question,
        editedQuestion: question.question,
        responseType: "likert_5"
      }
    ]);
    setNotice("문항을 담았습니다.");
  };

  const addCustomQuestion = (text: string) => {
    workspace.addItems([
      {
        sourceQuestionId: `custom-${new Date().toISOString()}`,
        audience: activeAudience,
        sourceRow: 0,
        area: "직접입력",
        subarea: "직접입력",
        indicator: RESPONSE_TYPE_LABELS.likert_5,
        originalQuestion: text,
        editedQuestion: text,
        responseType: "likert_5"
      }
    ]);
    setNotice("문항을 추가했습니다.");
  };

  const resetAudience = () => {
    const targets = itemsForAudience(workspace.items, activeAudience);
    if (targets.length === 0) {
      return;
    }
    const confirmed = window.confirm(
      `${AUDIENCE_LABELS[activeAudience]} 문항 ${targets.length}개를 모두 비울까요?`
    );
    if (!confirmed) {
      return;
    }
    for (const item of targets) {
      workspace.removeItem(item.id);
    }
  };

  /** 아직 서버가 못 받은 편집이 있으면 내보내기가 옛 내용을 담게 되므로 막습니다. */
  const ensureSynced = (): boolean => {
    if (workspace.pendingCount > 0) {
      setNotice("저장되지 않은 편집이 있습니다. 잠시 후 다시 시도해 주세요.");
      workspace.retryNow();
      return false;
    }
    return true;
  };

  const needsDisplayName =
    Boolean(draft) && !workspace.displayName && !namePromptDone;

  if (!draft) {
    return (
      <div className="ws-loading" role="status">
        설문 초안을 불러오는 중…
      </div>
    );
  }

  return (
    <div className="ws-root">
      <header className="ws-topbar">
        <div className="ws-topbar-left">
          <span className="ws-school">{draft.schoolName || school.schoolName}</span>
        </div>

        <div className="ws-topbar-center">
          <div className="ws-screen-tabs" role="tablist" aria-label="화면 전환">
            <button type="button" className="ws-screen-tab is-active" role="tab" aria-selected>
              문항 구성
            </button>
            <button
              type="button"
              className="ws-screen-tab is-locked"
              role="tab"
              aria-selected={false}
              disabled
              title="결과 분석은 다음 단계에서 열립니다."
            >
              결과 분석
            </button>
            <button
              type="button"
              className="ws-screen-tab is-locked"
              role="tab"
              aria-selected={false}
              disabled
              title="제출 서류 생성은 다음 단계에서 열립니다."
            >
              내보내기
            </button>
          </div>
        </div>

        <div className="ws-topbar-right">
          <SaveStateBadge state={workspace.saveState} onRetry={workspace.retryNow} />
          <PresenceBadge presence={workspace.presence} />
          <button
            type="button"
            className="ws-btn ws-btn--ghost"
            onClick={() => {
              if (ensureSynced()) {
                window.location.href = "/api/export/docx";
              }
            }}
          >
            DOCX
          </button>
          <button
            type="button"
            className="ws-btn ws-btn--primary"
            onClick={() => {
              if (ensureSynced()) {
                window.location.href = "/api/google/start";
              }
            }}
          >
            Google Forms
          </button>
          <button
            type="button"
            className="ws-icon-btn"
            aria-label="설문 설정"
            onClick={() => setSettingsOpen(true)}
          >
            ⚙
          </button>
          <button type="button" className="ws-icon-btn" aria-label="로그아웃" onClick={onLogout}>
            ⤺
          </button>
        </div>
      </header>

      <nav className="ws-audience-tabs" aria-label="평가 주체 선택">
        {AUDIENCES.map((audience) => (
          <button
            key={audience}
            type="button"
            className={activeAudience === audience ? "ws-audience-tab is-active" : "ws-audience-tab"}
            onClick={() => setActiveAudience(audience)}
          >
            {AUDIENCE_LABELS[audience]}
            <span className="ws-count">{counts[audience]}</span>
          </button>
        ))}
        {notice ? <span className="ws-notice">{notice}</span> : null}
      </nav>

      <main className="ws-grid">
        <IndicatorTree bank={bankForAudience} selection={selection} onSelect={setSelection} />
        <QuestionFinder
          bank={bankForAudience}
          selection={selection}
          addedSourceIds={addedSourceIds}
          onAdd={addQuestion}
          onAddCustom={addCustomQuestion}
        />
        <SelectedPanel
          audience={activeAudience}
          items={selectedItems}
          presence={workspace.presence}
          onPatch={(id, patch) => workspace.patchItem(id, patch as Partial<SelectedQuestion>)}
          onRemove={workspace.removeItem}
          onMove={workspace.moveItem}
          onReset={resetAudience}
          onEditingChange={workspace.setEditingItemId}
        />
      </main>

      {settingsOpen ? (
        <SettingsModal
          draft={draft}
          displayName={workspace.displayName}
          googleForms={draft.googleFormsByAudience ?? {}}
          onClose={() => setSettingsOpen(false)}
          onMeta={workspace.setMeta}
          onDisplayName={workspace.setDisplayName}
        />
      ) : null}

      {needsDisplayName ? (
        <DisplayNamePrompt
          suggestions={(draft.draftAuthors ?? []).map((row) => row.title).filter(Boolean)}
          onSubmit={(name) => {
            workspace.setDisplayName(name);
            setNamePromptDone(true);
          }}
          onSkip={() => setNamePromptDone(true)}
        />
      ) : null}

      {workspace.conflict ? (
        <ConflictDialog conflict={workspace.conflict} onResolve={workspace.resolveConflict} />
      ) : null}
    </div>
  );
}
