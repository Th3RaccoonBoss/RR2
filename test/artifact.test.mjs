import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { summarizeReferenceShape } from '../lib/shape-summary.mjs';
const root=new URL('../',import.meta.url);
test('Vendored validator, migrations and dependency closure match source manifest',async()=>{
  const manifest=JSON.parse(await readFile(new URL('vendor-manifest.json',root),'utf8'));
  assert.equal(Object.keys(manifest.sha256).length,10);
  for(const [path,hash] of Object.entries(manifest.sha256))assert.equal(createHash('sha256').update(await readFile(new URL(path,root))).digest('hex'),hash,path);
  assert.match(await readFile(new URL('vendor/acl-postgres-validation/real-neon-validation.mjs',root),'utf8'),/enableChannelBinding:true/);
});
test('All vendored relative imports stay inside the exact five-module closure',async()=>{
  const names=['postgres-durability.mjs','postgres-routing-store.mjs','postgres-website-intake-store.mjs','website-intake-bridge.mjs','website-submission-sessions.mjs'];
  const dir=new URL('vendor/acl-routing-integration/src/',root);
  assert.deepEqual((await readdir(dir)).sort(),[...names].sort());
  for(const name of names){
    const source=await readFile(new URL(name,dir),'utf8');
    for(const match of source.matchAll(/from\s+["']([^"']+)["']/g)){
      assert.ok(match[1].startsWith('node:')||names.some(allowed=>match[1]===`./${allowed}`),`${name}: ${match[1]}`);
    }
  }
  const config=JSON.parse(await readFile(new URL('vercel.json',root),'utf8'));
  assert.deepEqual(Object.keys(config.functions),['api/diagnostic.mjs']);
  assert.deepEqual(config.functions['api/diagnostic.mjs'].includeFiles,['vendor/**','lib/inspection-worker.mjs','lib/inspection-core.mjs','lib/neon-readonly-options.mjs','node_modules/**']);
  assert.ok(!(await readFile(new URL('.vercelignore',root),'utf8')).split('\n').includes('test'));
});
test('Validator --plan is nonexecuting, with no credentials or dependencies required',()=>{
  const run=spawnSync(process.execPath,[new URL('vendor/acl-postgres-validation/real-neon-validation.mjs',root).pathname,'--plan'],{encoding:'utf8',env:{}});
  assert.equal(run.status,0);assert.equal(JSON.parse(run.stdout).status,'not_executed');assert.equal(run.stderr,'');
});
test('Offline shape summary never returns record values or unknown field names',()=>{
  const summary=summarizeReferenceShape({items:[{id:'secret-id',name:'private-name',custom_customer:'private-detail',description:null},{contactTypeId:1,label:[]}],secret:'no'});
  assert.deepEqual(summary.fields,{id:['string'],name:['string'],label:['array'],description:['null'],contactTypeId:['number']});
  assert.equal(summary.unknownFieldCount,1);assert.equal(summary.liveAclRead,false);
  assert.ok(!JSON.stringify(summary).includes('private'));assert.ok(!JSON.stringify(summary).includes('customer'));
  assert.equal(summarizeReferenceShape(Array(40).fill({id:'a'})).sampledRecords,25);
});
test('UI has no requests on page load and needs explicit gate inspection and confirmation',async()=>{
  const elements=new Map();const requests=[];
  for(const id of ['status-button','run-button','approved','confirmation','gate-status','result','inspect-button','inspection-run-id'])elements.set(id,{disabled:false,checked:false,value:'',textContent:'',listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}});
  const sandbox={document:{getElementById:id=>elements.get(id)},AbortSignal,
    fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>options.method==='GET'?{dbExecutionEnabled:true}:{status:'passed'}};}};
  vm.runInNewContext(await readFile(new URL('public/app.js',root),'utf8'),sandbox);
  assert.equal(requests.length,0);assert.equal(elements.get('run-button').disabled,true);
  await elements.get('run-button').listeners.click();assert.equal(requests.length,0);
  await elements.get('status-button').listeners.click();assert.equal(requests.length,1);assert.equal(requests[0].options.method,'GET');
  assert.equal(elements.get('run-button').disabled,true);
  elements.get('approved').checked=true;elements.get('approved').listeners.change();
  elements.get('confirmation').value='CREATE ONE ISOLATED SYNTHETIC SCHEMA';elements.get('confirmation').listeners.input();
  assert.equal(elements.get('run-button').disabled,false);
  await elements.get('run-button').listeners.click();assert.equal(requests.length,2);assert.equal(requests[1].options.method,'POST');
  assert.equal(requests[1].url,'/api/diagnostic');assert.equal(elements.get('run-button').disabled,true);
  await elements.get('run-button').listeners.click();assert.equal(requests.length,2);
});
test('No ACL key read, live ACL route, external resource or production fallback exists in host',async()=>{
  for(const name of await readdir(new URL('api/',root)))assert.equal(name,'diagnostic.mjs');
  const files=['api/diagnostic.mjs','lib/gates.mjs','lib/neon-runner.mjs','lib/shape-summary.mjs','public/index.html','public/app.js'];
  for(const file of files){const source=await readFile(new URL(file,root),'utf8');assert.doesNotMatch(source,/api\.acculynx\.com|raccoonrestoration\.com|process\.env\.ACCULYNX|env\.ACCULYNX|DATABASE_URL\b|NODE_TLS_REJECT_UNAUTHORIZED/);}
});
test('Production build refuses before any output copy',()=>{
  const build=spawnSync(process.execPath,[new URL('scripts/build.mjs',root).pathname],{encoding:'utf8',env:{VERCEL:'1',VERCEL_ENV:'production'}});
  assert.equal(build.status,1);assert.match(build.stderr,/only be deployed to Preview/);
});
