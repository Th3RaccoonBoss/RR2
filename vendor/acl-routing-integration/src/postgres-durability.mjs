/** Explicit storage-provider health policy. No connection, credential loading or
 * server configuration changes. A provider profile is not failover test evidence.
 */
const fail=code=>Object.assign(new Error(code),{code});
const STANDARD_QUERY="SELECT NOT pg_is_in_recovery() AS writable, current_setting('fsync') AS fsync, current_setting('transaction_read_only') AS read_only";
const NEON_QUERY=`SELECT NOT pg_is_in_recovery() AS writable, current_setting('fsync') AS fsync,
  current_setting('transaction_read_only') AS read_only, current_setting('synchronous_commit') AS synchronous_commit,
  current_setting('synchronous_standby_names') AS synchronous_standby_names,
  current_setting('shared_preload_libraries') AS shared_preload_libraries`;
function verifyNeonConnection(pool,approvedHost) {
  const config=pool?.options,host=config?.host,ssl=config?.ssl;
  if(typeof approvedHost!=='string'||host!==approvedHost||!/^ep-[a-z0-9-]+\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+neon\.tech$/.test(host)||host.split('.')[0].includes('-pooler')||config.connectionString||config.sslmode||config.port!==5432) throw fail('neon_direct_connection_required');
  // Bind the check to the actual injected pool's options, not a detached claim.
  // A URI sslmode can override explicit TLS options in drivers, so connectionString
  // is deliberately disallowed in this narrow profile. Host securely constructs
  // the pool from approved values; credentials never appear in this module.
  if(!ssl||Object.getPrototypeOf(ssl)!==Object.prototype||ssl.rejectUnauthorized!==true||ssl.servername!==host||
    Object.keys(ssl).some(k=>!['rejectUnauthorized','servername','minVersion'].includes(k))||
    (ssl.minVersion!==undefined&&!['TLSv1.2','TLSv1.3'].includes(ssl.minVersion))) throw fail('neon_strict_tls_required');
}
export function createPostgresDurabilityGuard({profile='postgres',pool,approvedHost}={}) {
  if(!['postgres','neon-managed'].includes(profile))throw fail('invalid_durability_profile');
  if(profile==='neon-managed')verifyNeonConnection(pool,approvedHost);
  return async function assertWritable(query) {
    if(typeof query!=='function')throw fail('postgres_durability_unverified');
    if(profile==='neon-managed')verifyNeonConnection(pool,approvedHost);
    let row;try{row=(await query(profile==='postgres'?STANDARD_QUERY:NEON_QUERY)).rows?.[0];}catch{throw fail('postgres_durability_unverified');}
    if(row?.writable!==true||row.read_only!=='off')throw fail('postgres_durability_unverified');
    if(profile==='postgres') {
      if(row.fsync!=='on')throw fail('postgres_durability_unverified');
    } else {
      const libraries=typeof row.shared_preload_libraries==='string'?row.shared_preload_libraries.split(',').map(s=>s.trim().replace(/^"(.*)"$/,'$1')):[];
      if(!['on','off'].includes(row.fsync)||row.synchronous_commit!=='on'||row.synchronous_standby_names!=='walproposer'||!libraries.includes('neon'))throw fail('postgres_durability_unverified');
    }
  };
}
