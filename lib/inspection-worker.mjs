import { inspectValidationSchemas, validRunId } from './inspection-core.mjs';
import { readonlyConnectionOptions } from './neon-readonly-options.mjs';
import { fileURLToPath } from 'node:url';

export async function main() {
  if(!process.argv.includes('--inspect-preview-only'))return {status:'not_executed',readOnly:true};
  if(process.env.VERCEL_ENV!=='preview')throw new Error('preview_required');
  const runId=process.env.ACL_INSPECTION_RUN_ID || null;
  if(!validRunId(runId))throw new Error('invalid_run_id');
  const options=readonlyConnectionOptions(process.env.DATABASE_URL_UNPOOLED);
  const {Client}=await import('pg');
  const client=new Client(options);client.on('error',()=>{});
  try { await client.connect();return await inspectValidationSchemas({client,runId}); }
  finally { try { await client.end(); } catch {} }
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  main().then(result=>process.stdout.write(JSON.stringify(result)+'\n')).catch(()=>{
    // Never serialize raw PostgreSQL/driver errors, values, URL or stack traces.
    process.stdout.write(JSON.stringify({status:'inspection_failed',readOnly:true,mutationRearmed:false})+'\n');process.exitCode=1;
  });
}
