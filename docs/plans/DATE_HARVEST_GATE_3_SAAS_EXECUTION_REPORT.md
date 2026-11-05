# Date Harvest Hub — Gate 3 SaaS execution report

Date: **4 November 2026**. Scope: the current repository and disposable local test factories. No deployment, production database access, customer-data migration, commit or push was performed.

## 1. Actual source and preservation

- Branch: `fix/supplier-simplify`.
- HEAD: `3c7b695d79305a23346b1bc6ad998f7984e3e129`.
- This is the **combined dirty working tree**, not a new committed or released revision. Initially 80 tracked files differed from HEAD, alongside substantial untracked Gate 1/2 work.
- Current local branches and history were inspected. `main`, the older reception/design branches and Phase 0 precede this HEAD. `codex/phase-1-completion` at `97cb80c` contains six additional commits and remains in its separate worktree; it was not merged over the current pending changes. No reset to the older baseline occurred.
- The original binary working-tree patch, status and index are retained in `.local/gate3-2026-11-04/`. The index SHA-256 remains `779cf0f9f9560da8e997a5d770b24f8bf4818ec29f1d29a410e5785c19226636`.
- Automated patch comparison found **all 72 unrelated original tracked diffs unchanged**. Eight originally modified files were narrowly extended for Gate 3. The pre-existing `FlowStepper.tsx` deletion remains intact. Existing untracked work was retained; the pre-existing stock-hold helper received the explicit QC bypass correction below.

Preservation evidence: `preservation.json`, `worktree-before.patch`, `worktree-after.patch`, `index-original`, `status-before.txt` under that local evidence directory. The comparison covers tracked patch content and index bytes; it is not a claim that every original untracked file was independently hashed.

## 2. Reconciled Gates 1 and 2

| Area | Current assessment | Evidence and limits |
|---|---|---|
| Gate 1 engineering | PASS for executed local checks | Server/client type checking, build and the existing frontend regression suites run on this combined tree. |
| Gate 1 complete UX/worker acceptance | PARTIAL | The existing UI audit itself reports PARTIAL for localization, Darija, command-center and module consistency. Current same-browser factory switching passed. Arabic direction is available, but the tablet screenshot still shows French strings and layout limitations; no factory-worker acceptance is claimed. |
| Gate 2 implementation integration | PASS for presence and focused regressions | The CAS helper, domain-only stock movements, triage consumption, linked outputs, idempotency and shipment checks are present in this working tree. Initial focused run: 35/35 across seven suites. These changes are largely uncommitted. |
| Reception/QC/notification DB behavior | PASS for executed cases | Existing three DB suites initially passed 78/78. A further negative test exposed and then verified the stock-hold bypass correction. |
| Gate 2 complete industrial correctness | PARTIAL | Cleaning inventory and partial-triage costing defects remain reproducible. The historical Gate 2 report's blanket PASS cannot establish the full 1,000 kg scenario. |

Reviewed reports include `UI_UX_AUDIT_EXECUTION_REPORT.md`, `UI_UX_PHASE2_FINAL_REPORT.md`, `PHASE3_GATE1_TYPESCRIPT_STABILIZATION.md`, `PHASE3_GATE2_STOCK_INTEGRITY_AUDIT.md`, `DATE_HARVEST_SAAS_V2_EXECUTION_BASELINE.md`, and `DATE_HARVEST_FINAL_PRODUCT_AND_ECODATTES_READINESS.md`. Their historical results were kept separate from current execution.

## 3. Implemented factory boundary

**Company** is `tenant_id`; **factory/site** is `factory_id`. Both are explicit fields on the authoritative `auth_users` account. This implementation supports one active factory membership per account. It does not infer owners from company names, P2P site codes, browser parameters, old documents or a default tenant. Multi-factory switching and company-wide account access are not implemented.

Sign-in binds both IDs into an HS256 session. Every authenticated request rereads the account and checks activity, token version and the exact signed company/site pair. Legacy unassigned accounts and old unscoped tokens fail closed. Role changes clear the singular legacy role/domain grants and increment token version; membership moves invalidate the previous scope immediately on its next use. Authentication is no longer cached for 60 seconds.

Operational Mongoose models resolve through `AsyncLocalStorage` to a database named from a SHA-256 digest of the control database, company and factory. `useDb` shares the existing MongoClient and transaction machinery. The current domain services and CAS predicates remain in place. Business-reference and command uniqueness are therefore local to the factory database; the same references can exist in independent factories.

The central boundary covers suppliers/purchasing, reception/weighing, QC/labs, MP/WIP/PF stock, manufacturing/treatments, packaging/pallets, customers/orders/shipping, costs/reports/dashboard aggregation, stored documents, audit logs, notifications and their collection-based joins. Static inspection found these business paths use `getCollectionModel` or the factory-local settings model. The remaining direct account lookups used by management, signatures and workflow approver selection now use a mandatory factory filter. Login and own-account credential operations remain in the control plane.

Factory settings always use the canonical typed schema, including when a generic configuration reader is the first caller. The singleton `id` index is unique, default creation is atomic, and required trust indexes initialize once per factory. Index failure returns `503 FACTORY_DATABASE_UNAVAILABLE`; it does not silently run an unprotected factory. Existing uniqueness keys for idempotency, replay, scans and ledger sequence stay unchanged inside each namespace. Tenant-local supplier/customer code races and additional natural-key indexes still merit dedicated review; no blanket uniqueness claim is made for every legacy business reference.

Unauthenticated settings expose product branding defaults only. Authenticated workers' JSON responses remove price, cost, margin, monetary total and related management fields, including nested DTOs. This also covers reception and purchasing read paths. Realtime continues to carry IDs only. Existing permission checks still govern endpoints; financial projection is additional protection, not a replacement for role authorization.

## 4. Realtime, devices and shared tablets

- SSE clients and subscriber counts are factory-local. A director or explicit user target cannot cross the factory boundary.
- Ticket redemption revalidates the live session. Each attempted data event is authorized against a fresh account read; heartbeat checks also close revoked sessions. Logout, token-version changes, role changes and membership moves withhold further events. Responses clean up their heartbeat/expiry timers on close.
- Transaction events retain the captured factory and publish only after commit. A real replica-set test verifies rollback removes the factory-local write and suppresses SSE; a successful commit is visible only in that factory.
- Device registration returns a signed factory/channel/device routing credential. Unauthenticated ingestion requires that credential and the existing registered device HMAC signature. Wrong-factory secret, wrong channel, wrong device code and forged routing credentials are rejected. Hardware devices themselves were not tested.
- The anonymous lot-passport read was closed. A passport now requires an authenticated permitted factory user; its brand/site comes from factory settings. Public buyer sharing requires a separately designed publication/capability flow and is not claimed complete.
- Query/store caches clear before the next account/factory/permission context renders, and the workspace remounts. Late HTTP responses from another session context are refused. Cross-tab session changes notify the app.
- Outbox rows and local drafts are bound to company, factory and user. Identical request/draft IDs can coexist across factories. Retries pin the originating token, and old form saves cannot write into a newly selected factory. Legacy unscoped offline records remain stored and are not automatically attributed or replayed. Supervised recovery of those records remains a release prerequisite.

## 5. Immediate QC integrity blocker repaired

The new real HTTP negative test proved `POST /api/stock/holds` could previously return 201 to a warehouse user and promote a QUARANTINE row without the canonical QC decision.

Release now requires a quality role and a recorded prior releasable warehouse-hold state. A raw QC quarantine or an unproven legacy hold cannot use this endpoint. Holds retain their prior status/root so release does not indiscriminately release unrelated descendant holds. Linked reception stock must still have a released reception-lot state. Status updates use conditional predicates. The existing canonical QC/PIN release route remains responsible for QC decisions.

Incomplete genealogy remains a known limit: this patch does not establish complete historical hold propagation or repair historical quantities. Legacy holds without provenance stay closed for review.

## 6. Exact files changed in this execution

Existing Gate 1/2 files not listed here were not rewritten.

| Purpose | Files |
|---|---|
| Context/model/index boundary | `server/src/db/factory-context.ts` (new); `server/src/db/dynamic-model.ts`; `server/src/db/indexes.ts`; `server/src/app.ts` |
| Authentication/membership | `server/src/models/auth-user.model.ts`; `server/src/middleware/auth.ts`; `server/src/modules/auth/auth.service.ts`; `server/src/modules/auth/auth.controller.ts`; `server/src/modules/auth/numeric-signature.ts`; `server/src/modules/org/membership.ts`; `server/src/modules/maintenance/maintenance.service.ts`; `server/src/modules/purchasing/purchasing.service.ts` |
| Configuration/startup | `server/src/models/site-settings.model.ts`; `server/src/modules/settings/settings.service.ts`; `server/src/modules/settings/settings.controller.ts`; `server/src/seed.ts` |
| Realtime/device ingress | `server/src/modules/realtime/realtime.bus.ts`; `server/src/modules/realtime/realtime.controller.ts`; `server/src/db/factory-device-token.ts` (new); `server/src/modules/weighbridge/weighbridge.controller.ts`; `server/src/modules/ccp-sensors/ccp-sensors.controller.ts` |
| Financial/audit/document access | `server/src/middleware/financial-visibility.ts` (new); `server/src/middleware/security-audit.ts`; `server/src/modules/document-prints/document-prints.controller.ts`; `server/src/modules/trust/trust.controller.ts`; `server/src/modules/trust/lot-passport.service.ts` |
| QC bypass correction | `server/src/modules/stock/stock.controller.ts`; pre-existing untracked `server/src/modules/stock/stock-hold.ts` |
| Browser/session/offline | `src/App.tsx`; `src/integrations/mongodb/client.ts`; `src/lib/axiosClient.ts`; `src/lib/factorySession.ts` (new); `src/lib/offline/outbox.ts`; `src/lib/offline/draftStore.ts`; `src/hooks/useReceptionDraft.ts`; `src/hooks/useReceptionIntake.ts`; `src/components/layout/OfflineSyncStatus.tsx`; `src/components/reception/ReceptionDashboardV2.tsx`; `src/components/scan/ScanStation.tsx` |
| New tests/helpers | `server/src/db/factory-isolation.test.ts`; `server/src/db/factory-device-token.test.ts`; `server/src/db/gate3.http.integration.test.ts`; `server/src/middleware/financial-visibility.test.ts`; `server/src/test/factory-test.ts`; `src/lib/factorySession.test.ts`; `src/lib/offline/draftStore.test.ts` |
| Existing test fixtures extended | `server/src/middleware/auth.test.ts`; `server/src/modules/auth/auth.service.test.ts`; `server/src/modules/settings/settings.users.test.ts`; `server/src/modules/realtime/realtime.bus.test.ts`; `server/src/nest/authz-matrix.test.ts`; `server/src/seed.test.ts`; `server/src/modules/receptions/reception.integration.test.ts`; `server/src/modules/receptions/qc-release.http.integration.test.ts`; `server/src/modules/notifications/notifications.integration.test.ts`; `src/lib/offline/outbox.test.ts` |
| Reproducible local tools | `scripts/factory-data-migration.mjs`; `scripts/factory-data-migration.test.mjs`; `scripts/e2e/gate3.e2e.mjs`; `scripts/gate3-industrial-probe.mjs` |
| Documentation/evidence | This report; `DATE_HARVEST_GATE_3_SAAS_EXECUTION_PLAN.md`; `evidence/2026-11-04-gate3/` |

## 7. Commands and observed results

All database executions used a separate local MongoDB replica set on `127.0.0.1:27431`, replica set `gate3rs`, with disposable test databases. The existing deployment URI was not used. The initial sandbox `spawn EPERM` was resolved by running the compiler/test subprocesses with execution permission; no source workaround disabled compilation or tests.

| Command/check | Result |
|---|---|
| `npm run typecheck` — initial and final | PASS, server and client |
| `npm run build` — initial | PASS, backend and Vite/PWA |
| Initial focused `npx vitest run` — stock integrity, stock quantity, expedition, Phase2, packaging, production, genealogy | 7 files, 35/35 PASS |
| Focused new session/model/device/realtime/settings/tablet tests | 8 files, 61/61 PASS before later coverage additions |
| Existing DB regression run: reception, QC, notifications | 3 files, 78/78 PASS before adding the hold-bypass test |
| Reviewed DB security run: Gate3 HTTP, migration, QC | 3 files, 56/56 PASS: 14 factory tests, 6 migration cases, 36 QC cases |
| Full suite without integration environment variables | 119 files PASS; 752 tests PASS; 5 files / 99 infrastructure-gated tests skipped |
| Final `npm run build`, then complete suite with both integration variables enabled | PASS: backend + Vite/PWA build; **124 files / 851 tests PASS, zero skipped** |
| Frozen local browser bundle | PASS; local API target, forbidden-host scan passed |
| `node scripts/e2e/gate3.e2e.mjs` | PASS, five narrow checks; no uncaught page errors |
| `node scripts/gate3-industrial-probe.mjs` | Executed; two industrial defects reproduced, not an acceptance PASS |
| Independent review | Three Important findings found, corrected and independently rechecked: monetary totals, canonical settings/index initialization, and routable migration destination. No remaining introduced Critical/Important issue found within the focused re-review. |

Reproduce the complete DB run in PowerShell after building the server and starting the isolated replica set:

```powershell
$env:APP_ENV = 'test'
$env:GATE3_IT_MONGO_URI = 'mongodb://127.0.0.1:27431/?replicaSet=gate3rs'
$env:RECEPTION_IT_MONGO_URI = $env:GATE3_IT_MONGO_URI
npx vitest run
```

Browser build/run:

```powershell
node scripts/build-test-bundle.mjs .local/gate3-2026-11-04/frontend http://127.0.0.1:4143/api
$env:APP_ENV = 'test'
$env:MONGODB_URI = 'mongodb://127.0.0.1:27431/?replicaSet=gate3rs'
node scripts/e2e/gate3.e2e.mjs
node scripts/gate3-industrial-probe.mjs
```

The final suite ran in 93.97 seconds. An earlier full DB run exposed a settings-fixture model binding failure after the schema correction; returning a concrete canonical model inside the helper's factory scope corrected it, and all 38 affected reception cases passed in the final run. Earlier failures and their logs remain in the evidence directory.

The 99 gated tests require the integration URI variables and local replica-set infrastructure; they were all executed in the final run. No required local infrastructure remained unavailable. The final suite includes existing forced-failure logs and known Mongoose/deprecation/accessibility warnings; these were not silently relabelled as infrastructure failures. `git diff --check` passed. Full repository lint was not run and is NOT VERIFIED. Hardware, paid providers, deployed multi-process behavior, production migration and factory-worker acceptance were not exercised.

## 8. Cross-tenant proof

Two independently configured companies plus a second site in Company A were provisioned only in local test fixtures. Different shifts, names and costing settings coexist. Their suppliers, customers, lots and purchase/production references deliberately overlap.

| Negative/positive case | Local proof |
|---|---|
| A reads or changes B's stock | A lists only A; foreign CAS and HTTP adjustment refuse; B quantity remains unchanged |
| Same company, another site | Separate namespace and stock list; old token refused after site membership move |
| Suppliers/customers | Lists and direct customer update stay local even with foreign IDs/scope fields in the payload |
| Documents/reports | Foreign document lookup is empty; B reads its own document; dashboard/lookup sources remain local; anonymous passport refused |
| QC/production | Lab and production lists stay local; foreign lab mutation refuses; foreign cleaning record returns 404 |
| Accounts/approvers | A cannot list, deactivate or change B's PIN; approver lookup returns only A's manager |
| Roles/revocation | Role update revokes the old token and removes stale singular/domain grants; logout invalidates outstanding SSE tickets/events |
| Concurrent operations | Two competing A consumers cannot overspend; B's concurrent consumption succeeds independently |
| Identical references | Same supplier/customer/purchase/production references and idempotency key exist across factories; duplicate command key within A is rejected by MongoDB |
| Aggregation/jobs/model cache | MongoDB lookup returns the local supplier; overlapping deferred contexts remain separate; unscoped operational access refuses |
| Realtime | Actual streams/counts stay local; no foreign data event; revoked stream receives no post-logout event |
| Transaction behavior | Actual replica-set rollback removes the useDb write and emits no SSE; committed write/event appear only in A |
| Device ingestion | Actual signed reading works in its namespace; foreign secret/device/channel/forged token refuses; same device/reference can work independently in B |
| Initialization failure | Conflicting required singleton index produces 503 rather than running unprotected |
| Tablet state | Unit cases cover stale replies, outbox/draft ownership and equal IDs; browser covers A logout → B login/cache separation |

These tests establish the exercised local boundaries. They do not constitute penetration testing of every endpoint or acceptance of every industrial handoff.

## 9. Legacy migration safety and release prerequisites

No existing customer records were inspected or modified. Source code alone cannot establish the owner of legacy data. Optional account fields were added without automatically filling them. New unassigned accounts and legacy tokens are refused.

`scripts/factory-data-migration.mjs` defaults to read-only inventory. It records collection counts, BSON digests, index definitions, conflicts and unsupported collection metadata without outputting operational records. Copy requires a matching reviewed inventory plus an explicit single-factory ownership assertion. It rejects stale source state, conflicting IDs, assigned accounts, existing destination collections, views and collection options that need a specialized migration. It preserves empty collections, BSON values and supported indexes, verifies hashes/counts and checks source stability again.

The destination ends in `_staging` and is **unreachable by runtime factory routing**. No accounts are activated, no source rows are changed, no destination is merged/overwritten, and no source deletion is available. Failed copies remain isolated for inspection. Source retention makes this staging step reversible without changing operational access; live cutover, account activation and rollback are **not implemented or rehearsed**.

Before deploying this authentication/routing change, the data owner must approve company/site/user mappings; provision permissions for per-factory databases; inventory and reconcile the actual source; rehearse backup/restore and verified cutover/rollback under a write freeze; resolve duplicate/index conflicts and unscoped tablet drafts; and issue new sessions/device routing credentials. This work cannot safely guess those customer decisions. Database-per-factory capacity/operating cost and account onboarding must be validated on the intended hosting tier.

Standalone MongoDB still does not supply multi-document transactions. The existing production refusal remains intact; local integration used a real replica set.

## 10. The historical 1,000 kg probe and unresolved defects

The probe seeds a synthetic released lot in an isolated factory and executes the current real cleaning, triage and packaging services against MongoDB. It deliberately does not claim the complete upstream reception/QC/device-fumigation or downstream pallet/order/shipment/browser journey.

| Historical issue | Current observed result |
|---|---|
| Cleaning 1,000 → 960 kg plus 40 kg waste | **FAIL**: stock stays 1,000 kg and no stock movement is written |
| Triage of 400 kg creating 380 kg usable output and 20 kg rejects | Parent consumption works: book stock becomes 980 kg, not 1,380 kg. It should physically be 940 kg after the missing cleaning adjustment |
| Partial-triage cost | **FAIL**: 26.4658 TND/kg reproduced. The whole 10,000 TND parent cost plus 57 TND configured standard overhead is allocated over 380 kg. Consumed material alone should be 4,000 TND; with that explicit overhead assumption the expected unit cost is about 10.6763 TND/kg |
| Packaging derived lot | PASS for entering an order and consuming 50 kg of the released triage output; not proof of the complete packing/shipping journey |
| Premium ledger/handoffs | NOT VERIFIED. The probe retains a missing-CCP warning; it does not establish complete physical/evidence lineage |

Unresolved priorities:

- **P0 industrial:** cleaning does not reconcile inventory or write a waste/stock movement.
- **P0 industrial:** partial triage allocates full-parent material cost.
- **P0 release prerequisite:** real ownership mapping, database provisioning, legacy cutover/rollback and new account/session activation remain unexecuted. Deploying this code without them would lock unassigned legacy users out.
- **P1:** complete hold genealogy, concurrent quality state changes, historical discrepancy review, downstream costing and stage/evidence handoffs need a dedicated manufacturing gate. Existing adjustment multi-document failure/replay behavior also requires broader DB-backed fault testing.
- **P1:** customer-specific P2P presets and other legacy configuration assumptions remain; independent factory storage does not make those presets universal policies.
- **P1:** supervised recovery of unscoped offline records; authenticated/public passport publication contract; multi-factory membership/onboarding; additional natural-key indexes; deployment limits and multiple API-instance event delivery.
- **P1 UX:** Arabic/French mixed strings and tablet RTL/layout limitations remain outside this security implementation.

## 11. Readiness and next executable phase

**Gate 3: PARTIAL overall.** The implemented local factory isolation controls have concrete positive and negative proof. Commercial SaaS release remains on hold for the migration/provisioning prerequisites and unresolved industrial P0 defects. Gate 1's full worker/visual acceptance and Gate 2's complete industrial acceptance are not promoted to PASS by the security tests.

Next: implement the cleaning inventory/waste handoff and consumed-quantity costing under the same factory boundary, with failure, replay and concurrency tests; reconcile hold/evidence propagation and historical discrepancies without silent rewrites. Then run the entire supplier → purchase → reception → QC → MP stock → cleaning → triage → treatment → packaging → pallets → PF stock → order → shipment → customer journey on a replica set and through representative French/Arabic browser workflows. Inputs, outputs, rejects, waste, genealogy, decisions, movements and costs must reconcile before that gate can pass.

In parallel with that local engineering work, obtain the approved legacy ownership inventory and rehearse the deployment migration in staging. No production activation should be inferred from this report.
