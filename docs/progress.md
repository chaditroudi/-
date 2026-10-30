# Progress

## 2026-10-30 — Phase 0: preserve and baseline

- Backup outside the repo, then 13 themed commits on `stabilize/baseline`.
- `truncate-for-testing`: embedded URI removed, no default target, dry run by default, remote needs `--i-know` and `--confirm-db`.
- `ensure-super-admin`: hardcoded password removed; `SUPER_ADMIN_PASSWORD` required. `ensure-super-admin` and `seed-test-actors` use the same guard.
- `server-dist` untracked. `.env.production` ignored. `engines`, `.nvmrc`, `typecheck` scripts added.
- Fixed 5 failing tests, the `printRQC` lint error, and the test timeout. CI workflow added; deploy depends on it and uses Node 22.

### Verification

| Command | Result |
|---|---|
| `npx vitest run` | 68 files, 329 of 329 passed |
| `npx tsc --noEmit -p server/tsconfig.json` | Pass |
| `npx tsc --noEmit -p tsconfig.app.json` | Fail, 218 errors (known; Phase 5) |
| `npx eslint .` | 0 errors, 1,006 warnings |
| `npm run build` | Pass |

### Blocked on the operator

Credential rotation, Atlas access review, repo visibility, and removing `.env` from `gh-pages`. CI has not run on GitHub, because nothing has been pushed.

## 2026-09-27 — Manufacturing route stickiness

### Completed

- Investigated the NestJS module map, golden-thread state machine, SSE bus, reception outbox, and the standards that could be checked from public texts.
- Stopped hard-coding `PREMIUM_WHOLE` as the effective route after intake.
- Reception stores `manufacturing_route` and stamps it on the ledger.
- Later stage recording prefers the chain, then the lot field, then the caller.
- Shipment CCP requirement follows the lot route unless the shipment sets `requires_ccp`.
- Reception wizard step 3 exposes the two routes. Default remains premium.
- Wrote `docs/architecture.md`, `docs/standards-matrix.md`, `docs/gap-analysis.md`, `docs/industrial-audit.md`, `docs/implementation-roadmap.md`, `docs/validation-report.md`.

### Files modified

- `server/src/modules/trust/lot-state-machine.ts`
- `server/src/modules/trust/lot-state-machine.test.ts`
- `server/src/modules/trust/lot-lifecycle.service.ts`
- `server/src/modules/trust/gate-rules.service.ts`
- `server/src/modules/receptions/receptions.service.ts`
- `src/components/reception/ReceptionWizard.tsx`

### Tests

`npx vitest run` on:

- `server/src/modules/trust/lot-state-machine.test.ts`
- `server/src/modules/trust/lot-lifecycle.service.test.ts`
- `server/src/modules/trust/gate-rules.service.test.ts`
- `server/src/modules/trust/gate-rules.test.ts`
- `server/src/modules/receptions/receptions.service.test.ts`
- `server/src/modules/trust/lot-passport.test.ts`

Result: 6 files, 27 tests, all passed.

### Also completed

- Packaging `createOrder` checks triage stock before inserting the order.
- If the stock write fails after the insert, the lot quantity is restored and the order is deleted.
- Threshold reorder remains non-blocking.
- Tests: insufficient stock leaves no order; a covered weight writes the order and a `CONSOMMATION` movement. `packaging.service.test.ts` and `packaging.service.mass-balance.test.ts`: 6 tests passed.

## 2026-09-27 — Packaging and storage fail-closed

### Completed

- Packaging `createOrder` refuses a missing triage lot, a non-released status, a non-positive weight, and an overweight request before inserting an order.
- Order, stock decrement, consumption movement, and `system_audit_logs` row are one unit: a failure restores the lot and deletes the order.
- The same `client_request_id` returns the existing order and does not consume twice. An order without its movement is not replayed as success.
- Threshold reorder remains after the invariant and does not roll the consumption back.
- Storage `moveStock` rejects a kilogram placement over `capacity_kg`, and restores both locations if the movement document cannot be written.
- Palette seal with prefix `09999999` stores no production SSCC (`NON_PRODUCTION_PLACEHOLDER`).
- QC lab humidity and defect `measured_value` are empty unless the inspector typed the lab field. Floor averages stay labeled as floor averages.
- Confirmed there is no `tenant_id`. The app is one plant with role checks.

### Files

- `server/src/modules/packaging/packaging.service.ts`
- `server/src/modules/packaging/packaging.service.test.ts`
- `server/src/modules/packaging/packaging.service.mass-balance.test.ts`
- `server/src/modules/storage/storage.service.ts`
- `server/src/modules/storage/storage.service.test.ts`
- `src/components/reception/QCInspectionDialog.tsx`
- `docs/architecture.md`
- `docs/gap-analysis.md`
- `docs/validation-report.md`

### Tests

```sh
npx vitest run server/src/modules/packaging/packaging.service.test.ts server/src/modules/packaging/packaging.service.mass-balance.test.ts server/src/modules/storage/storage.service.test.ts
```

Result: 3 files, 15 tests, passed.

## 2026-09-27 — Expedition pick fail-closed

### Completed

- `POST /api/stock/expedition` plans the decrement before any write.
- A missing lot, a non-released status, a quantity of zero or below, and a quantity above `current_quantity` leave stock unchanged.
- Lines that share a lot are added together before the comparison.
- Released statuses match packaging: `RELEASED`, `VALIDATED`, `STOCK_LIBERE`, `LIBERE`.
- If the shipment update fails after the lot is reduced, the previous quantity and status are restored and the expedition movements are deleted.
- The realtime event is published only after that write succeeds.
- The same `requestId` returns the existing shipment and does not consume again. A partial set of movements is refused instead of being treated as success.

### Files

- `server/src/modules/stock/expedition-decrement.ts`
- `server/src/modules/stock/expedition-decrement.test.ts`
- `server/src/modules/stock/stock.controller.ts`
- `server/src/modules/stock/stock.controller.expedition.test.ts`

### Tests

```sh
npx vitest run server/src/modules/stock/expedition-decrement.test.ts server/src/modules/stock/stock.controller.expedition.test.ts
```

Result: 2 files, 7 tests, passed.

### Not done

- Mongo multi-document transactions. This deployment path does not use sessions.
- Inventory-adjustment decrements, if any remain outside expedition and packaging, were not re-tested. `stock_lots.current_quantity` decreases in packaging consumption and expedition.
- Recall scenario tests and SSE reconnect tests.
- Playwright. Reception step 3 was still not seen on screen.
- Arabic operator strings.
- Export certificate lifecycle (`requested` through `rejected`) as its own record.
- Any deploy or database migration.
- `npm run lint` and `npm run build` are not green. See the genealogy section.

## 2026-09-27 — Synthetic lot genealogy

### Scenario

Existing services, one in-memory store:

- Lot A `LOT-A` = 100 kg. Lot B `LOT-B` = 80 kg. Both `STOCK_LIBERE`.
- Production allocations consume 60 kg and 40 kg on start.
- Completion records output 95 kg and explicit `waste_kg` 5. Invariant: 60 + 40 = 95 + 5.
- The output row uses the existing `parent_lot_ids` and `parent_lots_snapshot` shape.
- Packaging consumes a released triage stock lot numbered `PF-GEN-001` for 95 kg (remaining 0). Palette net weight is 95 kg. Seal creates the finished-goods stock lot with `source_lot_internal` = that output number.
- Expedition ships 95 kg of that finished lot. Remaining 0.

### Trace

`buildLotTraceabilityDossier` then `buildGenealogyFromDossier`.

Forward from lot A and from lot B reaches the output, the pallet, and shipment `SHP-GEN-001`. Reverse from the shipment number reaches the pallet, the output, lot A, and lot B.

### Mass balance

- Transformation: consumed input 100 kg = output 95 kg + waste 5 kg. Variance 0. Remaining stock 40 kg and 40 kg.
- Packaging: 95 kg available = 95 kg packed + 0 kg remaining. Palette `net_weight_kg` is 95.
- Expedition: 95 kg before the pick = 95 kg shipped + 0 kg remaining.
- No quantity in the scenario went below zero. Comparisons are exact kilograms; no new tolerance was added. The existing production gate stayed at its configured percentage and this case was inside it (variance 0).

### Failures

- Completion with 50 kg output and 0 kg waste throws `MASS_BALANCE_UNBALANCED`, writes no output lot, and leaves the consumed quantities in place. `cancelOrder` on that in-progress order restores 100 kg and 80 kg. The genealogy has no output node.
- A palette insert that throws leaves no palette row and does not change the output lot. Both parents stay on the output.
- A shipment update that throws restores the finished lot and deletes the expedition movement. The shipment stays `PREPARED` and is not a genealogy node. The pallet, output, and both parents remain linked.

### Idempotency

- Packaging `client_request_id` `pkg-gen-1` returns the same order and does not consume twice.
- Expedition `requestId` `exp-gen-1` returns `replayed: true` and does not write a second movement.
- Production allocate, start, and complete have no request id. A second `startOrder` throws `INVALID_TRANSITION` and does not consume again. That is a rejection, not a replay API.

### Joins that were dropping parents

The dossier and graph already existed. These reads were incomplete for this chain:

- Allocations written by `ProductionService` use `lot_id`. The dossier only queried `reception_lot_id` and `lot.lot_internal`.
- The graph drew only the first reception lot, so the second parent never became a node.
- `parent_lots_snapshot` was stored and displayed, and was not an edge.
- Palettes are stored on `order_id`. The graph read `packaging_order_id` first.
- A search by a source lot did not continue through the output number to the packaging order, pallet, or shipment.
- Expedition links the shipment with `stock_movements.document_type = SHIPMENT` and `document_reference`. The dossier previously required `shipment_lines`. A shipment number is now resolved through that movement, then through `source_lot_internal`.

Triage close is still one parent (`parent_lot_number`). This scenario does not split a lot. It merges two reception lots through production allocations.

Production start records `consumed_kg` on the allocation and, on completion, `MASS_BALANCE_CHECKED` in `lot_events`. It does not write a `stock_movements` row. Packaging and expedition do.

### Files

- `server/src/modules/phase2/genealogy.synthetic.test.ts`
- `server/src/modules/phase2/traceability-dossier.ts`
- `server/src/modules/phase2/genealogy-builder.ts`
- `server/src/test/in-memory-collection.ts`

### Tests

```sh
npx vitest run server/src/modules/phase2/genealogy.synthetic.test.ts
```

Result: 1 file, 4 tests, passed.

```sh
npm test
```

Result: 59 files, 244 tests, passed, exit code 0. Duration about 98 seconds.

```sh
npm run lint
```

Result: exit code 1. ESLint reported 5 errors and 975 warnings. The errors are existing files: `collections.service.ts` (`no-useless-catch`), `realtime.bus.ts` and `ReceptionDashboardV2.tsx` (`no-empty`), `printRQC.ts` (`no-constant-condition`), `tailwind.config.ts` (`no-require-imports`). None are in the genealogy files.

```sh
npm run build
```

Result: exit code 2. `tsc -p server/tsconfig.json` stopped before the Vite build.

- `server/src/modules/stock/stock.controller.ts(594)`: expedition reorder argument is `unknown[]` where `string[]` is required.
- `server/src/modules/storage/storage.service.ts(1443)`: `conflict()` is called with 3 arguments; its type accepts 2.

Those two errors were cleared in the following pass. Staging and production readiness are not claimed.

## 2026-09-28 — Build-blocker types

### Stock controller

`existingLots` was cast to `Record<string, unknown>[]`, so `product_id` was `unknown`. `autoReorderOnStockChange` expects `Array<string | null | undefined>`. The rows are now typed as `ExpeditionLot`, which already declares `product_id` as `string | null`. The ids passed to reorder are the same fields as before.

### Storage conflict

`conflict()` accepted only code and message. `badRequest()` already accepted an optional `details` argument, and `AppError` already stores it. The kilogram-capacity call passes `{ capacityKg, occupiedKg, quantityKg }`. The signature now forwards that third argument. The capacity check, the error code, and the message are unchanged. Two-argument `conflict()` calls still omit details.

### Lint

Four of the five errors were no-ops: a catch that only rethrew, two empty catches that already ignored a failed close or `sessionStorage` write, and a `require()` in an ESM Tailwind config. Those were removed or commented without changing behavior.

`src/components/reception/printRQC.ts` line 137 is `rqc.conventionnel || true`. That condition is always true, so the printed year always appears. Removing `|| true` would hide the year when the lot is not marked conventional. That changes the printed report, so it was left in place.

### Commands

```sh
npm run build
```

Exit code 0. Server `tsc` completed, then Vite built in about 1 minute 37 seconds.

```sh
npm test
```

59 files, 244 tests, passed, exit code 0.

```sh
npm run lint
```

Exit code 1. 1 error, 975 warnings. The error is `printRQC.ts` `no-constant-condition`. The warnings are the existing `no-explicit-any` and hook warnings.

### Next exact action

Decide whether the RQC print should always show the year. Browser and staging checks are still not run.

## 2026-09-28 — AI Employee Guide

Assistance layer only. The MES remains authoritative for workflow, stock, QC, packaging, shipment, and genealogy. The LLM cannot write Mongo or bypass RBAC.

### Behaviour

- `POST /api/ai-guide/ask` is JWT-gated. Role, stage, and allowed actions come from `getRequestRoles` + `LotLifecycleService.getState`.
- Compact context only (default 2000 chars, last 4 history lines). Procedures, screen help, and errors are curated snippets.
- Intents: NEXT_STEP, EXPLAIN, HOW_TO, WHY_BLOCKED, CHECKLIST, NAVIGATE, GENERAL_HELP. Obvious phrases are classified without a model call.
- Provider interface (`disabled` default, `ollama` optional). Invalid JSON, timeout, or disabled AI uses deterministic fallback.
- Phase 1 action type is NAVIGATE only, and only to `/?tab=…` whitelist targets the user's roles may actually perform.
- Packer waiting on QC gets `WAITING_ON_QUALITY` and no executable QC button. “Release this lot” is refused as a mutation.
- Compact `AiGuide` sheet in the authenticated header. Language follows i18next (`ar`/`fr`/`en`), RTL for Arabic. Screen from `?tab=`, lot from `?lot=`.

### Tests

Focused: 3 files, 24 tests, passed.

```sh
npm test
```

62 files, 268 tests, passed (previous 59 / 244 plus 24 guide tests).

```sh
npm run build
```

Exit code 0.

```sh
npm run lint
```

Exit code 1. Same pre-existing `printRQC.ts` constant-condition error. 976 warnings.

Local Ollama is enabled via `.env` (`qwen2.5:7b`). That is a live phrasing layer, not a production LLM product: no staging, Phase 1 still cannot mutate stock, and `printRQC.ts` lint is unchanged.

