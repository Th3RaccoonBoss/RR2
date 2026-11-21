// Direct authenticated Neon MCP transport; fixed project/branch/database/role only.
// Never concatenate email data into SQL. Encoded payload contains minimal metadata.
export const NEON_TARGET=Object.freeze({project_id:'synthetic-permit-review',branch_id:'br-synthetic-review',database_name:'permit_pilot',role_name:'permit_pilot_worker'});
const ACCOUNT='link_00000000000000000000000000000000';
export function makeQueueInsert(candidate,{synthetic=false}={}){
 if(!candidate||candidate.state!=='awaiting_owner_review'||!Array.isArray(candidate.allowedActions)||candidate.allowedActions.length||!/^[a-f0-9]{16}$/.test(candidate.messageId)||candidate.key!==`${ACCOUNT}:${candidate.messageId}`)throw Error('candidate_not_review_only');
 if(candidate.jobId!==null&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(candidate.jobId))throw Error('invalid_job_id');
 if(candidate.tradeHint!==null&&!['roof','siding'].includes(candidate.tradeHint))throw Error('invalid_trade');
 if(candidate.reviewBlockers!==undefined&&(!Array.isArray(candidate.reviewBlockers)||candidate.reviewBlockers.some(x=>x!=='task_title_confirmation_required')))throw Error('invalid_review_blocker');
 const key=(synthetic?'synthetic:connector:':'')+candidate.key;
 const p={schemaVersion:1,source:'gmail_connector',mailbox:'info@raccoonrestoration.com',messageId:candidate.messageId,jobId:candidate.jobId,tradeHint:candidate.tradeHint,synthetic};
 const result={state:'awaiting_owner_review',blockers:['task_authority_unverified','acl_job_revalidation_required',...new Set(candidate.reviewBlockers||[])],allowedExternalActions:[]};
 const encode=v=>Buffer.from(JSON.stringify(v),'utf8').toString('base64');
 // Base64 alphabet excludes SQL quotes, backslashes, delimiters and control chars.
 const payload=encode(p),state=encode(result),keyEncoded=Buffer.from(key).toString('base64');
 const lit=x=>`convert_from(decode('${x}','base64'),'UTF8')`;
 return {...NEON_TARGET,sql:`INSERT INTO public.permit_requests(key,payload,status,result) VALUES(${lit(keyEncoded)},${lit(payload)},'manual_review',${lit(state)}::jsonb) ON CONFLICT(key) DO NOTHING RETURNING key,status`};
}
export function makeMarkNotified(key,messageId){
 if(!key.startsWith(ACCOUNT+':')||!/^[a-f0-9]{16}$/.test(key.slice(ACCOUNT.length+1))||typeof messageId!=='string'||messageId.length<1||messageId.length>200||/[\u0000-\u001f]/.test(messageId))throw Error('invalid_notification_identity');
 const lit=x=>`convert_from(decode('${Buffer.from(x).toString('base64')}','base64'),'UTF8')`;
 return {...NEON_TARGET,sql:`UPDATE public.permit_requests SET result=jsonb_set(result,'{notification_message_id}',to_jsonb(${lit(messageId)}),true) WHERE key=${lit(key)} AND NOT(result ? 'notification_message_id') RETURNING key`};
}
