-- OFFLINE ONLY. Apply with the other approved migrations, never on import.
-- A bucket identifies an opaque API-key or shared-egress scope, NOT a credential.
BEGIN;
CREATE TABLE acl_api_quota_buckets (
  scope_id text PRIMARY KEY CHECK (scope_id ~ '^(key|egress):[a-z0-9][a-z0-9_-]{2,63}$'),
  capacity smallint NOT NULL CHECK (capacity BETWEEN 1 AND 30),
  window_ms integer NOT NULL CHECK (window_ms = 1200),
  admitted_at_ms bigint[] NOT NULL DEFAULT ARRAY[]::bigint[],
  last_clock_ms bigint NOT NULL DEFAULT 0 CHECK (last_clock_ms >= 0),
  CHECK (cardinality(admitted_at_ms) <= capacity),
  CHECK (array_ndims(admitted_at_ms) IS NULL OR array_ndims(admitted_at_ms) = 1),
  CHECK (array_position(admitted_at_ms, NULL) IS NULL),
  CHECK (0 <= ALL(admitted_at_ms))
);
COMMIT;
