# Isolated ACL runtime Preview diagnostic

Prepared for **Preview only**, Vercel `raccoon8/raccoon-restoration`. This diagnostic
is separate from the working production site at commit
`d82df62d43ed2f30f93a150ca96ec51cb1becdb8`. No customer form, ACL route, production
fallback, background job, analytics, or automatic database check is included.
The candidate is inert with both execution grants absent or disabled.

## Exact source tree

Upload the exact files in `UPLOAD-MANIFEST.json` into an empty source directory or
separate Preview branch tree. **Never overlay this on the website checkout.** A
retained `api/quote.mjs` would leave a live ACL write endpoint. The sole allowed
API entry is `api/diagnostic.mjs`; tests and build reject any extra API entry.
Do not promote this diagnostic, assign custom domains, or merge it into production.

- `api/diagnostic.mjs`: explicit methods, origin checks, bounded request bodies,
  independent grants, sanitized responses and a warm-instance repeat guard.
- `lib/gates.mjs`: strict platform Preview requirement and time-bounded grants.
- `lib/neon-runner.mjs`: 150-second child-process wrapper for the original validator.
- `lib/inspection-{core,runner,worker}.mjs`: separately gated read-only inspection.
- `lib/neon-readonly-options.mjs`: strict direct-Neon TLS/read-only connection.
- `lib/shape-summary.mjs`: offline-only reference-shape summarizer, no ACL calls.
- `public/`: inert UI and local assets. No requests occur on page load.
- `scripts/build.mjs`: source integrity, driver-version and static build checks.
- `scripts/serve.mjs`: loopback-only local mock with execution permanently disabled.
- `test/`: offline tests, fake SQL/client processes and simulated UI events.
- `vendor/`: exact canonical validator, five source dependencies and migrations001–004.
- `vendor-manifest.json`: SHA-256 hashes for all 10 vendored source files.
- `package-lock.json`: exact dependency graph and package integrity hashes.
- `APPROVALS.md`: deployment/run/inspection/disable checklist.

The validator is reused byte-for-byte from its canonical source, including the
reviewed `enableChannelBinding:true` update. Do not edit the vendored copy alone.
The build recreates only this candidate's generated `dist/` output.

## Dependencies and commands

Node **24.x**; sole direct dependency **pg@8.16.3**. The lockfile contains 14
packages, all from `https://registry.npmjs.org` with SHA-512 integrity. Installed
versions were checked against the lock; no package declares an install lifecycle
script. An offline clean install from the official-registry cache passed.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run plan
npm run dev
```

The deployment uses the same `npm ci` command. Tests and the ordinary local static
build run without network/database access. `npm run plan` invokes only the original
validator's nonexecuting plan. The local mock listens at `127.0.0.1:3038`, never
uses shell credentials, and cannot run either database action. Ctrl-C stops it.
A Vercel build additionally requires the installed exact pg version. UI tests use
simulated DOM events and do not substitute for visual Preview browser QA.

## Authentication and independent grants

Existing **Vercel Deployment Protection** must cover the entire immutable Preview
URL and API. Verify signed-out denial and restrict the authenticated audience.
The app implements no authentication, new service account or shared credential.
`ACL_PREVIEW_PROTECTION_VERIFIED=1` is an operator attestation, not an auth check.
Every viewer authorized by platform protection can invoke enabled actions.

The server requires platform-injected `VERCEL=1`, `VERCEL_ENV=preview` and the
immutable `VERCEL_URL`. Non-Preview API requests return 404; non-Preview Vercel
builds fail. Do not forge platform variables. POST requires that exact HTTPS
Origin, JSON, an explicit-action header and the action's confirmation phrase.
These browser protections are not identity checks. No request field can enable
a grant, choose a database, select an endpoint or supply SQL.

`GET /api/diagnostic` reads configuration flags only, never database credentials or
SQL. Opening the UI does not call even this GET; gate inspection requires a click.
Both action grants are absent/disabled by default. See `APPROVALS.md` for exact
configuration fields and the authorized finite scope.

## One synthetic validation invocation

The mutation grant lasts **at most 10 minutes**. One explicit POST launches the
original validator with only `VERCEL_ENV=preview`, the existing injected direct
`DATABASE_URL_UNPOOLED`, and its fixed source path. There is no inherited ACL key,
`NODE_OPTIONS`, PG/proxy environment, shell, stdin or caller-selected path.

The validator checks the direct Neon host and provider profile, creates one
random fresh `acl_validation_<32hex>` schema, and applies migrations001–004 only
there. It checks two physical sessions, advisory lock exclusion/release after
client disconnect, rollback visibility, durable attempt replay and synthetic
receipt/outbox/queue replay. It confirms its synthetic schema has no intake epoch.
It retains the schema and committed synthetic records. No existing public tables,
production records, ACL records, routing, appointments or active epochs are changed.
No cleanup, DROP, DELETE or TRUNCATE occurs.

Both database connections use strict certificate validation, expected server name,
TLS 1.2 minimum and explicit `enableChannelBinding:true`. In pg8.16.3, this enables
SCRAM-SHA-256-PLUS **when offered**; it is not a claim that the negotiated mechanism
has been independently verified or that the driver enforces a libpq-style
`channel_binding=require`. URI SSL options are not forwarded to override strict
TLS. Neither runner falls back to a pooled URL or another database.

The wrapper kills the validator at **150 seconds**, below Vercel's configured
180-second cap. Original connection/query/statement/lock limits are 15/20/15/10
seconds, and advisory reacquisition is bounded to 15 seconds. Output is limited
to 128,000 bytes and 16 sanitized events; stderr is discarded. The browser waits
165 seconds. There are no automatic retries or scheduled/background operations.

A failed or missing response means an **uncertain mutation outcome**. Killing the
process cannot undo committed schema creation or rows. Before any repeat, inspect
the outcome and retained schemas. If execution ends before its first output,
the schema name may be unknown. A client disconnect is not provider failover,
crash recovery, backup-restore or a no-data-loss proof.

The UI and a warm function reject repeated mutation attempts. This is **not** a
global one-use guarantee across cold starts, deployments or viewers. Restrict the
audience and permit exactly one operator invocation. Do not reload/redeploy to
bypass a repeat guard. A new mutation attempt requires a separately reviewed scope.

## Read-only inspection after an uncertain result

A distinct `inspect-validation-schemas` POST has a separate **at-most-30-minute**
read-only grant. It can remain current after the mutation grant expires, and never
sets, clears or re-arms the mutation-attempt flag. Configure its independent window
on the same immutable Preview when needed; that uses the same injected connection
to the precise Neon Preview branch, without relying on a provider query UI.

Use the explicit read-only UI button. Optionally provide the exact v4 run UUID
returned by validation. Otherwise it lists at most **10** schema names matching
exactly `acl_validation_[32 lowercase hex characters]`, sorted lexically, not by
age. An eleventh match sets a truncation flag. Caller SQL, schemas, tables, URLs or
arbitrary identifiers are rejected.

The client uses `default_transaction_read_only=on`, begins
`REPEATABLE READ READ ONLY`, verifies the transaction is read-only, then ends with
`ROLLBACK`. It reads only PostgreSQL catalog metadata and the ten fixed ordinary
validation tables in those matching schemas. Views, foreign/partitioned tables,
RLS tables and inherited descendants are excluded. Each table scans at most 501
rows and reports a count capped at 500 plus a truncation flag. No raw record values,
customer fields, hostname, URL, SQL parameters or credentials are returned.

The child has a **45-second** total limit, 10-second connection timeout, 4-second
query timeout, 3-second statements and 32,000-byte output cap. No retries, migrations,
writes, schema creation, cleanup, ACL calls or public-table fallbacks exist.
The result provides table presence and bounded counts, **not proof** the original
validation passed. An incomplete inspection remains a blocker to mutation retry.
The snapshot may not see changes still uncommitted in another connection.

## Verification limits

Local checks cover source integrity, dependency lock/install, syntax, inert plans,
Preview/origin/grant gates, no credential read on disabled/GET paths, bounded child
processes, output sanitization, SQL shape/scope, independent read-only grants and
no mutation re-arm. Real Vercel bundling/routing/browser/protection checks and real
Neon results still require the deployment operator. No live ACL route exists.
The current site and working production SHA are not changed by this source tree.
