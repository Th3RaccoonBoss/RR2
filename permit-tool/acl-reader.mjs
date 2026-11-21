// Server-only library; no HTTP endpoint, credential storage, deployment or scheduler.
// Operator configuration is never accepted from email/task content.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function createAclReader({apiKey,allowedJobIds,expiresAt,fetcher=globalThis.fetch,now=Date.now}) {
 if(typeof apiKey!=='string'||!apiKey.trim()||/[\r\n]/.test(apiKey))throw new Error('invalid_server_configuration');
 if(!Array.isArray(allowedJobIds)||!allowedJobIds.length||allowedJobIds.length>10||allowedJobIds.some(id=>typeof id!=='string'||!UUID.test(id)))throw new Error('invalid_job_allowlist');
 const allow=new Set(allowedJobIds);
 const created=now();
 if(!Number.isSafeInteger(expiresAt)||expiresAt<=created||expiresAt-created>14*86400000)throw new Error('invalid_pilot_expiration');
 return async function readJob(jobId){
  const fail=reason=>({state:'blocked',reason,allowedExternalActions:[]});
  if(now()>=expiresAt)return fail('pilot_expired');
  if(typeof jobId!=='string'||!UUID.test(jobId)||!allow.has(jobId))return fail('job_not_allowed');
  let reader;
  try {
   const response=await fetcher('https://api.acculynx.com/api/v2/jobs/'+jobId,{
    method:'GET',headers:{Authorization:'Bearer '+apiKey,Accept:'application/json'},
    redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)
   });
   if(!response.ok)return fail('acl_read_failed');
   if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''))return fail('unsupported_response');
   // Bound bytes while streaming, not after allocating an unbounded response.
   reader=response.body?.getReader();if(!reader)return fail('empty_response');
   const chunks=[];let size=0;
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144){await reader.cancel();return fail('response_too_large');}chunks.push(value);}
   const raw=new Uint8Array(size);let offset=0;for(const c of chunks){raw.set(c,offset);offset+=c.length;}
   const j=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
   if(!j||Array.isArray(j)||j.id!==jobId)return fail('job_identity_mismatch');
   const number=j.jobNumber??j.number;
   if(typeof number!=='string'||!number.trim()||number.length>100)return fail('unsupported_job_number');
   if(now()>=expiresAt)return fail('pilot_expired');
   // Deliberately exclude contacts, financials and documents from this pilot read result.
   return {source:'authenticated_acl_get',id:jobId,jobNumber:number,fetchedAt:new Date(now()).toISOString()};
  }catch{return fail('acl_read_failed');}
  finally{try{reader?.releaseLock();}catch{}}
 };
}
