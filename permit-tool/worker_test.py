"""New recovery integration test using synthetic local data only."""
import tempfile,json,unittest
from pathlib import Path
from queue import Queue
from worker import run_once
class WorkerTest(unittest.TestCase):
 def test_local_blocked_processing_and_cancel(self):
  with tempfile.TemporaryDirectory() as d:
   p=str(Path(d)/'q.db');q=Queue(p)
   q.enqueue('synthetic:1',{})
   self.assertTrue(run_once(p,100));self.assertEqual(q.get('synthetic:1')[0],'review')
   self.assertEqual(json.loads(q.get('synthetic:1')[2])['allowedExternalActions'],[])
   q.enqueue('synthetic:2',{})
   q.cancel('synthetic:2',{'source':'owner_confirmation','key':'synthetic:2','confirmation_id':'test'})
   self.assertFalse(run_once(p,100));self.assertEqual(q.get('synthetic:2')[0],'cancelled')
if __name__=='__main__':unittest.main()
