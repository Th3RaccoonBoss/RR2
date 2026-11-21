import {readFileSync} from 'node:fs';
import{queueCandidate}from'./email-intake.mjs';import{assessPermit}from'./readiness.mjs';
export function processEnvelope(input,now=Date.now()){
 if(!input||typeof input!=='object')return {state:'reject',reason:'invalid_envelope'};
 const candidate=queueCandidate(input.message,input.job);
 if(candidate.state!=='awaiting_owner_review')return candidate;
 return {...assessPermit({...input,candidate},now),label:candidate.label,intakeWarnings:candidate.reasons};
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try {const data=JSON.parse(readFileSync(process.argv[2],'utf8'));console.log(JSON.stringify(processEnvelope(data),null,2));}
 catch{console.error('Input could not be processed. No actions taken.');process.exitCode=1;}
}
