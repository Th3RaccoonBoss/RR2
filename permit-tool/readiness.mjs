// Recovered displayed engine through document loop; return/COI gate reconstructed from tested contract.
const fresh=(stamp,now,ms)=>Number.isFinite(Date.parse(stamp)) && Date.parse(stamp)<=now && now-Date.parse(stamp)<=ms;
const DAY=86400000;
const sourceUrlValid=(s)=>{try{if(typeof s!=='string')return false;const u=new URL(s);return u.protocol==='https:'&&!!u.hostname&&u.hostname.includes('.')&&!u.username&&!u.password;}catch{return false;}};
export function assessPermit(input, now=Date.now()) {
 if(!input || typeof input!=='object' || Array.isArray(input) || !Number.isFinite(now))return {state:'blocked',blockers:['invalid_input'],allowedExternalActions:[]};
 const {candidate:c,review,job,request,rules:allRules=[],documents=[]}=input;
 if(!Array.isArray(allRules)||!Array.isArray(documents))return {state:'blocked',blockers:['invalid_evidence_lists'],allowedExternalActions:[]};
 const blockers=[];const block=(code)=>blockers.push(code);
 if(c?.state!=='awaiting_owner_review'||!c?.key||!c?.jobId)block('intake_not_matched');
 if(!review || review.source!=='owner_confirmation' || review.candidateKey!==c?.key || review.jobId!==c?.jobId || review.scopeKey!==request?.scopeKey || review.trade!==request?.trade || review.jurisdictionId!==job?.jurisdictionId || review.taskStillOpen!==true || review.assignedToOwner!==true || review.requestorAuthorized!==true || !fresh(review.confirmedAt,now,7*DAY))block('owner_review_required');
 if(review?.ancillaryReviewed!==true)block('ancillary_permit_review_required');
 if(!job || job.source!=='authenticated_acl_get' || job.id!==c?.jobId || job.jobNumber!==c?.jobNumber || !job.jobNumber || !fresh(job.fetchedAt,now,DAY))block('fresh_job_match_required');
 if(!request || !['roof','siding'].includes(request.trade) || typeof request.scopeKey!=='string' || !request.scopeKey.trim())block('scope_required');
 if(!job?.jurisdictionId || job.jurisdictionVerified!==true)block('jurisdiction_required');
 const matches=allRules.filter(r=>r && r.jurisdictionId===job?.jurisdictionId && r.trade===request?.trade && r.scopeKey===request?.scopeKey);
 const verified=matches.filter(r=>r.sourceKind==='official' && r.verified===true && sourceUrlValid(r.sourceUrl) && fresh(r.checkedAt,now,30*DAY) && fresh(r.effectiveFrom,now,36500*DAY) && (!r.effectiveUntil || Date.parse(r.effectiveUntil)>now));
 if(input.unresolvedConflict!==false || matches.some(r=>r.unresolvedConflict===true))block('evidence_conflict_review_required');
 const stated=matches.filter(r=>typeof r.permitRequired==='boolean');
 if(new Set(stated.map(r=>r.permitRequired)).size>1)block('contradictory_requirement_evidence');
 let rule;
 if(verified.length!==1)block(verified.length>1?'conflicting_rules':'current_official_rule_required');else rule=verified[0];
 if(rule && typeof rule.permitRequired!=='boolean')block('permit_requirement_unknown');
 const required=[];
 if(rule?.permitRequired===true){
  if(typeof rule.coiRequired!=='boolean')block('coi_requirement_unknown');
  if(typeof rule.bondRequired!=='boolean')block('bond_requirement_unknown');
  if(!Array.isArray(rule.requiredDocuments) || rule.requiredDocuments.some(x=>typeof x!=='string'||!x.trim()))block('document_requirements_unknown');
  else required.push(...rule.requiredDocuments);
  if(rule.coiRequired===true)required.push('coi');
  if(rule.bondRequired===true)required.push('surety_bond');
 }
 for(const kind of new Set(required)) {
  const match=documents.some(d=>d && d.kind===kind && d.jobId===c?.jobId && d.verified===true && d.source==='reviewed_document' && d.version && d.scopeKey===request?.scopeKey && d.trade===request?.trade && (!d.expiresAt || (Number.isFinite(Date.parse(d.expiresAt)) && Date.parse(d.expiresAt)>now)) && (!['coi','surety_bond'].includes(kind)||d.jurisdictionId===job?.jurisdictionId));
  if(!match)block('document_required:'+kind);
 }
 const state=blockers.length?'blocked':rule?.permitRequired===false?'no_permit_needed_review':'packet_ready_for_owner_review';
 // Reconstructed conservatively: only missing COI itself may remain for eligibility, never action authority.
 const coiRequestEligible=rule?.permitRequired===true&&rule?.coiRequired===true&&blockers.every(b=>b==='document_required:coi');
 return {state,blockers:[...new Set(blockers)],candidateKey:c?.key??null,jobId:c?.jobId??null,jobNumber:c?.jobNumber??null,trade:request?.trade??null,jurisdictionId:job?.jurisdictionId??null,ruleEvidence:rule?{sourceUrl:rule.sourceUrl,checkedAt:rule.checkedAt}:null,requiredDocuments:[...new Set(required)],determinationScope:'Only the requested trade and scope; separate dumpster/ROW requirements need review',coiRequestEligible,allowedExternalActions:[]};
}
