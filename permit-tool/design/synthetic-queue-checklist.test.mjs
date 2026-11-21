import test from 'node:test';
import assert from 'node:assert/strict';
import {queueCandidate} from '../email-intake.mjs';
import {makeQueueInsert} from '../connector-queue-sql.mjs';
import {createAclReader} from '../acl-reader.mjs';
import {preparePilotChecklist} from '../pilot-checklist.mjs';
import {reviewQueuedJob} from './acl-queue-review.mjs';
import {rehearseQueueChecklist} from './synthetic-queue-checklist.mjs';

const ID='12345678-2222-4333-8444-555555555555';
const now=()=>Date.parse('2026-11-21T13:00:00Z');
const message={id:'1234567890abcdef',linkId:'link_00000000000000000000000000000000',connectorRead:true,
 from:'do-not-reply@mail.acculynx.com',subject:'[AccuLynx] New Task: PERMIT REQUEST - ROOFING',
 extractedHrefs:[`https://my.acculynx.com/?module=Jobs_Edit&JobID=${ID}`]};
const lookup=(patch={})=>({id:ID,jobNumber:'TEST-003',source:'authenticated_acl_get',fetchedAt:new Date(now()).toISOString(),...patch});
const syntheticRow=(m=message)=>{
 const candidate=queueCandidate(m,null);
 const {sql}=makeQueueInsert(candidate,{synthetic:true});
 const [key,payload,result]=Array.from(sql.matchAll(/decode\('([A-Za-z0-9+/=]+)'/g),([,v])=>Buffer.from(v,'base64').toString('utf8'));
 assert.match(sql,/ON CONFLICT\(key\) DO NOTHING/);
 return {key,payload,status:'manual_review',result:JSON.parse(result)};
};
test('mock notice → generated queue write → read-only job → review checklist',async()=>{
 const row=syntheticRow(),before=JSON.stringify(row);
 let reads=0;
 const readMockJob=createAclReader({apiKey:'dummy-test-key',allowedJobIds:[ID],expiresAt:now()+1000,now,fetcher:async(url,options)=>{
  reads++;assert.equal(url,`https://api.acculynx.com/api/v2/jobs/${ID}`);assert.equal(options.method,'GET');
  return new Response(JSON.stringify({id:ID,jobNumber:'TEST-003',contacts:['not retained']}),
   {headers:{'content-type':'application/json'}});
 }});
 const r=await rehearseQueueChecklist(row,{readMockJob,now});
 assert.equal(reads,1);assert.equal(r.jobMatched,true);assert.equal(r.synthetic,true);
 assert.equal(r.requirementsVerifiedForJob,false);assert.ok(r.blockers.includes('contract_document_required'));
 assert.ok(r.blockers.includes('jurisdiction_confirmation_required'));assert.deepEqual(r.allowedExternalActions,[]);
 assert.equal(JSON.stringify(row),before);assert.ok(!JSON.stringify(r).includes('contacts'));
 assert.equal((await reviewQueuedJob(row,{readJob:readMockJob,now})).reason,'invalid_queue_row');assert.equal(reads,1);
});
test('wrong mailbox, duplicate, missing link, expired or wrong job remain blocked',async()=>{
 assert.equal(queueCandidate({...message,linkId:'wrong'},null).state,'reject');
 const row=syntheticRow();
 assert.equal((await rehearseQueueChecklist(row,{knownKeys:new Set([row.key])})).state,'duplicate');
 assert.equal((await rehearseQueueChecklist(syntheticRow({...message,extractedHrefs:[]}),{now})).reason,'job_mapping_required');
 for(const patch of [{id:'wrong'},{fetchedAt:new Date(now()-300001).toISOString()}]){
  assert.equal((await rehearseQueueChecklist(row,{now,readMockJob:async()=>lookup(patch)})).reason,'fresh_matching_job_required');
 }
 assert.equal((await rehearseQueueChecklist(row,{now,readMockJob:async()=>({state:'blocked',reason:'pilot_expired'})})).reason,'pilot_expired');
});
test('checklist cannot match a missing ID or empty number or drop title blockers',()=>{
 const missing=preparePilotChecklist({...message,extractedHrefs:[]},lookup({id:null}),{now:now()});
 assert.equal(missing.jobVerified,false);assert.match(missing.reasons.join(' '),/ambiguous ACL job link/);
 assert.equal(preparePilotChecklist(message,lookup({jobNumber:' '}),{now:now()}).jobVerified,false);
 assert.equal(preparePilotChecklist(message,lookup(),{knownKeys:new Set([queueCandidate(message,null).key])}).state,'duplicate');
 const truncated=preparePilotChecklist({...message,subject:'[AccuLynx] New Task: Roofing permit req…'},lookup(),{now:now()});
 assert.deepEqual(truncated.reviewBlockers,['task_title_confirmation_required']);
});
