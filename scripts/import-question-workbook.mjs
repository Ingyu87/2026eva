/** 교육청 XLSX 4개 대상 시트를 적재. 원문과 기존 교원 문항 ID를 보존합니다. */
import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const path = process.argv[2];
if (!path) throw new Error('사용법: node scripts/import-question-workbook.mjs 원본.xlsx');
const target = 'src/data/question-bank-2026.json';
const old = JSON.parse(readFileSync(target, 'utf8'));
const normalize = s => String(s ?? '').replace(/[･・‧]/g, '·').replace(/\s/g, '');
const framework = readFileSync('src/lib/evaluationFramework.ts', 'utf8');
const subareas = [...framework.matchAll(/"([ⅠⅡⅢ]-\d\. [^"]+)"/g)].map(x => x[1]).slice(0, 10);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(path);
const items = [];
const used = new Set();
for (const [sheetName, audience] of [['1.교원','teacher'],['2.학생','student'],['3.학부모','parent'],['4.직원','staff']]) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`시트 없음: ${sheetName}`);
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2 || !row.getCell(4).text.trim()) return;
    const [area, rawSubarea, indicator, question] = [1,2,3,4].map(n => row.getCell(n).text.trim());
    // 원본 일부 행의 'Ⅲ-3/4/5. 미래역량 교육' 오기는 명칭으로 기준표에 연결.
    const subarea = subareas.find(s => normalize(s.split('. ').slice(1).join('. ')) === normalize(rawSubarea.split('. ').slice(1).join('. ')));
    if (!subarea) throw new Error(`${sheetName}:${rowNumber} 분류 확인 필요: ${rawSubarea}`);
    const previous = audience === 'teacher' ? old.items.find(i => !used.has(i.id) && normalize(i.question) === normalize(question) && normalize(i.indicator) === normalize(indicator)) : null;
    const id = previous?.id ?? `el-2026-${audience}-${String(rowNumber).padStart(4,'0')}`;
    used.add(id);
    items.push({ id, year:2026, schoolLevel:'elementary', audience, area:area.replace(/[･・‧]/g,'·'), subarea, indicator, question, sourceRow:rowNumber, sourceSheet:sheetName });
  });
}
const counts = Object.fromEntries(['teacher','student','parent','staff'].map(a=>[a,items.filter(i=>i.audience===a).length]));
if (JSON.stringify(Object.values(counts)) !== JSON.stringify([272,217,246,228])) throw new Error(JSON.stringify(counts));
writeFileSync(target, JSON.stringify({year:2026, schoolLevel:'elementary', sourceSha256:createHash('sha256').update(readFileSync(path)).digest('hex'), sourceCounts:counts, items},null,2)+'\n');
console.log(counts);
