# Phase 3 — Gate 2: Stock & lot integrity

**Date:** 1 November 2026  
**Branch:** `fix/supplier-simplify`  
**Audit verdict (start):** PARTIAL  
**Implementation verdict:** **PASS** (with residual risks below)

## Exit criteria evidence

| Requirement | Status | Evidence |
|---|---|---|
| No unsupported freeform qty-changing endpoint | PASS | `POST /api/stock/movements` → `STOCK_MOVEMENT_DOMAIN_ONLY` |
| Atomic stock consumption | PASS | Shared `stock-quantity.ts` CAS used by production, packaging, expedition, triage, adjustments |
| Duplicate requests cannot duplicate stock effects | PASS | Packaging `client_request_id`, expedition `requestId`, triage/production/seal claim + replay |
| Triage consumes valid source quantities | PASS | `closeTriageSession` CAS-consumes parent MP before WIP mint |
| Manufacturing creates linked outputs | PASS | Production complete mints `source_stage=PRODUCTION` lot once; seal mints PF with `packaging_palette_id` |
| Packaging / shipping quantity consistency | PASS | Packaging CAS consume; shipment close checks picks + line quantities |
| QC restrictions remain enforced | PASS | Packaging/expedition still reject QUARANTINE/HOLD; orphan quarantine insert blocked |
| Mass balance enforced at domain boundaries | PASS | Triage / packaging close / production complete call `mode: "enforce"` |
| Multi-document partial failure safety | PASS | Packaging/expedition/triage/seal rollback paths; prod uses `runInTransaction` where replica set available |
| Existing discrepancies identifiable | PASS | `GET /api/stock/diagnostics` read-only findings |
| End-to-end manufacturing stock tests | PASS | `stock-integrity.gate2.test.ts` + genealogy synthetic + expedition/packaging/production suites |
| Typecheck / focused tests green | PASS | Server tsc + focused Gate 2 vitest files |

## P0 locks preserved

| Lock | Status |
|---|---|
| Freeform movements blocked | Preserved |
| Shipping without expedition picks blocked | Strengthened (`shipment-integrity.ts`) |
| Orphan quarantine qty creation blocked | Preserved |
| Lot suggestions read-only | Preserved |

## Implementation changelog (Gate 2 completion)

### Stage 1 — Atomic quantity
- Added `server/src/modules/stock/stock-quantity.ts` (CAS compare-and-set).
- Wired production, packaging createOrder, expedition picks through CAS.
- In-memory test matcher gained `$nin` support for conditional updates.

### Stage 2 — Manufacturing I/O
- Triage close consumes parent stock lot; graded WIP created as `VALIDATED` (triage decision = release for packaging streams); REJETE not stocked.
- Production complete creates linked output stock once (`production_order_id`).
- Palette seal no longer swallows stock sync failures; rolls back `SCELLE` if PF lot/movement commit fails; idempotent replay when FG exists.

### Stage 3 — Mass balance
- Domain boundaries (triage close, packaging close, production complete) enforce closed mass balance regardless of env default warn.

### Stage 4 — Idempotency / races
- Triage session claim + replay.
- Production complete early-return when already completed + output uniqueness by `production_order_id`.
- Seal claim + FG uniqueness by palette id.
- Existing packaging/expedition request ids retained.

### Stage 5 — Shipment / pallet integrity
- Expedition movements now persist `shipment_id`.
- `assertShipmentReadyToShip` verifies shipment state, pick presence, shipment match, and line quantity coverage.
- Cancel blocked after shipped.

### Stage 6 — Corrections / holds
- `POST /api/stock/inventory-counts` with `apply_adjustment` and `POST /api/stock/adjustments` apply CAS deltas + audit movements.
- `POST /api/stock/holds` applies/releases HOLD with optional genealogy propagation.

### Stage 7 — Diagnostics
- `GET /api/stock/diagnostics` read-only report (negative qty, sealed-without-stock, triage parent not consumed, duplicate palette FG, multi stock-per-reception info).

### Stage 8 — Acceptance tests
- `stock-quantity.test.ts`
- `stock-integrity.gate2.test.ts` (journey + adjustment/hold + production output)
- Extended expedition shipment integrity tests
- Existing packaging / phase2 / genealogy suites remain green

## Residual risks (do not block Gate 2 PASS)

1. **Historical data** may still contain pre-fix triage closes without parent consumption — diagnostics surface them; no silent rewrite.
2. **Standalone MongoDB** (non replica-set) still cannot offer multi-document transactions; production refuses, development warns via `runInTransaction`.
3. **Hold genealogy propagation** depends on dossier/genealogy coverage; incomplete trees hold the root lot and best-effort linked stock only.
4. **Multi-tenant isolation** is Gate 3 — not claimed here.
5. Env `TRUST_MASS_BALANCE_GATE=warn` no longer softens triage/packaging/production domain closes (hard `enforce` at those call sites).

## Verdict

**Gate 2: PASS**
