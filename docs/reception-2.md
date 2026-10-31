# Reception 2.0

One reception path for date deliveries: three employee steps, one transactional intake, honest weighing evidence. Quality decisions stay with the QC module.

## Employee workflow

The Réception tab holds five sections: Réceptions du jour, En attente, Historique, Bons BRA and Alertes. Quality roles also get Contrôle QC.

| Step | What the employee does | Rules enforced by the server |
|---|---|---|
| 1. Fournisseur & livraison | Supplier, open order line or direct delivery, BL, vehicle, variety, maturity, harvest method | Active supplier, spontaneous-delivery policy, order belongs to the supplier, Bio needs a valid certificate (RG-R05) |
| 2. Lot & pesée | Weighing, supports, lot reference, temperature, zone, photos | Net above zero, lots equal net, tolerance on the order, two photos (RG-R06) |
| 3. Vérification | Reads the summary, fixes blockers, confirms | Everything above, again, in one transaction |

Confirmation creates the reception, lots, units, quarantined stock, weighing records, ledger stages and audit entry together. Lots stay `EN_QUARANTAINE` until the QC module decides.

## Canonical API

| Route | Purpose | Roles |
|---|---|---|
| `POST /api/receptions/intake` | The only way to book a delivery. `client_request_id` is required | Reception write roles |
| `GET /api/receptions/search` | Paged history: `q`, `status`, `supplierId`, `from`, `to`, `limit`, `before` | Reception read roles |
| `GET/PUT/DELETE /api/reception-drafts[/:id]` | Shared drafts with optimistic versions. Touch no lot or stock | Read / write roles |
| `POST /api/receptions/:id/corrections` | Delivery facts only, with a reason. Old and new values stay in the audit log | Supervisors |
| `POST /api/reception-lots/:id/weighing` | After intake, a weighing is a correction: supervisor, reason, no stock change, alert if the net differs | Supervisors |

`PATCH /api/receptions-v2/:id` and `PATCH /api/reception-lots/:id` now refuse booked receptions. The `BROUILLON` routes remain only for historical drafts; no screen creates them.

## Weighing provenance

| `weighing_source` | Meaning | Shown as |
|---|---|---|
| `DEVICE` | Two signed, stable, unused readings. Set by the server only | Bascule connectée · lecture signée |
| `SCALE` | Read on the scale display and typed | Saisie manuelle · lu sur la bascule |
| `MANUAL` | No scale. Reason required, RG-R08 alert raised | Saisie manuelle · sans bascule |

A client cannot claim `DEVICE`. Switching mode on the screen clears the weights, so typed values never become readings. Historical `SCALE` rows display as typed.

## Consistency

- `runInTransaction` (`server/src/db/transaction.ts`) uses Mongoose's AsyncLocalStorage support, so existing services join without a session argument. Production refuses a standalone MongoDB; development warns.
- Realtime events and notifications wait for the commit. A retried attempt discards what it queued.
- Inside a transaction a ledger failure aborts the write, whatever `TRUST_STAGE_GATE` says. Outside one the existing dual-run behaviour is unchanged.
- Catch blocks must rethrow `TransientTransactionError`, or MongoDB cannot retry.
- `idempotency_commands` gained a 2-minute lease for commands left by a crash, and a fingerprint so the same key with other weights is refused instead of replayed.

### Migration

No data is rewritten. At startup `ensureTrustIndexes` adds new indexes and replaces `client_request_id_unique` (sparse, which still indexes `null`) with a partial index on strings. The new index is created first, and the old one is dropped only then. Historical rows keep their `null`.

Transactions need a replica set. Atlas is one. `docker-compose` has no MongoDB, so a local server must be started with `--replSet`.

## Offline

- Every keystroke is saved to IndexedDB, photos included. Drafts survive a reload and an expired session.
- Confirming queues the delivery before sending. The queue is a safety net: if local storage fails, the request still goes out.
- The screen says "gardée sur cet appareil" until the server answers. No number or lot is shown before that.
- A 401 keeps the delivery, and it leaves after the same user signs in. On a shared tablet another user's session never sends it.
- A refused delivery stops retrying and is shown in En attente for correction. Local storage opens and network calls have timeouts, so no button can freeze.
- QC decisions, releases and corrections have no offline path.

## Real time

Reception events carry ids only and reach plant staff, never portal accounts. After a reconnect the client refetches, because events sent during the gap are gone. A stream silent for 40 s is replaced: a dropped link raises no error.

## Configuration

In Paramètres › Opérations, enforced by the server:

| Setting | Default | Limits |
|---|---|---|
| `allow_spontaneous_reception` | true | Excluded by a mandatory order |
| `require_purchase_order_for_reception` | false | |
| `require_vehicle_number_on_reception` | true | |
| `reception_varieties` | The previous fixed list | At least one |
| `reception_weight_gap_warning_pct` | 5 (RG-R03) | Above 0 |
| `reception_weight_gap_critical_pct` | 10 (RG-R03) | At least the warning, at most 25 |

## Tests

```bash
npx vitest run
```

The integration suite needs a local replica set and is skipped without the variable:

```bash
mongod --replSet rs-reception --port 27327 --bind_ip 127.0.0.1 --dbpath <empty folder>
```

```bash
mongosh --port 27327 --eval "rs.initiate()"
```

```bash
RECEPTION_IT_MONGO_URI="mongodb://127.0.0.1:27327/?replicaSet=rs-reception" npx vitest run server/src/modules/receptions
```

Browser acceptance (`puppeteer-core`, already a dev dependency) wipes its own local database:

```bash
npm run server:build
```

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:4127 npx vite --host 127.0.0.1 --port 8127
```

```bash
PORT=4127 MONGODB_URI="mongodb://127.0.0.1:27327/?replicaSet=rs-reception" MONGODB_DB_NAME=reception_e2e JWT_SECRET=local-e2e-secret-of-any-value WEIGHBRIDGE_SIMULATOR_SECRET=local-e2e-sim-secret node scripts/seed-test-actors.mjs
```

```bash
PORT=4127 API_HOST=127.0.0.1 MONGODB_URI="mongodb://127.0.0.1:27327/?replicaSet=rs-reception" MONGODB_DB_NAME=reception_e2e JWT_SECRET=local-e2e-secret-of-any-value WEIGHBRIDGE_SIMULATOR_SECRET=local-e2e-sim-secret node scripts/e2e/reception.e2e.mjs
```

## Known limits

- Connected weighing is verified with the signed simulator only. No physical scale has been tested.
- Maturity stages, harvest methods and transport conditions stay fixed domain lists.
- Lot numbers remain the `LOT-0001` serial. The `RP-…` format the old wizard previewed was never what intake stored.
- Printed GS1 labels use a placeholder GTIN: there is no GS1 company prefix in the system.
