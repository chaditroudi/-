## Phase 1 candidate and exact-HEAD acceptance — 2026-11-02

Implementation branch: **codex/phase-1-completion**, isolated worktree: C:/Users/DELL/Desktop/date-harvest-hub-phase1-completion. This section supersedes the historical checkpoints below.

**Acceptance authority:** [.local/evidence/acceptance-final/manifest.json](../../.local/evidence/acceptance-final/manifest.json), generated after the candidate commit. A local PASS is valid only when its head equals the current Git HEAD, sourceChangesDuringRun is false, every required stage passes, and the visual matrix review is complete. Historical test results are not substituted for this ledger. Staging, production, factory commissioning and integration of concurrent work remain unaccepted.

### Implemented scope

The preserved offline/intake reconciliation is committed as d617d587eb0ffebde4d3bfa66bafcc11c9ac78ad. The prior UI/type checkpoint is 9e8dd694d74af71f0953a5fa8f05813209244b59. This continuation retains both and adds shared loading/error/restricted/offline/stale presentation to the remaining legacy registers, quality audit, HR panels and ATP read preview. Registers keep their real creation controls after a successfully loaded empty response. First-load failures never become default empty lists or invented zero statistics. Composite screens require all necessary source responses.

HR reads reuse the existing query cache, with account and employee-filter identities, while preserving write payloads and operations. The audit dashboard now uses a stable minute-resolution rolling window instead of restarting both queries with a new timestamp on every render. Header refresh also reaches active stock queries. No backend source, manufacturing transition, financial formula, stock calculation or tenant database architecture was changed in this continuation.

The generated backend policy projection covers 29 selected read routes and 30 selected commands across 28 canonical factory roles; the legacy admin alias is retained. This is not a claim of complete endpoint or field-level SaaS authorization. Curated workspaces may expose a subset of permitted reads; Articles is exercised with its purchasing role.

KPI presentation distinguishes missing measurement from measured zero. Unsupported idle yield/TRS, downtime, FIFO, coverage, occupancy, maintenance/revenue estimates and ungrounded trends are withheld or described by their model basis. ATP preview wording is explicitly indicative; its backend calculations and order-promise operation are preserved. Supplier rejection percentages without a delivery basis are withheld.

The Datte/Palme/Sel shell remains. Phone tools and titles fit; live-flow and scanner filters wrap readably; dialogs use logical RTL positioning. Settings controls have explicit label associations, account-row actions have meaningful names and touch-sized targets, and remaining register filters have accessible names. French default wording and existing Arabic resources are preserved. RTL geometry does not constitute complete Arabic linguistic acceptance.

### Recorded preflight proof and its limits

- On committed 9e8dd69: 818 tests in 117 files and 1,687 role checks passed. These certify that snapshot only.
- Current focused regressions: 13/13 HR ownership/filter/error and audit-window tests; final-read-regressions.log. Backend policy projection: 9/9; expanded-role-projection.log.
- Pointer-driven settings inspection: 227/227 structural checks, 57 captures, zero unnamed inspected controls; visual-ax-stable.
- Genuine analytics inspection after the audit-window fix: 259/259 checks, 48 captures, all panels selected after device-emulation reload and zero unnamed inspected controls; visual-analytics-regression.
- Earlier nested-tab captures are explicitly invalidated where DOM click or mobile emulation reloaded the selected panel. Earlier failed cold-start and resource-pressure attempts remain available. The 1,861/1,869 role preflight exposed eight fixture/activation failures; its corrected full rerun is required in the exact-HEAD ledger.
- Final CLI and browser counts, screenshots, target databases, start/end times and exit codes are in the acceptance-final ledger. Its visual stage includes 19 root routes, 16 role-specific analytic panels, 13 settings tabs, French/RTL auth, redirect, 404 and missing-passport states at 1440/768/390. Capturing is not manual visual acceptance.

### Preservation and concurrent work

The original checkout is now on fix/supplier-simplify at 3c7b695d79305a23346b1bc6ad998f7984e3e129, with concurrent uncommitted supplier, industrial and other changes. They were not overwritten, staged, reset, stashed, merged or incorporated. The original eight-file offline patch still matches its saved SHA-256 e67a9202f8ab37b5f15df28c587340cb75c110ab411e8d3db719c3ca5a92de11 exactly; see .local/evidence/preserved-eight-current.json. Its Git index has no staged diff. Existing untracked tests, Claude branches/worktrees and checkpoints remain preserved. Compatibility with the concurrent dirty checkout is **NOT VERIFIED** and must be reviewed separately before integration.

### Gates and continuation boundary

Local acceptance requires fresh client/backend TypeScript, lint, full unit/integration tests, safe production-mode bundles, 28-role API/navigation/denial checks, Phase 0 isolation, frozen and dev reception scenarios, real session/offline/reconnect cases, screenshots and matrix review on the exact candidate HEAD. Lint warnings are reported separately from errors. Test fixtures and injected browser failures are not customer/factory evidence.

Staging requires reconciliation of concurrent work, immutable artifacts, approved company/site isolation and migrations, staging authorization/backup/rollback and authenticated device acceptance. Production additionally requires customer/site ownership, QMS/industrial and finance sign-off, commissioned equipment, validated recovery and explicit release approval. No push, deployment or merge is authorized here.

Production/stock/packaging workflow-dependent redesigns remain **BLOCKED** by industrial integrity. External approval remains required for capacities and storage rules, CCP thresholds/residual evidence and signed release, supplier qualification, costing/tax/FX parameters, numbering/GS1 ownership, physical devices, Arabic operational terminology and customer/site access policy. No such policy is adopted by local UI tests. Company/site tenant isolation, provisioning and field-level scope remain SaaS gaps; Phase 0 user/session isolation is not tenant isolation.

Stop after Phase 1. The safest continuation is review of this isolated candidate and its exact-HEAD evidence, followed by a separate compatibility review with the preserved concurrent supplier/industrial branch. Do not begin another phase or merge while that reconciliation and the required gates remain open.

---

## Historical checkpoint (not current acceptance)

## Phase 1 continuation checkpoint — 2026-11-01

**Overall: PARTIAL. Final committed-HEAD acceptance is still required.**

Implementation branch: `codex/phase-1-completion`. Worktree: `C:/Users/DELL/Desktop/date-harvest-hub-phase1-completion`. Committed reconciliation: `d617d587eb0ffebde4d3bfa66bafcc11c9ac78ad`. The subsequent UI/type corrections are pending verification and commit; the old recovery snapshot below is historical.

The original checkout remains on `3c7b695d79305a23346b1bc6ad998f7984e3e129`. Its eight-file offline patch, two untracked tests, branches and Claude worktrees were preserved. The isolated worktree was moved outside the live dev watch root; 61 pending files were verified byte-for-byte across that move (`.local/evidence/worktree-move-verification.json`). Existing Claude processes were not terminated. Generated evidence/bundles are excluded from the isolated dev watcher.

### Evidence already obtained

| Gate | Result | Exact scope/evidence |
|---|---|---|
| Reconciled offline patch | PASS | 47 focused tests; committed d617d58; 796 tests/113 files on that commit, reconciled-full-retry.log |
| Combined latest preflight | PASS | 818 tests/117 files, full-latest.log; exact committed-HEAD rerun still required |
| Role/action/state/realtime preflight | PASS | 1,687/1,687 assertions, 28 canonical roles, 25 read resources and 30 command routes; roles-corrected-results.json. Counts include scenario assertions, not extra accounts |
| Phase 0 browser isolation preflight | PASS | 23/23, isolation-preflight.log; ticketed IDs-only SSE, session switch and no persistent API cache |
| Reception frozen preflight | PASS | 17/17 after the compact mobile-toast correction, including real-pointer R on phone/tablet; reception-preflight-toast.log. Earlier 16/17 failure is retained in reception-preflight-frozen.log |
| Client types | PASS | Latest rerun: zero diagnostics; client-types-latest.log |
| Backend types | PASS | Latest rerun: zero diagnostics; server-types-latest.log |
| Lint | PASS | Latest rerun: zero errors, 984 warnings; lint-latest.json |
| Dev visual structural checks | PASS | 458/458; 105 captures, visual-preflight-08/results.json. This is not blanket visual acceptance |
| Current final HEAD suite | NOT VERIFIED | Must rerun all requested suites after the final local commit |
| Staging / production / factory trial | NOT VERIFIED / BLOCKED | No deployment, push, merge, Atlas access or real-customer acceptance |

### Implementation retained for review

Analytics now distinguishes missing measurement from zero. Idle yield, unsupported downtime, fixed FIFO/coverage, maintenance/revenue placeholders and unmeasured occupancy are withheld. Standard costs and historical flow ratios are labelled by their actual basis; packaging produced/target is not called measured OEE/TRS. Historical fumigation estimates do not certify signed CCP compliance. Industrial and financial formulas and backend records were preserved.

Production/packaging controls use generated backend command permissions. Legacy asynchronous mutation callers were restored with success/error handling. Production subview URLs survive refresh. Empty registers retain authorized creation controls while failed requests retain error/restricted states. The automatic lot-suggestion request to the shipment-mutation endpoint was blocked; manual shipment preparation retains server scan/authorization controls. This missing FIFO/FEFO reader remains a domain dependency, not a mocked suggestion feature.

The mobile header retains its tools and full title, the test ribbon fits above navigation, and the live process diagram wraps into readable groups. Explicitly opened images include home desktop; alerts phone; live desktop/phone; reception QC desktop/phone; stock desktop/phone; production tablet. Other captures remain capture-only until opened and reviewed. Auth, remaining nested forms/settings tabs, Arabic linguistic acceptance, populated/long-content coverage and factory equipment need explicit evidence before broader PASS claims.

### Remaining execution

1. Completed: compact mobile-toast fix passes all 17 frozen reception scenarios, including real-pointer R. Dev reception startup currently fails at a cold Vite navigation timeout; no dev scenario PASS is claimed.
2. Complete visual review and update per-screen matrix rows, including relevant RTL, settings, dialogs and populated states.
3. Finish current unit/type/lint checks, commit only verified code locally, then run the full suite, focused offline tests, types, lint, safe bundles, role browser suite, frozen reception 17, isolation 23 and dev reception 17 against that exact committed HEAD.
4. Record final hashes/counts and keep factory-dependent production/stock/packaging transitions BLOCKED. Stop after Phase 1 for review.

### SaaS compatibility and approval boundary

This remains one product with global legacy role policy; Phase 0 user/session isolation is not company/site tenant isolation. Tenant ownership, migration, customer provisioning, company/site RBAC, approved factory capacity/stock policies, costing parameters, CCP thresholds/residual evidence, hardware commissioning and staging/production release authorization remain separate gates. No tenant migration, subscription, AI feature or manufacturing/financial rule change is authorized here. The preserved roadmap/dependency and migration/release sections below remain in force.

---

## Historical recovery checkpoint

# Date Harvest Hub — SaaS V2 execution baseline

Recovery snapshot: **1 November 2026, Europe/Paris**. Documentation and reconciliation only. No new product phase is authorized by this document.

## 1. Continuation decision

Preserve and continue from **`3c7b695d79305a23346b1bc6ad998f7984e3e129`**, branch **`codex/phase-1-factory-experience`**. This is the latest locally tested compatible source candidate. It contains the earlier reception/QC work, Phase 0, the earlier Phase 1 implementation, and four additional local Codex commits. It is **not a production release or a completed Phase 1 acceptance**.

The main working directory is dirty and is **not** the tested committed snapshot. The clean detached checkout at `.local/phase1/verified` is the source of the final committed-code results below. Preserve both. Do not move back to `main` or `feature/ui-redesign` as an integration shortcut: that would omit later safety work.

**Next executable task:** reconcile the preserved reception/offline patch, file by file, in a dedicated worktree based on this commit. Review and test it before deciding whether to commit it. Then finish the remaining Phase 1 truthfulness/visual gates. Do not start industrial corrections, a tenant migration, billing, or AI during that reconciliation.

Date Harvest Hub remains **one product for many independent customer companies, each potentially operating multiple factory sites**. A factory's branding, date variety, department structure, production route, or quality policy is configuration, not the product's identity. The earlier plan's one-deployment-per-factory delivery option is historical context, not an approved long-term SaaS architecture.

## 2. Sources and evidence rules

Read and reconciled against:

- `PHASE_0_REPORT.md`: historical Phase 0 acceptance at `c11fdcc`.
- `DATE_HARVEST_FINAL_PRODUCT_AND_ECODATTES_READINESS.md`: existing product roadmap and industrial blockers.
- `DATE_HARVEST_QMS_2_MASTER_PLAN.md`: QMS subplan, particularly section 23's release boundary and remaining server-evaluation gap.
- `../design/DATE_HARVEST_UI_UX_MASTER_COMPLETION_PLAN.md`: route matrix, UI waves, verification and factory-approval requirements.
- `../design/SCREEN_MIGRATION_MATRIX.md` and `../design/VISUAL_ACCEPTANCE.md`: older visual evidence; their historical PASS rows do not automatically apply to this HEAD.
- Current Git refs, ancestry, worktrees, diffs, source, existing tests, and the new local acceptance artifacts.
- `PHASE_1_UI_UX_FACTORY_ROLES_REPORT.md`: recovery checkpoint created with this baseline; Phase 1 remains incomplete.
- `evidence/2026-11-01-phase1/baseline-evidence.json`: counts, source identity, artifact hashes and preservation proof.

**PASS** means the named check ran on the stated snapshot. **FAIL** means it ran and failed. **BLOCKED** names a required external prerequisite. **NOT VERIFIED** means no current execution proves the claim. A code finding and a historical runtime result are labelled separately. Automated screenshots/overflow checks do not constitute full visual acceptance.

Remote refs were inspected from the local Git database only. No fetch or live deployment inspection was used; remote/deployed state may differ.

## 3. Preserved branches, commits and worktrees

### Local branch tips

| Branch | Preserved tip | Relationship to current candidate |
|---|---|---|
| `codex/phase-1-factory-experience` | `3c7b695` | Current candidate |
| `stabilize/baseline` | `a8ea0e2` | Ancestor, four commits behind |
| `feature/phase-1-truthful-ui` | `a8ea0e2` | Same earlier Phase 1 snapshot; Claude worktree remains attached |
| `feature/phase-0-safety` | `c11fdcc` | Ancestor; Phase 0 security retained |
| `feature/ui-redesign` | `7d01d5f` | Ancestor; predates Phase 0 |
| `claude/date-harvest-design-plan-751fc7` | `7d01d5f` | Same earlier design snapshot |
| `feature/reception-2` | `dd7856d` | Ancestor; canonical QC release boundary |
| `main` | `4c876c9` | Ancestor, 30 commits behind current candidate |
| `claude/date-harvest-design-plan-a6e539` | `4c876c9` | Same earlier reception snapshot |

All local branch tips above are in the current candidate's ancestry. No local branch merge or cherry-pick is needed to recover their committed code. Shared Git author metadata does not reliably identify which agent authored every historical change; branch/worktree provenance and this chat's known actions are kept distinct.

### Earlier local Phase 1 commits on 1 November

| Commit | Preserved work |
|---|---|
| `8e569f1` | API failure causes and shared truthful states |
| `573133c` | Navigation checked against server routes |
| `459f9a7` | Home, reception, QC, stock and production states |
| `33902c4` | Local fonts, touch targets, type floor, product naming |
| `a8ea0e2` | Seven-role acceptance and injected failures |

### Additional local Codex commits in this session

| Commit | Preserved work |
|---|---|
| `e790654` | Typed failures, notification visibility/counts/acknowledgements, source-failure propagation |
| `2fc3693` | Generated server permission projection, role landing/navigation, dashboard/settings/notification presentation, acceptance expansion |
| `c01058b` | Explicit notification request identity type; fixes clean backend compilation |
| `3c7b695` | Visible mobile QC tab grid, keyboard/RTL direction, role-specific primary task priority |

### Worktrees

Paths are relative to `C:/Users/DELL/Desktop/date-harvest-hub-main`.

| Worktree | State at recovery |
|---|---|
| `.` | Current branch, preserved dirty reception/offline work; not a frozen test input |
| `.claude/worktrees/date-harvest-design-plan-a6e539` | `feature/phase-1-truthful-ui` at `a8ea0e2`; untracked `docs/design/screenshots/phase1/` preserved |
| `.claude/worktrees/reception-2` | `feature/ui-redesign` at `7d01d5f`; clean when inspected |
| `.local/phase1/verified` | Detached at `3c7b695`; clean source; installed dependencies shared by a directory junction; test outputs ignored |

### Separate cached Claude work

`origin/claude/code-artifact-build-k5yt41` points to **`7400d1cb30a3a0a8969859231acf06a4eda8591b`**, authored by Claude on 23 August 2026. It is **not** an ancestor of the candidate; the merge base is `f4cf414f6be3b681c693b8693d98fddcd2724d26`.

It adds `DataTable`, `DetailDrawer`, their tests and shared exports, and changes `src/components/stock/StockLotsList.tsx`. Its historical 222-test/build claim was not rerun here. Preserve the ref and review the primitives as a future adoption candidate. **Do not wholesale cherry-pick its stock screen over the newer authorization/QC/UI code.** No replacement table/drawer implementation was created during recovery.

Other cached non-ancestor commits include a static audit page and deployment-history updates. They were not merged. The cached `origin/main` tip is `f4cf414`; this is not proof of the currently deployed version.

## 4. Uncommitted work and preservation proof

These eight tracked files were already modified before the Codex implementation and remain outside its commits:

| Files | Reviewed purpose |
|---|---|
| `src/components/layout/OfflineSyncStatus.tsx` | Distinguish pending/sending/failed work; retry only eligible entries belonging to the current user |
| `src/components/reception/intake/ReceptionIntakeFlow.tsx` | Stop confirmation on stale/closed drafts; prevent competing saves/navigation; truthful queued result wording |
| `src/hooks/useReceptionDraft.ts` | Optionally propagate shared-version conflicts during confirmation while keeping background sharing recoverable |
| `src/hooks/useReceptionIntake.ts` | Preserve the initial send error/session state and reuse the bounded intake timeout |
| `src/lib/offline/outbox.ts`, `src/lib/offline/outbox.test.ts` | Bounded retry requests, first-request protection, timeout recovery, owner/session/error retention |
| `src/lib/apiTarget.ts`, `src/lib/apiTarget.test.ts` | Explicit discriminant narrowing; no intended API-target policy expansion |

Also preserved, untracked: `src/components/layout/OfflineSyncStatus.test.tsx`, `src/components/reception/intake/ReceptionIntakeFlow.test.tsx`, `.agents/`, `.claude/skills/`, and `skills-lock.json`.

The eight-file binary diff is unchanged from the pre-implementation snapshot. Both SHA-256 hashes are:

`e67a9202f8ab37b5f15df28c587340cb75c110ab411e8d3db719c3ca5a92de11`

Snapshot artifacts remain under `.local/phase1/`: `preexisting.patch`, `status-before.txt`, `index-before.txt`, `index.patch`, and `index-original`. `git apply --check` succeeded against the clean candidate without applying anything. This proves textual applicability, **not integration acceptance**.

The four existing focused patch test files were also run in the dirty checkout: **47/47 tests passed**. This is separate evidence for the preserved patch; it does not add that patch to the clean commit or establish complete combined-browser acceptance.

During recovery, `git status` also intermittently reported `server/src/modules/ai-guide/ai-guide.controller.ts` as modified. Its inspected blob hash was identical to HEAD (`978aeb44666c6fa28bf17aa07b3842354c29b2fe`) and its content diff was empty. Preserve the file/index state and investigate ownership/EOL/stat behavior before editing or staging it. No AI implementation was performed.

The Git index had no staged user changes at the initial snapshot. Only explicit implementation file lists were staged for the four commits above. Recovery documentation/evidence is left uncommitted for review; no source rewrite, reset, clean, rebase, merge, push or deployment was performed for this recovery request.

## 5. Agents, processes and environment boundaries

- This chat's collaboration inventory contains only the root agent. No subagent was spawned.
- Claude Desktop, Codex Desktop and a Cursor Codex host were visible as processes. Process presence does not prove an active repository-writing task; their work ownership/idle state was not established. No other agent was interrupted or messaged.
- Main-checkout Vite and TypeScript watch processes were observed. Source work in that checkout can be compiled or served by those processes. Future implementation must use its own worktree/build directory and coordinate ownership first.
- Existing listeners **8080**, **4000** and the local MongoDB service on **27017** were not used for acceptance mutations. Their loaded revision, dataset and production/customer connectivity were not inferred from the working tree and were not verified by querying them.
- The owned test replica set was **`127.0.0.1:27329`, `rs-phase1`**, with data under `.local/phase1/mongo`. It was launched with explicit loopback binding. All acceptance APIs used `APP_ENV=test`, a named disposable local database and `NUMERIC_SIGNATURE_GATE=enforce`.
- Role tests used **4165/8165**; isolation used **4161/8161**; frozen reception tests used **4171/8171**. Supplementary visual QA used **4175/8175** and timed out. These are separate from 8080/4000.
- Scripts verify the local test stack before their operational writes. Frozen bundles were explicitly built for their named loopback API and checked for forbidden hosts. No Atlas/customer-data connection, credential modification or remote deployment was initiated by these tests.

Owned browser/API/static/dev test processes were torn down by their harnesses. The final teardown record is in the evidence JSON. Existing unrelated services are left running. Test databases, local logs and screenshots are preserved, not cleaned away.

## 6. Phase 0 and Phase 1 status

### Phase 0

Phase 0 commits remain in ancestry: environment/target guards (`0104276`), shared-tablet isolation (`8a85c6e`), backup/restore tooling (`0771309`), acceptance/report (`ad4d0f0`), and IDs-only/ticketed SSE (`c11fdcc`). The reception/QC boundary at `dd7856d` remains.

Fresh local regressions below support their continued behavior on the candidate. The historical 670/670, restore timing, old deployed-revision statement and historical dev-server run are **not** reused as fresh results. Backup/restore rehearsal, credential rotation, real hardware and hosted staging still need their own current gates.

### Phase 1 — implemented substantially, acceptance incomplete

Preserved earlier work includes shared states/boundaries, navigation checks, self-hosted Barlow fonts, touch sizing, and core work-centers. Additional work includes:

- A generated projection of actual backend route metadata: **25 read resources and six daily command routes**, checked across **28 canonical roles**. Legacy `admin` remains a backend alias. The server remains authoritative; this client projection is not dynamic per-customer authorization.
- Role-labelled home views and primary links to existing reception/QC/stock/production/maintenance/logistics/commercial/admin work; mobile scanner access and accessible reception tabs.
- HTTP status preservation, separate session/404 states, retry/stale/offline handling, recoverable screen boundaries and settings that do not expose editable defaults after a failed load.
- Complete viewer-scoped notification counts, matching visibility for acknowledgement, late-response rejection after account clearing, and actual SSE state instead of an unconditional Live label.
- Dashboard request-failure boundaries; failed analytics queries propagate rather than becoming empty collections; default-driven global health is not displayed as measured compliance.
- Neutral product fallback logo; no PF label for an unpacked lot; recall action visibility uses the existing backend permission contract.

**Do not mark Phase 1 complete.** Remaining conditions include the legacy analytical defaults below, incomplete visual verification, full action-button/secondary-request coverage beyond the projected daily routes, and acceptance of the separate offline patch. A passing generic state component does not establish that every screen uses it correctly.

## 7. Fresh acceptance ledger

All current PASS results in this table refer to clean **`3c7b695`**, except the separately identified dirty-patch check. Detailed artifact hashes are in the evidence JSON.

| Gate | Result | Scope and limit |
|---|---|---|
| Full unit/integration suite | **PASS — 781/781, 111 files** | Local replica-set suites included; no skipped suites reported in the final summary |
| Backend TypeScript | **PASS — 0 diagnostics** | Fresh `--noEmit` at the candidate; backend also compiled for browser tests |
| Frontend TypeScript | **FAIL as a clean build gate — 205 diagnostics** | No new diagnostic signatures in implemented files; 203 in the earlier dirty workspace because its preserved API-target narrowing patch fixes two more. Do not report zero |
| Full clean lint | **PASS against baseline — 0 errors, 985 warnings** | No new finding signatures; filtered original root comparison was 987 warnings. The initial broad scan counted duplicate worktrees and must not be compared as one source tree |
| Safe production-mode frontend bundle | **PASS** | Vite production build configured for a loopback test API; forbidden-host check passed. Not a production deployment |
| Role/state/realtime frozen browser suite | **PASS — 1,054/1,054 assertions** | 28 role fixtures; direct refusals, selected faults, loading, expiration, user switch, independent viewers, reconnect, mobile scanner, QC keyboard focus and RTL; 1440/768/390 |
| Frozen reception regression | **PASS — 17/17 scenarios** | Actual application/API, synthetic records, signature enforcement; offline replay, concurrent edits, QC/PIN, blocked stock, realtime, tablet/phone |
| Phase 0 isolation, refreshed on candidate | **PASS — 23/23 checks** | Ticketed stream, IDs-only scoping, logout/user switch and no shared API cache; this is account isolation within a test database, not multi-customer isolation |
| Final screenshot capture | **165 PNGs captured** | Automated capture; not 165 visually accepted screens. Selected final QC LTR/RTL screenshots were opened and inspected |
| Supplementary full analytics visual QA | **NOT VERIFIED — navigation timeout** | Dev navigation timed out at 30 seconds. A setup health check passed; the analytics screen did not receive a visual PASS |
| All original scenarios on final dev server | **NOT VERIFIED** | Frozen run passed; historical dev results are not carried forward |
| Manufacturing golden thread | **NOT RERUN at this HEAD** | Prior runtime report: FAIL, six broken steps. Current code/dependencies remain open; never infer PASS from the reception suite |
| Backup/restore, current snapshot | **NOT RERUN** | Historical local rehearsal exists; current production backup coverage/restore is not established |
| Staging and production acceptance | **BLOCKED / NOT VERIFIED** | No current hosted acceptance, customer test, migration approval or release authorization |

The role runner's phrase “39 accounts” counts distinct assertion-tag groups, including `states`, `rtl`, `switch` and repeated role aliases. The actual canonical role coverage is **28**; do not market this as 39 independently defined account types.

## 8. Confirmed unfinished work and failures

| Finding | Evidence / status | Required handling |
|---|---|---|
| Idle advanced production yield defaults to 100 | `src/hooks/useAdvancedAnalytics.ts:70`; presented by `AdvancedProductionPanel` and `ExecutiveDashboard` | Finish Phase 1 presentation: unmeasured must be explicit; do not silently change industrial calculations |
| Unmeasured fields initialized to zero | Same hook: production hours/throughput/person productivity/availability, rework and measurement averages | Trace actual consumers and measured denominators; hide/label unsupported figures |
| Estimated downtime presented through a Pareto | Same hook: cancelled orders × 6 hours and fixed 0.3/0.2 allocations; `AdvancedProductionPanel` | Do not call these measured machine/person/process losses; calculation redesign requires an approved industrial model |
| Fixed financial loss estimates | Same hook: 2.2 TND/kg and a 0.5 factor; quality loss tooltip | Withhold or clearly label unapproved estimates; financial semantics belong to the approved financial phase |
| Missing denominator can read as zero coverage | Same hook: raw/finished-stock coverage defaults to zero | Distinguish unknown/no consumption from a measured zero |
| Complete visual acceptance remains unfinished | Existing 50-screen/UI matrix plus supplementary QA timeout | Continue the inspect → screenshot → drive → fix → record loop; screenshot capture alone is insufficient |
| Full write/secondary-query audit not completed | Generated contract covers selected daily routes; legacy role-action profiles and other dialogs remain | Check remaining consumers against actual guards, without broadening server permissions |
| External client portal absent | Client/export-partner landing truthfully states unavailable and exposes no internal shell | Do not invent a portal or authorize internal logistics merely to eliminate refusal |
| Quantity reconciliation / parent–sub-lot inflation | Existing product plan's executed findings; no quantity correction in these commits | V2-02/V2-03; report-only audit first, then approved transactional domain correction |
| Partial triage cost distortion / post-triage release gap | Existing product/QMS plans; not freshly exercised here | V2-02/V2-03/V2-05; no direct stock-release shortcut |
| Golden-thread handoffs incomplete | Existing thread test and plans | Execute the real-cycle scenario at the next industrial baseline; no fake stage-event proof |
| Shared/global settings and incomplete tenant boundaries | `site_settings` uses `id: global`; read authorization uses roles; notifications scope roles/users, not a customer/site context | SaaS isolation is not production-ready; V2-08 requires approved architecture and migration |
| Single-process realtime assumptions | In-memory bus/ticket topology | Hosted multi-process/replica acceptance required before scaling |
| Frontend type debt | 205 current diagnostics | Preserve the list; fix touched code cohesively, without a broad rewrite |

The implementation was frozen at the recovery instruction. These findings were documented, not silently repaired or deferred as a fake PASS.

## 9. Twelve-phase SaaS V2 roadmap and dependency mapping

**Numbering reconciliation:** the existing product plan has **11 phases, 0–10**. The QMS plan has **Phase 0 plus 12 execution subphases, 1–12**. Neither is an already approved 12-phase SaaS roadmap. The following **12 phases, V2-00 through V2-11**, are a proposed master crosswalk for review. They preserve the industrial order and insert an explicit SaaS customer/site isolation phase. Recording this crosswalk does not approve implementation or migration.

| Phase | Deliverable and exit gate | Dependencies | Existing mapping / current state |
|---|---|---|---|
| **V2-00 Safety and recoverable baseline** | Safe targets, canonical QC boundary, backup/restore capability, isolation, preserved work and evidence | None; operational credential/backup prerequisites for real data | Product P0, UI W0. Source present; local regressions pass; operational/hosted gates open |
| **V2-01 Truthful UI, roles and shared shell** | Correct states, permitted daily work, navigation/direct links, honest KPIs, actual SSE status, responsive/focus evidence | V2-00 and reconciliation of existing work | Product P1, UI W1 plus the requested role scope. **Incomplete** |
| **V2-02 Industrial integrity and QMS handoffs** | One governed eligibility/release boundary; transactional stage quantity effects, parent decrement, post-triage disposition, server evidence evaluation | V2-01; approved quality/release/route policies | Product P2; QMS contracts/rules/plans/eligibility; UI W2. Pending |
| **V2-03 Real manufacturing golden thread** | Real cycles from intake to customer; production output, BOM consumption, genealogy, organic lineage, packing/pallet/shipment, forced-failure proof | V2-02 and approved process routes | Product P3. Existing expected-failing thread test; pending |
| **V2-04 Commercial and logistics completeness** | Existing P2P/export/customer/shipment flow verified; approved sales/invoicing/accounting interface | V2-03; customer discovery and authority rules | Product P4, UI W5. Partial existing functionality; no replacement accounting engine |
| **V2-05 Material balance and financial-loss evidence** | Consumed-quantity costing, explicit measured/standard/estimated basis, approved loss classes/rates and traceable variances | V2-03; V2-04 where sales margins depend on it; explicit financial approval | Product P5. Pending; no historical financial rewrite |
| **V2-06 Realtime and offline resilience** | Missed-event recovery, idempotent replay, account/context clearing, scale topology and hosted reconnect evidence | V2-00, V2-02/V2-03 event boundaries; later V2-08 context scoping | Product P6. Local foundations present; full/hosted acceptance incomplete |
| **V2-07 Complete industrial UX and accessibility** | Finish the approved screen matrix, high-frequency forms, keyboard/touch, reviewed French/Arabic RTL and real employee trial | V2-01; stable V2-02/V2-03 contracts; V2-04/V2-05 for dependent screens | Product P7; UI W3/W4/W6/W7. No new parallel editor/workflow engine |
| **V2-08 SaaS customer and multi-site isolation** | Approved company→site ownership, memberships, per-context capabilities/configuration, API/file/job/SSE/cache/offline isolation and reversible migration | V2-00; reconciled auth/domain ownership; approved migration and scope mapping. Design can be prepared earlier, migration cannot be presumed | Explicit new SaaS architecture phase. **Not implemented / not approved** |
| **V2-09 Production-like integration and factory acceptance** | Staging, cross-customer/site tests, monitoring, restore/load/failure exercises, approved checklists, PIN provisioning and worker acceptance | Applicable V2-00…V2-08 gates; provisioned staging and factory availability | Existing product P8 / UI W8, expanded to SaaS isolation. Blocked prerequisites |
| **V2-10 Commercial SaaS pilot, entitlements and rollout** | Approved pilot/support scope, customer onboarding, subscription/billing design and sandbox verification, legal/pricing terms, staged release and rollback | V2-08 isolation and V2-09 acceptance; explicit commercial/provider/release approval | Existing product P9 expanded for SaaS. No real charge, push or deployment authorized here |
| **V2-11 Optional governed AI** | Read/explain/navigation assistance on proven scoped data; provider/privacy approval and evaluated output; no quality/stock/financial authority | Stable accepted core and V2-08/V2-09 isolation; separate authorization | Existing optional product P10. Not a dependency for the industrial product or this recovery |

No per-customer code fork is proposed. Maintain one versioned product, reusable domain services and configurable customer/site policies. A subscription entitlement never grants operational authorization or bypasses a QC gate.

### QMS subplan crosswalk — preserve its own numbering

| QMS ID | Existing objective | Master dependency |
|---|---|---|
| QMS-0 | Baseline | V2-00 |
| QMS-1 | Complete audit | Reconciliation / V2-01 |
| QMS-2 | Close bypasses | Existing release-boundary work retained; V2-00/V2-02 |
| QMS-3 | Contracts | V2-02 |
| QMS-4 | Server rules | V2-02; factory-approved semantics |
| QMS-5 | Plans and evidence | V2-02 |
| QMS-6 | Workspace and flow | V2-02 / V2-07 |
| QMS-7 | Stock, production, reception | V2-02 / V2-03 |
| QMS-8 | Realtime and traceability | V2-03 / V2-06 |
| QMS-9 | NC and reporting | V2-02 / V2-05 / V2-07 |
| QMS-10 | Cleanup | After the governed contracts stabilize |
| QMS-11 | Verification | V2-09 local/staging gates |
| QMS-12 | Acceptance | V2-09 factory sign-off |

Retain the QMS dependency chain: baseline → audit → bypass closure; contracts → server rules → plans/evidence → workspace; then eligibility, realtime and reporting integration → cleanup → verification → acceptance. Do not implement a second QC engine.

## 10. Safe branch and integration strategy

1. Preserve the current refs and every dirty/untracked artifact. Keep `3c7b695` as the tested code anchor; do not rewrite its history.
2. Inventory ownership of the main-checkout watchers and pending patch. A running desktop application is not an ownership handshake.
3. For the next approved source task, create a new, isolated `codex/reconcile-phase1-baseline` worktree from the exact anchor, with its own ignored build/data/log directories. Do not reuse or switch another agent's worktree.
4. Review the saved eight-file patch and two new tests against current contracts. The patch applies textually; this is not permission to copy whole files or merge blindly. Keep unrelated tooling changes separate.
5. Reproduce baseline tests, apply only the reviewed cohesive patch, test its regression cases and the combined frozen browser flow, then make an explicit local commit. Do not stage `.env`, `.agents`, `.claude`, runtime data, other agents' files or the entire dirty tree.
6. Review `7400d1c` independently when table/drawer adoption is in scope. Compare current guarded stock behavior first; no blanket merge/cherry-pick.
7. Finish V2-01's unsupported-metric presentation and visual/action matrix before starting V2-02 or V2-08 implementation. Any calculation/policy change is a separately scoped decision.
8. Merge/release only after owner review and the appropriate acceptance gates; nothing in this baseline authorizes a merge to `main`, push or deployment.

## 11. Migration and release rules

- **Customer/site mapping first:** do not infer factory membership from a global employee ID, email, current role, hostname or a default `site_id`. Approve the ownership mapping, handling of ambiguous/orphan records, and supplier/external-user memberships before migration.
- **No premature tenant field sweep:** design/query boundaries, indexes, background jobs, attachments, exports, notification/SSE targeting, cache keys and offline ownership together. A client filter or branding selector is not isolation.
- **Additive, versioned changes:** first perform read-only inventory/reconciliation on disposable or explicitly approved sanitized copies. Review dry-run output, backup/restore, idempotency, constraints and rollback before any real migration. Unresolved data stays unavailable for unsafe operations.
- **Keep operational history:** never silently rewrite ledger/QC/financial history or auto-correct inflated real stock. Use an approved, auditable domain correction when warranted; preserve provenance and original decisions.
- **One source of operational truth:** reuse the canonical QC/PIN/re-inspection boundary, stock movement rules, existing workflow/domain services and post-commit events. No alternative release path, duplicate quantity ledger or parallel business engine.
- **Preserve Phase 0:** enforce signatures for acceptance; never restore row payloads or JWT URLs to SSE; never restore a shared persistent API cache; retain owner/context clearing and safe target guards.
- **Release sequence:** approved data ownership/policies → tested migration/restore → provisioned PINs/checklists → staging isolation and operational acceptance → reviewed release/rollback plan → explicit production authorization.
- **One maintained SaaS product:** use customer/site configuration and explicit capability/feature contracts. Avoid customer-specific branches as the operating model. Central maintenance does not justify global customer data access.

## 12. Separate acceptance gates

| Environment | Required proof | Current conclusion |
|---|---|---|
| **Local committed candidate** | Exact commit/tree, clean source, private ports, declared local test target, signature enforcement, unit/integration/guard/QC/isolation/browser evidence, explicit type/lint debt and visual limitations | Strong local regression evidence; V2-01 incomplete; global client typecheck fails |
| **Combined pending patch** | Reviewed ownership/diff, focused tests, complete combined suite/frozen browser regression at a new exact commit | Patch preserved; textual check and 47 focused tests pass. Not integrated or accepted by the candidate's 781-test result |
| **Staging** | Isolated provisioned environment, approved synthetic/sanitized inputs, TLS/service worker/reconnect, multi-process behavior, load/restore, scope and future cross-customer/site negative tests | **BLOCKED / NOT VERIFIED**; no staging acceptance claimed |
| **Production** | Proven customer/site isolation, approved migration and rollback, credential/security prerequisites, backup/restore and monitoring, signed policies/PIN readiness, factory acceptance and explicit release approval | **BLOCKED**; no production access or release authorized |

Demo, pilot and production readiness are separate decisions. Successful reception or UI tests do not repair manufacturing stock/cost integrity or establish SaaS tenant isolation.

## 13. Factory/customer decisions requiring external approval

| Decision | Required approver / boundary |
|---|---|
| Customer company, factory-site ownership and user/supplier/external-auditor membership | Customer data owner plus product/security owner; migration cannot guess |
| Departments, enabled production stages, order of stages and whether fumigation applies | Each customer's/site's authorized operations and quality owners |
| QC thresholds, class/grade mapping, severity, sample size, NA handling and policy applicability by variety/product | Authorized quality owner; inherited Royal Palm or other factory rules are not universal |
| Single/dual approval, re-inspection and post-triage/finished-product release or inherited evidence | Authorized quality/operations owners; default remains fail-closed |
| Instruments, calibration, tare/packaging weights, units and evidence retention | Factory quality/metrology/operations owners |
| Allowed dispositions, quarantine/rejection/recall and who may perform each action | Factory quality/operations plus security owner; do not widen a role to suppress 403 |
| Loss categories, by-products/co-products, mass gains/losses and reconciliation tolerances | Factory operations/quality; auditable approved policy |
| Cost allocation, partial consumption, labour/energy/overhead rates, valuation, currency/tax/accounting interface and targets | Authorized finance owner; sample calculations approved before changes |
| Organic certification/chain of custody, GS1 identifiers and customer/export document requirements | Customer's authorized quality/commercial owners; no invented certification |
| Season/campaign definitions, language/glossary, Arabic/RTL and operator workflow acceptance | Customer operations and actual employees; no unreviewed Darija glossary |
| Notification/assignment responsibility, escalation and cross-department workflow | Customer department owners; missing backend assignments must not be simulated |
| SaaS onboarding/data residency/retention, subscription entitlements, pricing/support and provider terms | Product/customer/commercial/security/legal owners as applicable; no commitments guessed here |

## 14. Immediate reconciliation task card

**Input:** clean `3c7b695`, the unchanged saved patch/hash, two untracked test files, all existing plans and this evidence ledger.

**Work:** establish owner/process coordination; review the pending intake/outbox changes and API-target narrowing; reproduce their focused tests; evaluate integration in a separate branch/worktree; keep the original work and checkpoints intact. Record any rejected hunk and the reason rather than discarding it.

**Exit:** a reviewed combined candidate with an exact local commit, preserved originals, fresh complete regression and frozen-browser results, no new type/lint findings, and an updated Phase 1 checkpoint. Remaining unsupported KPIs and industrial dependencies must stay explicit. Only then select the next Phase 1 correction; no automatic progression to a new phase.

The source freeze remains in force. This baseline is a continuation guide and evidence record, not a fake completion certificate.
