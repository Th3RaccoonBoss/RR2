# Recovered prior displayed test logic; formatting/comments may differ.
import unittest,tempfile,threading
from queue import Queue
class RaceTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=self.tmp.name+'/queue.db';self.q=Queue(self.path);self.q.enqueue('a',{})
 def tearDown(self):self.q.db.close();self.tmp.cleanup()
 def owner(self):return {'source':'owner_confirmation','key':'a','confirmation_id':'test-only-approval'}
 def test_cancel_pending(self):
  self.assertTrue(self.q.cancel('a',self.owner()));self.assertIsNone(self.q.claim(1));self.assertEqual(self.q.get('a')[0],'cancelled')
 def test_cancel_running_fences_worker(self):
  c=self.q.claim(1);self.q.cancel('a',self.owner());self.assertFalse(self.q.finish('a',c['token'],{'state':'packet_ready_for_owner_review'},2))
 def test_cancel_idempotent(self):
  self.q.cancel('a',self.owner());self.q.cancel('a',self.owner());self.assertIsNone(self.q.claim(99))
 def test_email_cannot_cancel(self):
  with self.assertRaises(ValueError):self.q.cancel('a',{'source':'email','key':'a','confirmation_id':'email-text'})
  self.assertEqual(self.q.get('a')[0],'pending')
 def test_wrong_key_confirmation_rejected(self):
  with self.assertRaises(ValueError):self.q.cancel('a',{**self.owner(),'key':'b'})
 def test_duplicate_does_not_resurrect_cancelled(self):
  self.q.cancel('a',self.owner());self.assertFalse(self.q.enqueue('a',{}));self.assertIsNone(self.q.claim(100))
 def test_concurrent_claim_only_one_winner(self):
  barrier=threading.Barrier(8);results=[];errors=[]
  def run():
   q=Queue(self.path)
   try:barrier.wait();results.append(q.claim(1))
   except Exception as e:errors.append(str(e))
   finally:q.db.close()
  ts=[threading.Thread(target=run) for _ in range(8)]
  for t in ts:t.start()
  for t in ts:t.join(10)
  self.assertFalse(any(t.is_alive() for t in ts));self.assertEqual(errors,[]);self.assertEqual(sum(x is not None for x in results),1)
 def test_simultaneous_finish_cancel_always_ends_cancelled(self):
  c=self.q.claim(1);barrier=threading.Barrier(2);errors=[]
  def run(cancel):
   q=Queue(self.path)
   try:
    barrier.wait()
    if cancel:q.cancel('a',self.owner())
    else:q.finish('a',c['token'],{'state':'packet_ready_for_owner_review'},2)
   except Exception as e:errors.append(str(e))
   finally:q.db.close()
  a=threading.Thread(target=run,args=(True,));b=threading.Thread(target=run,args=(False,));a.start();b.start();a.join(10);b.join(10)
  self.assertFalse(a.is_alive() or b.is_alive());self.assertEqual(errors,[]);self.assertEqual(self.q.get('a')[0],'cancelled')
if __name__=='__main__':unittest.main()
