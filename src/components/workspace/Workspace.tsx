"use client";

import { useEffect, useMemo, useState } from "react";
import { ConflictDialog, DisplayNamePrompt, PresenceBadge, SaveStateBadge } from "@/components/ui";
import { ResultsAnalysis } from "@/components/results/ResultsAnalysis";
import { useDraftWorkspace } from "@/hooks/useDraftWorkspace";
import { countByAudience, itemsForAudience } from "@/lib/draftItems";
import { confirmCoverageGaps, placementFromSubarea } from "@/lib/evaluationFramework";
import { questionBank } from "@/lib/questionBank";
import {
  AUDIENCES,
  AUDIENCE_SHORT_LABELS,
  SURVEY_MODE_LABELS,
  type Audience,
  type ResponseType,
  type PublicSchool,
  type QuestionBankItem,
  type BuilderInviteSummary,
  type SelectedQuestion,
  type WorkspaceRole
} from "@/lib/types";
import { BuilderIntro, LeadIntro } from "./BuilderIntro";
import { EMPTY_SELECTION, IndicatorTree, type TreeSelection } from "./IndicatorTree";
import { QuestionFinder } from "./QuestionFinder";
import { SelectedPanel } from "./SelectedPanel";
import { AnnualStart } from "./AnnualStart";
import type { PriorSurveyCommit } from "./PriorSurveyImport";
import { GuideModal } from "./GuideModal";
import { SettingsModal, type SettingsTab } from "./SettingsModal";

/**
 * 문항 구성 작업 화면.
 *
 * 24인치 모니터 한 화면에 전부 들어가야 하므로 페이지 자체는 절대 스크롤하지 않고,
 * 안쪽 세 열만 각각 스크롤합니다. 높이를 픽셀로 고정하지 않는 것이 핵심입니다.
 */
export function Workspace({
  temporaryStorage = false,
  school,
  role = "lead",
  builderLabel,
  builderOwnerId,
  builderAudience,
  onLogout
}: {
  temporaryStorage?: boolean;
  school: PublicSchool;
  role?: WorkspaceRole;
  builderLabel?: string;
  builderOwnerId?: string;
  builderAudience?: Audience;
  onLogout: () => void;
}) {
  const isBuilder = role === "builder";
  const workspace = useDraftWorkspace(true);
  const draft = workspace.draft;

  const [activeAudience, setActiveAudience] = useState<Audience>(builderAudience ?? "teacher");
  const [activeScreen, setActiveScreen] = useState<"build" | "analyze" | "annual-start">("build");
  const [showExamplesOverride, setShowExamplesOverride] = useState<boolean | null>(null);
  const hasPriorItems = workspace.items.some(item => item.sourceQuestionId.startsWith("prior-"));
  const showExamples = showExamplesOverride ?? !hasPriorItems;
  const [selection, setSelection] = useState<TreeSelection>(EMPTY_SELECTION);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [namePromptDone, setNamePromptDone] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [leadIntroOpen, setLeadIntroOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("survey");
  const [invites, setInvites] = useState<BuilderInviteSummary[]>([]);
  const [submission, setSubmission] = useState<{ submittedAt: string | null; itemCount: number } | null>(null);
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

  useEffect(() => {
    if (isBuilder && builderLabel) {
      workspace.setDisplayName(builderLabel);
      setNamePromptDone(true);
    }
    if (isBuilder && builderAudience) {
      setActiveAudience(builderAudience);
    }
  }, [isBuilder, builderLabel, builderAudience, workspace.setDisplayName]);

  const introKey = draft ? `builder-intro:${draft.id}:${builderLabel ?? ""}` : "";
  useEffect(() => {
    if (!isBuilder || !introKey) {
      return;
    }
    try {
      setIntroOpen(!localStorage.getItem(introKey));
    } catch {
      setIntroOpen(true);
    }
  }, [isBuilder, introKey]);

  const closeIntro = () => {
    setIntroOpen(false);
    try {
      localStorage.setItem(introKey, "1");
    } catch {
      // 저장에 실패하면 다음에 한 번 더 보일 뿐입니다.
    }
  };

  const leadIntroKey = draft ? `lead-intro:${draft.id}` : "";
  useEffect(() => {
    if (!draft) return;
    try { setNamePromptDone(sessionStorage.getItem(`anonymous:${draft.id}`) === "1"); } catch { /* 선택적 편의 기능 */ }
  }, [draft?.id]);
  const needsName = Boolean(draft) && !workspace.displayName && !namePromptDone;
  useEffect(() => {
    if (isBuilder || !leadIntroKey || needsName) {
      return;
    }
    try {
      setLeadIntroOpen(!localStorage.getItem(leadIntroKey));
    } catch {
      setLeadIntroOpen(false);
    }
  }, [isBuilder, leadIntroKey, needsName]);

  const closeLeadIntro = () => {
    setLeadIntroOpen(false);
    try {
      localStorage.setItem(leadIntroKey, "1");
    } catch {
      // 저장에 실패하면 다음에 한 번 더 보일 뿐입니다.
    }
  };

  /** 연구부장은 부장들의 제출 현황을, 부장은 자기 제출 상태를 주기적으로 받아 옵니다. */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        if (isBuilder) {
          const response = await fetch("/api/invite/submit");
          const payload = await response.json();
          if (alive && payload.ok) {
            setSubmission(payload.data);
          }
        } else {
          const response = await fetch("/api/invite");
          const payload = await response.json();
          if (alive && payload.ok) {
            setInvites(payload.data.invites);
          }
        }
      } catch {
        // 현황을 못 받아도 작업에는 지장이 없습니다.
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isBuilder]);

  const openSettings = (tab: SettingsTab = "survey") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const myItemCount = workspace.items.filter((item) => item.ownerId === builderOwnerId).length;

  const submitWork = async () => {
    if (myItemCount === 0) {
      setNotice("아직 담은 문항이 없습니다. 문항을 담은 뒤 제출하세요.");
      return;
    }
    if (workspace.saveState.kind !== "idle") {
      setNotice("저장이 끝난 뒤에 제출하세요.");
      return;
    }
    try {
      const response = await fetch("/api/invite/submit", { method: "POST" });
      const payload = await response.json();
      if (payload.ok) {
        setSubmission({ itemCount: myItemCount, submittedAt: payload.data.submittedAt });
        setNotice("제출했습니다. 연구부장 화면에 표시됩니다. 고치면 다시 작성 중이 됩니다.");
      } else {
        setNotice(payload.error ?? "제출하지 못했습니다.");
      }
    } catch {
      setNotice("제출하지 못했습니다. 연결을 확인하세요.");
    }
  };

  useEffect(() => {
    if (isBuilder || !draft || (draft.mode !== "annual" && workspace.items.length > 0)) {
      return;
    }
    try {
      if (sessionStorage.getItem(`annual-start:${draft.id}`)) {
        return;
      }
    } catch {
      // 시크릿 모드 등에서 sessionStorage가 막혀도 시작 화면은 한 번 보여 줍니다.
    }
    setActiveScreen("annual-start");
  }, [draft?.id, draft?.mode]);

  const dismissAnnualStart = (next: "build" | "analyze") => {
    if (draft) {
      try {
        sessionStorage.setItem(`annual-start:${draft.id}`, "1");
      } catch {
        // 저장에 실패해도 화면은 바꿉니다.
      }
    }
    setActiveScreen(next);
  };

  const openAnnualStart = () => {
    if (draft) {
      try {
        sessionStorage.removeItem(`annual-start:${draft.id}`);
      } catch {
        // 지워지지 않아도 시작 화면은 엽니다.
      }
    }
    setActiveScreen("annual-start");
    setSettingsOpen(false);
  };

  /** 대상 전환은 Alt+오른쪽 화살표로도 가능합니다. Tab은 기본 초점 이동을 유지합니다. 마우스 왕복을 줄이기 위함입니다. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      // 대상이 정해진 링크는 탭이 하나뿐이라 Tab을 그대로 둡니다.
      if (event.key === "ArrowRight" && event.altKey && !typing && !builderAudience) {
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
  }, [builderAudience]);

  const selectedItems = useMemo(
    () => itemsForAudience(workspace.items, activeAudience),
    [activeAudience, workspace.items]
  );

  const counts = useMemo(() => countByAudience(workspace.items), [workspace.items]);

  /** 예시문항 하나가 어느 대상에 담겨 있는지. 카드의 주체 칩이 이 값을 씁니다. */
  const addedByAudience = useMemo(() => {
    const map = new Map<string, Set<Audience>>();
    for (const item of workspace.items) {
      const set = map.get(item.sourceQuestionId) ?? new Set<Audience>();
      set.add(item.audience);
      map.set(item.sourceQuestionId, set);
    }
    return map;
  }, [workspace.items]);

  /**
   * 대상 칩을 누르면 그 대상에 담거나 뺍니다.
   *
   * 여러 대상에 담으면 **문서가 대상별로 복제**됩니다. 가이드북 41쪽이 같은 지표라도
   * 대상에 맞는 용어로 다르게 서술하라고 하므로, 하나로 묶으면 문장을 따로 다듬을 수 없습니다.
   * 대신 `groupId`로 묶어 두어 서식3-2의 평가주체 열을 만들 때 모읍니다.
   */
  const toggleQuestion = (question: QuestionBankItem, audience: Audience) => {
    if (question.audience !== audience || (builderAudience && builderAudience !== audience)) return;
    const existing = workspace.items.find(
      (item) => item.sourceQuestionId === question.id && item.audience === audience
    );

    if (existing) {
      if (isBuilder && existing.ownerId !== builderOwnerId) {
        setNotice("다른 사람이 담은 문항이라 뺄 수 없습니다. 연구부장에게 요청하세요.");
        return;
      }
      workspace.removeItem(existing.id);
      setNotice(`${AUDIENCE_SHORT_LABELS[audience]}에서 뺐습니다.`);
      return;
    }

    workspace.addItems([
      {
        sourceQuestionId: question.id,
        groupId: question.id,
        audience,
        sourceRow: question.sourceRow,
        area: question.area,
        subarea: question.subarea,
        indicator: question.indicator,
        originalQuestion: question.question,
        editedQuestion: question.question,
        responseType: "likert_5"
      }
    ]);
    setNotice(`${AUDIENCE_SHORT_LABELS[audience]}에 담았습니다.`);
  };

  const addCustomQuestion = (
    text: string,
    responseType: ResponseType,
    choices: string[] | undefined,
    placement: { area: string; subarea: string; indicator: string }
  ) => {
    const legal = placementFromSubarea(placement.subarea);
    if (!legal) {
      setNotice("2026 세부영역을 먼저 고르세요.");
      return;
    }
    const id = `custom-${crypto.randomUUID()}`;
    workspace.addItems([
      {
        sourceQuestionId: id,
        groupId: id,
        audience: activeAudience,
        sourceRow: 0,
        area: legal.area,
        subarea: legal.subarea,
        indicator: placement.indicator.trim() || "학교 자체 문항",
        originalQuestion: text,
        editedQuestion: text,
        responseType,
        choices
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
      `${AUDIENCE_SHORT_LABELS[activeAudience]} 문항 ${targets.length}개를 모두 비울까요?`
    );
    if (!confirmed) {
      return;
    }
    for (const item of targets) {
      workspace.removeItem(item.id);
    }
  };

  const resetAllItems = () => {
    const live = workspace.items;
    if (live.length === 0) {
      setShowExamplesOverride(true);
      setSettingsOpen(false);
      dismissAnnualStart("build");
      return;
    }
    const confirmed = window.confirm(
      `담아 둔 문항 ${live.length}개를 모두 비울까요?\n다른 부장이 담은 문항도 사라집니다.`
    );
    if (!confirmed) {
      return;
    }
    for (const item of live) {
      workspace.removeItem(item.id);
    }
    setShowExamplesOverride(true);
    setNotice("문항을 모두 비웠습니다.");
    setSettingsOpen(false);
    dismissAnnualStart("build");
  };

  const importPriorItems = (rows: PriorSurveyCommit[]) => {
    if (rows.length === 0) {
      return;
    }
    workspace.addItems(
      rows.map((row) => {
        const id = `prior-${crypto.randomUUID()}`;
        return {
          sourceQuestionId: id,
          groupId: id,
          audience: row.audience,
          sourceRow: 0,
          area: row.area,
          subarea: row.subarea,
          indicator: row.indicator,
          originalQuestion: row.question,
          editedQuestion: row.question,
          responseType: row.responseType,
          choices: row.choices
        };
      })
    );
    setShowExamplesOverride(false);
    setActiveAudience(rows[0].audience);
    setNotice(`${rows.length}개를 담았습니다. 수정할 문항의 ‘수정’을 누르세요.`);
    setSettingsOpen(false);
    dismissAnnualStart("build");
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
    <div className={activeScreen === "build" ? "ws-root" : "ws-root ws-root--analyze"}>
      <header className="ws-topbar">
        <div className="ws-topbar-left">
          <span className="ws-school">{draft.schoolName || school.schoolName}</span>
          {temporaryStorage ? <span className="ws-badge" title="서버를 다시 시작하면 자료가 사라질 수 있습니다. 실제 학교 자료는 운영 환경에서 입력하세요.">체험 · 임시 저장</span> : null}
          {isBuilder ? (
            <span className="ws-mode ws-mode--static">{builderLabel || "문항 작업"}</span>
          ) : (
            <button
              type="button"
              className={draft.mode === "annual" ? "ws-mode is-annual" : "ws-mode"}
              title={
                draft.mode === "annual"
                  ? "선택 화면으로 돌아갑니다."
                  : "중간평가 / 학년말 학교평가를 바꿉니다."
              }
              onClick={() => {
                if (draft.mode === "annual") {
                  openAnnualStart();
                  return;
                }
                openSettings("survey");
              }}
            >
              {SURVEY_MODE_LABELS[draft.mode]}
            </button>
          )}
        </div>

        <div className="ws-topbar-center">
          {isBuilder ? (
            <span className="ws-screen-tab is-active">문항 구성</span>
          ) : (
            <div className="ws-screen-tabs" role="tablist" aria-label="화면 전환">
              <button
                type="button"
                className={activeScreen === "build" ? "ws-screen-tab is-active" : "ws-screen-tab"}
                role="tab"
                aria-selected={activeScreen === "build"}
                onClick={() => dismissAnnualStart("build")}
              >
                문항 구성
              </button>
              <button
                type="button"
                className={activeScreen === "analyze" ? "ws-screen-tab is-active" : "ws-screen-tab"}
                role="tab"
                aria-selected={activeScreen === "analyze"}
                onClick={() => dismissAnnualStart("analyze")}
              >
                결과 분석 · 내보내기
              </button>
            </div>
          )}
        </div>

        <div className="ws-topbar-right">
          <SaveStateBadge state={workspace.saveState} onRetry={workspace.retryNow} />
          {workspace.rejectedCount > 0 && <button type="button" className="ws-btn ws-btn--ghost" onClick={() => void workspace.discardRejected()}>거절된 수정 취소</button>}
          {workspace.pendingCount > 0 && <button type="button" className="ws-btn ws-btn--soft" onClick={workspace.exportPending}>미저장 내용 보관</button>}
          <PresenceBadge presence={workspace.presence} />
          {isBuilder ? (
            <button
              type="button"
              className={submission?.submittedAt ? "ws-btn ws-btn--soft" : "ws-btn ws-btn--primary"}
              onClick={() => void submitWork()}
              title="다 담았으면 눌러 연구부장에게 알립니다. 이후에 고치면 다시 작성 중이 됩니다."
            >
              {submission?.submittedAt ? `제출함 (${myItemCount}문항)` : "제출"}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="ws-btn ws-btn--soft"
                onClick={() => openSettings("invites")}
                title="부장에게 보낼 링크를 만들고, 제출 현황을 봅니다."
              >
                {invites.length > 0
                  ? `부장 작업 ${invites.filter((invite) => invite.submittedAt).length}/${invites.length}`
                  : "부장 링크"}
              </button>
              <button
                type="button"
                className="ws-btn ws-btn--ghost"
                onClick={() => {
                  if (ensureSynced() && confirmCoverageGaps(workspace.items)) {
                    window.location.href = "/api/export/docx";
                  }
                }}
              >
                설문지 (DOCX)
              </button>
              <button
                type="button"
                className="ws-btn ws-btn--primary"
                onClick={() => {
                  if (ensureSynced() && confirmCoverageGaps(workspace.items)) {
                    window.location.href = "/api/google/start";
                  }
                }}
              >
                Google Forms
              </button>
            </>
          )}
          <button
            type="button"
            className="ws-btn ws-btn--ghost"
            onClick={() => setGuideOpen(true)}
          >
            도움말
          </button>
          {isBuilder ? null : (
            <button
              type="button"
              className="ws-icon-btn"
              aria-label="설문 설정"
              onClick={() => openSettings("survey")}
            >
              ⚙
            </button>
          )}
          <button type="button" className="ws-icon-btn" aria-label="로그아웃" onClick={onLogout}>
            ⤺
          </button>
        </div>
      </header>

      {activeScreen === "build" ? (
        <nav className="ws-audience-tabs" aria-label="평가 주체 선택">
          {(builderAudience ? [builderAudience] : AUDIENCES).map((audience) => (
            <button
              key={audience}
              type="button"
              className={activeAudience === audience ? "ws-audience-tab is-active" : "ws-audience-tab"}
              onClick={() => setActiveAudience(audience)}
            >
              {AUDIENCE_SHORT_LABELS[audience]}
              <span className="ws-count">{counts[audience]}</span>
            </button>
          ))}
          {notice ? <span className="ws-notice">{notice}</span> : null}
          {!isBuilder && workspace.items.length > 0 ? (
            <button type="button" className="ws-link ws-link--danger ws-audience-reset" onClick={resetAllItems}>
              초기화
            </button>
          ) : null}
        </nav>
      ) : null}

      {activeScreen === "build" ? (
        <main className={showExamples ? "ws-grid" : "ws-grid ws-grid--edit"}>
          {showExamples && <><IndicatorTree bank={questionBank.filter((item) => item.audience === activeAudience)} selection={selection} onSelect={setSelection} />
          <QuestionFinder
            bank={questionBank.filter((item) => item.audience === activeAudience)}
            selection={selection}
            activeAudience={activeAudience}
            addedByAudience={addedByAudience}
            onToggle={toggleQuestion}
            onAddCustom={addCustomQuestion}
          />
          </>}
          <SelectedPanel
            assignmentInvites={isBuilder ? undefined : invites}
            onAssign={isBuilder ? undefined : workspace.assignItems}
            showExamples={showExamples}
            onToggleExamples={() => setShowExamplesOverride(!showExamples)}
            audience={activeAudience}
            items={selectedItems}
            presence={workspace.presence}
            onPatch={(id, patch) => workspace.patchItem(id, patch as Partial<SelectedQuestion>)}
            onRemove={workspace.removeItem}
            onMove={workspace.moveItem}
            onReset={isBuilder ? undefined : resetAudience}
            onEditingChange={workspace.setEditingItemId}
            canModify={isBuilder ? (item) => item.ownerId === builderOwnerId : undefined}
            ownerTag={(item) => item.ownerLabel ?? (isBuilder ? "연구부장" : null)}
          />
        </main>
      ) : activeScreen === "annual-start" ? (
        <main className="ra-main">
          <AnnualStart
            itemCount={workspace.items.length}
            onReviewItems={() => dismissAnnualStart("build")}
            onStartFresh={resetAllItems}
            onImportPrior={importPriorItems}
          />
        </main>
      ) : null}
      {!isBuilder ? <main className="ra-main" hidden={activeScreen !== "analyze"}>
        <ResultsAnalysis draft={draft} items={workspace.items} />
      </main> : null}

      {guideOpen ? (
        <GuideModal variant={isBuilder ? "builder" : "lead"} onClose={() => setGuideOpen(false)} />
      ) : null}

      {settingsOpen && !isBuilder ? (
        <SettingsModal
          initialTab={settingsTab}
          draft={draft}
          displayName={workspace.displayName}
          googleForms={draft.googleFormsByAudience ?? {}}
          onClose={() => setSettingsOpen(false)}
          onMeta={workspace.setMeta}
          onDisplayName={workspace.setDisplayName}
          onSwitchedToAnnual={openAnnualStart}
          itemCount={workspace.items.length}
          onResetItems={resetAllItems}
          onImportPrior={importPriorItems}
        />
      ) : null}

      {isBuilder && introOpen ? (
        <BuilderIntro
          schoolName={draft.schoolName || school.schoolName}
          label={builderLabel || "일반 부장"}
          audienceLabel={builderAudience ? AUDIENCE_SHORT_LABELS[builderAudience] : undefined}
          onStart={closeIntro}
          onGuide={() => {
            closeIntro();
            setGuideOpen(true);
          }}
        />
      ) : null}

      {!isBuilder && leadIntroOpen ? (
        <LeadIntro
          onStart={closeLeadIntro}
          onGuide={() => {
            closeLeadIntro();
            setGuideOpen(true);
          }}
        />
      ) : null}

      {needsDisplayName ? (
        <DisplayNamePrompt
          suggestions={(draft.draftAuthors ?? []).map((row) => row.title).filter(Boolean)}
          onSubmit={(name) => {
            workspace.setDisplayName(name);
            setNamePromptDone(true);
          }}
          onSkip={() => {
            setNamePromptDone(true);
            try { if (draft) sessionStorage.setItem(`anonymous:${draft.id}`, "1"); } catch { /* 이 화면에서는 계속 진행 */ }
          }}
        />
      ) : null}

      {workspace.conflict ? (
        <ConflictDialog conflict={workspace.conflict} onResolve={workspace.resolveConflict} />
      ) : null}
    </div>
  );
}
