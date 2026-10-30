# Manufacturing Employee UX Specification

Status: draft for the frontend work in Phases 2, 5 and 7. Written 2026-10-30 on `stabilize/baseline`.

**Goal:** an employee opens the app, sees their own work, and finishes it without knowing how the software is built.

**Evidence limits:**

- Everything here comes from reading the code. The app was not run, and no employee was observed.
- Tap counts are static counts from the code, not timed tests. Section G says how they become real measurements.
- Plant reality is unknown: who shares a tablet, which roles are actually staffed, and how often each station is used.

Terms: "tab" is an `AppTab` id in `src/lib/roleAccess.ts`. Screens are in `src/components/` unless a path says otherwise.

## A. Current navigation and screen inventory

### Navigation systems

An employee can move around the app in six different ways:

| System | File | Where it appears |
|---|---|---|
| Sidebar: Travail, Atelier, Bureau, Direction | `layout/AppSidebar.tsx` | Desktop; drawer on mobile |
| Home task rows and post tiles | `home/HomePage.tsx` | Accueil |
| Bottom bar and sheet | `layout/WorkflowNavigation.tsx` (777 lines) | Mobile, except on Accueil |
| Process stepper | `layout/FlowStepper.tsx` | Five atelier tabs |
| Command palette | `layout/CommandMenu.tsx` | Everywhere |
| Sub-tabs inside each screen | 24 component files use `TabsTrigger` | Most modules |

### Screens by tab

| Tab | Sidebar label | Main component | Sub-views |
|---|---|---|---|
| `home` | Accueil | `home/HomePage.tsx` | Fiches techniques view |
| `live` | Live | `home/FactoryCommandCenter.tsx` | None |
| `scan` | Scanner | `scan/ScanStation.tsx` (1,378 lines) | Inline |
| `alerts` | Alertes | `batches/AlertsDashboard.tsx` | 3 tabs |
| `receptions` | Réception | `reception/ReceptionDashboardV2.tsx` | Travail du jour, Contrôle QC, Registre, Bon BRA, Tablette, Alertes |
| `storage` | Stock | `batches/StorageZonesOverview.tsx` (2,021 lines) | Tableau de bord, Lots, Zones, Mouvements, Conditions, Gestion |
| `production` | Production | Tabs defined in `pages/Index.tsx` | Phase 2, Vue d'ensemble, Flux, Ordres de fabrication |
| | | Phase 2 (`phase2/Phase2Dashboard.tsx`) | Pipeline, Fumigation, Nettoyage, Hydratation, Triage, Alertes |
| | | Flux (`production/ProductionFluxDashboard.tsx`) | Flux F1–F8, Bilan matière, HACCP, KPI |
| `packaging` | Conditionnement | `packaging/PackagingDashboard.tsx` | Ordres, Nomenclatures, Étiquettes, Palettes |
| `logistics` | Expédition | `logistics/LogisticsDashboard.tsx` | Expéditions, BDE, Stock PF, Transport live, Conformité export, Mock recall |
| `quality` | Qualité | `quality/QualityDashboard.tsx` | CAPA, Journal d'audit |
| `export` | Export | `export/ExportDashboard.tsx` | 3 tabs |
| `purchasing` | Achats | `purchasing/PurchasingDashboard.tsx` | Requisitions, orders, RFQ, receipts and others |
| `suppliers` | Fournisseurs | `mes/SuppliersList.tsx` | Detail sheet with 9 tabs |
| `materials` | Articles | `mes/MaterialsList.tsx` | None |
| `customers` | Not in the sidebar | `customers/CustomersDashboard.tsx` | Unverified |
| `maintenance` | Not in the sidebar | `maintenance/MaintenanceDashboard.tsx` | Unverified |
| `hr` | RH | `employees/HRDashboard.tsx` | 2 tabs |
| `analytics` | Analytics | `analytics/AnalyticsDashboard.tsx` | 5 tabs, then 9 in the founder view |
| `sage-operations` | Cockpit | `home/SageOperationsHub.tsx` | Includes recall drill and golden thread panels |
| `settings` | Paramètres | `settings/SettingsDashboard.tsx` | 13 tabs |

`customers` and `maintenance` have no sidebar entry, yet they are primary tabs for maintenance and commercial roles. Home has no tile for them either. On desktop, a maintenance technician reaches their own screen only through the command palette or a direct link (finding C13).

### Routes outside the tab shell

| Route | Purpose | Note |
|---|---|---|
| `/auth` | Sign-in | |
| `/passport/:lotId` | Public lot passport | |
| `/portail` | Supplier portal | |
| `/alerts` | `pages/AlertsCenter.tsx` | A second alert centre, separate from the `alerts` tab |
| `/dashboard` | Renders `Index` under another URL | Linked once, from `TopHeader.tsx:240` |

### Size signals

246 component `.tsx` files, 81 using a dialog or sheet, and 24 using tabs.

## B. Current employee workflows by role

The code defines 28 workspace profiles. They group as follows. "Direct tabs" are the profile's primary tabs without Accueil. `getAccessibleTabs` also gives every role `live` and `scan`.

| Group | Roles | Direct tabs | Station device named in the profile |
|---|---|---|---|
| Reception | `operateur_reception`, `chef_reception`, `responsable_reception` | Réception, Alertes, and Stock for leads | Tablet, or tablet and PC |
| Quality | `inspecteur_qualite`, `responsable_qualite`, `resp_management_qualite`, `resp_qualite_haccp` | Réception, Alertes, Qualité, and Stock for one lead | Field tablet, web |
| Line operators | `operateur_nettoyage`, `operateur_fumigation`, `operateur_triage_ia` | Production, Alertes | Touch terminal, control post, large screen |
| Packaging | `operateur_conditionnement`, `operateur_emballage` | Conditionnement, Alertes | Touch terminal |
| Stock | `magasinier_wms`, `responsable_stock` | Stock, Alertes, and Achats for the lead | Mobile RF reader |
| Logistics | `responsable_logistique` | Expédition, Export, Stock, Alertes | PC |
| Purchasing and sales | `responsable_achats`, `directeur_achat`, `technico_commercial` | Achats, Fournisseurs, Articles, Export, Clients | PC |
| Maintenance | `responsable_maintenance`, `technicien_maintenance` | Maintenance, Alertes | Mobile, tablet |
| Management | `directeur_usine`, `directeur_general`, `responsable_production` | Broad | Web |
| Admin and audit | `administrateur_systeme`, `auditeur_externe` | All, or read-only | Web |
| External | `fournisseur_externe`, `client_externe`, `partenaire_client_export` | One portal tab | Web |

Current paths for the daily jobs:

| Job | Path today |
|---|---|
| Register a delivery | Accueil → Réception → open wizard → Arrivée camion → Pesée → Produit & contrôle → Lots & validation |
| Inspect a lot | Accueil → QC task → pick the reception → workspace → QC dialog → decision → PIN when accepting |
| Run fumigation | Accueil → Production → Phase 2 → Fumigation → new cycle |
| Sort a lot | Accueil → Production → Phase 2 → Triage |
| Run a production order | Accueil → Production → Ordres de fabrication → order. **Broken**, see D27 and D28 in the audit |
| Move stock | Accueil → Scan, or Stock → Mouvements |
| Seal a pallet | Accueil → Conditionnement → Palettes → Sceller, or through the packaging order dialog |
| Ship | Accueil → Expédition → shipment → Marquer prêt → Expédié |

## C. Duplication and complexity findings

| # | Finding | Evidence | Effect on the employee |
|---|---|---|---|
| C1 | Home shows work the user cannot do. Task rows filter by tab, not by action. | `HomePage.tsx:107` | A reception operator can see "contrôles QC à faire" although `canRunQc` hides that tab inside Réception. |
| C2 | The word "Phase 2" is the first production tab. | `pages/Index.tsx:383` | An internal project name is the operator's main label. |
| C3 | Production has four top-level views, and "Phase 2" and "Flux" each open six or four more. | `pages/Index.tsx:377-406` | Line operators land on a dashboard built for several jobs. |
| C4 | Five alert surfaces. | `alerts` tab, `/alerts`, Réception Alertes, Phase 2 Alertes, and notifications | An alert can be seen in one place and missed in another. |
| C5 | Quality work is split. Inspections sit under Réception, while the Qualité tab holds only CAPA and the audit journal. | `QualityDashboard.tsx:25-26`, `ReceptionDashboardV2.tsx:363` | "Qualité" does not lead to inspections. |
| C6 | Two reception entry forms. The wizard has 38 form controls and the Tablette tab has 22. | `ReceptionWizard.tsx`, `ReceptionTabletOperatorScreen.tsx` | Two ways to do one job, and training must cover both. |
| C7 | Two ways to seal a pallet. | `PackagingOrderDialog.tsx:326`, `PalettePanel.tsx:135` | Same action from two screens. |
| C8 | Recall appears in Logistics as "Mock recall" and again in Cockpit. | `LogisticsDashboard.tsx:1018`, `SageOperationsHub.tsx` | Mixed English label and two entry points. |
| C9 | Technical labels: Live, Cockpit, Analytics, Flux, Mock recall. | Sidebar and tab labels | Not manufacturing vocabulary. |
| C10 | Six navigation systems, listed in section A. | Section A | The same destination is reached differently by device. |
| C11 | No-role fallback shows Réception, Production and Alertes. | `roleAccess.ts:371-379` | A user with no recognised role sees operating screens. Phase 1 must fail closed. |
| C13 | Maintenance and customers are missing from the sidebar. | `AppSidebar.tsx:92-128`, `roleAccess.ts:245-262` | Maintenance staff have no visible desktop route to their main screen. |
| C12 | Dead code. No importer outside its own folder: `components/stock/*` (9 files, 1,965 lines). No `.tsx` importer: `TasksManagement`, `TimesheetManagement`. No importer found: `NavLink.tsx`, `BonReceptionAchatPrint.tsx`. | Import search | Maintenance cost. Some of the 218 client type errors are in these files. |

## D. Proposed simplified navigation

Keep every `AppTab` id and deep link. Only the presentation changes.

**One rule per device.** Station devices show a bottom bar with at most four items: Mon travail, Scanner, Alertes, Plus. Desktop keeps the sidebar, reduced to the employee's work areas. The command palette stays for office users. `FlowStepper` becomes a read-only progress display on lot screens rather than a navigation system.

| Work area | French label | Contains | Replaces |
|---|---|---|---|
| Reception | Réception | Travail du jour, new delivery, registre, BRA | Current Réception without QC and alert tabs |
| Quality | Qualité | Inspections to do, decisions, non-conformités, CAPA, audit journal | Quality tab plus the QC tab inside Réception |
| Production | Production | Ordres de fabrication, Fumigation, Nettoyage, Hydratation, Triage | Phase 2 and Ordres |
| Stock | Stock | Lots, emplacements, mouvements, conditions | Current Stock |
| Packaging and dispatch | Conditionnement, Expédition | Orders, pallets, labels, shipments, BDE | Current tabs, unchanged as tabs |
| Management | Direction | Indicateurs, approvals, traceability, recall exercise, settings | Live, Cockpit, Analytics |

The groups come from the role profiles in section B. A user with several roles sees the union, as `getRoleWorkspaceProfile` already does. These are interface groups, not new domain entities.

Label changes, French only:

| Today | Proposed |
|---|---|
| Phase 2 | Remove: show the stage names directly |
| Live | Atelier en direct |
| Cockpit | Pilotage usine |
| Analytics | Indicateurs |
| Mock recall | Exercice de rappel |
| Flux | Lignes de production |
| Condit. | Conditionnement |

Accents are also missing from some existing labels, for example `Expeditions` and `Conformite export`. Fix them when those files are edited.

## E. Role-based workspace designs

### Home: Mon travail

Keep the current `HomePage` structure, which is already task-first, and change what feeds it:

1. **Task rows filter by action as well as tab.** Reuse `getReceptionPermissions` and `canPerformAction`. This fixes C1.
2. **Each row opens the work itself:** the list filtered to that job, or the record when there is only one.
3. **The first screen shows at most three things:** tasks, the scan or lot search, and alerts for that role.
4. **Post tiles appear only when a role has more than one work area.** A fumigation operator does not need a grid with one tile.

### Station screens

| Station | First screen | Primary action | Scan use |
|---|---|---|---|
| Reception operator | Trucks expected and receptions in progress | Nouvelle réception | Search by PO or notice |
| QC inspector | Lots waiting for inspection, oldest first | Commencer le contrôle | Scan the lot to open it |
| Fumigation | Cycles running, then lots waiting | Démarrer un cycle | Scan the lot to select it |
| Cleaning, hydration, triage | Lots waiting at this stage | Commencer | Scan the lot to select it |
| Production lead | Ordres de fabrication by status | Next valid action on the order | Scan a lot to allocate it |
| Packaging | Open orders and open pallets | Next valid action | Scan the source lot |
| Warehouse | Moves to do and lots to place | Déplacer un lot | Scan lot, then location |
| Dispatch | Shipments to prepare | Préparer | Scan pallets while picking |

The rule for every station: show the current record, the one next valid action in a large button, and secondary actions in a menu. The server's state machine decides what is valid. The UI never invents a transition.

Stage screens are selected by role. An operator with `fumigation_monitoring` opens directly on Fumigation. Other stages stay reachable when their role allows them.

## F. Screen keep, merge and remove decisions

| Screen | Decision | Reason |
|---|---|---|
| `HomePage` | SIMPLIFY | Filter by action, see section E |
| `LotJourneyHub` | KEEP | Lot lookup on home |
| `ScanStation` | KEEP | Fast lot access; split later only when a phase edits it for a reason |
| `FactoryCommandCenter` (Live) | MERGE into Direction | Supervision view, not station work. All roles reach it today, and it should move only after a role check confirms who needs it |
| `SageOperationsHub` (Cockpit) | MERGE into Direction | Same audience as Indicateurs |
| `AlertsDashboard`, `AlertsCenter`, `FactoryAlertsCenter`, `reception/AlertsPanel`, `Phase2AlertsPanel` | MERGE | One list with a work-area filter. Keep sub-tab deep links as filtered views |
| `ReceptionDashboardV2` | SIMPLIFY | Move QC and Alertes out; keep Travail du jour, Registre, BRA |
| `ReceptionWizard` | KEEP, review fields | Already guided: four steps, with safety-relevant fields |
| `ReceptionTabletOperatorScreen` | Decide in Phase 2 | Merge only after comparing it field by field with the wizard |
| `QCInspectionDialog` | REDESIGN | Becomes a Quality page, not a 1,334-line dialog |
| `ProductionDashboard` | MERGE | Summary becomes part of Direction or the order list |
| `ProductionFluxDashboard` | Decide with D-7 below | Relationship to orders is undefined |
| `Phase2Dashboard` | REDESIGN | Stage screens stay; "Phase 2" wrapper and label go |
| `ProductionOrdersList`, `ProductionOrderDetail` | REPLACE client path | Fix D27 and D28 first |
| `StorageZonesOverview` | SIMPLIFY | Default to Lots for operators; dashboard for leads |
| `PackagingDashboard` | SIMPLIFY | One way to seal a pallet |
| `LogisticsDashboard` | SIMPLIFY | Shipments first; move Exercice de rappel to Direction |
| `QualityDashboard` | MERGE | Absorbs inspections |
| Purchasing, suppliers, materials, customers, export | KEEP | Office work. Not the first target of this simplification |
| `MaintenanceDashboard` | KEEP | Add the missing sidebar entry (C13) |
| `HRDashboard` | KEEP | |
| `SettingsDashboard` | KEEP | Admin only; 13 tabs are acceptable there |
| `/dashboard` route | REMOVE | Point the header at `/` |
| `/alerts` route | REDIRECT | To the merged alert list |
| `components/stock/*` | REMOVE | Dead, after a build proves nothing resolves to it |
| `TasksManagement`, `TimesheetManagement`, `NavLink`, `BonReceptionAchatPrint` | REMOVE after check | Confirm no barrel export is used |

### Open product decisions

| ID | Question | Why it blocks | Proposed default |
|---|---|---|---|
| D-7 | What are Flux runs and production lines relative to orders and stage screens? | Three production paths exist. Merging them could lose records | Keep all data and hide Flux from line operators until decided |
| D-8 | Is tablet reception used differently from the wizard? | Removing it could slow a real station | Keep both until a floor check |
| D-9 | Which device is really at each station? | Profile labels may be aspirational, such as "Lecteur mobile RF" | Design for tablet first |

## G. Current and proposed interaction counts

**Method:** taps from Accueil to the screen where the work starts, counted from the code. Field entry and confirmation steps are excluded, because they are safety-relevant and stay. "Proposed" is a design target, not a result.

| Job | Current path | Taps now | Target | Change |
|---|---|---|---|---|
| Register a delivery | Réception, open wizard | 2 | 1 | Home action opens it |
| Inspect a lot | QC task, pick the reception | 2 | 2 | Same taps, clearer destination |
| Start fumigation cycle | Production, then Fumigation | 2 | 1 | Role opens the stage directly |
| Sort a lot | Production, Triage | 2 | 1 | Role opens the stage directly |
| Open a production order | Production, Ordres, order | 3 | 2 | Orders become the lead's first view |
| Seal a pallet | Conditionnement, Palettes, Sceller | 3 | 2 | Open pallets on the first view |
| Prepare a shipment | Expédition, shipment | 2 | 2 | No change |
| Move a lot by scan | Scan | 1 | 1 | No change |

Most gains are one tap. The larger gain is less for an employee to read and fewer wrong turns, and tap counts do not capture that.

No percentage claim is made. Phase 9 replaces this table with counts from Playwright journeys. Time-on-task needs real employees and will stay unmeasured until UAT.

## H. Required manufacturing forms and controls

These stay however the screens change. Exact required fields come from the server validators and `receptionWizardValidation.ts`. Phase 4 lists them per rule.

| Workflow | Must remain |
|---|---|
| Reception | Supplier, vehicle, gross and tare weights with their source, product, route, lot creation |
| Weighing | Instrument reading kept apart from manual entry, and the method recorded |
| QC | Empty instrument readings by default, recorded decision, PIN for approval, reason for quarantine or rejection |
| Fumigation | CCP evidence, cycle times, operator, and mandatory stage on `PREMIUM_WHOLE` |
| Cold storage | Location, capacity check, conditions |
| Triage | Grade split and quantities |
| Production | Allocated lots and kilos, output, waste, mass balance |
| Packaging | Source lot, weights, pallet seal, label, GS1 data |
| Expedition | Picked lots and quantities, gate result, `requestId` for replay safety |
| Recall | Passport and genealogy from one query, `buildLotTraceabilityDossier` |

Every number shows its unit. Every screen that writes data has a visible loading, success and error state.

## I. Responsive behaviour

| Width | Layout |
|---|---|
| Under 768 px | Bottom bar, single column, sticky primary action |
| 768 to 1279 px | Bottom bar or collapsed rail, two columns where a list and record sit together |
| 1280 px and over | Sidebar, list and detail side by side |

- Keep the existing 44 px default button height. Primary station actions use `lg`.
- Header buttons at `h-8` (`TopHeader.tsx`) are below that target on station screens. Change them through shared defaults, not per file.
- Tables become cards under 768 px, with lot, status and next action first.
- Scanner input stays focused on scan screens, and Enter submits.
- Connectivity state remains visible through `OfflineSyncStatus`.
- A primary action disables itself while its request runs. The server stays the real protection against double submission.

## J. Permission and safety preservation

- The UI never grants access. Phase 1's server guards are the enforcement. `roleAccess.ts` only decides what to display.
- Grouping changes no role's server permissions. Hiding a tab removes no permission.
- A merged screen keeps each action's own server call and checks. Two operations are never combined into one write to save a tap.
- The golden thread stays: `SUPPLIER_INTAKE → WEIGHED → QC_DECIDED → COLD_STORE → FUMIGATION_CCP → TRIAGE → PACKED → SHIPPED`, with both routes.
- No default value for a measurement. No automatic approval. Safety approvals stay online-only.
- Safety warnings and gate refusals stay visible on the merged screens, in French, with what to do next.
- Offline work stays limited to reception intake.

## K. Migration plan for frontend consumers

1. **Phase 1:** make the no-role fallback fail closed. Keep `AppTab` ids.
2. **Phase 2:** fix production hooks first, then redesign the order screen, and rename "Phase 2" to stage names. Add action filtering to home.
3. **Phase 5, navigation:** build one work-area map from `roleAccess.ts`, and have the sidebar and bottom bar read it. Keep `resolveTab` and legacy ids so notifications and deep links still work.
4. **Phase 5, merges, one per commit:** alerts, then quality, then direction. Each keeps the old deep link as a redirect or filtered view.
5. **Phase 5, removal:** delete confirmed dead code after the client type-check shows no reference.
6. **Phase 7:** polish responsive behaviour, accessibility and French copy.
7. **Tests:** update the tests that exist for each screen in the same commit, and add a Playwright journey in Phase 9.

The existing rule still applies: change shared `ui/*` defaults rather than overriding each file.

## L. Acceptance criteria

- Each role in section B lands on a home that shows only actions it can perform.
- A test asserts that the reception operator sees no QC task.
- No screen shows "Phase 2", "Mock recall", "Cockpit" or "Live" to an operator.
- One alert list exists, and the old entry points lead to it.
- One path exists for each job in section B, except those held by D-7 and D-8.
- All deep links in `resolveTab` and notifications still resolve.
- The authorization matrix test still passes after every navigation change.
- Every job in section G has a Playwright journey that records its measured tap count.
- Every journey passes at 375 px, 768 px and 1280 px.
- Axe finds no serious or critical issue on station screens.
- UAT with real employees covers each role group, and results are recorded. This is the only evidence that the design works on the floor.
