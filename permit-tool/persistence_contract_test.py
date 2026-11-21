import tempfile,pathlib,unittest
from queue import Queue
from persistence_contract import deployment_blockers,snapshot,restore
class PersistenceTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.t.name);self.q=Queue(str(self.root/'live.db'))
 def tearDown(self):self.q.db.close();self.t.cleanup()
 def test_fail_closed_config(self):
  for c in (None,{}, {'runtime':'serverless','databasePath':'/tmp/queue.db'}):self.assertTrue(deployment_blockers(c))
 def test_reviewed_postgres_contract(self):
  c={k:True for k in ('operatorVerified','durableStorageVerified','privateAccessVerified','tlsVerified','encryptionAtRestVerified','backupRestoreTested','backupFailureAlertVerified','leastPrivilegeVerified')}
  c.update(backend='managed_postgres',runtime='serverless',connectionMode='pooled',schemaVersion=1,paidPlan=False,databaseResourceId='SYNTHETIC-NOT-PROVISIONED')
  self.assertEqual(deployment_blockers(c),[])
  c['backupRestoreTested']=False;self.assertIn('backupRestoreTested_required',deployment_blockers(c))
  c['paidPlan']=True;self.assertIn('free_plan_verified_required',deployment_blockers(c))
 def test_dev_storage_not_production(self):
  c={k:True for k in ('operatorVerified','durableVolumeVerified','privateAccessVerified','encryptionAtRestVerified','backupRestoreTested','backupFailureAlertVerified')};c.update(runtime='persistent_single_host',backend='sqlite',databasePath='/workspace/q.db',backupPath='/tmp/q.backup');self.assertTrue(deployment_blockers(c))
 def test_wal_snapshot_restore_and_fence(self):
  self.q.enqueue('running',{});lease=self.q.claim(1);self.q.enqueue('cancelled',{});self.q.cancel('cancelled',{'source':'owner_confirmation','key':'cancelled','confirmation_id':'test'})
  manifest=snapshot(self.root/'live.db',self.root/'backup.db');restore(self.root/'backup.db',manifest,self.root/'restored.db');q=Queue(str(self.root/'restored.db'))
  try:
   self.assertEqual(q.get('cancelled')[0],'cancelled');self.assertEqual(q.get('running')[0],'pending');self.assertFalse(q.finish('running',lease['token'],{'state':'blocked'},2));self.assertFalse(q.enqueue('running',{}));self.assertIsNotNone(q.claim(2))
  finally:q.db.close()
 def test_corruption_rejected(self):
  self.q.enqueue('x',{});manifest=snapshot(self.root/'live.db',self.root/'backup.db');(self.root/'backup.db').write_bytes(b'corrupt')
  with self.assertRaises(ValueError):restore(self.root/'backup.db',manifest,self.root/'restore.db')
  self.assertFalse((self.root/'restore.db').exists())
 def test_no_overwrite(self):
  self.q.enqueue('x',{});manifest=snapshot(self.root/'live.db',self.root/'backup.db')
  with self.assertRaises(ValueError):snapshot(self.root/'live.db',self.root/'backup.db')
  with self.assertRaises(ValueError):restore(self.root/'backup.db',manifest,self.root/'live.db')
 def test_missing_source_does_not_create(self):
  with self.assertRaises(ValueError):snapshot(self.root/'missing',self.root/'backup.db')
  self.assertFalse((self.root/'missing').exists())
if __name__=='__main__':unittest.main()
