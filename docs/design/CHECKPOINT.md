# Tablet-first redesign — checkpoint

Updated: 6 Nov 2026.

| | |
|---|---|
| Branch | `feature/tablet-first` (local, not pushed). Preview for the user: `preview/tablet-first` (fast-forward it with `git merge --ff-only feature/tablet-first` in the main folder) |
| Last commit | `2ac2149` reception lists |
| Plan | `C:\Users\DELL\.claude\plans\date-harvest-hub-crystalline-lecun.md` (P0–P6) |
| Tracker | `docs/plans/UI_UX_FULL_REBUILD_CHECKLIST.md` |

## Done
- P0: `CLAUDE.md`, audits, generated role matrix, feature inventory + parity diff, baseline screenshots.
- P1: tokens, six languages (fr, en, ar, ar-TN, ar-IQ, ar-SY), formatter, RTL codemod, task primitives, worker dock, task-first homes.
- P2 (part): reception intake and reception lists.

## Last passing gates
- `npm run typecheck` 0 / 0, `npm run lint` 0 errors, `npm test` all pass.
- Reception 17-scenario suite: 10/17, identical to `main` 1556ff0 (run with `scratchpad run_reception.sh`: private replica set :27351, ports 4171/8171).
- Visual: `docs/evidence/tablet-first-ui/after-p1` (homes) and `after-p2` (reception).

## Next
1. QC: `src/components/reception/ReceptionQcQueue.tsx`, then `QCInspectionDialog.tsx` (1,429 lines) — translate, task layout, keep every measure, defect, lab field, checklist and the PIN decision. Fix the suite's stale expectation "3 · Laboratoire" (main renamed it "3 · Labo") only by matching the real label.
2. Shared text pass: page titles in `TopHeader` from `nav.*`, intake blocker sentences in `src/lib/receptionIntake.ts` (return keys, translate at render), `SupplierPicker` placeholder, `LotJourneyHub`.
3. `ReceptionDetailV2` (767 lines), BRA documents.
4. Then P3 (stock, production stages, packaging), P4, P5, P6 as in the plan.

## Open defects found on main (not caused by the redesign)
Reception suite D, H, S, V, Q, P, R fail on main too; supplier sees other suppliers (isolation suite).
