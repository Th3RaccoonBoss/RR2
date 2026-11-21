// Inert planning module: no transport, credentials, persistence, or production imports.
// Inputs must be populated by trusted adapters; booleans are not authorization.
import {createHash} from 'node:crypto';
const id = v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(v);
const fresh=(t,now)=>Number.isFinite(t)&&t<=now&&now-t<=24*60*60*1000;
export function planRepDocumentRequest(input={}) {
  const {job,rep,requirements=[],sourceChecks=[],history=[],now}=input;
  const out={state:'owner_review_required',allowedExternalActions:[],blockers:['external_sending_not_authorized'],requestItems:[],suppressed:[],requestKey:null};
  const block=x=>out.blockers.push(x);
  if(!Number.isFinite(now)) {block('invalid_evaluation_time');return out;}
  if(!job||!id(job.id)||job.verified!==true||!fresh(job.verifiedAt,now)) block('acl_job_revalidation_required');
  if(!job||job.taskAuthorityVerified!==true||job.taskStatus!=='open') block('task_authority_or_status_unverified');
  if(!job||job.jurisdictionVerified!==true||job.scopeVerified!==true||!id(job.scopeVersion)) block('jurisdiction_or_scope_unverified');
  // Never use notification creator, reply-to, signatures or task body as rep authority.
  if(!rep||!id(rep.id)||rep.jobId!==job?.id||rep.assignmentVerified!==true||rep.emailVerified!==true||rep.accessToJobVerified!==true||!['authenticated_acl','owner_confirmed'].includes(rep.provenance)||!fresh(rep.verifiedAt,now)) block('sales_rep_recipient_unverified');
  if(!Array.isArray(requirements)||!Array.isArray(sourceChecks)||!Array.isArray(history)) {block('invalid_evidence');return out;}
  if(out.blockers.length>1) return out;
  const seen=new Set();
  for(const r of requirements) {
    if(!r||!id(r.id)||seen.has(r.id)||r.required!==true||r.jobId!==job.id||r.scopeVersion!==job.scopeVersion||r.requirementVerified!==true||!fresh(r.verifiedAt,now)) {block('requirement_verification_needed');continue;}
    seen.add(r.id);
    if(!['regular','sensitive'].includes(r.dataClass)) {block('document_data_class_review');continue;}
    const checks=sourceChecks.filter(s=>s?.documentId===r.id&&s.jobId===job.id);
    // A source inventory is mandatory. Inaccessibility is recorded, never called absence.
    if(!Array.isArray(r.sourceIds)||!r.sourceIds.length||r.sourceIds.some(sid=>!id(sid)||!checks.some(s=>s.sourceId===sid&&fresh(s.checkedAt,now)&&['found_valid','not_found','access_blocked','found_needs_review'].includes(s.status)))) {block('accessible_sources_not_checked');continue;}
    if(checks.some(s=>fresh(s.checkedAt,now)&&s.status==='found_valid')) {out.suppressed.push({documentId:r.id,reason:'already_available'});continue;}
    if(checks.some(s=>fresh(s.checkedAt,now)&&s.status==='found_needs_review')) {out.suppressed.push({documentId:r.id,reason:'existing_document_needs_review'});continue;}
    const previous=history.filter(h=>h?.jobId===job.id&&h.documentId===r.id);
    // Suppress across reps and scope revisions: reassignment must not cause another request.
    if(previous.some(h=>['reserved','pending','accepted','delivery_uncertain','delivered','response_received'].includes(h.status))) {out.suppressed.push({documentId:r.id,reason:'request_or_response_already_exists'});continue;}
    if(previous.some(h=>!['cancelled','failed_confirmed'].includes(h.status))) {block('request_history_state_unverified');continue;}
    if(r.dataClass==='sensitive') {block('sensitive_document_channel_and_recipient_review');continue;}
    out.requestItems.push({documentId:r.id,reason:checks.some(s=>s.status==='access_blocked')?'unable_to_retrieve_existing_sources':'not_found_in_checked_sources'});
  }
  // Only identifiers in plan. No contacts, raw mail, attachments or free-form instructions.
  out.requestItems.sort((a,b)=>a.documentId.localeCompare(b.documentId));
  if(out.requestItems.length) out.requestKey=createHash('sha256').update(JSON.stringify([job.id,rep.id,job.scopeVersion,out.requestItems.map(x=>x.documentId)])).digest('hex');
  else out.state='no_request_planned';
  return out;
}
