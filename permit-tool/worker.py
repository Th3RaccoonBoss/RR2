"""Newly reconstructed local-only worker. No polling, network, email, or ACL writes."""
import json, subprocess
from pathlib import Path
from queue import Queue

def run_once(db_path, now):
 q=Queue(db_path)
 claim=q.claim(now)
 if claim is None:return False
 # The queue payload is untrusted data, passed as stdin, never code or shell input.
 try:
  module=(Path(__file__).parent/'process.mjs').as_uri()
  js="import {processEnvelope} from "+json.dumps(module)+";let s='';for await(const x of process.stdin)s+=x;console.log(JSON.stringify(processEnvelope(JSON.parse(s),Number(process.argv[1]))));"
  p=subprocess.run(['node','--input-type=module','-e',js,str(now*1000)],input=json.dumps(claim['payload']),text=True,capture_output=True,timeout=10,check=True)
  result=json.loads(p.stdout)
  if result.get('state') not in ('blocked','awaiting_owner_review','packet_ready_for_owner_review','no_permit_needed_review') or result.get('allowedExternalActions',[])!=[]:
   raise ValueError('unsupported result')
 except Exception:
  result={'state':'blocked','blockers':['processing_failed'],'allowedExternalActions':[]}
 return q.finish(claim['key'],claim['token'],result,now)
