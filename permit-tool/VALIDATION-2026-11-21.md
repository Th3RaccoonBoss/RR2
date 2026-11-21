# Joint permit-tool validation | November 21, 2026

Claude reviewed the physical workspace path. The Finder-friendly Shared Agent Pilot path is a symlink to that same directory. Claude’s review is preserved in CLAUDE-REVIEW.md; those initial observations were from source inspection. The changes and execution below were done by Andromeda on the Mac, only in this review copy.

- Added an offline synthetic path from task intake → generated Neon insert (decoded into a fixture, not executed against Neon) → mocked AccuLynx read → review checklist. Synthetic rows are explicitly marked and still rejected by the default bridge.
- Require non-null linked UUID and nonblank job number for a checklist match. Carry title and authority blockers through the checklist, distinguish known ACL failures and reject duplicates when already-seen keys are supplied. A city hint cannot establish jurisdiction. No outward actions are granted.
- Verified: 40 core Node subtests, 67 design Node subtests, 24 Python tests, 21 stress scenarios, and independent mock-DOM checks passed. Browser visual, real Gmail-to-ACL and real municipal end-to-end tests were not performed.
- Live Gmail/Neon review-only intake, source archive and credentials were not changed. Next verified-operations step: identify the supported, approved read-only AccuLynx data path for one owner-approved job and confirm which fields it can return. Task requester, assignee, current status, exact scope, documents and parcel authority remain independent gates. Never downgrade these to assumptions.
