import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createPrivateCallerGate} from './private-caller-auth.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const pem=publicKey.export({type:'spki',format:'pem'});let now=Date.now(),seen=new Set();
const gate=createPrivateCallerGate({publicKeyPem:pem,expiresAt:now+3600000,now:()=>now,replayStore:{async consume(n){if(seen.has(n))return false;seen.add(n);return true;}}});
function req({nonce='abcdefghijklmnopqrstuvwx',body={mailbox:'info@raccoonrestoration.com',messageId:'0123456789abcdef'},path='/intake',timestamp=now,method='POST',tamper=false}={}){
 const text=JSON.stringify(body),digest=createHash('sha256').update(text).digest('hex');
 const signature=sign(null,Buffer.from(`permit-pilot-v1\nPOST\n/intake\n${timestamp}\n${nonce}\n${digest}`),privateKey).toString('base64url');
 return new Request('https://private.invalid'+path,{method,headers:{'content-type':'application/json','x-permit-timestamp':String(timestamp),'x-permit-nonce':nonce,'x-permit-signature':signature},body:tamper?text+' ':text});
}
assert.equal((await gate(req())).ok,true);
assert.equal((await gate(req())).ok,false);
assert.equal((await gate(req({nonce:'abcdefghijklmnopqrstuvwy',tamper:true}))).ok,false);
assert.equal((await gate(req({nonce:'abcdefghijklmnopqrstuvwz',body:{mailbox:'other@example.com',messageId:'0123456789abcdef'}}))).ok,false);
assert.equal((await gate(req({path:'/intake?admin=1'}))).status,404);
assert.equal((await gate(req({timestamp:now-61000}))).ok,false);
assert.equal((await gate(req({nonce:'abcdefghijklmnopqrstuvw1',body:{mailbox:'info@raccoonrestoration.com',messageId:'0123456789abcdef',approve:true}}))).ok,false);
const outage=createPrivateCallerGate({publicKeyPem:pem,expiresAt:now+3600000,replayStore:{async consume(){throw Error('unavailable')}}});assert.equal((await outage(req())).status,503);
now+=3600001;assert.equal((await gate(req())).ok,false);
console.log('9 private caller admission checks passed (local only, replay store stubbed)');
