// INACTIVE DEVELOPMENT DESIGN. Not imported by the live pilot.
// Only an explicitly enabled, exact alias is normalized; never inspect body instructions.
import {queueCandidate} from '../email-intake.mjs';
export function proposedQueueCandidate(message, lookup, knownKeys=new Set(), options={}) {
 if(options.enableExactPullPermitAliases!==true) return queueCandidate(message,lookup,knownKeys);
 const match=typeof message?.subject==='string' && /^\[AccuLynx\] New Task: Pull permit (roofing|siding)$/i.exec(message.subject);
 const candidate=match?{...message,subject:`[AccuLynx] New Task: PERMIT REQUEST - ${match[1].toUpperCase()}`}:message;
 return queueCandidate(candidate,lookup,knownKeys);
}
