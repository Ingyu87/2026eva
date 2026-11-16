import JSZip from 'jszip';
import template from './hwpxReportTemplate.json';
import { AREAS } from './evaluationFramework';
import type { Audience, SelectedQuestion, SurveyDraft, SurveyResult } from './types';

const esc=(s:string)=>s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const rows=(s:string)=>s.match(/<hp:tr>.*?<\/hp:tr>/gs)??[];
const cells=(s:string)=>s.match(/<hp:tc\b.*?<\/hp:tc>/gs)??[];
// Only the six known, non-nested tables in the supplied official template are edited.
function fillCell(cell:string,value:string,row?:number,col?:number,span=1):string {
 const p=cell.match(/<hp:p\b.*?<\/hp:p>/s)?.[0];
 if(!p)throw new Error('교육청 양식의 문단을 찾을 수 없습니다.');
 const run=p.match(/<hp:run\b[^>]*>/)?.[0].replace(/\/>$/, '>');
 if(!run)throw new Error('교육청 양식의 글자 서식을 찾을 수 없습니다.');
 const para=p.match(/<hp:p\b[^>]*>/)![0];
 const content=value.split(/\r?\n/).map(line=>`${para}${run}<hp:t>${esc(line)}</hp:t></hp:run></hp:p>`).join('');
 let out=cell.replace(/(<hp:subList\b[^>]*>).*?(<\/hp:subList>)/s,(_m,a,b)=>a+content+b);
 if(row!==undefined)out=out.replace(/rowAddr="\d+"/,`rowAddr="${row}"`);
 if(col!==undefined)out=out.replace(/colAddr="\d+"/,`colAddr="${col}"`);
 return out.replace(/rowSpan="\d+"/,`rowSpan="${span}"`);
}
function tableRows(table:string,body:string[]):string {
 let first=true;
 return table.replace(/rowCnt="\d+"/,`rowCnt="${body.length}"`).replace(/<hp:tr>.*?<\/hp:tr>/gs,()=>{if(!first)return '';first=false;return body.join('');});
}
const subjects:Audience[]=['student','parent','teacher','staff'];

/** 2026 교육청 원본 HWP에서 변환한 빈 HWPX에 값과 허용된 추가 행만 입력합니다. */
export async function buildReportHwpx(draft:SurveyDraft,items:SelectedQuestion[],result:SurveyResult):Promise<Buffer>{
 const zip=new JSZip();for(const [name,b64] of Object.entries(template))zip.file(name,Buffer.from(b64,'base64'));
 let xml=await zip.file('Contents/section0.xml')!.async('string');
 xml=xml.replaceAll('○○○학교',esc(draft.schoolName));
 const tables=xml.match(/<hp:tbl\b.*?<\/hp:tbl>/gs)??[];
 if(tables.length!==6)throw new Error('교육청 양식의 표 구성이 다릅니다.');
 let areaTable=tables[1];
 const ar=rows(areaTable);
 for(let ri=2;ri<5;ri++){
  const cc=cells(ar[ri]);
  const updated=cc.map((c,ci)=>{
   if(ci===0)return c;
   const a=subjects[Math.floor((ci-1)/4)],grade=['매우 우수','우수','보통','미흡'][(ci-1)%4];
   const stat=result.areaStats.find(s=>s.area===AREAS[ri-2].name&&s.audience===a);
   return fillCell(c,stat&&stat.subtotal.some(n=>n>0)&&stat.grade4===grade?'✔':'');
  });ar[ri]='<hp:tr>'+updated.join('')+'</hp:tr>';
 }
 areaTable=tableRows(areaTable,ar);
 const findings=result.aiAnalysis?.areas.flatMap(a=>a.findings)??[];
 const fr=rows(tables[2]),body:string[]=[fr[0]!];const seed=cells(fr[1]);let row=1;
 for(const category of ['우수한 점','개선할 점']){
  const ff=findings.filter(f=>f.category===category);const values=ff.length?ff.map(f=>[category,f.subarea,f.indicator,[f.content,f.cause,f.action].filter(Boolean).join('\n')]):[[category,'','','']];
  values.forEach((v,i)=>{body.push('<hp:tr>'+seed.map((c,j)=>j===0&&i>0?'':fillCell(c,v[j],row,j,j===0?values.length:1)).join('')+'</hp:tr>');row++;});
 }
 const consult=(result.aiAnalysis?.consultingNeeds??[]).map(f=>[f.subarea,f.indicator,f.content,f.cause,f.action].filter(Boolean).join('\n')).join('\n\n');
 body.push('<hp:tr>'+cells(fr[fr.length-1]).map((c,i)=>fillCell(c,i===0?'컨설팅장학 등 교육청 지원이 필요한 부분':consult,row,i)).join('')+'</hp:tr>');
 const findingsTable=tableRows(tables[2],body);
 const cr=rows(tables[3]),cases=result.aiAnalysis?.featuredCases??[],caseSeed=cells(cr[1]);
 const casesTable=tableRows(tables[3],[cr[0]!,...(cases.length?cases:[{subarea:'',content:''}]).map((c,i)=>'<hp:tr>'+caseSeed.map((cell,j)=>fillCell(cell,j===0?c.subarea:c.content,i+1,j)).join('')+'</hp:tr>')]);
 const qr=rows(tables[5]),qseed=cells(qr[2]);
 type Group={area:string;subarea:string;indicator:string;text:string;audiences:Set<Audience>};
 const groups=new Map<string,Group>();
 for(const q of items.filter(q=>!q.deleted).sort((a,b)=>a.order-b.order)){
  if(!AREAS.some(a=>a.name===q.area&&a.subareas.includes(q.subarea)))continue;
  const text=q.editedQuestion||q.originalQuestion;
  const key=JSON.stringify([q.area,q.subarea,q.indicator,text]);
  if(!groups.has(key))groups.set(key,{area:q.area,subarea:q.subarea,indicator:q.indicator,text,audiences:new Set()});
  groups.get(key)!.audiences.add(q.audience);
 }
 const ordered=AREAS.flatMap(area=>area.subareas.flatMap(subarea=>{const gs=[...groups.values()].filter(g=>g.area===area.name&&g.subarea===subarea);return gs.length?gs:[{area:area.name,subarea,indicator:'',text:'',audiences:new Set<Audience>()}];}));
 const qbody=ordered.map((g,i)=>{
  const firstArea=i===0||ordered[i-1].area!==g.area,firstSub=i===0||ordered[i-1].subarea!==g.subarea;
  const vals=[g.area,g.subarea,g.indicator,g.text,...subjects.map(a=>g.audiences.has(a)?'○':'')];
  return '<hp:tr>'+qseed.map((c,j)=>{
   if(j===0&&!firstArea||j===1&&!firstSub)return '';
   const span=j===0?ordered.filter(x=>x.area===g.area).length:j===1?ordered.filter(x=>x.subarea===g.subarea&&x.area===g.area).length:1;
   return fillCell(c,vals[j],i+2,j,span);
  }).join('')+'</hp:tr>';
 });
 const questionTable=tableRows(tables[5],[qr[0]!,qr[1]!,...qbody]);
 const replacements=[tables[0],areaTable,findingsTable,casesTable,tables[4],questionTable];let ti=0;
 xml=xml.replace(/<hp:tbl\b.*?<\/hp:tbl>/gs,()=>replacements[ti++]);
 // Cached line coordinates belong to the blank template, not the filled paragraphs.
 xml=xml.replace(/<hp:linesegarray>.*?<\/hp:linesegarray>/gs,'');
 let id=0;xml=xml.replace(/<hp:p id="[^"]*"/g,()=>`<hp:p id="${++id}"`);
 zip.file('Contents/section0.xml',xml);zip.remove('Preview/PrvImage.png');zip.file('Preview/PrvText.txt',`${draft.schoolName} 2026학년도 학교평가서`);
 zip.file('mimetype','application/hwp+zip',{compression:'STORE'});
 return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
