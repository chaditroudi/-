# Phase 0 report

Branch `feature/phase-0-safety`, from `7d01d5f`. Local only: nothing pushed, merged or deployed. Run on 2026-10-31, on private ports and throwaway databases on the local replica set. Atlas, `:8080` and `:4000` were not touched.

## Gates

| Gate | Result | Detail |
|---|---|---|
| Unit and integration, with replica-set suites | **PASS** | 670 of 670, none skipped |
| QC evidence, PIN and rollback regression | **PASS** | Included above |
| Server TypeScript | **PASS** | 0 |
| Client TypeScript | **PASS against baseline** | 215, none new |
| Lint | **PASS** | 0 errors, 995 warnings; +1 is `EnvironmentRibbon` exporting a helper |
| 17 browser scenarios, frozen build, service worker on, `enforce` | **PASS** | 17 of 17 |
| 17 browser scenarios, dev server, `enforce` | **PASS** | 17 of 17 |
| Isolation suite, real API and browser | **PASS** | 23 of 23 |
| Mutation check | **PASS** | With the sign-out cleanup removed, the suite failed "the stream closes at sign-out" |
| Production build | **PASS** | Built, and refused with no named API |
| Restore rehearsal | **PASS** | 52 collections, 1,219 documents; backup 0.46 s, restore 5.69 s |
| Thread | **FAIL, expected** | 6 steps broken; acceptance test for Phases 2 and 3 |
| Staging, hosted topology | BLOCKED | No staging exists |
| Backup of the real database | NOT VERIFIED | Atlas not touched; rehearsal used synthetic data |
| Physical offline tablet | NOT VERIFIED | Offline tested by browser emulation |

Refused live: `APP_ENV=test` on a remote database, an unlabelled Vite server, a smoke script at `:4000`, backup and backfill of a remote database.

## Blockers closed

| Plan ID | Fix | Proof |
|---|---|---|
| E1 | Any Vite server but `:8080` must name a proxy, and not `:4000` | Unit, live |
| E2 | `APP_ENV`; `dev` and `test` refuse a remote database | Unit, live |
| B3, E3 | Demo data never goes to a remote database, even unlabelled | Unit |
| E4, E5 | `/health` reports environment and host class; 12 scripts and the suite check it before writing | Unit, isolation |
| E6 | Ribbon names any non-production stack | Unit; not reviewed visually |
| E7 | Migration and collection scripts guarded | `backfill` live; `migrate` and the mongosh scripts not run |
| E8 | Acceptance ran with `enforce` | Gates |
| B4 | Backup, restore, rehearsal | Rehearsal; damaged backup and non-empty target refused |
| B5 | Realtime carries ids only; external accounts hear only what is addressed to them | Unit, isolation |
| B6 | Single-use 30 s ticket; streams close at 15 minutes; URL tokens refused | Unit, HTTP, isolation |
| B7 | Service worker keeps no API cache, old cache deleted, responses `no-store`, memory and stream cleared when the account changes | Isolation, mutation |
| D-04 | Supplier portal scope confirmed by execution | Isolation |
| D-21 | An update never reloads over a dialog, a reception in progress or a focused field | Unit only |
| D-31 (part) | A delivery with no owner is not sent under the next account | Unit |

## Behaviour changes to review

- **Offline reads:** the 5-minute API cache is gone. After a reload with no network, screens show no cached lists. Queued receptions, drafts and scenario H are unaffected.
- **Realtime:** a client must refetch; events no longer carry records. Streams reconnect every 15 minutes, which refreshes screens.
- **Auditors and portal accounts** get no live updates unless an event is addressed to them.
- **Removed:** the unused `channel()` realtime code in `client.ts` and its test.
- **Added test account:** `fournisseur.externe@test.local` in the test seed.

## Remaining blockers

| Item | Owner |
|---|---|
| Rotate the Atlas URI and JWT secret reported public in history | User |
| Add `APP_ENV=live-dev` to `.env`. Until then `:8080` shows "non déclaré" and warns, and works unchanged | User |
| `:8080` still runs `8ab1bc5`, with the QC bypass and none of this | User decides when to land |
| `origin/main` is 27 commits behind; deployed code has none of this | User decides |
| Confirm Atlas backup tier; run a rehearsal on a sanitized copy | User |
| Read-only check of whether the demo seed wrote to Atlas | User approval |
| Staging | User |
| Stream tickets and the event bus assume one API process | Decide before scaling |
| The backup is not point-in-time: stop writes first | Operating rule |

Next: Phase 1, on the user's go-ahead.
