const assert = require('node:assert/strict');
require('./load-ts.cjs');
const { createGoogleFormsByAudienceFromDraft } = require('../src/lib/googleForms.ts');
const { isDuplicateGradeQuestion, googleFormReadyIssues } = require('../src/lib/googleFormReady.ts');
const { isFormRequired, suggestOptionalResponse } = require('../src/lib/formRequired.ts');
assert.equal(suggestOptionalResponse({ audience: 'parent', indicator: '방과후·돌봄교실 내실화', editedQuestion: '방과후 프로그램은 다양하게 운영된다.' }), true);
assert.equal(suggestOptionalResponse({ audience: 'parent', editedQuestion: '학교는 교육목표를 학부모에게 이해하기 쉽게 안내하고 있다.' }), false);
assert.equal(suggestOptionalResponse({ audience: 'parent', editedQuestion: '우리 학교는 다문화이해교육과 세계시민교육을 실시하였다.' }), false);
assert.equal(suggestOptionalResponse({ audience: 'teacher', indicator: '방과후·돌봄교실 내실화', editedQuestion: '방과후학교와 돌봄교실을 체계적으로 운영하고 있다.' }), false);
assert.equal(isFormRequired({ audience: 'parent', editedQuestion: '해당되는 분만 답하세요' }), false);
assert.equal(isFormRequired({ audience: 'parent', editedQuestion: '방과후 프로그램은 다양하다.', required: true }), true);
assert.equal(isDuplicateGradeQuestion({ editedQuestion: '현재 몇 학년입니까?', responseType: 'choice_single', choices: ['4학년', '5학년', '6학년'] }), true);
assert.equal(googleFormReadyIssues([{ audience: 'student', editedQuestion: '현재 몇 학년입니까?', responseType: 'choice_single', choices: ['4학년', '5학년', '6학년'] }], { studentGrades: [4, 5, 6] }).length, 0);
assert.match(googleFormReadyIssues([{ audience: 'student', editedQuestion: '가상 문항', responseType: 'likert_5' }])[0], /학생 설문 학년/);

// 실제 장애였던 UUID 전송을 차단하고, Google 응답 ID와 앱 문항 연결을 검증합니다.
const requestsSeen = [];
global.fetch = async (url, options) => {
  if (url.endsWith(':batchUpdate')) {
    const { requests } = JSON.parse(options.body);
    requestsSeen.push(requests);
    requests.forEach(r => assert.equal(r.createItem.item.itemId, undefined));
    return new Response(JSON.stringify({ replies: requests.map((_, i) => ({ createItem: { itemId: String(100 + i) } })) }));
  }
  return new Response(JSON.stringify({ formId: 'test-form', responderUri: 'https://example.com/test' }));
};
(async () => {
  const draft = { id: 'uuid-with-hyphens', title: '가상 설문', schoolName: '검증용', studentGrades: [4, 5, 6], introByAudience: { teacher: '교원 안내', student: '학생 안내' } };
  const items = [
    ...['teacher', 'student'].map(audience => ({ id: 'app-' + audience, audience, editedQuestion: '가상 문항', responseType: 'likert_5', order: 1, area: '영역', subarea: '세부영역', indicator: '지표' })),
    { id: 'app-grade-dup', audience: 'student', editedQuestion: '현재 몇 학년입니까?', responseType: 'choice_single', choices: ['4학년', '5학년', '6학년'], order: 0, area: '', subarea: '', indicator: '학교 자체 문항' }
  ];
  const forms = await createGoogleFormsByAudienceFromDraft(draft, items, 'fake-token');
  assert.equal(forms.teacher.questionLinks[0].itemId, '101');
  assert.equal(forms.teacher.questionLinks[0].selectedQuestionId, 'app-teacher');
  assert.equal(forms.student.gradeQuestion.itemId, '101');
  assert.equal(forms.student.questionLinks[0].itemId, '102');
  assert.equal(forms.student.questionLinks[0].selectedQuestionId, 'app-student');
  assert.equal(requestsSeen[0][1].createItem.item.questionItem.question.required, true);
  assert.equal(requestsSeen[1][1].createItem.item.questionItem.question.required, true);
  const optional = { id: 'app-optional', audience: 'parent', editedQuestion: '해당되는 분만 답하세요', responseType: 'text', order: 1, area: '영역', subarea: '세부영역', indicator: '지표', required: false };
  await createGoogleFormsByAudienceFromDraft({ ...draft, title: '선택 검증' }, [optional], 'fake-token');
  const optionalRequest = requestsSeen[requestsSeen.length - 1].find(request => request.createItem?.item?.questionItem);
  assert.equal(optionalRequest.createItem.item.questionItem.question.required, false);
  const afterSchool = { id: 'app-after', audience: 'parent', editedQuestion: '방과후 프로그램은 다양하게 운영된다.', indicator: '방과후·돌봄교실 내실화', responseType: 'likert_5', order: 1, area: '영역', subarea: '세부영역' };
  await createGoogleFormsByAudienceFromDraft({ ...draft, title: '방과후 검증' }, [afterSchool], 'fake-token');
  const afterSchoolRequest = requestsSeen[requestsSeen.length - 1].find(request => request.createItem?.item?.questionItem);
  assert.equal(afterSchoolRequest.createItem.item.questionItem.question.required, false);
  console.log('PASS: Google 발급 ID 연결, 대상별 위치, 학생 필수 학년 문항, 선택 응답');
})().catch(e => { console.error(e); process.exitCode = 1; });
