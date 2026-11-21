# Next stage: read-only job enrichment to reviewed checklist

Status: inactive/test-only. Bartlett TEST-001 is the intended owner-selected case. The live watcher remains queue-only; this module is not imported by it.

Implemented `joliet-review-stage.mjs`: consumes a scoped, fresh authenticated ACL job identity and candidate trade hint, produces checklist with explicit job, jurisdiction, task, scope, document, registration, COI, signature, fee and inspection blockers. No network, database, mail, filing or submission actions. Past bonds are job-specific references and never reusable.

Verification: 98 Node tests passed, 21 stress cases passed, independent mock-DOM QA passed. Five new cases cover stale/future/wrong identity, unknown scope, bond nonreuse, retained authority blockers and no secret/action copying. No visual QA, actual Bartlett end-to-end adapter run or on-city submission test was performed.

Next operational work:
1. Bind the existing server-only `acl-reader.mjs` to an authorized runtime secret through a private trusted adapter; no public unauthenticated endpoint. Exact job allowlist and expiry mandatory.
2. Read Bartlett using its verified UUID; compare job number, preserve freshness. Existing reader deliberately returns only identity, not address/trade. Adding address/trade requires inspecting the actual supported API schema, narrow normalization, tests, and private storage boundaries; do not guess fields.
3. Verify task status, assignee and requester via supported source or manual review. Authenticated job identity does not authorize the task.
4. Confirm parcel jurisdiction rather than postal city, inspect contract scope/value, current registration/insurance and license status. Produce application draft only when required facts are present.
5. Test duplicate runs, mismatched jobs and new document versions before connecting this stage to the live queue. Preserve immutable intake payload and audit review separately.

Joliet source facts are dated November 12 2026 research, not proof of current applicability to Bartlett. COI draft to Ewa remains unsent. No automated replies or outbound permissions are enabled.
