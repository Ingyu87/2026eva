import { AREAS } from './evaluationFramework';
import { AUDIENCE_SHORT_LABELS, type Audience, type ResultUpload, type SelectedQuestion, type SurveyDraft, type SurveyResult } from './types';
import { splitChecklistAnswer } from './checklistAnswers';
import { isTimestampColumn } from './resultMetadata';

const esc = (s: unknown) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const audienceOrder: Audience[] = ['student','parent','teacher','staff'];
function questionHeading(item: SelectedQuestion): string {
 const text=item.editedQuestion||item.originalQuestion;
 if(text.length<=180)return `<h3>${esc(text)}</h3>`;
 const label=text.match(/^\s*\(([^)]{1,70})\)/)?.[1]||text.slice(0,80)+'…';
 return `<h3>${esc(label)}</h3><details><summary>문항 전체 보기</summary><p>${esc(text)}</p></details>`;
}
const topics: Record<string,string[]> = { '소통·안내':['소통','안내','통신문'], '수업·평가':['수업','평가','학습'], '독서·도서관':['독서','도서관','책읽기'], '체험·행사':['체험','행사','운동회'], '안전·생활':['안전','폭력','생활지도'], '방과후·돌봄':['방과후','돌봄'], '교육환경':['시설','공사','화장실','교실'] };

/** 외부 연결 없이 열리는 교내 공유 보고서. 응답 원문은 파일에 포함하지 않습니다. */
export function buildVisualResultReport(draft: SurveyDraft, items: SelectedQuestion[], result: SurveyResult, uploads: ResultUpload[]): string {
 const active = items.filter(i=>!i.deleted).sort((a,b)=>a.order-b.order);
 const answers = (id:string) => uploads.flatMap(u=>u.mapping.flatMap(m=>{
  if(isTimestampColumn(m.column))return [];
  const column=u.headers.indexOf(m.column);
  const item=active.find(i=>i.id===id);
  return m.questionId===id&&item?.audience===u.audience&&column>=0?u.rows.map(r=>(r[column]??'').trim()).filter(Boolean):[];
 }));
 const linkedIds = new Set(uploads.flatMap(upload => upload.mapping.map(entry => entry.questionId)));
 const gradeCounts = new Map<string, number>();
 for (const upload of uploads.filter(upload => upload.audience === 'student')) {
  const gradeColumn = upload.mapping.find(entry => entry.isGrade);
  if (!gradeColumn) continue;
  const index = upload.headers.indexOf(gradeColumn.column);
  for (const row of upload.rows) {
   const label = row[index]?.trim();
   if (label) gradeCounts.set(label, (gradeCounts.get(label) ?? 0) + 1);
  }
 }
 const filters = (i:SelectedQuestion) => `id="q-${esc(i.id)}" data-audience="${i.audience}" data-area="${esc(i.area)}"`;
 const bars = (entries:[string,number][],total:number,unit='명') => entries.map(([label,n])=>`<div class="barrow"><span>${esc(label)}</span><div class="track"><i style="width:${total?n/total*100:0}%"></i></div><strong>${n}${unit}</strong><span>${total?(n/total*100).toFixed(0):0}%</span></div>`).join('');
 const scales = active.filter(i=>i.responseType==='likert_5').map(i=>{
  const s=result.questionStats.find(s=>s.questionId===i.id&&s.audience===i.audience&&s.grade===undefined);
  const n=s?.responseCount??0;
  const positive = n ? ((s!.distribution[0]+s!.distribution[1])/n*100).toFixed(0)+'%' : '—';
  return `<article class="question" ${filters(i)}><details><summary><span class="tag">${esc(AUDIENCE_SHORT_LABELS[i.audience])}</span><span>${esc(i.editedQuestion || i.originalQuestion)}</span><b>${n}명</b><b>${n?s!.mean.toFixed(1)+'점':'—'}</b><b>긍정 ${positive}</b></summary><h3>${esc(i.editedQuestion || i.originalQuestion)}</h3><p>점수 계산에 포함된 응답자 ${n}명</p><div class="distribution">${s?.distribution.map((v,k)=>`<span title="${5-k}점 ${v}명">${5-k}점 · ${v}명</span>`).join('') || '자료 없음'}</div></details></article>`;

 }).join('');
 const choices=active.filter(i=>linkedIds.has(i.id) && ['choice_single','checklist','yes_no','likert_3'].includes(i.responseType)).map(i=>{
  const vals=answers(i.id);const tally=new Map<string,number>((i.choices??[]).map(c=>[c,0]));
  for(const v of vals)for(const opt of new Set(i.responseType==='checklist'?splitChecklistAnswer(v,i.choices):[v]))tally.set(opt,(tally.get(opt)??0)+1);
  return `<article class="choice" ${filters(i)}><details><summary><span class="tag">${esc(AUDIENCE_SHORT_LABELS[i.audience])}</span><span>${esc(i.editedQuestion || i.originalQuestion)}</span><b>${vals.length}명</b></summary>${questionHeading(i)}<p>응답자 ${vals.length}명 기준 · ${i.responseType==='checklist'?'여러 보기 선택 가능 (비율의 합계가 100%를 넘을 수 있습니다)':'한 가지 보기 선택'}</p>${vals.length?bars([...tally.entries()].sort((a,b)=>b[1]-a[1]),vals.length):'<p>응답 자료가 없습니다.</p>'}</details></article>`;
 }).join('');
 const gradeTotal = [...gradeCounts.values()].reduce((sum, count) => sum + count, 0);
 const gradeCard = gradeTotal ? `<article class="choice" data-audience="student" data-area=""><h3>학생 학년 분포</h3><p>학년 응답자 ${gradeTotal}명</p>${bars([...gradeCounts].sort(([a],[b])=>a.localeCompare(b,'ko',{numeric:true})), gradeTotal)}</article>` : '';
 const texts=audienceOrder.map(a=>{
  const questions = active.filter(i=>i.audience===a && i.responseType==='text');
  const byQuestion = questions.map(item => ({item, values: answers(item.id)}));
  const vals = byQuestion.flatMap(entry => entry.values);
  const breakdown = byQuestion.map(({item,values}) => {
   const counts = Object.entries(topics).map(([topic,words]) => [topic,values.filter(v => words.some(w => v.includes(w))).length] as [string,number]).filter(([,n])=>n>0);
   const reviewed = result.aiAnalysis?.areas.flatMap(area => area.findings)
    .filter(finding => finding.supportingQuestionIds?.includes(item.id) && finding.content.trim())
    .map(finding => `<p><strong>연결된 평가 의견</strong> ${esc(finding.content)}</p>`).join('') ?? '';
   return `<details id="q-${esc(item.id)}"><summary>${esc(item.editedQuestion || item.originalQuestion)} · ${linkedIds.has(item.id) ? values.length+'건' : '응답 파일에 연결된 열 없음'}</summary>${counts.length ? bars(counts,values.length,'건') : '<p>집계된 주제어 없음</p>'}${reviewed}</details>`;
  }).join('');
  return `<article class="choice" data-audience="${a}" data-area=""><h2>${AUDIENCE_SHORT_LABELS[a]} 서술형 의견</h2><p>서술형 응답 ${vals.length}건</p>${breakdown}</article>`;

 }).join('');
 const overview = `<table><thead><tr><th>평가 영역</th>${audienceOrder.map(a=>`<th>${AUDIENCE_SHORT_LABELS[a]}<br><small>${result.responsesByAudience[a] ?? 0}명</small></th>`).join('')}</tr></thead><tbody>${AREAS.map(area=>`<tr><th><button data-area-link="${esc(area.name)}">${esc(area.name)}</button></th>${audienceOrder.map(a=>{
  const stat=result.areaStats.find(s=>s.area===area.name && s.audience===a);
  return `<td>${stat?.subtotal.some(Boolean)?stat.mean.toFixed(1)+'점':'자료 없음'}</td>`;
 }).join('')}</tr>`).join('')}</tbody></table>`;
 const opinions = AREAS.map(area=>{
  const findings=result.aiAnalysis?.areas.find(a=>a.area===area.name)?.findings.filter(f=>f.content.trim()) ?? [];
  return `<article class="opinion" data-area="${esc(area.name)}"><h2>${esc(area.name)}</h2>${findings.map(f=>{
   const ids=new Set([...f.evidence.map(e=>e.questionId),...(f.supportingQuestionIds ?? [])]);
   const sources=active.filter(i=>ids.has(i.id) && (linkedIds.has(i.id) || i.responseType==='likert_5'));
   return `<h3>${esc(f.category)} · ${esc(f.indicator)}</h3><p>${[f.content,f.cause,f.action].filter(Boolean).map(esc).join(' ')}</p>${sources.map(i=>`<button class="source" data-source="q-${esc(i.id)}">근거 보기 · ${esc(AUDIENCE_SHORT_LABELS[i.audience])} · ${esc(i.editedQuestion || i.originalQuestion)}</button>`).join('')}`;
  }).join('') || '<p>저장된 평가 의견이 없습니다.</p>'}</article>`;
 }).join('');
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(draft.schoolName)} 학교평가 결과</title><style>${CSS}body{font-size:16px}header,nav,.filters{padding-left:clamp(12px,4vw,64px);padding-right:clamp(12px,4vw,64px)}main{padding:12px clamp(12px,4vw,64px) 24px}h1{font-size:26px}h2{font-size:21px}.grid{display:block}.question,.choice,.opinion{display:block;background:white;padding:8px 16px;margin:0 0 4px;border:1px solid var(--line);border-radius:8px}details{margin:0;font-size:16px}summary{padding:8px 0}.question summary,.choice summary:has(.tag){display:grid;grid-template-columns:48px minmax(0,1fr) auto auto auto;align-items:baseline;gap:12px}.question summary>span:nth-child(2),.choice summary>span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.distribution{display:flex;flex-wrap:wrap;gap:16px;height:auto}.distribution span{color:var(--ink);font-size:16px}.source,table button{color:var(--brand);font-size:15px;text-decoration:underline;text-align:left}.source{display:block;padding:4px 0}.opinion{padding:16px 24px}.opinion p{max-width:85ch;margin-bottom:8px;color:var(--ink)}table{border-collapse:collapse;width:100%;background:white}th,td{border-bottom:1px solid var(--line);padding:12px;text-align:center}th:first-child{text-align:left}th small{font-size:14px}.barrow{margin:8px 0}#back{position:sticky;bottom:0;background:var(--soft);padding:8px 16px}nav{gap:16px}nav button{font-size:16px}@media(max-width:650px){header{padding:8px}nav{gap:4px;flex-wrap:wrap}nav button{font-size:14px;padding:4px}.filters{padding:4px;gap:4px}.question summary,.choice summary:has(.tag){gap:4px;grid-template-columns:auto minmax(0,1fr) auto}.question summary b{font-size:13px}th,td{padding:4px}.barrow{grid-template-columns:minmax(0,1fr) 1fr auto auto}.opinion{padding:12px}}</style></head><body><header><strong>${esc(draft.schoolName)} · 학교평가 결과</strong><span>교내 공유용${result.label?' · '+esc(result.label):''}</span></header><nav aria-label="보고서 화면">${['전체 요약','문항별 결과','선택형 결과','서술형 의견','영역별 평가 의견'].map((x,i)=>`<button data-tab="${i}" aria-pressed="${i===0}">${x}</button>`).join('')}</nav><div class="filters"><label>응답 대상 <select id="audience"><option value="">전체</option>${audienceOrder.map(a=>`<option value="${a}">${AUDIENCE_SHORT_LABELS[a]} (${result.responsesByAudience[a]??'자료 없음'})</option>`).join('')}</select></label><label>영역 <select id="area"><option value="">전체 영역</option>${AREAS.map(a=>`<option>${esc(a.name)}</option>`).join('')}</select></label><label class="search">문항 찾기 <input id="query" type="search" placeholder="검색어 입력"></label></div><main><section data-panel="0"><h1>응답 대상별 영역 평균</h1><p>학생·학부모·교원·직원의 영역별 평균 점수를 비교할 수 있습니다. 응답이 없는 경우에는 ‘자료 없음’으로 표시합니다.</p>${overview}</section><section data-panel="1" hidden><h1>문항별 평균과 응답 분포</h1><p>문항을 펼치면 5점부터 1점까지 응답 인원을 볼 수 있습니다. 긍정 응답 비율은 점수 계산에 포함된 응답 중 ‘매우 그렇다’와 ‘그렇다’를 선택한 비율입니다.</p><div hidden class="legend">${['매우 그렇다','그렇다','보통이다','그렇지 않다','전혀 그렇지 않다'].map((s,i)=>`<span><i class="score${i}"></i>${s}</span>`).join('')}</div>${scales}</section><section data-panel="2" hidden><h1>보기별 선택 인원과 비율</h1><p>비율은 각 문항에 답한 사람 수를 기준으로 계산합니다. 해당 문항에 답하지 않은 사람은 계산에서 제외합니다.</p><div class="grid">${gradeCard}${choices}</div></section><section data-panel="3" hidden><h1>서술형 응답에 나타난 주제</h1><p>문항을 펼치면 해당 질문에서 주제가 언급된 건수를 볼 수 있습니다. 주제가 언급되었다는 것만으로 만족하는지, 개선을 바라는지는 알 수 없습니다.</p><div class="grid">${texts}</div></section><section data-panel="4" hidden><h1>영역별 평가 의견</h1>${opinions}</section><button id="back" hidden>평가 의견으로 돌아가기</button><p id="empty" hidden>선택한 조건에 해당하는 결과가 없습니다.</p></main><script>${SCRIPT}</script></body></html>`;
}
const CSS=`:root{--ink:#252637;--muted:#505060;--brand:#514580;--soft:#efedf7;--line:#dedde7;--bg:#f4f4f8}*{box-sizing:border-box}body{margin:0;height:100dvh;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font:20px/1.6 '맑은 고딕',sans-serif}header{padding:16px 32px;background:white;display:flex;justify-content:space-between;gap:16px}header span{font-size:16px}nav{display:flex;gap:24px;padding:0 32px;border-bottom:1px solid var(--line)}button{font:inherit;cursor:pointer;background:none;border:0;padding:12px 4px;color:var(--muted)}button[aria-pressed=true]{color:var(--brand);border-bottom:4px solid var(--brand);font-weight:bold}.filters{display:flex;gap:24px;padding:16px 32px;flex-wrap:wrap}select,input{font:inherit;background:white;border:1px solid var(--line);border-radius:8px;padding:8px;max-width:100%}label{font-size:16px;display:flex;align-items:center;gap:8px}main{overflow:auto;min-height:0;flex:1;padding:0 32px 24px}h1{font-size:36px;margin:12px 0}h2{font-size:28px;margin:0 0 16px}h3{font-size:20px;margin:8px 0;font-weight:600}p{color:var(--muted);margin:8px 0 20px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.choice,.question{background:white;border:1px solid var(--line);border-radius:16px;padding:24px}.choice p{font-size:18px}details{font-size:18px;margin:8px 0}summary{cursor:pointer;color:var(--brand)}details p{color:var(--ink)}.tag{font-size:16px;color:var(--brand)}.question{display:grid;grid-template-columns:2fr 1.6fr .45fr .45fr;gap:24px;align-items:center;margin-bottom:16px}.question>div>span{font-size:16px}.track{height:16px;background:var(--soft);border-radius:8px;overflow:hidden}.track i{display:block;height:100%;background:var(--brand)}.area{margin:24px 0}.area-line{display:flex;align-items:center;gap:24px}.area-line .track{flex:1}.area-line b{min-width:96px;text-align:right}.distribution{display:flex;height:36px;border-radius:8px;overflow:hidden}.distribution span{display:grid;place-items:center;color:white;font-size:16px}.score0{background:#514580}.score1{background:#9486b8}.score2{background:#cbc7d5;color:#252637!important}.score3{background:#a8755f}.score4{background:#774632}.score b{font-size:28px;display:block}.score span{font-size:16px}.legend{display:flex;gap:20px;flex-wrap:wrap;margin:16px 0}.legend span{font-size:16px}.legend i{display:inline-block;width:16px;height:16px;border-radius:4px;margin-right:8px}.barrow{display:grid;grid-template-columns:minmax(120px,1.4fr) 1fr 64px 64px;align-items:center;gap:12px;margin:16px 0;font-size:18px;overflow-wrap:anywhere}.notice{background:var(--soft);padding:16px;border-radius:8px}small{font-size:18px;color:var(--muted)}[hidden]{display:none!important}@media(max-width:1000px){.grid{grid-template-columns:1fr}.question{grid-template-columns:1fr 1fr}.filters{gap:12px}.search{width:100%}h1{font-size:28px}header{flex-wrap:wrap}}@media print{body{height:auto;display:block}main{overflow:visible}nav,.filters{display:none}section[hidden]{display:block!important}article[hidden]{display:block!important}.grid{display:block}.choice,.question{break-inside:avoid}}`;
const SCRIPT = `
let panel='0', origin=null;
const byId=id=>document.getElementById(id);
function update(){
 const audience=byId('audience'), area=byId('area'), query=byId('query');
 const overview=panel==='0', opinions=panel==='4';
 document.querySelector('.filters').hidden=overview;
 audience.disabled=opinions;
 area.disabled=panel==='3';
 let shown=0;
 document.querySelectorAll('[data-panel]').forEach(section=>{
  section.hidden=section.dataset.panel!==panel;
  if(section.hidden)return;
  section.querySelectorAll('article').forEach(row=>{
   row.hidden=!!((!audience.disabled && audience.value && row.dataset.audience!==audience.value) ||
    (!area.disabled && area.value && row.dataset.area!==area.value) ||
    (query.value && !row.textContent.toLowerCase().includes(query.value.trim().toLowerCase())));
   if(!row.hidden)shown++;
  });
 });
 byId('empty').hidden=overview || shown>0;
 byId('back').hidden=!origin || opinions;
 document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===panel)));
}
function go(to){panel=to;byId('query').value='';byId('area').value='';byId('audience').value='';update();document.querySelector('main').scrollTop=0}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{origin=null;go(b.dataset.tab)});
document.querySelectorAll('[data-area-link]').forEach(b=>b.onclick=()=>{go('1');byId('area').value=b.dataset.areaLink;update()});
document.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>{
 const target=byId(b.dataset.source);if(!target)return;
 origin=b;go(target.closest('[data-panel]').dataset.panel);
 const details=target.matches('details')?target:target.querySelector('details');
 if(details)details.open=true;
 target.scrollIntoView({block:'center'}); if(details)details.querySelector('summary')?.focus({preventScroll:true});
});
byId('back').onclick=()=>{const button=origin;origin=null;go('4');if(button){byId('area').value=button.closest('article').dataset.area;update();button.focus()}};
document.querySelectorAll('select,input').forEach(e=>e.oninput=update);update();`;
