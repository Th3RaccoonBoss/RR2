// query must be a parameterized, authenticated connection to dedicated permit_pilot.
export function createReplayStore(query){
 if(typeof query!=='function')throw Error('query_required');
 return {async consume(nonce,expiresAt){
  if(!/^[A-Za-z0-9_-]{24,100}$/.test(nonce)||!Number.isSafeInteger(expiresAt))return false;
  const r=await query(`INSERT INTO public.permit_caller_nonces(nonce,expires_at)
   SELECT $1,to_timestamp($2::double precision/1000)
   WHERE to_timestamp($2::double precision/1000)>clock_timestamp()
     AND to_timestamp($2::double precision/1000)<=clock_timestamp()+interval '2 minutes'
   ON CONFLICT(nonce) DO NOTHING RETURNING nonce`,[nonce,expiresAt]);
  return r.rowCount===1;
 }};
}
