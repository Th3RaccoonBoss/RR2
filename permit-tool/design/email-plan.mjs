// Inert planning prototype. No external effects and no production wiring.
export function planEmail({purpose, channel, jurisdictionVerified=false, aclVerified=false, taskVerified=false, containsPersonalData=false, containsSensitiveDocument=false, signatureRequired=false, feeRequired=false, bindingTerms=false}={}) {
  const validPurposes=['requirements_question','application_submission','inspection_request'];
  if(!validPurposes.includes(purpose)) throw new Error('Unsupported purpose');
  const blockers=['external_sending_not_authorized'];
  if(!jurisdictionVerified) blockers.push('jurisdiction_unverified');
  if(!aclVerified) blockers.push('acl_job_revalidation_required');
  if(!taskVerified) blockers.push('task_authority_unverified');
  if(!channel || channel.purpose!==purpose || channel.verified!==true || channel.method!=='email') blockers.push('purpose_specific_email_channel_unverified');
  if(containsPersonalData) blockers.push('data_recipient_scope_review');
  if(containsSensitiveDocument) blockers.push('sensitive_document_disclosure_review');
  if(signatureRequired) blockers.push('signature_review');
  if(feeRequired) blockers.push('fee_and_payment_review');
  if(bindingTerms) blockers.push('legal_terms_review');
  return {state:'local_review_only',allowedExternalActions:[],blockers};
}
