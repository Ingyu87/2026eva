const assert = require('node:assert/strict');
require('./load-ts.cjs');
const { createGoogleFormsByAudienceFromDraft } = require('../src/lib/googleForms.ts');

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
  const items = ['teacher', 'student'].map(audience => ({ id: 'app-' + audience, audience, editedQuestion: '가상 문항', responseType: 'likert_5', order: 1, area: '영역', subarea: '세부영역', indicator: '지표' }));
  const forms = await createGoogleFormsByAudienceFromDraft(draft, items, 'fake-token');
  assert.equal(forms.teacher.questionLinks[0].itemId, '101');
  assert.equal(forms.teacher.questionLinks[0].selectedQuestionId, 'app-teacher');
  assert.equal(forms.student.gradeQuestion.itemId, '101');
  assert.equal(forms.student.questionLinks[0].itemId, '102');
  assert.equal(forms.student.questionLinks[0].selectedQuestionId, 'app-student');
  assert.equal(requestsSeen[1][1].createItem.item.questionItem.question.required, true);
  console.log('PASS: Google 발급 ID 연결, 대상별 위치, 학생 필수 학년 문항');
})().catch(e => { console.error(e); process.exitCode = 1; });
