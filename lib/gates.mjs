export const GRANT = 'one-isolated-synthetic-schema-v1';
export const CONFIRMATION = 'CREATE ONE ISOLATED SYNTHETIC SCHEMA';
export const MAX_GRANT_MS = 10 * 60 * 1000;
export const INSPECTION_GRANT = 'read-validation-schema-metadata-v1';
export const INSPECTION_CONFIRMATION = 'INSPECT VALIDATION SCHEMAS READ ONLY';
export const MAX_INSPECTION_GRANT_MS = 30 * 60 * 1000;

export function previewGate(env) {
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'preview') return 'preview_required';
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/.test(env.VERCEL_URL || '')) return 'deployment_origin_unavailable';
  return null;
}

export function grantGate(env, now = Date.now()) {
  const preview = previewGate(env);
  if (preview) return preview;
  if (env.ACL_PREVIEW_PROTECTION_VERIFIED !== '1') return 'protection_not_verified';
  if (env.ACL_PREVIEW_DB_GRANT !== GRANT) return 'db_execution_disabled';
  return windowGate(env.ACL_PREVIEW_DB_GRANT_NOT_BEFORE, env.ACL_PREVIEW_DB_GRANT_EXPIRES_AT, now, MAX_GRANT_MS);
}

export function inspectionGate(env, now = Date.now()) {
  const preview = previewGate(env);
  if (preview) return preview;
  if (env.ACL_PREVIEW_PROTECTION_VERIFIED !== '1') return 'protection_not_verified';
  if (env.ACL_PREVIEW_INSPECTION_GRANT !== INSPECTION_GRANT) return 'inspection_disabled';
  return windowGate(env.ACL_PREVIEW_INSPECTION_NOT_BEFORE, env.ACL_PREVIEW_INSPECTION_EXPIRES_AT, now, MAX_INSPECTION_GRANT_MS);
}

function windowGate(startText, endText, now, maximum) {
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  if (!iso.test(startText || '') || !iso.test(endText || '')) return 'invalid_grant_window';
  const start = Date.parse(startText), end = Date.parse(endText);
  if (!Number.isFinite(start) || !Number.isFinite(end) || new Date(start).toISOString() !== startText || new Date(end).toISOString() !== endText || end <= start || end - start > maximum) return 'invalid_grant_window';
  if (now < start || now >= end) return 'grant_not_current';
  return null;
}

export function postGate(req, env) {
  // Only the immutable deployment origin is accepted, not caller-controlled Host
  // or forwarding headers. Platform authentication must protect the deployment.
  if (req.headers.origin !== `https://${env.VERCEL_URL}`) return 'same_deployment_origin_required';
  if (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') return 'same_deployment_origin_required';
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) return 'json_required';
  if (req.headers['x-acl-preview-action'] !== 'explicit-operator-click') return 'explicit_action_required';
  return null;
}
