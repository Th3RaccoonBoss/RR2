"""Adapter control-flow tests only, NOT a real Postgres integration acceptance test."""
import unittest
from postgres_queue import PostgresQueue
class Connection:
 autocommit=False
 def __init__(self,rows=()):self.rows=iter(rows);self.commands=[];self.commits=0;self.rollbacks=0;self.rowcount=1
 def cursor(self):return self
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def execute(self,sql,args=None):self.commands.append((sql,args))
 def fetchone(self):return next(self.rows,None)
 def commit(self):self.commits+=1
 def rollback(self):self.rollbacks+=1
class Tests(unittest.TestCase):
 def test_connection_contract(self):
  c=Connection();c.autocommit=True
  with self.assertRaises(ValueError):PostgresQueue(c)
 def test_parameterized_immutable_insert(self):
  c=Connection([("k'",),('{"a":1}',)]);q=PostgresQueue(c)
  self.assertTrue(q.enqueue("k'",{'a':1}));self.assertNotIn("k'",c.commands[0][0]);self.assertEqual(c.commits,1)
 def test_conflicting_payload_rolls_back(self):
  c=Connection([None,('{"a":2}',)]);q=PostgresQueue(c)
  with self.assertRaises(ValueError):q.enqueue('k',{'a':1})
  self.assertEqual(c.rollbacks,1);self.assertEqual(c.commits,0)
 def test_duplicate_has_no_state_update(self):
  c=Connection([None,('{"a":1}',)]);self.assertFalse(PostgresQueue(c).enqueue('k',{'a':1}));self.assertFalse(any('UPDATE' in s for s,a in c.commands))
 def test_claim_uses_db_clock_and_lock(self):
  c=Connection([('k','{}')]);r=PostgresQueue(c).claim(30)
  self.assertEqual(r['key'],'k');self.assertIn('SKIP LOCKED',c.commands[1][0]);self.assertIn('clock_timestamp()',c.commands[1][0]);self.assertEqual(c.commands[1][1][1],30)
 def test_reject_action_results(self):
  c=Connection()
  with self.assertRaises(ValueError):PostgresQueue(c).finish('k','t',{'state':'blocked','allowedExternalActions':['send']})
  self.assertEqual(c.commands,[])
 def test_finish_fences_live_token(self):
  c=Connection();self.assertTrue(PostgresQueue(c).finish('k','t',{'state':'blocked'}));s,args=c.commands[0]
  self.assertIn("status='processing'",s);self.assertIn('lease_until>clock_timestamp()',s);self.assertEqual(args[1:],('k','t'))
 def test_cancel_requires_owner(self):
  c=Connection();q=PostgresQueue(c)
  with self.assertRaises(ValueError):q.cancel('k',{'source':'email'})
  self.assertTrue(q.cancel('k',{'source':'owner_confirmation','key':'k','confirmation_id':'approved'}))
  self.assertIn('lease_token=NULL',c.commands[0][0])
if __name__=='__main__':unittest.main()
