require('./load-ts.cjs');
const assert = require('node:assert/strict');
const storage = new Map(); let blocked = false;
global.window = { sessionStorage: {
 getItem:k=>storage.get(k)??null,
 setItem:(k,v)=>{if(blocked)throw Error('quota');storage.set(k,v);},
 removeItem:k=>{if(blocked)throw Error('quota');storage.delete(k);}
}};
const cachePath=require.resolve('../src/lib/priorReviewCache.ts');
let cache=require(cachePath);
const sources=[{id:'pdf-1',name:'가상.pdf',checked:true,items:[{question:'수정한 문항',included:true,choices:['예','아니오']}]}];
cache.writePriorReview('school-A',sources);
delete require.cache[cachePath];cache=require(cachePath);
assert.deepEqual(cache.readPriorReview('school-A'),sources);
assert.equal(cache.readPriorReview('school-B'),null);
blocked=true;assert.equal(cache.writePriorReview('school-A',[{...sources[0],checked:false}]),false);
assert.equal(cache.readPriorReview('school-A')[0].checked,false);
blocked=false;cache.writePriorReview('school-A',[]);
delete require.cache[cachePath];cache=require(cachePath);
assert.equal(cache.readPriorReview('school-A'),null);
console.log('[PASS] 검토 내용 재로딩 복원·학교별 분리·저장 실패 보관·완료 후 삭제');
for(const key of ['FIREBASE_SERVICE_ACCOUNT_JSON','FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY'])delete process.env[key];
process.env.NODE_ENV='test';
const store=require('../src/lib/store.ts');
const {createGoogleFormsByAudienceFromDraft}=require('../src/lib/googleForms.ts');
(async()=>{
 let draft=await store.getOrCreateDraft('recovery-test','가상 복구 학교');
 const items=['teacher','parent'].map((audience,i)=>({id:'q'+i,audience,order:i,editedQuestion:'가상문항'+i,responseType:'text'}));
 let creates=0, fail=true;
 global.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);
  if(!body.requests){creates++;if(fail&&creates===2)return new Response('가상 실패',{status:503});return new Response(JSON.stringify({formId:'f'+creates,responderUri:'https://example.invalid/f'+creates}));}
  return new Response(JSON.stringify({replies:body.requests.map((_,i)=>({createItem:{itemId:'i'+i}}))}));
 };
 const persist=async(a,info)=>{draft=await store.attachGoogleForms(draft.id,{...draft.googleFormsByAudience,[a]:info});};
 await assert.rejects(createGoogleFormsByAudienceFromDraft(draft,items,'fake',persist),/완료된 대상/);
 const saved=(await store.getDraftBundle('recovery-test','가상 복구 학교')).draft;
 assert.equal(Object.keys(saved.googleFormsByAudience).length,1);
 const first=Object.values(saved.googleFormsByAudience)[0].formId;
 fail=false;
 await createGoogleFormsByAudienceFromDraft(saved,items,'fake',persist);
 assert.equal(creates,3);assert.equal(Object.keys(draft.googleFormsByAudience).length,2);
 assert.ok(Object.values(draft.googleFormsByAudience).some(f=>f.formId===first));
 await createGoogleFormsByAudienceFromDraft(draft,items,'fake',persist);assert.equal(creates,3);
 console.log('[PASS] 두 번째 대상 실패 후 첫 폼 저장·재시도 시 실패 대상만 생성·완성본 재사용');
 await createGoogleFormsByAudienceFromDraft(draft,[{...items[0],editedQuestion:'수정된 문항'},items[1]],'fake',persist);
 assert.equal(creates,4);
 console.log('[PASS] 문항이 바뀐 대상은 새 폼 생성, 바뀌지 않은 대상 유지');
})().catch(e=>{console.error(e);process.exitCode=1;});
