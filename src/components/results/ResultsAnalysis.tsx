"use client";

import { useEffect, useRef, useState } from "react";
import { useResultsAnalysis } from "@/hooks/useResultsAnalysis";
import { canExport } from "@/lib/exportGate";
import {
  AUDIENCES,
  AUDIENCE_SHORT_LABELS,
  type AiAnalysis,
  type AiFinding,
  type AreaStat,
  type Audience,
  type SelectedQuestion,
  type SurveyDraft
} from "@/lib/types";

/**
 * S4 — 결과 분석 화면 (spec.md 3.3, design.md 7.3).
 *
 * 1. 파일 올리기 → 2. 문항 연결 확인 → 3. 집계 결과 → 4. AI 해석 실행 → 5. 산출물 내려받기
 */
export function ResultsAnalysis({ draft, items }: { draft: SurveyDraft; items: SelectedQuestion[] }) {
  const analysis = useResultsAnalysis(items);
  const [schoolContext, setSchoolContext] = useState("");
  const [draftAnalysis, setDraftAnalysis] = useState<AiAnalysis | null>(null);

  useEffect(() => {
    setDraftAnalysis(analysis.result?.aiAnalysis ?? null);
  }, [analysis.result?.aiAnalysis]);

  const hasAnyUpload = AUDIENCES.some((audience) => analysis.uploads[audience].status !== "idle");
  const hasUnresolvedColumn = analysis.uploadedAudiences.some((audience) =>
    analysis.uploads[audience].columns.some((column) => column.status === "unmatched")
  );

  return (
    <div className="ra-root">
      <section className="ws-card ra-section">
        <h2 className="ra-title">1. 결과 파일 올리기</h2>
        <p className="ws-hint">구글폼 응답을 다운로드한 엑셀 파일을 대상별로 올리세요.</p>
        <div className="ra-upload-grid">
          {AUDIENCES.map((audience) => (
            <UploadSlot
              key={audience}
              audience={audience}
              state={analysis.uploads[audience]}
              onUpload={(file) => void analysis.uploadFile(audience, file)}
            />
          ))}
        </div>
      </section>

      {hasAnyUpload ? (
        <section className="ws-card ra-section">
          <h2 className="ra-title">2. 문항 연결 확인</h2>
          <p className="ws-hint">
            자동으로 못 찾은 열은 아래에서 문항을 직접 골라 주세요. 그대로 두면 집계에서 빠집니다.
          </p>
          {analysis.uploadedAudiences.map((audience) => (
            <ColumnReviewTable
              key={audience}
              audience={audience}
              state={analysis.uploads[audience]}
              itemsForAudience={analysis.itemsByAudience[audience]}
              onChange={(column, patch) => analysis.updateColumn(audience, column, patch)}
            />
          ))}
          <div className="ra-actions">
            <button
              type="button"
              className="ws-btn ws-btn--primary"
              disabled={analysis.aggregating}
              onClick={() => void analysis.confirmAndAggregate()}
            >
              {analysis.aggregating ? "집계 중…" : "3. 연결 확정하고 집계하기"}
            </button>
            {hasUnresolvedColumn ? (
              <span className="ra-warn">⚠ 연결 안 된 열이 있습니다. 그대로 진행하면 그 열은 집계에서 빠집니다.</span>
            ) : null}
          </div>
        </section>
      ) : null}

      {analysis.error ? <div className="ra-error">⚠ {analysis.error}</div> : null}

      {analysis.result ? (
        <section className="ws-card ra-section">
          <h2 className="ra-title">3. 집계 결과</h2>
          <p className="ws-hint">
            4단계 판정은 반올림 전 원값 기준입니다. 3.96은 표시가 4.0이어도 우수입니다. (가이드북 p.51)
          </p>
          <AreaStatsTable areaStats={analysis.result.areaStats} />
        </section>
      ) : null}

      {analysis.result ? (
        <section className="ws-card ra-section">
          <h2 className="ra-title">4. AI 해석</h2>
          <label className="ws-field">
            <span>학교교육목표·중점 활동 (선택)</span>
            <textarea
              className="ws-textarea"
              rows={2}
              value={schoolContext}
              onChange={(event) => setSchoolContext(event.target.value)}
              placeholder="예: 소통과 신뢰를 바탕으로 한 학교자치 문화 조성"
            />
          </label>
          <div className="ra-actions">
            <button
              type="button"
              className="ws-btn ws-btn--primary"
              disabled={analysis.analyzing}
              onClick={() => void analysis.runAnalysis(schoolContext)}
            >
              {analysis.analyzing ? "해석 중… (수십 초 걸릴 수 있음)" : "AI 해석 실행"}
            </button>
          </div>

          {draftAnalysis ? (
            <AiAnalysisEditor
              analysis={draftAnalysis}
              onChange={setDraftAnalysis}
              onSave={() => void analysis.saveAnalysisEdits(draftAnalysis)}
              saving={analysis.savingAnalysis}
            />
          ) : null}
        </section>
      ) : null}

      {analysis.result ? (
        <section className="ws-card ra-section">
          <h2 className="ra-title">5. 산출물 내려받기</h2>
          <div className="ra-actions">
            <button type="button" className="ws-btn ws-btn--soft" onClick={() => void analysis.downloadResultHtml()}>
              설문 결과 보고서 (HTML)
            </button>
            <button
              type="button"
              className="ws-btn ws-btn--soft"
              disabled={!canExport("indicator-xlsx", draft).allowed}
              title={canExport("indicator-xlsx", draft).reason}
              onClick={() => void analysis.downloadIndicatorXlsx()}
            >
              평가지표 및 현황 (XLSX)
            </button>
            <button
              type="button"
              className="ws-btn ws-btn--soft"
              disabled={!canExport("report-docx", draft).allowed || !analysis.result?.aiAnalysis}
              title={
                canExport("report-docx", draft).reason ??
                (!analysis.result?.aiAnalysis ? "AI 해석을 먼저 실행하세요." : undefined)
              }
              onClick={() => void analysis.downloadReportDocx("submit")}
            >
              학교평가서 제출용 (DOCX)
            </button>
            <button
              type="button"
              className="ws-btn ws-btn--soft"
              disabled={!canExport("report-docx", draft).allowed}
              title={canExport("report-docx", draft).reason}
              onClick={() => void analysis.downloadReportDocx("internal")}
            >
              학교평가서 보관용 (DOCX)
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function UploadSlot({
  audience,
  state,
  onUpload
}: {
  audience: Audience;
  state: ReturnType<typeof useResultsAnalysis>["uploads"][Audience];
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="ra-dropzone">
      <span className="ra-dropzone-label">{AUDIENCE_SHORT_LABELS[audience]}</span>
      {state.status === "uploaded" ? (
        <>
          <span className="ra-dropzone-file">✔ {state.filename}</span>
          <span className="ws-hint">응답 {state.responseCount}건</span>
        </>
      ) : state.status === "uploading" ? (
        <span className="ws-hint">올리는 중…</span>
      ) : (
        <span className="ws-hint">{state.status === "error" ? state.error : "엑셀 파일"}</span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        className="ra-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = "";
        }}
      />
      <button type="button" className="ws-btn ws-btn--soft ws-btn--sm" onClick={() => inputRef.current?.click()}>
        {state.status === "uploaded" ? "다시 올리기" : "파일 선택"}
      </button>
    </div>
  );
}

function ColumnReviewTable({
  audience,
  state,
  itemsForAudience,
  onChange
}: {
  audience: Audience;
  state: ReturnType<typeof useResultsAnalysis>["uploads"][Audience];
  itemsForAudience: SelectedQuestion[];
  onChange: (column: string, patch: { questionId?: string; isGrade?: boolean; status: "question" | "grade" | "unmatched" }) => void;
}) {
  return (
    <div className="ra-mapping-block">
      <h3 className="ws-group-title">{AUDIENCE_SHORT_LABELS[audience]} — {state.filename}</h3>
      <table className="ra-table">
        <thead>
          <tr>
            <th>결과 파일 열</th>
            <th>연결 상태</th>
            <th>문항 지정</th>
          </tr>
        </thead>
        <tbody>
          {state.columns.map((column) => (
            <tr key={column.column}>
              <td>{column.column}</td>
              <td>
                {column.status === "question" ? (
                  <span className="ra-pill ra-pill--ok">✔ 연결됨</span>
                ) : column.status === "grade" ? (
                  <span className="ra-pill ra-pill--ok">✔ 학년 문항</span>
                ) : (
                  <span className="ra-pill ra-pill--warn">⚠ 연결 안 됨</span>
                )}
              </td>
              <td>
                <select
                  className="ws-select"
                  value={column.isGrade ? "__grade__" : column.questionId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "__grade__") {
                      onChange(column.column, { isGrade: true, questionId: undefined, status: "grade" });
                    } else if (value === "") {
                      onChange(column.column, { isGrade: undefined, questionId: undefined, status: "unmatched" });
                    } else {
                      onChange(column.column, { isGrade: undefined, questionId: value, status: "question" });
                    }
                  }}
                >
                  <option value="">— 집계에서 제외 —</option>
                  {audience === "student" ? <option value="__grade__">학년 문항으로 지정</option> : null}
                  {itemsForAudience.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.editedQuestion || item.originalQuestion}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function gradeClass(grade4: string): string {
  if (grade4 === "매우 우수") return "ra-score ra-score--high";
  if (grade4 === "우수") return "ra-score ra-score--good";
  if (grade4 === "보통") return "ra-score ra-score--mid";
  return "ra-score";
}

function AreaStatsTable({ areaStats }: { areaStats: AreaStat[] }) {
  return (
    <table className="ra-table">
      <thead>
        <tr>
          <th>영역</th>
          <th>주체</th>
          <th>평균(원값)</th>
          <th>표시</th>
          <th>4단계 판정</th>
        </tr>
      </thead>
      <tbody>
        {areaStats.map((stat) => (
          <tr key={`${stat.area}-${stat.audience}`}>
            <td>{stat.area}</td>
            <td>{AUDIENCE_SHORT_LABELS[stat.audience]}</td>
            <td className={gradeClass(stat.grade4)}>{stat.mean.toFixed(2)}</td>
            <td>{stat.meanRounded.toFixed(1)}</td>
            <td className={gradeClass(stat.grade4)}>{stat.grade4}</td>
          </tr>
        ))}
        {areaStats.length === 0 ? (
          <tr>
            <td colSpan={5} className="ws-empty">
              5점 척도 문항의 응답이 없습니다.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function updateFinding(list: AiFinding[], index: number, patch: Partial<AiFinding>): AiFinding[] {
  return list.map((finding, i) => (i === index ? { ...finding, ...patch } : finding));
}

function FindingEditor({
  finding,
  onChange
}: {
  finding: AiFinding;
  onChange: (patch: Partial<AiFinding>) => void;
}) {
  return (
    <div className={finding.needsReview ? "ra-finding ra-finding--review" : "ra-finding"}>
      <div className="ra-finding-head">
        <span className="ra-pill">{finding.category}</span>
        <span className="ws-hint">{finding.subarea} · {finding.indicator}</span>
        {finding.needsReview ? <span className="ra-pill ra-pill--warn">⚠ 확인 필요</span> : null}
      </div>
      <label className="ws-field">
        <span>평가 결과</span>
        <textarea
          className="ws-textarea"
          rows={2}
          value={finding.content}
          onChange={(event) => onChange({ content: event.target.value })}
        />
      </label>
      <label className="ws-field">
        <span>원인</span>
        <textarea
          className="ws-textarea"
          rows={2}
          value={finding.cause ?? ""}
          onChange={(event) => onChange({ cause: event.target.value })}
        />
      </label>
      <label className="ws-field">
        <span>개선 방안</span>
        <textarea
          className="ws-textarea"
          rows={2}
          value={finding.action ?? ""}
          onChange={(event) => onChange({ action: event.target.value })}
        />
      </label>
      {finding.evidence.length > 0 ? (
        <p className="ws-hint">
          근거: {finding.evidence.map((e) => `${e.subject} ${e.value}`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function AiAnalysisEditor({
  analysis,
  onChange,
  onSave,
  saving
}: {
  analysis: AiAnalysis;
  onChange: (next: AiAnalysis) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="ra-analysis">
      {analysis.areas.map((areaAnalysis, areaIndex) => (
        <div key={areaAnalysis.area} className="ra-area-block">
          <h3 className="ws-group-title">{areaAnalysis.area}</h3>
          {areaAnalysis.findings.map((finding, findingIndex) => (
            <FindingEditor
              key={`${finding.category}-${finding.indicator}-${findingIndex}`}
              finding={finding}
              onChange={(patch) => {
                const nextAreas = analysis.areas.map((area, i) =>
                  i === areaIndex ? { ...area, findings: updateFinding(area.findings, findingIndex, patch) } : area
                );
                onChange({ ...analysis, areas: nextAreas });
              }}
            />
          ))}
        </div>
      ))}

      {analysis.consultingNeeds.length > 0 ? (
        <div className="ra-area-block">
          <h3 className="ws-group-title">컨설팅장학 등 교육청 지원이 필요한 부분</h3>
          {analysis.consultingNeeds.map((finding, findingIndex) => (
            <FindingEditor
              key={`consulting-${findingIndex}`}
              finding={finding}
              onChange={(patch) =>
                onChange({ ...analysis, consultingNeeds: updateFinding(analysis.consultingNeeds, findingIndex, patch) })
              }
            />
          ))}
        </div>
      ) : null}

      <label className="ws-field">
        <span>종합의견</span>
        <textarea
          className="ws-textarea"
          rows={4}
          value={analysis.overallOpinion}
          onChange={(event) => onChange({ ...analysis, overallOpinion: event.target.value })}
        />
      </label>

      <div className="ra-actions">
        <button type="button" className="ws-btn ws-btn--primary" disabled={saving} onClick={onSave}>
          {saving ? "저장 중…" : "수정 내용 저장"}
        </button>
      </div>
    </div>
  );
}
