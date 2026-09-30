"use client";

import { workStatusText } from "@/lib/workStatus";
import { useEffect, useRef, useState } from "react";
import {
  AREAS,
  placementFromSubarea,
  isCurrentSubarea,
  missingRequiredAreas,
  REQUIRED_AREA_CODES,
  SUBAREA_CHANGES_2025_TO_2026
} from "@/lib/evaluationFramework";
import { SubareaField } from "./SubareaField";
import {
  AUDIENCE_LABELS,
  RESPONSE_TYPE_LABELS,
  RESPONSE_TYPES,
  needsChoices,
  type ResponseType,
  type SelectedQuestionPatch,
  type BuilderInviteSummary,
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

/**
 * 2025 자료로 담아 둔 문항을 찾아 안내 문구를 만듭니다.
 *
 * 자동으로 옮기지 않습니다. Ⅲ-2와 Ⅲ-3이 하나로 합쳐졌기 때문에 기계가 고르면
 * 엉뚱한 세부영역에 들어갑니다. 사람이 다시 고르게 하는 것이 안전합니다.
 */
function legacyNoticeFor(subarea: string): string | null {
  if (!subarea) return null;
  if (isCurrentSubarea(subarea)) {
    return null;
  }
  if (subarea === "직접입력") {
    return "세부영역이 없습니다. 수정에서 2026 세부영역을 고르세요.";
  }
  const change = SUBAREA_CHANGES_2025_TO_2026.find((entry) => entry.from === subarea);
  if (!change) {
    return "2026 세부영역 체계에 없는 값입니다. 문항을 다시 담아 주세요.";
  }
  return change.note
    ? `2025 분류입니다. ${change.to}로 바뀌었습니다. ${change.note}`
    : `2025 분류입니다. ${change.to}로 다시 담아 주세요.`;
}

export function SelectedPanel({
  assignmentInvites,
  onAssign,
  showExamples,
  onToggleExamples,
  audience,
  items,
  presence,
  onConfirmReview,
  onPatch,
  onRemove,
  onMove,
  onReset,
  onEditingChange,
  canModify,
  ownerTag
}: {
  assignmentInvites?: BuilderInviteSummary[];
  onAssign?: (ids: string[], token: string) => Promise<void>;
  showExamples: boolean;
  onToggleExamples: () => void;
  audience: Audience;
  items: SelectedQuestion[];
  presence: Presence[];
  onConfirmReview: (id: string) => void;
  onPatch: (id: string, patch: SelectedQuestionPatch) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  /** 없으면 '모두 비우기'를 보이지 않습니다. 부장 링크로 들어온 사람에게는 주지 않습니다. */
  onReset?: () => void;
  onEditingChange: (id: string | undefined) => void;
  /** 이 문항을 고치거나 지울 수 있는지. 남이 담은 문항을 막을 때 씁니다. */
  canModify?: (item: SelectedQuestion) => boolean;
  /** 카드에 붙일 '담은 사람' 표시. */
  ownerTag?: (item: SelectedQuestion) => string | null;
}) {
  const [proposals,setProposals]=useState<Record<string,{subarea:string;responseType:ResponseType;rev:number}>>({});
  const [reviewOnly,setReviewOnly]=useState(false);
  const [classificationDrafts,setClassificationDrafts]=useState<Record<string,string>>({});
  const bodyRef=useRef<HTMLDivElement>(null);
  const [aiBusy,setAiBusy]=useState(false);
  const [aiError,setAiError]=useState("");
  const attempted=useRef(new Set<string>());
  const running=useRef(false);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const targets=items.filter(item=>(!canModify||canModify(item))&&(!item.workStatus||Boolean(legacyNoticeFor(item.subarea)))&&!attempted.current.has(item.id)&&(item.sourceQuestionId.startsWith("prior-")||!isCurrentSubarea(item.subarea)||item.responseType==="text"&&Boolean(item.choices?.length)));
    if(!targets.length||running.current)return;
    running.current=true;setAiBusy(true);setAiError("");
    targets.forEach(item=>attempted.current.add(item.id));
    void (async()=>{
      try {
        for(let offset=0;offset<targets.length;offset+=30){
          const batch=targets.slice(offset,offset+30);
          const response=await fetch("/api/ingest/prior-survey/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:batch.map(item=>({question:item.editedQuestion||item.originalQuestion,choices:item.choices,responseType:item.responseType}))}),signal:AbortSignal.timeout(120000)});
          const payload=await response.json();if(!payload.ok)throw new Error();
          setProposals(current=>{const next={...current};batch.forEach((item,index)=>{const row=payload.data.items[index];next[item.id]={subarea:placementFromSubarea(row?.subarea??"")?.subarea??"",responseType:RESPONSE_TYPES.includes(row?.responseType)?row.responseType:item.responseType,rev:item.rev};});return next;});
        }
      }catch{setAiError("AI 추천 연결 실패");}
      finally{running.current=false;setAiBusy(false);}
    })();
  },[items,retry,canModify,aiBusy]);

  const [assignmentIds, setAssignmentIds] = useState<string[]>([]);
  const [assignmentToken, setAssignmentToken] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const chosen = items.filter(item => assignmentIds.includes(item.id));
  const eligibleInvites = (assignmentInvites ?? []).filter(invite => !invite.audience || invite.audience === audience);
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEdit = (id: string) => {
    setEditingId(id);
    onEditingChange(id);
  };

  const stopEdit = () => {
    setEditingId(null);
    onEditingChange(undefined);
  };

  const missing = missingRequiredAreas(items, audience);
  const present = REQUIRED_AREA_CODES.filter((code) => items.some((item) => item.area.startsWith(code)));
  const showWarning = missing.length > 0;
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
          우리 학교 {AUDIENCE_LABELS[audience]}
          <span className="ws-count">{items.length}</span>
        </h2>
        <button type="button" className={showExamples ? "ws-btn ws-btn--primary" : "ws-btn ws-btn--soft"} aria-expanded={showExamples} title={showExamples ? "예시 목록을 닫고 우리 학교 문항을 넓게 봅니다. 담은 문항은 유지됩니다." : undefined} onClick={onToggleExamples}>
          {showExamples ? "← 예시 닫기" : "예시문항에서 추가"}
        </button>
        {items.length > 0 && onReset ? (
          <button type="button" className="ws-link ws-link--danger" onClick={onReset}>
            모두 비우기
          </button>
        ) : null}
      </div>

      <div className="ws-col-body" ref={bodyRef}>
        {reviewOnly && <div className="ws-form" role="status">
          <strong>2026 세부영역 확인 · 남은 {legacyCount}개</strong>
          <p className="ws-hint">문항에 맞는 2026 세부영역을 고르고 ‘분류 적용’을 누르세요. 문항 내용과 응답 유형은 바뀌지 않습니다.</p>
          <button type="button" className="ws-btn ws-btn--soft" onClick={()=>setReviewOnly(false)}>전체 문항 보기</button>
          {legacyCount===0 && <p>분류 확인을 마쳤습니다.</p>}
        </div>}
        {aiBusy && <p className="ws-hint" role="status">AI가 2026 분류·응답 유형을 추천하고 있습니다…</p>}
        {aiError && <p className="ws-hint" role="alert">{aiError} <button className="ws-btn ws-btn--soft" onClick={()=>{attempted.current.clear();setRetry(v=>v+1);}}>다시 추천</button></p>}
        {onAssign && <details>
          <summary>담당 부장 배정</summary>
          <fieldset className="ws-form" disabled={assigning}>
          <p className="ws-hint">맡길 문항을 선택하세요. 기존 담당자가 있으면 새 담당자로 바뀝니다. 부장 링크가 없으면 상단 ‘부장 링크’에서 만드세요.</p>
          <label className="ws-check"><input type="checkbox" checked={items.length > 0 && chosen.length === items.length} onChange={event => setAssignmentIds(event.target.checked ? items.map(item => item.id) : [])} />현재 대상 전체 선택</label>
          <select className="ws-select" aria-label="배정할 부장" value={assignmentToken} onChange={event => setAssignmentToken(event.target.value)}>
            <option value="">담당 부장 선택</option>
            {eligibleInvites.map(invite => <option key={invite.token} value={invite.token}>{invite.label}</option>)}
          </select>
          <button type="button" className="ws-btn ws-btn--soft" disabled={!chosen.length || chosen.length > 200 || !eligibleInvites.some(invite => invite.token === assignmentToken)} onClick={async () => {
            setAssigning(true); setAssignmentMessage("");
            try { await onAssign(chosen.map(item => item.id), assignmentToken); setAssignmentIds([]); setAssignmentMessage("배정했습니다. 담당 부장 화면에 반영됩니다."); }
            catch (error) { setAssignmentMessage(error instanceof Error ? error.message : "배정하지 못했습니다."); }
            finally { setAssigning(false); }
          }}>{assigning ? "배정 중…" : `선택한 ${chosen.length}개 문항 배정`}</button>
          {chosen.length > 200 && <p>한 번에 200개까지 선택하세요.</p>}
          <p role="status" className="ws-hint">{assignmentMessage}</p>
        </fieldset></details>}

        {items.length === 0 ? (
          <div className="ws-empty">
            <p>담은 문항이 없습니다.</p>
            <p className="ws-hint">{showExamples ? "가운데에서 문항을 클릭하면 여기에 담깁니다." : "‘예시문항에서 추가’를 누르면 예시를 고르거나 새 문항을 직접 작성할 수 있습니다."}</p>
          </div>
        ) : (
          items.map((item, index) => {
            const editor = editorOf(item.id);
            const editing = editingId === item.id;
            const legacy = legacyNoticeFor(item.subarea);
            if(reviewOnly && !legacy && !editing) return null;
            const proposal = proposals[item.id]?.rev === item.rev ? proposals[item.id] : undefined;
            const mine = canModify ? canModify(item) : true;
            const tag = ownerTag ? ownerTag(item) : null;
            return (
              <div
                key={item.id}
                className={
                  [item.workStatus ? `work-color-${item.workStatus.color}` : "work-pending", editing ? "is-editing" : "", legacy ? "is-legacy" : "", mine ? "" : "is-locked"]
                    .filter(Boolean)
                    .reduce((acc, cls) => `${acc} ${cls}`, "ws-item")
                }
              >
                <div className="ws-item-head">
                  {onAssign && <input type="checkbox" aria-label={`${index + 1}번 문항 배정 선택`} checked={assignmentIds.includes(item.id)} disabled={assigning} onChange={event => setAssignmentIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />}
                  <span className="ws-item-no">{index + 1}</span>
                  <span className="ws-item-meta">{item.indicator}</span>
                  {tag ? <span className="ws-item-owner">{tag}</span> : null}
                  {editor ? <span className="ws-item-editor">{editor} 편집 중</span> : null}
                  <div className="ws-item-actions">
                    <button
                      type="button"
                      aria-label="위로"
                      disabled={index === 0 || !mine}
                      onClick={() => onMove(item.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="아래로"
                      disabled={index === items.length - 1 || !mine}
                      onClick={() => onMove(item.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="ws-item-edit-button"
                      aria-label={editing ? "편집 끝내기" : "수정"}
                      disabled={!mine}
                      title={mine ? undefined : "다른 사람이 담은 문항은 고칠 수 없습니다."}
                      onClick={() => (editing ? stopEdit() : startEdit(item.id))}
                    >
                      {editing ? "완료" : "수정"}
                    </button>
                    <button
                      type="button"
                      aria-label="삭제"
                      className="ws-item-delete"
                      disabled={!mine}
                      title={mine ? undefined : "다른 사람이 담은 문항은 지울 수 없습니다."}
                      onClick={() => onRemove(item.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="ws-work-status">
                  {reviewOnly && !mine && <span className="ws-hint">연구부장에게 이 문항의 분류 수정을 요청하세요.</span>}
                  <span className="work-badge" title={item.workStatus ? workStatusText(item.workStatus) : undefined}>{item.workStatus ? workStatusText(item.workStatus) : "검토 전"}</span>
                  {mine && !item.workStatus && !proposal && !aiBusy && <button type="button" className="ws-btn ws-btn--soft" onClick={() => startEdit(item.id)}>검토</button>}
                </div>
                {reviewOnly && legacy && mine ? <div className="ws-review-proposal">
                  <span className="ws-hint">{proposal ? "AI 추천 세부영역" : "2026 세부영역"}</span>
                  <select className="ws-select" aria-label={`${index+1}번 분류 설정`} value={classificationDrafts[item.id] ?? proposal?.subarea ?? ""} onChange={e=>setClassificationDrafts(current=>({...current,[item.id]:e.target.value}))}>
                    <option value="">세부영역을 선택하세요</option>
                    <option value="excluded">평가영역 집계 제외</option>
                    {AREAS.map(area=><optgroup key={area.code} label={area.name}>{area.subareas.map(name=><option key={name}>{name}</option>)}</optgroup>)}
                  </select>
                  <button type="button" className="ws-btn ws-btn--primary" disabled={!(classificationDrafts[item.id] ?? proposal?.subarea)} onClick={()=>onPatch(item.id,placementFromSubarea(classificationDrafts[item.id] ?? proposal?.subarea ?? "")??{area:"",subarea:""})}>분류 적용</button>
                </div> : null}
                {!reviewOnly && proposal && mine && (!item.workStatus || legacy) ? <div className="ws-review-proposal">
                  <span className="ws-hint">AI 추천</span>
                  <select className="ws-select" aria-label={`${index+1}번 추천 세부영역`} value={proposal.subarea} onChange={e=>setProposals(current=>({...current,[item.id]:{...proposal,subarea:e.target.value}}))}>
                    <option value="">평가영역 집계 제외</option>
                    {AREAS.map(area=><optgroup key={area.code} label={area.name}>{area.subareas.map(name=><option key={name}>{name}</option>)}</optgroup>)}
                  </select>
                  <select className="ws-select" aria-label={`${index+1}번 추천 응답 유형`} value={proposal.responseType} onChange={e=>setProposals(current=>({...current,[item.id]:{...proposal,responseType:e.target.value as ResponseType}}))}>{RESPONSE_TYPES.map(type=><option key={type} value={type}>{RESPONSE_TYPE_LABELS[type]}</option>)}</select>
                  <button type="button" className="ws-btn ws-btn--primary" disabled={needsChoices(proposal.responseType) && (new Set(item.choices?.map(c=>c.trim()).filter(Boolean)).size < 2)} title={needsChoices(proposal.responseType) && (new Set(item.choices?.map(c=>c.trim()).filter(Boolean)).size < 2) ? "수정에서 보기를 먼저 입력하세요" : undefined} onClick={()=>onPatch(item.id,{...(placementFromSubarea(proposal.subarea)??{area:"",subarea:""}),responseType:proposal.responseType,confirmReview:true})}>완료</button>
                </div> : null}

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

                    <SubareaField
                      subarea={item.subarea}
                      indicator={item.indicator}
                      onChange={(next) => onPatch(item.id, next)}
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

                    <button type="button" className="ws-btn ws-btn--primary" onClick={()=>{onConfirmReview(item.id);stopEdit();}}>
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
            {REQUIRED_AREA_CODES.map((roman) => (
              <span
                key={roman}
                className={present.includes(roman) ? "ws-coverage-dot is-on" : "ws-coverage-dot"}
              >
                {roman}
              </span>
            ))}
            <span className="ws-coverage-label">영역별 문항 확인</span>
          </div>
          {showWarning ? (
            <p className="ws-coverage-warn">
              {missing.join("·")}영역 문항이 없습니다. 학생·학부모·교원은 전 영역을 평가해야 합니다.
            </p>
          ) : null}
          {legacyCount > 0 ? (
            <button type="button" className="ws-btn ws-btn--soft" aria-pressed={reviewOnly} onClick={()=>{setReviewOnly(true);bodyRef.current?.scrollTo({top:0});}}>
              분류 검토 {legacyCount}개 · 확인하기
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
