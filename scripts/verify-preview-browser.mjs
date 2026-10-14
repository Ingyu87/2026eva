// 전용 로컬 메모리 저장소에서만 실행. 실제 학교 자료와 외부 API를 사용하지 않는다.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
import puppeteer from 'puppeteer-core';
import JSZip from 'jszip';
const base=process.env.BASE_URL||'http://localhost:3102';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert.equal(process.env.PREVIEW_MEMORY_TEST,'1','별도 메모리 저장소 서버를 확인하고 PREVIEW_MEMORY_TEST=1로 실행하세요.');
let cookie='';
async function api(route,method='GET',body){
 const r=await fetch(base+route,{method,headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 if(r.headers.getSetCookie().length)cookie=r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 const payload=await r.json();assert.equal(r.status,200,JSON.stringify(payload));return payload.data;
}
await api('/api/auth/register','POST',{schoolName:'미리보기검증-'+Date.now(),password:'preview-local-only'});
let {draft}=await api('/api/draft');
const types=['likert_5','choice_single','text','likert_3','yes_no','checklist'];
const items=Array.from({length:18},(_,i)=>({id:'preview-'+i,sourceQuestionId:'test',audience:'teacher',sourceRow:i+1,area:'Ⅰ. 협력적 학교자치문화',subarea:'Ⅰ-1. 소통과 협력의 학교자치',indicator:'검증 지표',originalQuestion:`검토용 ${i+1}번 문항입니다.`,editedQuestion:`검토용 ${i+1}번 문항입니다.`,responseType:types[i]||'likert_5',...([1,5].includes(i)?{choices:['첫째 보기','둘째 보기']}:{}),order:i+1}));
await api('/api/draft/items','POST',{items:[...items,{...items[0],id:'parent-1',audience:'parent',editedQuestion:'학부모 검증 문항'}]});
await api('/api/draft/meta','PATCH',{expectedRev:draft.rev,patch:{title:'학교평가 공동 검토 설문',introByAudience:{teacher:'교육 활동에 대한 의견을 들려주세요.\n문항별로 응답해 주세요.',parent:'학부모 안내',student:'',staff:''}}});
const browser=await puppeteer.launch({executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync),headless:true,defaultViewport:{width:1440,height:900}});
mkdirSync('tmp/preview-ui',{recursive:true});
const errors=[];
async function pageFor(name){
 const context=await browser.createBrowserContext();const page=await context.newPage();page.setDefaultTimeout(60000);
 for(const entry of cookie.split('; ')){const split=entry.indexOf('=');await context.setCookie({name:entry.slice(0,split),value:entry.slice(split+1),url:base});}
 await page.evaluateOnNewDocument((id,name)=>{localStorage.setItem('school-eval-display-name',name);localStorage.setItem('lead-intro:'+id,'1');sessionStorage.setItem('annual-start:'+id,'1');},draft.id,name);
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base,{waitUntil:'networkidle0'});return page;
}
async function click(page,text,scope='button'){
 for(const button of await page.$$(scope))if((await button.evaluate(e=>e.textContent)).trim()===text){await button.click();return;}
 throw Error('버튼 없음: '+text);
}
async function fill(page,selector,text){await page.click(selector);await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.sendCharacter(text);}
async function saved(id,text){for(let n=0;n<80;n++){const data=await api('/api/draft');if(data.items.find(i=>i.id===id)?.editedQuestion===text)return;await new Promise(r=>setTimeout(r,200));}throw Error('저장되지 않음');}
try{
 const page=await pageFor('검증 담당 A');await click(page,'설문 미리보기');await page.waitForSelector('.survey-preview-table');
 const peer=await pageFor('검증 담당 B');await click(peer,'설문 미리보기');
 assert.equal(await page.$$eval('.survey-preview-question',els=>els.length),18);
 await page.screenshot({path:'tmp/preview-ui/preview.png'});
 for(const size of [{width:1440,height:900},{width:1920,height:1080}]){
  await page.setViewport(size);
  const bounds=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
  assert.ok(bounds.scrollHeight<=bounds.height&&bounds.scrollWidth<=bounds.width,JSON.stringify(bounds));
 }
 await page.click('[aria-label="1번 문항 수정"]');await fill(page,'.survey-preview-edit textarea','함께 검토하고 수정한 문항입니다.');
 await saved('preview-0','함께 검토하고 수정한 문항입니다.');await click(page,'수정 완료');
 await peer.bringToFront();await peer.waitForFunction(()=>document.querySelector('.survey-preview').textContent.includes('함께 검토하고 수정한 문항입니다.'));
 await page.bringToFront();await click(page,'문항 구성');await page.waitForFunction(()=>document.querySelector('.ws-selected').textContent.includes('함께 검토하고 수정한 문항입니다.'));
 await click(page,'설문 미리보기');
 await page.click('[aria-label="2번 문항 수정"]');await fill(page,'.survey-preview-edit .ws-choice-row input','수정한 보기');
 await click(page,'수정 완료');
 for(let n=0;n<60;n++){const data=await api('/api/draft');if(data.items.find(i=>i.id==='preview-1').choices[0]==='수정한 보기')break;if(n===59)throw Error('보기 저장 실패');await new Promise(r=>setTimeout(r,200));}
 await page.click('[aria-label="2번 문항 수정"]');
 const current=(await api('/api/draft')).items.find(i=>i.id==='preview-1');
 await api('/api/draft/items/preview-1','PATCH',{expectedRev:current.rev,patch:{editedQuestion:'다른 부장이 먼저 수정한 문항'},updatedBy:'검증 담당 B'});
 await fill(page,'.survey-preview-edit textarea','동시에 입력한 문항');
 await page.waitForSelector('[role="alertdialog"]');await click(page,'상대 수정 유지');
 await saved('preview-1','다른 부장이 먼저 수정한 문항');await click(page,'수정 완료');
 await click(page,'안내문 수정');await fill(page,'.survey-preview-intro textarea','회의에서 수정한 안내문');
 assert.equal(await page.$eval('.survey-preview-intro textarea',e=>e.value),'회의에서 수정한 안내문');
 await click(page,'안내문 수정 완료');
 for(let n=0;n<80;n++){if((await api('/api/draft')).draft.introByAudience.teacher==='회의에서 수정한 안내문')break;if(n===79)throw Error('안내문 저장 실패');await new Promise(r=>setTimeout(r,200));}
 await page.select('.survey-preview-jump select','preview-17');
 assert.ok(await page.$eval('.survey-preview-scroll',e=>e.scrollTop>0));
 await page.reload({waitUntil:'networkidle0'});await click(page,'설문 미리보기');
 assert.match(await page.$eval('.survey-preview',e=>e.textContent),/함께 검토하고 수정한 문항입니다/);
 assert.match(await page.$eval('.survey-preview',e=>e.textContent),/회의에서 수정한 안내문/);
 const response=await fetch(base+'/api/export/docx?audience=teacher',{headers:{Cookie:cookie}});assert.equal(response.status,200);
 const zip=await JSZip.loadAsync(await response.arrayBuffer());const xml=await zip.file('word/document.xml').async('string');
 for(const value of ['함께 검토하고 수정한 문항입니다.','수정한 보기','회의에서 수정한 안내문'])assert.ok(xml.includes(value));
 const invite=(await api('/api/invite','POST',{label:'검증 부장',audience:'teacher'})).invite;
 const builderContext=await browser.createBrowserContext();const builder=await builderContext.newPage();builder.setDefaultTimeout(60000);
 await builder.evaluateOnNewDocument((id)=>localStorage.setItem('builder-intro:'+id+':검증 부장','1'),draft.id);
 await builder.goto(base+'/api/invite/accept?token='+invite.token,{waitUntil:'networkidle0'});
 await builder.waitForSelector('.ws-screen-tabs');
 await click(builder,'설문 미리보기');assert.equal(await builder.$$eval('.ws-audience-tab',els=>els.length),1);
 assert.ok(!(await builder.$eval('.survey-preview',e=>e.textContent)).includes('안내문 수정'));
 await builder.click('[aria-label="1번 문항 수정"]');await fill(builder,'.survey-preview-edit textarea','부장 링크에서 수정한 문항');await saved('preview-0','부장 링크에서 수정한 문항');
 assert.deepEqual(errors,[]);
 console.log('[PASS] 미리보기 6유형·대상 제한·문항/보기/안내문 자동 저장·카드/재접속/출력 반영·다른 화면 동기화·동시 수정 409 선택·문항 이동·1440/1920 화면');
}finally{await browser.close();}

