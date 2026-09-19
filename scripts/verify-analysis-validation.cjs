// 실제 구현을 불러오며, API의 인증·저장 경계만 가상으로 대체합니다.
require('./load-ts.cjs');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { AREAS } = require('../src/lib/evaluationFramework.ts');
const validation = require('../src/lib/reportReadiness.ts');
const { emptyManualAnalysis } = require('../src/lib/manualAnalysis.ts');
const { computeAreaStats, computeQuestionStat } = require('../src/lib/scoring.ts');
const good = emptyManualAnalysis();
good.areas.forEach(a => Object.assign(a.findings[0], { indicator: '검증 지표', content: '가상 자료의 검토 의견' }));
const items = ['teacher', 'parent', 'student'].flatMap(a => AREAS.map((area, i) => ({
  id: `${a}-${i}`, audience: a, area: area.name, subarea: area.subareas[0], responseType: 'likert_5'
})));
const stats = items.map(i => computeQuestionStat(i.id, i.audience, ['그렇다']));
const result = { itemsSnapshot: items, questionStats: stats,
  areaStats: computeAreaStats(items.map(i => ({ ...i, questionId: i.id })), stats), aiAnalysis: good };
let count = 0;
function check(label, fn) { fn(); count++; console.log('[PASS]', label); }
check('정상 의견과 선택 항목의 빈칸은 제출 가능', () => assert.deepEqual(validation.reportReadiness(result), []));
check('작성 중 빈칸은 저장 가능', () => assert.equal(validation.isAnalysisStructure(emptyManualAnalysis()), true));
const malformed = [null, {}, { ...good, areas: {} }, { ...good, featuredCases: [null] }];
for (const change of [
  a => { a.areas.push(a.areas[0]); },
  a => { a.areas[0].area = '이전 영역'; },
  a => { a.areas[0].findings[0].content = null; },
  a => { a.areas[0].findings[0].category = '임의 구분'; },
  a => { a.areas[0].findings[0].evidence = [{ questionId: 'x', subject: '교원', value: Infinity }]; },
  a => { a.areas[0].findings[0].needsReview = 'false'; }
]) { const a = structuredClone(good); change(a); malformed.push(a); }
check('잘못된 구조·구분·중복 영역·근거 수치 차단', () => malformed.forEach(a => assert.equal(validation.isAnalysisStructure(a), false)));
check('이미 저장된 비정상 의견도 예외 대신 제출 오류 반환', () => malformed.forEach(a => assert.ok(validation.reportReadiness({ ...result, aiAnalysis: a }).length)));
check('내용 없는 지원 요청은 제출 차단', () => {
  const a = structuredClone(good); a.consultingNeeds[0].indicator = '작성 중';
  assert.ok(validation.reportReadiness({ ...result, aiAnalysis: a }).some(s => s.includes('지원 요청')));
});
check('특색사례 미작성은 허용하고 불완전·옛 세부영역은 차단', () => {
  for (const entry of [{ subarea: '', content: '사례' }, { subarea: '옛 분류', content: '사례' }, { subarea: AREAS[0].subareas[0], content: '' }]) {
    assert.ok(validation.reportReadiness({ ...result, aiAnalysis: { ...good, featuredCases: [entry] } }).some(s => s.includes('특색사례')));
  }
});
check('다른 대상 통계로 누락 문항을 대체하지 않음', () => {
  const questionStats = stats.map((s, i) => i ? s : { ...s, audience: 'staff' });
  assert.ok(validation.reportReadiness({ ...result, questionStats }).some(s => s.includes('유효 응답')));
});

let writes = 0;
let conflict = false;
class NotFoundError extends Error {}
const originalLoad = Module._load;
Module._load = function(id, ...args) {
  if (id === '@/lib/reportReadiness') return validation;
  if (id === '@/lib/api') return {
    jsonError: (error, status = 400) => Response.json({ error }, { status }),
    jsonOk: data => Response.json(data)
  };
  if (id === '@/lib/draftApi') return {
    resolveDraftContext: async () => ({ draftId: 'test' }),
    draftWriteError: () => Response.json({ error: '충돌' }, { status: 409 })
  };
  if (id === '@/lib/store') return { NotFoundError, updateSurveyResultAnalysis: async (...args) => {
    if (conflict) throw new Error('충돌');
    writes++; return { aiAnalysis: args[2], updatedAt: args[3] };
  } };
  return originalLoad.call(this, id, ...args);
};
const { PATCH } = require('../app/api/results/analysis/route.ts');
Module._load = originalLoad;
const request = body => new Request('http://localhost/api/results/analysis', { method: 'PATCH', body: JSON.stringify(body) });
(async () => {
  const base = { resultId: 'result', expectedUpdatedAt: '2026-09-19T00:00:00.000Z', aiAnalysis: good };
  for (const body of [null, [], { ...base, resultId: {} }, { ...base, expectedUpdatedAt: 5 }, ...malformed.map(aiAnalysis => ({ ...base, aiAnalysis }))]) {
    assert.equal((await PATCH(request(body))).status, 400);
  }
  check('PATCH 비정상 요청은 400이며 저장 함수 미호출', () => assert.equal(writes, 0));
  assert.equal((await PATCH(request({ ...base, aiAnalysis: emptyManualAnalysis() }))).status, 200);
  check('PATCH 임시 저장 정상 통과', () => assert.equal(writes, 1));
  conflict = true;
  assert.equal((await PATCH(request(base))).status, 409);
  check('기존 동시 수정 충돌 응답 유지', () => assert.equal(writes, 1));
  console.log(`완료: ${count}개 통과`);
})().catch(error => { console.error(error); process.exitCode = 1; });
