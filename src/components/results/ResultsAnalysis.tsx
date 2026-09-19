"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ResultReview } from './ResultReview';
import { useResultsAnalysis } from "@/hooks/useResultsAnalysis";
import { canExport } from "@/lib/exportGate";
import { emptyManualAnalysis } from '@/lib/manualAnalysis';
import { AREAS, SUBAREAS } from '@/lib/evaluationFramework';
import { reportReadiness, resultDataIssues } from '@/lib/reportReadiness';
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
  const [indicatorTemplate, setIndicatorTemplate] = useState<File>();
  const [draftAnalysis, setDraftAnalysis] = useState<AiAnalysis | null>(null);
  const [dirty, setDirty] = useState(false);
  const [reviewDirty, setReviewDirty] = useState(false);
  const [transmissionConfirmed, setTransmissionConfirmed] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [preservedEdit, setPreservedEdit] = useState<{ resultId: string; content: AiAnalysis } | null>(null);

  useEffect(() => {
    setDraftAnalysis(analysis.result?.aiAnalysis ?? null);
    setDirty(false);
    setSaveNotice('');
  }, [analysis.result?.id, analysis.result?.aiAnalysis]);

  useEffect(() => {
    if (!dirty && !reviewDirty && !preservedEdit) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, reviewDirty, preservedEdit]);

  const hasAnyUpload = AUDIENCES.some((audience) => analysis.uploads[audience].status !== "idle");
  const dataIssues = analysis.result ? resultDataIssues(analysis.result) : [];
  const hasUnresolvedColumn = analysis.uploadedAudiences.some((audience) =>
    analysis.uploads[audience].columns.some((column) => column.status === "unmatched")
  );

  return (
    <div className="ra-root">
      <section className="ws-card ra-section">
        <h2 className="ra-title">응답을 집계하고 학교평가서를 작성합니다</h2>
        <p className="ws-hint">파일 올리기 → 문항 연결 → 점수 확인 → 평가 의견 작성 → 보고서 내려받기. AI는 선택 사항입니다.</p>

        {analysis.loading ? <p role="status">저장된 작업을 불러오는 중…</p> : null}
        {analysis.history.length > 0 ? <label className="ws-field"><span>저장된 집계 이어하기</span><select disabled={analysis.busy} className="ws-select" value={analysis.result?.id ?? ''} onChange={e => {
          if ((dirty || reviewDirty) && !window.confirm('저장하지 않은 의견 또는 검토 기록이 있습니다. 다른 집계로 이동할까요?')) return;
          analysis.selectResult(analysis.history.find(r => r.id === e.target.value) ?? null);
        }}>{analysis.history.map(r => <option key={r.id} value={r.id}>{r.label ? `${r.label} · ` : ''}{new Date(r.uploadedAt).toLocaleString('ko-KR')} · {r.mode === 'annual' ? '학년말' : r.mode === 'interim' ? '중간평가' : '시기 확인 필요'}</option>)}</select></label> : null}
      </section>
        <nav className="ra-step-nav" aria-label="결과 작업 단계">
          {([['upload','1. 파일'], ['mapping','2. 연결'], ['stats','3. 점수'], ['opinion','4. 의견'], ['export','5. 문서'], ['review','검토 기록']] as const).map(([id,label]) => <button type="button" className="ws-btn ws-btn--soft" key={id} disabled={id === 'mapping' ? !hasAnyUpload : id !== 'upload' && !analysis.result} onClick={() => {
            const target = document.getElementById(`result-${id}`) as HTMLDetailsElement | null;
            if (target) { target.open = true; target.querySelector('summary')?.focus(); target.scrollIntoView({ block: 'start' }); }
          }}>{label}</button>)}
        </nav>
      <ResultSection step="upload" title="1. 결과 파일 올리기">

        <p className="ws-hint">구글폼 응답 CSV 또는 엑셀(XLSX) 파일을 대상별로 올리세요. 구글폼에서 내려받은 ZIP은 압축을 풀고 안의 CSV를 선택하세요.</p>
        <p className="ws-hint">올리기 전에 이름·연락처·이메일 열을 삭제하세요. 결과는 30일간 조회할 수 있으며, 기간이 지난 자료는 다음 결과 조회 때 정리됩니다. 필요한 보고서는 먼저 내려받아 학교의 보관 기준에 따라 관리하세요.</p>
        <div className="ra-upload-grid">
          {AUDIENCES.map((audience) => (
            <UploadSlot
              key={audience}
              audience={audience}
              state={analysis.uploads[audience]}
              disabled={analysis.busy}
              onUpload={(file) => void analysis.uploadFile(audience, file)}
            />
          ))}
        </div>
      </ResultSection>

      {hasAnyUpload ? (
        <ResultSection step="mapping" title="2. 문항 연결 확인">

          <p className="ws-hint">
            자동으로 못 찾은 열은 아래에서 문항을 직접 골라 주세요. 그대로 두면 집계에서 빠집니다. 열 제목이 바뀌어도 실제 질문이 같으면 해당 문항을 선택하세요. 이름·이메일·응답 시각 열은 집계에서 제외하고, 학년 열은 학생용에서만 지정합니다.
          </p>
          {analysis.uploadedAudiences.map((audience) => (
            <ColumnReviewTable
              key={audience}
              audience={audience}
              state={analysis.uploads[audience]}
              disabled={analysis.busy}
              itemsForAudience={analysis.itemsByAudience[audience]}
              onChange={(column, patch) => analysis.updateColumn(audience, column, patch)}
            />
          ))}
          <div className="ra-actions">
            <button
              type="button"
              className="ws-btn ws-btn--primary"
              disabled={analysis.busy || reviewDirty || analysis.uploadedAudiences.length === 0}
              onClick={() => { if (!dirty || window.confirm('저장하지 않은 평가 의견이 있습니다. 새 집계로 바꿀까요?')) void analysis.confirmAndAggregate(); }}
            >
              {analysis.aggregating ? "집계 중…" : "3. 연결 확정하고 집계하기"}
            </button>
            {hasUnresolvedColumn ? (
              <span className="ra-warn">⚠ 연결 안 된 열이 있습니다. 그대로 진행하면 그 열은 집계에서 빠집니다.</span>
            ) : null}
          </div>
        </ResultSection>
      ) : null}

      {analysis.error ? <div className="ra-error">⚠ {analysis.error}</div> : null}

      {analysis.result ? (
        <ResultSection step="stats" title="3. 집계 결과">

          <p className="ws-hint">
            4단계 판정은 반올림 전 원값 기준입니다. 3.96은 표시가 4.0이어도 우수입니다. (가이드북 p.51)
          </p>
          <AreaStatsTable areaStats={analysis.result.areaStats} />
        </ResultSection>
      ) : null}


      {analysis.result ? (
        <ResultSection step="opinion" title="4. 평가 의견 작성">

          <p className="ws-hint">학교평가위원회에서 확인한 우수한 점과 개선할 점을 작성하세요. 내려받은 DOCX는 한글·Word에서 열어 수정할 수 있습니다. 수정 후 표와 쪽 나눔을 확인하세요.</p>
          <details className="ra-ai-options"><summary>평가 의견 작성 요령과 예시</summary>
            <p>평가 결과에는 확인한 사실을, 원인에는 근거가 있는 설명을 적습니다. 개선 방안에는 할 일·담당·시기와 다음 연도 교육계획에 반영할 방법을 적으세요. 점수 차이만으로 원인을 단정하지 마세요.</p>
            <p><strong>가상 예시 — 실제 결과로 복사하지 마세요.</strong> 안내 방식 개선이 필요한 경우, 설문과 안내 기록을 대조하고 → 확인된 원인 또는 추가 확인할 사항을 적고 → 담당 부서가 다음 학기 안내 일정과 전달 방법을 교육계획에 반영하도록 작성할 수 있습니다.</p>
            <p>우수한 점은 계속할 활동과 근거를, 개선할 점은 바꿀 활동과 확인 방법을 구체적으로 적으세요.</p>
          </details>
          {!draftAnalysis ? <button type="button" className="ws-btn ws-btn--primary" disabled={analysis.busy || reviewDirty} onClick={() => { setDraftAnalysis(emptyManualAnalysis()); setDirty(true); }}>AI 없이 직접 작성</button> : null}
          <details className="ra-ai-options"><summary>AI 초안 도움받기 (선택)</summary>
          <p className="ws-hint">Google Gemini에 학교명, 문항, 계산된 점수와 아래 학교 활동을 보냅니다. 서술형 응답 원문은 보내지 않습니다. 이름·연락처 등 개인정보를 학교 활동에 넣지 마세요. AI 의견은 근거와 실제 운영 내용을 확인한 뒤 사용하세요.</p>
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
          <label className="ws-check"><input type="checkbox" checked={transmissionConfirmed} onChange={e => setTransmissionConfirmed(e.target.checked)} />전송 항목을 확인했습니다.</label>
          <div className="ra-actions">
            <button
              type="button"
              className="ws-btn ws-btn--primary"
              disabled={analysis.busy || reviewDirty || analysis.saveConflict || !transmissionConfirmed}
              onClick={() => { if (!draftAnalysis || window.confirm('AI 초안으로 현재 평가 의견을 바꿀까요? 저장할 내용은 먼저 저장하세요.')) void analysis.runAnalysis(schoolContext); }}
            >
              {analysis.analyzing ? "해석 중… (수십 초 걸릴 수 있음)" : "AI 해석 실행"}
            </button>
          </div>
          </details>

          {draftAnalysis ? (<fieldset className="ra-editor-fieldset" disabled={analysis.busy || reviewDirty}>
            <AiAnalysisEditor
              analysis={draftAnalysis}
              onChange={next => { setDraftAnalysis(next); setDirty(true); setSaveNotice(''); }}
              onSave={() => void analysis.saveAnalysisEdits(draftAnalysis).then(saved => { if (saved) { setDirty(false); setSaveNotice('평가 의견을 저장했습니다.'); } })}
              saving={analysis.savingAnalysis}
              saveBlocked={analysis.saveConflict}
            /></fieldset>
          ) : null}
          {analysis.saveConflict ? <div className="ra-warn" role="alert">
            <p>다른 사용자가 먼저 저장하여 이번 저장은 반영되지 않았습니다.</p>
            <p>본인 편집을 유지하려면 계속 작성하세요. 최신 의견을 불러오면 현재 편집은 아래에 보관되며 자동으로 저장하거나 덮어쓰지 않습니다.</p>
            <button type="button" className="ws-btn ws-btn--soft" disabled={analysis.busy} onClick={async () => {
              if (!draftAnalysis || !analysis.result) return;
              const backup = { resultId: analysis.result.id, content: draftAnalysis };
              if (await analysis.loadLatestAnalysis()) setPreservedEdit(backup);
            }}>본인 편집 보관하고 최신 의견 불러오기</button>
          </div> : null}
          {preservedEdit ? <details><summary>충돌 전 본인 편집 내용 (이 화면을 닫으면 사라집니다)</summary>
            <textarea className="ws-textarea" rows={8} readOnly aria-label="충돌 전 본인 편집 내용" value={[
              ...preservedEdit.content.areas.flatMap(area => [area.area, ...area.findings.map(f => `${f.category} · ${f.subarea} · ${f.indicator}\n${f.content}\n원인: ${f.cause ?? ''}\n개선 방안: ${f.action ?? ''}`)]),
              ...preservedEdit.content.consultingNeeds.map(f => `${f.category} · ${f.subarea} · ${f.indicator}\n${f.content}`),
              `종합의견\n${preservedEdit.content.overallOpinion}`
            ].join('\n\n')} />
            <button type="button" className="ws-btn ws-btn--soft" disabled={analysis.busy || preservedEdit.resultId !== analysis.result?.id} onClick={() => {
              if (!window.confirm('현재 편집칸을 보관한 본인 의견으로 바꿀까요? 최신 의견과 비교한 뒤 필요한 내용을 반영하고 저장하세요.')) return;
              setDraftAnalysis(preservedEdit.content); setDirty(true); setSaveNotice('');
            }}>보관한 본인 의견을 편집칸으로 가져오기</button>
          </details> : null}
          {dirty ? <p className="ra-warn" role="status">작성한 의견을 저장해 주세요. 보고서에는 저장된 내용이 들어갑니다.</p> : null}
          {saveNotice ? <p role="status">{saveNotice}</p> : null}
        </ResultSection>
      ) : null}

      {analysis.result ? (
        <ResultSection step="export" title="5. 보고서 내려받기">

          {reportReadiness(analysis.result).length ? <div className="ra-warn"><strong>제출 전 확인할 내용</strong><ul>{reportReadiness(analysis.result).map(issue => <li key={issue}>{issue}</li>)}</ul></div> : <p role="status">필수 대상·영역과 평가 의견이 갖춰졌습니다. 학교평가위원회 검토 후 제출하세요.</p>}
          <p className="ws-hint">DOCX는 편집 가능한 초안입니다. 제출 전 대상별 전 영역의 결과, 평가 의견, 학교명·학년도 및 서식3-1·3-2를 학교평가위원회에서 확인하세요. 문항별 점수는 보관용에만 포함됩니다.</p>
          {!analysis.result.aiAnalysis ? <p className="ra-warn">평가 의견을 아직 저장하지 않았습니다. DOCX의 빈칸을 한글·Word에서 작성하거나 위에서 직접 작성하세요.</p> : null}
          {!canExport('report-docx', draft, analysis.result).allowed ? <p className="ra-warn">{canExport('report-docx', draft, analysis.result).reason}</p> : null}
          <details className="ra-ai-options"><summary>한글·Word에서 이어 작성하는 방법</summary>
            <ol><li>작성용 DOCX를 내려받아 원본을 보관하세요.</li><li>한글·Word에서 열어 다른 이름으로 저장한 뒤 빈칸을 작성하세요.</li><li>학교명·학년도와 반복 머리글, 쪽 경계의 표, 마지막 문항까지 확인하세요.</li><li>문서에서 수정한 내용은 앱에 자동 반영되지 않습니다. 앱에서 다시 내려받으면 문서에서 수정한 부분이 포함되지 않으므로, 최종 파일은 학교에서 별도로 관리하세요.</li></ol>
          </details>
          <details className="ra-ai-options">
            <summary>교육청 양식 직접 선택 (XLSX)</summary>
            <p className="ws-hint">공통 양식이 없거나 학교가 별도로 받은 양식이 있으면 2026 평가지표 및 현황 파일을 선택하세요. 이 파일에 집계 결과를 채워 내려받으며, 다른 학교의 양식은 바뀌지 않습니다. 전년도 양식과 평가문항 예시 자료는 사용할 수 없습니다.</p>
            <label className="ws-field"><span>2026 평가지표 및 현황 양식 (600KB 이하)</span><input type="file" accept=".xlsx" disabled={analysis.busy} onChange={event => setIndicatorTemplate(event.target.files?.[0])} /></label>
            <p className="ws-hint">{indicatorTemplate ? `선택한 양식: ${indicatorTemplate.name}. 아래 ‘평가지표 및 현황 (XLSX)’을 누르세요.` : "파일을 선택하지 않으면 관리자가 등록한 공통 양식을 사용합니다."}</p>
          </details>
          <div className="ra-actions">
            <button type="button" className="ws-btn ws-btn--primary" disabled={analysis.busy || dirty || !canExport('report-docx', draft, analysis.result).allowed} onClick={() => void analysis.downloadReportDocx('draft')}>한글·Word에서 이어 쓸 작성용 (DOCX)</button>
            <button type="button" className="ws-btn ws-btn--soft" disabled={analysis.busy || dirty} onClick={() => void analysis.downloadResultHtml()}>
              설문 결과 보고서 (HTML)
            </button>
            <button
              type="button"
              className="ws-btn ws-btn--soft"
              disabled={analysis.busy || dirty || dataIssues.length > 0 || !canExport("indicator-xlsx", draft, analysis.result).allowed}
              title={canExport("indicator-xlsx", draft, analysis.result).reason ??
                (dataIssues.length > 0 ? dataIssues.join('\n') :
                  analysis.busy ? "진행 중인 작업이 끝난 뒤 내려받으세요." : dirty ? "평가 의견을 먼저 저장하세요." : undefined)}
              onClick={() => void analysis.downloadIndicatorXlsx(indicatorTemplate)}
            >
              평가지표 및 현황 (XLSX)
            </button>
            <button
              type="button"
              className="ws-btn ws-btn--soft"
              disabled={analysis.busy || dirty || reportReadiness(analysis.result).length > 0 || !canExport("report-docx", draft, analysis.result).allowed}
              title={
                canExport("report-docx", draft, analysis.result).reason ??
                (dirty ? "평가 의견을 먼저 저장하세요." : undefined)
              }
              onClick={() => void analysis.downloadReportDocx("submit")}
            >
              학교평가서 제출용 (DOCX)
            </button>
            <button
              type="button"
              className="ws-btn ws-btn--soft"
              disabled={analysis.busy || dirty || !canExport("report-docx", draft, analysis.result).allowed}
              title={canExport("report-docx", draft, analysis.result).reason}
              onClick={() => void analysis.downloadReportDocx("internal")}
            >
              학교평가서 보관용 (DOCX)
            </button>
          </div>
        </ResultSection>
      ) : null}
      {analysis.result ? <ResultSection step="review" title="학교 내부 검토 기록" initiallyOpen={false}>
        {dirty ? <p className="ra-warn">평가 의견을 먼저 저장한 뒤 검토 기록을 작성하세요.</p> : null}
        <ResultReview key={analysis.result.id} result={analysis.result} disabled={analysis.busy || dirty} onDirty={setReviewDirty} onSave={analysis.saveReview} />
        <button type="button" className="ws-btn ws-btn--ghost" disabled={analysis.busy || dirty || reviewDirty} onClick={() => void analysis.loadLatestAnalysis()}>다른 사용자가 저장한 최신 결과 불러오기</button>
        {reviewDirty ? <p className="ws-hint">저장 충돌이 나면 입력 내용을 복사해 보관한 뒤 다른 집계를 선택하거나 새로고침하여 최신 내용을 불러오세요.</p> : null}
      </ResultSection> : null}
      {hasAnyUpload || analysis.result ? <ResultSection step="cleanup" title="결과 자료 정리" initiallyOpen={false}>

        <p className="ws-hint">다운로드한 보고서는 지워지지 않습니다. 앱에 올린 응답 파일과 저장된 집계·평가 의견을 삭제하며, 설문 문항은 유지합니다.</p>
        <button type="button" className="ws-btn ws-btn--ghost" disabled={analysis.busy || dirty || reviewDirty} onClick={() => { if (window.confirm('보고서를 내려받았나요? 이 학교의 모든 응답 파일·집계·평가 의견을 삭제합니다. 되돌릴 수 없습니다.')) void analysis.deleteResults(); }}>응답 및 분석 자료 삭제</button>
      </ResultSection> : null}
    </div>
  );
}

function ResultSection({ step, title, children, initiallyOpen = true }: { step: string; title: string; children: ReactNode; initiallyOpen?: boolean }) {
  return <details id={`result-${step}`} className="ws-card ra-fold" open={initiallyOpen}>
    <summary><h2 className="ra-title">{title}</h2><span className="ws-hint">펼치기 / 접기</span></summary>
    <div className="ra-section">{children}</div>
  </details>;
}

function UploadSlot({
  audience,
  state,
  disabled,
  onUpload
}: {
  audience: Audience;
  state: ReturnType<typeof useResultsAnalysis>["uploads"][Audience];
  disabled: boolean;
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
        <span className="ws-hint">{state.status === "error" ? state.error : "CSV · 엑셀(XLSX) 파일"}</span>
      )}
      {state.error ? <p className="ra-warn" role="alert">{state.error}{state.status === "uploaded" ? " 기존 파일을 유지했습니다." : ""}</p> : null}
      <input
        ref={inputRef}
        disabled={disabled}
        type="file"
        accept=".xlsx,.csv"
        className="ra-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = "";
        }}
      />
      <button type="button" className="ws-btn ws-btn--soft ws-btn--sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
        {state.status === "uploaded" ? "다시 올리기" : "파일 선택"}
      </button>
    </div>
  );
}

function ColumnReviewTable({
  audience,
  state,
  itemsForAudience,
  disabled,
  onChange
}: {
  audience: Audience;
  state: ReturnType<typeof useResultsAnalysis>["uploads"][Audience];
  itemsForAudience: SelectedQuestion[];
  disabled: boolean;
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
                  disabled={disabled}
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
  area,
  onChange
}: {
  finding: AiFinding;
  /** 영역별 의견은 해당 영역만, 컨설팅 의견은 전체 세부영역을 선택합니다. */
  area?: string;
  onChange: (patch: Partial<AiFinding>) => void;
}) {
  const subareas = area === undefined ? SUBAREAS : AREAS.find(entry => entry.name === area)?.subareas ?? [];
  const invalidSubarea = Boolean(finding.subarea) && !subareas.includes(finding.subarea);
  return (
    <div className={finding.needsReview ? "ra-finding ra-finding--review" : "ra-finding"}>
      {area !== undefined ? <label className="ws-field"><span>구분</span>
        <select className="ws-select" value={finding.category} onChange={e => {
          const category = e.target.value;
          if (category === '우수한 점' || category === '개선할 점') onChange({ category });
        }}>
          <option value="우수한 점">우수한 점</option>
          <option value="개선할 점">개선할 점</option>
        </select>
      </label> : null}
      <label className="ws-field"><span>세부영역</span><select className="ws-select" value={invalidSubarea ? '' : finding.subarea} onChange={e => onChange({ subarea: e.target.value })}><option value="">해당 세부영역 선택</option>{subareas.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
      {invalidSubarea ? <p className="ra-warn">기존 세부영역 ‘{finding.subarea}’은 이 영역에 속하지 않습니다. 해당 세부영역을 다시 선택하세요.</p> : null}
      <label className="ws-field"><span>평가지표</span><input className="ws-input" value={finding.indicator} onChange={e => onChange({ indicator: e.target.value })} /></label>
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
      {finding.needsReview ? <label className="ws-check"><input type="checkbox" onChange={() => onChange({ needsReview: false })} />집계 근거와 실제 운영 내용을 확인하고 평가 의견을 수정했습니다.</label> : null}
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
  saving,
  saveBlocked
}: {
  analysis: AiAnalysis;
  onChange: (next: AiAnalysis) => void;
  onSave: () => void;
  saving: boolean;
  saveBlocked: boolean;
}) {
  return (
    <div className="ra-analysis">
      {analysis.areas.map((areaAnalysis, areaIndex) => (
        <div key={areaAnalysis.area} className="ra-area-block">
          <h3 className="ws-group-title">{areaAnalysis.area}</h3>
          {areaAnalysis.findings.map((finding, findingIndex) => (
            <FindingEditor
              key={`finding-${findingIndex}`}
              finding={finding}
              area={areaAnalysis.area}
              onChange={(patch) => {
                const nextAreas = analysis.areas.map((area, i) =>
                  i === areaIndex ? { ...area, findings: updateFinding(area.findings, findingIndex, patch) } : area
                );
                onChange({ ...analysis, areas: nextAreas });
              }}
            />
          ))}
          <button type="button" className="ws-btn ws-btn--soft" onClick={() => onChange({ ...analysis, areas: analysis.areas.map((a, i) => i === areaIndex ? { ...a, findings: [...a.findings, { category: '개선할 점', subarea: '', indicator: '', content: '', evidence: [] }] } : a) })}>평가 의견 추가</button>
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
        <button type="button" className="ws-btn ws-btn--primary" disabled={saving || saveBlocked} onClick={onSave}>
          {saving ? "저장 중…" : "수정 내용 저장"}
        </button>
      </div>
    </div>
  );
}
