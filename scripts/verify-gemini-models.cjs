require('./load-ts.cjs');
const assert = require('node:assert/strict');
const {callGemini, callGeminiWithPdf, resolveGeminiModel} = require('../src/lib/gemini.ts');
process.env.GEMINI_API_KEY = 'test-only';
process.env.GEMINI_MODEL = 'gemini-pro-latest';
for (const key of ['GEMINI_CLASSIFICATION_MODEL','GEMINI_EXTRACTION_MODEL','GEMINI_ANALYSIS_MODEL']) delete process.env[key];
const requests = [];
global.fetch = async (url, options) => {
  requests.push({url, body: JSON.parse(options.body)});
  return {ok:true, json:async()=>({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]})};
};
(async()=>{
  await callGemini('classify',{task:'classification'});
  await callGeminiWithPdf('extract','fake-pdf');
  await callGemini('analyze');
  assert.match(requests[0].url,/gemini-3\.5-flash-lite:/);
  for (const request of requests.slice(1)) assert.match(request.url,/gemini-3\.8-flash:/);
  assert.equal(requests[1].body.contents[0].parts[0].inlineData.mimeType,'application/pdf');
  process.env.GEMINI_CLASSIFICATION_MODEL = ' custom-model ';
  assert.equal(resolveGeminiModel('classification'),'custom-model');
  assert.equal(resolveGeminiModel('analysis'),'gemini-3.8-flash');
  console.log('[PASS] 작업별 모델·기존 Pro 설정 분리·PDF 입력·개별 설정');
})().catch(error=>{console.error(error);process.exitCode=1;});
