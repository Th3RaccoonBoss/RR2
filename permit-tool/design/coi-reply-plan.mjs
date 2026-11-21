// INACTIVE PURE PLANNER. No transport, storage, real mail or production imports.
// All verification evidence must come from trusted adapters, never message claims.
import {createHash} from 'node:crypto';
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function planCoiReply(x={}) {
 const out={state:'manual_review',allowedExternalActions:[],blockers:[],filingCandidate:null,eventKey:null};
 const b=s=>out.blockers.push(s), {request:r,reply:m,document:d,requirements:q,filing:f,history=[]}=x;
 if(!Number.isFinite(x.now)||!Array.isArray(history)){b('invalid_input');return out;}
 if(!r||!id(r.id)||r.sentConfirmed!==true||!id(r.sentMessageId)||!id(r.threadId)||!id(r.mailboxId)||!id(r.jobId)||!id(r.requirementsVersion)||!Number.isFinite(r.sentAt)||r.sentAt>x.now){b('confirmed_outbound_request_required');return out;}
 // A draft, a matching subject, quoted headers or an inbound instruction is insufficient.
 if(!m||!id(m.id)||m.mailboxId!==r.mailboxId||m.threadId!==r.threadId||m.inReplyToVerified!==true||m.correlatedRequestId!==r.id||m.senderVerified!==true||m.senderAddress!==r.recipientAddress||m.senderAddress!=='insurance-agent@example.test'||m.forwarded===true||!Number.isFinite(m.receivedAt)||m.receivedAt<r.sentAt||m.receivedAt>x.now){b('reply_identity_or_correlation_unverified');return out;}
 out.eventKey=createHash('sha256').update(JSON.stringify([m.mailboxId,m.id])).digest('hex');
 if(history.some(h=>h.eventKey===out.eventKey&&['reserved','processed','filing_uncertain','filed'].includes(h.state))){out.state='duplicate_or_pending';return out;}
 if(history.some(h=>h.eventKey===out.eventKey&&!['failed_confirmed','cancelled'].includes(h.state))){b('history_state_unverified');return out;}
 if(!q||q.verified!==true||q.version!==r.requirementsVersion||q.jurisdictionId!==r.jurisdictionId||!Number.isFinite(q.checkedAt)||q.checkedAt>x.now||x.now-q.checkedAt>86400000){b('current_city_requirements_required');return out;}
 if(!d||!hash(d.sha256)||d.safePdfVerified!==true||d.readable!==true||d.fieldsVerified!==true){b('document_safety_or_readability_review');return out;}
 if(history.some(h=>h.requestId===r.id&&h.documentHash===d.sha256&&['reserved','filing_uncertain','filed'].includes(h.state))){out.state='duplicate_or_pending';return out;}
 if(d.holderMatchVerified!==true||d.holderId!==q.holderId)b('certificate_holder_mismatch');
 if(d.namedInsuredMatchVerified!==true||d.insuredId!==r.insuredId)b('named_insured_mismatch');
 if(!Array.isArray(q.requiredCoverage)||!q.requiredCoverage.length||!Array.isArray(d.coverages))b('coverage_requirements_unknown');
 else for(const required of q.requiredCoverage){const c=d.coverages.find(c=>c?.type===required?.type);if(!required||typeof required.type!=='string'||!Number.isFinite(required.minimum)||!c||c.policyIdentifierVerified!==true||!Number.isFinite(c.limit)||c.limit<required.minimum||!Number.isFinite(c.effectiveAt)||!Number.isFinite(c.expiresAt)||c.effectiveAt>x.now||c.expiresAt<=x.now||!Number.isFinite(q.requiredThrough)||c.expiresAt<=q.requiredThrough)b('coverage_policy_limits_or_dates_review');}
 if(q.endorsementsResolved!==true||d.endorsementsMatchVerified!==true)b('endorsement_review');
 if(d.conflictingOrUnclearFields===true)b('conflicting_fields_review');
 if(m.requestsCoverageChange===true||m.requestsPayment===true||m.requestsSignature===true)b('owner_decision_required');
 if(!f||f.authorized!==true||f.scope!=='private_permit_documents'||!id(f.folderId)||f.jobId!==r.jobId||f.jurisdictionId!==r.jurisdictionId||f.accessVerified!==true||f.overwrite!==false)b('filing_authorization_or_destination_review');
 if(out.blockers.length)return out;
 out.state='reviewed_candidate_not_city_acceptance';
 out.filingCandidate={requestId:r.id,jobId:r.jobId,jurisdictionId:r.jurisdictionId,folderId:f.folderId,documentHash:d.sha256};
 // Still deliberately grants no action. Test mode remains inert even with authorization flags.
 return out;
}
