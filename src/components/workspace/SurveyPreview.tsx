"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { orderBetween } from "@/lib/order";
import { AUDIENCE_LABELS, LIKERT_3_OPTIONS, LIKERT_5_OPTIONS, YES_NO_OPTIONS,
  type Audience, type Presence, type ResponseType, type SelectedQuestion, type SelectedQuestionPatch, type SurveyDraft, type SurveyDraftPatch } from "@/lib/types";
import { ResponseTypeEditor } from "./ResponseTypeEditor";

/** 인쇄물의 내용·순서를 보여 주되 저장은 기존 문항별 큐에만 맡긴다. */
export function SurveyPreview({ draft, audience, items, presence, onPatch, onMeta, onInsert, onEditingChange }: {
  draft: SurveyDraft;
  audience: Audience;
  items: SelectedQuestion[];
  presence: Presence[];
  onPatch: (id: string, patch: SelectedQuestionPatch) => void;
  onMeta?: (patch: SurveyDraftPatch) => void;
  /** 주어진 위치(order)에 새 문항을 넣는다. 없으면 추가 버튼을 보이지 않는다. */
  onInsert?: (question: { text: string; responseType: ResponseType; choices?: string[]; order: number; neighbor?: SelectedQuestion }) => void;
  onEditingChange: (id: string | undefined) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editIntro, setEditIntro] = useState(false);
  const [jump, setJump] = useState("");
  const [inserting, setInserting] = useState<number | null>(null);
  const [newText, setNewText] = useState("");
  const [newType, setNewType] = useState<{ responseType: ResponseType; choices?: string[] }>({ responseType: "likert_5" });
  const rows = useRef(new Map<string, HTMLTableRowElement>());
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => () => onEditingChange(undefined), [onEditingChange]);
  useEffect(() => {
    if (editing && !items.some(item => item.id === editing)) {
      setEditing(null); onEditingChange(undefined);
    }
  }, [items, editing, onEditingChange]);
  const stop = () => {
    const previous = editing;
    setEditing(null); onEditingChange(undefined);
    if (previous) requestAnimationFrame(() => buttons.current.get(previous)?.focus());
  };
  const closeInsert = () => { setInserting(null); setNewText(""); setNewType({ responseType: "likert_5" }); };
  const submitInsert = (index: number) => {
    const text = newText.trim();
    if (!text || !onInsert) return;
    const before = items[index - 1]?.order ?? null;
    const after = items[index]?.order ?? null;
    const choices = newType.choices?.map(choice => choice.trim()).filter(Boolean);
    onInsert({ text, responseType: newType.responseType, choices: choices?.length ? choices : undefined,
      order: orderBetween(before, after), neighbor: items[index - 1] ?? items[index] });
    closeInsert();
  };
  /** index번 문항 앞(= index-1번과 index번 사이)에 넣는 자리. */
  const insertSlot = (index: number, colSpan: number) => !onInsert ? null : <tr className="survey-preview-slot" key={`slot-${index}`}>
    <td colSpan={colSpan}>{inserting === index ? <div className="ws-form survey-preview-edit"
      onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing) closeInsert(); }}>
      <label className="ws-field"><span>{index + 1}번 자리에 새 문항 추가</span>
        <textarea className="ws-textarea" rows={3} autoFocus value={newText} onChange={event => setNewText(event.target.value)} />
      </label>
      <ResponseTypeEditor responseType={newType.responseType} choices={newType.choices}
        onChange={patch => setNewType(current => ({ ...current, ...patch }))} />
      <div className="survey-preview-slot-actions">
        <button type="button" className="ws-btn ws-btn--primary" disabled={!newText.trim()} onClick={() => submitInsert(index)}>문항 추가</button>
        <button type="button" className="ws-btn ws-btn--soft" onClick={closeInsert}>취소</button>
      </div>
    </div> : <button type="button" className="survey-preview-add" onClick={() => { setEditing(null); onEditingChange(undefined); setInserting(index); }}>
      ＋ 여기에 문항 추가<span className="survey-preview-caption"> ({index + 1}번 자리)</span>
    </button>}</td>
  </tr>;
  const groups: { scale: boolean; start: number; items: SelectedQuestion[] }[] = [];
  items.forEach((item, index) => {
    const scale = item.responseType === "likert_5";
    const last = groups.at(-1);
    if (last && last.scale === scale) last.items.push(item);
    else groups.push({ scale, start: index, items: [item] });
  });
  return (
    <main className="survey-preview" aria-label={`${AUDIENCE_LABELS[audience]} 설문 미리보기`}>
      <div className="survey-preview-tools">
        <p className="ws-hint">문항을 누르면 수정합니다. 입력 내용은 자동 저장됩니다. 저장 상태는 상단에서 확인하세요.</p>
        <label className="survey-preview-jump">문항 바로 가기
          <select className="ws-select" value={jump} onChange={event => {
            setJump(event.target.value);
            rows.current.get(event.target.value)?.scrollIntoView({ block: "start" });
          }}>
            <option value="">선택 ({items.length}문항)</option>
            {items.map((item, index) => <option key={item.id} value={item.id}>{index + 1}번 · {(item.editedQuestion || item.originalQuestion).slice(0, 32)}</option>)}
          </select>
        </label>
      </div>
      <div className="survey-preview-scroll">
        <article className="survey-preview-paper">
          <h1>{draft.title} ({AUDIENCE_LABELS[audience]})</h1>
          {editIntro && onMeta ? <div className="ws-form survey-preview-intro">
            <label className="ws-field"><span>안내문</span>
              <textarea className="ws-textarea" rows={5} autoFocus value={draft.introByAudience[audience] ?? ""}
                onChange={event => onMeta({ introByAudience: { ...draft.introByAudience, [audience]: event.target.value } })} />
            </label>
            <button type="button" className="ws-btn ws-btn--soft" onClick={() => setEditIntro(false)}>안내문 수정 완료</button>
          </div> : <div className="survey-preview-intro">
            <p>{draft.introByAudience[audience] || "안내문이 없습니다."}</p>
            {onMeta ? <button type="button" className="ws-link" onClick={() => setEditIntro(true)}>안내문 수정</button> : null}
          </div>}
          <p className="survey-preview-date">{draft.surveyDate}<br />{draft.schoolName}</p>
          {!items.length ? <p className="ws-empty">이 대상에 담은 문항이 없습니다. ‘문항 구성’에서 추가하세요.</p> : null}
          {!items.length && onInsert ? <table className="survey-preview-table"><tbody>{insertSlot(0, 2)}</tbody></table> : null}
          {groups.map(group => <table className="survey-preview-table" key={group.items[0].id}>
            <caption className="survey-preview-caption">{group.start + 1}~{group.start + group.items.length}번 {group.scale ? "5점 척도 문항" : "문항 및 응답"}</caption>
            <colgroup><col className="survey-preview-number" /><col />{group.scale ? LIKERT_5_OPTIONS.map(option => <col className="survey-preview-scale" key={option} />) : null}</colgroup>
            <thead><tr><th scope="col">번호</th><th scope="col">{group.scale ? "문항" : "문항 및 응답"}</th>
              {group.scale ? LIKERT_5_OPTIONS.map(option => <th scope="col" key={option}>{option}</th>) : null}
            </tr></thead>
            <tbody>{group.items.flatMap((item, offset) => {
              const number = group.start + offset + 1;
              const slot = insertSlot(group.start + offset, group.scale ? 7 : 2);
              const editor = presence.find(person => person.editingItemId === item.id);
              const options = item.responseType === "likert_3" ? LIKERT_3_OPTIONS : item.responseType === "yes_no" ? YES_NO_OPTIONS : item.choices ?? [];
              const row = <tr key={item.id} ref={element => { if (element) rows.current.set(item.id, element); else rows.current.delete(item.id); }}>
                <th scope="row">{number}</th>
                {editing === item.id ? <td colSpan={group.scale ? 6 : 1} className="survey-preview-edit">
                  <div className="ws-form" onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing) stop(); }}>
                    {editor ? <p className="ws-hint">{editor.displayName || "다른 사용자"}도 이 문항을 수정하고 있습니다.</p> : null}
                    <label className="ws-field"><span>{number}번 문항 수정 · 자동 저장</span>
                      <textarea className="ws-textarea" rows={4} autoFocus value={item.editedQuestion}
                        onChange={event => onPatch(item.id, { editedQuestion: event.target.value })} />
                    </label>
                    <ResponseTypeEditor responseType={item.responseType} choices={item.choices} onChange={patch => onPatch(item.id, patch)} />
                    <button type="button" className="ws-btn ws-btn--primary" onClick={stop}>수정 완료</button>
                  </div>
                </td> : <Fragment>
                  <td>
                    <button type="button" className="survey-preview-question" aria-label={`${number}번 문항 수정`}
                      ref={element => { if (element) buttons.current.set(item.id, element); else buttons.current.delete(item.id); }}
                      onClick={() => { setEditing(item.id); onEditingChange(item.id); }}>
                      {item.editedQuestion || item.originalQuestion}{item.required === false ? " (선택)" : ""}
                      <span className="survey-preview-edit-label">수정</span>
                    </button>
                    {editor ? <p className="ws-hint">{editor.displayName || "다른 사용자"} 수정 중</p> : null}
                    {!group.scale ? <div className="survey-preview-options">
                      {item.responseType === "text" ? <div className="survey-preview-answer">답변 작성란</div> : options.map((option, index) => <span key={index}>{item.responseType === "checklist" ? "□" : "○"} {option}</span>)}
                    </div> : null}
                  </td>
                  {group.scale ? LIKERT_5_OPTIONS.map(option => <td className="survey-preview-response" key={option}><span aria-hidden="true">○</span><span className="survey-preview-caption">{option} 응답 칸</span></td>) : null}
                </Fragment>}
              </tr>;
              const last = groups.at(-1) === group && offset === group.items.length - 1;
              return [slot, row, last ? insertSlot(items.length, group.scale ? 7 : 2) : null];
            })}</tbody>
          </table>)}
          {items.length ? <p>※ 정성껏 응답해 주셔서 고맙습니다.</p> : null}
          <p className="ws-hint">문항 검토용 화면입니다. 파일의 쪽 나눔은 다운로드한 DOCX·HWPX에서 확인하세요.</p>
        </article>
      </div>
    </main>
  );
}
