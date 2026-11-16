require('./load-ts.cjs');
const assert=require('node:assert/strict'),JSZip=require('jszip');
const {buildReportHwpx}=require('../src/lib/reportHwpx.ts');
const {buildResultReportHtml}=require('../src/lib/resultReportHtml.ts');
const {AREAS}=require('../src/lib/evaluationFramework.ts');
const {splitChecklistAnswer}=require('../src/lib/checklistAnswers.ts');
const {canExport}=require('../src/lib/exportGate.ts');
(async()=>{
 const draft={schoolName:'검증학교 <&>',mode:'annual'};
 const items=[{id:'q',order:1,audience:'parent',area:AREAS[0].name,subarea:AREAS[0].subareas[0],indicator:'지표',originalQuestion:'문항 <script>alert(1)</script>',responseType:'likert_5'},{id:'c',order:2,audience:'parent',area:AREAS[0].name,subarea:AREAS[0].subareas[0],indicator:'선택',originalQuestion:'선택 문항',responseType:'checklist',choices:['A','B']},{id:'t',order:3,audience:'parent',area:AREAS[0].name,subarea:AREAS[0].subareas[0],indicator:'의견',originalQuestion:'의견 문항',responseType:'text'}];
 const result={responsesByAudience:{parent:2},questionStats:[{questionId:'q',audience:'parent',distribution:[1,1,0,0,0],responseCount:2,mean:4.5}],areaStats:[{area:AREAS[0].name,audience:'parent',subtotal:[1,1,0,0,0],mean:4.5,grade4:'매우 우수'}]};
 const upload={audience:'parent',headers:['메모','의견','선택'],mapping:[{column:'선택',questionId:'c'},{column:'의견',questionId:'t'}],rows:[['숨김','개인 비공개 독서 의견','A, B'],['','','']]};
 const html=buildResultReportHtml(draft,items,result,[upload]);assert(html.includes('100%'));assert(!html.includes('개인 비공개'));assert(!html.includes('<script>alert'));assert(html.includes('&lt;script&gt;'));assert(html.includes('자료 없음'));assert(!html.includes('<footer'));
 const zip=await JSZip.loadAsync(await buildReportHwpx(draft,items,result));const xml=await zip.file('Contents/section0.xml').async('string');assert(xml.includes('검증학교 &lt;&amp;&gt;'));assert(xml.includes('&lt;script&gt;'));assert.equal((xml.match(/✔/g)||[]).length,2); // template instruction and one result
 for(const q of items)assert(xml.includes(q.originalQuestion.replace(/</g,'&lt;').replace(/>/g,'&gt;')));
 assert.equal((xml.match(/<hp:tbl\b/g)||[]).length,6);
 assert(!/<hp:run[^>]*\/><hp:t>/.test(xml));
 assert(!html.includes('숨김'));assert(html.includes('독서·도서관'));
 assert.deepEqual(splitChecklistAnswer('국어, 수학, 예술',['국어, 수학','예술']),['국어, 수학','예술']);
 assert.deepEqual(splitChecklistAnswer('A; B',['A','B']),['A','B']);
 const ids=[...xml.matchAll(/<hp:p id="([^"]+)"/g)].map(m=>m[1]); assert.equal(ids.length,new Set(ids).size);
 for(const table of xml.match(/<hp:tbl\b.*?<\/hp:tbl>/gs)) {
   const rowCount=Number(table.match(/rowCnt="(\d+)"/)[1]);
   assert.equal(rowCount,(table.match(/<hp:tr>/g)||[]).length);
   for(const cell of table.match(/<hp:tc\b.*?<\/hp:tc>/gs)) {
     const row=Number(cell.match(/rowAddr="(\d+)"/)[1]),span=Number(cell.match(/rowSpan="(\d+)"/)[1]);
     assert(row+span<=rowCount);
   }
 }
 assert.equal(canExport('report-hwpx',{mode:'midterm'}).allowed,false);
 assert.equal(canExport('report-hwpx',draft,{mode:'midterm'}).allowed,false);
 const Module=require('node:module'),load=Module._load;
 let session={status:401},reads=0,saved={...result,mode:'annual',itemsSnapshot:items};
 Module._load=function(id,parent,main){
  if(id==='@/lib/api')return {requireSchoolSession:async()=>session,jsonError:(error,status=400)=>Response.json({error},{status})};
  if(id==='@/lib/store')return {getDraftBundle:async(schoolId)=>{assert.equal(schoolId,'school');reads++;return {draft:{...draft,id:'draft'},items:[]}},getSurveyResult:async(draftId)=>{assert.equal(draftId,'draft');return saved}};
  if(id.startsWith('@/lib/'))return load.call(this,require('node:path').resolve(__dirname,'../src/lib',id.slice(6)+'.ts'),main);
  return load.call(this,id,parent,main);
 };
 try {
  const {GET}=require('../app/api/export/report-hwpx/route.ts');
  const req=type=>new Request('https://test.local/api/export/report-hwpx?resultId=result&type='+type);
  assert.equal((await GET(req('draft'))).status,401);assert.equal(reads,0);
  session={schoolId:'school',schoolName:'검증학교'};
  assert.equal((await GET(req('wrong'))).status,400);
  assert.equal((await GET(req('submit'))).status,400);
  let response=await GET(req('draft'));assert.equal(response.status,200);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  const downloaded=await JSZip.loadAsync(await response.arrayBuffer());
  assert((await downloaded.file('Contents/section0.xml').async('string')).includes('선택 문항'));
  saved={...saved,mode:'midterm'};assert.equal((await GET(req('draft'))).status,403);
  saved=null;assert.equal((await GET(req('draft'))).status,404);
 }finally{Module._load=load;}
 console.log('[PASS] HTML 개인정보 제외·빈 응답 분모·XSS, 원본 HWPX 6개 표·문항 보존·학년말 제한');
 console.log('[PASS] HWPX 다운로드 인증·학교 구분·집계 시점 문항·제출 검사·캐시 방지');
})().catch(e=>{console.error(e);process.exitCode=1});
