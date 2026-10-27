"use client";

import { useState } from "react";
import type { ResponseType } from "@/lib/types";
import { ResponseTypeEditor } from "./ResponseTypeEditor";

/**
 * 문항 사이에 새 문항을 넣는 버튼과 입력창.
 * 설문 미리보기와 문항 구성 목록이 똑같이 쓴다. 따로 두면 한쪽만 고쳐져 어긋난다.
 */
export function InsertQuestionSlot({ position, onOpen, onSubmit }: {
  /** 새 문항이 갖게 될 번호. */
  position: number;
  onOpen?: () => void;
  onSubmit: (question: { text: string; responseType: ResponseType; choices?: string[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [type, setType] = useState<{ responseType: ResponseType; choices?: string[] }>({ responseType: "likert_5" });
  const close = () => { setOpen(false); setText(""); setType({ responseType: "likert_5" }); };
  if (!open) {
    return <button type="button" className="survey-preview-add" onClick={() => { onOpen?.(); setOpen(true); }}>
      ＋ 여기에 문항 추가<span className="survey-preview-caption"> ({position}번 자리)</span>
    </button>;
  }
  const choices = type.choices?.map(choice => choice.trim()).filter(Boolean);
  return <div className="ws-form survey-preview-edit survey-preview-slot-form"
    onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing) close(); }}>
    <label className="ws-field"><span>{position}번 자리에 새 문항 추가</span>
      <textarea className="ws-textarea" rows={3} autoFocus value={text} onChange={event => setText(event.target.value)} />
    </label>
    <ResponseTypeEditor responseType={type.responseType} choices={type.choices}
      onChange={patch => setType(current => ({ ...current, ...patch }))} />
    <div className="survey-preview-slot-actions">
      <button type="button" className="ws-btn ws-btn--primary" disabled={!text.trim()}
        onClick={() => { onSubmit({ text: text.trim(), responseType: type.responseType, choices: choices?.length ? choices : undefined }); close(); }}>문항 추가</button>
      <button type="button" className="ws-btn ws-btn--soft" onClick={close}>취소</button>
    </div>
  </div>;
}
