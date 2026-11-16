"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ResultReview } from './ResultReview';
import { useResultsAnalysis } from "@/hooks/useResultsAnalysis";
import { canExport } from "@/lib/exportGate";
import { emptyManualAnalysis } from '@/lib/manualAnalysis';
import { AREAS, SUBAREAS } from '@/lib/evaluationFramework';
import { reportReadiness } from '@/lib/reportReadiness';
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

  const submissionIssues = analysis.result ? reportReadiness(analysis.result) : [];
  const hasAnyUpload = AUDIENCES.some((audience) => analysis.uploads[audience].status !== "idle");
  const hasUnresolvedColumn = analysis.uploadedAudiences.some((audience) =>
    analysis.uploads[audience].columns.some((column) => column.status === "unmatched")
  );

  return (
    <div className="ra-root">
      <section className="ws-card ra-section">
        <h2 className="ra-title">설문 결과 분석</h2>

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

        <p className="ws-hint">대상별 응답 파일을 하나씩 올리세요. 이름·연락처·이메일은 미리 삭제해 주세요.</p>
        <p className="ws-hint">자료는 30일간 보관됩니다. 필요한 보고서는 기간 안에 내려받으세요.</p>
        <details><summary>지원 파일 형식</summary><p className="ws-hint">CSV와 엑셀(XLSX)을 올릴 수 있습니다. 구글폼에서 받은 ZIP 파일은 압축을 풀고 CSV를 선택하세요.</p></details>
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
            파일의 질문과 설문 문항이 맞게 연결되었는지 확인하세요.
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
              {analysis.aggregating ? "집계 중…" : "점수 집계하기"}
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

          <details><summary>점수와 등급 계산 기준</summary><p className="ws-hint">평가 등급은 반올림하기 전 점수로 정합니다. 평균이 3.96점이면 화면에는 4.0점으로 표시되지만, 등급은 ‘우수’입니다. (가이드북 p.51)</p></details>
          <AreaStatsTable areaStats={analysis.result.areaStats} />
        </ResultSection>
      ) : null}


      {analysis.result ? (
        <ResultSection step="opinion" title="4. 평가 의견 작성">

          <p className="ws-hint">AI 초안을 검토해 수정하거나 직접 작성하세요. 우수한 점과 개선할 점은 각각 2개 이상 필요합니다.</p>
          {!draftAnalysis ? <button type="button" className="ws-btn ws-btn--primary" disabled={analysis.busy || reviewDirty} onClick={() => { setDraftAnalysis(emptyManualAnalysis()); setDirty(true); }}>직접 작성</button> : null}
          <div className="ra-ai-options">
          <details><summary>AI에 전달되는 정보</summary><p className="ws-hint">Google Gemini에 학교명, 문항, 집계 점수, 서술형 주제별 건수와 아래 입력 내용을 보냅니다. 서술형 응답 원문은 보내지 않습니다.</p></details>
          <label className="ws-field">
            <span>추가로 참고할 학교 활동·의견 (선택)</span>
            <textarea
              className="ws-textarea"
              rows={2}
              value={schoolContext}
              onChange={(event) => setSchoolContext(event.target.value)}
              placeholder="예: 월 1회 학년 협의회 운영. 개인정보는 입력하지 마세요."
            />
          </label>
          <label className="ws-check"><input type="checkbox" checked={transmissionConfirmed} onChange={e => setTransmissionConfirmed(e.target.checked)} />위 정보를 Google Gemini에 보내 초안을 작성하는 데 동의합니다.</label>
          <div className="ra-actions">
            <button
              type="button"
              className="ws-btn ws-btn--primary"
              disabled={analysis.busy || reviewDirty || analysis.saveConflict || !transmissionConfirmed}
              onClick={() => { if (!draftAnalysis || window.confirm('AI 초안으로 현재 평가 의견을 바꿀까요? 저장할 내용은 먼저 저장하세요.')) void analysis.runAnalysis(schoolContext); }}
            >
              {analysis.analyzing ? "AI 초안 작성 중…" : "AI로 평가 의견 초안 작성"}
            </button>
          </div>
          </div>

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

          {submissionIssues.length ? <details className="ra-warn"><summary>제출 전 확인할 내용 {submissionIssues.length}건</summary><ul>{submissionIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></details> : <p role="status">학교평가위원회 검토 후 제출하세요.</p>}
          {!analysis.result.aiAnalysis ? <p className="ra-warn">평가 의견이 비어 있습니다. ‘4. 의견’에서 작성하면 한글 파일에 반영됩니다.</p> : null}
          <div className="ra-actions">
            <button type="button" className="ws-btn ws-btn--primary" disabled={analysis.busy || dirty} onClick={() => void analysis.downloadResultHtml()}>교내 공유용 보고서 (HTML)</button>
            <button type="button" className="ws-btn ws-btn--soft" disabled={analysis.busy || dirty || !canExport('report-hwpx', draft, analysis.result).allowed} title={canExport('report-hwpx', draft, analysis.result).reason} onClick={() => void analysis.downloadReportHwpx('draft')}>학교평가서 작성용 (HWPX)</button>
            <button type="button" className="ws-btn ws-btn--soft" disabled={analysis.busy || dirty || submissionIssues.length > 0 || !canExport('report-hwpx', draft, analysis.result).allowed} title={canExport('report-hwpx', draft, analysis.result).reason ?? submissionIssues.join(' ')} onClick={() => void analysis.downloadReportHwpx('submit')}>학교평가서 제출용 (HWPX)</button>
          </div>
          <details><summary>파일별 용도와 편집 안내</summary>
            <p className="ws-hint">HTML은 교내 공유용 보고서입니다. HWPX는 교육청 양식의 학교평가서로, 한글에서 편집할 수 있습니다. 작성용은 응답이나 의견이 없는 항목을 빈칸으로 둡니다.</p>
            <p className="ws-hint">평가영역이 없는 기초자료·자유 의견 문항은 HTML에만 포함합니다. 한글에서 수정한 파일은 따로 보관하고, 제출 전 학교명·학년도·표의 쪽 나눔을 확인하세요.</p>
          </details>
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

function ResultSection({ step, title, children, initiallyOpen = step === 'upload' }: { step: string; title: string; children: ReactNode; initiallyOpen?: boolean }) {
  return <details id={`result-${step}`} className="ws-card ra-fold" open={initiallyOpen} onToggle={event => {
    if (!event.currentTarget.open) return;
    event.currentTarget.closest('.ra-root')?.querySelectorAll<HTMLDetailsElement>('.ra-fold').forEach(section => {
      if (section !== event.currentTarget) section.open = false;
    });
  }}>
    <summary><h2 className="ra-title">{title}</h2></summary>
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
          {state.columns.filter(column => column.status !== 'excluded').map((column) => (
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
        {finding.needsReview ? <span className="ra-pill ra-pill--warn">⚠ 확인 필요</span> : null}
      </div>
      <label className="ws-field ra-finding-content">
        <span>평가 결과</span>
        <textarea
          className="ws-textarea"
          rows={2}
          value={finding.content}
          onChange={(event) => onChange({ content: event.target.value })}
        />
      </label>
      <label className="ws-field ra-finding-half">
        <span>원인</span>
        <textarea
          className="ws-textarea"
          rows={2}
          value={finding.cause ?? ""}
          onChange={(event) => onChange({ cause: event.target.value })}
        />
      </label>
      <label className="ws-field ra-finding-half">
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
  const [section, setSection] = useState('area-0');
  const [findingIndex, setFindingIndex] = useState(0);
  const sections = [
    ...analysis.areas.map((area, index) => ({ id: `area-${index}`, label: area.area })),
    ...(analysis.consultingNeeds.length ? [{ id: 'consulting', label: '교육청 지원' }] : []),
    { id: 'cases', label: '특색사례' },
    { id: 'overall', label: '종합의견' }
  ];
  const activeSection = sections.some(entry => entry.id === section) ? section : 'area-0';
  const findingSelector = (findings: AiFinding[]) => findings.length > 0 ? (
    <label className="ws-field"><span>편집할 의견</span>
      <select className="ws-select" value={Math.min(findingIndex, findings.length - 1)} onChange={event => setFindingIndex(Number(event.target.value))}>
        {findings.map((finding, index) => <option key={index} value={index}>{index + 1}. {finding.category} · {finding.indicator || finding.subarea || '새 의견'}</option>)}
      </select>
    </label>
  ) : null;
  return (
    <div className="ra-analysis">
      <nav className="ra-opinion-nav" aria-label="평가 의견 구분">
        {sections.map(entry => <button type="button" key={entry.id} aria-pressed={activeSection === entry.id} className={activeSection === entry.id ? 'ws-btn ws-btn--primary' : 'ws-btn ws-btn--soft'} onClick={() => { setSection(entry.id); setFindingIndex(0); }}>{entry.label}</button>)}
      </nav>
      {analysis.areas.map((areaAnalysis, areaIndex) => (
        <div key={areaAnalysis.area} className="ra-area-block" hidden={activeSection !== `area-${areaIndex}`}>
          <h3 className="ws-group-title">{areaAnalysis.area}</h3>
          {findingSelector(areaAnalysis.findings)}
          {areaAnalysis.findings.map((finding, index) => index === Math.min(findingIndex, areaAnalysis.findings.length - 1) ? (
            <FindingEditor
              key={`finding-${index}`}
              finding={finding}
              area={areaAnalysis.area}
              onChange={(patch) => {
                const nextAreas = analysis.areas.map((area, i) =>
                  i === areaIndex ? { ...area, findings: updateFinding(area.findings, index, patch) } : area
                );
                onChange({ ...analysis, areas: nextAreas });
              }}
            />
          ) : null)}
          <button type="button" className="ws-btn ws-btn--soft" onClick={() => { setFindingIndex(areaAnalysis.findings.length); onChange({ ...analysis, areas: analysis.areas.map((a, i) => i === areaIndex ? { ...a, findings: [...a.findings, { category: '개선할 점', subarea: '', indicator: '', content: '', evidence: [] }] } : a) }); }}>평가 의견 추가</button>
        </div>
      ))}

      {analysis.consultingNeeds.length > 0 ? (
        <div className="ra-area-block" hidden={activeSection !== "consulting"}>
          <h3 className="ws-group-title">컨설팅장학 등 교육청 지원이 필요한 부분</h3>
          {findingSelector(analysis.consultingNeeds)}
          {analysis.consultingNeeds.map((finding, index) => index === Math.min(findingIndex, analysis.consultingNeeds.length - 1) ? (
            <FindingEditor
              key={`consulting-${index}`}
              finding={finding}
              onChange={(patch) =>
                onChange({ ...analysis, consultingNeeds: updateFinding(analysis.consultingNeeds, index, patch) })
              }
            />
          ) : null)}
        </div>
      ) : null}

      <div className="ra-area-block" hidden={activeSection !== "cases"}>
        <h3 className="ws-group-title">학교교육활동 특색사례 (선택)</h3>
        {analysis.featuredCases.map((entry, index) => (
          <div key={index}>
            <label className="ws-field"><span>세부영역</span><select className="ws-input" value={entry.subarea} onChange={e => onChange({ ...analysis, featuredCases: analysis.featuredCases.map((c, i) => i === index ? { ...c, subarea: e.target.value } : c) })}><option value="">선택하세요</option>{SUBAREAS.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
            <label className="ws-field"><span>사례 내용</span><textarea className="ws-textarea" rows={3} value={entry.content} onChange={e => onChange({ ...analysis, featuredCases: analysis.featuredCases.map((c, i) => i === index ? { ...c, content: e.target.value } : c) })} /></label>
            <button type="button" className="ws-btn ws-btn--soft" onClick={() => onChange({ ...analysis, featuredCases: analysis.featuredCases.filter((_, i) => i !== index) })}>사례 삭제</button>
          </div>
        ))}
        <button type="button" className="ws-btn ws-btn--soft" onClick={() => onChange({ ...analysis, featuredCases: [...analysis.featuredCases, { subarea: '', content: '' }] })}>특색사례 추가</button>
      </div>

      <label className="ws-field" hidden={activeSection !== "overall"}>
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
