export const SCHEMA_PATTERN = /^acl_validation_[0-9a-f]{32}$/;
export const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const TABLES = Object.freeze(['acl_routing_intents','acl_routing_steps','acl_routing_events',
  'acl_routing_queue','acl_routing_followups','acl_website_submissions','acl_website_outbox',
  'acl_api_quota_buckets','acl_website_intake_epochs','acl_website_submission_sessions']);
export const validRunId = value => value === null || RUN_ID_PATTERN.test(value);

// All inputs to SQL identifiers originate from this exact whitelist and a
// validated catalog result, never caller SQL, table names, or schema strings.
export async function inspectValidationSchemas({ client, runId = null }) {
  if (!validRunId(runId)) throw new Error('invalid_run_id');
  let started = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); started = true;
    await client.query("SET LOCAL search_path = pg_catalog");
    await client.query("SET LOCAL row_security = off");
    const mode = await client.query("SELECT current_setting('transaction_read_only') AS mode");
    if (mode.rows?.[0]?.mode !== 'on') throw new Error('read_only_required');
    const exactSchema = runId === null ? null : `acl_validation_${runId.replaceAll('-','')}`;
    const found = await client.query("SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname ~ '^acl_validation_[0-9a-f]{32}$' AND ($1::text IS NULL OR nspname = $1) ORDER BY nspname LIMIT 11",[exactSchema]);
    if (!Array.isArray(found.rows) || found.rows.length > 11 || found.rows.some(row => !SCHEMA_PATTERN.test(row.nspname) || (exactSchema !== null && row.nspname !== exactSchema))) throw new Error('invalid_schema_catalog');
    const schemas = [];
    for (const row of found.rows.slice(0,10)) {
      const schema = row.nspname;
      const catalog = await client.query("SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind = 'r' AND NOT c.relrowsecurity AND c.relname = ANY($2::text[]) ORDER BY c.relname",[schema,TABLES]);
      if (!Array.isArray(catalog.rows) || catalog.rows.length > TABLES.length || catalog.rows.some(row => !TABLES.includes(row.relname))) throw new Error('invalid_table_catalog');
      const present = new Set(catalog.rows.map(row => row.relname));
      const tables = [];
      for (const table of TABLES) {
        if (!present.has(table)) { tables.push({name:table,status:'missing_or_not_plain_table'}); continue; }
        // ONLY excludes inherited descendants. At most 501 rows are scanned for
        // each fixed table; zero customer/record fields leave PostgreSQL.
        const count = await client.query(`SELECT pg_catalog.count(*)::int AS n FROM (SELECT 1 FROM ONLY "${schema}"."${table}" LIMIT 501) AS bounded_rows`);
        const n = count.rows?.[0]?.n;
        if (!Number.isSafeInteger(n) || n < 0 || n > 501) throw new Error('invalid_bounded_count');
        tables.push({name:table,status:'present',rowCount:Math.min(n,500),truncated:n>500});
      }
      schemas.push({schema,expectedTablesPresent:present.size===TABLES.length,tables});
    }
    await client.query('ROLLBACK'); started = false;
    return {status:'inspected',readOnly:true,schemas,truncated:found.rows.length>10,
      schemaLimit:10,rowLimitPerTable:500,exactRunRequested:runId!==null,
      validationSuccessProven:false,mutationRearmed:false};
  } finally {
    if (started) { try { await client.query('ROLLBACK'); } catch { /* no raw errors */ } }
  }
}

// Strict response reconstruction, even when output comes from our child process.
export function sanitizeInspection(raw) {
  if (raw?.status !== 'inspected' || raw.readOnly !== true || !Array.isArray(raw.schemas) || raw.schemas.length > 10 || typeof raw.truncated !== 'boolean' || typeof raw.exactRunRequested !== 'boolean') return null;
  const schemas=[];
  for (const s of raw.schemas) {
    if (!SCHEMA_PATTERN.test(s?.schema) || !Array.isArray(s.tables) || s.tables.length !== TABLES.length) return null;
    const tables=[];
    for (let i=0;i<TABLES.length;i++) {
      const t=s.tables[i]; if(t?.name!==TABLES[i])return null;
      if(t.status==='missing_or_not_plain_table')tables.push({name:t.name,status:t.status});
      else if(t.status==='present'&&Number.isSafeInteger(t.rowCount)&&t.rowCount>=0&&t.rowCount<=500&&typeof t.truncated==='boolean')tables.push({name:t.name,status:t.status,rowCount:t.rowCount,truncated:t.truncated});
      else return null;
    }
    schemas.push({schema:s.schema,expectedTablesPresent:tables.every(t=>t.status==='present'),tables});
  }
  return {status:'inspected',readOnly:true,schemas,truncated:raw.truncated,schemaLimit:10,rowLimitPerTable:500,
    exactRunRequested:raw.exactRunRequested,validationSuccessProven:false,mutationRearmed:false};
}
