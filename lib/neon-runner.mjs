import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { grantGate } from './gates.mjs';

export const EXECUTION_LIMIT_MS = 150_000;
const OUTPUT_LIMIT_BYTES = 128_000;
const SCRIPT = fileURLToPath(new URL('../vendor/acl-postgres-validation/real-neon-validation.mjs', import.meta.url));
const SOURCE = fileURLToPath(new URL('../vendor/acl-routing-integration/', import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const checks = new Set([
  'fresh_schema_all_four_migrations',
  'independent_sessions_advisory_exclusion_and_client_disconnect',
  'cross_session_transaction_rollback_visibility',
  'durable_attempt_marker_and_idempotent_replay',
  'synthetic_receipt_outbox_and_queue_replay',
  'migration_does_not_activate_any_intake_epoch'
]);
const stages = new Set([...checks, 'database_health', 'create_unique_schema',
  'apply_001-acl-routing-journal.sql', 'apply_002-acl-website-receipts.sql',
  'apply_003-acl-shared-api-quota.sql', 'apply_004-acl-website-submission-sessions.sql']);
const errorCodes = new Set(['missing_database_url_unpooled', 'invalid_database_url_unpooled',
  'neon_direct_host_required', 'unexpected_database_url_option', 'invalid_database_url_encoding',
  'invalid_database_url_fields', 'preview_environment_required', 'postgres_durability_unverified',
  'validation_schema_already_exists', 'validation_search_path_failed', 'ERR_ASSERTION',
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ERR_MODULE_NOT_FOUND',
  'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID']);

export function sanitizeEvent(raw) {
  if (!raw || raw.version !== 'acl-real-neon-validation/v1') return null;
  if (!['passed', 'failed', 'not_completed', 'schema_ready'].includes(raw.status)) return null;
  const result = { version: raw.version, status: raw.status };
  if (UUID.test(raw.runId || '')) result.runId = raw.runId;
  if (/^acl_validation_[0-9a-f]{32}$/.test(raw.schema || '')) result.schema = raw.schema;
  if (checks.has(raw.check)) result.check = raw.check;
  if (stages.has(raw.stage)) result.stage = raw.stage;
  if (raw.error) result.error = { code: errorCodes.has(raw.error.code) || /^[0-9A-Z]{5}$/.test(raw.error.code || '') ? raw.error.code : 'validation_failed' };
  if (typeof raw.schemaCreationConfirmed === 'boolean') result.schemaCreationConfirmed = raw.schemaCreationConfirmed;
  if (typeof raw.retainedSyntheticData === 'boolean') result.retainedSyntheticData = raw.retainedSyntheticData;
  if (Array.isArray(raw.results)) result.results = raw.results.slice(0, 8)
    .filter(item => checks.has(item?.name) && item.status === 'passed')
    .map(item => ({ name: item.name, status: 'passed' }));
  return result;
}

export async function runNeonValidation({ env, now = Date.now(), spawnImpl = spawn, limitMs = EXECUTION_LIMIT_MS }) {
  const gate = grantGate(env, now);
  if (gate) return { status: 'blocked', code: gate, executed: false };
  // Mutation-runner credential access occurs only after all server-side gates.
  if (typeof env.DATABASE_URL_UNPOOLED !== 'string' || !env.DATABASE_URL_UNPOOLED) return { status: 'blocked', code: 'missing_database_url_unpooled', executed: false };
  return new Promise(resolve => {
    let child, bytes = 0, buffer = '', failure = null, settled = false, timer;
    const events = [];
    const finish = (exitCode = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // A final partial line is deliberately not trusted.
      const last = events.at(-1);
      const passed = !failure && exitCode === 0 && last?.status === 'passed' && last?.runId && last?.schema && last?.results?.length === 6 && new Set(last.results.map(item => item.name)).size === 6;
      resolve({ status: passed ? 'passed' : 'needs_inspection', executed: true,
        ...(failure ? { code: failure } : {}), events,
        mutationOutcome: passed ? 'synthetic_schema_retained' : 'uncertain_inspect_before_retry',
        retried: false, aclCalled: false, existingSchemaTargeted: false,
        limitations: ['No provider failover or crash durability test.', 'No production, CRM, routing, calendar or epoch activation.', 'Retained synthetic schema and records require separate cleanup approval.'] });
    };
    const stop = reason => {
      failure = reason;
      try { child?.kill('SIGKILL'); } catch { /* Never expose child errors. */ }
      finish();
    };
    try {
      child = spawnImpl(process.execPath, [SCRIPT, '--execute-preview-only'], {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: { VERCEL_ENV: 'preview', DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED,
          ACL_VALIDATION_SOURCE_DIR: SOURCE },
        // No shell, no inherited NODE_OPTIONS/PG*/proxy/ACL credentials, no stdin.
        shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore']
      });
      timer = setTimeout(() => stop('execution_deadline_outcome_uncertain'), limitMs);
      child.stdout.on('data', chunk => {
        if (settled) return;
        bytes += chunk.length;
        if (bytes > OUTPUT_LIMIT_BYTES) { stop('output_limit_outcome_uncertain'); return; }
        buffer += chunk.toString('utf8');
        let index;
        while ((index = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
          try {
            const event = sanitizeEvent(JSON.parse(line));
            if (event && events.length < 16) events.push(event);
          } catch { /* Drop malformed/unexpected output, never return it. */ }
        }
      });
      child.once('error', () => stop('child_launch_failed_outcome_uncertain'));
      child.once('close', code => finish(code));
    } catch {
      failure = 'child_launch_failed_outcome_uncertain';
      finish();
    }
  });
}
