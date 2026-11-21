// Fresh recovery QA: mock DOM functional checks, NOT visual/browser acceptance.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(__dirname+'/standalone-demo.html','utf8');
const engine=fs.readFileSync(__dirname+'/readiness.mjs','utf8').replace('export function assessPermit','function assessPermit');assert.ok(html.includes(engine),'embedded engine must match current source');
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/export function /g,'function ');
let innerHTMLWrites=0;class El{constructor(){this.children=[];this.dataset={};this.listeners={};this.classList={toggle(){}};}set innerHTML(v){innerHTMLWrites++;throw Error('HTML sink');}setAttribute(){}replaceChildren(){this.children=[];}append(...els){this.children.push(...els);}addEventListener(k,fn){this.listeners[k]=fn;}click(){this.listeners.click?.();}}
const nodes=new Map();const buttons=['intake','conflict','ready'].map(k=>{const e=new El();e.dataset.case=k;return e;});const doc={querySelector:s=>{if(!nodes.has(s))nodes.set(s,new El());return nodes.get(s);},querySelectorAll:()=>buttons,createElement:()=>new El()};
const ctx={document:doc,Date,URL,Blob,setTimeout,console};vm.createContext(ctx);vm.runInContext(source+';globalThis.qa={render,scenarios,assessPermit,getResult:()=>result};',ctx);
for(const key of ['intake','conflict','ready']){ctx.qa.render(key);const r=ctx.qa.getResult();assert.equal(r.allowedExternalActions.length,0);assert.equal(r.state,key==='ready'?'packet_ready_for_owner_review':'blocked');}
const s=ctx.qa.scenarios.ready;const old=s.input.job.fetchedAt;s.input.job.fetchedAt='2020-01-01';ctx.qa.render('ready');assert.equal(ctx.qa.getResult().state,'blocked');assert.doesNotMatch(nodes.get('#case-status').textContent,/ready/i);s.input.job.fetchedAt=old;
s.evidence=['<img src=x onerror=alert(1)>'];ctx.qa.render('ready');assert.equal(nodes.get('#evidence').children[0].textContent,s.evidence[0]);assert.equal(innerHTMLWrites,0);
assert.doesNotMatch(source,/\b(fetch|XMLHttpRequest|WebSocket)\s*\(/);assert.match(html,/SYNTHETIC|Synthetic/);assert.match(html,/does not authorize permits/);
console.log('Independent mock-DOM QA passed: three scenarios, stale job blocks visible Ready state, literal hostile text, no HTML sink or network call. Not visual QA.');
