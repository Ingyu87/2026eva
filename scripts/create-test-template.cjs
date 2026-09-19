require('./load-ts.cjs');
const ExcelJS = require('exceljs');
const { AREAS } = require('../src/lib/evaluationFramework.ts');
(async () => {
 const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('학교평가');
 ws.getCell('L3').value='학교명'; ws.getCell('M3').protection={locked:false};
 ws.getCell('A4').value='영역';ws.getCell('B4').value='세부영역';ws.getCell('C4').value='평가지표';
 ws.mergeCells('I4:L4');ws.getCell('I4').value='평가 주체별 문항 수';
 ws.mergeCells('M4:P4');ws.getCell('M4').value='평가 주체별 평가 결과';
 ['교원','학부모','학생','직원'].forEach((s,i)=>{ws.getCell(5,9+i).value=s;ws.getCell(5,13+i).value=s});
 function row(r,a,s,i){ws.getCell(r,1).value=a;ws.getCell(r,2).value=s;ws.getCell(r,3).value=i;for(let c=9;c<=16;c++){ws.getCell(r,c).protection={locked:false};ws.getCell(r,c).value=99;}}
 row(6,AREAS[0].name,AREAS[0].subareas[0],'학교 비전 공유 및 실현');
 row(10,AREAS[0].name,AREAS[0].subareas[0],'기타 :');
 ws.getCell('I11').value={formula:'SUM(I6:I10)'};
 let r=12; for(const a of AREAS)for(const s of a.subareas)row(r++,a.name,s,s===AREAS[0].subareas[0]?'선택하지 않은 지표':'기타 :');
 await wb.xlsx.writeFile('.verify-indicator-template.xlsx');
 const {scanIndicatorTemplate}=require('../src/lib/indicatorTemplate.ts'); scanIndicatorTemplate(wb);
 ws.getCell('B6').value='2025년 옛 세부영역';
 require('assert').throws(()=>scanIndicatorTemplate(wb),/2026/); console.log('[PASS] 옛 평가체제 양식 거부');
})();
