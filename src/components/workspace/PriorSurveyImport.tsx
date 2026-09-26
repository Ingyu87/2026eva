"use client";

import { useEffect, useRef, useState, type SetStateAction } from "react";
import { placementFromSubarea } from "@/lib/evaluationFramework";
import type { PriorSurveyItem } from "@/lib/priorSurvey";
import { AUDIENCES, AUDIENCE_SHORT_LABELS, needsChoices, type Audience, type ResponseType } from "@/lib/types";
import { readPriorReview, writePriorReview } from "@/lib/priorReviewCache";
import { SubareaField } from "./SubareaField";
import { ResponseTypeEditor } from "./ResponseTypeEditor";

export type PriorSurveyCommit = Omit<PriorSurveyItem, "responseType"> & { responseType: ResponseType };
type ReviewItem = PriorSurveyItem & { included: boolean };
type Source = { id: string; name: string; items: ReviewItem[]; error?: string; checked: boolean };

export function PriorSurveyImport({ draftId, onCommit }: { draftId: string; onCommit: (items: PriorSurveyCommit[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const request = useRef<AbortController | null>(null);
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; request.current?.abort(); }, []);
  const [reading, setReading] = useState("");
  const [error, setError] = useState("");
  const [sources, setSourceState] = useState<Source[]>([]);
  const sourcesRef = useRef<Source[]>([]);
  const [cacheFailed, setCacheFailed] = useState(false);
  useEffect(() => {
    const restored = readPriorReview<Source[]>(draftId);
    sourcesRef.current = restored ?? [];
    setSourceState(sourcesRef.current);
  }, [draftId]);
  function setSources(update: SetStateAction<Source[]>) {
    const next = typeof update === "function" ? update(sourcesRef.current) : update;
    sourcesRef.current = next;
    setCacheFailed(!writePriorReview(draftId, next));
    setSourceState(next);
  }
  const [active, setActive] = useState<Audience>("teacher");
  const selected = sources.flatMap(source => source.items.filter(item => item.included));
  const valid = (item: ReviewItem) => Boolean(item.question.trim() && placementFromSubarea(item.subarea) && item.responseType && (!needsChoices(item.responseType) || ((item.choices?.length ?? 0) >= 2 && item.choices?.every(c => c.trim()) && new Set(item.choices.map(c => c.trim())).size === item.choices.length)));
  const ready = selected.length > 0 && selected.every(valid) && sources.every(s => !s.error && s.checked);

  async function upload(files: File[]) {
    if (busy.current) return;
    if (sources.length + files.length > 4) { setError("한 번에 최대 4개 파일을 확인할 수 있습니다. 기존 파일을 지운 뒤 다시 올려 주세요."); return; }
    if (files.some(f => !f.name.toLowerCase().endsWith(".pdf") || f.size > 12 * 1024 * 1024)) { setError("파일마다 12MB 이하의 PDF를 선택하세요."); return; }
    if (files.some(f => sources.some(s => s.name === f.name)) || new Set(files.map(f => f.name)).size !== files.length) { setError("같은 이름의 파일이 있습니다. 중복 파일을 제외하세요."); return; }
    busy.current = true;
    cancelled.current = false;
    setError("");
    try {
      for (const file of files) {
        if (cancelled.current) break;
        request.current = new AbortController();
        setReading(file.name);
        const source: Source = { id: crypto.randomUUID(), name: file.name, items: [], checked: false };
        try {
          const form = new FormData(); form.append("file", file);
          const response = await fetch("/api/ingest/prior-survey", { method: "POST", body: form, signal: AbortSignal.any([request.current.signal, AbortSignal.timeout(180000)]) });
          const payload = await response.json();
          if (!payload.ok) throw new Error(payload.error || "문항지를 읽지 못했습니다.");
          source.items = (payload.data.items as PriorSurveyItem[]).map(item => ({ ...item, included: true }));
          if (!source.items.length) throw new Error("문항을 찾지 못했습니다.");
        } catch (err) { source.error = err instanceof Error && err.name === "TimeoutError" ? "문항 추출이 3분 안에 끝나지 않았습니다. 다시 시도해 주세요." : err instanceof Error ? err.message : "문항지를 읽지 못했습니다."; }
        if (cancelled.current) break;
        setSources(current => [...current, source]);
      }
    } finally { busy.current = false; setReading(""); }
  }

  function update(id: string, index: number, patch: Partial<ReviewItem>) {
    setSources(current => current.map(s => s.id === id ? { ...s, checked: false, items: s.items.map((item, i) => i === index ? { ...item, ...patch } : item) } : s));
  }

  return <div className="ws-prior">
    <p className="ws-hint">교원용·직원용·학생용·학부모용 PDF를 함께 선택하세요. 가지고 있는 대상의 파일만 올려도 됩니다. 문항지 내용은 문항 추출을 위해 외부 AI 서비스로 전송됩니다. 응답 결과나 개인정보가 포함된 파일은 올리지 마세요.</p>
    <p className="ws-hint" role="status">{cacheFailed ? "브라우저 임시저장이 막혀 있습니다. 창을 새로고침하지 말고 검토한 문항을 올해 설문에 담아 주세요." : "검토 중인 내용은 이 탭에 임시저장됩니다. 설정 창을 닫거나 새로고침해도 이어서 확인할 수 있습니다. 탭을 닫기 전에는 올해 설문에 담아 주세요."}</p>
    <input ref={inputRef} type="file" multiple accept="application/pdf,.pdf" className="ra-file-input" onChange={event => { const files = Array.from(event.target.files ?? []); if (files.length) void upload(files); event.target.value = ""; }} />
    <button type="button" className="ws-start-action" disabled={Boolean(reading)} onClick={() => inputRef.current?.click()}><strong>작년 설문지 올리기</strong><span>PDF 최대 4개 · 파일당 12MB</span></button>
    <p className="ws-hint" role="status">{reading ? `${reading} 읽는 중…` : error}</p>
    {reading && <button type="button" className="ws-btn ws-btn--soft" onClick={() => { cancelled.current = true; request.current?.abort(); setError("읽기를 중단했습니다. 완료된 파일은 아래에 유지됩니다."); }}>읽기 중단</button>}
    {sources.length > 0 && <>
      <fieldset disabled={Boolean(reading)} className="ws-prior-controls">
        {sources.map(source => <div className="ws-prior-item" key={source.id}>
          <strong className="ws-prior-filename">{source.name}</strong>
          {source.error ? <p role="alert" className="ws-custom-error">{source.error} 파일을 지운 뒤 다시 올려 주세요.</p> : <>
            <label className="ws-field"><span>이 파일 전체의 대상 변경</span><select className="ws-select" aria-label={`${source.name} 대상`} value={new Set(source.items.map(i => i.audience)).size === 1 ? source.items[0]?.audience : ""} onChange={e => setSources(current => current.map(s => s.id === source.id ? { ...s, checked: false, items: s.items.map(i => ({ ...i, audience: e.target.value as Audience })) } : s))}><option value="" disabled>문항별 대상</option>{AUDIENCES.map(a => <option key={a} value={a}>{AUDIENCE_SHORT_LABELS[a]}</option>)}</select></label>
            <span>{source.items.filter(i => i.included).length} / {source.items.length}문항 선택</span>
            <label><input type="checkbox" checked={source.checked} onChange={e => setSources(current => current.map(s => s.id === source.id ? { ...s, checked: e.target.checked } : s))} /> 원본과 문항·보기·응답 유형을 대조했습니다.</label>
          </>}
          <button type="button" className="ws-btn ws-btn--soft" onClick={() => setSources(current => current.filter(s => s.id !== source.id))}>파일 제외</button>
        </div>)}
        <div className="ws-prior-tabs" aria-label="대상별 문항 확인">{AUDIENCES.map(a => <button type="button" className={active === a ? "ws-btn ws-btn--primary" : "ws-btn ws-btn--soft"} aria-pressed={active === a} key={a} onClick={() => setActive(a)}>{AUDIENCE_SHORT_LABELS[a]} {selected.filter(i => i.audience === a).length}</button>)}</div>
        <div className="ws-prior-list">
          {!sources.some(s => s.items.some(i => i.audience === active)) && <p className="ws-hint">이 대상의 문항이 없습니다. 파일을 추가하거나 파일의 대상을 확인하세요.</p>}
          {sources.flatMap(source => source.items.map((item, index) => item.audience !== active ? null : <div className="ws-prior-item" key={`${source.id}-${index}`}>
            <label><input type="checkbox" checked={item.included} onChange={e => update(source.id, index, { included: e.target.checked })} /> {index + 1}번 문항 사용</label>
            <span className="ws-hint ws-prior-filename">{source.name}</span>
            <label className="ws-field"><span>문항</span><textarea className="ws-input" value={item.question} onChange={e => update(source.id, index, { question: e.target.value })} /></label>
            <label className="ws-field"><span>대상</span><select className="ws-select" value={item.audience} onChange={e => update(source.id, index, { audience: e.target.value as Audience })}>{AUDIENCES.map(a => <option key={a} value={a}>{AUDIENCE_SHORT_LABELS[a]}</option>)}</select></label>
            <SubareaField subarea={item.subarea} indicator={item.indicator} onChange={patch => update(source.id, index, patch)} />
            {item.responseType ? <ResponseTypeEditor responseType={item.responseType} choices={item.choices} onChange={patch => update(source.id, index, patch)} /> : <label className="ws-field"><span>응답 유형을 확인하세요</span><select className="ws-select" value="" onChange={e => update(source.id, index, { responseType: e.target.value as ResponseType })}><option value="" disabled>유형 선택</option><option value="likert_5">5점 척도</option><option value="likert_3">3점 척도</option><option value="yes_no">예 / 아니오</option><option value="choice_single">하나 선택</option><option value="checklist">여러 개 선택</option><option value="text">서술형</option></select></label>}
            {item.included && !valid(item) && <p className="ws-custom-error">문항, 올해 세부영역, 응답 유형과 선택형 보기(서로 다른 2개 이상)를 확인하세요.</p>}
          </div>))}
        </div>
      </fieldset>
      <p className="ws-hint">학년군별 표는 행마다 문항을 나누고 대안 입력 칸은 서술형으로 추가합니다. 원본의 모든 행과 보기, 선택 개수 안내가 있는지 대조하세요. 선택 개수 제한과 조건부 분기는 자동 설정되지 않습니다.</p>
      <p className="ws-hint">올해 세부영역과 원본 대조를 모두 확인하면 담을 수 있습니다. 기존 문항은 유지하고 선택한 {selected.length}개를 추가합니다.</p>
      <button type="button" className="ws-btn ws-btn--primary" disabled={!ready || Boolean(reading)} onClick={() => { if (busy.current || !ready) return; busy.current = true; onCommit(selected.map(item => ({ ...placementFromSubarea(item.subarea)!, audience: item.audience, indicator: item.indicator.trim() || "학교 자체 문항", question: item.question.trim(), responseType: item.responseType!, choices: item.responseType && needsChoices(item.responseType) ? item.choices?.map(c => c.trim()) : undefined }))); setSources([]); busy.current = false; }}>확인한 문항으로 올해 설문 시작하기</button>
    </>}
  </div>;
}
