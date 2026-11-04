import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/diagnostic.mjs';
import { GRANT, CONFIRMATION, previewGate, grantGate, postGate } from '../lib/gates.mjs';
export const NOW = Date.parse('2026-11-04T14:00:00.000Z');
export const validEnv = () => ({ VERCEL:'1', VERCEL_ENV:'preview', VERCEL_URL:'probe-123.vercel.app',
  ACL_PREVIEW_PROTECTION_VERIFIED:'1', ACL_PREVIEW_DB_GRANT:GRANT,
  ACL_PREVIEW_DB_GRANT_NOT_BEFORE:new Date(NOW - 1000).toISOString(),
  ACL_PREVIEW_DB_GRANT_EXPIRES_AT:new Date(NOW + 120_000).toISOString() });
const validReq = () => ({ method:'POST', headers:{ origin:'https://probe-123.vercel.app', 'content-type':'application/json', 'x-acl-preview-action':'explicit-operator-click' },
  body:{ action:'neon-synthetic-validation', confirmation:CONFIRMATION } });
export async function invoke(handler, request) {
  const headers = {}; let body;
  const res = { statusCode:0, setHeader:(k,v) => { headers[k]=v; }, end:value => { body=JSON.parse(value); } };
  await handler(request, res);
  return { status:res.statusCode, body, headers };
}
const secretTrap = env => Object.defineProperties(env, {
  DATABASE_URL_UNPOOLED:{ get() { throw new Error('A credential was read unexpectedly'); } },
  ACCULYNX_API_KEY:{ get() { throw new Error('ACL credentials are prohibited'); } }
});

test('Preview, Vercel platform and exact deployment hostname fail closed', () => {
  assert.equal(previewGate(validEnv()), null);
  for (const field of ['VERCEL', 'VERCEL_ENV', 'VERCEL_URL']) {
    const env=validEnv(); delete env[field]; assert.ok(previewGate(env));
  }
  for (const value of ['production','development','Preview','']) assert.ok(previewGate({...validEnv(),VERCEL_ENV:value}));
  for (const value of ['example.com','evil.vercel.app.attacker.com','https://probe.vercel.app','probe.vercel.app/path','probe.vercel.app:443','probe.vercel.app\n']) assert.ok(previewGate({...validEnv(),VERCEL_URL:value}));
});
test('Explicit current bounded server-side grant is required', () => {
  assert.equal(grantGate(validEnv(), NOW), null);
  for (const field of ['ACL_PREVIEW_PROTECTION_VERIFIED','ACL_PREVIEW_DB_GRANT','ACL_PREVIEW_DB_GRANT_NOT_BEFORE','ACL_PREVIEW_DB_GRANT_EXPIRES_AT']) {
    const env=validEnv(); delete env[field]; assert.ok(grantGate(env,NOW));
  }
  for (const end of [NOW,NOW-1000,NOW+600_000]) assert.ok(grantGate({...validEnv(),ACL_PREVIEW_DB_GRANT_EXPIRES_AT:new Date(end).toISOString()},NOW));
  assert.ok(grantGate({...validEnv(),ACL_PREVIEW_DB_GRANT_NOT_BEFORE:new Date(NOW+1).toISOString()},NOW));
  assert.ok(grantGate({...validEnv(),ACL_PREVIEW_DB_GRANT_NOT_BEFORE:'2026-02-31T14:00:00.000Z'},NOW));
});
test('Same-origin JSON and explicit POST header required; no host-header trust', () => {
  assert.equal(postGate(validReq(),validEnv()),null);
  for (const field of ['origin','content-type','x-acl-preview-action']) {
    const req=validReq(); delete req.headers[field]; assert.ok(postGate(req,validEnv()));
  }
  const req=validReq(); req.headers.origin='https://attacker.test'; req.headers.host='attacker.test'; assert.ok(postGate(req,validEnv()));
  const cross=validReq();cross.headers['sec-fetch-site']='cross-site';assert.ok(postGate(cross,validEnv()));
});
test('GET never invokes runner or reads credentials, even with an enabled grant', async () => {
  const handler=createHandler({env:secretTrap(validEnv()),clock:()=>NOW,runner:()=>assert.fail('runner invoked')});
  const result=await invoke(handler,{method:'GET',headers:{}});
  assert.equal(result.status,200);assert.equal(result.body.executed,false);assert.equal(result.body.dbExecutionEnabled,true);
  assert.equal(result.headers['Cache-Control'],'no-store');assert.equal(result.body.aclProbe,'offline_only_no_live_route');
});
test('Production and nonplatform hosts return 404 before credentials', async () => {
  for (const env of [{...validEnv(),VERCEL_ENV:'production'},{...validEnv(),VERCEL:undefined}]) {
    const handler=createHandler({env:secretTrap(env),clock:()=>NOW,runner:()=>assert.fail('runner invoked')});
    assert.equal((await invoke(handler,validReq())).status,404);
  }
});
test('Request payload cannot enable a disabled server grant', async () => {
  const env={...validEnv(),ACL_PREVIEW_DB_GRANT:'disabled'};
  const handler=createHandler({env:secretTrap(env),clock:()=>NOW,runner:()=>assert.fail('runner invoked')});
  const request=validReq();request.body.env=validEnv();
  const result=await invoke(handler,request);assert.equal(result.status,403);assert.equal(result.body.executed,false);
});
test('Wrong action, extra fields, broken JSON and excessive input are refused', async () => {
  for (const body of [{...validReq().body, action:'acl-write'}, {...validReq().body, url:'https://example.com'}, {}, [], null, '{', 'x'.repeat(513)]) {
    const handler=createHandler({env:secretTrap(validEnv()),clock:()=>NOW,runner:()=>assert.fail('runner invoked')});
    assert.equal((await invoke(handler,{...validReq(),body})).status,400);
  }
});
test('Methods cannot run checks', async () => {
  const handler=createHandler({env:secretTrap(validEnv()),clock:()=>NOW,runner:()=>assert.fail('runner invoked')});
  for (const method of ['PUT','DELETE','OPTIONS','HEAD','PATCH']) assert.equal((await invoke(handler,{...validReq(),method})).status,405);
});
test('One explicit request uses injected runner; warm instance refuses repetition', async () => {
  let runs=0;
  const handler=createHandler({env:validEnv(),clock:()=>NOW,runner:async()=>{runs++;return {status:'passed',executed:true};}});
  assert.equal((await invoke(handler,validReq())).status,200);
  assert.equal((await invoke(handler,validReq())).status,409);
  assert.equal(runs,1);
  assert.equal((await invoke(handler,{method:'GET',headers:{}})).body.dbExecutionEnabled,false);
});
test('Concurrent duplicate POST and uncertain runner errors never auto-retry', async () => {
  let reject, calls=0;
  const handler=createHandler({env:validEnv(),clock:()=>NOW,runner:()=>{calls++;return new Promise((_,r)=>{reject=r;});}});
  const first=invoke(handler,validReq()); await new Promise(r=>setImmediate(r));
  assert.equal((await invoke(handler,validReq())).status,409);
  reject(new Error('secret connection string must not escape'));
  const result=await first; assert.equal(result.status,409);assert.equal(calls,1);
  assert.ok(!JSON.stringify(result).includes('secret connection'));assert.equal(result.body.retryAllowed,false);
});
