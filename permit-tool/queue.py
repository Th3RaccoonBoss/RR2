"""Recovered from prior exact displayed queue.py source; local prototype only."""
import sqlite3, json, uuid
class Queue:
 def __init__(self,path):
  self.db=sqlite3.connect(path,timeout=5,isolation_level=None)
  self.db.execute('PRAGMA journal_mode=WAL')
  self.db.execute('''CREATE TABLE IF NOT EXISTS requests (
   key TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
   lease_token TEXT, lease_until INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
   result TEXT)''')
 def enqueue(self,key,payload):
  if not isinstance(key,str) or not key: raise ValueError('key required')
  encoded=json.dumps(payload,sort_keys=True,separators=(',',':'))
  self.db.execute('BEGIN IMMEDIATE')
  try:
   old=self.db.execute('SELECT payload FROM requests WHERE key=?',(key,)).fetchone()
   if old:
    if old[0]!=encoded: raise ValueError('payload changed for immutable key')
    self.db.execute('COMMIT'); return False
   self.db.execute('INSERT INTO requests(key,payload) VALUES(?,?)',(key,encoded))
   self.db.execute('COMMIT'); return True
  except: self.db.execute('ROLLBACK');raise
 def claim(self,now,ttl=60):
  if not isinstance(ttl,int) or ttl<1 or ttl>300: raise ValueError('invalid lease')
  self.db.execute('BEGIN IMMEDIATE')
  try:
   self.db.execute("UPDATE requests SET status='manual_review',lease_token=NULL,lease_until=NULL,result=? WHERE status='processing' AND lease_until<=? AND attempts>=3",(json.dumps({'state':'blocked','blockers':['retry_exhausted'],'allowedExternalActions':[]}),now))
   row=self.db.execute("SELECT key,payload FROM requests WHERE attempts<3 AND (status='pending' OR (status='processing' AND lease_until<=?)) ORDER BY rowid LIMIT 1",(now,)).fetchone()
   if row is None:self.db.execute('COMMIT');return None
   token=str(uuid.uuid4())
   self.db.execute("UPDATE requests SET status='processing',lease_token=?,lease_until=?,attempts=attempts+1 WHERE key=?",(token,now+ttl,row[0]))
   self.db.execute('COMMIT');return {'key':row[0],'payload':json.loads(row[1]),'token':token}
  except:self.db.execute('ROLLBACK');raise
 def finish(self,key,token,result,now):
  if result.get('state') not in ('blocked','awaiting_owner_review','packet_ready_for_owner_review','no_permit_needed_review'):raise ValueError('invalid review result')
  cur=self.db.execute("UPDATE requests SET status='review',result=?,lease_token=NULL,lease_until=NULL WHERE key=? AND lease_token=? AND status='processing' AND lease_until>?",(json.dumps(result),key,token,now))
  return cur.rowcount==1
 def cancel(self,key,confirmation):
  if not isinstance(confirmation,dict) or confirmation.get('source')!='owner_confirmation' or confirmation.get('key')!=key or not isinstance(confirmation.get('confirmation_id'),str) or not confirmation['confirmation_id']:
   raise ValueError('explicit owner cancellation required')
  result={'state':'blocked','blockers':['owner_cancelled'],'confirmation_id':confirmation['confirmation_id'],'allowedExternalActions':[]}
  cur=self.db.execute("UPDATE requests SET status='cancelled',lease_token=NULL,lease_until=NULL,result=? WHERE key=?",(json.dumps(result),key))
  return cur.rowcount==1
 def get(self,key):
  return self.db.execute('SELECT status,attempts,result FROM requests WHERE key=?',(key,)).fetchone()
