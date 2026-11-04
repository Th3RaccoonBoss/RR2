import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { runNeonValidation, sanitizeEvent } from '../lib/neon-runner.mjs';
import { GRANT } from '../lib/gates.mjs';
const NOW=Date.parse('2026-11-04T14:00:00.000Z');
const environment=()=>({VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:'probe.vercel.app',ACL_PREVIEW_PROTECTION_VERIFIED:'1',ACL_PREVIEW_DB_GRANT:GRANT,
  ACL_PREVIEW_DB_GRANT_NOT_BEFORE:new Date(NOW-1000).toISOString(),ACL_PREVIEW_DB_GRANT_EXPIRES_AT:new Date(NOW+120000).toISOString(),DATABASE_URL_UNPOOLED:'synthetic-placeholder-not-a-real-credential',ACCULYNX_API_KEY:'must-not-be-forwarded',NODE_OPTIONS:'--require bad',PGHOST:'unexpected',HTTPS_PROXY:'unexpected'});
const resultNames=['fresh_schema_all_four_migrations','independent_sessions_advisory_exclusion_and_client_disconnect','cross_session_transaction_rollback_visibility','durable_attempt_marker_and_idempotent_replay','synthetic_receipt_outbox_and_queue_replay','migration_does_not_activate_any_intake_epoch'];
const completion={version:'acl-real-neon-validation/v1',status:'passed',runId:'11111111-1111-4111-8111-111111111111',schema:'acl_validation_11111111111141118111111111111111',results:resultNames.map(name=>({name,status:'passed'})),retainedSyntheticData:true};
const fakeChild=()=>{const child=new EventEmitter();child.stdout=new EventEmitter();child.kill=()=>{child.killed=true;};return child;};

test('Runner independently checks grant before reading database credentials',async()=>{
  for(const env of [{},{...environment(),VERCEL_ENV:'production'},{...environment(),ACL_PREVIEW_DB_GRANT:'disabled'}]){
    Object.defineProperty(env,'DATABASE_URL_UNPOOLED',{get(){assert.fail('credential read');}});
    const result=await runNeonValidation({env,now:NOW,spawnImpl:()=>assert.fail('spawned')});assert.equal(result.executed,false);
  }
});
test('Missing direct URL fails closed without pooled URL fallback',async()=>{
  const env=environment();delete env.DATABASE_URL_UNPOOLED;env.DATABASE_URL='must-not-be-used';
  const result=await runNeonValidation({env,now:NOW,spawnImpl:()=>assert.fail('spawned')});
  assert.equal(result.code,'missing_database_url_unpooled');assert.equal(result.executed,false);
});
test('Child reuses unmodified validator; only minimal environment is passed',async()=>{
  const env=environment();let captured;
  const result=await runNeonValidation({env,now:NOW,spawnImpl:(exe,args,options)=>{
    captured={exe,args,options};const child=fakeChild();
    queueMicrotask(()=>{child.stdout.emit('data',Buffer.from(JSON.stringify({...completion,password:'SHOULD_NOT_ESCAPE',sourceHash:{private:'secret'}})+'\n'));child.emit('close',0);});return child;
  }});
  assert.equal(result.status,'passed');assert.equal(captured.exe,process.execPath);
  assert.ok(captured.args[0].endsWith('/vendor/acl-postgres-validation/real-neon-validation.mjs'));
  assert.deepEqual(captured.args.slice(1),['--execute-preview-only']);assert.equal(captured.options.shell,false);
  assert.deepEqual(Object.keys(captured.options.env).sort(),['ACL_VALIDATION_SOURCE_DIR','DATABASE_URL_UNPOOLED','VERCEL_ENV']);
  assert.deepEqual(captured.options.stdio,['ignore','pipe','ignore']);
  assert.ok(!JSON.stringify(result).includes('SHOULD_NOT_ESCAPE'));assert.equal(result.retried,false);assert.equal(result.aclCalled,false);
});
test('Unexpected values, messages, stack traces and raw records are stripped',()=>{
  const safe=sanitizeEvent({...completion,check:'private field',stage:'private stage',error:{code:'secret-http-url',message:'secret'},results:[{name:'private',status:'passed'}]});
  assert.equal(safe.error.code,'validation_failed');assert.deepEqual(safe.results,[]);assert.ok(!JSON.stringify(safe).includes('private'));
  assert.equal(sanitizeEvent({version:'unknown',status:'passed'}),null);
});
test('Timeout kills child and reports uncertain outcome without replay',async()=>{
  let child,calls=0;
  const result=await runNeonValidation({env:environment(),now:NOW,limitMs:10,spawnImpl:()=>{calls++;return child=fakeChild();}});
  assert.equal(result.status,'needs_inspection');assert.equal(result.mutationOutcome,'uncertain_inspect_before_retry');assert.equal(calls,1);assert.equal(child.killed,true);
});
test('Output limit kills child; malformed and incomplete output cannot pass',async()=>{
  let child;
  const result=await runNeonValidation({env:environment(),now:NOW,spawnImpl:()=>{
    child=fakeChild();queueMicrotask(()=>child.stdout.emit('data',Buffer.alloc(128001,97)));return child;
  }});
  assert.equal(child.killed,true);assert.equal(result.code,'output_limit_outcome_uncertain');assert.deepEqual(result.events,[]);
  const malformed=await runNeonValidation({env:environment(),now:NOW,spawnImpl:()=>{const c=fakeChild();queueMicrotask(()=>{c.stdout.emit('data',Buffer.from('RAW SECRET\n{"status":"passed"}\n'));c.emit('close',0);});return c;}});
  assert.equal(malformed.status,'needs_inspection');assert.ok(!JSON.stringify(malformed).includes('SECRET'));
});
