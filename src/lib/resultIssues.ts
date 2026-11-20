import { AUDIENCE_SHORT_LABELS, type SelectedQuestion } from './types';
import { splitChecklistAnswer } from './checklistAnswers';

const escape = (v:string) => v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const percent = (n:number,total:number) => (100*n/total).toFixed(1);
const clean = (s:string) => s.replace(/^[①-⑳]\s*/, '').trim();
const topics = [
 ['체험학습', /체험학습 방식/], ['학부모 공개수업', /공개수업 운영|공개수업 시기/],
 ['학급임원', /학급\s*임원/], ['학교자율휴업일', /학교자율휴업일/],
 ['특색교육', /특색교육활동으로 가장 중점|특색교육.*더 배우고 싶은 분야/],
 ['학생자치', /학생들의 의견을 듣고 학교생활에/], ['체육 수업 시수', /수업 시수 확대/],
 ['진로체험', /진로교육.*(중점을 두어야|앞으로 하고 싶은 일)/],
 ['교원 연수', /교사 연수 및 컨설팅|희망하는 교원 연수/], ['동아리 운영', /동아리 활동은 어떻게 운영/]
] as const;
function optionLabel(topic:string, raw:string) {
 const label=clean(raw);
 // Student forms sometimes explain the same option in parentheses.
 if(topic==='특색교육')return label.replace(/교육\s*\([^()]+\)\s*$/,'교육').replace(/[‧ㆍ]/g,'·');
 return label;
}
type Row = {item:SelectedQuestion; title:string; subject:string; total:number; tally:Map<string,number>};

function chart(rows:Row[], topic:string, grades:Map<string,number>) {
 const notes:string[]=[];
 const stack=(row:Row, values:[string,number][], base=row.total) =>
  `<div class="bar"><b>${escape(row.subject)} · ${row.total}명</b><div class="track">${values.map(([,n],i)=>`<i class="c${i%3}" style="width:${100*n/base}%"></i>`).join('')}</div><small>${values.map(([s,n])=>escape(s)+' '+n+'명').join(' · ')}</small></div>`;
 const ranked=(row:Row)=>[...row.tally].sort((a,b)=>b[1]-a[1]);
 let visual='';
 if(topic==='학부모 공개수업' && rows.every(r=>[...r.tally.keys()].every(v=>['매우 만족','만족','보통','불만족','매우 불만족'].includes(v)))){
  visual=rows.map(r=>{
   const pos=(r.tally.get('매우 만족')??0)+(r.tally.get('만족')??0),neg=(r.tally.get('매우 불만족')??0)+(r.tally.get('불만족')??0);
   notes.push(`${r.subject} ${r.total}명 중 만족은 ${pos}명(${percent(pos,r.total)}%), 불만족은 ${neg}명(${percent(neg,r.total)}%)이었다.`);
   return `<div class="divrow"><b>${r.subject}</b><div class="half neg"><i style="width:${percent(neg,r.total)}%"></i></div><div class="half pos"><i style="width:${percent(pos,r.total)}%"></i></div></div><small>불만족 ${neg}명 · 보통 ${r.total-pos-neg}명 · 만족 ${pos}명</small>`;
  }).join('');
 }else if(topic==='학교자율휴업일'){
  const dates=[...new Set(rows.flatMap(r=>[...r.tally.keys()]))];
  const series=dates.map(date=>({date,counts:rows.map(r=>r.tally.get(date)??0)}));
  const totals=series.map(s=>s.counts.reduce((a,b)=>a+b,0)),max=Math.max(...totals,1);
  visual=series.map(({date,counts},i)=>`<div class="bar"><b>${escape(date)} · ${totals[i]}건</b><div class="track">${counts.map((n,j)=>`<i class="c${j%3}" style="width:${100*n/max}%"></i>`).join('')}</div><small>${counts.map((n,j)=>rows[j].subject+' '+n+'건').join(' · ')}</small></div>`).join('');
  notes.push('막대는 각 날짜를 고른 횟수다. 복수 선택 문항에서는 한 사람이 여러 날짜에 포함된다.');
 }else if(topic==='체육 수업 시수' && rows.some(r=>r.title.includes('확대 여부'))){
  visual=rows.filter(r=>r.title.includes('확대 여부')).map(r=>{
   const follow=rows.find(q=>q.subject===r.subject && !q.title.includes('확대 여부'));
   const yes=[...r.tally].find(([label])=>label==='늘릴 필요가 있다');
   const pe=follow?.tally.get('체육');
   if(yes && pe!==undefined)notes.push(`${r.subject} 중 확대를 희망한 사람은 ${yes[1]}명이며, 후속 문항에서 체육을 선택한 사람은 ${pe}명이다.`);
   return `<div class="tree"><b>${r.subject} ${r.total}명</b><div>${[...r.tally].map(([l,n])=>`<span>${escape(l)} <strong>${n}명</strong>${yes?.[0]===l && pe!==undefined?`<em>후속 문항 · 체육 ${pe}명</em>`:''}</span>`).join('')}</div></div>`;
  }).join('');
 }else if(topic==='학생자치' && rows.every(r=>r.item.responseType==='likert_5')){
  visual=rows.map(r=>{
   const positive=(r.tally.get('매우 그렇다')??0)+(r.tally.get('그렇다')??0);
   const negative=(r.tally.get('그렇지 않다')??0)+(r.tally.get('전혀 그렇지 않다')??0);
   const neutral=r.tally.get('보통이다')??0;
   notes.push(`${r.subject} ${r.total}명 중 ${positive}명(${percent(positive,r.total)}%)이 학교가 학생 의견을 반영한다고 답했다. 학생이 낸 제안을 학급에 어떻게 회신하고 있는지 함께 살펴볼 수 있다.`);
   return stack(r,[['긍정',positive],['보통',neutral],['부정',negative]]);
  }).join('');
 }else if(topic==='교원 연수' || topic==='진로체험'){
  visual=rows.map(r=>`<h3>${r.subject} · 응답 ${r.total}명</h3>${ranked(r).slice(0,3).map(([l,n])=>`<div class="bar"><b>${escape(l)}</b><div class="track"><i class="c0" style="width:${percent(n,r.total)}%"></i></div><small>${n}명 · ${percent(n,r.total)}%</small></div>`).join('')}`).join('');
 }else if(topic==='체험학습' && rows.every(r=>r.item.responseType==='choice_single')){
  const labels=[...new Set(rows.flatMap(r=>[...r.tally.keys()]))];
  visual=rows.map(r=>stack(r,labels.map(l=>[l,r.tally.get(l)??0]))).join('');
 }else{
  const labels=[...new Set(rows.flatMap(r=>[...r.tally.keys()]))];
  visual=`<table class="heat"><thead><tr><th>보기</th>${rows.map(r=>`<th>${r.subject}<small>${r.total}명</small></th>`).join('')}</tr></thead><tbody>${labels.map(l=>`<tr><th>${escape(l)}</th>${rows.map(r=>{const n=r.tally.get(l);return n===undefined?'<td>—</td>':`<td style="background:rgba(102,83,156,${n/r.total*.55})">${n}명 <small>${percent(n,r.total)}%</small></td>`}).join('')}</tr>`).join('')}</tbody></table>`;
 }
 if(!notes.length)for(const r of rows){
  const sorted=ranked(r), n=sorted[0][1];
  const top=sorted.filter(v=>v[1]===n).map(v=>v[0]).join(' · ');
  notes.push(`${r.subject} 응답에서 가장 많이 선택한 보기는 ‘${top}’(${n}명, ${percent(n,r.total)}%)였다.`);
 }
 if(topic==='동아리 운영'){
  const r=rows.find(r=>r.item.audience==='student' && /4\s*[~·~～]\s*5학년/.test(r.title));
  if(r && grades.size){const n=[...grades].reduce((s,[l,v])=>s+(/^[45]학년$/.test(l)?v:0),0);
   if(n && r.total>n){
    visual=`<div class="pair"><div><strong>${n}명</strong>4·5학년 응답자</div><div><strong>${r.total}명</strong>동아리 문항 응답자</div></div>`+visual;
    notes.push(`4·5학년 응답자는 ${n}명인데 이 문항에는 ${r.total}명이 답했다. 대상 학년의 희망은 학년별 응답에서 따로 확인해야 한다.`);}}
 }
 const discussion:Record<string,string>={
  '체험학습':'올해 체험의 교육 효과와 내년에 희망하는 장소는 따로 읽어야 한다. 학년별 교과 내용에 맞춰 현장에서 관찰할 활동과 교내에서 운영할 활동을 나누어 논의할 수 있다.',
  '학부모 공개수업':'만족도 문항만으로 다른 시기의 참여율을 알기는 어렵다. 운영 시기를 정할 때에는 학부모가 참석하기 쉬운 시간과 학년별 수업 준비 일정을 함께 살펴야 한다.',
  '학급임원':'임원 수를 정할 때 학생들이 맡고 싶은 역할과 후보가 적은 학급의 선출 방법을 함께 논의할 수 있다.',
  '특색교육':'학교가 중점을 둘 분야를 묻는 질문과 학생이 더 배우고 싶은 분야를 묻는 질문은 관점이 다르다. 중점 주제와 학생이 참여할 활동 방식을 나누어 살펴볼 수 있다.',
  '진로체험':'각 집단의 선택 수와 보기 구성이 다를 수 있다. 선호도가 높은 체험을 고른 뒤 학생이 자신의 흥미와 강점을 돌아볼 시간을 어떻게 마련할지 논의할 수 있다.'
 };
 if(discussion[topic])notes.push(discussion[topic]);
 return `<figure>${visual}</figure><p>${escape(notes.join(' '))}</p>`;
}

export function buildIssueView(items:SelectedQuestion[],answers:(id:string)=>string[],grades:Map<string,number>){
 const groups=new Map<string,Row[]>();
 for(const item of items){
  const title=item.editedQuestion||item.originalQuestion;
  const topic=topics.find(([,pattern])=>pattern.test(title))?.[0];
  if(!topic || !['likert_5','choice_single','checklist','yes_no','likert_3'].includes(item.responseType))continue;
  const values=answers(item.id);if(!values.length)continue;
  const label=(value:string)=>optionLabel(topic,value);
  const tally=new Map<string,number>((item.choices??[]).map(c=>[label(c),0]));
  for(const v of values)for(const l of new Set((item.responseType==='checklist'?splitChecklistAnswer(v,item.choices):[v]).map(label)))tally.set(l,(tally.get(l)??0)+1);
  const list=groups.get(topic)??[];list.push({item,title,subject:AUDIENCE_SHORT_LABELS[item.audience],total:values.length,tally});groups.set(topic,list);
 }
 const entries=topics.filter(([name])=>groups.has(name));
 if(!entries.length)return '';
 const panels=entries.map(([name],i)=>{
  const rows=groups.get(name)!;
  return `<article data-issue="${i}" ${i?'hidden':''}><h2>${name}</h2>${chart(rows,name,grades)}<details><summary>근거 문항 ${rows.length}개</summary>${rows.map(r=>`<p>${r.subject} · ${escape(r.title)} · 응답 ${r.total}명</p>`).join('')}</details></article>`;
 }).join('');
 return `<div id="issue-view"><div class="wrap"><aside>${entries.map(([n],i)=>`<button data-pick="${i}">${n}</button>`).join('')}</aside><label class="mobile">안건 선택 <select>${entries.map(([n],i)=>`<option value="${i}">${n}</option>`).join('')}</select></label><div class="content">${panels}</div></div></div>`;
}
