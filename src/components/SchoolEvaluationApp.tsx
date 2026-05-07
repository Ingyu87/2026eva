"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Caption,
  ColorBlockSection,
  Eyebrow,
  Footer,
  MarqueeStrip,
  Pill,
  Select,
  TextInput,
  Textarea,
  TopNav
} from "@/components/ui";
import { questionBank } from "@/lib/questionBank";
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  LIKERT_3_OPTIONS,
  LIKERT_5_OPTIONS,
  YES_NO_OPTIONS,
  type ApiResult,
  type Audience,
  type GoogleFormInfo,
  type PublicSchool,
  type QuestionBankItem,
  type SelectedQuestion,
  type SurveyDraft
} from "@/lib/types";

type Mode = "user" | "admin";
type AuthMode = "login" | "register";
type UserPanel = "builder" | "recommend";
type RecommendApiItem = {
  id: string;
  audience: Audience;
  indicator: string;
  question: string;
  area: string;
  subarea: string;
  score: number;
};
type RecommendByAudience = Partial<Record<Audience, RecommendApiItem[]>>;

const emptyFilters = {
  area: "",
  subarea: "",
  indicator: ""
};

async function fetchJson<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 25_000, ...rest } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(rest.headers ?? {})
      }
    });
    const payload = (await response.json()) as ApiResult<T>;
    if (!payload.ok) {
      throw new Error(payload.error);
    }
    return payload.data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "서버 응답이 너무 오래 걸렸습니다. 방화벽·VPN·회사망에서 Google(Firestore) 접속이 막히지 않았는지 확인해 주세요."
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function nowIso(): string {
  return new Date().toISOString();
}

async function parseApiJson<T>(response: Response): Promise<ApiResult<T>> {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as ApiResult<T>;
  } catch {
    if (raw.includes("<!DOCTYPE") || raw.includes("<html")) {
      return {
        ok: false,
        error: `서버 내부 오류가 발생했습니다. (HTTP ${response.status})`
      };
    }
    return {
      ok: false,
      error: raw || `요청 처리에 실패했습니다. (HTTP ${response.status})`
    };
  }
}

function normalizeOrder(items: SelectedQuestion[]): SelectedQuestion[] {
  return items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index + 1 }));
}

export function SchoolEvaluationApp() {
  const [mode, setMode] = useState<Mode>("user");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [schoolName, setSchoolName] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState<PublicSchool | null>(null);
  const [draft, setDraft] = useState<SurveyDraft | null>(null);
  const [activeAudience, setActiveAudience] = useState<Audience>("teacher");
  const [filters, setFilters] = useState(emptyFilters);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [schools, setSchools] = useState<PublicSchool[]>([]);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [userPanel, setUserPanel] = useState<UserPanel>("builder");
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendKeywords, setRecommendKeywords] = useState<string[]>([]);
  const [recommendedQuestions, setRecommendedQuestions] = useState<RecommendApiItem[]>([]);
  const [recommendSourceName, setRecommendSourceName] = useState("");
  const [recommendFile, setRecommendFile] = useState<File | null>(null);
  const [customQuestionText, setCustomQuestionText] = useState("");

  const showAuthForm = mode === "user" && !(school && draft);

  useEffect(() => {
    void loadSession();

    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    if (google === "success") {
      setStatus("대상별 Google Forms 생성이 완료되었습니다.");
      window.history.replaceState({}, "", "/");
    }
    if (google === "error") {
      setError(params.get("message") || "Google Forms 생성에 실패했습니다.");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    if (!dirty || !draft || !school) {
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      void saveDraft(draft, true);
    }, 700);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [dirty, draft, school]);

  const bankForAudience = useMemo(
    () => questionBank.filter((item) => item.audience === activeAudience),
    [activeAudience]
  );

  const areaOptions = useMemo(() => unique(bankForAudience.map((item) => item.area)), [bankForAudience]);
  const subareaOptions = useMemo(
    () =>
      unique(
        bankForAudience
          .filter((item) => !filters.area || item.area === filters.area)
          .map((item) => item.subarea)
      ),
    [bankForAudience, filters.area]
  );
  const indicatorOptions = useMemo(
    () =>
      unique(
        bankForAudience
          .filter((item) => !filters.area || item.area === filters.area)
          .filter((item) => !filters.subarea || item.subarea === filters.subarea)
          .map((item) => item.indicator)
      ),
    [bankForAudience, filters.area, filters.subarea]
  );

  const filteredQuestions = useMemo(
    () =>
      bankForAudience
        .filter((item) => !filters.area || item.area === filters.area)
        .filter((item) => !filters.subarea || item.subarea === filters.subarea)
        .filter((item) => !filters.indicator || item.indicator === filters.indicator),
    [bankForAudience, filters]
  );

  const selectedItems = useMemo(
    () => normalizeOrder(draft?.itemsByAudience[activeAudience] ?? []),
    [activeAudience, draft]
  );

  async function loadSession() {
    try {
      const data = await fetchJson<{ school: PublicSchool | null; draft: SurveyDraft | null }>("/api/auth/me");
      if (data.school && data.draft) {
        setSchool(data.school);
        setDraft(data.draft);
        setSchoolName(data.school.schoolName);
        setDirty(false);
      }
    } catch {
      setSchool(null);
      setDraft(null);
    }
  }

  async function submitAuth() {
    setError("");
    setStatus("");
    setAuthSubmitting(true);
    const url = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    try {
      const data = await fetchJson<{ school: PublicSchool; draft: SurveyDraft }>(url, {
        method: "POST",
        body: JSON.stringify({ schoolName, password })
      });
      setSchool(data.school);
      setDraft(data.draft);
      setPassword("");
      setDirty(false);
      setStatus(authMode === "register" ? "학교 계정이 등록되었습니다." : "로그인되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSchool(null);
    setDraft(null);
    setDirty(false);
    setStatus("로그아웃되었습니다.");
  }

  function updateDraft(mutator: (draft: SurveyDraft) => SurveyDraft) {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const next = mutator(current);
      setDirty(true);
      return next;
    });
  }

  async function saveDraft(targetDraft = draft, silent = false) {
    if (!targetDraft) {
      return;
    }
    try {
      const data = await fetchJson<{ draft: SurveyDraft }>("/api/draft", {
        method: "PUT",
        body: JSON.stringify({ draft: targetDraft })
      });
      setDraft(data.draft);
      setDirty(false);
      if (!silent) {
        setStatus("초안이 저장되었습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "초안 저장에 실패했습니다.");
    }
  }

  function setMeta<K extends keyof Pick<SurveyDraft, "title" | "surveyDate" | "schoolName">>(
    key: K,
    value: SurveyDraft[K]
  ) {
    updateDraft((current) => ({ ...current, [key]: value }));
  }

  function setIntro(audience: Audience, value: string) {
    updateDraft((current) => ({
      ...current,
      introByAudience: {
        ...current.introByAudience,
        [audience]: value
      }
    }));
  }

  function createSelectedQuestionFromBank(
    question: QuestionBankItem,
    order: number
  ): SelectedQuestion {
    const timestamp = nowIso();
    return {
      id: crypto.randomUUID(),
      sourceQuestionId: question.id,
      audience: question.audience,
      sourceRow: question.sourceRow,
      area: question.area,
      subarea: question.subarea,
      indicator: question.indicator,
      originalQuestion: question.question,
      editedQuestion: question.question,
      responseType: "likert_5",
      order,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  function addQuestion(question: QuestionBankItem) {
    if (!draft) {
      return;
    }
    const currentItems = draft.itemsByAudience[question.audience] ?? [];
    if (currentItems.some((item) => item.sourceQuestionId === question.id)) {
      setError("이미 담긴 문항입니다.");
      return;
    }
    const item = createSelectedQuestionFromBank(question, currentItems.length + 1);

    updateDraft((current) => ({
      ...current,
      itemsByAudience: {
        ...current.itemsByAudience,
        [question.audience]: normalizeOrder([...currentItems, item])
      }
    }));
    setError("");
    setStatus("문항을 담았습니다.");
  }

  function addCustomDescriptiveQuestion() {
    if (!draft) {
      return;
    }
    const text = customQuestionText.trim();
    if (!text) {
      setError("서술형 문항 내용을 입력해 주세요.");
      return;
    }
    const currentItems = draft.itemsByAudience[activeAudience] ?? [];
    const timestamp = nowIso();
    const customItem: SelectedQuestion = {
      id: crypto.randomUUID(),
      sourceQuestionId: `custom-${timestamp}`,
      audience: activeAudience,
      sourceRow: 0,
      area: "직접입력",
      subarea: "직접입력",
      indicator: "서술형",
      originalQuestion: text,
      editedQuestion: text,
      responseType: "text",
      order: currentItems.length + 1,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    updateDraft((current) => ({
      ...current,
      itemsByAudience: {
        ...current.itemsByAudience,
        [activeAudience]: normalizeOrder([...currentItems, customItem])
      }
    }));
    setCustomQuestionText("");
    setError("");
    setStatus("서술형 문항을 추가했습니다.");
  }

  function updateSelectedItem(id: string, patch: Partial<SelectedQuestion>) {
    updateDraft((current) => {
      const items = current.itemsByAudience[activeAudience] ?? [];
      return {
        ...current,
        itemsByAudience: {
          ...current.itemsByAudience,
          [activeAudience]: normalizeOrder(
            items.map((item) =>
              item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item
            )
          )
        }
      };
    });
  }

  function removeSelectedItem(id: string) {
    updateDraft((current) => {
      const items = current.itemsByAudience[activeAudience] ?? [];
      return {
        ...current,
        itemsByAudience: {
          ...current.itemsByAudience,
          [activeAudience]: normalizeOrder(items.filter((item) => item.id !== id))
        }
      };
    });
  }

  function resetSelectedItemsForAudience(audience: Audience) {
    if (!draft) {
      return;
    }
    const count = draft.itemsByAudience[audience]?.length ?? 0;
    if (count === 0) {
      setStatus(`${AUDIENCE_LABELS[audience]} 문항은 이미 비어 있습니다.`);
      return;
    }
    if (!window.confirm(`${AUDIENCE_LABELS[audience]} 선택 문항 ${count}개를 모두 초기화할까요?`)) {
      return;
    }
    updateDraft((current) => ({
      ...current,
      itemsByAudience: {
        ...current.itemsByAudience,
        [audience]: []
      }
    }));
    setStatus(`${AUDIENCE_LABELS[audience]} 선택 문항을 초기화했습니다.`);
    setError("");
  }

  function moveSelectedItem(id: string, direction: -1 | 1) {
    const index = selectedItems.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedItems.length) {
      return;
    }
    const nextItems = selectedItems.slice();
    [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
    updateDraft((current) => ({
      ...current,
      itemsByAudience: {
        ...current.itemsByAudience,
        [activeAudience]: normalizeOrder(nextItems)
      }
    }));
  }

  async function exportDocx() {
    if (draft && dirty) {
      await saveDraft(draft, true);
    }
    window.location.href = "/api/export/docx";
  }

  async function startGoogleForms() {
    if (draft && dirty) {
      await saveDraft(draft, true);
    }
    window.location.href = "/api/google/start";
  }

  async function adminLogin() {
    setError("");
    try {
      await fetchJson<{ authenticated: boolean }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: adminPassword })
      });
      setAdminAuthed(true);
      setAdminPassword("");
      await loadSchools();
      setStatus("관리자 로그인되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "관리자 로그인에 실패했습니다.");
    }
  }

  async function loadSchools() {
    const data = await fetchJson<{ schools: PublicSchool[] }>("/api/admin/schools");
    setSchools(data.schools);
  }

  async function resetSchoolPassword(id: string) {
    const nextPassword = window.prompt("새 비밀번호를 입력하세요.");
    if (!nextPassword) {
      return;
    }
    await fetchJson<{ updated: boolean }>(`/api/admin/schools/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password: nextPassword })
    });
    setStatus("비밀번호를 초기화했습니다.");
    await loadSchools();
  }

  async function toggleSchoolStatus(item: PublicSchool) {
    await fetchJson<{ updated: boolean }>(`/api/admin/schools/${item.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: item.status === "active" ? "inactive" : "active" })
    });
    await loadSchools();
  }

  async function deleteSchoolAccount(id: string) {
    if (!window.confirm("학교 계정과 저장된 초안을 삭제할까요?")) {
      return;
    }
    await fetchJson<{ deleted: boolean }>(`/api/admin/schools/${id}`, {
      method: "DELETE"
    });
    await loadSchools();
  }

  function switchAudience(audience: Audience) {
    setActiveAudience(audience);
    setFilters(emptyFilters);
    setUserPanel("builder");
  }

  async function analyzePdfRecommendations(file: File) {
    if (!draft) {
      return;
    }
    setRecommendLoading(true);
    setError("");
    setStatus("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("audience", activeAudience);

      const response = await fetch("/api/recommend/pdf", {
        method: "POST",
        body: formData
      });
      const payload = await parseApiJson<{
        audience: Audience;
        recommendations: RecommendApiItem[];
        keywords: string[];
      }>(response);
      if (!payload.ok) {
        throw new Error(payload.error);
      }

      setRecommendedQuestions(payload.data.recommendations);
      setRecommendKeywords(payload.data.keywords);
      setRecommendSourceName(file.name);
      setUserPanel("recommend");
      setStatus(
        payload.data.recommendations.length > 0
          ? `${AUDIENCE_LABELS[activeAudience]} 추천 문항 ${payload.data.recommendations.length}개를 찾았습니다.`
          : `${AUDIENCE_LABELS[activeAudience]}에서 일치하는 추천 문항을 찾지 못했습니다.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF 추천 분석에 실패했습니다.");
    } finally {
      setRecommendLoading(false);
    }
  }

  async function autoFillFromPdf(file: File) {
    if (!draft) {
      return;
    }
    if (!window.confirm("PDF를 분석해 4개 대상 문항을 자동으로 채울까요? 기존 선택 문항은 대체됩니다.")) {
      return;
    }
    setRecommendLoading(true);
    setError("");
    setStatus("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "autofill");

      const response = await fetch("/api/recommend/pdf", {
        method: "POST",
        body: formData
      });
      const payload = await parseApiJson<{
        byAudience: RecommendByAudience;
        keywords: string[];
      }>(response);
      if (!payload.ok) {
        throw new Error(payload.error);
      }

      updateDraft((current) => {
        const nextByAudience: SurveyDraft["itemsByAudience"] = { ...current.itemsByAudience };
        for (const audience of AUDIENCES) {
          const recs = payload.data.byAudience[audience] ?? [];
          const selected = recs
            .map((rec, index) => {
              const source = questionBank.find((item) => item.id === rec.id && item.audience === audience);
              return source ? createSelectedQuestionFromBank(source, index + 1) : null;
            })
            .filter((item): item is SelectedQuestion => Boolean(item));
          nextByAudience[audience] = normalizeOrder(selected);
        }
        return {
          ...current,
          itemsByAudience: nextByAudience
        };
      });

      setRecommendKeywords(payload.data.keywords);
      setRecommendSourceName(file.name);
      setUserPanel("builder");
      setStatus("PDF 분석 결과를 기준으로 교원/학부모/학생/교직원 문항을 자동 채웠습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF 자동 채우기에 실패했습니다.");
    } finally {
      setRecommendLoading(false);
    }
  }

  const latestGoogleForms: Partial<Record<Audience, GoogleFormInfo>> =
    draft?.googleFormsByAudience ??
    (draft?.googleForm
      ? {
          teacher: draft.googleForm
        }
      : {});

  return (
    <div className="app-page">
      <TopNav
        brand={
          <div>
            <Caption>SCHOOL EVALUATION</Caption>
            <p className="brand-title typ-body-sm w-540">
              학교평가 설문 생성기
            </p>
          </div>
        }
        actions={
          <>
            <Button variant={mode === "user" ? "primary" : "secondary"} onClick={() => setMode("user")}>
              사용자용
            </Button>
            <Button variant={mode === "admin" ? "primary" : "secondary"} onClick={() => setMode("admin")}>
              관리자용
            </Button>
          </>
        }
      />

      <MarqueeStrip text="학교평가 설문 생성 · 문항 풀 · DOCX 출력 · Google Forms 연동" />

      <main className="app-shell">
        {!showAuthForm && (status || error || Object.keys(latestGoogleForms).length > 0) ? (
          <div className="top-feedback-row">
            <div className="top-feedback-main">
              {status ? (
                <ColorBlockSection tone="mint" className="message-block">
                  {status}
                </ColorBlockSection>
              ) : null}
              {error ? (
                <ColorBlockSection tone="coral" className="message-block">
                  {error}
                </ColorBlockSection>
              ) : null}
            </div>
            {Object.keys(latestGoogleForms).length > 0 ? (
              <ColorBlockSection tone="mint" className="google-result top-google-result">
                <strong className="typ-body-sm w-540">최근 생성된 Google Forms (대상별)</strong>
                {AUDIENCES.map((audience) => {
                  const form = latestGoogleForms[audience];
                  if (!form) {
                    return null;
                  }
                  return (
                    <div key={audience} className="google-links-group">
                      <strong>{AUDIENCE_LABELS[audience]}</strong>
                      <a href={form.editUrl} target="_blank" rel="noreferrer">
                        편집 링크
                      </a>
                      {form.responderUrl ? (
                        <a href={form.responderUrl} target="_blank" rel="noreferrer">
                          응답 링크
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </ColorBlockSection>
            ) : null}
          </div>
        ) : null}

        {mode === "user" ? (
          school && draft ? (
            <section className="workspace">
              <div className="workspace-header">
                <div>
                  <Caption>ACTIVE SCHOOL</Caption>
                  <h2>{school.schoolName}</h2>
                </div>
                <div className="actions">
                  <span className={dirty ? "save-state dirty" : "save-state"}>{dirty ? "저장 중" : "저장됨"}</span>
                  <Button onClick={() => void saveDraft()}>초안 저장</Button>
                  <Button onClick={() => void exportDocx()}>DOCX 출력</Button>
                  <Button onClick={() => void startGoogleForms()}>Google Forms 만들기</Button>
                  <Button variant="secondary" onClick={() => void logout()}>
                    로그아웃
                  </Button>
                </div>
              </div>

                <div className="workspace-layout">
                  <div className="workspace-main">
                    <section className="settings-panel">
                      <label className="field-label">
                        설문 제목
                        <TextInput value={draft.title} onChange={(event) => setMeta("title", event.target.value)} />
                      </label>
                      <label className="field-label">
                        학교명
                        <TextInput value={draft.schoolName} onChange={(event) => setMeta("schoolName", event.target.value)} />
                      </label>
                      <label className="field-label">
                        기준일
                        <TextInput
                          type="date"
                          value={draft.surveyDate}
                          onChange={(event) => setMeta("surveyDate", event.target.value)}
                        />
                      </label>
                    </section>

                    <nav className="audience-tabs" aria-label="설문 대상 선택">
                      {AUDIENCES.map((audience) => (
                        <Pill
                          key={audience}
                          type="button"
                          selected={activeAudience === audience}
                          onClick={() => switchAudience(audience)}
                        >
                          {AUDIENCE_LABELS[audience]}
                          <span className="audience-count">{draft.itemsByAudience[audience]?.length ?? 0}</span>
                        </Pill>
                      ))}
                      <Pill
                        type="button"
                        selected={userPanel === "recommend"}
                        onClick={() => setUserPanel("recommend")}
                      >
                        업로드
                      </Pill>
                    </nav>

                    {userPanel === "recommend" ? (
                      <>
                        <section className="intro-panel">
                          <label className="field-label">
                            {AUDIENCE_LABELS[activeAudience]} 안내문
                            <Textarea
                              rows={3}
                              value={draft.introByAudience[activeAudience]}
                              onChange={(event) => setIntro(activeAudience, event.target.value)}
                            />
                          </label>
                        </section>
                        <ColorBlockSection tone="lilac" className="recommend-panel">
                          <div className="panel-title">
                            <h3>PDF 기반 추천 ({AUDIENCE_LABELS[activeAudience]})</h3>
                          </div>
                          <div className="recommend-upload">
                            <TextInput
                              type="file"
                              accept="application/pdf"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  setRecommendFile(file);
                                }
                              }}
                            />
                            <div className="actions">
                              <Button
                                variant="secondary"
                                loading={recommendLoading}
                                onClick={() => {
                                  if (recommendFile) {
                                    void analyzePdfRecommendations(recommendFile);
                                  } else {
                                    setError("먼저 PDF 파일을 선택해 주세요.");
                                  }
                                }}
                              >
                                현재 대상 추천 보기
                              </Button>
                              <Button
                                loading={recommendLoading}
                                onClick={() => {
                                  if (recommendFile) {
                                    void autoFillFromPdf(recommendFile);
                                  } else {
                                    setError("먼저 PDF 파일을 선택해 주세요.");
                                  }
                                }}
                              >
                                4개 대상 자동 채우기
                              </Button>
                            </div>
                            {recommendLoading ? <span className="typ-body-sm w-540">PDF 분석 중...</span> : null}
                            {recommendSourceName ? (
                              <span className="typ-body-sm w-540">분석 파일: {recommendSourceName}</span>
                            ) : null}
                            {recommendKeywords.length > 0 ? (
                              <div className="recommend-keywords">
                                <strong>핵심 키워드:</strong> {recommendKeywords.join(", ")}
                              </div>
                            ) : null}
                          </div>
                          <div className="question-list">
                            {recommendedQuestions.length === 0 ? (
                              <div className="empty-state">
                                2025년 설문 양식 PDF를 선택한 뒤 `현재 대상 추천 보기` 또는 `4개 대상 자동 채우기`를 실행하세요.
                              </div>
                            ) : (
                              recommendedQuestions.map((item) => (
                                <Button
                                  key={item.id}
                                  variant="secondary"
                                  className="question-row"
                                  onClick={() => {
                                    const source = questionBank.find((q) => q.id === item.id);
                                    if (source) {
                                      addQuestion(source);
                                    }
                                  }}
                                >
                                  <span>
                                    추천점수 {item.score} · {item.indicator}
                                  </span>
                                  <strong>{item.question}</strong>
                                </Button>
                              ))
                            )}
                          </div>
                        </ColorBlockSection>
                      </>
                    ) : (
                      <section className="builder-grid">
                        <div className="builder-left">
                  <section className="intro-panel">
                    <label className="field-label">
                      {AUDIENCE_LABELS[activeAudience]} 안내문
                      <Textarea
                        rows={3}
                        value={draft.introByAudience[activeAudience]}
                        onChange={(event) => setIntro(activeAudience, event.target.value)}
                      />
                    </label>
                  </section>
                        <div className="question-browser">
                  <div className="panel-title">
                    <h3>문항 찾기</h3>
                    <Button variant="secondary" onClick={() => setFilters(emptyFilters)}>
                      필터 초기화
                    </Button>
                  </div>
                <div className="filters">
                  <label className="field-label">
                    영역
                    <Select
                      value={filters.area}
                      onChange={(event) =>
                        setFilters({ area: event.target.value, subarea: "", indicator: "" })
                      }
                    >
                      <option value="">전체</option>
                      {areaOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="field-label">
                    세부영역
                    <Select
                      value={filters.subarea}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          subarea: event.target.value,
                          indicator: ""
                        }))
                      }
                    >
                      <option value="">전체</option>
                      {subareaOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="field-label">
                    평가지표
                    <Select
                      value={filters.indicator}
                      onChange={(event) =>
                        setFilters((current) => ({ ...current, indicator: event.target.value }))
                      }
                    >
                      <option value="">전체</option>
                      {indicatorOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>

                <div className="question-list" aria-live="polite">
                  {filteredQuestions.map((question) => (
                    <Button
                      variant="secondary"
                      key={question.id}
                      className="question-row"
                      onClick={() => addQuestion(question)}
                      title="클릭하면 선택 문항에 담깁니다."
                    >
                      <span>{question.indicator}</span>
                      <strong>{question.question}</strong>
                    </Button>
                  ))}
                </div>
              </div>
                        </div>

              <ColorBlockSection tone="lime" className="selected-panel" aria-label="선택 문항 편집">
                <div className="panel-title">
                  <h3>{AUDIENCE_LABELS[activeAudience]} 선택 문항</h3>
                  <div className="actions">
                    <span className="typ-body-sm w-540">{selectedItems.length}개</span>
                    <Button variant="secondary" onClick={() => resetSelectedItemsForAudience(activeAudience)}>
                      선택문항 초기화
                    </Button>
                  </div>
                </div>
                <div className="custom-question-create">
                  <label className="field-label">
                    문항 직접 추가
                    <Textarea
                      rows={2}
                      value={customQuestionText}
                      placeholder="예: 학교 교육활동 중 개선이 필요한 점을 자유롭게 작성해 주세요."
                      onChange={(event) => setCustomQuestionText(event.target.value)}
                    />
                  </label>
                  <Button variant="secondary" onClick={addCustomDescriptiveQuestion}>
                    문항 추가
                  </Button>
                </div>
                {selectedItems.length === 0 ? (
                  <div className="empty-state">왼쪽 문항을 클릭하면 이곳에 담깁니다.</div>
                ) : (
                  <div className="selected-list">
                    {selectedItems.map((item, index) => (
                      <article className="selected-item" key={item.id}>
                        <div className="selected-meta">
                          <span>#{index + 1}</span>
                          <span>{item.indicator}</span>
                        </div>
                        <Textarea
                          value={item.editedQuestion}
                          onChange={(event) =>
                            updateSelectedItem(item.id, { editedQuestion: event.target.value })
                          }
                          rows={4}
                        />
                        <div className="item-actions">
                          <Select
                            value={item.responseType}
                            onChange={(event) =>
                              updateSelectedItem(item.id, {
                                responseType:
                                  event.target.value === "text" ||
                                  event.target.value === "likert_3" ||
                                  event.target.value === "yes_no" ||
                                  event.target.value === "checklist"
                                    ? event.target.value
                                    : "likert_5"
                              })
                            }
                          >
                            <option value="likert_5">5점 척도</option>
                            <option value="likert_3">3점 척도</option>
                            <option value="yes_no">예/아니오</option>
                            <option value="checklist">체크리스트</option>
                            <option value="text">서술형</option>
                          </Select>
                          <span className="scale-preview">
                            {item.responseType === "likert_5"
                              ? LIKERT_5_OPTIONS.join(" / ")
                              : item.responseType === "likert_3"
                                ? LIKERT_3_OPTIONS.join(" / ")
                                : item.responseType === "yes_no"
                                  ? YES_NO_OPTIONS.join(" / ")
                                  : item.responseType === "checklist"
                                    ? "복수 선택 가능"
                                    : "서술형 답변"}
                          </span>
                          <Button variant="secondary" onClick={() => moveSelectedItem(item.id, -1)}>
                            위로
                          </Button>
                          <Button variant="secondary" onClick={() => moveSelectedItem(item.id, 1)}>
                            아래로
                          </Button>
                          <Button variant="danger" onClick={() => removeSelectedItem(item.id)}>
                            삭제
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </ColorBlockSection>
                      </section>
                    )}
                  </div>

                </div>
          </section>
        ) : (
          <ColorBlockSection tone="lilac">
            <div className="auth-hero-inner">
              {showAuthForm && status ? <div className="auth-inline-notice">{status}</div> : null}
              {showAuthForm && error ? <div className="auth-inline-error">{error}</div> : null}
              <Eyebrow>SCHOOL EVALUATION</Eyebrow>
              <h2 className="auth-title typ-display-lg w-340">
                {authMode === "login" ? "학교 로그인" : "학교 등록"}
              </h2>
              <p className="auth-copy typ-subhead w-330">
                문항 풀에서 설문을 구성하고 DOCX와 Google Forms로 배포합니다.
              </p>
              <label className="field-label">
                학교 이름
                <TextInput value={schoolName} onChange={(event) => setSchoolName(event.target.value)} />
              </label>
              <label className="field-label">
                비밀번호
                <TextInput
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitAuth();
                    }
                  }}
                />
              </label>
              <div className="actions ds-stack-pills">
                <Button loading={authSubmitting} onClick={() => void submitAuth()}>
                  {authMode === "login" ? "로그인" : "등록하기"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                >
                  {authMode === "login" ? "새 학교 등록" : "기존 학교 로그인"}
                </Button>
              </div>
            </div>
          </ColorBlockSection>
        )
      ) : (
        <section className="admin-panel">
          {!adminAuthed ? (
            <ColorBlockSection tone="cream">
              <div className="auth-panel compact embedded">
                <div>
                  <Eyebrow>ADMIN</Eyebrow>
                  <h2 className="admin-title typ-headline w-540">
                    관리자 로그인
                  </h2>
                </div>
                <label className="field-label">
                  관리자 비밀번호
                  <TextInput
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void adminLogin();
                      }
                    }}
                  />
                </label>
                <Button onClick={() => void adminLogin()}>관리자 로그인</Button>
              </div>
            </ColorBlockSection>
          ) : (
            <>
              <div className="workspace-header">
                <div>
                  <Caption>ADMIN</Caption>
                  <h2>학교 계정 관리</h2>
                </div>
                <Button variant="secondary" onClick={() => void loadSchools()}>
                  새로고침
                </Button>
              </div>
              <div className="school-table">
                <div className="school-table-head">
                  <span>학교명</span>
                  <span>상태</span>
                  <span>등록일</span>
                  <span>최근 로그인</span>
                  <span>관리</span>
                </div>
                {schools.map((item) => (
                  <div className="school-table-row" key={item.id}>
                    <span>{item.schoolName}</span>
                    <span className={item.status === "active" ? "status active" : "status inactive"}>
                      {item.status === "active" ? "활성" : "비활성"}
                    </span>
                    <span>{item.createdAt?.slice(0, 10)}</span>
                    <span>{item.lastLoginAt?.slice(0, 16).replace("T", " ") || "-"}</span>
                    <span className="row-actions">
                      <Button onClick={() => void resetSchoolPassword(item.id)}>비번 초기화</Button>
                      <Button variant="secondary" onClick={() => void toggleSchoolStatus(item)}>
                        {item.status === "active" ? "비활성화" : "활성화"}
                      </Button>
                      <Button variant="danger" onClick={() => void deleteSchoolAccount(item.id)}>
                        삭제
                      </Button>
                    </span>
                  </div>
                ))}
                {schools.length === 0 ? <div className="empty-state">등록된 학교가 없습니다.</div> : null}
              </div>
            </>
          )}
        </section>
      )}
      </main>

      <Footer wordmark="">
        <span>2026 서울가동초 백인규 all rights reserved.</span>
        <a href="/terms" target="_blank" rel="noreferrer">
          이용약관
        </a>
        <a href="/privacy" target="_blank" rel="noreferrer">
          개인정보처리방침
        </a>
      </Footer>
    </div>
  );
}
