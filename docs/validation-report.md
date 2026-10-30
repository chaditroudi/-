# Validation report — 2026-09-27

## What ran

Command:

```sh
npx vitest run server/src/modules/trust/lot-state-machine.test.ts server/src/modules/trust/lot-lifecycle.service.test.ts server/src/modules/trust/gate-rules.service.test.ts server/src/modules/trust/gate-rules.test.ts server/src/modules/receptions/receptions.service.test.ts server/src/modules/trust/lot-passport.test.ts
```

Result: 6 files passed, 27 tests passed, exit code 0. Duration about 10 seconds. Vitest 3.2.4.

Covered by those tests:

- Premium route still blocks triage before fumigation.
- `GENERIC` allows triage after QC.
- A chain stamped `GENERIC` stays `GENERIC` even if a later caller asks for `PREMIUM_WHOLE`.
- A chain stamped `PREMIUM_WHOLE` cannot be downgraded.
- Unknown `manufacturing_route` throws `MANUFACTURING_ROUTE_INVALID`.
- Missing route resolves to `PREMIUM_WHOLE`.
- Existing reception, lifecycle, passport, and shipment-gate tests still pass.

Second command:

```sh
npx vitest run server/src/modules/packaging/packaging.service.test.ts server/src/modules/packaging/packaging.service.mass-balance.test.ts
```

Result: 2 files passed, 6 tests passed, exit code 0. The new cases cover a refused overweight packaging order and a successful 12.5 kg consumption.

The running dev server recompiled `server/src` with `tsc` and reported 0 errors.

## Browser

Logged into `http://localhost:8080` as the seeded admin, opened Nouvelle Réception, selected supplier SUP-0001, entered a delivery note and a vehicle, and advanced to the weighing step. The browser tab closed before step 3 (Produit & contrôle), so the new route selector was not seen on screen in this session.

## What did not run

- Full unit suite (`npm test`).
- ESLint (`npm run lint`).
- Production build (`npm run build`).
- Playwright. The repo has no Playwright project.
- Reception step 3 on screen. Login and steps 1–2 of Nouvelle Réception were exercised; the route selector itself was not reached.
- Smoke scripts that need MongoDB (`smoke:wave-a`, `smoke:b0`, and the others).
- Load, index, or query profiling.
- Cross-tenant access tests. No tenant key was found to forge.
- Hardware weighbridge or CCP sensor on this machine.

## 2026-09-27 afternoon — packaging and storage

Command:

```sh
npx vitest run server/src/modules/packaging/packaging.service.test.ts server/src/modules/packaging/packaging.service.mass-balance.test.ts server/src/modules/storage/storage.service.test.ts
```

Result: 3 files passed, 15 tests passed, exit code 0.

Covered: insufficient stock, missing triage lot, quarantined lot, movement-write failure with rollback, duplicate `client_request_id`, destination kilogram capacity, storage movement-write failure with both locations restored, placeholder SSCC left null.

`npm test`, `npm run lint`, and `npm run build` were not run in this pass.

## 2026-09-27 — expedition pick

Command:

```sh
npx vitest run server/src/modules/stock/expedition-decrement.test.ts server/src/modules/stock/stock.controller.expedition.test.ts
```

Result: 2 files passed, 7 tests passed, exit code 0.

Covered: released pick, summed lines, missing lot, quarantine, zero quantity, overweight, duplicate `requestId`, and shipment-write failure with stock restored.

`npm test`, `npm run lint`, and `npm run build` were not run in this pass.

## 2026-09-27 — synthetic genealogy

Focused command:

```sh
npx vitest run server/src/modules/phase2/genealogy.synthetic.test.ts
```

Result: 1 file passed, 4 tests passed, exit code 0.

Scenario: lot A 100 kg and lot B 80 kg, consume 60 kg and 40 kg, output 95 kg, explicit waste 5 kg, pallet net 95 kg, shipment 95 kg. Forward from both parents reaches output, pallet, and shipment. Reverse from `SHP-GEN-001` reaches both parents. Failed completion plus cancel restores 100 kg and 80 kg and leaves no output node. A failed palette insert leaves no palette. A failed shipment update restores stock and leaves no shipment node.

Full command:

```sh
npm test
```

Result: 59 files passed, 244 tests passed, exit code 0. Duration about 98 seconds.

```sh
npm run lint
```

Result: exit code 1. 5 errors, 975 warnings. Errors are pre-existing and outside the genealogy files (`collections.service.ts`, `realtime.bus.ts`, `ReceptionDashboardV2.tsx`, `printRQC.ts`, `tailwind.config.ts`).

```sh
npm run build
```

Result: exit code 2. Server `tsc` failed before Vite:

- `stock.controller.ts(594)` expedition reorder ids typed as `unknown[]`
- `storage.service.ts(1443)` `conflict()` called with a third argument

Staging was not run. Browser E2E was not run. This is not a production-readiness claim.

## 2026-09-28 — build types

`stock.controller.ts` typed expedition lots as `Record<string, unknown>`, so reorder product ids were `unknown[]`. They are now `ExpeditionLot`, whose `product_id` is `string | null`.

`conflict()` did not accept the capacity details object that `storage.service.ts` already passed. The helper now takes the same optional `details` argument as `badRequest()`. The kilogram check is unchanged.

```sh
npm run build
```

Exit code 0. `tsc -p server/tsconfig.json` passed, then Vite finished.

```sh
npm test
```

59 files, 244 tests, exit code 0.

```sh
npm run lint
```

Exit code 1. 1 error, 975 warnings. The error is `printRQC.ts` (`rqc.conventionnel || true` is always true). Four earlier errors were empty or useless catches and a Tailwind `require()`, fixed without a behavior change.

Staging was not run. Browser E2E was not run.

## 2026-09-28 — AI Employee Guide

Focused:

```sh
npx vitest run server/src/modules/ai-guide/ai-guide-intent.test.ts server/src/modules/ai-guide/ai-guide.service.test.ts server/src/modules/ai-guide/ai-guide.orchestrator.test.ts
```

3 files, 24 tests, passed.

```sh
npm test
```

62 files, 268 tests, exit code 0.

```sh
npm run build
```

Exit code 0. Server `tsc` and Vite both completed.

```sh
npm run lint
```

Exit code 1. 1 error (`printRQC.ts` `conventionnel || true`), 976 warnings.

The guide does not mutate stock, QC, or genealogy. Local Ollama can be enabled in `.env`; the code default remains off. Not a staging or production-readiness claim for the assistant. `printRQC.ts` lint is unchanged.

## Readiness

| Label | This change |
|---|---|
| CODE COMPLETE | Integrity chain plus an assistance-layer AI guide. Production build is green. Lint still has 1 error. |
| INTEGRATION VERIFIED | Unit tests stay on the disabled provider. Live Ollama is a local `.env` switch, not a staging proof. |
| STAGING VERIFIED | No |
| OPERATIONALLY VERIFIED | No |
| REGULATORY REVIEW REQUIRED | Yes, before any compliance claim |
| PRODUCTION READY | No |

Old lots without `manufacturing_route` stay on `PREMIUM_WHOLE`. No collection was dropped or rewritten.
