/** 관리자 등록 없이 학교별 양식 첨부→집계→내보내기→재열기 검증. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url); require('./load-ts.cjs');
const ExcelJS=require('exceljs'); const {AREAS}=require('../src/lib/evaluationFramework.ts');
const base=process.env.BASE_URL??'http://127.0.0.1:3001';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('로컬 검증 전용');

let cookie='',passed=0;
const check=(v,label)=>{assert.ok(v,label);console.log('[PASS] '+label);passed++};
async function req(path,method='GET',body){const r=await fetch(base+path,{method,headers:{cookie,...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});const cs=r.headers.getSetCookie();if(cs.length)cookie=cs.map(s=>s.split(';')[0]).join('; ');return r;}
async function data(path,method,body){const r=await req(path,method,body);const b=await r.json();assert.ok(b.ok,JSON.stringify(b));return b.data;}
const template=readFileSync('.verify-indicator-template.xlsx');
function templateForm(buffer=template,name='synthetic-2026.xlsx'){const f=new FormData();f.set('file',new Blob([buffer]),name);return f;}
const schoolName='xlsx-review-'+Date.now();await data('/api/auth/register','POST',{schoolName,password:'XlsxReview2026!'});
const items=['teacher','parent','student'].flatMap(a=>AREAS.map((area,i)=>({id:a+i,sourceQuestionId:a+i,groupId:a+i,audience:a,sourceRow:0,area:area.name,subarea:area.subareas[0],indicator:i===0?'학교 비전 공유 및 실현':'자율 지표',originalQuestion:a+i,editedQuestion:a+i,responseType:'likert_5',order:i+1})));
items.push({...items[0],id:'extra',groupId:'extra',indicator:'자율 추가 지표',originalQuestion:'추가 문항',editedQuestion:'추가 문항',order:4});
await data('/api/draft/items','POST',{items});let b=await data('/api/draft');await data('/api/draft/meta','PATCH',{expectedRev:b.draft.rev,patch:{mode:'annual'}});
const ids=[];
for(const a of ['teacher','parent','student']){const mine=items.filter(i=>i.audience===a);const csv=mine.map(i=>i.editedQuestion).join(',')+'\n'+mine.map(()=>a==='parent'?'보통이다':'매우 그렇다').join(',')+'\n'+mine.map(()=>'그렇다').join(',')+'\n';const f=new FormData();f.set('audience',a);f.set('file',new Blob([csv]),'synthetic.csv');ids.push((await data('/api/results/upload','POST',f)).uploadId);}
let r=(await data('/api/results/aggregate','POST',{uploadIds:[ids[0]]})).result;
check((await req('/api/export/indicator-xlsx?resultId='+r.id,'POST',templateForm())).status===400,'대상·영역이 빠진 XLSX 제출 차단');
r=(await data('/api/results/aggregate','POST',{uploadIds:ids})).result;
check((await req('/api/export/indicator-xlsx?resultId='+r.id,'POST',templateForm(Buffer.from('invalid'),'broken.xlsx'))).status===400,'깨진 파일 거부');
check((await req('/api/export/indicator-xlsx?resultId='+r.id,'POST',templateForm(Buffer.alloc(600001)))).status===400,'용량 초과 거부');
const out=await req('/api/export/indicator-xlsx?resultId='+r.id,'POST',templateForm());check(out.status===200,'완전한 집계의 XLSX 생성');
const wb=new ExcelJS.Workbook();await wb.xlsx.load(Buffer.from(await out.arrayBuffer()));const ws=wb.getWorksheet('학교평가');
check(ws.getCell('M3').value===schoolName,'학교명');
check(ws.getCell('I6').value===1,'교원 문항 수');
check(ws.getCell('M6').value==='매우 우수','교원 등급');
check(ws.getCell('N6').value==='우수','학부모 등급');
check(ws.getCell('I10').value===1,'자율 지표 기타 행 합산');
check(ws.getCell('I12').value===null,'작년 값 제거');
check(ws.getCell('I11').value.formula==='SUM(I6:I10)','잠긴 합계 수식 보존');
check(ws.getCell('I4').isMerged,'병합 구조 보존');
console.log(`완료: ${passed}개 통과`);
