# Date Harvest Hub — full project audit

Date: 6 Nov 2026. Code: `main` at `1556ff0`. Method: reading the code, generated inventories (`scripts/docs/*`), and the test and CI runs of the same day.
Tags: **CODE** read in the source · **RUN** observed in a command or browser run · **INFERRED** reasoned, not checked · **UNKNOWN**.

## 1. Architecture

| Layer | Finding | Tag |
|---|---|---|
| Client | React 18 + TypeScript + Vite, Tailwind, shadcn/ui (Radix), HashRouter, React Query and RTK Query, i18next, PWA service worker (Workbox) | CODE |
| API | NestJS on Express (`server/src/app.ts`, `nest/app.module.ts`), 41 controllers, Mongoose | CODE |
| Database | MongoDB. A control database holds accounts; each factory has its own database chosen from `tenant_id` + `factory_id` | CODE |
| Realtime | Server-sent events opened with a single-use ticket (`POST /api/realtime/ticket`); events carry ids only | CODE |
| Offline | Reception drafts and an intake outbox in IndexedDB, bound to the owner and factory (`src/lib/offline/`) | CODE |
| Hosting | Client on GitHub Pages (deploy on push to `main` after CI); API built for Railway | CODE |
| Environments | `APP_ENV` = production, staging, live-dev, dev, test; test/dev refuse remote databases | CODE |

### Tenant isolation (CODE)
1. `factoryFromAccount` takes the factory only from the account (validated ids), never from the request.
2. `middleware/auth.ts` rejects a token whose factory differs from the account's.
3. `app.ts` wraps each signed-in request in `runWithFactory` and `adoptFactoryDatabase`.
4. `factoryConnection()` uses `mongoose.connection.useDb(<factory db>)`; `requireFactory()` throws 403 without context.
5. Database names are hashed and kept within 38 bytes for Atlas shared tiers (`factoryDatabaseName`, commit `64d5855`).

### Backend modules (CODE)
ai-guide, analytics, atp, audit, auth, batches, bon-expedition, bon-reception-achat, ccp-sensors, costing, customers, document-prints, export (coa, contracts, orders), flux, hr, maintenance, material-receptions, materials, notifications, p2p, packaging, phase2 (cleaning, fumigation, hydration, triage), production, purchasing, quality-ext, realtime, receptions + receptions-ext, rpc, settings, settlement, stock, storage, suppliers, transport-mgmt, trust (lot ledger, golden thread, passport, recall), weighbridge. Without controllers: collections, mail, org, workflow.

## 2. Client screens

Every screen is reached through `src/pages/Index.tsx` (`?tab=`), plus `/auth`, `/portail`, `/passport/:lotId`, `/alerts`, `/dashboard`, `*`. Full mapping: `DATE_HARVEST_ROUTE_ROLE_WORKFLOW_MATRIX.md`.

Largest screen files (lines, CODE): StorageZonesOverview 1971, QCInspectionDialog 1429, ScanStation 1385, TransportWorkspace 1358, LogisticsDashboard 1293, HRDashboard 1001, ExportDashboard 831, RequisitionsList 769, ReceptionDetailV2 767, PurchasingDashboard 746, LotTraceabilityDialog 738, PurchaseOrderDetail 736, BonExpeditionDialog 704, ProductionLinesPanel 616.

Baseline inventory (RUN, `feature-inventory.mjs`): 219 screen files, 646 field labels, 430 labelled buttons, 61 tabs, 57 dialog titles, 460 data-hook imports. Snapshot: `docs/evidence/tablet-first-ui/inventory-baseline-1556ff0.json`.

## 3. Shell and navigation (CODE)

- `AppSidebar` groups: Aujourd'hui (home, scan, alerts, live), Filière (reception, QC, stock, production, packaging, shipping), Bureau, Direction, settings. Floor roles see only the first Filière item and no Bureau.
- `WorkflowNavigation` is the phone bar: up to 4 tabs plus a "Plus" sheet, shown only **off home** and below `md`. On home a phone user has no bar.
- `RoleLanding` + `src/lib/roleLanding.ts` give one daily action per role. `HomePage` lists counts ("À faire aujourd'hui") from `useFactoryShellMetrics`, then `LotJourneyHub` and six post tiles. It is not a list of the worker's own tasks.
- `WorkPath` exists (used only in the QC dialog). `ModuleHero` is used in 3 places. No `WorkerHome` or station task card exists.

## 4. Design system (CODE)

- Tokens in `tailwind.config.ts` and `src/index.css`: palette scales palme, deglet, danger, djerid, pierre, datte; radii 3–6 px; Barlow / Barlow Semi Condensed self-hosted; Noto Sans Arabic from Google Fonts (not available offline).
- Button heights: default 40 px, sm 32 px, both 44 px under a coarse pointer (`pointer-coarse` variant).
- Branding settings override `--primary` / `--accent` at runtime; the default branding colour `#107754` differs from the CSS token `#0E5A4B`.
- A `.dark` block exists but no code switches it on.

## 5. Localization (CODE)

- i18next, one namespace, `fr` / `ar` / `en`; fallback `fr`; language kept in `localStorage.i18nextLng`; `dir` and `lang` set on `<html>`.
- `fr` and `ar` have 1,022 keys; `en` 967 (no `cleaning`).
- 30 of 261 component files and 3 of 7 pages use `t()`. Hardcoded French dominates stock, QC, scan, logistics, export, HR, purchasing, transport.
- `workerDarija.ts`: 16 Tunisian phrases used as tooltips in the QC dialog only. No dialect locales.
- Factory `default_language` exists in settings but nothing applies it.
- RTL: ~786 physical spacing/position classes vs ~45 logical ones; no `rtl:` variants. Layouts will not mirror correctly in Arabic.
- Formats: 194 hardcoded `fr-FR` / `fr-TN`; no shared locale-aware formatter.

## 6. Tests and delivery (RUN, 6 Nov 2026)

| Check | Result |
|---|---|
| `npm run typecheck` | server 0, client 0 |
| `npm run lint` | 0 errors, 1,021 warnings |
| `npm test` | 808 passed, 105 skipped (need a local replica set) |
| `npm run build` | passes (`MSYS_NO_PATHCONV=1` in Git Bash) |
| DB-backed tests on a local replica set | 873 passed before the CI fixes; the 9 failures then were fixed in `1556ff0` |
| `isolation.e2e.mjs` | 22/23 — **a supplier lists 2 supplier records** |
| `roles.e2e.mjs` | 270/275 — inspector nav lacks "Contrôle qualité"; mobile Scan missing for operator, inspector, production, storekeeper |
| `reception.e2e.mjs` | not run on `1556ff0` (skipped at the user's request) |
| GitHub deploy of `1556ff0` | success |

## 7. Top risks

| # | Risk | Severity | Tag |
|---|---|---|---|
| R1 | Supplier portal account sees another supplier's record | Data exposure | RUN |
| R2 | Arabic users get mirrored text but unmirrored layouts; most screens are French only | Usability, sales | CODE |
| R3 | Workers land on a counts page, not their task; phone users have no navigation on home | Adoption | CODE |
| R4 | Arabic font needs internet; factory Wi-Fi is unreliable | Usability | CODE |
| R5 | Very large screen files (up to 1,971 lines) make safe redesign slow and risky | Delivery | CODE |
| R6 | No staging environment; real-device and real-scale checks have never run | Go-live | CODE |
| R7 | Local dev uses Atlas with real data on :8080/:4000; scripts can reach it if misconfigured | Data safety | CODE |

## 8. What is not known

- How real employees use the current screens (no observation or UAT yet).
- Behaviour on the factory's actual tablets, scale and network.
- Whether the three Arabic dialect targets are wanted for every screen or only worker screens (default chosen: worker screens).
