require('./load-ts.cjs');
const assert=require('node:assert/strict');
const {isTimestampColumn}=require('../src/lib/resultMetadata.ts');
const {matchColumns}=require('../src/lib/resultsMatching.ts');
const {aggregateResultUploads}=require('../src/lib/resultsAggregate.ts');
const {AREAS}=require('../src/lib/evaluationFramework.ts');
const {parseResultFile}=require('../src/lib/resultsFile.ts');
(async()=>{
for(const name of ['타임스탬프',' Timestamp ','\uFEFFTIMESTAMP'])assert(isTimestampColumn(name));
for(const name of ['타임스탬프를 알고 있나요?','응답 시간에 만족합니까?','학생 학년'])assert(!isTimestampColumn(name));
const item={id:'q',audience:'parent',area:AREAS[0].name,subarea:AREAS[0].subareas[0],responseType:'likert_5',originalQuestion:'평가 문항'};
const parsed=await parseResultFile(Buffer.from('\uFEFF타임스탬프,평가 문항\n2026/11/16 09:00,매우 그렇다\n2026/11/16 10:00,그렇다'),'example.csv');
const columns=matchColumns(parsed.headers,[item]);
assert.equal(columns[0].match.status,'excluded');assert.equal(columns[1].match.questionId,'q');
const upload={id:'u',audience:'parent',...parsed,mapping:[{column:'타임스탬프',questionId:'wrong',isGrade:true},{column:'평가 문항',questionId:'q'}]};
const aggregate=aggregateResultUploads([upload],[item,{...item,id:'wrong'}]);
assert.equal(aggregate.questionStats.length,1);assert.equal(aggregate.questionStats[0].mean,4.5);assert.equal(aggregate.questionStats[0].responseCount,2);assert.equal(aggregate.responsesByAudience.parent,2);
const Module=require('node:module'),path=require('node:path'),load=Module._load;let saved;
Module._load=function(id,parent,main){
if(id==='@/lib/api')return {jsonOk:data=>Response.json({data}),jsonError:(error,status=400)=>Response.json({error},{status})};
if(id==='@/lib/draftApi')return {resolveDraftContext:async()=>({draftId:'d',schoolId:'s'}),draftWriteError:()=>{throw Error('unexpected')}};
if(id==='@/lib/store')return {getResultUpload:async()=>upload,getDraftBundle:async()=>({items:[item]}),updateResultUploadMapping:async(d,u,m)=>{saved=m;return {...upload,mapping:m}},listResultUploads:async()=>[upload],listSurveyResults:async()=>[],NotFoundError:class extends Error{}};
if(id.startsWith('@/lib/'))return load.call(this,path.resolve(__dirname,'../src/lib',id.slice(6)+'.ts'),main);
return load.call(this,id,parent,main);
};
try{
const {POST}=require('../app/api/results/map/route.ts');const response=await POST(new Request('https://local/api/results/map',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uploadId:'u',mapping:upload.mapping})}));assert.equal(response.status,200);assert.deepEqual(saved[0],{column:'타임스탬프'});assert.equal(saved[1].questionId,'q');
const {GET}=require('../app/api/results/route.ts');const restored=(await (await GET()).json()).data.uploads[0].columns;assert.deepEqual(restored[0],{column:'타임스탬프',status:'excluded'});assert.equal(restored[1].questionId,'q');
}finally{Module._load=load;}
console.log('[PASS] CSV 타임스탬프 자동 제외·일반 질문 유지·열 정렬과 응답 수 보존·잘못된 연결 무시·기존 업로드 복원');
})().catch(e=>{console.error(e);process.exitCode=1});
