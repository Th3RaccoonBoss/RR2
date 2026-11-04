import { CONFIRMATION, INSPECTION_CONFIRMATION, grantGate, inspectionGate, postGate, previewGate } from '../lib/gates.mjs';
import { runNeonValidation } from '../lib/neon-runner.mjs';
import { runReadonlyInspection } from '../lib/inspection-runner.mjs';
import { validRunId } from '../lib/inspection-core.mjs';

const MAX_BODY_BYTES = 512;
function reply(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  const declared = req.headers['content-length'];
  if (declared !== undefined && (!/^\d+$/.test(String(declared)) || Number(declared) > MAX_BODY_BYTES)) throw new Error('invalid_request');
  if (req.body !== undefined) {
    const text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error('invalid_request');
    return JSON.parse(text);
  }
  let text = '', bytes = 0;
  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > MAX_BODY_BYTES) throw new Error('invalid_request');
    text += chunk;
  }
  return JSON.parse(text);
}

export function createHandler({ env = process.env, runner = runNeonValidation, inspector = runReadonlyInspection, clock = Date.now } = {}) {
  // This lock avoids accidental double clicks within a warm function only.
  // It is NOT a durable, distributed or single-use authorization mechanism.
  let running = false, attempted = false;
  return async function diagnostic(req, res) {
    if (previewGate(env)) return reply(res, 404, { status: 'unavailable', executed: false });
    if (req.method === 'GET') {
      const blocked = grantGate(env, clock());
      return reply(res, 200, { version: 'acl-runtime-preview/v1', status: 'inert', executed: false,
        dbExecutionEnabled: !blocked && !attempted, blockedReason: attempted ? 'instance_already_attempted' : blocked,
        inspectionEnabled: !inspectionGate(env, clock()), inspectionBlockedReason: inspectionGate(env, clock()),
        platformProtection: 'must_be_verified_operationally', aclProbe: 'offline_only_no_live_route',
        productionFallback: false, automaticChecks: false, maximumRunSeconds: 150 });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return reply(res, 405, { status: 'blocked', code: 'method_not_allowed', executed: false }); }
    const blocked = postGate(req, env) || (grantGate(env, clock()) && inspectionGate(env, clock()) ? grantGate(env, clock()) : null);
    if (blocked) return reply(res, 403, { status: 'blocked', code: blocked, executed: false });
    if (running) return reply(res, 409, { status: 'blocked', code: 'instance_busy', executed: false });
    let body;
    try { body = await readBody(req); } catch { return reply(res, 400, { status: 'blocked', code: 'invalid_request', executed: false }); }
    if(body && Object.getPrototypeOf(body)===Object.prototype && body.action==='inspect-validation-schemas') {
      const keys=Object.keys(body).sort().join(',');
      if(!['action,confirmation','action,confirmation,runId'].includes(keys)||body.confirmation!==INSPECTION_CONFIRMATION||!validRunId(body.runId ?? null))return reply(res,400,{status:'blocked',code:'invalid_inspection_request',executed:false});
      const inspectionBlocked=inspectionGate(env,clock());
      if(inspectionBlocked)return reply(res,403,{status:'blocked',code:inspectionBlocked,executed:false});
      if(running)return reply(res,409,{status:'blocked',code:'instance_busy',executed:false});
      // Crucially: inspection neither sets nor clears the mutating attempt flag.
      running=true;
      try {
        const result=await inspector({env,runId:body.runId ?? null,now:clock()});
        return reply(res,result.status==='blocked'?403:result.status==='inspected'?200:409,result);
      } catch {return reply(res,409,{status:'inspection_incomplete',readOnly:true,mutationRearmed:false});}
      finally {running=false;}
    }
    if (!body || Object.getPrototypeOf(body) !== Object.prototype || Object.keys(body).sort().join(',') !== 'action,confirmation' || body.action !== 'neon-synthetic-validation' || body.confirmation !== CONFIRMATION) return reply(res, 400, { status: 'blocked', code: 'explicit_confirmation_required', executed: false });
    // Re-check after consuming input, then never retry automatically.
    const expired = grantGate(env, clock());
    if (expired) return reply(res, 403, { status: 'blocked', code: expired, executed: false });
    if (running || attempted) return reply(res, 409, { status: 'blocked', code: 'instance_already_attempted', executed: false });
    attempted = true; running = true;
    try {
      const result = await runner({ env, now: clock() });
      return reply(res, result.status === 'blocked' ? 403 : result.status === 'passed' ? 200 : 409, result);
    } catch {
      return reply(res, 409, { status: 'needs_inspection', code: 'execution_outcome_uncertain', executed: true, retryAllowed: false });
    } finally { running = false; }
  };
}

// Plain Vercel Node function, not a Next.js App Router route.
export default createHandler();
