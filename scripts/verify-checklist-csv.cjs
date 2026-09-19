require('./load-ts.cjs');
const assert = require('node:assert/strict');
const { splitChecklistAnswer } = require('../src/lib/resultReportHtml.ts');
assert.deepEqual(splitChecklistAnswer('독서;체육',['독서','체육']),['독서','체육']);
assert.deepEqual(splitChecklistAnswer('독서, 체육',['독서','체육']),['독서','체육']);
assert.deepEqual(splitChecklistAnswer('독서, 토론',['독서, 토론','체육']),['독서, 토론']);
assert.deepEqual(splitChecklistAnswer('독서, 토론;체육',['독서, 토론','체육']),['독서, 토론','체육']);
console.log('PASS: Forms 세미콜론·Sheets 쉼표·보기 내부 쉼표 처리');
