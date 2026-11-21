"""Private Postgres queue adapter. No connection, migrations or network at import.
Connection is a dedicated psycopg-compatible connection with autocommit=False.
Caller supplies trusted owner confirmations; never expose cancel/restore to mail.
This is not live-tested until an authorized dedicated PostgreSQL database is bound.
"""
import json, uuid

class PostgresQueue:
 def __init__(self, connection):
  if getattr(connection,'autocommit',None) is not False:
   raise ValueError('dedicated transactional connection required')
  self.db=connection
 def enqueue(self,key,payload):
  if not isinstance(key,str) or not 1<=len(key)<=200:raise ValueError('invalid key')
  encoded=json.dumps(payload,sort_keys=True,separators=(',',':'),allow_nan=False)
  if len(encoded.encode())>262144:raise ValueError('payload too large')
  try:
   with self.db.cursor() as c:
    c.execute('INSERT INTO permit_requests(key,payload) VALUES(%s,%s) ON CONFLICT(key) DO NOTHING RETURNING key',(key,encoded))
    added=c.fetchone() is not None
    # INSERT ON CONFLICT waits for concurrent insert; next statement sees committed row.
    c.execute('SELECT payload FROM permit_requests WHERE key=%s FOR SHARE',(key,))
    row=c.fetchone()
    if not row or row[0]!=encoded:raise ValueError('payload changed for immutable key')
   self.db.commit();return added
  except BaseException:self.db.rollback();raise
 def claim(self,ttl=60):
  if type(ttl) is not int or not 1<=ttl<=300:raise ValueError('invalid lease')
  token=str(uuid.uuid4())
  try:
   with self.db.cursor() as c:
    c.execute("""UPDATE permit_requests SET status='manual_review',lease_token=NULL,lease_until=NULL,
      result='{"state":"blocked","blockers":["retry_exhausted"],"allowedExternalActions":[]}'::jsonb
      WHERE status='processing' AND lease_until<=clock_timestamp() AND attempts>=3""")
    c.execute("""WITH candidate AS (
      SELECT key FROM permit_requests WHERE attempts<3 AND
      (status='pending' OR (status='processing' AND lease_until<=clock_timestamp()))
      ORDER BY created_at,key FOR UPDATE SKIP LOCKED LIMIT 1
     ) UPDATE permit_requests p SET status='processing',lease_token=%s,
      lease_until=clock_timestamp()+(%s * interval '1 second'),attempts=p.attempts+1
      FROM candidate c WHERE p.key=c.key RETURNING p.key,p.payload""",(token,ttl))
    row=c.fetchone()
   self.db.commit()
   return None if not row else {'key':row[0],'payload':json.loads(row[1]),'token':token}
  except BaseException:self.db.rollback();raise
 def finish(self,key,token,result):
  if not isinstance(result,dict) or result.get('state') not in ('blocked','awaiting_owner_review','packet_ready_for_owner_review','no_permit_needed_review','checklist_ready_for_review'):
   raise ValueError('invalid review result')
  if result.get('allowedExternalActions',[])!=[] or result.get('allowedActions',[])!=[]:
   raise ValueError('external actions forbidden')
  return self._update("""UPDATE permit_requests SET status='review',result=%s::jsonb,
    lease_token=NULL,lease_until=NULL WHERE key=%s AND lease_token=%s
    AND status='processing' AND lease_until>clock_timestamp()""",
    (json.dumps(result,allow_nan=False),key,token))
 def cancel(self,key,confirmation):
  if not isinstance(confirmation,dict) or confirmation.get('source')!='owner_confirmation' or confirmation.get('key')!=key or not isinstance(confirmation.get('confirmation_id'),str) or not confirmation['confirmation_id']:
   raise ValueError('explicit owner cancellation required')
  result={'state':'blocked','blockers':['owner_cancelled'],'confirmation_id':confirmation['confirmation_id'],'allowedExternalActions':[]}
  return self._update("""UPDATE permit_requests SET status='cancelled',result=%s::jsonb,
    lease_token=NULL,lease_until=NULL WHERE key=%s""",(json.dumps(result),key))
 def _update(self,sql,args):
  try:
   with self.db.cursor() as c:c.execute(sql,args);changed=c.rowcount==1
   self.db.commit();return changed
  except BaseException:self.db.rollback();raise
 def get(self,key):
  try:
   with self.db.cursor() as c:
    c.execute('SELECT status,attempts,result FROM permit_requests WHERE key=%s',(key,));row=c.fetchone()
   self.db.commit();return row
  except BaseException:self.db.rollback();raise
