#!/usr/bin/env node
/** PREPARED ONLY. No database access without --execute-preview-only AND VERCEL_ENV=preview.
 * Creates one NEW random validation schema; retains synthetic data; never cleans
 * existing schemas or invokes ACL. Credentials remain inside this Node process.
 */
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const VERSION='acl-real-neon-validation/v1';
const migrationNames=['001-acl-routing-journal.sql','002-acl-website-receipts.sql','003-acl-shared-api-quota.sql','004-acl-website-submission-sessions.sql'];
const checkedSources=['src/postgres-durability.mjs','src/postgres-routing-store.mjs','src/postgres-website-intake-store.mjs','src/website-intake-bridge.mjs','src/website-submission-sessions.mjs'];
const codeError=code=>Object.assign(new Error(code),{safeCode:code});
const output=body=>process.stdout.write(JSON.stringify(body)+'\n');
// Never serialize raw errors, Pool config, connection strings, query parameters,
// environment, stack traces, hostnames or raw provider responses.
const sanitizedError=e=>({code:typeof e?.safeCode==='string'?e.safeCode:typeof e?.code==='string'&&/^[A-Za-z0-9_]{1,70}$/.test(e.code)?e.code:'validation_failed'});
const requiredCodes=(fn,code)=>assert.rejects(fn,{code});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function readConnection() {
 const raw=process.env.DATABASE_URL_UNPOOLED;
 if(typeof raw!=='string'||!raw)throw codeError('missing_database_url_unpooled');
 let parsed;try{parsed=new URL(raw);}catch{throw codeError('invalid_database_url_unpooled');}
 if(!['postgres:','postgresql:'].includes(parsed.protocol)||parsed.hash||!parsed.username||!parsed.password)throw codeError('invalid_database_url_unpooled');
 const host=parsed.hostname;
 if(!/^ep-[a-z0-9-]+\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+neon\.tech$/.test(host)||host.split('.')[0].includes('-pooler')||(parsed.port&&parsed.port!=='5432'))throw codeError('neon_direct_host_required');
 // URI TLS options are NOT passed to pg. Strict TLS is constructed explicitly.
 for(const key of parsed.searchParams.keys())if(!['sslmode','channel_binding','connect_timeout'].includes(key))throw codeError('unexpected_database_url_option');
 let user,password,database;try{user=decodeURIComponent(parsed.username);password=decodeURIComponent(parsed.password);database=decodeURIComponent(parsed.pathname.slice(1));}catch{throw codeError('invalid_database_url_encoding');}
 if(!database||database.includes('/')||/[\r\n\0]/.test(host+user+database))throw codeError('invalid_database_url_fields');
 return {host,port:5432,user,password,database,enableChannelBinding:true,ssl:{rejectUnauthorized:true,servername:host,minVersion:'TLSv1.2'},max:6,
  connectionTimeoutMillis:15_000,idleTimeoutMillis:10_000,query_timeout:20_000,statement_timeout:15_000,lock_timeout:10_000,
  application_name:'acl-synthetic-validation'};
}

async function main() {
 if(process.argv.includes('--plan')||!process.argv.includes('--execute-preview-only')){
  output({version:VERSION,status:'not_executed',requires:'Explicit approval, --execute-preview-only, VERCEL_ENV=preview, and injected DATABASE_URL_UNPOOLED',scope:'Create one unique isolated schema; apply four migrations once; test separate sessions, advisory exclusion, client destruction, rollback and idempotent replay with synthetic data; retain schema. No ACL calls, no existing-data cleanup, no provider-failover claim.'});return;
 }
 if(process.env.VERCEL_ENV!=='preview')throw codeError('preview_environment_required');
 const connection=readConnection();
 const sourceRoot=resolve(process.env.ACL_VALIDATION_SOURCE_DIR||resolve(dirname(fileURLToPath(import.meta.url)),'../acl-routing-integration'));
 const sourceHash={};const migrations=[];
 for(const name of migrationNames){const text=await readFile(resolve(sourceRoot,'migrations',name),'utf8');sourceHash[`migrations/${name}`]=createHash('sha256').update(text).digest('hex');migrations.push(text);}
 for(const name of checkedSources)sourceHash[name]=createHash('sha256').update(await readFile(resolve(sourceRoot,name))).digest('hex');
 const {Pool}=await import('pg');
 const {createPostgresDurabilityGuard}=await import(pathToFileURL(resolve(sourceRoot,'src/postgres-durability.mjs')).href);
 const {createPostgresRoutingStore}=await import(pathToFileURL(resolve(sourceRoot,'src/postgres-routing-store.mjs')).href);
 const {createPostgresWebsiteIntakeStore}=await import(pathToFileURL(resolve(sourceRoot,'src/postgres-website-intake-store.mjs')).href);
 const rawPool=new Pool(connection);rawPool.on('error',()=>{});rawPool.on('connect',client=>client.on('error',()=>{}));
 const databaseDurability={profile:'neon-managed',approvedHost:connection.host};
 const assertWritable=createPostgresDurabilityGuard({...databaseDurability,pool:rawPool});
 const runId=randomUUID();const schema=`acl_validation_${runId.replaceAll('-','')}`;
 assert.match(schema,/^acl_validation_[0-9a-f]{32}$/);
 const quotedSchema=`"${schema}"`;const results=[];let created=false;let stage='database_health';
 const acquiredClients=new Set();
 async function connectRaw(){const c=await rawPool.connect();acquiredClients.add(c);return c;}
 function release(c,broken=false){if(!acquiredClients.delete(c))return;c.release(broken?new Error('synthetic_validation_session_closed'):undefined);}
 // Each adapter connection has its own physical PostgreSQL session. This wrapper
 // does not transparently reconnect or replay a failed SQL operation.
 const pool={options:rawPool.options,connect:async()=>{
  const c=await rawPool.connect();
  try{await c.query(`SET search_path TO ${quotedSchema}, pg_catalog`);return c;}
  catch{c.release(new Error('validation_search_path_failed'));throw codeError('validation_search_path_failed');}
 }};
 const q=async(sql,values=[])=>{const c=await pool.connect();try{return await c.query(sql,values);}finally{c.release();}};
 async function check(name,fn){stage=name;await fn();results.push({name,status:'passed'});output({version:VERSION,runId,schema,check:name,status:'passed'});}
 try {
  let c=await connectRaw();try{await assertWritable((sql,values)=>c.query(sql,values));}finally{release(c);}
  // Fresh-only: schema name generated in-process, never supplied by a caller.
  stage='create_unique_schema';c=await connectRaw();
  try{
   const existing=await c.query('SELECT oid FROM pg_namespace WHERE nspname=$1',[schema]);
   if(existing.rows.length)throw codeError('validation_schema_already_exists');
   await c.query(`CREATE SCHEMA ${quotedSchema}`);created=true;
   await c.query(`SET search_path TO ${quotedSchema}, pg_catalog`);
   for(let i=0;i<migrations.length;i++){
    stage=`apply_${migrationNames[i]}`;
    // The schema was created exclusively above; no IF NOT EXISTS, retries,
    // manual split/replay or fallback into public/production schemas.
    await c.query(migrations[i]);
   }
   const count=await c.query('SELECT count(*)::int n FROM pg_tables WHERE schemaname=$1',[schema]);assert.equal(count.rows[0].n,10);
  }finally{release(c);}
  results.push({name:'fresh_schema_all_four_migrations',status:'passed'});
  output({version:VERSION,runId,schema,status:'schema_ready',sourceHash});
  await check('independent_sessions_advisory_exclusion_and_client_disconnect',async()=>{
   const a=await connectRaw(),b=await connectRaw();let aReleased=false;let bLocked=false;const lockName=`acl-validation:${runId}`;
   try{
    const pa=(await a.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,pb=(await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;assert.notEqual(pa,pb);
    assert.equal((await a.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',[lockName])).rows[0].acquired,true);
    assert.equal((await b.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',[lockName])).rows[0].acquired,false);
    release(a,true);aReleased=true; // Destroys the client connection; not failover.
    const deadline=Date.now()+15_000;
    while(Date.now()<deadline){bLocked=(await b.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',[lockName])).rows[0].acquired;if(bLocked)break;await sleep(100);}
    assert.equal(bLocked,true);
   }finally{
    if(!aReleased)release(a,true);
    if(bLocked){const result=await b.query('SELECT pg_advisory_unlock(hashtextextended($1,0)) AS released',[lockName]);assert.equal(result.rows[0].released,true);}release(b);
   }
  });
  await check('cross_session_transaction_rollback_visibility',async()=>{
   const id=randomUUID();const c=await pool.connect();
   try{
    await c.query('BEGIN');await c.query("SET LOCAL synchronous_commit='on'");
    await c.query("INSERT INTO acl_routing_followups(job_id,kind,reason) VALUES($1,'schedule_inspection','no_time_requested')",[id]);
    assert.equal((await q('SELECT count(*)::int n FROM acl_routing_followups WHERE job_id=$1',[id])).rows[0].n,0);
    await c.query('ROLLBACK');assert.equal((await q('SELECT count(*)::int n FROM acl_routing_followups WHERE job_id=$1',[id])).rows[0].n,0);
   }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
  });
  const routing=createPostgresRoutingStore({pool,databaseDurability});
  await check('durable_attempt_marker_and_idempotent_replay',async()=>{
   const jobId=randomUUID(),representativeId=randomUUID();const intent={jobId,representativeId};
   const markerPids=[];
   const oneUsePool={options:pool.options,connect:async()=>{
    const c=await pool.connect();markerPids.push((await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    return {query:c.query.bind(c),on:c.on.bind(c),removeListener:c.removeListener.bind(c),release:cause=>c.release(cause||new Error('synthetic_validation_destroy_after_operation'))};
   }};
   const markerStore=createPostgresRoutingStore({pool:oneUsePool,databaseDurability});
   await markerStore.runExclusive(jobId,async j=>{await j.prepare(intent);await j.markAttempted('assignment');
    const saved=await q('SELECT attempt_count,status FROM acl_routing_steps WHERE job_id=$1 AND phase=$2',[jobId,'assignment']);assert.deepEqual(saved.rows,[{attempt_count:1,status:'attempted'}]);
   });
   // The first physical connection was destroyed after unlock. A new adapter
   // must observe the committed attempt on a different backend, not cached state.
   const replay=createPostgresRoutingStore({pool:oneUsePool,databaseDurability});
   await requiredCodes(()=>replay.runExclusive(jobId,async j=>{const saved=await j.prepare(intent);assert.equal(saved.steps.assignment.attemptCount,1);await j.markAttempted('assignment');}),'journal_transition_rejected');
   assert.equal(markerPids.length,2);assert.notEqual(markerPids[0],markerPids[1]);
   const events=await q("SELECT count(*)::int n FROM acl_routing_events WHERE job_id=$1 AND event='attempted'",[jobId]);assert.equal(events.rows[0].n,1);
  });
  await check('synthetic_receipt_outbox_and_queue_replay',async()=>{
   const receipts=createPostgresWebsiteIntakeStore({pool,databaseDurability});
   const submissionId=`rr-realdb-${randomUUID()}`,jobId=randomUUID(),contactId=randomUUID();
   const receiptInput={version:1,submissionId,payloadHash:createHash('sha256').update(`synthetic:${runId}`).digest('hex'),requestedAppointment:null};
   await receipts.runExclusive(submissionId,async j=>{await j.prepare(receiptInput);await j.recordContact(contactId);await j.markAttempted('job');await j.acceptJob(jobId);});
   const accepted=await receipts.runExclusive(submissionId,j=>j.prepare(receiptInput));assert.equal(accepted.status,'accepted');assert.equal(accepted.jobId,jobId);
   assert.equal((await routing.enqueueAcceptedLead({jobId,submissionId})).duplicate,false);
   assert.equal((await routing.enqueueAcceptedLead({jobId,submissionId})).duplicate,true);
   await receipts.runExclusive(submissionId,j=>j.markOutboxDelivered());
   const saved=await q('SELECT status FROM acl_website_outbox WHERE submission_id=$1',[submissionId]);assert.equal(saved.rows[0].status,'delivered');
  });
  await check('migration_does_not_activate_any_intake_epoch',async()=>{
   assert.equal((await q('SELECT count(*)::int n FROM acl_website_intake_epochs')).rows[0].n,0);
  });
  output({version:VERSION,runId,schema,status:'passed',results,sourceHash,retainedSyntheticData:true,limitations:['Client-disconnect behavior is not provider failover or crash-durability proof.','No live ACL, calendar, website routing or real intake isolation was tested.','No real v2 cutover epoch was activated.','Synthetic committed data and the unique schema are retained for inspection.']});
 } catch(e) {
  output({version:VERSION,runId,schema,schemaCreationConfirmed:created,status:'failed',stage,error:sanitizedError(e),results,retainedSyntheticData:created});process.exitCode=1;
 } finally {
  for(const c of [...acquiredClients]){try{release(c,true);}catch{}}
  await rawPool.end();
 }
}
main().catch(e=>{output({version:VERSION,status:'not_completed',error:sanitizedError(e)});process.exitCode=1;});
