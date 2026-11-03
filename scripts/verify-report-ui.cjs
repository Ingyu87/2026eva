const puppeteer=require('puppeteer-core');const fs=require('node:fs');
(async()=>{
 const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});
 await page.goto('http://127.0.0.1:3001');
 const name=fs.readFileSync('tmp/review/ui-school.txt','utf8');
 await page.evaluate(async schoolName=>{await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schoolName,password:'LocalReview2026!'})})},name);
 await page.goto('http://127.0.0.1:3001/',{waitUntil:'networkidle0'});
 await page.waitForSelector('button');
 await page.evaluate(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='익명으로')?.click()});
 console.log((await page.$eval('body',e=>e.innerText)).slice(0,900));
 await page.evaluate(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='시작하기')?.click()});
 await page.evaluate(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent.includes('결과 분석 · 내보내기'))?.click()});
 await page.waitForFunction(()=>document.body.innerText.includes('평가 결과 분석하고 평가서 작성'));
 await page.evaluate(()=>{const d=document.getElementById('result-opinion');d.open=true;d.scrollIntoView()});
 await page.screenshot({path:'output/report-verification/editor.png'});
 console.log('UI analysis button and screenshot OK');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
