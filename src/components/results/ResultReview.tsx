"use client";

import { useEffect, useState } from 'react';
import { REVIEW_CHECKS } from '@/lib/reviewChecklist';
import type { SurveyResult } from '@/lib/types';

export function ResultReview({ result, disabled, onDirty, onSave }: {
  result: SurveyResult; disabled: boolean; onDirty: (dirty: boolean) => void;
  onSave: (value: { label: string; review: { note: string; checked: string[] } }) => Promise<boolean>;
}) {
  const [label, setLabel] = useState(result.label ?? '');
  const [note, setNote] = useState(result.review?.note ?? '');
  const [checked, setChecked] = useState<string[]>(result.review?.checked ?? []);
  const [notice, setNotice] = useState('');
  const dirty = label !== (result.label ?? '') || note !== (result.review?.note ?? '')
    || JSON.stringify(checked) !== JSON.stringify(result.review?.checked ?? []);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => {
    setLabel(result.label ?? ''); setNote(result.review?.note ?? ''); setChecked(result.review?.checked ?? []);
  }, [result.label, result.review]);
  return <fieldset className="ra-editor-fieldset ra-section" disabled={disabled}>
    <label className="ws-field"><span>집계 이름 (선택)</span><input className="ws-input" maxLength={60} value={label} onChange={e => { setLabel(e.target.value); setNotice(''); }} placeholder="예: 11월 설문 · 위원회 검토 전" /></label>
    <p className="ws-hint">학교 내부에서 구분하는 이름입니다. 이름에 ‘최종’을 적어도 제출 조건이 달라지지 않습니다.</p>
    {REVIEW_CHECKS.map(check => <label className="ws-check" key={check.id}><input type="checkbox" checked={checked.includes(check.id)} onChange={e => {
      setChecked(prev => e.target.checked ? [...prev, check.id] : prev.filter(id => id !== check.id)); setNotice('');
    }} />{check.label}</label>)}
    <label className="ws-field"><span>검토 메모·수정 요청 (선택)</span><textarea className="ws-textarea" rows={3} maxLength={5000} value={note} onChange={e => { setNote(e.target.value); setNotice(''); }} placeholder="예: 학부모 안내 활동의 근거 자료 확인 필요. 담당 부서와 다음 회의에서 확인." /></label>
    <p className="ws-hint">체크와 메모는 학교 내부 검토 기록으로 제출 문서에는 들어가지 않습니다. 평가 의견을 다시 저장하면 확인 체크가 해제되므로 변경한 내용을 재검토하세요.</p>
    <button className="ws-btn ws-btn--soft" type="button" disabled={!dirty || disabled} onClick={async () => {
      if (await onSave({ label, review: { note, checked } })) setNotice('집계 이름과 검토 기록을 저장했습니다.');
    }}>집계 이름·검토 기록 저장</button>
    {dirty ? <p className="ra-warn" role="status">집계 이름·검토 기록을 저장해 주세요.</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
  </fieldset>;
}
