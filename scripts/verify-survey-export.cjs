require('./load-ts.cjs');
const assert = require('node:assert/strict');
const Module = require('node:module');
const JSZip = require('jszip');
const {buildSurveyDocx, docxFileName} = require('../src/lib/docxExport.ts');
const {buildSurveyHwpx, hwpxFileName} = require('../src/lib/hwpxExport.ts');
const {fetchSurveyDownload} = require('../src/lib/downloadSurvey.ts');
const draft = {title:'검증 설문',schoolName:'예시학교',surveyDate:'2026-11-16',introByAudience:{teacher:'첫 줄\r\n둘째 줄\n셋째 줄',student:'학생 안내'}};
const items = [
 {id:'a',audience:'teacher',order:2,responseType:'checklist',editedQuestion:'최대 2개를 고르세요.',choices:['선택 하나','선택 둘','선택 셋']},
 {id:'b',audience:'student',order:1,responseType:'likert_5',editedQuestion:'학생 문항'},
 {id:'c',audience:'teacher',order:1,responseType:'likert_5',editedQuestion:'교원 문항'},
 {id:'d',audience:'parent',order:1,responseType:'text',editedQuestion:'삭제 문항',deleted:true}
];
let session={status:401},reads=0,failRead=false;
const load=Module._load;
Module._load=function(id,parent,main){
 if(id==='@/lib/api')return {requireSchoolSession:async()=>session,jsonError:(error,status)=>Response.json({ok:false,error},{status})};
 if(id==='@/lib/store')return {getDraftBundle:async(schoolId)=>{reads++;assert.equal(schoolId,'example');if(failRead)throw Error('private infrastructure detail');return {draft,items};}};
 if(id.startsWith('@/lib/'))return require('../src/lib/'+id.slice(6)+'.ts');
 return load.call(this,id,parent,main);
};
(async()=>{
 const doc=await JSZip.loadAsync(await buildSurveyDocx(draft,items));
 const xml=await doc.file('word/document.xml').async('string');
 assert.ok(xml.includes('<w:br/>'));
 assert.ok(xml.includes('둘째 줄'));
 assert.ok(xml.includes('<w:pageBreakBefore/>'));
 assert.ok(xml.indexOf('교원 문항') < xml.indexOf('최대 2개'));
 assert.ok(!xml.includes('모두 고르세요'));
 assert.ok(!xml.includes('삭제 문항'));
 assert.ok(xml.includes('w:tblHeader'));
 assert.ok(xml.includes('w:cantSplit'));
 console.log('[PASS] DOCX 줄바꿈·대상별 새 쪽·문항 순서·선택 개수 보존·삭제 제외·표 머리글과 행 유지');
 for(const format of ['docx','hwpx']){
   const {GET}=require('../app/api/export/'+format+'/route.ts');
   session={status:401};const before=reads;
   assert.equal((await GET()).status,401);assert.equal(reads,before);
   session={schoolId:'example',schoolName:'예시학교'};
   const request=audience=>new Request('https://example.test/api/export/'+format+'?audience='+audience);
   assert.equal((await GET(request('unknown'))).status,400);assert.equal(reads,before);
   for(const audience of ['all','teacher','student']){
     const response=await GET(request(audience));assert.equal(response.status,200);
     assert.equal(response.headers.get('Cache-Control'),'private, no-store');
     if(audience==='teacher')assert.ok(decodeURIComponent(response.headers.get('Content-Disposition')).includes('교원용'));
     const zip=await JSZip.loadAsync(await response.arrayBuffer());
     const contents=await zip.file(format==='docx'?'word/document.xml':'Contents/section0.xml').async('string');
     assert.equal(contents.includes('교원 문항'),audience!=='student');
     assert.equal(contents.includes('학생 문항'),audience!=='teacher');
     assert.ok(!contents.includes('삭제 문항'));
   }
   for(const audience of ['parent','staff'])assert.equal((await GET(request(audience))).status,400);
   assert.equal((await GET()).status,200);
   failRead=true;const failed=await GET();assert.equal(failed.status,500);
   assert.ok(!(await failed.text()).includes('private infrastructure'));failRead=false;
 }
 console.log('[PASS] 두 형식의 대상 선택·빈 대상/잘못된 대상 차단·인증·학교 격리·캐시 방지·조회 실패 안내');
 const originalFetch=global.fetch;
 try {
   const signal=new AbortController().signal;
   global.fetch=async()=>Response.json({error:'로그인 필요'},{status:401});
   await assert.rejects(()=>fetchSurveyDownload('hwpx','teacher',signal),/로그인이 만료/);
   global.fetch=async()=>new Response('gateway failure',{status:502});
   await assert.rejects(()=>fetchSurveyDownload('hwpx','teacher',signal),/파일을 받지 못/);
   global.fetch=async()=>new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}});
   await assert.rejects(()=>fetchSurveyDownload('hwpx','teacher',signal),/정상적인/);
   global.fetch=async()=>new Response('',{headers:{'Content-Type':'application/hwp+zip'}});
   await assert.rejects(()=>fetchSurveyDownload('hwpx','teacher',signal),/비어/);
   global.fetch=async(url,options)=>{
     assert.equal(url,'/api/export/hwpx?audience=teacher');assert.equal(options.signal,signal);
     return new Response(await buildSurveyHwpx(draft,items),{headers:{'Content-Type':'application/hwp+zip','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent('검증_교원용.hwpx')}});
   };
   const downloaded=await fetchSurveyDownload('hwpx','teacher',signal);
   assert.equal(downloaded.fileName,'검증_교원용.hwpx');assert.ok(downloaded.blob.size>0);
 }finally{global.fetch=originalFetch;}
 console.log('[PASS] 다운로드 로그인 만료·서버 오류·HTML/빈 파일 거부·파일명·취소 신호');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._load=load;});
