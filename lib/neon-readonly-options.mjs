// Matches the original validator's direct-host and strict-TLS acceptance policy.
// This does not read the environment, construct a client, or make a connection.
export function readonlyConnectionOptions(raw) {
  if(typeof raw!=='string'||!raw)throw new Error('direct_connection_required');
  let parsed;try{parsed=new URL(raw);}catch{throw new Error('direct_connection_required');}
  if(!['postgres:','postgresql:'].includes(parsed.protocol)||parsed.hash||!parsed.username||!parsed.password)throw new Error('direct_connection_required');
  const host=parsed.hostname;
  if(!/^ep-[a-z0-9-]+\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+neon\.tech$/.test(host)||host.split('.')[0].includes('-pooler')||(parsed.port&&parsed.port!=='5432'))throw new Error('direct_connection_required');
  for(const key of parsed.searchParams.keys())if(!['sslmode','channel_binding','connect_timeout'].includes(key))throw new Error('unexpected_connection_option');
  let user,password,database;try{user=decodeURIComponent(parsed.username);password=decodeURIComponent(parsed.password);database=decodeURIComponent(parsed.pathname.slice(1));}catch{throw new Error('invalid_connection_encoding');}
  if(!database||database.includes('/')||/[\r\n\0]/.test(host+user+database))throw new Error('invalid_connection_fields');
  return {host,port:5432,user,password,database,enableChannelBinding:true,ssl:{rejectUnauthorized:true,servername:host,minVersion:'TLSv1.2'},
    connectionTimeoutMillis:10_000,query_timeout:4_000,statement_timeout:3_000,lock_timeout:1_000,
    idle_in_transaction_session_timeout:5_000,
    options:'-c default_transaction_read_only=on',application_name:'acl-readonly-validation-inspection'};
}
