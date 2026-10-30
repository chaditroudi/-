# Architecture — Date Harvest Hub (as implemented)

Snapshot date: 2026-09-27. This describes the code in the repository, not a target design.

## Stack

- Frontend: React 18, TypeScript, Vite, Tailwind, shadcn/ui, Redux Toolkit (RTK Query), TanStack Query, react-i18next (`fr`, `en`, `ar`), HashRouter.
- Backend: NestJS 11 on Express. Source is `server/src`. Runtime served in dev from the watch compile (`scripts/dev-full.js` / `scripts/server-watch.js`). `server-dist/` is compiled output.
- Database: MongoDB via Mongoose. Most business documents use dynamic collection models (`getCollectionModel`), not one schema file per entity.
- Auth: JWT. Roles and aliases live in `server/src/middleware/authorization.ts`.

## How a request moves

1. `server/src/index.ts` boots Nest, listens, then connects Mongo, ensures trust indexes, and seeds.
2. `server/src/nest/app.module.ts` imports the domain modules.
3. Route guards and metadata (`server/src/nest/route-guards.ts`, `route-metadata.ts`) enforce server-side authorization.
4. Services write Mongo collections and, where wired, call `publishRealtimeDbChange`.
5. `server/src/modules/realtime/realtime.bus.ts` fans the change out as SSE on `/api/realtime/events`.
6. The browser (`src/hooks/useBackendRealtimeSync.ts`, `src/lib/sseClient.ts`) invalidates RTK Query tags. A second listener (`useRealtimeNotifications`) covers notification rows.

The UI is not a page-per-module router. `src/App.tsx` mounts a few routes (`/`, `/dashboard`, `/alerts`, `/portail`, `/passport/:lotId`). Station work lives inside `Index` as tabs and views.

## Golden thread

Canonical lot progress is the hash-chained ledger `lot_events`, not the screen that last displayed the lot.

Stages (`server/src/modules/trust/lot-state-machine.ts`):

`SUPPLIER_INTAKE → WEIGHED → QC_DECIDED → COLD_STORE → FUMIGATION_CCP → TRIAGE → PACKED → SHIPPED`

Two built-in manufacturing routes:

| Route | When it is used | Fumigation before triage and pack |
|---|---|---|
| `PREMIUM_WHOLE` | Default. Deglet Nour premium whole. | Required |
| `GENERIC` | Only when reception explicitly selects it | Not a software prerequisite |

The route is stamped on the first ledger event and on `receptions_v2` / `reception_lots.manufacturing_route`. Later stages cannot downgrade `PREMIUM_WHOLE` to `GENERIC`. Variety never selects the route.

Shipment close (`gate-rules.service.ts`) requires a CCP certificate when the lot route requires fumigation, unless the shipment document sets `requires_ccp` explicitly.

## Domain modules

Registered in `AppModule`: trust, weighbridge, CCP sensors, costing, settlement, ATP, AI employee guide, auth, BRA, BDE, export, customers, realtime, analytics, collections, notifications, phase 2 (fumigation / cleaning / hydration / triage), packaging, P2P, purchasing, receptions, storage, suppliers, RPC, settings, audit, materials, stock, batches, flux, production, receptions-ext, material receptions, HR, maintenance, transport, quality-ext, document prints.

## Persistence patterns that matter

- Reception intake: `receptions_v2`, `reception_lots`, `reception_units`, then stock projection (`reception-stock-sync.ts`) and ledger stage `SUPPLIER_INTAKE`.
- Idempotency: unique `client_request_id` on receptions; unique `scope+key` on `idempotency_commands`; unique weighbridge `reading_key`; unique lot `lot_id+sequence`.
- Offline: IndexedDB outbox (`src/lib/offline/outbox.ts`) queues `reception_intake` only. Replay uses the same client request id. QC release, stock release, and shipment close are not queued offline.
- Trust gates default to warn (`TRUST_SCAN_GATE`, `TRUST_CCP_GATE`, `TRUST_STAGE_GATE`, `TRUST_MASS_BALANCE_GATE`). Enforce mode rethrows after a `GATE_BLOCKED` ledger event.

## What is not a second engine

Stock reorder drafts (`stock-reorder.service.ts`) read real `stock_lots`, not `materials.current_stock`. Purchase requisitions stay `DRAFT` until a person submits them.

GS1 SSCC helpers exist. The company prefix defaults to placeholder `09999999`. Sealing a palette with that prefix stores `sscc: null` and `sscc_status: NON_PRODUCTION_PLACEHOLDER`. A real prefix is stored only when Settings or `GS1_COMPANY_PREFIX` supplies 7–10 digits that are not the placeholder, and a duplicate SSCC is rejected.

## Plant boundary

No `tenant_id` exists in `server/src`. The database is one plant. Isolation is by role (`server/src/middleware/authorization.ts`), not by tenant. There is no Tenant A / Tenant B to test.

## Consistency without multi-document transactions

The codebase does not open Mongo sessions. Packaging consumption, storage moves, and expedition picks validate first, write the documents, and restore the previous quantities if a later write throws. A repeated packaging `client_request_id` returns the existing order only when its consumption movement is already stored. A repeated expedition `requestId` returns the existing shipment only when every line already has its movement.

## Genealogy

There is one dossier query, `buildLotTraceabilityDossier`, and one graph, `buildGenealogyFromDossier`. Recall uses that same pair. There is no second genealogy collection.

A two-lot merge is stored as:

- `production_lot_allocations.lot_id` and `allocated_kg` / `consumed_kg` (written by `ProductionService`)
- `production_output_lots.parent_lot_ids` and `parent_lots_snapshot` (the shape recorded with the finished lot)
- `packaging_orders.source_lot_number` and `packaging_palettes.order_id`
- finished stock `source_lot_internal` after palette seal
- `stock_movements` with `document_type` `SHIPMENT` and `document_reference` set to the shipment id

The dossier loads every parent id on the output snapshot, follows `lot_id` allocations, and continues from the output lot number to packaging, palettes, and shipments. A shipment number or id with no lot match is resolved through those expedition movements, then through the finished lot's `source_lot_internal`.

The graph keeps every reception lot as a node and draws an edge from each allocated parent, including parents that exist only on `parent_lots_snapshot`. Palette edges use `order_id` when `packaging_order_id` is absent.

Triage close remains a single parent (`parent_lot_number`). Production completion stores explicit `waste_kg`. The closed check is the existing mass-balance helper (`input = output + waste`, default tolerance 2% unless settings or `TRUST_MASS_BALANCE_TOLERANCE_PCT` say otherwise). Production allocate, start, and complete do not take a request id.
