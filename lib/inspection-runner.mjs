import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectionGate} from './gates.mjs';
import {validRunId,sanitizeInspection} from './inspection-core.mjs';
const SCRIPT=fileURLToPath(new URL('./inspection-worker.mjs',import.meta.url));
export const INSPECTION_LIMIT_MS=45_000;

export async function runReadonlyInspection({env,runId=null,now=Date.now(),spawnImpl=spawn,limitMs=INSPECTION_LIMIT_MS}) {
  const gate=inspectionGate(env,now);
  if(gate)return {status:'blocked',code:gate,executed:false};
  if(!validRunId(runId))return {status:'blocked',code:'invalid_run_id',executed:false};
  if(typeof env.DATABASE_URL_UNPOOLED!=='string'||!env.DATABASE_URL_UNPOOLED)return {status:'blocked',code:'missing_database_url_unpooled',executed:false};
  return new Promise(resolve=>{
    let child,timer,settled=false,bytes=0,buffer='',result=null;
    const finish=(code=1)=>{if(settled)return;settled=true;clearTimeout(timer);resolve(code===0&&result?{...result,executed:true}:{status:'inspection_incomplete',readOnly:true,executed:true,mutationRearmed:false,retried:false});};
    const stop=()=>{try{child?.kill('SIGKILL');}catch{}finish();};
    try {
      child=spawnImpl(process.execPath,[SCRIPT,'--inspect-preview-only'],{cwd:fileURLToPath(new URL('../',import.meta.url)),
        env:{VERCEL_ENV:'preview',DATABASE_URL_UNPOOLED:env.DATABASE_URL_UNPOOLED,...(runId?{ACL_INSPECTION_RUN_ID:runId}:{})},
        shell:false,windowsHide:true,stdio:['ignore','pipe','ignore']});
      timer=setTimeout(stop,limitMs);
      child.stdout.on('data',chunk=>{if(settled)return;bytes+=chunk.length;if(bytes>32_000)return stop();buffer+=chunk.toString('utf8');let index;
        while((index=buffer.indexOf('\n'))!==-1){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);try{const next=sanitizeInspection(JSON.parse(line));if(next)result=next;}catch{}}});
      child.once('error',stop);child.once('close',finish);
    } catch {stop();}
  });
}
