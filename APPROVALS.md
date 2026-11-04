# Preview operator runbook

## Scope

Authorized work: official PostgreSQL package, a separate GitHub diagnostic branch,
a protected Vercel Preview, exactly one synthetic database validation invocation,
read-only inspection if its outcome is uncertain, and disabling temporary access
when finished. This source preparation does not itself execute the live run.

Target: Vercel **raccoon8/raccoon-restoration**, Preview only. Proposed Git branch:
`preview/acl-runtime-probe-20261104`. Keep production commit
`d82df62d43ed2f30f93a150ca96ec51cb1becdb8`, its domains and working form unchanged.
No ACL communication, customer form activation or production release is included.

## Deploy inert first

1. Verify branch availability, target project/environment and archive SHA-256.
2. Use the exact entire tree in `UPLOAD-MANIFEST.json`. Never overlay onto the
   website: inherited `api/quote.mjs` would leave an ACL write endpoint. There must
   be exactly one API file, `api/diagnostic.mjs`.
3. Confirm Vercel protection and intended authenticated audience. No public/shared
   bypass access. Do not weaken auth to test the deployment.
4. Keep both grants absent/disabled. Use the existing Preview integration, without
   retrieving, printing, copying or re-entering its database or ACL secret.
5. Install using `npm ci --ignore-scripts --no-audit --no-fund`. The reviewed lock
   pins pg8.16.3 and 13 transitive packages from the official npm registry.
6. Build/test/upload only the exact Preview tree. No main push, production deploy,
   promotion, custom-domain assignment or website source replacement.
7. Verify successful packaging, signed-out protection, intended signed-in access,
   no automatic UI work, GET `executed:false`, disabled POST denial and unchanged
   production. No page-load or GET database query is permitted.

## One finite mutating run

The approved test creates one new random validation schema and applies four
migrations only inside it. It retains synthetic journal/receipt/outbox/queue rows.
It tests strict TLS, independent physical sessions, advisory locks/client
termination, rollback visibility and replay safety. The total execution cap is
150 seconds. There are no ACL calls, existing/public-table changes, deletions,
production changes or intake/routing activation.

For the intended Preview deployment only, use exact UTC ISO timestamps:

```text
ACL_PREVIEW_PROTECTION_VERIFIED=1
ACL_PREVIEW_DB_GRANT=one-isolated-synthetic-schema-v1
ACL_PREVIEW_DB_GRANT_NOT_BEFORE=<YYYY-MM-DDTHH:mm:ss.sssZ>
ACL_PREVIEW_DB_GRANT_EXPIRES_AT=<later UTC timestamp, at most 10 minutes after start>
```

Only the deployment operator should enable this after the inert checks. Never
forge platform `VERCEL`, `VERCEL_ENV` or `VERCEL_URL`. Build time must fit the short
window. The flag records a protection attestation; it does not authenticate users.
Every platform-authorized viewer can invoke an enabled action. Restrict access.

Open the immutable `https://<VERCEL_URL>`, click **Check Preview gate**, acknowledge
the scope, type the displayed phrase and click **Run synthetic Neon validation**
exactly once. Do not reload, navigate away or retry. Save the sanitized output and
run/schema identity. Warm-instance/UI guards are not globally single-use across
cold starts or other viewers. Never bypass them to repeat a mutation.

## Stop and inspect, without mutation re-arm

If output is failed, missing, partial or timed out, stop. A schema and synthetic
rows may already exist. Do not assume rollback or retry the test.

To inspect through that precise deployment's injected Preview connection, use an
independently scoped read-only grant on the same immutable deployment:

```text
ACL_PREVIEW_INSPECTION_GRANT=read-validation-schema-metadata-v1
ACL_PREVIEW_INSPECTION_NOT_BEFORE=<YYYY-MM-DDTHH:mm:ss.sssZ>
ACL_PREVIEW_INSPECTION_EXPIRES_AT=<later UTC timestamp, at most 30 minutes after start>
```

Configure this separate window alongside the run if it must remain available
after the mutation grant expires. It never re-arms or extends the mutation grant.
Click **Inspect validation schemas read-only**, optionally specifying the exact
run UUID. Without it, at most 10 exact matching validation schemas are listed
lexically, not newest-first. If more exist, use the known run UUID to narrow the
request. No caller SQL/schema/table/URL is accepted.

The read-only transaction returns schema names, the ten fixed table-presence
checks and bounded counts only. It reads no customer fields or public tables,
scans at most 501 rows per table, and stops after 45 seconds. It cannot prove all
original checks passed. If inspection is incomplete or inconclusive, keep the
mutation blocked and investigate before asking for a new finite test scope.

## Disable and verify

Disable/remove both temporary grants and verify subsequent explicit requests are
blocked, or verify both windows have expired. Old immutable deployment URLs keep
their original configuration until expiry; redeploying with disabled values alone
does not change old deployments. Do not delete schemas, rows or deployments as an
implicit cleanup step. No production rollback is required because production was
never changed.

## Not included

- Cleanup/deletion of retained schemas or data.
- ACL reads/writes, synthetic or customer contact/job changes, assignments or
  appointments. This candidate has no live ACL route.
- New credentials, service accounts, public sharing or protection bypasses.
- Production deployment, promotion, domain/DNS changes or intake/routing activation.
