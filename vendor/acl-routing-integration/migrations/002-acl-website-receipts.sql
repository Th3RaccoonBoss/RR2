-- OFFLINE PREPARATION. PostgreSQL 14+. Not applied to any user database.
-- Requires approved durable primary/session connections and migration runner.
-- Payloads, names, phone/email/address, consent text, notes and credentials are
-- intentionally absent. IDs/hash/times are still access-controlled metadata.
BEGIN;
CREATE TABLE acl_website_submissions (
  submission_id text PRIMARY KEY CHECK (length(submission_id) <= 100 AND
    (submission_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR submission_id ~* '^rr-[a-z0-9-]{10,100}$')),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  requested_appointment jsonb CHECK (requested_appointment IS NULL OR
    (jsonb_typeof(requested_appointment) = 'object' AND requested_appointment ? 'startDate' AND requested_appointment ? 'endDate')),
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','review','accepted')),
  contact_id uuid,
  job_id uuid UNIQUE,
  contact_attempted_at timestamptz,
  job_attempted_at timestamptz,
  reason text CHECK (reason IS NULL OR reason ~ '^[a-z0-9_]{1,100}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status = 'accepted') = (job_id IS NOT NULL)),
  CHECK (job_attempted_at IS NULL OR contact_id IS NOT NULL)
);
CREATE INDEX acl_website_submissions_unresolved ON acl_website_submissions(updated_at)
  WHERE status <> 'accepted';

CREATE TABLE acl_website_outbox (
  submission_id text PRIMARY KEY REFERENCES acl_website_submissions(submission_id),
  job_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  delivered_at timestamptz,
  CHECK ((status = 'delivered') = (delivered_at IS NOT NULL))
);
CREATE INDEX acl_website_outbox_pending ON acl_website_outbox(created_at) WHERE status = 'pending';
COMMIT;
