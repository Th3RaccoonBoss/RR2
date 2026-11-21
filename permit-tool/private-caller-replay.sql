-- Isolated permit_pilot DB only. Replay nonce retention can exceed validity safely.
CREATE TABLE IF NOT EXISTS public.permit_caller_nonces (
 nonce text PRIMARY KEY CHECK(nonce ~ '^[A-Za-z0-9_-]{24,100}$'),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT,INSERT ON public.permit_caller_nonces TO permit_pilot_worker;
