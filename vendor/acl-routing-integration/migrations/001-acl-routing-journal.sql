-- Offline migration. Run once through the deployment's approved migration system.
-- PostgreSQL 14+. No extension, ACL credential, or external service is required.
-- Use a dedicated database/schema and role with these tables in a trusted search_path.
BEGIN;

CREATE TABLE acl_routing_intents (
  job_id uuid PRIMARY KEY,
  intent_hash text NOT NULL CHECK (intent_hash ~ '^[0-9a-f]{64}$'),
  intent jsonb NOT NULL CHECK (jsonb_typeof(intent) = 'object'),
  status text NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'attempted', 'verified', 'conflict')),
  reason text CHECK (reason IS NULL OR reason ~ '^[a-z0-9_]{1,100}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE acl_routing_steps (
  job_id uuid NOT NULL REFERENCES acl_routing_intents(job_id),
  phase text NOT NULL CHECK (phase IN ('assignment', 'appointment')),
  status text NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'attempted', 'verified', 'conflict')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 1),
  attempted_at timestamptz,
  verified_at timestamptz,
  PRIMARY KEY (job_id, phase),
  CHECK ((attempt_count = 0 AND attempted_at IS NULL) OR (attempt_count = 1 AND attempted_at IS NOT NULL)),
  CHECK (status <> 'attempted' OR attempt_count = 1),
  CHECK (status <> 'verified' OR verified_at IS NOT NULL)
);

CREATE TABLE acl_routing_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES acl_routing_intents(job_id),
  phase text CHECK (phase IN ('assignment', 'appointment')),
  event text NOT NULL CHECK (event IN ('prepared', 'attempted', 'uncertain', 'verified', 'conflict')),
  reason text CHECK (reason IS NULL OR reason ~ '^[a-z0-9_]{1,100}$'),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX acl_routing_events_job ON acl_routing_events(job_id, event_id);

-- Queue leases allocate work only. They NEVER authorize replay of an ACL write.
-- The journal and per-job session lock remain mandatory after every claim/reclaim.
CREATE TABLE acl_routing_queue (
  -- No intent FK: accepted leads can enter before geography has been resolved.
  job_id uuid PRIMARY KEY,
  input_kind text NOT NULL CHECK (input_kind IN ('accepted_lead', 'resolved_intent')),
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  input jsonb NOT NULL CHECK (jsonb_typeof(input) = 'object'),
  input_conflict boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'completed', 'review')),
  claim_token uuid,
  worker_id text,
  claimed_until timestamptz,
  claim_count integer NOT NULL DEFAULT 0 CHECK (claim_count >= 0),
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status = 'claimed' AND claim_token IS NOT NULL AND worker_id IS NOT NULL AND claimed_until IS NOT NULL)
      OR (status <> 'claimed' AND claim_token IS NULL AND worker_id IS NULL AND claimed_until IS NULL))
);
CREATE INDEX acl_routing_queue_pending ON acl_routing_queue(available_at, created_at) WHERE status = 'pending';
CREATE INDEX acl_routing_queue_expired ON acl_routing_queue(claimed_until) WHERE status = 'claimed';

-- Separate from routing intents: even an unresolved/unassigned accepted lead
-- needs a durable call task. This table does not send a message or notification.
CREATE TABLE acl_routing_followups (
  job_id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('confirm_requested_time', 'schedule_inspection', 'verify_then_call')),
  reason text NOT NULL CHECK (reason IN ('no_time_requested', 'routing_needs_review', 'booking_needs_scheduling', 'booking_needs_verification', 'booking_needs_confirmation')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  template_version integer NOT NULL DEFAULT 1 CHECK (template_version = 1),
  urgency text NOT NULL DEFAULT 'immediate' CHECK (urgency = 'immediate'),
  owner_id text,
  CHECK ((kind = 'confirm_requested_time' AND reason = 'booking_needs_confirmation')
      OR (kind = 'schedule_inspection' AND reason IN ('no_time_requested', 'routing_needs_review', 'booking_needs_scheduling'))
      OR (kind = 'verify_then_call' AND reason = 'booking_needs_verification')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX acl_routing_followups_pending ON acl_routing_followups(created_at) WHERE status = 'pending';

COMMIT;
