/** 가상 자료만 사용하는 결과 작성·복원·권한·제출 회귀 검사. 외부 AI 호출 없음. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const base = process.env.BASE_URL ?? 'http://127.0.0.1:3001';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw Error('로컬 검증 전용입니다.');
let passed = 0;
const check = (condition, label) => { assert.ok(condition,label); console.log(`[PASS] ${label}`); passed++; };
async function client(name) {
  let cookie = '';
  async function request(path, method='GET', body) {
    const response = await fetch(base+path, {method, headers:{cookie,...(body && !(body instanceof FormData) ? {'content-type':'application/json'} : {})}, body:body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, redirect:'manual'});
    const set = response.headers.getSetCookie();
    if (set.length) cookie = set.map(c=>c.split(';')[0]).join('; ');
    return response;
  }
  const registered = await request('/api/auth/register','POST',{schoolName:name,password:'LocalReview2026!'});
  assert.equal(registered.status,200);
  return {request, async data(path,method,body) { const r=await request(path,method,body); const b=await r.json(); assert.ok(b.ok, JSON.stringify(b)); return b.data; }};
}
const schoolName = `검증-${Date.now()}`;
const school = await client(schoolName);
const areaNames = ['Ⅰ. 협력적 학교자치문화','Ⅱ. 교육과정 운영 및 교수·학습 방법','Ⅲ. 교육 활동 및 교육 성과'];
const subareas = ['Ⅰ-1. 소통과 협력의 학교자치','Ⅱ-1. 교육과정 편성·운영','Ⅲ-1. 모두를 위한 맞춤형 교육'];
const items = ['teacher','parent','student'].flatMap(a=>areaNames.map((area,i)=>({id:`${a}-${i}`,sourceQuestionId:`sample-${a}-${i}`,groupId:`group-${i}`,audience:a,sourceRow:0,area,subarea:subareas[i],indicator:`검증 지표 ${i+1}`,originalQuestion:`${a} 검증 문항 ${i+1}`,editedQuestion:`${a} 검증 문항 ${i+1}`,responseType:'likert_5',order:i+1})));
await school.data('/api/draft/items','POST',{items});
async function upload(audience) {
  const mine=items.filter(i=>i.audience===audience);
  const csv=mine.map(i=>i.editedQuestion).join(',')+'\n매우 그렇다,그렇다,보통이다\n그렇다,매우 그렇다,그렇다\n';
  const form=new FormData();form.set('audience',audience);form.set('file',new Blob([csv],{type:'text/csv'}),'synthetic.csv');
  return (await school.data('/api/results/upload','POST',form)).uploadId;
}
const interimUpload=await upload('teacher');
const interim=(await school.data('/api/results/aggregate','POST',{uploadIds:[interimUpload]})).result;
check(interim.mode==='interim','집계 시기 보존');
let bundle=await school.data('/api/draft');
await school.data('/api/draft/meta','PATCH',{expectedRev:bundle.draft.rev,patch:{mode:'annual'}});
check((await school.request(`/api/export/report-docx?type=draft&resultId=${interim.id}`)).status===403,'시기만 바꾼 중간평가 결과 제출 차단');
check((await school.request('/api/results/aggregate','POST',{uploadIds:[interimUpload]})).status===400,'중간평가 원본의 학년말 재집계 차단');
const uploadIds=[]; for (const a of ['teacher','parent','student']) uploadIds.push(await upload(a));
check((await school.request('/api/results/aggregate','POST',{uploadIds:[uploadIds[0],uploadIds[0]]})).status===400,'중복 파일 중복 집계 차단');
const result=(await school.data('/api/results/aggregate','POST',{uploadIds})).result;
check(result.areaStats.length===9 && result.itemsSnapshot.length===9,'3주체 × 3영역 및 집계 문항 보존');
check(result.areaStats[0].mean===4.5,'실제 업로드 응답 평균 4.5');
check((await school.request(`/api/export/report-docx?type=submit&resultId=${result.id}`)).status===400,'평가 의견 없는 제출본 차단');
check((await school.request(`/api/export/report-docx?type=draft&resultId=${result.id}`)).status===200,'AI 없이 작성용 DOCX 생성');
const analysis={areas:areaNames.map((area,i)=>({area,findings:[{category:'우수한 점',subarea:subareas[i],indicator:`검증 지표 ${i+1}`,content:`가상 자료로 확인한 영역 ${i+1} 의견`,cause:'검토한 원인',action:'차년도 계획 반영',evidence:[]}]})),consultingNeeds:[],featuredCases:[],overallOpinion:'검증용 종합의견이 문서에 보존됩니다.'};
await school.data('/api/results/analysis','PATCH',{resultId:result.id,aiAnalysis:analysis,expectedUpdatedAt:result.updatedAt});
check((await school.request('/api/results/analysis','PATCH',{resultId:result.id,aiAnalysis:analysis,expectedUpdatedAt:result.updatedAt})).status===409,'오래된 평가 의견 덮어쓰기 차단');
const restored=await school.data('/api/results');
check(restored.results[0].aiAnalysis.overallOpinion===analysis.overallOpinion,'저장된 결과·직접 작성 의견 복원');
check(!('rows' in restored.uploads[0]),'결과 목록에는 응답 원문을 반환하지 않음');
check((await school.request('/api/results/analyze','POST',{resultId:result.id,uploadIds})).status===400,'전송 안내 미확인 AI 요청 차단 (외부 호출 없음)');
const other=await client(`별도검증-${Date.now()}`);
check((await other.request(`/api/export/report-docx?type=draft&resultId=${result.id}`)).status!==200,'다른 학교 결과 접근 차단');
check((await fetch(base+'/api/results')).status===401,'로그인 없는 결과 조회 차단');
const {invite}=await school.data('/api/invite','POST',{label:'가상 학생 담당 부장',audience:'student'});
const accepted=await fetch(base+'/api/invite/accept?token='+encodeURIComponent(invite.token),{redirect:'manual'});
const builderCookie=accepted.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
const builderReq=(path,method='GET',body)=>fetch(base+path,{method,headers:{cookie:builderCookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
check((await builderReq('/api/draft')).status===200,'부장 링크로 문항 작업 진입');
check((await builderReq('/api/results')).status===401,'일반 부장의 응답 원문·결과 접근 차단');
check((await builderReq('/api/draft/items','POST',{items:[{...items[0],id:'forbidden'}]})).status===403,'담당 대상 밖의 문항 추가 차단');
check((await builderReq('/api/draft/items/student-0','PATCH',{expectedRev:0,patch:{editedQuestion:'허용하지 않은 수정'}})).status===403,'다른 작성자의 문항 수정 차단');
await school.data('/api/invite','PATCH',{token:invite.token});
check((await builderReq('/api/draft')).status===401,'끊은 부장 링크의 기존 세션 접근 차단');
await school.data('/api/draft/items/teacher-0','PATCH',{expectedRev:0,patch:{editedQuestion:'집계 후 변경한 문항'}});
const doc=await school.request(`/api/export/report-docx?type=submit&resultId=${result.id}`);
check(doc.status===200,'직접 작성한 의견으로 제출본 생성');
const buffer=Buffer.from(await doc.arrayBuffer());
const zip=await JSZip.loadAsync(buffer);const xml=await zip.file('word/document.xml').async('string');
check(xml.includes(analysis.overallOpinion),'종합의견 DOCX 반영');
check(xml.includes('parent 검증 문항 1') && xml.includes('student 검증 문항 1'),'같은 그룹의 대상별 수정 문항 모두 보존');
check(!xml.includes('집계 후 변경한 문항'),'집계 후 문항 변경이 과거 보고서에 섞이지 않음');
check(!xml.includes('평균점수</w:t>'),'제출본 문항별 점수 제외');
mkdirSync('tmp/review',{recursive:true});writeFileSync('tmp/review/submit.docx',buffer);
const html=await school.request(`/api/export/result-html?resultId=${result.id}&uploadIds=${uploadIds.join(',')}`);
check(html.status===200,'결과 HTML 내려받기');writeFileSync('tmp/review/result.html',await html.text());
await school.data('/api/results','DELETE');
const empty=await school.data('/api/results');
check(empty.results.length===0 && empty.uploads.length===0,'응답·분석 자료 삭제');
check((await school.data('/api/draft')).items.length===9,'결과 삭제 후 설문 문항 유지');
console.log(`완료: ${passed}개 통과`);
if (process.env.KEEP_REVIEW_FIXTURE === '1') {
  const freshIds=[];for (const a of ['teacher','parent','student']) freshIds.push(await upload(a));
  await school.data('/api/results/aggregate','POST',{uploadIds:freshIds});
  writeFileSync('tmp/review/ui-school.txt',schoolName);
  console.log('화면 검증용 가상 학교: '+schoolName);
}
