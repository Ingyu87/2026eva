"use client";
import { useEffect, useState } from 'react';

export function IndicatorTemplateAdmin() {
  const [name, setName] = useState('확인 중…');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch('/api/admin/templates/indicator-xlsx').then(r=>r.json()).then(p=>setName(p.ok ? p.data.template?.filename ?? '등록된 서식 없음' : p.error)).catch(()=>setName('서식을 불러오지 못했습니다.'));
  }, []);
  return <section className="ra-section">
    <h2 className="ra-title">평가지표 및 현황 서식 등록</h2>
    <p className="ws-hint">교육청에서 배포한 해당 학년도 빈 서식(XLSX)을 등록하세요. 실제 학교의 결과가 입력된 파일을 공용 서식으로 쓰지 마세요. 현재: {name}</p>
    <label className="ws-field"><span>{busy ? '서식 확인 중…' : '서식 파일 선택'}</span><input type="file" accept=".xlsx" disabled={busy} onChange={async e=>{
      const file=e.target.files?.[0]; if (!file) return;
      setBusy(true);setMessage('');const form=new FormData();form.set('file',file);
      try {const r=await fetch('/api/admin/templates/indicator-xlsx',{method:'POST',body:form});const p=await r.json();if (!p.ok) throw Error(p.error);setName(p.data.filename);setMessage(`등록했습니다. 평가지표 ${p.data.recognized.indicatorRowCount}행을 확인했습니다.`);} catch(err){setMessage(err instanceof Error ? err.message : '등록 실패');} finally {setBusy(false);}
    }} /></label><p role="status">{message}</p>
  </section>;
}
