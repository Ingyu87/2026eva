require('./load-ts.cjs');
const assert = require('node:assert/strict');
const { normalizePriorSurveyItems, parseAudience } = require('../src/lib/priorSurvey.ts');
const { LIKERT_5_OPTIONS } = require('../src/lib/types.ts');
assert.equal(parseAudience('(보호자용) 작년 설문.pdf'), 'parent');
assert.equal(parseAudience('(직원용) 작년 설문.pdf'), 'staff');
const rows = normalizePriorSurveyItems([
 {question:'학교 활동에서 좋았던 점을 적어 주세요.',responseType:'text'},
 {question:'참여를 희망하는 활동을 모두 선택하세요.',responseType:'checklist',choices:['독서','체육']},
 {question:'학교 교육활동에 만족하십니까?',responseType:'likert_5',choices:LIKERT_5_OPTIONS},
 {question:'학교 교육활동에 만족하십니까?',responseType:'likert_5',choices:['아주 만족','만족','보통','불만','아주 불만']},
 {question:'유형을 추출하지 못한 문항입니다.'},
], 'parent');
assert.equal(rows.length,5);
assert.ok(rows.every(r=>r.audience==='parent'));
assert.equal(rows[0].responseType,'text');
assert.equal(rows[1].responseType,'checklist');
assert.deepEqual(rows[1].choices,['독서','체육']);
assert.equal(rows[2].responseType,'likert_5');
assert.equal(rows[3].responseType,'choice_single');
assert.equal(rows[4].responseType,null);
console.log('PASS: 대상 별칭, 대상 지정, 서술형·복수선택·보기 보존, 불명확한 유형 확인');
const spaced = normalizePriorSurveyItems([{question:'가상 문항',responseType:'choice_single',choices:LIKERT_5_OPTIONS.map(s=>s.replace(/\s/g,''))}]);
assert.equal(spaced[0].responseType,'likert_5');
console.log('PASS: PDF 표의 띄어쓰기 차이는 5점 척도로 인식');
assert.equal(normalizePriorSurveyItems([{question:'가상 문항',responseType:'choice_single',choices:LIKERT_5_OPTIONS.map((s,i)=>String.fromCharCode(0x2460+i)+' '+s+'.')}])[0].responseType,'likert_5');
console.log('PASS: 보기 번호와 문장 끝 마침표는 척도 의미에 영향 없음');
const table = normalizePriorSurveyItems([{question:'활동을 각각 2가지 이내 선택하세요.',responseType:'checklist',choices:['독서','체육','음악'],rows:[{label:'저학년'},{label:'고학년'}]}, {question:'활동 운영 의견',rows:[{label:'저학년 독서',responseType:'choice_single',choices:['기존 유지','변경'],textPrompt:'대안'},{label:'고학년 체육',responseType:'choice_single',choices:['기존 유지','변경'],textPrompt:'대안'}]}], 'teacher');
assert.equal(table.length,6);
assert.deepEqual(table.slice(0,2).map(x=>x.responseType),['checklist','checklist']);
assert.ok(table.slice(0,2).every(x=>x.question.includes('2가지 이내') && x.choices.length===3));
assert.deepEqual(table.slice(2).map(x=>x.responseType),['choice_single','text','choice_single','text']);
assert.ok(table[3].question.includes('저학년 독서') && table[3].question.endsWith('대안'));
assert.deepEqual(table[4].choices,['기존 유지','변경']);
assert.throws(()=>normalizePriorSurveyItems([{question:'제목 없는 표',rows:[{}]}]),/행 제목/);
console.log('PASS: 표의 행별 복수선택·공유 보기·조건 및 개별 대안 입력 보존');
