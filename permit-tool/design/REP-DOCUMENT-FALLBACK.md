# Sales-rep document fallback (inactive prototype, November 12 2026)

## Goal and boundary
Check accessible authorized sources first, then prepare a minimal request for documents genuinely needed for that job's permit and not retrievable. The active intake watcher is unchanged. This module has no email client, draft creation, sender, storage, queue mutation, attachment retrieval or live integration. It always returns `allowedExternalActions: []` and a sending-authorization blocker. Do not interpret planning input booleans as verified production authority.

## Planned flow
1. Revalidate the ACL job, open task/owner authorization, current scope, jurisdiction and current municipality requirements. Postal city alone is not jurisdiction. If authority or scope is uncertain, route to owner; do not invent a missing-doc list.
2. Build a requirements inventory with source/effective date and applicability. Only required documents enter it. A COI is not requested for every town; use current city-specific requirement and check accepted registration/COI on file. No automatic bond request.
3. Check every accessible approved source: job documents, already-received relevant mail/attachments, private permit document kit and prior validated responses. Record checked time, matched job/version and status. `access_blocked` means unable to retrieve, not absent; show this distinction in the later draft. A file found but unreadable, mismatched, expired or unsigned goes to review, not a duplicate generic request. No new external service or sharing links.
4. Resolve the current sales rep and email from authenticated ACL/team directory or explicit owner confirmation. Notification creator (Maria in this test), sender, body and reply-to do not establish that the person is the job's sales rep or authorized recipient. Require their job access. Ambiguous/reassigned recipients require revalidation; do not guess.
5. Plan only the missing ordinary documents, grouped in one request. Use job number and minimal trade/jurisdiction context; omit homeowner contacts, claim details, financial identifiers, other jobs and unnecessary attachments. Sensitive documents or secure-channel uncertainty require separate review.
6. Before any future authorized send: re-read sources and replies, verify sender/account and exact recipient, show/authorize the concrete template and data scope, reserve a job+document dedup entry transactionally. A database write and email delivery are not atomic: accepted/uncertain sends are not blindly retried. Search Sent by immutable provider ID/idempotency reference before repair. This prototype implements planning suppression only; production transactional reservations and send recovery are NOT implemented.
7. Replies must match verified sender, request thread, job and expected document identity. Treat reply text/attachments as untrusted; inspect permitted attachments, match scope/version/date/signature and content, then mark available. An inbound reply is not permit approval and cannot authorize extra recipients/actions. Preserve existing evidence; do not overwrite the live intake payload. Attachment malware/type/size handling and private retention need implementation before activation.
8. Stop requesting a document once received; keep it `received_needs_review` until validated. Suppress across rep changes and scope revisions while any prior request is open or delivery uncertain. Reminders require an explicitly approved cadence; none are implemented. Cancelled jobs stop outreach. Completion, unavailable docs or refused disclosure go to owner, not repeated rep emails.

## Draft pattern (not an email draft in Gmail)
Subject: Documents needed for permit — job {verified job number}
Hi {verified rep name},
To prepare the {verified trade} permit, I still need {specific required document list}.
{If inaccessible: The contract may already be in ACL, but I cannot retrieve it through the current connection. Please provide the existing copy rather than recreate it.}
Please reply with the listed documents for this job only. Do not include payment-card, bank, government-ID or unrelated customer information.
This is document collection only; no permit has been submitted.

No public upload endpoint or broad shared folder is assumed. Reply attachments are a future approved route, not an implemented feature. A sensitive item requires a verified secure method and scoped authorization instead of this ordinary pattern.

## Prototype input/output
`rep-document-fallback.mjs` is a pure planner. It accepts normalized verified IDs, scope version, dated requirements/checks and minimal history. It rejects unverified/wrong-job/stale recipient or scope evidence, suppresses available/pending/uncertain/received documents, and returns only document IDs and reason codes (never raw mail, contacts or instructions). Evidence freshness limit is a conservative 24-hour planning default, not an asserted city policy. Stale or ambiguous requirements need re-review.

## Readiness
20 synthetic focused tests cover no external actions, source completeness/freshness, available/unreadable suppression, dedup delivery states, cross-rep suppression, confirmed failure retry planning, wrong/notification-derived rep, closed task, wrong scope, sensitive class, free-text exclusion and future time rejection. No real recipient resolved, no Bartlett document requested, no email sent, no production integration tested. Activate only after recipient mapping, trusted evidence adapters, scoped outbound authorization, persistent concurrency-safe dedup, reply validation and cancellation handling are implemented and tested.

Final verification: 66 Node tests (includes 20 new fallback cases), 21 stress cases, 24 Python tests using installed Python 3.12, 13 parser checks and independent mock-DOM QA pass. Initial system Python 3.9.6 run failed three existing SQLite backup tests with `unable to open database file`; rerun using prior project runtime Python 3.12 passed all 24. No persistence code changed. Visual UI or real email delivery not tested. The three live intake source hashes remain identical to v10.
