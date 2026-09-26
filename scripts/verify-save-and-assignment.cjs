require('./load-ts.cjs');
const assert = require('node:assert/strict');
for (const key of ['FIREBASE_SERVICE_ACCOUNT_JSON','FIREBASE_PROJECT_ID','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY']) delete process.env[key];
process.env.NODE_ENV = 'test';
const memory = new Map();
let blocked = false;
global.window = { localStorage: {
 getItem: key => memory.get(key) ?? null,
 setItem: (key,value) => { if (blocked) throw Error('QuotaExceededError'); memory.set(key,value); },
 removeItem: key => { if (blocked) throw Error('SecurityError'); memory.delete(key); }
}};
const q = require('../src/lib/outbox.ts');
let count = 0;
async function check(name, fn) { await fn(); count++; console.log('[PASS]', name); }
(async () => {
 await check('전송 중 연속 입력: 앞 요청 완료 후 최신 수정 유지', () => {
  q.enqueue('typing',{kind:'patch',opId:'a',itemId:'x',patch:{editedQuestion:'first'}});
  const sent = q.readOutbox('typing')[0];
  q.enqueue('typing',{kind:'patch',opId:'b',itemId:'x',patch:{editedQuestion:'last'}});
  assert.equal(q.acknowledge('typing',sent.opId)[0].patch.editedQuestion,'last');
  assert.equal(q.acknowledge('typing','b').length,0);
 });
 await check('설문 설정 연속 입력도 마지막 값 보존', () => {
  q.enqueue('meta',{kind:'meta',opId:'a',patch:{schoolName:'first'}});
  q.enqueue('meta',{kind:'meta',opId:'b',patch:{schoolName:'last'}});
  assert.equal(q.acknowledge('meta','a')[0].patch.schoolName,'last');
 });
 await check('브라우저 저장 실패 시 메모리에 보관하고 서버 전송 가능', () => {
  blocked=true;
  q.enqueue('quota',{kind:'patch',opId:'a',itemId:'x',patch:{editedQuestion:'retained'}});
  assert.equal(q.outboxStorageFailed('quota'),true);
  assert.equal(q.readOutbox('quota')[0].patch.editedQuestion,'retained');
  blocked=false;
  q.enqueue('quota',{kind:'patch',opId:'b',itemId:'x',patch:{editedQuestion:'recovered'}});
  assert.equal(q.outboxStorageFailed('quota'),false);
  assert.equal(q.readOutbox('quota')[0].patch.editedQuestion,'recovered');
 });
 await check('권한 거절은 보존하고 다른 정상 작업과 분리', () => {
  q.enqueue('rights',{kind:'patch',opId:'a',itemId:'x',patch:{editedQuestion:'refused'}});
  q.rejectOperation('rights','a','권한 없음');
  q.enqueue('rights',{kind:'patch',opId:'b',itemId:'y',patch:{editedQuestion:'allowed'}});
  assert.deepEqual(q.readOutbox('rights').filter(op=>!op.rejected).map(op=>op.opId),['b']);
  q.acknowledge('rights','b');
  assert.equal(q.readOutbox('rights')[0].rejected,'권한 없음');
  q.retryRejected('rights'); assert.equal(q.readOutbox('rights')[0].rejected,undefined);
 });
 const store = require('../src/lib/store.ts');
 const draft = await store.getOrCreateDraft('fake-review-school','가상 검증 학교');
 const item = id => ({id,sourceQuestionId:'prior-'+id,audience:'teacher',sourceRow:0,area:'Ⅰ. 협력적 학교자치문화',subarea:'Ⅰ-1. 소통과 협력의 학교자치',indicator:'가상 지표',originalQuestion:'가상 문항',editedQuestion:'가상 문항',responseType:'likert_5',order:id==='one'?1:2});
 await store.createDraftItems(draft.id,[item('one'),item('two')]);
 const invite = await store.createBuilderInvite({schoolId:'fake-review-school',schoolName:'가상',draftId:draft.id,label:'가상 교무부장',audience:'teacher'});
 let assigned;
 await check('연구부장이 가져온 문항 배정 및 제출 상태 초기화', async () => {
  await store.submitBuilderInvite(invite.token);
  assigned = await store.assignDraftItems('fake-review-school',draft.id,invite.token,[{id:'one',rev:0}]);
  assert.equal(assigned[0].ownerId,store.inviteOwnerId(invite.token));
  assert.equal((await store.getBuilderInvite(invite.token)).submittedAt,undefined);
 });
 await check('배정받은 부장 수정 허용, 다른 부장 수정 차단', async () => {
  await assert.rejects(store.patchDraftItem(draft.id,'one',1,{editedQuestion:'차단'},undefined,{ownerId:'other'}),store.ForbiddenError);
  const saved=await store.patchDraftItem(draft.id,'one',1,{editedQuestion:'담당자 수정'},undefined,{ownerId:store.inviteOwnerId(invite.token)});
  assert.equal(saved.editedQuestion,'담당자 수정');
 });
 await check('일괄 배정 중 충돌은 전체 배정 취소', async () => {
  await assert.rejects(store.assignDraftItems('fake-review-school',draft.id,invite.token,[{id:'two',rev:0},{id:'one',rev:0}]),store.ConflictError);
  const saved=await store.patchDraftItem(draft.id,'two',0,{editedQuestion:'미변경 확인'});
  assert.equal(saved.ownerId,undefined);
 });
 await check('다른 학교 링크·대상이 다른 링크·취소된 링크 배정 차단', async () => {
  const foreign=await store.createBuilderInvite({schoolId:'other',schoolName:'other',draftId:'other',label:'other'});
  await assert.rejects(store.assignDraftItems('fake-review-school',draft.id,foreign.token,[{id:'two',rev:1}]),store.ForbiddenError);
  const parent=await store.createBuilderInvite({schoolId:'fake-review-school',schoolName:'가상',draftId:draft.id,label:'학부모담당',audience:'parent'});
  await assert.rejects(store.assignDraftItems('fake-review-school',draft.id,parent.token,[{id:'two',rev:1}]),store.ForbiddenError);
  await store.revokeBuilderInvite('fake-review-school',invite.token);
  await assert.rejects(store.assignDraftItems('fake-review-school',draft.id,invite.token,[{id:'two',rev:1}]),store.ForbiddenError);
 });

 const actor={id:'actor-test',label:'수정자표시검증전용',color:'purple'};
 const [original]=await store.createDraftItems(draft.id,[{...item('status'),workStatus:{kind:'edited',label:'위조',at:'fake',color:'blue'}}]);
 await check('가져오기와 배정만으로 검토 완료되지 않음·상태 위조 차단', async()=>{
  assert.equal(original.workStatus,undefined);
  const link=await store.createBuilderInvite({schoolId:'fake-review-school',schoolName:'가상',draftId:draft.id,label:'교무부장'});
  assert.equal(link.color,'purple');
  const [row]=await store.assignDraftItems('fake-review-school',draft.id,link.token,[{id:'status',rev:0}]);
  assert.equal(row.workStatus,undefined);
 });
 let statusItem;
 await check('순서 변경은 미확인 유지, 원문 유지 확인은 서버 시각 기록',async()=>{
  const moved=await store.patchDraftItem(draft.id,'status',1,{order:50},'표시용',undefined,actor);
  assert.equal(moved.workStatus,undefined);
  statusItem=await store.patchDraftItem(draft.id,'status',2,{confirmReview:true},'표시용',undefined,actor);
  assert.equal(statusItem.workStatus.kind,'confirmed');
  assert.equal(statusItem.editedQuestion,original.editedQuestion);
  assert.ok(Number.isFinite(Date.parse(statusItem.workStatus.at)));
 });
 await check('문항·보기 수정은 수정자로 기록하고 단순 재정렬은 기록 유지',async()=>{
  statusItem=await store.patchDraftItem(draft.id,'status',3,{editedQuestion:'내보내기검증문항',workStatus:{label:'위조'}},'위조이름',undefined,actor);
  assert.equal(statusItem.workStatus.label,actor.label);
  assert.equal(statusItem.workStatus.kind,'edited');
  assert.equal(statusItem.workStatus.color,'purple');
  const reordered=await store.patchDraftItem(draft.id,'status',4,{order:51},'다른이름');
  assert.deepEqual(reordered.workStatus,statusItem.workStatus);
 });
 await check('한글 편집용 DOCX에는 작업자·시각·색상·내부지표 제외',async()=>{
  const {buildSurveyDocx}=require('../src/lib/docxExport.ts');
  const JSZip=require('jszip');
  const buffer=await buildSurveyDocx(draft,[{...statusItem,indicator:'내부지표검증전용',ownerLabel:'담당자표시검증전용'}]);
  const zip=await JSZip.loadAsync(buffer); const xml=await zip.file('word/document.xml').async('string');
  assert.ok(xml.includes('내보내기검증문항'));
  for(const marker of [actor.label,'담당자표시검증전용','내부지표검증전용',statusItem.workStatus.at]) assert.ok(!xml.includes(marker));
 });
 await check('Google Forms 전송 본문에는 문항·보기만 포함',async()=>{
  const {createGoogleFormsByAudienceFromDraft}=require('../src/lib/googleForms.ts');
  const previous=global.fetch; const bodies=[];
  global.fetch=async(url,options)=>{
   const body=options?.body?JSON.parse(options.body):null; if(body)bodies.push(body);
   return new Response(JSON.stringify(body?.requests?{replies:body.requests.map((_,i)=>({createItem:{itemId:'google-'+i}}))}:{formId:'fake-form',responderUri:'https://example.invalid/form'}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
   await createGoogleFormsByAudienceFromDraft(draft,[{...statusItem,indicator:'내부지표검증전용',ownerLabel:'담당자표시검증전용'}],'fake-token');
   const payload=JSON.stringify(bodies);
   assert.ok(payload.includes('내보내기검증문항'));
   for(const marker of [actor.label,'담당자표시검증전용','내부지표검증전용',statusItem.workStatus.at,'workStatus']) assert.ok(!payload.includes(marker));
  } finally {global.fetch=previous;}
 });
 console.log('완료:',count,'개 통과 (가상 저장소, 외부 API 호출 없음)');
})().catch(error=>{console.error(error);process.exitCode=1;});
