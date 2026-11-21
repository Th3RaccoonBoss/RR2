// Test-only read bridge. No writes, queue mutation, network configuration or authority grants.
const ACCOUNT='link_00000000000000000000000000000000';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export async function reviewQueuedJob(row,{readJob,now=Date.now,syntheticTest=false}={}){
 const blocked=reason=>({state:'blocked',reason,allowedExternalActions:[]});
 let p,r;try{p=typeof row?.payload==='string'?JSON.parse(row.payload):row?.payload;r=typeof row?.result==='string'?JSON.parse(row.result):row?.result;}catch{return blocked('invalid_queue_row');}
 if(!p||p.schemaVersion!==1||p.source!=='gmail_connector'||p.mailbox!=='info@raccoonrestoration.com'||p.synthetic!==(syntheticTest===true)||!/^[a-f0-9]{16}$/.test(p.messageId)||row.key!==(syntheticTest===true?'synthetic:connector:':'')+ACCOUNT+':'+p.messageId||row.status!=='manual_review'||r?.state!=='awaiting_owner_review'||!Array.isArray(r.blockers)||!r.blockers.includes('task_authority_unverified')||!r.blockers.includes('acl_job_revalidation_required')||!Array.isArray(r.allowedExternalActions)||r.allowedExternalActions.length)return blocked('invalid_queue_row');
 if(!UUID.test(p.jobId||''))return blocked('job_mapping_required');
 if(typeof readJob!=='function')return blocked('reader_unavailable');
 let job;try{job=await readJob(p.jobId);}catch{return blocked('acl_read_failed');}
 const knownReadFailures=new Set(['pilot_expired','job_not_allowed','acl_read_failed','unsupported_response','empty_response','response_too_large','job_identity_mismatch','unsupported_job_number']);
 if(job?.state==='blocked'&&knownReadFailures.has(job.reason))return blocked(job.reason);
 const time=Date.parse(job?.fetchedAt),clock=now();
 if(job?.source!=='authenticated_acl_get'||job.id!==p.jobId||typeof job.jobNumber!=='string'||!job.jobNumber.trim()||job.jobNumber.length>100||!Number.isFinite(time)||time>clock||clock-time>300000)return blocked('fresh_matching_job_required');
 return {state:'test_job_identity_verified',synthetic:p.synthetic,key:row.key,jobId:p.jobId,jobReference:job.jobNumber,fetchedAt:job.fetchedAt,tradeHint:p.tradeHint=== 'roof'||p.tradeHint==='siding'?p.tradeHint:null,queueUnchanged:true,
 blockers:[...new Set([...r.blockers,'task_status_unverified','jurisdiction_confirmation_required','scope_confirmation_required'])],
 nextStep:'Verify task authority and current city requirements; identity alone grants no collection or submission authority',allowedExternalActions:[]};
}
