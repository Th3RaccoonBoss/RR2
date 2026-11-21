// New document-independent intake/checklist stage. No submissions or external actions.
import {queueCandidate} from './email-intake.mjs';
const research={
 'orland park':{name:'Orland Park',reference:'research/jurisdictions/SUMMARY.md#orland-park',note:'Published roof and siding permits are separate; registration-level COI evidence exists. Verify exact scope and existing registration before requests.'},
 'naperville':{name:'Naperville',reference:'research/jurisdictions/SUMMARY.md#naperville',note:'Published single-family material-specific exceptions; asphalt reroof exception requires existing sheathing to remain. Other materials and structural work need separate review.'},
 'lombard':{name:'Lombard',reference:'research/jurisdictions/SUMMARY.md#lombard',note:'Published FAQ says roof permit required, siding no permit; structural exceptions and current contractor insurance/bond conditions need review.'},
 'barrington':{name:'Village of Barrington',reference:'research/jurisdictions/SUMMARY.md#village-of-barrington',note:'Postal Barrington is not proof of Village jurisdiction. Other Barrington municipalities/unincorporated parcels must not inherit these rules.'},
 'tinley park':{name:'Tinley Park',reference:'tinley-scoped-evidence.mjs',note:'Published exemption is single-family detached reroof only; not attached homes, siding, commercial or structural work.'}
};
export function preparePilotChecklist(message,job,{cityHint='',now=Date.now(),knownKeys=new Set()}={}){
 const candidate=queueCandidate(message,job,knownKeys);
 if(candidate.state!=='awaiting_owner_review')return candidate;
 const fresh=Boolean(candidate.jobId)&&job?.source==='authenticated_acl_get'&&job.id===candidate.jobId&&typeof job.jobNumber==='string'&&Boolean(job.jobNumber.trim())&&Number.isFinite(Date.parse(job.fetchedAt))&&Date.parse(job.fetchedAt)<=now&&now-Date.parse(job.fetchedAt)<=86400000;
 const city=typeof cityHint==='string'?cityHint.trim().toLowerCase():'';
 const found=Object.hasOwn(research,city)?research[city]:null;
 return {state:'checklist_ready_for_review',candidateKey:candidate.key,jobId:candidate.jobId,jobNumber:fresh?job.jobNumber:null,tradeHint:candidate.tradeHint,reviewBlockers:candidate.reviewBlockers,reasons:candidate.reasons,
  jobVerified:fresh,cityHint:typeof cityHint==='string'?cityHint:null,jurisdictionVerified:false,
  research:found?{...found,status:'inactive_research_only',observedAt:'2026-11-12'}:null,
  checklist:[
   {id:'request',status:'needs_confirmation',text:'Confirm task remains open, assigned to Brandon, and requested by an authorized rep.'},
   {id:'job',status:fresh?'matched':'needs_review',text:fresh?'Fresh read matches linked ACL job.':'Fresh authenticated matching ACL job required.'},
   {id:'scope',status:'needs_confirmation',text:'Confirm roofing/siding, material, tear-off, sheathing/structural work and desired start date.'},
   {id:'jurisdiction',status:'needs_confirmation',text:'Verify actual permitting jurisdiction; postal city is only a hint.'},
   {id:'requirements',status:'needs_review',text:found?'Review dated jurisdiction research against exact current job scope.':'Research current official requirements for this exact jurisdiction and scope.'},
   {id:'documents',status:'requirements_not_yet_verified',text:'Identify application-specific documents after requirements review. Historical ACL document access is not required to prepare this checklist.'}
  ],applicationDocumentGaps:[],documentRequirementsVerified:false,allowedExternalActions:[]};
}
