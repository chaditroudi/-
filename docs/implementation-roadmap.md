# Implementation roadmap

Dependency order from the execution brief. Status is what the code supports after 2026-09-27, not a promise that every stage is finished.

| Stage | Scope | Status | Next exact action |
|---|---|---|---|
| A Foundation | Architecture, standards, canonical lots, security map | Documented in `docs/architecture.md`, `docs/standards-matrix.md`, `docs/gap-analysis.md` | Keep one ledger and one SSE bus |
| B Raw material | Farmer, reception, weighbridge, QC, storage | Already implemented and still the default path | Browser-pass the express reception with the new route field |
| C Manufacturing | Routes, treatment, triage, mass balance | Route stickiness implemented. Premium fumigation rule unchanged | Stop swallowing packaging stock-sync errors |
| D Finished goods | Packaging, labels, pallets, SSCC | Present. GS1 prefix is a placeholder | Enter a real prefix only when GS1 issues it |
| E Commercial | Orders, shipment dossier, settlement | Present. Official certificates are not generated as if they were issued by an authority | Keep external certificates as attachments |
| F Realtime and offline | SSE plus reception outbox | Present. Safety approvals stay online | Do not add WebSocket beside SSE |
| G UX | Role workspaces, French operator copy | Route selector added on reception step 3 | Translate remaining French literals only where operators work in Arabic |
| H Validation | Unit tests for the route change | 27 tests passed in the trust and reception files listed in `docs/validation-report.md` | Run the full `npm test` and a production build before any deploy |

## Decisions taken without a factory meeting

- Default route remains `PREMIUM_WHOLE`.
- `GENERIC` is visible in the reception wizard and must be chosen. It is not tied to a variety name.
- Invalid route values fail the intake instead of being stored as premium under another name.
- No database migration. New fields are written on new receptions. Old lots have no `manufacturing_route` and resolve as `PREMIUM_WHOLE`.

## Decisions deferred

- Whether fumigation is a CCP for any product other than the premium whole route.
- Codex or UNECE numeric tolerances as QC gates.
- Real GS1 company prefix.
- SMTP for supplier mail.
- Deploying anywhere.
