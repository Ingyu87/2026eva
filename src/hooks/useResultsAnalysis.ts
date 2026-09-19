"use client";

import { useMemo, useState } from "react";
import { AUDIENCES, type AiAnalysis, type Audience, type SelectedQuestion, type SurveyResult } from "@/lib/types";

/**
 * S4(결과 분석) 화면의 상태. spec.md 3.3의 5단계를 그대로 따릅니다.
 *   1. 파일 올리기 → 2. 문항 연결 확인 → 3. 집계 결과 → 4. AI 해석 실행 → 5. 산출물로 이동
 */

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.ok) {
    throw new Error(payload.error);
  }
  return payload.data;
}

export type ColumnReview = {
  column: string;
  status: "question" | "grade" | "unmatched";
  questionId?: string;
  isGrade?: boolean;
};

export type AudienceUploadState = {
  status: "idle" | "uploading" | "uploaded" | "error";
  uploadId?: string;
  filename?: string;
  responseCount?: number;
  columns: ColumnReview[];
  error?: string;
};

function emptyUploadState(): AudienceUploadState {
  return { status: "idle", columns: [] };
}

type UploadResponse = {
  uploadId: string;
  audience: Audience;
  filename: string;
  responseCount: number;
  columns: Array<{
    column: string;
    match:
      | { status: "question"; questionId: string; matchedBy: string }
      | { status: "grade"; matchedBy: string }
      | { status: "unmatched" };
  }>;
};

export function useResultsAnalysis(items: SelectedQuestion[]) {
  const [uploads, setUploads] = useState<Record<Audience, AudienceUploadState>>(() => ({
    teacher: emptyUploadState(),
    parent: emptyUploadState(),
    student: emptyUploadState(),
    staff: emptyUploadState()
  }));
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [aggregating, setAggregating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [error, setError] = useState("");

  const itemsByAudience = useMemo(() => {
    const map: Record<Audience, SelectedQuestion[]> = { teacher: [], parent: [], student: [], staff: [] };
    for (const item of items) {
      if (!item.deleted) {
        map[item.audience].push(item);
      }
    }
    return map;
  }, [items]);

  const uploadedAudiences = useMemo(
    () => AUDIENCES.filter((audience) => uploads[audience].status === "uploaded"),
    [uploads]
  );

  async function uploadFile(audience: Audience, file: File) {
    setError("");
    setUploads((prev) => ({ ...prev, [audience]: { ...emptyUploadState(), status: "uploading" } }));

    const form = new FormData();
    form.append("audience", audience);
    form.append("file", file);

    try {
      const data = await call<UploadResponse>("/api/results/upload", { method: "POST", body: form });
      setUploads((prev) => ({
        ...prev,
        [audience]: {
          status: "uploaded",
          uploadId: data.uploadId,
          filename: data.filename,
          responseCount: data.responseCount,
          columns: data.columns.map(({ column, match }) => ({
            column,
            status: match.status,
            questionId: match.status === "question" ? match.questionId : undefined,
            isGrade: match.status === "grade" ? true : undefined
          }))
        }
      }));
    } catch (err) {
      setUploads((prev) => ({
        ...prev,
        [audience]: {
          ...emptyUploadState(),
          status: "error",
          error: err instanceof Error ? err.message : "업로드에 실패했습니다."
        }
      }));
    }
  }

  /** 수동 연결 화면에서 사람이 열 하나의 연결을 고칠 때. */
  function updateColumn(audience: Audience, column: string, patch: Partial<ColumnReview>) {
    setUploads((prev) => ({
      ...prev,
      [audience]: {
        ...prev[audience],
        columns: prev[audience].columns.map((entry) =>
          entry.column === column ? { ...entry, ...patch } : entry
        )
      }
    }));
  }

  /** 연결표를 서버에 확정하고, 업로드된 대상 전부를 모아 집계를 실행합니다. */
  async function confirmAndAggregate() {
    setError("");
    setAggregating(true);
    try {
      const targets = uploadedAudiences;
      if (targets.length === 0) {
        throw new Error("먼저 결과 파일을 올리세요.");
      }

      for (const audience of targets) {
        const state = uploads[audience];
        if (!state.uploadId) continue;
        await call(`/api/results/map`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadId: state.uploadId,
            mapping: state.columns.map(({ column, questionId, isGrade }) => ({ column, questionId, isGrade }))
          })
        });
      }

      const uploadIds = targets.map((audience) => uploads[audience].uploadId).filter((id): id is string => Boolean(id));
      const data = await call<{ result: SurveyResult }>("/api/results/aggregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadIds })
      });
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "집계에 실패했습니다.");
    } finally {
      setAggregating(false);
    }
  }

  async function runAnalysis(schoolContext: string) {
    if (!result) return;
    setError("");
    setAnalyzing(true);
    try {
      const uploadIds = uploadedAudiences.map((audience) => uploads[audience].uploadId).filter((id): id is string => Boolean(id));
      const data = await call<{ result: SurveyResult }>("/api/results/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: result.id, uploadIds, schoolContext: schoolContext || undefined })
      });
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 해석에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveAnalysisEdits(aiAnalysis: AiAnalysis) {
    if (!result) return;
    setError("");
    setSavingAnalysis(true);
    try {
      const data = await call<{ result: SurveyResult }>("/api/results/analysis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: result.id, aiAnalysis })
      });
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSavingAnalysis(false);
    }
  }

  return {
    uploads,
    itemsByAudience,
    uploadedAudiences,
    result,
    aggregating,
    analyzing,
    savingAnalysis,
    error,
    uploadFile,
    updateColumn,
    confirmAndAggregate,
    runAnalysis,
    saveAnalysisEdits
  };
}
