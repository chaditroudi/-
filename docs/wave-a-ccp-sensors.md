# Wave A — CCP sensors → ledger

## Goal

Make cold-store and fumigation telemetry authoritative evidence on the
hash-chained lot ledger, not just charts and alerts.

## What shipped

- Pure evaluator: `server/src/modules/trust/ccp-evidence.ts`
  - fumigation CT / duration / leak / door checks
  - cold-chain excursion detection
  - stable readings digest
- Ledger events: `CCP_SENSOR_ATTESTED`, `COLD_CHAIN_ATTESTED`, `COLD_CHAIN_BREACH`
- Fumigation readings append `CCP_SENSOR_ATTESTED`
- Dual-sign CCP payload now includes evidence fields (CT, digest, device counts)
- Gate: `TRUST_CCP_GATE=warn|enforce|off` (default `warn`)
- Cold readings append attestation/breach events for lots present in the location
- Stock moves into cold zones record `COLD_STORE`
- Passport claims: CCP sensor verification, CT product, cold-chain intact/excursions
- Storage condition / door / fumigation readings are regulated append-only
- HMAC device ingest: `POST /api/ccp-sensors/readings` (header `x-ccp-signature`)
  - simulators `CCP-FUM-SIM-01` / `CCP-COLD-SIM-01`
  - `npm run ccp:sim -- fum <cycleId>` / `npm run ccp:sim -- cold <zoneCode>`
- UI: fumigation CCP monitor shows HMAC vs manual; passport badges for CCP + cold

## Rollout

1. Keep `TRUST_CCP_GATE=warn` for one fumigation shift.
2. Run `npm run smoke:wave-a`.
3. Run `npm run demo:golden-thread` for direction demo.
4. Review warn logs for `CCP_EVIDENCE_INSUFFICIENT`.
5. Switch to `TRUST_CCP_GATE=enforce` after operators can produce readings before dual-sign.

## Operator note

Dual-sign still requires VALIDATION status. In enforce mode, missing or weak
sensor evidence blocks the final CCP completion. In warn mode the cycle can
still close, but the ledger payload records `evidence_compliant: false`.
