import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createHandler} from '../api/diagnostic.mjs';
import {GRANT,CONFIRMATION,INSPECTION_GRANT,INSPECTION_CONFIRMATION,inspectionGate} from '../lib/gates.mjs';
import {inspectValidationSchemas,sanitizeInspection,TABLES} from '../lib/inspection-core.mjs';
import {runReadonlyInspection} from '../lib/inspection-runner.mjs';
import {readonlyConnectionOptions} from '../lib/neon-readonly-options.mjs';

const NOW=Date.parse('2026-11-04T15:00:00.000Z');
const RUN='11111111-1111-4111-8111-111111111111',SCHEMA='acl_validation_11111111111141118111111111111111';
const env=()=>({VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'probe.vercel.app',ACL_PREVIEW_PROTECTION_VERIFIED:'1',
  ACL_PREVIEW_INSPECTION_GRANT:INSPECTION_GRANT,ACL_PREVIEW_INSPECTION_NOT_BEFORE:new Date(NOW-1000).toISOString(),ACL_PREVIEW_INSPECTION_EXPIRES_AT:new Date(NOW+120000).toISOString()});
const request=body=>({method:'POST',headers:{origin:'https://probe.vercel.app','content-type':'application/json','x-acl-preview-action':'explicit-operator-click'},body});
const readBody={action:'inspect-validation-schemas',confirmation:INSPECTION_CONFIRMATION};
async function invoke(handler,req){let body;const res={statusCode:0,setHeader(){},end:text=>{body=JSON.parse(text);}};await handler(req,res);return {status:res.statusCode,body};}
function clientFixture({schemas=[SCHEMA],mode='on',count=0}={}) {
  const queries=[];
  return {queries,query:async(sql,values=[])=>{
    queries.push({sql,values});
    if(sql.includes("current_setting('transaction_read_only')"))return {rows:[{mode}]};
    if(sql.startsWith('SELECT nspname'))return {rows:schemas.map(nspname=>({nspname}))};
    if(sql.startsWith('SELECT c.relname'))return {rows:TABLES.map(relname=>({relname}))};
    if(sql.startsWith('SELECT pg_catalog.count'))return {rows:[{n:count}]};
    return {rows:[]};
  }};
}
test('Separate read-only grant accepts expired mutation window without re-enabling it',async()=>{
  const e={...env(),ACL_PREVIEW_DB_GRANT:GRANT,ACL_PREVIEW_DB_GRANT_NOT_BEFORE:new Date(NOW-120000).toISOString(),ACL_PREVIEW_DB_GRANT_EXPIRES_AT:new Date(NOW-1000).toISOString()};
  let readCalls=0;
  const handler=createHandler({env:e,clock:()=>NOW,runner:()=>assert.fail('mutation ran'),inspector:async()=>{readCalls++;return {status:'inspected',readOnly:true,mutationRearmed:false};}});
  assert.equal((await invoke(handler,request(readBody))).status,200);
  assert.equal((await invoke(handler,request({action:'neon-synthetic-validation',confirmation:CONFIRMATION}))).status,403);
  assert.equal((await invoke(handler,{method:'GET',headers:{}})).body.dbExecutionEnabled,false);assert.equal(readCalls,1);
});
test('Read-only action never resets warm-instance mutation attempt',async()=>{
  const e={...env(),ACL_PREVIEW_DB_GRANT:GRANT,ACL_PREVIEW_DB_GRANT_NOT_BEFORE:new Date(NOW-1000).toISOString(),ACL_PREVIEW_DB_GRANT_EXPIRES_AT:new Date(NOW+120000).toISOString()};
  let writes=0;
  const handler=createHandler({env:e,clock:()=>NOW,runner:async()=>{writes++;return {status:'needs_inspection'};},inspector:async()=>({status:'inspected',readOnly:true,mutationRearmed:false})});
  const mutate=request({action:'neon-synthetic-validation',confirmation:CONFIRMATION});
  await invoke(handler,mutate);assert.equal((await invoke(handler,request(readBody))).status,200);
  assert.equal((await invoke(handler,mutate)).status,409);assert.equal(writes,1);
});
test('Read-only grant absent, expired or longer than 30 minutes fails closed',()=>{
  assert.equal(inspectionGate(env(),NOW),null);
  for(const changes of [{ACL_PREVIEW_INSPECTION_GRANT:'disabled'},{ACL_PREVIEW_INSPECTION_EXPIRES_AT:new Date(NOW).toISOString()},{ACL_PREVIEW_INSPECTION_EXPIRES_AT:new Date(NOW+1800000).toISOString()},{VERCEL_ENV:'production'},{ACL_PREVIEW_PROTECTION_VERIFIED:'0'}])assert.ok(inspectionGate({...env(),...changes},NOW));
});
test('Inspection rejects SQL/schema/table/URL inputs and invalid run IDs',async()=>{
  const handler=createHandler({env:env(),clock:()=>NOW,inspector:()=>assert.fail('inspector ran')});
  for(const change of [{sql:'SELECT * FROM public.customers'},{schema:'public'},{table:'acl_routing_intents'},{url:'https://evil.test'},{runId:'public'},{runId:'../secret'}]){
    assert.equal((await invoke(handler,request({...readBody,...change}))).status,400);
  }
  const req=request(readBody);req.headers.origin='https://evil.test';assert.equal((await invoke(handler,req)).status,403);
});
test('Inspection uses read-only transaction, fixed catalog filter and bounded ONLY scans',async()=>{
  const client=clientFixture({count:501});const result=await inspectValidationSchemas({client,runId:RUN});
  assert.equal(client.queries[0].sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(client.queries.at(-1).sql,'ROLLBACK');
  assert.equal(result.schemas.length,1);assert.equal(result.schemas[0].tables.length,10);
  assert.equal(result.schemas[0].tables[0].rowCount,500);assert.equal(result.schemas[0].tables[0].truncated,true);
  assert.equal(result.validationSuccessProven,false);assert.equal(result.mutationRearmed,false);
  const catalog=client.queries.find(q=>q.sql.startsWith('SELECT nspname'));assert.deepEqual(catalog.values,[SCHEMA]);assert.match(catalog.sql,/LIMIT 11$/);
  const scans=client.queries.filter(q=>q.sql.startsWith('SELECT pg_catalog.count'));assert.equal(scans.length,10);
  for(const q of scans){assert.match(q.sql,/FROM ONLY "acl_validation_[0-9a-f]{32}"\."acl_[a-z_]+" LIMIT 501/);assert.doesNotMatch(q.sql,/public|INSERT|UPDATE|DELETE|CREATE|DROP|FOR UPDATE/);}
});
test('Unknown or missing schema lists at most 10 entries without claiming newest-first',async()=>{
  const schemas=Array.from({length:11},(_,i)=>`acl_validation_${i.toString(16).padStart(32,'0')}`);
  const result=await inspectValidationSchemas({client:clientFixture({schemas})});assert.equal(result.schemas.length,10);assert.equal(result.truncated,true);
  const empty=await inspectValidationSchemas({client:clientFixture({schemas:[]}),runId:RUN});assert.deepEqual(empty.schemas,[]);assert.equal(empty.validationSuccessProven,false);
});
test('Readonly assertion and catalog identifier violations abort before table reads',async()=>{
  for(const options of [{mode:'off'},{schemas:['public']},{schemas:['acl_validation_bad;DROP']}]){
    const client=clientFixture(options);await assert.rejects(()=>inspectValidationSchemas({client}));
    assert.ok(!client.queries.some(q=>q.sql.startsWith('SELECT pg_catalog.count')));assert.equal(client.queries.at(-1).sql,'ROLLBACK');
  }
});
test('Sanitization removes unexpected metadata and never returns raw row values',async()=>{
  const result=await inspectValidationSchemas({client:clientFixture()});result.secret='private';result.schemas[0].customer='private';result.schemas[0].tables[0].rows=[{name:'private'}];
  const safe=sanitizeInspection(result);assert.ok(!JSON.stringify(safe).includes('private'));assert.ok(!JSON.stringify(safe).includes('customer'));
  result.schemas[0].schema='public';assert.equal(sanitizeInspection(result),null);
});
test('Readonly connection is direct Neon, certificate-verified and default read-only',()=>{
  const options=readonlyConnectionOptions('postgresql://synthetic:fake@ep-test.us-east-1.aws.neon.tech/example?sslmode=require');
  assert.equal(options.ssl.rejectUnauthorized,true);assert.equal(options.ssl.servername,options.host);assert.equal(options.ssl.minVersion,'TLSv1.2');assert.equal(options.connectionString,undefined);assert.equal(options.options,'-c default_transaction_read_only=on');
  assert.equal(options.enableChannelBinding,true);
  for(const url of ['postgres://x:y@ep-test-pooler.us-east-1.aws.neon.tech/db','postgres://x:y@localhost/db','postgres://x:y@ep-test.us-east-1.aws.neon.tech:5433/db','postgres://x:y@ep-test.us-east-1.aws.neon.tech/db?options=-c%20role%3Dadmin'])assert.throws(()=>readonlyConnectionOptions(url));
});
test('Inspection child has only direct credential and optional validated run ID; timeout is finite',async()=>{
  let spawned;
  const e={...env(),DATABASE_URL_UNPOOLED:'synthetic-placeholder',ACCULYNX_API_KEY:'never-pass'};
  const safe=await inspectValidationSchemas({client:clientFixture()});
  const result=await runReadonlyInspection({env:e,now:NOW,runId:RUN,spawnImpl:(exe,args,options)=>{
    spawned={exe,args,options};const child=new EventEmitter();child.stdout=new EventEmitter();child.kill=()=>{};
    queueMicrotask(()=>{child.stdout.emit('data',Buffer.from(JSON.stringify(safe)+'\n'));child.emit('close',0);});return child;
  }});
  assert.equal(result.status,'inspected');assert.deepEqual(Object.keys(spawned.options.env).sort(),['ACL_INSPECTION_RUN_ID','DATABASE_URL_UNPOOLED','VERCEL_ENV']);assert.equal(spawned.options.shell,false);
  let killed=false;
  const timeout=await runReadonlyInspection({env:e,now:NOW,limitMs:5,spawnImpl:()=>{const c=new EventEmitter();c.stdout=new EventEmitter();c.kill=()=>{killed=true;};return c;}});
  assert.equal(killed,true);assert.equal(timeout.status,'inspection_incomplete');assert.equal(timeout.mutationRearmed,false);
});
test('Disabled inspection does not read credentials or launch child',async()=>{
  const e={...env(),ACL_PREVIEW_INSPECTION_GRANT:'disabled'};Object.defineProperty(e,'DATABASE_URL_UNPOOLED',{get(){assert.fail('credential read');}});
  const result=await runReadonlyInspection({env:e,now:NOW,spawnImpl:()=>assert.fail('spawned')});assert.equal(result.executed,false);
});
