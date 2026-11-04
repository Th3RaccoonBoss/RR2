/** Offline PostgreSQL receipt/outbox adapter. No driver or connection at import.
 * Use dedicated non-reconnecting sessions (not transaction-mode pooling).
 * COMMIT returns before an ACL create may start. SQL connection/failover remains
 * a deployment verification gate; mocks are not production durability proof.
 */
import {randomUUID} from 'node:crypto';
import {createPostgresDurabilityGuard} from './postgres-durability.mjs';
import {WEBSITE_SESSION_VERSION,isReservedWebsiteSession,isCanonicalWebsiteSession} from './website-submission-sessions.mjs';
import {WEBSITE_RECEIPT_VERSION,websiteSubmissionId,websiteRecordId,validateReceiptInput} from './website-intake-bridge.mjs';
const fail=code=>Object.assign(new Error(code),{code});
function safeReason(value) { if(!/^[a-z0-9_]{1,100}$/.test(value??'')) throw fail('invalid_receipt_reason'); return value; }
const snapshot=row=>row?({submissionId:row.submission_id,payloadHash:row.payload_hash,requestedAppointment:row.requested_appointment,
  status:row.status,contactId:row.contact_id,jobId:row.job_id,contactAttempted:row.contact_attempted_at!=null,
  jobAttempted:row.job_attempted_at!=null,reason:row.reason,outboxStatus:row.outbox_status==='delivered'?'delivered':'pending',
  ...(row.session_epoch_id?{sessionEpochId:row.session_epoch_id}: {})}):null;

export function createPostgresWebsiteIntakeStore({pool,checkSessionIsolation,databaseDurability={}}={}) {
  if(typeof pool?.connect!=='function') throw fail('durable_receipt_store_required');
  const assertWritable=createPostgresDurabilityGuard({...databaseDurability,pool});
  async function withClient(fn) {
    let client,broken=false,active=true;
    const lost=()=>{broken=true;};
    try {
      client=await pool.connect();
      if(typeof client?.query!=='function' || typeof client?.release!=='function') throw fail('receipt_store_unavailable');
      client.on?.('error',lost);
      const query=async(sql,values=[])=>{
        if(!active || broken) throw fail('receipt_store_unavailable');
        try { return await client.query(sql,values); }
        catch { broken=true; throw fail('receipt_store_unavailable'); }
      };
      await assertWritable(query);
      const transaction=async fn=>{
        let begun=false;
        try {
          await query('BEGIN'); begun=true;
          await query("SET LOCAL synchronous_commit = 'on'");
          const result=await fn();
          await query('COMMIT'); return result;
        } catch(cause) {
          if(begun) { try { await query('ROLLBACK'); } catch { broken=true; } }
          throw cause;
        }
      };
      return await fn(query,transaction,()=>{broken=true;});
    } catch(cause) {
      if(['submission_lock_busy','receipt_transition_rejected','receipt_store_unavailable','submission_session_rejected','submission_namespace_not_isolated'].includes(cause?.code)) throw cause;
      throw fail('receipt_store_unavailable');
    } finally {
      active=false;
      client?.removeListener?.('error',lost);
      client?.release?.(broken?fail('receipt_store_unavailable'):undefined);
    }
  }
  async function requireIsolation(query,epochId,operation) {
    if(typeof checkSessionIsolation!=='function') throw fail('submission_namespace_not_isolated');
    const result=await query('SELECT epoch_id, isolation_revision, state FROM acl_website_intake_epochs WHERE epoch_id = $1 FOR SHARE',[epochId]);
    const epoch=result.rows?.[0];
    if(epoch?.state!=='active') throw fail('submission_namespace_not_isolated');
    let proof;
    try { proof=await checkSessionIsolation({epochId:epoch.epoch_id,isolationRevision:epoch.isolation_revision,operation}); }
    catch { throw fail('submission_namespace_not_isolated'); }
    if(proof?.isolated!==true || proof.epochId!==epoch.epoch_id || proof.isolationRevision!==epoch.isolation_revision ||
       proof.scope!=='all_intake_paths_and_inflight' || proof.rollbackProtected!==true || proof.nonLossyJournal!==true) throw fail('submission_namespace_not_isolated');
    return epoch;
  }
  async function runExclusive(submissionId,callback) {
    submissionId=websiteSubmissionId(submissionId);
    if(typeof callback!=='function') throw fail('invalid_receipt_callback');
    return withClient(async(query,tx,poison)=>{
      let locked=false,preparedHash=null;
      const read=async()=>{
        const result=await query(`SELECT s.*, o.status AS outbox_status FROM acl_website_submissions s
          LEFT JOIN acl_website_outbox o USING (submission_id) WHERE s.submission_id = $1`,[submissionId]);
        return snapshot(result.rows?.[0]);
      };
      const requireRow=async()=>{
        const row=await read();
        if(!row || preparedHash && preparedHash!==row.payloadHash) throw fail('receipt_transition_rejected');
        preparedHash=row.payloadHash; return row;
      };
      const sessionRow=async()=>{
        if(!isCanonicalWebsiteSession(submissionId)) throw fail('submission_session_rejected');
        const result=await query(`SELECT *, expires_at > clock_timestamp() AS unexpired
          FROM acl_website_submission_sessions WHERE submission_id = $1 FOR UPDATE`,[submissionId]);
        if(!result.rows?.[0]) throw fail('submission_session_rejected');
        return result.rows[0];
      };
      const requireBoundSession=async(operation)=>{
        const session=await sessionRow();
        const row=await requireRow();
        if(session.state!=='bound' || session.payload_hash!==row.payloadHash || session.epoch_id!==row.sessionEpochId) throw fail('submission_session_rejected');
        await requireIsolation(query,session.epoch_id,operation);
        return row;
      };
      const journal=Object.freeze({
        async read() { const row=await read(); if(row) preparedHash=row.payloadHash; return row; },
        async prepare(input) {
          input=validateReceiptInput(input);
          if(input.submissionId!==submissionId) throw fail('receipt_transition_rejected');
          return tx(async()=>{
            if(isReservedWebsiteSession(submissionId)) {
              const session=await sessionRow();
              const prior=await read();
              if(session.payload_hash && session.payload_hash!==input.payloadHash) return {status:'conflict'};
              if(session.state==='issued') {
                // A restored/malformed issued session must never overwrite a receipt.
                if(prior || !session.unexpired) throw fail('submission_session_rejected');
                await requireIsolation(query,session.epoch_id,'bind_session');
                const bound=await query(`UPDATE acl_website_submission_sessions SET state = 'bound', payload_hash = $2, bound_at = clock_timestamp()
                  WHERE submission_id = $1 AND state = 'issued' AND payload_hash IS NULL AND expires_at > clock_timestamp() RETURNING submission_id`,[submissionId,input.payloadHash]);
                if(bound.rowCount!==1) throw fail('submission_session_rejected');
                await query(`INSERT INTO acl_website_submissions(submission_id,payload_hash,requested_appointment,session_epoch_id,issued_session_id)
                  VALUES ($1,$2,$3::jsonb,$4,$1)`,[submissionId,input.payloadHash,input.requestedAppointment===null?null:JSON.stringify(input.requestedAppointment),session.epoch_id]);
              } else if(!prior || session.payload_hash!==prior.payloadHash || session.epoch_id!==prior.sessionEpochId ||
                (session.state!=='bound' && !(session.state==='revoked' && prior.status==='accepted'))) throw fail('submission_session_rejected');
            } else await query(`INSERT INTO acl_website_submissions(submission_id,payload_hash,requested_appointment)
              VALUES ($1,$2,$3::jsonb) ON CONFLICT (submission_id) DO NOTHING`,
              [submissionId,input.payloadHash,input.requestedAppointment===null?null:JSON.stringify(input.requestedAppointment)]);
            const row=await read();
            if(!row) throw fail('receipt_transition_rejected');
            if(row.payloadHash!==input.payloadHash || (row.requestedAppointment?.startDate??null)!==(input.requestedAppointment?.startDate??null) || (row.requestedAppointment?.endDate??null)!==(input.requestedAppointment?.endDate??null)) return {...row,status:'conflict'};
            preparedHash=input.payloadHash; return row;
          });
        },
        async markAttempted(phase) {
          if(!preparedHash || !['contact','job'].includes(phase)) throw fail('receipt_transition_rejected');
          return tx(async()=>{
            if(isReservedWebsiteSession(submissionId)) await requireBoundSession(`attempt_${phase}`);
            // Column selection is from this internal two-value allowlist only.
            const column=phase==='contact'?'contact_attempted_at':'job_attempted_at';
            const condition=phase==='contact'?'contact_id IS NULL':'contact_id IS NOT NULL';
            const result=await query(`UPDATE acl_website_submissions SET ${column} = clock_timestamp(),
              reason = NULL, updated_at = clock_timestamp() WHERE submission_id = $1 AND payload_hash = $2
              AND status <> 'accepted' AND ${column} IS NULL AND ${condition} RETURNING submission_id`,[submissionId,preparedHash]);
            if(result.rowCount!==1) throw fail('receipt_transition_rejected');
          });
        },
        /** Provenance permission, never an assertion of global ACL absence. */
        async authorizeFreshSession() {
          if(!isReservedWebsiteSession(submissionId)) return {allowed:false};
          return tx(async()=>{
            const row=await requireBoundSession('authorize_first_job');
            return {allowed:row.jobAttempted===false && !row.jobId,epochId:row.sessionEpochId};
          });
        },
        async assertCreateAuthority(phase) {
          if(!isReservedWebsiteSession(submissionId) || !['contact','job'].includes(phase)) throw fail('submission_session_rejected');
          return tx(async()=>{
            const row=await requireBoundSession(`before_${phase}_create`);
            if(!row[`${phase}Attempted`] || row.jobId) throw fail('submission_session_rejected');
          });
        },
        async recordContact(contactId) {
          contactId=websiteRecordId(contactId);
          await requireRow();
          return tx(async()=>{
            const result=await query(`UPDATE acl_website_submissions SET contact_id = $3, reason = NULL,
              updated_at = clock_timestamp() WHERE submission_id = $1 AND payload_hash = $2
              AND (contact_id IS NULL OR contact_id = $3) AND status <> 'accepted' RETURNING submission_id`,[submissionId,preparedHash,contactId]);
            if(result.rowCount!==1) throw fail('receipt_transition_rejected');
          });
        },
        async acceptJob(jobId) {
          jobId=websiteRecordId(jobId);
          await requireRow();
          return tx(async()=>{
            const result=await query(`UPDATE acl_website_submissions SET job_id = $3, status = 'accepted', reason = NULL,
              updated_at = clock_timestamp() WHERE submission_id = $1 AND payload_hash = $2
              AND (job_id IS NULL OR job_id = $3) RETURNING submission_id`,[submissionId,preparedHash,jobId]);
            if(result.rowCount!==1) throw fail('receipt_transition_rejected');
            await query(`INSERT INTO acl_website_outbox(submission_id,job_id) VALUES ($1,$2)
              ON CONFLICT (submission_id) DO NOTHING`,[submissionId,jobId]);
            const outbox=await query('SELECT job_id FROM acl_website_outbox WHERE submission_id = $1',[submissionId]);
            if(outbox.rows?.[0]?.job_id!==jobId) throw fail('receipt_transition_rejected');
            return read();
          });
        },
        async markReview(reason) {
          safeReason(reason); await requireRow();
          return tx(async()=>{
            const result=await query(`UPDATE acl_website_submissions SET status = CASE WHEN job_id IS NULL THEN 'review' ELSE 'accepted' END,
              reason = $3, updated_at = clock_timestamp() WHERE submission_id = $1 AND payload_hash = $2 RETURNING submission_id`,[submissionId,preparedHash,reason]);
            if(result.rowCount!==1) throw fail('receipt_transition_rejected');
          });
        },
        async markOutboxDelivered() {
          await requireRow();
          return tx(async()=>{
            const result=await query(`UPDATE acl_website_outbox o SET status = 'delivered', delivered_at = COALESCE(delivered_at,clock_timestamp())
              FROM acl_website_submissions s WHERE o.submission_id = $1 AND s.submission_id = o.submission_id
              AND s.payload_hash = $2 AND s.status = 'accepted' AND s.job_id = o.job_id RETURNING o.submission_id`,[submissionId,preparedHash]);
            if(result.rowCount!==1) throw fail('receipt_transition_rejected');
          });
        }
      });
      try {
        const result=await query('SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired',[`acl-website:${submissionId}`]);
        if(result.rows?.[0]?.acquired!==true) throw fail('submission_lock_busy');
        locked=true; return await callback(journal);
      } finally {
        if(locked) {
          try {
            const result=await query('SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS released',[`acl-website:${submissionId}`]);
            if(result.rows?.[0]?.released!==true) throw fail('receipt_store_unavailable');
          } catch { poison(); throw fail('receipt_store_unavailable'); }
        }
      }
    });
  }
  return Object.freeze({durability:'distributed',receiptVersion:WEBSITE_RECEIPT_VERSION,sessionVersion:WEBSITE_SESSION_VERSION,runExclusive,
    async issueSubmissionSession({ttlSeconds=1800}={}) {
      if(!Number.isSafeInteger(ttlSeconds) || ttlSeconds<60 || ttlSeconds>3600) throw fail('invalid_session_ttl');
      return withClient((query,tx)=>tx(async()=>{
        const active=await query("SELECT epoch_id FROM acl_website_intake_epochs WHERE state = 'active' FOR SHARE");
        if(active.rows?.length!==1) throw fail('submission_namespace_not_isolated');
        const epoch=await requireIsolation(query,active.rows[0].epoch_id,'issue_session');
        const submissionId=`rr-v2-${randomUUID()}`;
        const result=await query(`INSERT INTO acl_website_submission_sessions(submission_id,epoch_id,expires_at)
          VALUES ($1,$2,clock_timestamp() + ($3 * interval '1 second')) RETURNING submission_id,expires_at`,[submissionId,epoch.epoch_id,ttlSeconds]);
        if(!result.rows?.[0]) throw fail('submission_session_rejected');
        return {submissionId:result.rows[0].submission_id,expiresAt:new Date(result.rows[0].expires_at).toISOString()};
      }));
    },
    /** Read-only discovery. No raw payload recovery and no autonomous retries. */
    async listPending({limit=100}={}) {
      if(!Number.isSafeInteger(limit) || limit<1 || limit>500) throw fail('invalid_receipt_limit');
      return withClient(async query=>{
        const result=await query(`SELECT s.submission_id, s.job_id, s.status, s.reason, o.status AS outbox_status
          FROM acl_website_submissions s LEFT JOIN acl_website_outbox o USING (submission_id)
          WHERE s.status <> 'accepted' OR o.status = 'pending' OR o.status IS NULL
          ORDER BY s.updated_at, s.submission_id LIMIT $1`,[limit]);
        return result.rows.map(row=>({submissionId:row.submission_id,jobId:row.job_id,status:row.status,reason:row.reason,outboxStatus:row.outbox_status??null}));
      });
    }
  });
}
