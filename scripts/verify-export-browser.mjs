// 실행: BASE_URL=http://127.0.0.1:3101 node scripts/verify-export-browser.mjs
// 모든 /api 요청은 가상 응답으로 대체한다. 실제 학교 저장소에는 접근하지 않는다.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
require('./load-ts.cjs');
const {buildSurveyDocx}=require('../src/lib/docxExport.ts');
const {buildSurveyHwpx}=require('../src/lib/hwpxExport.ts');
const base=process.env.BASE_URL || 'http://127.0.0.1:3101';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'로컬 서버에서만 실행');
const executablePath=process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const out=path.resolve('tmp/upgrade-20261014');mkdirSync(out,{recursive:true});
const draft={id:'export-ui-test',schoolId:'example',schoolName:'예시초등학교',mode:'annual',rev:0,title:'검증 설문',surveyDate:'2026-11-16',introByAudience:{teacher:'첫 줄\n둘째 줄',student:'학생 안내',parent:'',staff:''},studentGrades:[5,6],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
const items=['teacher','student'].map((audience,index)=>({id:audience,audience,order:index,rev:0,sourceQuestionId:'prior-test',area:'Ⅰ. 학교자치 문화',subarea:'Ⅰ-1. 소통과 협력의 학교자치',indicator:'검증',originalQuestion:`${audience} 검증 문항`,editedQuestion:`${audience} 검증 문항`,responseType:'likert_5',updatedAt:draft.updatedAt}));
const browser=await puppeteer.launch({executablePath,headless:true,defaultViewport:{width:1440,height:900}});
const page=await browser.newPage();page.setDefaultTimeout(30000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
let failDraft=true,failExport=true;const exports=[];const mutations=[];
await page.evaluateOnNewDocument(()=>{
 localStorage.setItem('school-eval-display-name','검증 담당');localStorage.setItem('lead-intro:export-ui-test','1');
 sessionStorage.setItem('annual-start:export-ui-test','1');
});
await page.setRequestInterception(true);
page.on('request',async request=>{
 const url=new URL(request.url());
 if(!url.pathname.startsWith('/api/'))return request.continue();
 const respond=(data,status=200)=>request.respond({status,contentType:'application/json',body:JSON.stringify(status===200?{ok:true,data}:{ok:false,error:data})});
 if(request.method()!=='GET' && !['/api/draft/presence','/api/ingest/prior-survey/review'].includes(url.pathname))mutations.push(url.pathname);
 if(url.pathname==='/api/auth/me')return respond({school:{id:'example',schoolName:draft.schoolName,status:'active'},role:'lead'});
 if(url.pathname==='/api/draft')return failDraft?respond('검증용 초안 조회 실패',503):respond({draft,items,since:draft.updatedAt});
 if(url.pathname==='/api/draft/sync')return respond({draft:null,changed:[],deleted:[],presence:[],nextSince:draft.updatedAt});
 if(url.pathname==='/api/invite')return respond({invites:[]});
 if(url.pathname==='/api/draft/presence')return respond({presence:[]});
 if(url.pathname.startsWith('/api/export/')){
   exports.push(url.pathname+url.search);
   if(failExport)return respond('세션 만료',401);
   const format=url.pathname.endsWith('hwpx')?'hwpx':'docx';
   const audience=url.searchParams.get('audience');
   const selected=items.filter(item=>audience==='all'||item.audience===audience);
   return request.respond({status:200,contentType:format==='hwpx'?'application/hwp+zip':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',body:await (format==='hwpx'?buildSurveyHwpx:buildSurveyDocx)(draft,selected),headers:{'Content-Disposition':`attachment; filename*=UTF-8''test-${audience}.${format}`}});
 }
 return respond({results:[],uploads:[]});
});
const click=async(text,scope='button')=>{
 const handles=await page.$$(scope);
 for(const handle of handles)if((await handle.evaluate(e=>e.textContent)).trim()===text){await handle.click();return;}
 throw Error('버튼 없음: '+text);
};
try{
 const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:out});
 await page.goto(base,{waitUntil:'networkidle0'});
 await page.waitForSelector('[role="alert"]');
 assert.match(await page.$eval('[role="alert"]',e=>e.textContent),/초안 조회 실패/);
 failDraft=false;await click('다시 불러오기');await page.waitForSelector('.ws-topbar');
 await click('설문지 (DOCX)');await page.waitForSelector('dialog[open]');
 assert.equal(await page.$eval('dialog select',e=>e.value),'teacher');
 assert.ok(await page.$eval('dialog select',e=>parseFloat(getComputedStyle(e).fontSize)>=20));
 await page.select('dialog select','staff');
 assert.equal(await page.$eval('dialog .ws-btn--primary',e=>e.disabled),true);
 await page.select('dialog select','teacher');await click('다운로드','dialog button');
 await page.waitForSelector('dialog [role="alert"]');
 assert.match(await page.$eval('dialog [role="alert"]',e=>e.textContent),/로그인이 만료/);
 assert.equal(page.url(),base+'/');
 failExport=false;await click('다운로드','dialog button');
 await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('브라우저로 파일을 전달'));
 assert.ok(exports.at(-1).endsWith('audience=teacher'));
 await page.screenshot({path:path.join(out,'download-dialog.png')});
 for(const viewport of [{width:1920,height:1080},{width:1440,height:900}]){
   await page.setViewport(viewport);
   assert.ok(await page.$eval('dialog',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
 }
 await page.keyboard.press('Escape');await page.waitForSelector('dialog',{hidden:true});
 assert.match(await page.evaluate(()=>document.activeElement.textContent),/설문지 \(DOCX\)/);
 await click('한글 (HWPX)');await page.select('dialog select','all');await click('다운로드','dialog button');
 await page.waitForFunction(()=>document.querySelector('dialog').textContent.includes('브라우저로 파일을 전달'));
 assert.ok(exports.at(-1).endsWith('audience=all'));
 await page.keyboard.press('Escape');
 await page.evaluate(()=>localStorage.setItem('school-eval-outbox-export-ui-test',JSON.stringify([{kind:'meta',opId:'pending-test',patch:{surveyDate:'2026-11-17'},rejected:'검증용 저장 대기'}])));
 await page.reload({waitUntil:'networkidle0'});await click('한글 (HWPX)');
 assert.equal(await page.$eval('dialog .ws-btn--primary',e=>e.disabled),true);
 assert.match(await page.$eval('dialog',e=>e.textContent),/저장되지 않은 편집이 1건/);
 assert.deepEqual(mutations,[]);assert.deepEqual(errors,[]);
 console.log('[PASS] 브라우저: 초안 실패/재시도·대상 선택·빈 대상 차단·401 후 화면 유지/재시도·두 형식 다운로드·미저장 차단·Esc·1440/1920 화면 범위');
}finally{await browser.close();}
