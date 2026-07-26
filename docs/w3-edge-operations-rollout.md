# W3 Edge Operations — rollout and recovery

## Deployment order

1. Deploy the server while `TRUST_SCAN_GATE=warn`.
2. Confirm MongoDB created the W3 unique indexes at startup. Resolve any
   `[indexes] Failed ... duplicate` message before enabling enforcement.
3. Deploy the PWA and open the reception screen once while online so Workbox
   caches the shell.
4. Exercise the automated checks with `npm run smoke:w3`.
5. Run the HTTP simulator twice:
   - `npm run weighbridge:sim -- 260 GROSS`
   - `npm run weighbridge:sim -- 10 TARE`
6. Validate scanners and device readings with operators for one shift.
7. Set `TRUST_SCAN_GATE=enforce`, restart the API, and repeat the W3 smoke test.

The simulator and API must share `WEIGHBRIDGE_SIMULATOR_SECRET`. Production
devices are registered through `POST /api/weighbridge/devices` and use an
independent secret per device.

## Offline reception

- Intake is written to IndexedDB before the HTTP request.
- A global badge reports pending, syncing, and action-required records.
- Network, 409-in-progress, and 5xx failures retry with exponential backoff.
  Validation, authentication, and authorization failures stop for operator
  correction.
- Official reception numbers, lot labels, and passport printing are unavailable
  until the queued command synchronizes.
- The server's `client_request_id` index and command result store make replay
  return the original reception, lots, and units without a second ledger event.

If a tablet is replaced before sync, keep the old browser profile available:
queued payloads and photos are local to that profile. Reconnect, authenticate,
and use the badge's retry action. Do not re-enter the reception unless the
failed item is explicitly discarded after reconciliation.

## Scan gate and break-glass

- Lot, passport URL, unit barcode, SSCC, and location formats are resolved by
  `POST /api/trust/scan/resolve`.
- Proofs expire after five minutes, belong to one actor, and are consumed once.
- A repeated command with the same request ID returns its original movement.
  Reusing a proof for a different command is rejected.
- In `warn` mode, missing proofs are logged but allowed. In `enforce` mode they
  block the movement.
- Stock managers and plant/system directors may use a manual override only with
  a reason. Every override emits a targeted stock alert.
- Automated domain flows call the service with a named `SYSTEM` exemption.
  Generic `/api/db` inserts into movement collections remain forbidden.

## Weighbridge recovery

- The adapter sends a stable reading with `deviceCode`, `readingId`,
  `capturedAt`, weight, unit, direction, and an HMAC-SHA256 signature.
- Duplicate signed readings return the existing record.
- Invalid signatures, unstable values, expired calibration, clock skew over
  24 hours, and over-capacity values are rejected.
- The simulator spools unavailable API deliveries to
  `.w3-weighbridge-spool.json` and flushes them on its next run.
- Manual weighing remains available. Record a supervisor and reason; use the
  RG-R08 two-witness flow for a scale outage.
- A verified gross/tare pair records `LOT_WEIGHED`. A later pair appends
  `WEIGHING_AMENDED`; it never overwrites or hides the earlier chain event.

Public passports expose only verified-device and calibration status. HMAC
signatures and device secrets are never returned by passport endpoints.

## Related checklists

- Operator plant checklist: `docs/w3-operator-checklist.md`
- Demo lot runner: `npm run demo:golden-thread`
- Next wave (CCP sensors): `docs/wave-a-ccp-sensors.md` and `npm run smoke:wave-a`
