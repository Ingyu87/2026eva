require('./load-ts.cjs');
const assert=require('node:assert/strict');
const storage=new Map();global.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
const {cachedRecommendations}=require('../src/lib/recommendationCache.ts');
let calls=0,fail=false;
global.fetch=async()=>{calls++; if(fail)throw Error('offline');return {ok:true,json:async()=>({ok:true,data:{items:[{subarea:'test',responseType:'text'}]}})}};
(async()=>{
 const input=[{question:'학교 생활에서 개선할 점은?',responseType:'text'}];
 await Promise.all([cachedRecommendations('a',input),cachedRecommendations('a',input)]);
 assert.equal(calls,1);
 await cachedRecommendations('a',input);assert.equal(calls,1);
 delete require.cache[require.resolve('../src/lib/recommendationCache.ts')];
 await require('../src/lib/recommendationCache.ts').cachedRecommendations('a',input);assert.equal(calls,1);
 await cachedRecommendations('b',input);assert.equal(calls,2);
 await cachedRecommendations('a',[{question:'다른 문항'}]);assert.equal(calls,3);
 fail=true;await assert.rejects(cachedRecommendations('fail',input));fail=false;await cachedRecommendations('fail',input);assert.equal(calls,5);
 console.log('[PASS] 동시 호출 병합·결과 재사용·재접속 복원·학교 및 내용 분리·실패 재시도');
})().catch(e=>{console.error(e);process.exitCode=1});
