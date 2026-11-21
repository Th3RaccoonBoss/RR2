# Persistence contract, not a live deployment

Production target: existing approved free managed Postgres integration, with private server-side pooled connection and least-privilege application role. No permit database has been verified/provisioned by this code. `deployment_blockers` fails closed unless a trusted operator independently verifies the named resource, schema migration, free plan, TLS, private access, encryption, durable storage and successful restore test plus backup-failure alert. Boolean attestations are not self-proving and must never come from incoming mail or task text. No credential values are stored in this config.

Historical ACL documents are NOT a rollout gate. Intake and checklist review may proceed independently; only case-specific required documents block the relevant case's readiness.

Managed Postgres implementation requirements:
- Unique immutable inbox key (mailbox + Gmail ID), canonical payload digest; duplicate must compare existing payload and never silently replace it.
- Atomic claim transaction using row lock / SKIP LOCKED; random lease token plus database time, bounded retry and explicit manual-review exhaustion.
- Completion compare-and-set on key, live token, processing state and unexpired lease; cancellation clears token atomically. Never resurrect cancelled rows by replay.
- Backup schedule/retention and restore procedure tested against a separate private database before calling durable storage ready; provider plan retention must be verified, not assumed. Backups can contain personal data and need same private access controls as primary.
- Restored in-flight leases must be invalidated and requests revalidated. Do not automatically send or pay after restore.
- Never store production queue in serverless /tmp or this development workspace.

`queue.py` remains local SQLite prototype. `snapshot/restore` in persistence_contract.py are tested LOCAL recovery/migration aids, not production Postgres backup support. They use SQLite online backup (includes committed WAL), SHA256/integrity/schema validation, refuse overwrite and fence restored processing leases. Fresh snapshots retain terminal cancellations and duplicate keys. No external action executor exists.

No database/service, credential, deployment, paid service or external action was created by this work.

## November 12 continuation: implementation prepared, database connection pending
`postgres_queue.sql` and `postgres_queue.py` now implement the dedicated-table
schema and a psycopg-compatible queue adapter. It uses parameterized statements,
immutable duplicate payload comparison, database-time leases, SKIP LOCKED claims,
three-attempt exhaustion, token-fenced completion and owner-confirmed cancellation.
Eight adapter control-flow tests pass. These are deliberately labelled synthetic;
no SQL has been applied to an actual database and concurrency acceptance on PostgreSQL
has NOT passed yet. It must not replace the working local prototype until tested.

Next actual database acceptance, after native Neon connection:
1. Resolve existing organization and confirm Free project and absence of paid add-ons.
2. Create/use a dedicated private permit-pilot database, not an existing customer app DB.
3. Establish restricted server-side database role/connection, TLS and secret handling.
4. Apply schema in test branch, then exercise real parallel duplicate inserts, claims,
   stale completion, retry exhaustion and cancellation while an old worker finishes.
5. Verify restart state and restore to a separate branch; invalidate in-flight leases
   and revalidate job status after recovery. Verify retention on the actual Free plan.
6. Bind only the private pilot worker after all above evidence, no production website changes.

Native Neon plugin discovered but not connected as of this note. Parent has offered
its connection card. Existing Vercel connector can inspect the installed Neon Free
plan but cannot provision its database resources using the tools currently exposed.
