Validation November 12, 2026:
- Existing run-tests.sh exited 0: 30 Node tests, 21 stress checks, 24 Python tests, 13 parser checks, independent mock-DOM QA.
- Separate node --test design/email-plan.test.mjs: 6/6 pass.
- No live external actions or production integration. This directory is not imported by the pilot.
- Archive excludes caches, probes and environment/credential files. Pattern scan found only code variable references and synthetic test secrets, not credential values. Contains existing source/research and synthetic fixtures, not raw customer mail/attachments.
