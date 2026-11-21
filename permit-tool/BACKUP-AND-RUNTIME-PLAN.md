# Remaining private runtime and backup gates (2026-11-12)

UPDATE: Direct Gmail + role-scoped Neon MCP orchestration is now validated for review-only intake, with no HTTP endpoint or new caller credential. See HANDOFF.md and connector-queue-sql.mjs. The HTTP-hosting findings below remain historical constraints but are not a blocker to connector-only intake. Full authenticated ACL enrichment and recurring backups remain unverified.

## Verified vs not deployed
Neon SQL persistence is real and isolated. Private caller authentication code is locally tested only. `private-caller-auth.mjs` accepts only signed POST /intake envelopes containing the fixed info mailbox and a Gmail message ID. It does not trust the sender as authorization and cannot approve, sign, email, submit or pay. Replay reservation requires an atomic durable database operation; `private-caller-replay.mjs` implements the parameterized SQL contract.

`private-caller-replay.sql` applied to the isolated permit database. Worker has SELECT/INSERT only on nonce table. Simultaneous same-nonce inserts produced exactly one acceptance and one rejection. One synthetic nonce retained as evidence; no real signer credentials minted or stored.

## Hosting blockers, not new user permissions requests
- No verified private caller transport is currently bound. Vercel preview protection cannot be bypassed broadly merely to make a worker callable.
- Neon Functions supports Free according to https://neon.com/docs/introduction/plans (10 active Capacity-Hours,400 waiting Capacity-Hours,1M invocations/project/month), but native HTTPS URL is publicly reachable. Authentication would restrict data, not network reachability.
- Neon Functions auto-injects DATABASE_URL. Least-privilege override of both auto-injected database URLs has not been verified. Do not deploy against inherited branch-owner credentials.
- Never claim a public URL + secret is a private network endpoint; deployment requires explicit architectural acceptance of that distinction and verified least privilege.
- No hosting/project/production/security setting changed for these experiments.

## Mailbox route
Read-only connector identity verified info@raccoonrestoration.com and real Nov10 ACL task mail. No exact PERMIT REQUEST email exists yet. Gmail webhook schema only accepts sender and subject regexes, not mailbox/link selector. Creation response/account binding and a genuine arriving info event must establish delivery. Existing-message replay or run_now cannot prove webhook routing. Parser may reject wrong-mailbox events but cannot make missing events arrive.

## Backups before live pilot
- Source/code: versioned private Library archive, manifest checksums, credential scan; parent has saved v5 before these newest additions.
- Persistent queue: export consistent schema-versioned JSON snapshot from permit_requests and caller-nonce table in one read transaction. Hash payload, record row counts and timestamp. Save in private approved project backup folder with no sharing changes and limited retention (proposed 14 daily +4 weekly; not configured).
- Do not include PostgreSQL URLs, passwords, ACL API key, caller private key or customer attachments.
- Restore to NEW isolated tables/database, verify checksums and counts, invalidate any in-flight leases; never replace a live database automatically.
- Caller nonce history must be preserved, or restart must wait beyond every outstanding signature's validity before enabling ingress. Current request validity is60 seconds and upper DB expiry bound2 minutes.
- Perform backup after accepted queue writes or at least daily; alert Brandon only if backup or restore verification fails. No schedule/alert has been installed yet.
- Six-hour Neon history is additional recovery coverage, not a replacement for export backups. Do not purchase longer retention or upgrade plan without approval.

## Latest checks
Existing regression script passed. Local private auth:9 checks passed. Actual SQL nonce concurrency:one winner, persisted exactly once. Prior actual queue concurrency/dedup/fence/expiry/JSON restore tests passed. No claims of live end-to-end email delivery, real HTTP auth, production driver integration, automatic backups, or full live readiness.
