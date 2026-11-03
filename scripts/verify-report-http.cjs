const fs=require('node:fs');
(async()=>{
 const schoolName=fs.readFileSync('tmp/review/ui-school.txt','utf8');
 const base='http://127.0.0.1:3001';
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schoolName,password:'LocalReview2026!'})});
 const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 const r=await (await fetch(base+'/api/results',{headers:{cookie}})).json();
 const result=r.data.results[0];
 const started=Date.now();
 const res=await fetch(base+'/api/results/analyze',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({resultId:result.id,uploadIds:result.uploadIds,schoolContext:'매월 학년 협의회를 운영해 수업 사례를 나누었다.',transmissionConfirmed:true})});
 const body=await res.json();
 console.log('HTTP analysis',res.status,'seconds',Math.round((Date.now()-started)/1000));
 if(!body.ok)throw Error(body.error);
 const doc=await fetch(base+`/api/export/report-docx?type=submit&resultId=${result.id}`,{headers:{cookie}});
 console.log('HTTP DOCX',doc.status);
 if(!doc.ok)throw Error(await doc.text());
 fs.writeFileSync('output/report-verification/http-report.docx',Buffer.from(await doc.arrayBuffer()));
 fs.writeFileSync('output/report-verification/http-analysis.json',JSON.stringify(body.data.result.aiAnalysis,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
