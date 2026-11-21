import {classifyPermitTitle} from './permit-title-policy.mjs';
// Recovered exact displayed source. Queue-only; no network or actionable authority.
const ACCOUNT='link_00000000000000000000000000000000';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function queueCandidate(message, lookup, knownKeys=new Set()) {
 if(!message || typeof message!=='object' || Array.isArray(message))return {state:'reject',reason:'invalid_envelope'};
 if(typeof message.id!=='string'||typeof message.subject!=='string'||typeof message.from!=='string')return {state:'reject',reason:'invalid_identity_types'};
 if(message.connectorRead!==true || message.linkId!==ACCOUNT || !/^[a-f0-9]+$/.test(message.id||'')) return {state:'reject',reason:'unverified_mailbox_message'};
 // New recovery hardening: malformed caller dedup state fails closed.
 if(!(knownKeys instanceof Set))return {state:'reject',reason:'invalid_dedup_state'};
 const key=`${ACCOUNT}:${message.id}`;
 if(knownKeys.has(key)) return {state:'duplicate',key};
 const title=classifyPermitTitle(message.subject);
 if(message.from!=='do-not-reply@mail.acculynx.com' || title.kind==='ignore') return {state:'ignore'};
 if(!Array.isArray(message.extractedHrefs))return {state:'reject',reason:'invalid_links'};
 const reasons=['Current task status, assignee and requesting rep require confirmation'];
 if(message.transportVerified!==true) reasons.push('Sender authentication not verified');
 const ids=new Set();
 for(const value of message.extractedHrefs||[]) {
  let u;if(typeof value!=='string'||!/^https:\/\/my\.acculynx\.com\//i.test(value))continue;try{u=new URL(value);}catch{continue;}
  if(u.protocol!=='https:'||u.hostname!=='my.acculynx.com'||u.username||u.password||u.port||u.pathname!=='/'||u.searchParams.getAll('module').length!==1||u.searchParams.get('module')!=='Jobs_Edit')continue;
  const id=u.searchParams.get('JobID');
  if(u.searchParams.getAll('JobID').length===1&&UUID.test(id||''))ids.add(id.toLowerCase());
 }
 let jobId=ids.size===1?[...ids][0]:null;
 if(!jobId)reasons.push('Missing or ambiguous ACL job link');
 const matched=jobId && lookup?.source==='authenticated_acl_get' && lookup?.id===jobId && lookup?.jobNumber;
 if(!matched)reasons.push('Authenticated job match unavailable');
 return {state:'awaiting_owner_review',label:'Permit Requests / Needs Review',key,messageId:message.id,jobId,jobNumber:matched?lookup.jobNumber:null,tradeHint:title.tradeHint,reviewBlockers:title.kind==='title_review'?['task_title_confirmation_required']:[],reasons,allowedActions:[]};
}
