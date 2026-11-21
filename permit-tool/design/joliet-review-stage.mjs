// Inactive test-only next-stage planner. No network, persistence or external actions.
const DAY=86400000;
const sources={
 application:'https://www.joliet.gov/files/assets/city/v/1/building-amp-inspections/documents/roofsidingwindows-form.pdf',
 registration:'https://www.joliet.gov/files/assets/city/v/1/building-amp-inspections/documents/contractor_registration_guide.pdf',
 forms:'https://www.joliet.gov/Government/Departments/Community-Development/Building-Inspections/Building-Permit-Forms'
};
export function planJolietReview({queue,job,now=Date.now()}={}){
 const blockers=['task_authority_unverified','jurisdiction_confirmation_required','scope_and_contract_value_required','contract_document_required','current_license_status_required','current_joliet_registration_required','current_joliet_coi_required','signed_application_required','inspection_requirements_unverified','city_fee_assessment_required'];
 const fetched=Date.parse(job?.fetchedAt);
 const fresh=job?.source==='authenticated_acl_get'&&typeof queue?.jobId==='string'&&job.id===queue.jobId&&typeof job.jobNumber==='string'&&job.jobNumber.trim()&&Number.isFinite(fetched)&&fetched<=now&&now-fetched<=DAY;
 if(!fresh)blockers.unshift('acl_job_revalidation_required');
 // A title provides only a trade hint; keep this a preparation checklist, not applicability.
 if(queue?.tradeHint!=='roofing'&&queue?.tradeHint!=='roof')blockers.push('roofing_scope_unconfirmed');
 return {state:'test_checklist_only',jobMatched:Boolean(fresh),jobReference:fresh?job.jobNumber:null,
 sources,sourceObservedAt:'2026-11-12',requirementsVerifiedForJob:false,
 checklist:['Confirm city limits and roof scope','Complete roofing/siding/windows application','Attach contract copy','Verify Illinois roofer license and Joliet registration','Verify existing City of Joliet holder COI before preparing a request','Obtain applicant signature and city-assessed fee/inspection instructions'],
 bond:{reusable:false,jobSpecific:true,required:null,note:'No standard roofing bond shown in cited registration guide; verify ancillary scope. Historical bonds never satisfy a new job.'},
 blockers,allowedExternalActions:[]};
}
