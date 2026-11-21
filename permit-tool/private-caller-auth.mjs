// Undeployed server-only boundary. No credentials, HTTP listener or network side effects.
// Admission is NOT task approval. Durable replayStore.consume MUST atomically reject
// previously used nonces across all processes/restarts and fail closed on outage.
import {createHash,createPublicKey,verify} from 'node:crypto';
const ID=/^[A-Za-z0-9_-]{24,100}$/;
export function createPrivateCallerGate({publicKeyPem,expiresAt,replayStore,now=Date.now}) {
 const key=createPublicKey(publicKeyPem);
 if(key.asymmetricKeyType!=='ed25519'||!Number.isSafeInteger(expiresAt)||expiresAt<=now()||typeof replayStore?.consume!=='function')throw new Error('invalid_private_caller_config');
 return async function admit(request){
  const deny=(status=401)=>({ok:false,status});
  if(now()>=expiresAt)return deny();
  const url=new URL(request.url);
  if(request.method!=='POST'||url.pathname!=='/intake'||url.search)return deny(404);
  const timestamp=request.headers.get('x-permit-timestamp');
  const nonce=request.headers.get('x-permit-nonce');
  const sig=request.headers.get('x-permit-signature');
  if(!/^\d{13}$/.test(timestamp||'')||!ID.test(nonce||'')||!sig||!/^[A-Za-z0-9_-]{86}$/.test(sig))return deny();
  if(Math.abs(now()-Number(timestamp))>60000)return deny();
  if(request.headers.get('content-type')!=='application/json')return deny(415);
  let bytes=new Uint8Array(),reader;
  try{
   reader=request.body?.getReader();if(!reader)return deny(400);
   for(;;){const {done,value}=await reader.read();if(done)break;if(bytes.length+value.length>16384){await reader.cancel();return deny(413);}const n=new Uint8Array(bytes.length+value.length);n.set(bytes);n.set(value,bytes.length);bytes=n;}
   const digest=createHash('sha256').update(bytes).digest('hex');
   const canonical=`permit-pilot-v1\nPOST\n/intake\n${timestamp}\n${nonce}\n${digest}`;
   if(!verify(null,Buffer.from(canonical),key,Buffer.from(sig,'base64url')))return deny();
   const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(!body||Array.isArray(body)||Object.keys(body).sort().join(',')!=='mailbox,messageId'||body.mailbox!=='info@raccoonrestoration.com'||!/^[a-f0-9]{16}$/.test(body.messageId))return deny(400);
   // A valid signature identifies the configured caller, never a sales rep.
   if(now()>=expiresAt)return deny();
   if(await replayStore.consume(nonce,Number(timestamp)+60000)!==true)return deny();
   return {ok:true,principal:'permit-runner',event:body,allowedExternalActions:[]};
  }catch{return deny(503);}finally{try{reader?.releaseLock();}catch{}}
 };
}
