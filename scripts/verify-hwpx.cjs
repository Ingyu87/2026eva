require('./load-ts.cjs');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const Module = require('node:module');
const { buildSurveyHwpx, hwpxFileName } = require('../src/lib/hwpxExport.ts');
const { LIKERT_5_OPTIONS } = require('../src/lib/types.ts');
const draft = { title: '설문 <검증> & 확인', schoolName: '검증학교', surveyDate: '2026-11-16', introByAudience: {teacher:'첫 줄\n둘째 줄', student:'학생 안내'} };
const types = ['likert_5','choice_single','checklist','text','likert_3','yes_no'];
const items = types.map((responseType, index) => ({id:String(index),audience:'teacher',order:index+0.25,responseType,originalQuestion:'이전 문항',editedQuestion:`검증 문항 ${index} <>&"'`,choices:['선택 A & B','선택 <C>'],updatedBy:'내부 수정자',indicator:'내부 지표'}));
items.push({...items[0],id:'student',audience:'student',editedQuestion:'학생 문항'});
items.push({...items[0],id:'deleted',deleted:true,editedQuestion:'삭제된 문항'});
function decode(s) {return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');}
(async()=>{
 const buffer=await buildSurveyHwpx(draft,items);
 assert.equal(buffer.readUInt32LE(0),0x04034b50);
 assert.equal(buffer.readUInt16LE(8),0);
 assert.equal(buffer.subarray(30,38).toString(),'mimetype');
 const zip=await JSZip.loadAsync(buffer);
 assert.equal(await zip.file('mimetype').async('string'),'application/hwp+zip');
 const xml=await zip.file('Contents/section0.xml').async('string');
 const text=decode([...xml.matchAll(/<hp:t>([\s\S]*?)<\/hp:t>/g)].map(m=>m[1]).join('\n'));
 for(const item of items.filter(i=>!i.deleted)) assert.ok(text.includes(item.editedQuestion));
 for(const option of LIKERT_5_OPTIONS) assert.ok(text.includes(option));
 for(const excluded of ['내부 수정자','내부 지표','삭제된 문항','이전 문항']) assert.ok(!text.includes(excluded));
 assert.ok(text.includes('첫 줄\n둘째 줄'));
 assert.ok(text.includes('□ 선택 A & B'));
 assert.ok(text.includes('○ 선택 <C>'));
 assert.ok(xml.includes('pageBreak="1"'));
 assert.ok(xml.includes('pageBreak="TABLE" repeatHeader="1"'));
 assert.ok(!xml.includes('<검증>'));
 const ids=[...xml.matchAll(/<hp:p id="(\d+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(hwpxFileName(draft).endsWith('.hwpx'));
 const empty=await JSZip.loadAsync(await buildSurveyHwpx(draft,[]));
 assert.ok((await empty.file('Contents/section0.xml').async('string')).includes('선택된 문항이 없습니다.'));
 console.log('[PASS] HWPX 패키지·6종 응답·줄바꿈·문항 순서·삭제 제외·XML 이스케이프·내부 정보 제외');
 let session={status:401}; let reads=0;
 const load=Module._load;
 Module._load=function(id,parent,main){
   if(id==='@/lib/api')return {requireSchoolSession:async()=>session};
   if(id==='@/lib/store')return {getDraftBundle:async(schoolId)=>{assert.equal(schoolId,'test-school');reads++;return {draft,items};}};
   if(id==='@/lib/hwpxExport')return {buildSurveyHwpx,hwpxFileName};
   return load.call(this,id,parent,main);
 };
 try {
   const {GET}=require('../app/api/export/hwpx/route.ts');
   assert.equal((await GET()).status,401);assert.equal(reads,0);
   session={schoolId:'test-school',schoolName:'검증학교'};
   const response=await GET();assert.equal(response.status,200);
   assert.equal(response.headers.get('Content-Type'),'application/hwp+zip');
   assert.equal(response.headers.get('Cache-Control'),'private, no-store');
   await JSZip.loadAsync(await response.arrayBuffer());
   assert.equal(reads,1);
 } finally {Module._load=load;}
 console.log('[PASS] 인증 없는 다운로드 차단·인증된 학교의 저장본 조회·다운로드 응답');
})().catch(e=>{console.error(e);process.exitCode=1;});
