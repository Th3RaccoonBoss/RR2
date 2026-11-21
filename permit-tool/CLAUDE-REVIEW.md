<!-- Filed by Claude from the Hive Room, thread "Main room", 2026-11-21T13:10:36.394Z -->

# Permit tool review (CLAUDE-REVIEW.md content)

Date: November 21, 2026

## Verification status

- **Not run:** `run-tests.sh`, `design/*.test.mjs`, and the synthetic task. This session has read, search and edit tools only.
- **Not accessed:** `~/Shared Agent Pilot/permit-tool`. Access was denied.
- **Reviewed instead:** `~/.openclaw/workspace/shared-agent-pilot/permit-tool`, read only. Its HANDOFF.md describes the review copy, but I could not confirm it is the same folder or identical.
- **Changes made:** none. All findings below come from reading the code. Scenario outcomes are expected results, not test results.
- The baseline pass is Dot's report. I did not reproduce it.

## Variable matrix

"Live route" entries are what HANDOFF.md states. I did not check live systems.

| Input | Needed for offline run | Mock to use | Live operator route | Missing authorized input |
|---|---|---|---|---|
| Mail connector link ID | Yes | Dummy `link_000...` already in code | Configured, per handoff | None for offline |
| Allowed sender | Yes | Hardcoded ACL sender | Configured | None |
| Activation cutoff | No | Not implemented in this copy | Held by poller, per handoff | Confirm enforcement stays outside these modules |
| Gmail message ID | Yes | 16 lowercase hex characters | Connector supplies | None |
| `transportVerified` | Yes | `false` | Adapter always sets `false` | Real sender-authentication source |
| Neon project, branch, database, role | SQL generation only | Synthetic `NEON_TARGET` | Pinned in live connector | None. Do not bind this copy |
| Queue database connection | No | In-memory row or temporary SQLite | Scoped worker | None for offline |
| ACL `apiKey` | Mock only | Dummy string | Not bound to this reader | Brandon's approval of the exact integration |
| ACL `allowedJobIds` | Yes | One synthetic UUID | None | Rule for how a queued job enters the allowlist (max 10) |
| ACL `expiresAt` | Yes | Short injected expiry (max 14 days) | None | Pilot window decision |
| ACL `fetcher`, `now` | Yes | Injected mock and fixed clock | None | Confirmed response shape for `id` and `jobNumber` |
| Task requester, assignee, status | Blocker stays | Unverified | Not available | Supported authenticated ACL read |
| Parcel jurisdiction | Blocker stays | City hint only | Not available | Authoritative parcel source |
| Trade and exact scope | Blocker stays | Title hint only | Owner review | Owner or rep confirmation |
| Contractor entity, COI, bond, documents | Blocker stays | Synthetic records | Restricted storage | Verified operator process |

No environment variables are read by the JS or Python modules (searched for `process.env`, `os.environ`, `getenv`).

## ACL validation review

The pieces exist, but the path is not connected:

`email → queueCandidate → makeQueueInsert → [row] → reviewQueuedJob → [no link] → checklist`

`reviewQueuedJob` is imported only by its own test.

### Blocking

1. **Synthetic rows cannot pass ACL review.** `makeQueueInsert` with `synthetic:true` prefixes the key and sets `synthetic:true` (`connector-queue-sql.mjs:10-11`). `reviewQueuedJob` requires `synthetic===false` and an unprefixed key (`design/acl-queue-review.mjs:7`). Its test passes because it hand-builds a row marked non-synthetic.
2. **The checklist cannot be built from a queue row.** `preparePilotChecklist` needs the original message (`pilot-checklist.mjs:11`). The queue deliberately stores no subject, sender or links.
3. **False "matched" result.** The freshness check at `pilot-checklist.mjs:13` does not require a non-null job ID or a job number. With a missing link and a lookup whose `id` is null, `null===null` marks the job verified. A lookup with no job number is also marked verified.
4. **Blockers are dropped.** The checklist output omits `reviewBlockers` and `reasons` (`pilot-checklist.mjs:16-26`). A truncated title, missing link or unverified sender disappears from the reviewed result.

### Should fix

5. **No dedup at checklist stage.** `preparePilotChecklist` takes no known-keys input, so a repeated message yields another checklist.
6. **Message ID rules differ.** Intake accepts any lowercase hex length (`email-intake.mjs:8`), while the queue requires 16 and throws (`connector-queue-sql.mjs:6`). This fails closed, but the caller needs to handle it as a rejection.
7. **Freshness windows differ.** ACL review allows 5 minutes, while the checklist and readiness allow 24 hours. Use the bridge's verified result for the checklist rather than a second window.
8. **Reader failure reasons are lost.** `pilot_expired` and `job_not_allowed` both become `fresh_matching_job_required` in the bridge, which makes review harder.
9. **Reader output cannot satisfy jurisdiction readiness.** `assessPermit` needs `jurisdictionId` and `jurisdictionVerified` on the job, but the reader correctly returns identity only. A separate verified source is required.

## Expected synthetic scenarios (not run)

| Scenario | Expected today | Status |
|---|---|---|
| Valid task to queue insert | `manual_review` SQL generated | Should work |
| Queue row to ACL review, synthetic flag on | `invalid_queue_row` | **Broken** |
| Reviewed row to checklist | No connecting code | **Missing** |
| Wrong mailbox | `reject` | Covered |
| Duplicate at intake and SQL | `duplicate`, `DO NOTHING` | Covered |
| Duplicate at checklist | New checklist | **Gap** |
| Expired ACL verification | Blocked, generic reason | Works, weak reason |
| Wrong UUID | Blocked | Covered |
| Missing link with null-ID lookup | Marked `matched` | **Bug** |
| Missing documents | Stays unverified, readiness blocks | Covered |
| Differing jurisdiction | Readiness blocks via owner review | Covered at readiness only |

## Proposed patch (not applied)

Apply only in the approved copy:

1. Add `design/queue-review-checklist.mjs`, which accepts a queue row plus injected `readJob`, `now` and `cityHint`, calls the ACL review, and builds the checklist from the row and verified result.
2. Accept synthetic rows only through an explicit test option. Require the `synthetic:connector:` key and carry `synthetic:true` into the output. Leave the production path rejecting them.
3. In `pilot-checklist.mjs`, require a non-null `candidate.jobId` and a non-empty job number, and carry forward `reviewBlockers` and `reasons`.
4. Accept `knownKeys` and return `duplicate` before building a checklist.
5. Preserve the reader's specific blocked reason in the bridge.
6. Add one offline end-to-end test covering every scenario above, with a mocked fetcher, fixed clock and no network.

Keep `allowedExternalActions` empty throughout.

## Remaining blockers

1. Access to the approved folder and a way to run commands, or another agent to do this.
2. Confirmation that the workspace copy matches the approved copy.
3. Actual baseline and post-patch test output.
4. Brandon's approval before any real ACL credential binding.
5. Proven supported ACL reads for job identity, task requester, assignee and status.
6. An authoritative parcel jurisdiction source.

## Commands once access exists

```sh
cd ~/"Shared Agent Pilot/permit-tool"
PYTHON_BIN=/opt/homebrew/bin/python3.12 bash run-tests.sh
node --test design/*.test.mjs
```
