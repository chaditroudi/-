# Phase 1 UI/UX and factory roles — recovery checkpoint

**Status: INCOMPLETE. Source implementation frozen at the user's safe-recovery instruction.**

Candidate: `codex/phase-1-factory-experience`, **`3c7b695d79305a23346b1bc6ad998f7984e3e129`**. Verification checkout: `.local/phase1/verified`, clean and detached at that commit. The main checkout's separate reception/offline patch is preserved and is not included in that source snapshot.

The current continuation authority is [DATE_HARVEST_SAAS_V2_EXECUTION_BASELINE.md](DATE_HARVEST_SAAS_V2_EXECUTION_BASELINE.md). No further phase was implemented during recovery. This checkpoint preserves the implementation and its limits instead of claiming Phase 1 completion.

## Implemented and preserved

The earlier Phase 1 commits at `a8ea0e2` already supplied shared states, core work-centers, route checks, local fonts and touch sizing. The four later commits `e790654`, `2fc3693`, `c01058b` and `3c7b695` add scoped notification counts/acknowledgement, generated server ACL projection, role landing actions, session/data-state refinements, guarded settings, dashboard failure boundaries, neutral branding and mobile QC/keyboard/RTL fixes.

The server remains authoritative. `src/lib/serverAccess.generated.json` is a build-time projection of actual route metadata, checked by `scripts/role-contract.test.mjs`. It covers 25 read resources and six selected daily command routes across 28 canonical roles. It is not a complete write-permission audit or a per-customer capability service. The legacy backend `admin` alias is retained, without creating another business role.

No manufacturing or financial calculation was corrected. QC/PIN release, stock authorization, IDs-only SSE, ticket authentication and the no-shared-API-cache rule remain in the inherited safety boundary.

## Current gates

| Check | Result at the candidate | Limit |
|---|---|---|
| Full unit/integration | PASS, 781/781, 111 files | Local replica set, synthetic records |
| Backend typecheck | PASS, zero diagnostics | Fresh read-only check |
| Frontend typecheck | FAIL globally, 205 diagnostics | Existing debt; no new signature in implemented files; dirty workspace's separate narrowing patch removes two more |
| Full lint | Zero errors, 985 existing warnings | No new finding signatures |
| Production-mode local test bundle | PASS | Named loopback API, forbidden-host validation; no deployment |
| Role/state/realtime browser acceptance | PASS, 1,054/1,054 assertions | 28 canonical roles, 1440/768/390, selected faults, navigation, daily actions and context changes |
| Frozen reception regression | PASS, 17/17 | QC/PIN, stock denial, offline, concurrent edits and committed realtime refresh |
| Phase 0 isolation | PASS, 23/23, refreshed at the candidate | Account/role isolation; not tenant isolation |
| Preserved dirty-patch focused tests | PASS, 47/47 | Separate four-file unit run; patch remains uncommitted/unintegrated |
| Screenshots | 165 captured | Automated capture is not full visual acceptance |
| Additional analytics visual inspection | NOT VERIFIED | Navigation timeout; no screen PASS inferred |
| Full final dev-server regression | NOT VERIFIED | Frozen result is separate |
| Factory worker/hardware/staging/production | NOT VERIFIED / BLOCKED | No customer/factory acceptance or release |
| Manufacturing thread | NOT RERUN at this HEAD | Historical six-step failure remains an open industrial dependency |

“39 accounts” in the browser runner's final line means 39 assertion-tag groups, including test-state labels and duplicate role aliases. Actual canonical role coverage is 28.

## Data-state and screen changes

- An HTTP 403 retains its status and hides retained restricted records; it cannot become an empty success. A 401 has a session-expired state, and a 404 has an unavailable-record state.
- A 500/network failure displays failure/retry; a failed refresh may retain old data with a stale warning and known timestamp. A real authorized empty response can display an empty state.
- Settings do not mount editable default forms after failure; retained settings are disabled while stale/offline/refetching.
- Notifications retain typed failures, reject a late fetch from a cleared account, and derive unread/critical/warning counts from all authorized notifications rather than a capped displayed page.
- Notification listing, counts and read acknowledgement share viewer scoping. A notification does not authorize access to its destination. Customer/site scoping remains a future SaaS requirement.
- Home names the role/workspace and links to existing work; inspectors use the existing QC queue. Reception entry opens the existing intake flow. Maintenance, logistics and commercial primary links follow their own workspace priority.
- Mobile navigation retains the authorized scanner. Reception uses keyboard-capable tabs and a two-column phone tab grid. Arabic direction is preserved and the selected QC tab is visible in final inspected LTR/RTL screenshots.
- Failed server analytics sources propagate errors instead of becoming empty collections. Several panels now use the shared state boundary. The default-driven global health score is explicitly unmeasured.
- The fallback product logo is neutral; factory branding remains configuration. Finished-product labels require a packed stage, and recall visibility uses the existing guarded command permission.

## Unfinished acceptance — do not hide these findings

`useAdvancedAnalytics.ts` still contains an idle yield default of 100, unmeasured zero fields, estimated downtime allocations and fixed financial loss estimates. Some consumers display them as operational figures. The shared-state work does not resolve those semantics. Complete truthful presentation under Phase 1; changing calculations requires the separately approved industrial/financial scope.

The full screen/action/secondary-request matrix, wider visual review, reviewed Arabic terminology and real employee acceptance are not complete. External customer portal functionality is absent; the implemented landing says so and does not reveal internal navigation.

Known industrial dependencies remain explicit: stock reconciliation, parent/sub-lot quantity inflation, partial triage cost distortion, missing post-triage release and the incomplete real manufacturing thread. There is no production-ready multi-customer/site isolation claim. Global settings, role/user-only notification scoping, local realtime topology and ownership migration require separate architecture work.

## Reproducible local checks

Run only in an owned checkout at the stated commit, with its own local replica set and disposable database. The retained local replica set used port 27329 and `rs-phase1`; it is stopped during final teardown. Never point these commands at a customer database or ports 8080/4000.

```powershell
$env:APP_ENV = 'test'
$env:MONGODB_URI = 'mongodb://127.0.0.1:27329/?replicaSet=rs-phase1'
$env:MONGODB_DB_NAME = 'phase1_unit_runner'
$env:RECEPTION_IT_MONGO_URI = $env:MONGODB_URI
$env:NUMERIC_SIGNATURE_GATE = 'enforce'
node node_modules/typescript/bin/tsc -p server/tsconfig.json
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=dot
node node_modules/typescript/bin/tsc --noEmit -p server/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
node node_modules/eslint/bin/eslint.js . --ignore-pattern '.local/**'
```

The 205 frontend diagnostics are expected in this snapshot; do not silence them or convert that command to a claimed PASS.

Role/browser run, after verifying a disposable local target and generating the matrix without the source-update flag:

```powershell
$env:PHASE1_MATRIX_FILE = '.local/role-matrix.json'
node node_modules/vitest/vitest.mjs run scripts/role-contract.test.mjs --maxWorkers=1
node scripts/build-test-bundle.mjs .local/bundle-roles http://127.0.0.1:4165/api
$env:ROLES_DB_NAME = 'phase1_roles_recheck'
$env:ROLES_BUNDLE = '.local/bundle-roles'
$env:ROLES_SCREENSHOTS = '.local/screenshots-recheck'
$env:ROLES_RESULTS = '.local/browser-results-recheck.json'
node scripts/e2e/roles.e2e.mjs
```

The suite owns private ports 4165/8165 and drops its named disposable database. It requires the local Chrome executable configured by `E2E_BROWSER` or its Windows default.

Isolation was run after building `.local/bundle-isolation` for `http://127.0.0.1:4161/api`, with `ISOLATION_BUNDLE` and `ISOLATION_DB_NAME=phase1_isolation_baseline_final`, then `node scripts/e2e/isolation.e2e.mjs`.

Reception was run on a frozen bundle for `http://127.0.0.1:4171/api`, static app 8171, database `phase1_reception_committed`, and the same environment/signature settings. The retained launcher `.local/phase1/reception-runner.cjs` owns the test processes; the tracked scenario source is `scripts/e2e/reception.e2e.mjs`. Its H/J scenarios restart the owned API, so do not substitute an unrelated API process.

The separate dirty-patch run was:

```powershell
node node_modules/vitest/vitest.mjs run src/lib/apiTarget.test.ts src/lib/offline/outbox.test.ts src/components/layout/OfflineSyncStatus.test.tsx src/components/reception/intake/ReceptionIntakeFlow.test.tsx --maxWorkers=2 --reporter=dot
```

Raw logs, builds, local harnesses, preserved diffs/index snapshots and all captured PNGs remain under `.local/phase1/`. Portable summaries, hashes, the role matrix and selected screenshots are in `evidence/2026-11-01-phase1/`. Historical visual records were not overwritten.

## Resume point

Reconcile the existing eight-file/two-test offline patch first. Keep all original branches, commits and untracked evidence. Then finish Phase 1's unsupported metrics, remaining action coverage and visual evidence. No next phase, tenant migration, billing implementation or AI work is authorized by this checkpoint.


## Role navigation snapshot

Generated from the tested candidate. Module IDs are stable route identifiers. Supplier accounts redirect to the existing portal; the two customer-only account types receive an unavailable portal state, not an internal shell. The profile action is navigation into an existing workspace, not a grant of write authority.

| Existing role | Workspace | Visible module IDs / portal behavior | Primary link |
|---|---|---|---|
| `administrateur_systeme` | Administration système globale | home, receptions, storage, production, packaging, logistics, purchasing, maintenance, analytics, alerts, suppliers, materials, quality, hr, sage-operations, export, customers, settings, live, scan | Gérer les utilisateurs |
| `directeur_general` | Direction et arbitrage | home, analytics, alerts, export, customers, sage-operations, production, packaging, receptions, quality, purchasing, logistics, suppliers, storage, maintenance, hr, settings, live, scan | Voir l’activité de l’usine |
| `directeur_usine` | Pilotage global usine | home, production, packaging, receptions, storage, alerts, analytics, export, customers, sage-operations, quality, suppliers, purchasing, logistics, maintenance, hr, settings, live, scan | Voir l’activité de l’usine |
| `responsable_production` | Supervision production | home, production, packaging, alerts, maintenance, sage-operations, analytics, hr, live, scan | Ouvrir le travail en cours |
| `responsable_qualite` | Pilotage qualité | home, receptions, quality, alerts, storage, maintenance, sage-operations, analytics, hr, live, scan | Contrôler un lot |
| `inspecteur_qualite` | Inspection qualité terrain | home, receptions, alerts, scan | Contrôler un lot |
| `chef_reception` | Supervision réception | home, receptions, storage, alerts, sage-operations, hr, live, scan | Nouvelle réception |
| `operateur_reception` | Saisie réception | home, receptions, alerts, scan | Nouvelle réception |
| `operateur_nettoyage` | Nettoyage ligne | home, production, alerts, scan | Ouvrir le travail en cours |
| `operateur_fumigation` | Suivi fumigation | home, production, alerts, scan | Ouvrir le travail en cours |
| `operateur_triage_ia` | Triage IA | home, production, alerts, scan | Ouvrir le travail en cours |
| `operateur_conditionnement` | Conditionnement | home, packaging, alerts, scan | Ouvrir le conditionnement |
| `operateur_emballage` | Emballage | home, packaging, alerts, scan | Ouvrir le conditionnement |
| `magasinier_wms` | Opérations magasin | home, storage, alerts, scan | Ouvrir le stock et les mouvements |
| `responsable_logistique` | Pilotage logistique | home, logistics, export, storage, alerts, analytics, hr, live, scan | Voir les expéditions |
| `responsable_achats` | Achats et fournisseurs | home, purchasing, suppliers, materials, alerts, analytics, hr, live, scan | Ouvrir les demandes d’achat |
| `responsable_maintenance` | Supervision maintenance | home, maintenance, alerts, production, hr, scan | Voir les interventions |
| `technicien_maintenance` | Interventions maintenance | home, maintenance, alerts, production, scan | Voir les interventions |
| `fournisseur_externe` | Espace fournisseur | Dedicated supplier portal | Consulter les fournisseurs |
| `client_externe` | Espace client | Client portal unavailable; no internal navigation | Unavailable |
| `auditeur_externe` | Lecture audit | home, quality, alerts, scan | Consulter les dossiers qualité |
| `technico_commercial` | Commercial | home, export, customers, analytics, live, scan | Ouvrir les commandes export |
| `directeur_achat` | Direction achats | home, purchasing, suppliers, analytics, materials, hr, live, scan | Ouvrir les demandes d’achat |
| `resp_management_qualite` | Management qualité | home, quality, alerts, analytics, hr, live, scan | Consulter les dossiers qualité |
| `resp_qualite_haccp` | Qualité HACCP | home, quality, alerts, analytics, hr, live, scan | Consulter les dossiers qualité |
| `responsable_reception` | Responsable réception | home, receptions, storage, alerts, hr, live, scan | Nouvelle réception |
| `responsable_stock` | Responsable stock | home, storage, alerts, purchasing, maintenance, hr, live, scan | Ouvrir le stock et les mouvements |
| `partenaire_client_export` | Client export | Client portal unavailable; no internal navigation | Unavailable |
