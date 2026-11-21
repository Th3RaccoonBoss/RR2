export const tinleyObservation=Object.freeze({
 id:'tinley-15505-detached-reroof-20261112',jurisdictionId:'tinley-park-il',sourceType:'published_municipal_code',
 sourceUrl:'https://codelibrary.amlegal.com/codes/tinleypark/latest/tinleypark_il/0-0-0-96799',citation:'155.05(A), IRC 2024 R105.2 amendment',
 checkedAt:'2026-11-12T00:00:00Z',lastListedOrdinance:'2026-O-053, passed 2026-08-18',
 observedConclusion:'Published code exempts reroofing single-family detached structures',
 scope:{trade:'roof',workType:'reroof',buildingType:'single_family_detached'},verified:false,operative:false,
 publisherWarning:'Published code may not reflect newer uncodified legislation; official version must be verified before action.',ancillaryReviewRequired:true
});
export function evaluateTinleyObservation(project,review,now=Date.now()){
 const reasons=[],p=project||{},r=review||{};
 if(p.jurisdictionId!=='tinley-park-il'||p.jurisdictionVerified!==true)reasons.push('jurisdiction_unconfirmed_or_mismatch');
 if(p.trade!=='roof'||p.workType!=='reroof'||p.buildingType!=='single_family_detached'||p.structuralChanges!==false)reasons.push('scope_unconfirmed_or_outside_exemption');
 if(!Number.isFinite(now)||now<Date.parse(tinleyObservation.checkedAt)||now-Date.parse(tinleyObservation.checkedAt)>30*86400000)reasons.push('observation_not_current');
 if(r.source!=='trusted_reviewer'||r.evidenceId!==tinleyObservation.id||r.scopeKey!==p.scopeKey||typeof p.scopeKey!=='string'||!p.scopeKey||r.jurisdictionId!==p.jurisdictionId)reasons.push('review_not_bound_to_scope');
 if(r.uncodifiedLawCheck!=='confirmed_no_relevant_change'||!Number.isFinite(Date.parse(r.checkedAt))||Date.parse(r.checkedAt)>now||now-Date.parse(r.checkedAt)>7*86400000)reasons.push('uncodified_law_uncertain');
 return {state:reasons.length?'needs_review':'evidence_applicable_for_owner_review',reasons,operative:false,allowedExternalActions:[],ancillaryReviewRequired:true,evidenceId:tinleyObservation.id};
}
