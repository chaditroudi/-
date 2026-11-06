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
| Shell / navigation (all roles) | `layout/*`, `pages/Index.tsx` | IN PROGRESS | — | — | — | — | Floor menu limited earlier. Known gaps: no bar on home for phones; inspector lacks QC entry; 4 roles lack mobile Scan. |
| Login `/auth` | `pages/Auth.tsx` | IN PROGRESS | — | — | — | — | Errors shown on the form, 15 s timeout. Not redesigned. |
| Home — worker | `home/HomePage`, `RoleLanding` | NOT STARTED | — | — | — | — | Counts list, not the worker's own tasks. |
| Home — supervisor | `home/HomePage` | NOT STARTED | — | — | — | — |  |
| Home — direction / Live | `home/FactoryCommandCenter` | NOT STARTED | — | — | — | — |  |
| Reception — today / pending / registry / alerts | `reception/ReceptionDashboardV2` | IN PROGRESS | — | — | — | — | Today list is a task card (earlier pass). |
| Reception — intake | `reception/intake/*` | IN PROGRESS | — | — | — | — | Three steps exist; not redesigned for tablet. |
| Reception — detail | `reception/ReceptionDetailV2` | NOT STARTED | — | — | — | — |  |
| Reception — BRA documents | `documents/DocumentsWorkspace` | NOT STARTED | — | — | — | — |  |
| QC queue | `reception/ReceptionQcQueue` | IN PROGRESS | — | — | — | — |  |
| QC inspection | `reception/QCInspectionDialog` | IN PROGRESS | — | — | — | — | Open-section path, missing-field guidance; `QCInspectionFlow.test.tsx` 3 passed. |
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
| Design tokens (reference look) | NOT STARTED | |
| Arabic font self-hosted | NOT STARTED | Noto Sans Arabic loads from Google today |
| Six locales + fallback + factory default language | NOT STARTED | fr/ar/en exist |
| Locale-aware formatter | NOT STARTED | 194 hardcoded fr-FR/fr-TN |
| RTL-safe spacing (logical classes) | NOT STARTED | ~786 physical classes |
| Task primitives (TaskCard, TaskStepLayout, …) | NOT STARTED | |
| Worker dock / shell | NOT STARTED | |


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
