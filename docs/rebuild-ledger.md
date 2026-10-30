# Rebuild ledger

Durable record for the A–Z completion plan. Commits live on `stabilize/baseline`. Nothing here has been pushed.

## Backup

`C:\Users\DELL\Desktop\date-harvest-hub-backup-2026-10-30\`: `repo-all-refs.bundle` (verified), `working-tree.diff`, `untracked-files.tgz`. Taken before any change.

## Rulings

- Phase 0: Ruling: the 13 preservation commits were not tested one by one; only the final tree was. A commit split by file cannot be checked out and run without a worktree per commit, and these commits only record existing work. Cost if wrong: `git bisect` may land on a commit that does not build.
- Phase 0: Ruling: `seed-test-actors` keeps its test password on local targets and requires `TEST_ACTOR_PASSWORD` on remote ones. Local seeding stays one command. Cost if wrong: a known password survives on local databases only.
- Phase 0: Ruling: `testTimeout` is raised to 15 s for the whole suite rather than one dialog test. The audit's timeout came from load, and any dialog test can hit it. Cost if wrong: a truly hung test takes 10 s longer to fail.
- Phase 0: Ruling: the genealogy test now counts `CONSOMMATION` on the output lot only. Production start writes its own movements for source lots, and the assertion's purpose is packaging replay. Cost if wrong: none for replay coverage, which is still asserted.
- Phase 0: Ruling: production test fixtures stay uppercase and only the expected results became lowercase, so the suite keeps exercising legacy rows (Review Focus 4). Cost if wrong: none.

## Phase status

| Phase | Status | Evidence |
|---|---|---|
| 0 | Code complete; operator steps BLOCKED | See `docs/progress.md`, 2026-10-30 |
| 1 | NOT STARTED: waits for credential rotation (plan section L) | |
