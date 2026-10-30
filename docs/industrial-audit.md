# Industrial audit — 2026-09-27

This is an engineering reading of the repository, not a certification audit and not a factory HACCP validation.

## What the product already is

Date Harvest Hub is a working MES for a date plant: reception, weighbridge, QC, cold store, fumigation evidence, triage, packaging, shipment, lot passport, recall query, costing, and farmer settlement. The operator home is a lot journey (FT-01 through FT-08) rather than a separate app per department.

The authoritative record of lot progress is `lot_events`. Screens subscribe through one SSE channel.

## Findings that changed code

1. Manufacturing route was not actually configurable. `assertCanRecordStage` already distinguished `PREMIUM_WHOLE` from `GENERIC`, but reception, phase 2, packaging, storage, and shipment writers all passed `PREMIUM_WHOLE`. A lot that should follow the non-fumigation route would still be blocked later, or the progress bar would keep demanding `FUMIGATION_CCP`.
2. The route is now chosen once, at reception, stored on the reception and the lot, and copied onto the ledger. Later calls resolve the route from the chain, then from `reception_lots.manufacturing_route`, then from the caller. `PREMIUM_WHOLE` cannot be downgraded. Unknown route names are rejected.
3. Shipment close follows that route when `requires_ccp` is not set on the shipment. An explicit `requires_ccp` on the document still wins.

## Findings that did not change code

- Fumigation stays mandatory on the premium route. No official text reviewed in this session says every date process has the same CCP, and the factory HACCP plan is not in the repo. Removing the premium gate would weaken an existing control without a site decision.
- Codex CXS 143-1985 and UNECE DDP-08 were identified, not transcribed into QC limits. CXS 363-2025 is a fresh-date consumer standard and excludes industrial processing. See `docs/standards-matrix.md`.
- Packaging order creation still swallows stock-sync failures that are not `INSUFFICIENT_STOCK` or `SOURCE_WEIGHT_REQUIRED`. That can leave an order without a consumption movement. Next implementation item.
- Offline queue is reception intake only. That is the correct boundary for QC and shipment.
- GS1 prefix is still a placeholder until the plant enters its own prefix.
- No Playwright suite exists. Click-count claims would be invented.
- Default admin password is documented in the README and must be changed before any shared demo or deployment.

## Canonical entities reused

No new Mongo collection was added. Route state uses `receptions_v2.manufacturing_route`, `reception_lots.manufacturing_route`, and `lot_events.payload.route`.

## Genealogy

`SOURCE LOT` still flows through reception lots, production and phase-2 operations, packaging orders, palettes, and shipments via the dossier builder. This session did not add a new genealogy store.
