-- OFFLINE ONLY. Requires migration002. This creates NO active cutover epoch.
-- Activation is an operational action only after verified legacy-writer isolation,
-- in-flight drain, rollback protection and non-lossy journal durability. Database
-- flags and this reserved namespace do not establish those external guarantees.
BEGIN;
CREATE TABLE acl_website_intake_epochs (
  epoch_id uuid PRIMARY KEY,
  isolation_revision text NOT NULL CHECK (isolation_revision ~ '^[a-zA-Z0-9_.:-]{1,100}$'),
  state text NOT NULL DEFAULT 'inactive' CHECK (state IN ('inactive','active','retired')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX acl_website_intake_single_active_epoch ON acl_website_intake_epochs(state) WHERE state='active';
CREATE TABLE acl_website_submission_sessions (
  submission_id text PRIMARY KEY CHECK (submission_id ~ '^rr-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  epoch_id uuid NOT NULL REFERENCES acl_website_intake_epochs(epoch_id),
  state text NOT NULL DEFAULT 'issued' CHECK (state IN ('issued','bound','revoked')),
  payload_hash text CHECK (payload_hash IS NULL OR payload_hash ~ '^[a-f0-9]{64}$'),
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  bound_at timestamptz,
  UNIQUE(submission_id,epoch_id),
  CHECK (expires_at > issued_at),
  CHECK ((payload_hash IS NULL) = (bound_at IS NULL)),
  CHECK ((state = 'issued' AND payload_hash IS NULL) OR state = 'revoked' OR (state = 'bound' AND payload_hash IS NOT NULL))
);
ALTER TABLE acl_website_submissions ADD COLUMN session_epoch_id uuid REFERENCES acl_website_intake_epochs(epoch_id);
-- v2 receipts must have real issuance rows. Legacy rows remain untouched.
ALTER TABLE acl_website_submissions ADD COLUMN issued_session_id text UNIQUE REFERENCES acl_website_submission_sessions(submission_id);
ALTER TABLE acl_website_submissions ADD CONSTRAINT acl_website_session_pair CHECK (
  (session_epoch_id IS NULL AND issued_session_id IS NULL) OR
  (session_epoch_id IS NOT NULL AND issued_session_id IS NOT NULL AND issued_session_id = submission_id));
ALTER TABLE acl_website_submissions ADD CONSTRAINT acl_website_session_namespace CHECK (
  submission_id !~* '^rr-v2-' OR issued_session_id IS NOT NULL);
ALTER TABLE acl_website_submissions ADD CONSTRAINT acl_website_session_epoch_fk
  FOREIGN KEY (issued_session_id,session_epoch_id) REFERENCES acl_website_submission_sessions(submission_id,epoch_id) MATCH FULL;
COMMIT;
