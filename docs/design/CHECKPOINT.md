# Tablet-first redesign — checkpoint

Updated: 7 Nov 2026.

| | |
|---|---|
| Branch | `feature/tablet-first` (local, not pushed). Preview for the user: `preview/tablet-first` (fast-forward it with `git merge --ff-only feature/tablet-first` in the main folder) |
| Last commit | QC inspection redesign (this commit, on top of `55d2691`) |
| Plan | `C:\Users\DELL\.claude\plans\date-harvest-hub-crystalline-lecun.md` (P0–P6) |
| Tracker | `docs/plans/UI_UX_FULL_REBUILD_CHECKLIST.md` |

## Done
- P0: `CLAUDE.md`, audits, generated role matrix, feature inventory + parity diff, baseline screenshots.
- P1: tokens, six languages (fr, en, ar, ar-TN, ar-IQ, ar-SY), formatter, RTL codemod, task primitives, worker dock, task-first homes.
- P2 (part): reception intake and reception lists, QC queue (`b010763`), QC inspection dialog (VERIFIED: `docs/evidence/tablet-first-ui/qc-p2/`).

## Last passing gates
- `npm run typecheck` 0 / 0, `npm run lint` 0 errors, `npm test` all pass.
- Reception 17-scenario suite: 10/17, identical to `main` 1556ff0 (run with `scratchpad run_reception.sh`: private replica set :27351, ports 4171/8171).
- Visual: `docs/evidence/tablet-first-ui/after-p1` (homes) and `after-p2` (reception).

## Next
1. Production (P3): workspace, today and cleaning done. Cleaning start is BLOCKED by a missing server route `GET /phase2/cleaning/source-lots` (404 on main too); ask the user before adding a server endpoint. Next: fumigation `phase2/fumigation/*`, then hydration, triage, orders/pipeline/done, order detail. Harness: `QC_VISUAL_MODE=cleaning` shows how to seed a released lot by API.
2. Shared text pass: page titles in `TopHeader` from `nav.*`, intake blocker sentences in `src/lib/receptionIntake.ts` (return keys, translate at render), `SupplierPicker` placeholder, `LotJourneyHub`.
3. `ReceptionDetailV2` (767 lines), BRA documents.
4. Then P3 (stock, production stages, packaging), P4, P5, P6 as in the plan.

## Open defects found on main (not caused by the redesign)
- Cleaning: `NettoyagePanel` fetches `/phase2/cleaning/source-lots`, which the server does not define; "Nouveau cycle" shows "Impossible de charger les lots de stock" and no cycle can be started from the screen.
Reception suite D, H, S, V, Q, P, R fail on main too; supplier sees other suppliers (isolation suite).

## Verification notes (7 Nov 2026)
- `npm run build` in a worktree without `.env` stops at the API-target guard; build with `VITE_API_URL=/api` as CI does (`MSYS_NO_PATHCONV=1 VITE_API_URL=/api npx vite build --outDir <scratch>`).
- QC harness: `scripts/e2e/qc-inspection-visual.e2e.mjs` (ports 27361/4186/8186; seeds factory defaults through `INITIAL_ADMIN_TENANT_ID/FACTORY_ID`).
- Lint: 0 errors, 1,021 warnings repo-wide; the QC dialog keeps the same 7 warnings it had at `55d2691` (all in `getRecommendedColdStorageZone`).
