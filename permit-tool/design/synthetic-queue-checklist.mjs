// Offline synthetic rehearsal only. No SQL execution, caller-supplied HTTP, or live credentials.
import {reviewQueuedJob} from './acl-queue-review.mjs';
import {planJolietReview} from './joliet-review-stage.mjs';

export async function rehearseQueueChecklist(row,{readMockJob,now=Date.now,knownKeys=new Set()}={}){
 const stop=(reason,state='blocked')=>({state,synthetic:true,reason,allowedExternalActions:[]});
 if(!(knownKeys instanceof Set))return stop('invalid_dedup_state');
 if(typeof row?.key!=='string'||!row.key.startsWith('synthetic:connector:'))return stop('synthetic_queue_required');
 if(knownKeys.has(row.key))return stop('already_reviewed','duplicate');
 const review=await reviewQueuedJob(row,{readJob:readMockJob,now,syntheticTest:true});
 if(review.state!=='test_job_identity_verified')return stop(review.reason);
 // Illustrative Joliet checklist only; no jurisdiction attestation even with matching identity.
 const result=planJolietReview({
  queue:{jobId:review.jobId,tradeHint:review.tradeHint},
  job:{id:review.jobId,jobNumber:review.jobReference,fetchedAt:review.fetchedAt,source:'authenticated_acl_get'},
  now:now()
 });
 return {...result,synthetic:true,queueUnchanged:true,
  blockers:[...new Set([...result.blockers,...review.blockers])],
  allowedExternalActions:[]};
}
