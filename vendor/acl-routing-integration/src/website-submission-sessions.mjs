/** Offline v2 submission sessions. A random namespace is NOT writer isolation.
 * Never activate without separately verified exclusion/draining of every legacy,
 * immutable-deployment, rollback and internal intake writer. See the runbook.
 */
export const WEBSITE_SESSION_VERSION='acl-website-session/v2';
export const RESERVED_SUBMISSION_PREFIX='rr-v2-';
export const isReservedWebsiteSession=value=>typeof value==='string' && /^rr-v2-/i.test(value.trim().replace(/\u0000/g,'').slice(0,100));
export const isCanonicalWebsiteSession=value=>typeof value==='string' && /^rr-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const reply=(body,status)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});

/** Only this explicit issuance operation may allocate a v2 ID. An ordinary form
 * submit cannot mint/upsert a missing session. IDs are random bearer identifiers,
 * not authentication for a person and not dedupe across separately issued IDs.
 */
export async function issueWebsiteSubmissionSession({store,enabled=false,ttlSeconds=1800}={}) {
  if(enabled!==true) return {status:'disabled'};
  if(store?.durability!=='distributed' || store?.sessionVersion!==WEBSITE_SESSION_VERSION || typeof store.issueSubmissionSession!=='function') return {status:'held',reason:'durable_session_store_required'};
  try {
    const issued=await store.issueSubmissionSession({ttlSeconds});
    if(!isCanonicalWebsiteSession(issued?.submissionId) || typeof issued.expiresAt!=='string' || !Number.isFinite(Date.parse(issued.expiresAt))) return {status:'held',reason:'session_issue_unverified'};
    return {status:'issued',submissionId:issued.submissionId,expiresAt:issued.expiresAt};
  } catch { return {status:'held',reason:'session_issue_unverified'}; }
}
async function readSmallJson(request,limit) {
  const declared=request.headers.get('content-length');
  if(declared!==null && (!/^\d+$/.test(declared) || Number(declared)>limit)) throw Error('request_too_large');
  const reader=request.body?.getReader(); if(!reader) throw Error('invalid_json');
  const chunks=[];let length=0;
  try {
    for(;;) { const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){reader.cancel().catch(()=>{});throw Error('request_too_large');}chunks.push(value); }
  } finally {reader.releaseLock();}
  const body=new Uint8Array(length);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));
}
/** Host must authorize origin/CSRF and rate-limit issuance through the injected
 * authorizer. A public form does not need a customer login, but CORS alone is not
 * authorization or namespace isolation. Server chooses TTL; client body is {}.
 */
export function createWebsiteSessionHandler({enabled=false,store,authorizeIssuance,ttlSeconds=1800}={}) {
  return async request=>{
    if(enabled!==true) return reply({error:'sessions_disabled'},503);
    if(request?.method!=='POST') return reply({error:'method_not_allowed'},405);
    if(typeof authorizeIssuance!=='function') return reply({error:'issuance_not_configured'},503);
    try { if(await authorizeIssuance(request)!==true) return reply({error:'issuance_not_allowed'},403); } catch { return reply({error:'issuance_not_allowed'},403); }
    if(!(request.headers.get('content-type')??'').includes('application/json')) return reply({error:'unsupported_media_type'},415);
    try { const raw=await readSmallJson(request,1024);if(!raw || typeof raw!=='object' || Array.isArray(raw) || Object.keys(raw).length) return reply({error:'invalid_request'},400); }
    catch { return reply({error:'invalid_request'},400); }
    const result=await issueWebsiteSubmissionSession({store,enabled:true,ttlSeconds});
    return result.status==='issued'?reply({ok:true,submissionId:result.submissionId,expiresAt:result.expiresAt},201):reply({error:'session_issue_unverified'},503);
  };
}
/** Permanent namespace guard for a legacy endpoint/rollback wrapper. Does NOT
 * protect older deployments where this wrapper was never installed. External
 * deployment protection/drain verification is mandatory before first issuance.
 * Keep this guard even when new intake is disabled. Never fall through for v2.
 */
export function createLegacyV2NamespaceGuard({baselineHandler}={}) {
  if(typeof baselineHandler!=='function') throw Error('baseline_handler_required');
  return async request=>{
    if(request?.method==='POST' && (request.headers.get('content-type')??'').includes('application/json')) {
      try {
        const raw=await readSmallJson(request.clone(),64*1024);
        if(isReservedWebsiteSession(raw?.submission_id)) return reply({ok:false,error:'submission_namespace_not_supported',message:'This request must use the current website form. Do not resubmit it through an older endpoint.'},409);
      } catch(error) {
        if(error?.message==='request_too_large') return reply({ok:false,error:'request_too_large'},413);
        // Request.json() may replace invalid UTF-8 where our strict decoder
        // rejects it. Never send an unclassified body into the legacy writer.
        return reply({ok:false,error:'invalid_request'},400);
      }
    }
    return baselineHandler(request);
  };
}
