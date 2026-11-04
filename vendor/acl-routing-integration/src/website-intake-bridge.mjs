/** Offline, opt-in submission journal. No credentials, fetch, registration, or
 * external writes are created by import. All I/O is explicitly injected.
 * A receipt is persisted before any ACL create. Attempted creates are NEVER
 * retried automatically, including after an apparently empty reconciliation.
 */
import {createHash} from 'node:crypto';
import {acceptedLeadInput} from './postgres-routing-store.mjs';
import {WEBSITE_SESSION_VERSION,isReservedWebsiteSession} from './website-submission-sessions.mjs';

export const WEBSITE_RECEIPT_VERSION = 'acl-website-receipt/v1';
export const WEBSITE_EXTERNAL_SOURCE = 'Raccoon Restoration Website';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>Object.assign(new Error(code),{code});
export function websiteSubmissionId(value) {
  if(typeof value!=='string' || value.length>100 || !(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) || /^rr-[a-z0-9-]{10,100}$/i.test(value))) throw fail('invalid_submission_id');
  // Preserve the exact string used by the existing ACL crossReference contract.
  return value;
}
export function websiteRecordId(value) {
  if(typeof value!=='string' || !UUID.test(value)) throw fail('invalid_acl_record_id');
  return value.toLowerCase();
}
function canonical(value) {
  if(value===null || typeof value==='string' || typeof value==='boolean' || (typeof value==='number' && Number.isFinite(value))) return value;
  if(Array.isArray(value)) return value.map(canonical);
  if(value && Object.getPrototypeOf(value)===Object.prototype) return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  throw fail('invalid_receipt_payload');
}
export function receiptAppointment(value=null) {
  if(value===null) return null;
  const values=[value?.startDate,value?.endDate];
  if(values.some(v=>typeof v!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().replace('.000Z','Z')!==v.replace('.000Z','Z')) || Date.parse(values[1])-Date.parse(values[0])!==30*60_000) throw fail('invalid_receipt_appointment');
  return {startDate:new Date(values[0]).toISOString(),endDate:new Date(values[1]).toISOString()};
}
export function websiteReceiptInput({lead,requestedAppointment=null}={}) {
  if(!lead || lead.spam!==false || lead.consent?.accepted!==true) throw fail('validated_lead_required');
  const submissionId=websiteSubmissionId(lead.submissionId);
  const appointment=receiptAppointment(requestedAppointment);
  const payloadHash=createHash('sha256').update(JSON.stringify(canonical({lead,requestedAppointment:appointment}))).digest('hex');
  return {version:1,submissionId,payloadHash,requestedAppointment:appointment};
}
export function validateReceiptInput(input) {
  if(input?.version!==1 || !/^[a-f0-9]{64}$/.test(input?.payloadHash??'') || Object.keys(input).some(k=>!['version','submissionId','payloadHash','requestedAppointment'].includes(k))) throw fail('invalid_receipt_input');
  return {version:1,submissionId:websiteSubmissionId(input.submissionId),payloadHash:input.payloadHash,requestedAppointment:receiptAppointment(input.requestedAppointment)};
}
const held=reason=>({status:'held',leadAccepted:false,reason});
const accepted=(row,duplicate,outboxStatus='pending')=>({status:'accepted',leadAccepted:true,jobId:row.jobId,duplicate,outboxStatus:outboxStatus==='delivered'?'queued':outboxStatus});
function validStore(store) { return store?.durability==='distributed' && store?.receiptVersion===WEBSITE_RECEIPT_VERSION && typeof store.runExclusive==='function'; }
function exactJobMatch(result,submissionId) {
  return result?.status==='match' && result.submissionId===submissionId && ['external_reference','exact_job_submission_marker'].includes(result.proof) && UUID.test(result.jobId??'');
}
function exactContactMatch(result,submissionId,{reconciliation=false}={}) {
  return result?.status==='match' && UUID.test(result.contactId??'') && (result.proof==='submission_cross_reference' && result.submissionId===submissionId || !reconciliation && result.proof==='verified_contact_identity');
}
const provenAbsent=value=>value?.status==='absent' && value.complete===true;
async function review(journal,reason) {
  try { await journal.markReview(reason); } catch { /* attempted marker remains authoritative */ }
  return held(reason);
}

/**
 * client contract (no implicit retries):
 * resolveJob({submissionId,contactId?}) => exact submission-specific match or
 * {status:'absent',complete:true}. First linked job, same address, matching email,
 * or contact crossReference alone are NEVER job evidence.
 * resolveContact({submissionId,lead?}) => exact crossReference or independently
 * verified contact identity. After an attempt ONLY exact crossReference suffices.
 * createContact(lead,config) => {contactId}; createJob(lead,contactId,config) => {jobId}.
 * Both create methods must perform at most one HTTP attempt with retries disabled.
 * createJob must retain the legacy website/call/submission/consent note content.
 * config and customer payload live only in memory, never in the receipt/outbox.
 */
export async function deliverWebsiteLeadDurably({lead,requestedAppointment=null,store,client,config={},enabled=false}={}) {
  if(enabled!==true) return held('durable_intake_disabled');
  if(!validStore(store)) return held('durable_receipt_store_required');
  if(!['resolveJob','resolveContact','createContact','createJob'].every(m=>typeof client?.[m]==='function')) return held('intake_client_required');
  let input;
  try { input=websiteReceiptInput({lead,requestedAppointment}); } catch { return held('invalid_receipt_input'); }
  const sessionSubmission=isReservedWebsiteSession(input.submissionId);
  if(sessionSubmission && store.sessionVersion!==WEBSITE_SESSION_VERSION) return held('durable_session_store_required');
  let knownAccepted=null;
  try {
    return await store.runExclusive(input.submissionId,async journal=>{
      let row=await journal.prepare(input);
      if(row.status==='conflict') return held('submission_payload_conflict');
      if(row.jobId) { knownAccepted={jobId:row.jobId,duplicate:true}; return accepted(row,true,row.outboxStatus); }
      // A server-issued/bound receipt with intact cutover provenance can prove
      // this journal has NEVER attempted this job. That is not global ACL absence.
      // Legacy/unissued IDs and every attempted job retain strict reconciliation.
      let freshSession=false;
      if(sessionSubmission && !row.jobAttempted) {
        if(!UUID.test(row.sessionEpochId??'') || typeof journal.authorizeFreshSession!=='function' || typeof journal.assertCreateAuthority!=='function') return review(journal,'session_provenance_unverified');
        const authorization=await journal.authorizeFreshSession();
        if(authorization?.allowed!==true || authorization.epochId!==row.sessionEpochId) return review(journal,'session_provenance_unverified');
        freshSession=true;
      }
      if(!freshSession) {
        let existing;
        try { existing=await client.resolveJob({submissionId:input.submissionId,contactId:row.contactId}); }
        catch { return review(journal,'job_reconciliation_unavailable'); }
        if(exactJobMatch(existing,input.submissionId)) {
          knownAccepted={jobId:websiteRecordId(existing.jobId),duplicate:true};
          row=await journal.acceptJob(knownAccepted.jobId);
          return accepted(row,true,row.outboxStatus);
        }
        if(row.jobAttempted || !provenAbsent(existing)) return review(journal,row.jobAttempted?'job_write_unconfirmed':'job_reconciliation_inconclusive');
      }
      let contactId=row.contactId;
      if(!contactId) {
        let contact;
        try { contact=await client.resolveContact({submissionId:input.submissionId,lead}); }
        catch { return review(journal,'contact_reconciliation_unavailable'); }
        if(exactContactMatch(contact,input.submissionId,{reconciliation:row.contactAttempted})) {
          contactId=websiteRecordId(contact.contactId);
          await journal.recordContact(contactId);
        } else {
          if(row.contactAttempted || !provenAbsent(contact)) return review(journal,row.contactAttempted?'contact_write_unconfirmed':'contact_reconciliation_inconclusive');
          await journal.markAttempted('contact'); // durable COMMIT before network
          if(sessionSubmission) await journal.assertCreateAuthority('contact');
          let created;
          try { created=await client.createContact(lead,config); contactId=websiteRecordId(created?.contactId); }
          catch { return review(journal,'contact_write_unconfirmed'); }
          await journal.recordContact(contactId);
        }
      }
      await journal.markAttempted('job'); // durable COMMIT before network
      if(sessionSubmission) await journal.assertCreateAuthority('job');
      let created;
      try { created=await client.createJob(lead,contactId,{...config,requestedAppointment:input.requestedAppointment}); knownAccepted={jobId:websiteRecordId(created?.jobId)}; }
      catch { return review(journal,'job_write_unconfirmed'); }
      row=await journal.acceptJob(knownAccepted.jobId); // receipt + outbox one SQL transaction
      return accepted(row,false,row.outboxStatus);
    });
  } catch {
    // ACL returned a valid accepted job. A subsequent journal/lock-cleanup error
    // must not turn that successful lead into a customer-facing failed delivery.
    // The precommitted job-attempt receipt remains discoverable for repair.
    return knownAccepted ? {...accepted(knownAccepted,knownAccepted.duplicate===true),reason:'receipt_outbox_commit_unverified'} : held('receipt_operation_unverified');
  }
}

/** Read-only replay lookup. Expired form/time validation may only use this
 * after ordinary structural/consent validation has produced the same canonical
 * receipt hash. It NEVER prepares a missing row, calls ACL or enqueues work.
 */
export async function findAcceptedWebsiteReceipt({lead,requestedAppointment=null,store,enabled=false}={}) {
  if(enabled!==true || !validStore(store)) return held('durable_receipt_store_required');
  let knownAccepted=null;
  try {
    const input=websiteReceiptInput({lead,requestedAppointment});
    return await store.runExclusive(input.submissionId,async journal=>{
      const row=await journal.read();
      if(!row || row.payloadHash!==input.payloadHash ||
        (row.requestedAppointment?.startDate??null)!==(input.requestedAppointment?.startDate??null) ||
        (row.requestedAppointment?.endDate??null)!==(input.requestedAppointment?.endDate??null)) return held('matching_accepted_receipt_not_found');
      if(!row.jobId || row.status!=='accepted') return held('matching_receipt_unresolved');
      knownAccepted={jobId:row.jobId};
      return accepted(row,true,row.outboxStatus);
    });
  } catch { return knownAccepted?accepted(knownAccepted,true):held('accepted_receipt_lookup_unverified'); }
}

/** Read-only ACL recovery: never calls create, never needs raw customer data.
 * An empty read after an attempted create is NOT proof that it is safe to retry.
 * Exact submission job evidence can repair the crash before local job/outbox save.
 */
export async function reconcileWebsiteSubmission({submissionId,store,client,enabled=false}={}) {
  if(enabled!==true) return held('durable_intake_disabled');
  if(!validStore(store) || typeof client?.resolveJob!=='function') return held('reconciliation_dependencies_required');
  let knownAccepted=null;
  try {
    submissionId=websiteSubmissionId(submissionId);
    return await store.runExclusive(submissionId,async journal=>{
      let row=await journal.read();
      if(!row) return held('submission_receipt_not_found');
      if(row.jobId) { knownAccepted={jobId:row.jobId,duplicate:true}; return accepted(row,true,row.outboxStatus); }
      const match=await client.resolveJob({submissionId,contactId:row.contactId});
      if(!exactJobMatch(match,submissionId)) return review(journal,'job_reconciliation_inconclusive');
      knownAccepted={jobId:websiteRecordId(match.jobId)};
      row=await journal.acceptJob(knownAccepted.jobId);
      return accepted(row,true,row.outboxStatus);
    });
  } catch { return knownAccepted?{...accepted(knownAccepted,true),reason:'receipt_outbox_commit_unverified'}:held('reconciliation_unverified'); }
}

/** One explicitly invoked outbox delivery. At-least-once dispatch is safe only
 * because the existing routing queue rejects conflicting immutable inputs and
 * never repeats attempted ACL writes. This does not register polling/scheduling.
 */
export async function dispatchWebsiteSubmission({submissionId,store,routingStore,enabled=false}={}) {
  if(enabled!==true) return {status:'disabled'};
  if(!validStore(store) || routingStore?.durability!=='distributed' || typeof routingStore?.enqueueAcceptedLead!=='function') return {status:'blocked',reason:'durable_outbox_dependencies_required'};
  try {
    submissionId=websiteSubmissionId(submissionId);
    return await store.runExclusive(submissionId,async journal=>{
      const row=await journal.read();
      if(!row?.jobId) return {status:'held',reason:'accepted_job_not_recorded'};
      if(row.outboxStatus==='delivered') return {status:'delivered',jobId:row.jobId,duplicate:true};
      const result=await routingStore.enqueueAcceptedLead(acceptedLeadInput({jobId:row.jobId,submissionId,requestedAppointment:row.requestedAppointment}));
      if(result?.status!=='queued' || result.jobId!==row.jobId) return {status:'held',jobId:row.jobId,reason:'routing_outbox_delivery_unconfirmed'};
      await journal.markOutboxDelivered();
      return {status:'delivered',jobId:row.jobId,duplicate:result.duplicate===true};
    });
  } catch { return {status:'held',reason:'routing_outbox_delivery_unverified'}; }
}

/** Strict helpers for injected read adapters. complete MUST be proven by that
 * adapter (all pages, no API error/truncation). These helpers do not infer it.
 */
export function exactSubmissionJobEvidence({submissionId,items,complete=false}={}) {
  websiteSubmissionId(submissionId);
  if(!Array.isArray(items) || complete!==true) return {status:'unknown'};
  const ids=new Set();
  for(const item of items) {
    if(!item || typeof item.source!=='string' || typeof item.projectId!=='string' || !UUID.test(item.jobId??'')) return {status:'unknown'};
    if(item?.source!==WEBSITE_EXTERNAL_SOURCE || item?.projectId!==submissionId) continue;
    if(!UUID.test(item.jobId??'')) return {status:'unknown'};
    ids.add(item.jobId.toLowerCase());
  }
  if(ids.size>1) return {status:'conflict'};
  return ids.size===1?{status:'match',jobId:[...ids][0],submissionId,proof:'external_reference'}:{status:'absent',complete:true};
}
