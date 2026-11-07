# Date Harvest — full UI/UX rebuild checklist

**Overall: NOT COMPLETE.** Single tracker for the tablet-first redesign (plan of 6 Nov 2026, branch `feature/tablet-first`).

States:

- **NOT STARTED** — the working screen is still the previous interface.
- **IN PROGRESS** — a real part of the working screen changed. Not finished.
- **IMPLEMENTED-UNVERIFIED** — redesigned, but the verification gates below have not all passed.
- **VERIFIED** — redesigned; inventory shows no unexplained loss; actions tried in a browser by a permitted role; 375/768/1024/1440 with touch; Arabic RTL and one other language; relevant tests; before/after screenshots in `docs/evidence/tablet-first-ui/`.
- **BLOCKED** — a named blocker stops the work.

A header, a static path label, or a shared CSS rule is not enough to leave NOT STARTED.

Columns: **Parity** = inventory diff against `docs/evidence/tablet-first-ui/inventory-baseline-1556ff0.json` · **Widths** = 375/768/1024/1440 · **i18n** = fr/en/ar + dialect sample, RTL · **Browser** = actions tried as a permitted role.

| Screen | Files | Status | Parity | Widths | i18n | Browser | Notes and evidence |
|---|---|---|---|---|---|---|---|
| Shell / navigation (all roles) | `layout/*`, `pages/Index.tsx` | IMPLEMENTED-UNVERIFIED | inventory: 0 unexplained | 375/768/1024/1440 captured | fr, ar captured | not clicked through | Floor roles: dock at every width, no sidebar; inspector gets Contrôle qualité; Scan on every phone dock; sidebar opens on the reading side. `docs/evidence/tablet-first-ui/after-p1/` (28 captures, 119/119 checks) |
| Login `/auth` | `pages/Auth.tsx` | IN PROGRESS | — | — | — | — | Errors shown on the form, 15 s timeout. Not redesigned. |
| Home — worker | `home/HomePage` | IMPLEMENTED-UNVERIFIED | 1 move logged | 4 widths captured | fr, ar captured | not clicked through | Greeting, station chips, hero next task from real queues, rest of queue, how-to. 43 unit tests pass. `docs/evidence/tablet-first-ui/after-p1/` (28 captures, 119/119 checks) |
| Home — supervisor | `home/HomePage` | IMPLEMENTED-UNVERIFIED | 1 move logged | 4 widths captured | fr captured | not clicked through | Queue plus overview tiles with source and drill-down. `docs/evidence/tablet-first-ui/after-p1/` (28 captures, 119/119 checks) |
| Home — direction / Live | `home/HomePage`, `home/FactoryCommandCenter` | IN PROGRESS | — | home captured | fr, ar (home) | not clicked through | Home redesigned with KPI tiles; the Live command centre itself is not redesigned yet. `docs/evidence/tablet-first-ui/after-p1/` (28 captures, 119/119 checks) |
| Reception — today / pending / registry / alerts | `reception/ReceptionDashboardV2` | IMPLEMENTED-UNVERIFIED | 3 moves logged | 4 widths captured | fr, ar captured | 17-scenario suite 10/17 = main baseline | Header with real day counts and large New reception, pill tabs, today as cards (2 per row on tablet), draft abandon in-app dialog, locale dates/weights. Still French in Arabic: intake blocker sentences (`lib/receptionIntake.ts`), header page titles, supplier search placeholder. Evidence: `docs/evidence/tablet-first-ui/after-p2/` (24 captures, 102/102). |
| Reception — intake | `reception/intake/*` | IMPLEMENTED-UNVERIFIED | French wording unchanged; parity diff clean for intake | not captured yet | fr/en/ar + dialect actions | 17-scenario suite: 10/17, identical to main (same 7 fail on 1556ff0) | Step progress bars, grouped fields with completion ticks, net pinned in the action bar, read-back review, in-app abandon confirmation. Evidence: `docs/evidence/tablet-first-ui/reception-p2/results.json`. |
| Reception — detail | `reception/ReceptionDetailV2`, `ReceptionCancelDialog`, `ReceptionCorrectionDialog` | VERIFIED | 6 moves logged, 0 unexplained; every field of the three former cards, all 6 tabs, all 12 dialogs and actions kept | 375/768/1024/1440, touch below 1100 | fr, en, ar (detail 112 keys, cancel/correction 20 keys) + tn overrides; next step, statuses, grades, weighing source, page title, search and live status translated through shared keys | as `chef.reception`: opened from today's list, Corriger and Annuler la réception offered and their dialogs opened, every section, weighing record opened; 109/109 checks per locale. Submitting a correction/cancellation, lot release/quarantine and GS1 not tried in this pass (the reception suite's correction scenario covers the submission) | Supplier as title, net/gross/lots/arrival figures, next step as a panel (hero when the role can act) with a large action, pill tabs with lot count, sections as fact tiles (two columns on phones), lot cards with 44 px actions and the QR payload behind a disclosure, decision summary card, document tiles, timeline. Cancel/correction dialogs: 48 px fields and actions, changed fields outlined, reason length shown. Evidence: `docs/evidence/tablet-first-ui/reception-detail-p2/`. Still French inside sub-panels: `StorageAssignment` (stock module), `UnitsManagement`, `WeighingRecordDialog`, the BRA/claim print dialogs, audit-log event wording (`describeReceptionAuditEvent`), and server notification toasts. |
| Reception — BRA documents | `documents/DocumentsWorkspace` | NOT STARTED | — | — | — | — |  |
| QC queue | `reception/ReceptionQcQueue` | IN PROGRESS | — | — | — | — |  |
| QC inspection | `reception/QCInspectionDialog` | VERIFIED | 6 moves logged, 0 unexplained; same 15 inputs, textarea, 4 checkboxes, photo, checklist, PIN, print, storage hand-off | 375/768/1024/1440, touch below 1100 | fr, en, ar (172 keys) + tn/iq/sy action overrides (unreviewed); ar RTL captured | real walk as `inspecteur.qualite`: start → 5 sections → refused (checklist) → PIN → lot `STOCK_LIBERE` on the server, 8 runs, 217/217 checks | Task header (step title, guidance, lot facts), 5-segment progress (red when Mesures/Labo incomplete), grouped fields with completion, defect limits shown, tasting as 1–5 buttons, RQC rows as cards, decision as 3 option cards, sticky action bar (primary full width on phones). Touch targets < 44 px at 375/768/1024: 66 before → 0 after. `QCInspectionFlow.test.tsx` 3 pass; full suite 816 pass. Evidence: `docs/evidence/tablet-first-ui/qc-p2/before` and `/after` (80 captures each, `results.json`), harness `scripts/e2e/qc-inspection-visual.e2e.mjs`. Classification labels (Extra, Catégorie I…) and checklist item names come from data/lib and stay French in Arabic. |
| Stock / storage (6 views) | `batches/StorageZonesOverview` | NOT STARTED | — | — | — | — |  |
| Production — today / orders / pipeline / done | `production/*` | IN PROGRESS | — | — | — | — | Today rows use full-width actions. |
| Production — order detail | `production/ProductionOrderDetail` | NOT STARTED | — | — | — | — |  |
| Cleaning | `phase2/NettoyagePanel` | NOT STARTED | — | — | — | — |  |
| Fumigation | `phase2/fumigation/*` | NOT STARTED | — | — | — | — |  |
| Hydration | `phase2/HydratationPanel` | NOT STARTED | — | — | — | — |  |
| Triage | `phase2/triage/*` | NOT STARTED | — | — | — | — |  |
| Production — flux / balance / HACCP / KPI / alerts | `production/*`, `phase2/*` | NOT STARTED | — | — | — | — |  |
| Packaging — orders / BOM / labels / pallets | `packaging/*` | NOT STARTED | — | — | — | — |  |
| Shipments / transport / BDE | `logistics/*`, `bon-expedition/*` | NOT STARTED | — | — | — | — |  |
| Export — orders / contracts / COA | `export/*` | NOT STARTED | — | — | — | — |  |
| Purchasing (8 tabs) | `purchasing/*` | NOT STARTED | — | — | — | — |  |
| Suppliers | `mes/SuppliersList`, `SupplierDetailSheet`, `SupplierDialog` | NOT STARTED | — | — | — | — |  |
| Materials | `mes/MaterialsList` | NOT STARTED | — | — | — | — |  |
| Customers | `customers/*` | NOT STARTED | — | — | — | — |  |
| Quality — CAPA / audit | `quality/*` | NOT STARTED | — | — | — | — |  |
| Alerts | `alerts/*`, `pages/AlertsCenter` | NOT STARTED | — | — | — | — |  |
| Scan / traceability | `scan/ScanStation`, `phase2/LotTraceabilityDialog` | NOT STARTED | — | — | — | — |  |
| Analytics — managers (5 tabs) | `analytics/AnalyticsDashboard` | NOT STARTED | — | — | — | — |  |
| Analytics — directors (9 tabs) | `analytics/FounderAnalyticsDashboard` | NOT STARTED | — | — | — | — |  |
| Cockpit (sage-operations) | `home/SageOperationsHub` | NOT STARTED | — | — | — | — |  |
| Maintenance | `maintenance/*` | NOT STARTED | — | — | — | — |  |
| HR — attendance / tasks | `employees/*`, `timesheets/*`, `tasks/*` | NOT STARTED | — | — | — | — |  |
| Settings (13 tabs) | `settings/*` | NOT STARTED | — | — | — | — |  |
| Supplier portal `/portail` | `pages/SupplierPortal` | NOT STARTED | — | — | — | — | Isolation defect: supplier lists 2 supplier records. |
| Lot passport `/passport/:lotId` | `pages/PassportPage` | NOT STARTED | — | — | — | — |  |
| Technical sheets (`home&view=fiches`) | `fiches/*` | NOT STARTED | — | — | — | — |  |
| Not found | `pages/NotFound` | NOT STARTED | — | — | — | — |  |

## Shared foundation

| Item | Status | Notes |
|---|---|---|
| Design tokens (reference look) | DONE | `ee8d088`; AA contrast checked |
| Arabic font self-hosted | NOT STARTED | Noto Sans Arabic still loads from Google; needs the font files downloaded (ask the user) |
| Six locales + fallback + factory default language | DONE | `b1794ee`; dialects unreviewed |
| Locale-aware formatter | DONE (adoption per screen) | `src/lib/format.ts`; old hardcoded formats replaced as screens are redesigned |
| RTL-safe spacing (logical classes) | DONE | 794 classes in 155 files via `scripts/codemods/rtl-logical.mjs` |
| Task primitives (TaskCard, TaskStepLayout, …) | DONE | `src/components/shared/task/` |
| Worker dock / shell | DONE | dock for floor roles at every width |


## History before the 6 Nov 2026 plan (kept for evidence)

| Screen | Implementation | Verification | What actually changed |
|---|---|---|---|
| Shell / role nav | IN PROGRESS | not verified this pass | Floor menu already limited. Not retested at four widths or in Arabic. |
| Login | IN PROGRESS | browser sign-in reached the home screen | A failed sign-in now shows the error on the form and the button returns. The request times out after 15 seconds instead of staying on Chargement. The screen itself is not redesigned. |
| Home | NOT STARTED | browser opened for the reception operator | Role landing copy exists. The cockpit was not rebuilt. Static path label removed. |
| Reception | IN PROGRESS | browser opened the waiting list; widths and Arabic not run | Today’s list is a task card. Today is empty. En attente shows the draft and two receptions waiting for quality control, with their real weights. Intake and history were not retested in this pass. |
| Quality control | IN PROGRESS | automated flow passed; browser not walked | The inspection path follows the open section and missing humidity, caliber, and lab fields. “Valider la décision” is the primary button only on Verdict. Measurement and defect fields are taller. `QCInspectionFlow.test.tsx`: 3 passed. The inspector was not signed in during this recovery. |
| Production | IN PROGRESS | not verified | Today’s work rows use a full-width primary button (`Démarrer`, `Allouer un lot`, and the same actions as before). Stage screens themselves are unchanged. |
| Stock | NOT STARTED | — | Static path label removed. |
| Packaging / pallets | NOT STARTED | — | Static path label removed. |
| Shipments | NOT STARTED | — | Static path label removed. |
| Export | NOT STARTED | — | Static path label removed. |
| Suppliers | NOT STARTED | — | Unchanged. |
| Purchasing | NOT STARTED | — | Static path label removed. |
| Customers | NOT STARTED | — | Static path label removed. |
| Alerts | NOT STARTED | — | Static path label removed. |
| Traceability | NOT STARTED | — | Unchanged. |
| Indicators | NOT STARTED | — | Unchanged. |
| Cockpit | NOT STARTED | — | Static path label removed. |
| Settings | NOT STARTED | — | Static path label removed. |
| Supplier portal | NOT STARTED | — | Static path label removed. |

## Verification gates still open

- **Gate 0, restored on 6 Nov 2026.** The 38-byte limit comes from MongoDB Atlas shared tiers (`AtlasError` code 8000), not from MongoDB’s normal 64-byte limit and not from application code. The 46-byte name `dhh_f_22fed28b3895f92b91e7abd47b3e46886145a7bf` was never created. The control database still held the factory’s records. Those records were copied, after a backup, into `dhh_f_22fed28b3895f92b91e7abd47b3e4688` (38 bytes). The control database was not deleted. Health returned 200 with the database connected. Sign-in as the reception operator returned 201, and reception search returned the copied records. The browser then opened the operator home and the waiting-reception list (two lots in quality control, one draft).
- Widths 375, 768, 1024, 1440. Not run.
- Arabic RTL. Not run.
- Production build of the UI after the login change. Not re-run. The server compile used by the running API exited 0.
- Frontend tests this pass: factory database name 8 passed, factory isolation 3 passed. Earlier reception and QC tests still stand.

## Evidence

`docs/evidence/ui-ux-rebuild/2026-11-06-reception-qc.md`

Backup, not in git: `backups/date_harvest_hub-pre-factory-adopt`

## Next executable task

Open Réception as `operateur.reception@test.local` and finish the intake form in the browser at 1440 and 375. Then sign in as `inspecteur.qualite@test.local` and walk one inspection from Mesures to Verdict. Continue with stock, packaging, and shipments. Do not mark those modules verified from this recovery.

## Reception browser suite baseline (6 Nov 2026)

`scripts/e2e/reception.e2e.mjs` had not run green since factory isolation (`f416051`): it seeded the control database while the API reads each factory database. Its seeding now writes to the factory database (same name the server derives). With that fix, `main` 1556ff0 and `feature/tablet-first` both pass 10/17. Failing on both: D (connected weighing), H (offline/session recovery), S, V, Q (QC follow-ups), P (expects the QC tab "3 · Laboratoire", renamed "3 · Labo" on main), R (tablet widths). These are open defects of main or of the suite, not of the redesign; to be fixed in the QC pass.
