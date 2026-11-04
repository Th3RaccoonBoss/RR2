'use strict';
const byId = id => document.getElementById(id);
const statusButton = byId('status-button'), runButton = byId('run-button');
const approved = byId('approved'), confirmation = byId('confirmation');
const gateStatus = byId('gate-status'), result = byId('result');
const inspectButton=byId('inspect-button'), inspectionRunId=byId('inspection-run-id');
const phrase = 'CREATE ONE ISOLATED SYNTHETIC SCHEMA';
let enabled = false, attempted = false, busy = false, inspectionEnabled=false;
const sync = () => { runButton.disabled = !enabled || attempted || busy || !approved.checked || confirmation.value !== phrase; inspectButton.disabled=!inspectionEnabled||busy; };
const display = data => { result.textContent = JSON.stringify(data, null, 2); };
approved.addEventListener('change', sync);
confirmation.addEventListener('input', sync);
statusButton.addEventListener('click', async () => {
  if (busy) return;
  busy = true; enabled = false; inspectionEnabled=false; statusButton.disabled = true; sync();
  try {
    const response = await fetch('/api/diagnostic', { method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000) });
    const body = await response.json();
    enabled = response.ok && body.dbExecutionEnabled === true;
    inspectionEnabled=response.ok && body.inspectionEnabled===true;
    gateStatus.textContent = enabled ? 'A server-side grant is current. Verify separate approval and restricted platform access before proceeding.' : 'Execution is disabled or this is not the approved Preview.';
    display(body);
  } catch {
    gateStatus.textContent = 'Gate unavailable. Execution remains disabled.';
    display({ status: 'unavailable', executed: false });
  } finally { busy = false; statusButton.disabled = false; sync(); }
});
runButton.addEventListener('click', async () => {
  if (runButton.disabled || attempted || busy) return;
  attempted = true; busy = true; statusButton.disabled = true; sync();
  display({ status: 'running', instruction: 'Wait for the result. Do not retry or navigate away.' });
  try {
    const response = await fetch('/api/diagnostic', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(165_000),
      headers: { 'Content-Type': 'application/json', 'X-ACL-Preview-Action': 'explicit-operator-click' },
      body: JSON.stringify({ action: 'neon-synthetic-validation', confirmation: phrase })
    });
    const body = await response.json();
    display(body);
    gateStatus.textContent = body.status === 'passed' ? 'Synthetic check completed. Retain the result and disable the deployment grant.' : 'Do not repeat. Inspect the result and any retained schema first.';
  } catch {
    display({ status: 'needs_inspection', mutationOutcome: 'unknown', retryAllowed: false });
    gateStatus.textContent = 'The outcome is uncertain. Inspect the Preview and database before any repeat.';
  } finally { busy = false; statusButton.disabled = false; sync(); }
});
inspectButton.addEventListener('click',async()=>{
  if(inspectButton.disabled||busy)return;
  const runId=inspectionRunId.value.trim();
  if(runId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(runId)){display({status:'blocked',code:'invalid_run_id'});return;}
  busy=true;statusButton.disabled=true;sync();
  try {
    const response=await fetch('/api/diagnostic',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(55_000),
      headers:{'Content-Type':'application/json','X-ACL-Preview-Action':'explicit-operator-click'},
      body:JSON.stringify({action:'inspect-validation-schemas',confirmation:'INSPECT VALIDATION SCHEMAS READ ONLY',...(runId?{runId}:{})})});
    display(await response.json());gateStatus.textContent='Read-only inspection returned. Mutation remains disabled after an attempted run.';
  } catch {display({status:'inspection_incomplete',readOnly:true,mutationRearmed:false});}
  finally {busy=false;statusButton.disabled=false;sync();}
});
// Intentionally no fetch, timer, form submission, or automatic execution here.
sync();
