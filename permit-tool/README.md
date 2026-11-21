# Permit workflow: recovered local prototype

Recovered 2026-11-12 after the shared project directory became inaccessible. This is a **partial source recovery plus explicitly reconstructed code**, not a byte-identical original backup and not a finished deployed product.

## Safety and status
- Local dry-run/review only. No live email watcher, API credentials, municipality submissions, COI requests, bond requests, payments, or production deployment.
- Rules/evidence do not confer permission. Reviewed packet results always grant no external actions.
- The HTML demonstration is now synchronized with the recovered hardened engine. It remains synthetic-only, with no real queue. Tinley evidence is narrow and unactivated. Do not use it for real decisions.
- Gmail and native HTML adapters remain prototypes. Identity, transport provenance, representative authority and job mapping require trusted production adapter validation.

## Provenance
- `email-intake.mjs`, `process.mjs`: recovered displayed logic. Intake adds one explicitly labeled new fail-closed check for malformed dedup state.
- `queue.py`, `queue_race_test.py`, `stress.mjs`: recovered logic, not asserted byte-identical. See QA-RECOVERY.md.
- `readiness.mjs`: validation recovered; final result/COI gate conservatively reconstructed because latest tail was not retained.
- `gmail_adapter_prototype.*`, `html_links_prototype.py`, `tinley-scoped-evidence.*`: restored from collaborator retained code, relocated imports; prototype only.
- `worker.py`, `worker_test.py`, `recovery-integration.test.mjs`, this README and run-tests.sh: newly written recovery/integration artifacts.
- `recovery/`: older demo/source extraction and historical logs. Those logs do not validate this tree.

## Run local verification
`bash run-tests.sh`
Python 3 and Node.js required for the default checks; no packages or network required. Optional ui-browser-check.mjs requires preinstalled Playwright and Chromium. Browser execution was blocked by environment socket/read-only restrictions; no visual acceptance claim. Tests use synthetic values and temporary SQLite databases. Real queue data is not included.

## Still missing / unverified
Full original test suite and evidence snapshots, original worker implementation, full original UI updates, original intake variant and complete source provenance cannot be recovered from surviving files alone. No prior test totals are claimed for this tree. It needs further review and end-to-end authorized live testing before operational use.

## UI hardening update
Embedded engine parity, result-derived badges/checkmarks, current-time revalidation on render/download, narrow Tinley exception evidence, and explicit synthetic boundaries. Independent mock-DOM tests pass; real browser check remains blocked. update_demo.py synchronizes the embedded engine without network.

## Additional inactive jurisdiction research
`research/jurisdictions/` contains dated November 12 source snapshots and scope/unknown summaries for Orland Park, Naperville, Lombard and Village of Barrington. They are representative, not ranked by job frequency; the original city audit is unavailable. These files are not imported by the engine and add no active rules. Fees and requirements are observations, not verified current job-specific instructions. See each summary for material, structural, contractor classification and sensitive-document limits.
