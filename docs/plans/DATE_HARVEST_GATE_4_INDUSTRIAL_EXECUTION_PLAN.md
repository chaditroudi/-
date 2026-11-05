# Gate 4 industrial implementation and acceptance

Authority: the user's Gate 4 implementation request, continuing the November 4 Gate 3 report. Work in the existing dirty checkout; no staging, commits, resets, production data, migration or deployment. Before-source copies and index are in `.local/gate4-2026-11-04/`.

Architecture: extend the existing domain services, factory-local models, transaction helper, CAS primitive and hash-chained ledger. Cleaning consumes a released stock input and creates a linked output, recording waste in the transformation/movement evidence rather than deducting it twice. A full-input cleaning retains the recognizable lot number on the active output; a partial transformation creates a distinct descendant. Material value is carried into usable output (yield loss is absorbed once); subsequent partial consumption uses that output's unit value. Purchase snapshots stay historical. Missing cost remains unknown.

Alternatives: subtracting waste alone would fix the headline quantity but fail to distinguish partial cleaned/untreated material and output genealogy. Rewriting the manufacturing engine would discard existing protections. Use linked stock transformations inside the existing services instead.

- [ ] Preserve and inspect current source; confirm P0 call chains and remaining treatment/packaging handoffs.
- [ ] Write and observe failing cleaning/partial-cost regressions against a disposable real replica set.
- [ ] Implement transactional cleaning and consumed-value triage, including conditional status checks, replay, fault recovery and stable lineage.
- [ ] Verify and repair treatment/packaging/pallet costing, QC holds and mass balance where the A–Z journey exposes defects.
- [ ] Execute actual HTTP supplier/purchase/reception/QC/manufacturing/shipment/customer acceptance with all quantities and costs reconciled; add concurrency/rollback/cross-factory negatives.
- [ ] Exercise representative French/Arabic browser workflows against isolated test factories.
- [ ] Run type checks, build and full regression suite; independent review; write `docs/plans/DATE_HARVEST_GATE_4_INDUSTRIAL_EXECUTION_REPORT.md` with exact results and limits.

Execution is inline as requested. All connected industrial close commands added here require replica-set transactions; standalone MongoDB must fail closed rather than present a partial multi-document write as atomic. No test-only bypass of QC, tenant authorization, signatures or stock gates is allowed in acceptance. Synthetic fixture setup and deliberately injected failures are reported separately from real workflow actions. Historical records are never automatically repaired.
