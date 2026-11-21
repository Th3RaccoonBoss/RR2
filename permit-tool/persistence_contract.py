"""Local persistence utilities. Config attestations must come from trusted deployment review.
A passing validator is NOT proof that a cloud volume is durable or private.
"""
import hashlib,json,os,pathlib,sqlite3,tempfile,datetime

def deployment_blockers(c):
 """Managed Postgres readiness contract, not credentials or connectivity verification."""
 if not isinstance(c,dict):return ['invalid_config']
 b=[]
 for field in ('operatorVerified','durableStorageVerified','privateAccessVerified','tlsVerified','encryptionAtRestVerified','backupRestoreTested','backupFailureAlertVerified','leastPrivilegeVerified'):
  if c.get(field) is not True:b.append(field+'_required')
 if c.get('backend')!='managed_postgres':b.append('managed_postgres_required')
 if c.get('runtime') not in ('serverless','persistent_single_host'):b.append('supported_runtime_required')
 if c.get('connectionMode')!='pooled':b.append('pooled_connection_required')
 if c.get('schemaVersion')!=1:b.append('schema_migration_required')
 if c.get('paidPlan') is not False:b.append('free_plan_verified_required')
 if not isinstance(c.get('databaseResourceId'),str) or not c['databaseResourceId'].strip():b.append('verified_database_resource_required')
 return b

def digest(path):
 h=hashlib.sha256()
 with open(path,'rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()

def verify_sqlite(path):
 con=sqlite3.connect(pathlib.Path(path).resolve().as_uri()+'?mode=ro',uri=True)
 try:
  if con.execute('PRAGMA integrity_check').fetchone()!=('ok',):raise ValueError('backup integrity failed')
  cols=[r[1] for r in con.execute('PRAGMA table_info(requests)')]
  if cols!=['key','payload','status','lease_token','lease_until','attempts','result']:raise ValueError('unsupported schema')
  if con.execute("SELECT COUNT(*) FROM requests WHERE status NOT IN ('pending','processing','review','manual_review','cancelled')").fetchone()[0]:raise ValueError('unsupported status')
 finally:con.close()

def snapshot(source,destination):
 """Consistent SQLite backup, including committed WAL; destination must not exist."""
 source=pathlib.Path(source).resolve();dest=pathlib.Path(destination)
 if dest.exists() or dest.is_symlink():raise ValueError('destination exists')
 if not source.is_file():raise ValueError('source missing')
 fd,temp=tempfile.mkstemp(prefix='.queue-backup-',dir=dest.parent);os.close(fd)
 try:
  a=sqlite3.connect(source.as_uri()+'?mode=ro',uri=True);b=sqlite3.connect(temp)
  try:a.backup(b)
  finally:b.close();a.close()
  verify_sqlite(temp)
  with open(temp,'rb') as f:os.fsync(f.fileno())
  # Hard-link publication refuses any raced existing target, unlike os.replace.
  os.link(temp,dest)
  return {'schemaVersion':1,'sha256':digest(dest),'bytes':dest.stat().st_size,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 finally:
  os.unlink(temp)

def restore(snapshot_path,manifest,destination):
 """Restore offline into a NEW database. Never replace a live DB. Fence old leases."""
 if not isinstance(manifest,dict) or manifest.get('schemaVersion')!=1 or digest(snapshot_path)!=manifest.get('sha256'):raise ValueError('backup checksum mismatch')
 verify_sqlite(snapshot_path)
 result=snapshot(snapshot_path,destination)
 con=sqlite3.connect(destination)
 try:
  con.execute("UPDATE requests SET status=CASE WHEN attempts>=3 THEN 'manual_review' ELSE 'pending' END,lease_token=NULL,lease_until=NULL,result=? WHERE status='processing'",(json.dumps({'state':'blocked','blockers':['restore_requires_revalidation'],'allowedExternalActions':[]}),))
  con.commit()
 finally:con.close()
 result['sha256']=digest(destination)
 result['restoredLeasesFenced']=True
 return result
