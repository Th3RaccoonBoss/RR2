// New browser verification: synthetic offline UI only.
import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';const {chromium}=createRequire(import.meta.url)('playwright');import {resolve} from 'node:path';
test('offline demo scenario rendering and download remain non-operative',async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const p=await b.newPage({viewport:{width:390,height:844}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**/*',r=>r.abort());
 await p.goto('file://'+resolve('standalone-demo.html'));
 assert.match(await p.locator('#case-status').textContent(),/Blocked/);
 await p.locator('[data-case="ready"]').click();assert.match(await p.locator('#case-status').textContent(),/Synthetic packet ready/);
 const download=p.waitForEvent('download');await p.locator('#download').click();const d=await download;const stream=await d.createReadStream();let text='';for await(const x of stream)text+=x;const data=JSON.parse(text);assert.deepEqual(data.result.allowedExternalActions,[]);assert.match(data.notice,/SYNTHETIC/);
 await p.locator('[data-case="conflict"]').click();assert.match(await p.locator('#case-status').textContent(),/Blocked/);assert.match(await p.locator('#evidence').textContent(),/single-family detached/);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 }finally{await b.close();}
});
