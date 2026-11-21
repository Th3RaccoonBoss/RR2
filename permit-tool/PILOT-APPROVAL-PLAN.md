# Proposed least-privilege pilot (not activated)
Prepared 2026-11-12. No new permissions, credentials, schedules or deployments created by this document.

## Current verified state
- Source recovery archive is in private Library: permit-workflow-recovery-20261112.tar.gz, version 2 before this planning note. Source recovery is partial, not exact original.
- Local synthetic workflow and independent mock-DOM tests pass. Real browser acceptance is blocked by current environment restrictions.
- Hosted one-job read experiment was temporary and disabled. It does not authorize or provide a continuing API or document integration.
- Email adapter still uses a regex prototype instead of wiring the separately tested bounded HTML parser. No live watcher is running. Municipality source records are inactive. Current queue is local SQLite, unsuitable for ephemeral serverless persistence.

## Recommended bounded pilot
14 days, up to 10 owner-selected jobs, $0 incremental spend unless separately approved.
1. Read only existing authorized mailbox's AccuLynx task notifications assigned to Brandon, matching the exact permit-request title. Read relevant referenced job records and permit documents only for pilot job IDs. No mailbox-wide forwarding/export, sends, labels or deletes.
2. Authenticated private preview endpoint, fixed allowed job IDs and fixed GET routes. Existing API credential stays server-side; never copy to browser, source archive or messages. Reject unknown routes, write methods and arbitrary URLs. No public share link as persistent authentication.
3. Poll/check at most every 15 minutes during pilot using existing supported automation or scheduler. Persist cursor and dedup IDs. If inbound notifications cannot be authenticated, candidate remains untrusted and needs owner confirmation.
4. Persist queue/state in a verified durable store with transactional uniqueness and leases. Do NOT use container paths, /tmp or serverless local SQLite as durable production storage. Choose exact product/plan only after checking available account and pricing. No new paid services under this approval.
5. Store source/tests/config templates in a private repository or versioned Library archive after each substantive verified change. Exclude credentials, cookies, tokens, real customer attachments and live queue payloads. Keep a working last-known-good version and tested restore instructions.
6. Pilot produces a private review packet and notifies Brandon only. No permit submission, signatures, COI/bond requests, fees, email to third parties, ACL writes or delegated third-party agents. Expansion requires separate authorization.

## Document access is a technical gate, not blanket permission
Confirm a supported authenticated document-list/download mechanism for exact pilot jobs. Use existing ACL API scopes if the API actually supports this; otherwise an authorized signed-in browser session or supported export. Do not bypass login/access controls, scrape credentials or guess undocumented unrestricted endpoints. If no usable supported route exists, ask for the exact pilot documents through an authorized export and mark document automation incomplete. License/ID scans and unrelated private attachments are excluded from collection unless specifically required and authorized.

## Remaining engineering before a live pilot
Wire native bounded HTML parser into adapter; test exact connector payload shape; add real transport/task identity checks; replace ephemeral persistence; secure endpoint authentication; bound job/document lookup; verify UI in a browser; test restart/restore and cancellation; one exact-job read test before watcher activation. Permissions alone do not complete these steps.

## Proposed approval wording
Approve a 14-day, read-only permit pilot for up to 10 jobs I select, using my existing AccuLynx and task-notification mailbox connections. You may configure a private authenticated preview, a check no more often than every 15 minutes, durable deduplicated state, and private source backups. Keep existing credentials server-side, no additional spending, no public access, no third-party messages, no ACL changes, no permit submissions/signing/payments and no COI/bond requests. Notify me of review packets and blockers. Stop the pilot at 14 days unless I extend it. If any new account, credential scope, paid service or sensitive document is required, ask me first with exact details.

The user has NOT yet approved this proposal. Exact pilot job IDs, storage/service choice and permitted mailbox must be verified before setup; the proposal is not broad authority to choose new account access.
