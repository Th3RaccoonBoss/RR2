import {createPostgresDurabilityGuard} from './postgres-durability.mjs';
/**
 * Offline PostgreSQL adapter. No driver dependency, credentials, connections,
 * schema changes, timers, or background jobs are created by importing this file.
 * Inject a node-postgres-compatible Pool with dedicated, non-reconnecting clients.
 * See docs/durable-routing-journal.md before wiring an authorized deployment.
 */
import { createHash, randomUUID } from "node:crypto";

export const ROUTING_JOURNAL_VERSION = "acl-routing-journal/v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOLLOW_UP_REASONS = Object.freeze({
  confirm_requested_time: ["booking_needs_confirmation"],
  schedule_inspection: ["no_time_requested", "routing_needs_review", "booking_needs_scheduling"],
  verify_then_call: ["booking_needs_verification"]
});
const PHASES = new Set(["assignment", "appointment"]);
const error = code => Object.assign(new Error(code), { code });
const requireId = id => { if (typeof id !== "string" || !UUID.test(id)) throw error("invalid_job_id"); return id.toLowerCase(); };
const submissionId = value => {
  if (typeof value !== "string" || value.length > 100 || !(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) || /^rr-[a-z0-9-]{10,100}$/i.test(value))) throw error("invalid_submission_id");
  return value;
};
const reasonCode = value => { if (!/^[a-z0-9_]{1,100}$/.test(value ?? "")) throw error("invalid_journal_reason"); return value; };
const phaseName = value => { if (!PHASES.has(value)) throw error("invalid_journal_phase"); return value; };
const leaseDuration = value => { if (!Number.isSafeInteger(value) || value < 10 || value > 3600) throw error("invalid_queue_lease"); return value; };

function canonicalAppointment(appointment) {
  if (appointment === null) return null;
  const values = [appointment?.startDate, appointment?.endDate];
  if (values.some(value => typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().replace(".000Z", "Z") !== value.replace(".000Z", "Z")) ||
    Date.parse(values[1]) <= Date.parse(values[0])) throw error("invalid_appointment");
  return { startDate: new Date(values[0]).toISOString(), endDate: new Date(values[1]).toISOString() };
}

/** Only routing IDs and UTC appointment times are journaled, not customer data. */
export function routingIntent({ jobId, representativeId, appointment = null }) {
  return { version: 1, jobId: requireId(jobId), representativeId: requireId(representativeId), appointment: canonicalAppointment(appointment) };
}

/** Durable ingress for an already-created ACL job, before expensive routing reads. */
export function acceptedLeadInput({ jobId, submissionId: submittedId, requestedAppointment = null }) {
  return { kind: "accepted_lead", version: 1, jobId: requireId(jobId), submissionId: submissionId(submittedId), requestedAppointment: canonicalAppointment(requestedAppointment) };
}
const intentHash = intent => createHash("sha256").update(JSON.stringify(intent)).digest("hex");

/**
 * This does not connect at construction. Every operation connects and checks a
 * writable primary with explicit storage durability verification. Standard PostgreSQL
 * requires fsync; narrowly configured Neon uses its verified WAL quorum profile.
 * Missing tables/connection => no ACL write.
 * SQL transactions enable synchronous_commit=on before persisting safety markers.
 */
export function createPostgresRoutingStore({ pool, databaseDurability = {} } = {}) {
  if (!pool || typeof pool.connect !== "function") throw error("durable_store_required");
  const assertWritable = createPostgresDurabilityGuard({...databaseDurability,pool});

  async function withClient(fn) {
    let client;
    let broken = false;
    let active = true;
    const lost = () => { broken = true; };
    try {
      client = await pool.connect();
      if (!client || typeof client.query !== "function" || typeof client.release !== "function") throw error("durable_store_unavailable");
      client.on?.("error", lost);
      const query = async (sql, values = []) => {
        if (!active || broken) throw error("durable_store_unavailable");
        try { return await client.query(sql, values); }
        catch { broken = true; throw error("durable_store_unavailable"); }
      };
      await assertWritable(query);
      return await fn(query, () => { broken = true; });
    } catch (cause) {
      if (cause?.code && ["job_lock_busy", "invalid_queue_claim", "operation_intent_conflict", "journal_transition_rejected", "durable_store_unavailable"].includes(cause.code)) throw cause;
      throw error("durable_store_unavailable");
    } finally {
      active = false;
      client?.removeListener?.("error", lost);
      // Destroy clients whose lock cleanup/transaction outcome is uncertain.
      client?.release?.(broken ? error("durable_store_unavailable") : undefined);
    }
  }

  async function transaction(query, fn, poison) {
    let started = false;
    try {
      await query("BEGIN"); started = true;
      await query("SET LOCAL synchronous_commit = 'on'");
      const result = await fn();
      await query("COMMIT");
      return result;
    } catch (cause) {
      if (started) {
        try { await query("ROLLBACK"); } catch { poison(); }
      }
      throw cause;
    }
  }

  async function runExclusive(jobId, fn) {
    jobId = requireId(jobId);
    if (typeof fn !== "function") throw error("invalid_callback");
    return withClient(async (query, poison) => {
      let locked = false;
      let preparedHash = null;
      const tx = fn => transaction(query, fn, poison);
      const event = (phase, kind, reason = null, detail = {}) => query(
        "INSERT INTO acl_routing_events(job_id, phase, event, reason, detail) VALUES ($1, $2, $3, $4, $5::jsonb)",
        [jobId, phase, kind, reason, JSON.stringify(detail)]
      );
      const snapshot = async () => {
        const result = await query("SELECT intent_hash, intent, status, reason FROM acl_routing_intents WHERE job_id = $1", [jobId]);
        if (!result.rows?.[0]) throw error("journal_transition_rejected");
        const steps = await query("SELECT phase, status, attempt_count FROM acl_routing_steps WHERE job_id = $1 ORDER BY phase", [jobId]);
        return { ...result.rows[0], steps: Object.fromEntries(steps.rows.map(row => [row.phase, { status: row.status, attemptCount: row.attempt_count }])) };
      };
      const requirePrepared = () => { if (!preparedHash) throw error("journal_transition_rejected"); };
      const updateAggregate = () => query(`UPDATE acl_routing_intents i SET
        status = CASE
          WHEN NOT EXISTS (SELECT 1 FROM acl_routing_steps s WHERE s.job_id = i.job_id AND s.status <> 'verified') THEN 'verified'
          WHEN EXISTS (SELECT 1 FROM acl_routing_steps s WHERE s.job_id = i.job_id AND s.status = 'attempted') THEN 'attempted'
          ELSE 'prepared' END,
        reason = NULL, updated_at = clock_timestamp()
        WHERE i.job_id = $1 AND i.intent_hash = $2 AND i.status <> 'conflict'`, [jobId, preparedHash]);
      const enqueueInput = input => tx(async () => {
        const hash = intentHash(input);
        const inserted = await query(`INSERT INTO acl_routing_queue(job_id, input_kind, input_hash, input)
          VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (job_id) DO NOTHING RETURNING job_id`, [jobId, input.kind, hash, JSON.stringify(input)]);
        const result = await query("SELECT input_hash, input_conflict, status FROM acl_routing_queue WHERE job_id = $1", [jobId]);
        const row = result.rows?.[0];
        if (!row) throw error("journal_transition_rejected");
        if (row.input_hash !== hash || row.input_conflict) {
          // Same job, different requested time/submission/rep: hold instead of
          // silently overwriting a claimed/attempted/completed operation.
          await query(`UPDATE acl_routing_queue SET status = 'review', input_conflict = true,
            claim_token = NULL, worker_id = NULL, claimed_until = NULL, updated_at = clock_timestamp() WHERE job_id = $1`, [jobId]);
          await query(`UPDATE acl_routing_intents SET status = 'conflict', reason = 'queue_input_conflict', updated_at = clock_timestamp()
            WHERE job_id = $1`, [jobId]);
          return { status: "review", jobId, reason: "queue_input_conflict" };
        }
        return { status: "queued", jobId, duplicate: inserted.rowCount === 0, queueStatus: row.status };
      });
      const journal = Object.freeze({
        version: ROUTING_JOURNAL_VERSION,
        async prepare(input) {
          const intent = routingIntent(input);
          if (intent.jobId !== jobId) throw error("journal_transition_rejected");
          const hash = intentHash(intent);
          return tx(async () => {
            const inserted = await query(`INSERT INTO acl_routing_intents(job_id, intent_hash, intent)
              VALUES ($1, $2, $3::jsonb) ON CONFLICT (job_id) DO NOTHING RETURNING job_id`, [jobId, hash, JSON.stringify(intent)]);
            if (inserted.rowCount === 1) {
              await query("INSERT INTO acl_routing_steps(job_id, phase) VALUES ($1, 'assignment')", [jobId]);
              if (intent.appointment) await query("INSERT INTO acl_routing_steps(job_id, phase) VALUES ($1, 'appointment')", [jobId]);
              await event(null, "prepared");
            }
            const saved = await snapshot();
            const queued = await query("SELECT input_conflict, input FROM acl_routing_queue WHERE job_id = $1", [jobId]);
            const queuedRow = queued.rows?.[0];
            let queueConflict = queuedRow?.input_conflict === true;
            if (queuedRow) {
              try {
                if (queuedRow.input?.kind === "accepted_lead") {
                  const source = acceptedLeadInput(queuedRow.input);
                  queueConflict ||= source.jobId !== jobId || JSON.stringify(source.requestedAppointment) !== JSON.stringify(intent.appointment);
                } else if (queuedRow.input?.kind === "resolved_intent") {
                  queueConflict ||= intentHash(routingIntent(queuedRow.input)) !== hash;
                } else { queueConflict = true; }
              } catch { queueConflict = true; }
            }
            if (saved.intent_hash !== hash || queueConflict) {
              const reason = queueConflict ? "queue_input_conflict" : "operation_intent_conflict";
              await query("UPDATE acl_routing_intents SET status = 'conflict', reason = $2, updated_at = clock_timestamp() WHERE job_id = $1", [jobId, reason]);
              await event(null, "conflict", reason, { proposedIntentHash: hash });
              return { ...saved, status: "conflict", reason };
            }
            preparedHash = hash;
            return saved;
          });
        },
        async markAttempted(phase) {
          requirePrepared(); phaseName(phase);
          return tx(async () => {
            const changed = await query(`UPDATE acl_routing_steps s SET status = 'attempted', attempt_count = 1, attempted_at = clock_timestamp()
              FROM acl_routing_intents i WHERE s.job_id = $1 AND s.phase = $2 AND s.status = 'prepared' AND s.attempt_count = 0
              AND i.job_id = s.job_id AND i.intent_hash = $3 AND i.status <> 'conflict' RETURNING s.phase`, [jobId, phase, preparedHash]);
            if (changed.rowCount !== 1) throw error("journal_transition_rejected");
            await updateAggregate();
            await event(phase, "attempted");
          });
        },
        async markVerified(phase) {
          requirePrepared(); phaseName(phase);
          return tx(async () => {
            const changed = await query(`UPDATE acl_routing_steps s SET status = 'verified', verified_at = clock_timestamp()
              FROM acl_routing_intents i WHERE s.job_id = $1 AND s.phase = $2 AND s.status IN ('prepared', 'attempted', 'verified')
              AND i.job_id = s.job_id AND i.intent_hash = $3 AND i.status <> 'conflict' RETURNING s.phase`, [jobId, phase, preparedHash]);
            if (changed.rowCount !== 1) throw error("journal_transition_rejected");
            await updateAggregate();
            await event(phase, "verified");
          });
        },
        async markUncertain(phase, reason) {
          requirePrepared(); phaseName(phase); reasonCode(reason);
          return tx(async () => {
            const changed = await query(`UPDATE acl_routing_intents i SET status = 'attempted', reason = $3, updated_at = clock_timestamp()
              WHERE i.job_id = $1 AND i.intent_hash = $4 AND i.status <> 'conflict'
              AND EXISTS (SELECT 1 FROM acl_routing_steps s WHERE s.job_id = i.job_id AND s.phase = $2 AND s.status = 'attempted')
              RETURNING i.job_id`, [jobId, phase, reason, preparedHash]);
            if (changed.rowCount !== 1) throw error("journal_transition_rejected");
            await event(phase, "uncertain", reason);
          });
        },
        async markConflict(reason) {
          requirePrepared(); reasonCode(reason);
          return tx(async () => {
            const changed = await query(`UPDATE acl_routing_intents SET status = 'conflict', reason = $2, updated_at = clock_timestamp()
              WHERE job_id = $1 AND intent_hash = $3 RETURNING job_id`, [jobId, reason, preparedHash]);
            if (changed.rowCount !== 1) throw error("journal_transition_rejected");
            await event(null, "conflict", reason);
          });
        },
        async enqueue() {
          requirePrepared();
          const row = await snapshot();
          if (row.status === "conflict") throw error("operation_intent_conflict");
          return enqueueInput({ kind: "resolved_intent", ...row.intent });
        },
        async enqueueAcceptedLead(input) {
          const normalized = acceptedLeadInput(input);
          if (normalized.jobId !== jobId) throw error("journal_transition_rejected");
          return enqueueInput(normalized);
        }
      });
      try {
        const lock = await query("SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired", [`acl-routing:${jobId}`]);
        if (lock.rows?.[0]?.acquired !== true) throw error("job_lock_busy");
        locked = true;
        return await fn(journal);
      } finally {
        if (locked) {
          try {
            const unlock = await query("SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS released", [`acl-routing:${jobId}`]);
            if (unlock.rows?.[0]?.released !== true) { poison(); throw error("durable_store_unavailable"); }
          } catch { poison(); throw error("durable_store_unavailable"); }
        }
      }
    });
  }

  return Object.freeze({
    durability: "distributed",
    journalVersion: ROUTING_JOURNAL_VERSION,
    runExclusive,
    /** Call only after accepted-lead persistence. Does not send/assign/book. */
    async enqueue(input) {
      const intent = routingIntent(input);
      return runExclusive(intent.jobId, async journal => {
        const saved = await journal.prepare(intent);
        if (saved.status === "conflict") throw error("operation_intent_conflict");
        return journal.enqueue();
      });
    },
    /** Not an atomic contact/job-creation outbox: ACL acceptance happened first. */
    async enqueueAcceptedLead(input) {
      const normalized = acceptedLeadInput(input);
      return runExclusive(normalized.jobId, journal => journal.enqueueAcceptedLead(normalized));
    },
    /** Persist a call-task intent, not a sent notification or a call promise.
     * In-progress/completed tasks are never silently reset by a worker replay.
     * The caller must inspect persisted/status and establish real human ownership.
     */
    async saveFollowUp({ jobId, kind, reason } = {}) {
      jobId = requireId(jobId);
      if (!Object.hasOwn(FOLLOW_UP_REASONS, kind) || !FOLLOW_UP_REASONS[kind].includes(reason)) throw error("invalid_followup");
      return withClient((query, poison) => transaction(query, async () => {
        const result = await query(`INSERT INTO acl_routing_followups(job_id, kind, reason) VALUES ($1, $2, $3)
          ON CONFLICT (job_id) DO UPDATE SET kind = EXCLUDED.kind, reason = EXCLUDED.reason, updated_at = clock_timestamp()
          WHERE acl_routing_followups.status = 'pending' RETURNING job_id, kind, reason, status, template_version, urgency`, [jobId, kind, reason]);
        let row = result.rows?.[0];
        if (!row) {
          const existing = await query("SELECT job_id, kind, reason, status, template_version, urgency FROM acl_routing_followups WHERE job_id = $1", [jobId]);
          row = existing.rows?.[0];
        }
        if (!row) throw error("journal_transition_rejected");
        return {
          jobId: row.job_id, kind: row.kind, reason: row.reason, status: row.status,
          templateVersion: row.template_version, urgency: row.urgency,
          persisted: ["pending", "in_progress"].includes(row.status) && row.kind === kind && row.reason === reason,
          notificationDelivered: false
        };
      }, poison));
    },
    /** Safe lease reclaims do not reset attempted operation markers. */
    async claim({ workerId, leaseSeconds = 60 } = {}) {
      if (typeof workerId !== "string" || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(workerId)) throw error("invalid_worker_id");
      leaseDuration(leaseSeconds);
      return withClient((query, poison) => transaction(query, async () => {
        const token = randomUUID();
        const claimed = await query(`WITH candidate AS (
          SELECT job_id FROM acl_routing_queue
          WHERE input_conflict = false AND ((status = 'pending' AND available_at <= clock_timestamp())
             OR (status = 'claimed' AND claimed_until < clock_timestamp()))
          ORDER BY available_at, created_at, job_id LIMIT 1 FOR UPDATE SKIP LOCKED
        ), claimed AS (
          UPDATE acl_routing_queue q SET status = 'claimed', claim_token = $1, worker_id = $2,
            claimed_until = clock_timestamp() + ($3 * interval '1 second'), claim_count = claim_count + 1,
            updated_at = clock_timestamp() FROM candidate c WHERE q.job_id = c.job_id RETURNING q.*
        ) SELECT c.*, i.intent, i.status AS intent_status FROM claimed c LEFT JOIN acl_routing_intents i USING (job_id)`, [token, workerId, leaseSeconds]);
        const row = claimed.rows?.[0];
        return row ? { jobId: row.job_id, claimToken: row.claim_token, claimedUntil: row.claimed_until, claimCount: row.claim_count, input: row.input, inputKind: row.input_kind, intent: row.intent ?? null, intentStatus: row.intent_status ?? null } : null;
      }, poison));
    },
    async renewClaim({ jobId, claimToken, leaseSeconds = 60 } = {}) {
      jobId = requireId(jobId); claimToken = requireId(claimToken); leaseDuration(leaseSeconds);
      return withClient((query, poison) => transaction(query, async () => {
        const result = await query(`UPDATE acl_routing_queue SET claimed_until = clock_timestamp() + ($3 * interval '1 second'), updated_at = clock_timestamp()
          WHERE job_id = $1 AND claim_token = $2 AND status = 'claimed' AND claimed_until > clock_timestamp() RETURNING claimed_until`, [jobId, claimToken, leaseSeconds]);
        if (result.rowCount !== 1) throw error("invalid_queue_claim");
        return { claimedUntil: result.rows[0].claimed_until };
      }, poison));
    },
    async finishClaim({ jobId, claimToken, status } = {}) {
      jobId = requireId(jobId); claimToken = requireId(claimToken);
      if (!["completed", "review"].includes(status)) throw error("invalid_queue_status");
      return withClient((query, poison) => transaction(query, async () => {
        const result = await query(`UPDATE acl_routing_queue q SET status = $3, claim_token = NULL, worker_id = NULL,
          claimed_until = NULL, updated_at = clock_timestamp()
          WHERE q.job_id = $1 AND q.claim_token = $2 AND q.status = 'claimed' AND q.claimed_until > clock_timestamp()
          AND q.input_conflict = false AND EXISTS (SELECT 1 FROM acl_routing_followups f WHERE f.job_id = q.job_id)
          AND ($3 = 'review' OR EXISTS (
            SELECT 1 FROM acl_routing_intents i WHERE i.job_id = q.job_id AND i.status = 'verified')) RETURNING q.job_id`, [jobId, claimToken, status]);
        if (result.rowCount !== 1) throw error("invalid_queue_claim");
        return { jobId, status };
      }, poison));
    }
  });
}
