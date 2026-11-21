import assert from 'node:assert/strict';
import {tinleyObservation,evaluateTinleyObservation} from './tinley-scoped-evidence.mjs';
const now=Date.parse('2026-11-12T12:00:00Z');
const p={jurisdictionId:'tinley-park-il',jurisdictionVerified:true,trade:'roof',workType:'reroof',buildingType:'single_family_detached',structuralChanges:false,scopeKey:'synthetic-scope-v1'};
const r={source:'trusted_reviewer',evidenceId:tinleyObservation.id,jurisdictionId:p.jurisdictionId,scopeKey:p.scopeKey,checkedAt:'2026-11-12T11:00:00Z',uncodifiedLawCheck:'confirmed_no_relevant_change'};
let count=0;function check(name,fn){fn();count++;}
check('exact advisory',()=>{const x=evaluateTinleyObservation(p,r,now);assert.equal(x.state,'evidence_applicable_for_owner_review');assert.equal(x.operative,false);assert.deepEqual(x.allowedExternalActions,[]);assert.equal(x.ancillaryReviewRequired,true);});
for(const [name,patch] of [['unknown building',{buildingType:null}],['attached',{buildingType:'single_family_attached'}],['commercial',{buildingType:'commercial'}],['siding',{trade:'siding'}],['structural',{structuralChanges:true}],['new roof',{workType:'new_construction'}],['unknown jurisdiction',{jurisdictionVerified:false}],['scope changed',{scopeKey:'other'}]])check(name,()=>assert.equal(evaluateTinleyObservation({...p,...patch},r,now).state,'needs_review'));
check('uncodified uncertainty',()=>assert.equal(evaluateTinleyObservation(p,{...r,uncodifiedLawCheck:'unknown'},now).state,'needs_review'));
check('stale observation',()=>assert.equal(evaluateTinleyObservation(p,r,now+31*86400000).state,'needs_review'));
check('stale reviewer',()=>assert.equal(evaluateTinleyObservation(p,{...r,checkedAt:'2026-11-01T00:00:00Z'},now).state,'needs_review'));
check('missing envelopes',()=>assert.equal(evaluateTinleyObservation(null,null,now).state,'needs_review'));
console.log(count+' checks passed');
