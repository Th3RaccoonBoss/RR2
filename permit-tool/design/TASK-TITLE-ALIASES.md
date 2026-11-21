# Bounded permit task-title policy — November 12, 2026

Supersedes the v9 inactive exact-alias proposal at the owner's request for multiple word combinations. The live intake module now imports `permit-title-policy.mjs`. The older design wrapper/test are historical only; the former test has a .historical suffix and is not executed.

Examples: Pull permit roofing, Request roofing permit, Pull roof permit, Please obtain a siding permit, Get the building permit, Apply for a roofing permit, Roofing permit request, Roofing permit needed, Need roofing permit, Permit Request - Roofing. Capitalization, repeated spaces, limited separators and optional please are normalized. Only a finite generated grammar is accepted; no body-based instructions or fuzzy matching.

Cancellation, negation, completed/issued/status/fees/invoices/inspection/renewal, forwarded subjects and unsupported extra text are ignored. Plausible truncated supported request prefixes containing the full word permit are manual-review candidates with no trade hint and task_title_confirmation_required. No missing text is inferred. Sender, mailbox, immutable message, cutoff, links, dedup, task authority and ACL revalidation remain required. The SQL builder preserves both original blockers and the fixed optional title-confirmation blocker, with no external actions.

The prompt-only automation update keeps its 15-minute cadence and immutable cutoff 2026-11-12T20:52Z. Search expands to all exact-sender ACL mail after cutoff (max 500 candidates), then code classifies actual subjects. No attachments are ingested. Gmail body cannot broaden the policy. This permits actual titles instead of requiring one exact spelling but still does not approve or apply for permits.

## Verification
Connected Mac. Final checks: 46 Node runner tests; 21/21 stress; 24 Python tests plus 13 parser checks; independent mock-DOM QA passed. No production queue write or live email action was performed as part of this development. Visual browser QA not performed.

Independent review found a preexisting explicit :443 URL normalization gap. Fixed by validating raw HTTPS authority before parsing; regression checks cover explicit ports 443, 80 and 8443, all rejected.
