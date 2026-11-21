-- Apply only to a dedicated private pilot database, never the marketing database.
-- No grants, roles or credentials are created here. Operator must bind a limited role.
CREATE TABLE IF NOT EXISTS permit_requests (
  key text PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 200),
  payload text NOT NULL CHECK (octet_length(payload) <= 262144),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','manual_review','review','cancelled')),
  lease_token text,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status = 'processing' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
      OR (status <> 'processing' AND lease_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX IF NOT EXISTS permit_requests_pending ON permit_requests (created_at, key)
  WHERE status IN ('pending','processing');
