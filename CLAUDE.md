# Date Harvest Hub — project manual for Claude Code

Last validated against the code: **6 Nov 2026**, `main` at `1556ff0` (deployed to GitHub Pages the same day).
Keep this file short and true. Long inventories live in the linked documents. Describe what exists, never what is planned as if it shipped.

## 1. Product north star

Date Harvest Hub is a **multi-tenant SaaS factory operating system for independent date factories** (reception, quality, storage, processing, packaging, shipping, export), first deployed for Groupe Ennour Investissement in Tozeur. Every tenant and site runs the same product; behaviour comes from configuration and roles, never from code written for one factory.

For a floor worker it should feel like a friendly task app: *what do I do now, then the next safe step*. Supervisors get queues, exceptions and approvals. Owners get trustworthy figures with their source. It must not feel like a classic ERP.

## 2. Repository map

| Path | What lives there |
|---|---|
| `src/App.tsx` | HashRouter routes: `/`, `/auth`, `/dashboard`, `/alerts`, `/portail`, `/passport/:lotId`, `*` |
| `src/pages/Index.tsx` | The app shell. `?tab=` (20 values) and `view=` choose the screen; `resolveTab` drops tabs the role cannot open |
| `src/components/<module>/` | Screens by module: `reception` (intake, QC), `batches` (stock/storage), `production`, `phase2` (cleaning, fumigation, hydration, triage), `packaging`, `logistics`, `export`, `purchasing`, `mes` (suppliers, materials), `customers`, `maintenance`, `employees`, `analytics`, `home`, `alerts`, `scan`, `settings` |
| `src/components/layout/` | `AppSidebar`, `TopHeader`, `WorkflowNavigation` (mobile bar), `CommandMenu`, `EnvironmentRibbon`, `OfflineSyncStatus` |
| `src/components/shared/` | `DataState` (loading/empty/error/restricted/stale), `AppErrorBoundary`, `SummaryStrip`, `OperatorActionBar`, `PageHeader`, `LotStatusBadge`, `NumericSignatureDialog`, `WorkPath` |
| `src/components/ui/` | shadcn/ui primitives (Radix). Change defaults here, not per screen |
| `src/lib/roleAccess.ts` | Role workspaces (`primaryTabs`, `quickTabs`, `actions`), `getAccessibleTabs`, `getShellDensity` (floor / supervisor / direction) |
| `src/lib/apiAccess.ts` + `serverAccess.generated.json` | What each role may read or write, generated from the server route table. Refresh with `UPDATE_ROLE_CONTRACT=1 npx vitest run scripts/role-contract.test.mjs` |
| `src/hooks/`, `src/store/api/` | React Query hooks and RTK Query APIs (`axiosBaseQuery`, `ApiRequestError`) |
| `src/lib/offline/` | Reception outbox and drafts on the device (owner- and factory-bound) |
| `src/i18n/` | i18next, locales `fr` (default), `ar`, `en`; `setDocumentDirection` sets `dir` |
| `server/src/` | NestJS API on Express: `modules/<domain>/` (41 controllers), `db/` (factory context, transactions), `middleware/` (auth, audit), `config/` (`APP_ENV`, env guards) |
| `scripts/` | Seeds, guards, smoke scripts, `e2e/` browser suites, `docs/` generators |
| `docs/` | Design system, plans, audits, evidence (see section 14) |

## 3. Commands (all verified in `package.json`)

| Purpose | Command |
|---|---|
| Install | `npm ci` (Node 22, `.nvmrc`) |
| Client + API dev | `npm run dev` (user's own stack on :8080 / :4000) |
| Type check | `npm run typecheck` (server and client; both at 0 errors on `1556ff0`) |
| Lint | `npm run lint` (0 errors, ~1,000 warnings) |
| Unit and integration tests | `npm test` (808 pass, 105 skipped without a database) |
| DB-backed tests | set `RECEPTION_IT_MONGO_URI` to a **local replica set** |
| Production build | `npm run build` (server `tsc` then `vite build`). In Git Bash prefix `MSYS_NO_PATHCONV=1` or `/api` is rewritten to a file path |
| Frozen test bundle | `node scripts/build-test-bundle.mjs <outDir> http://127.0.0.1:<port>/api` then `node scripts/e2e/static-server.mjs <outDir> <port>` |
| Browser suites | `scripts/e2e/reception.e2e.mjs` (17 scenarios), `roles.e2e.mjs`, `isolation.e2e.mjs`, `thread.e2e.mjs`, `gate3.e2e.mjs`, `phase1-visual.e2e.mjs` |
| Test accounts | `scripts/seed-test-actors.mjs` seeds one user per role as `<role.with.dots>@test.local`; password from `TEST_ACTOR_PASSWORD` |
| Docs generators | `npx vite-node scripts/docs/role-matrix.ts`, `node scripts/docs/feature-inventory.mjs [--json]` |

CI (`.github/workflows/ci.yml`) runs server type check, client type check (non-blocking), lint, `npm test` and the build. `deploy.yml` deploys GitHub Pages on every push to `main`, but only if CI passes. **Pushing `main` deploys the live site.**

## 4. Environments and safety

- `APP_ENV` is one of `production`, `staging`, `live-dev`, `dev`, `test` (`server/src/config/runtime-env.ts`). `test` and `dev` refuse remote databases.
- The user's daily stack is `:8080` / `:4000` on **MongoDB Atlas with real data**. Never drive it, write to it, or restart it. Never run scripts without checking their target; several smoke scripts default to `:4000`.
- Tests run on a private local replica set (e.g. `mongod --replSet rs-x --port 273xx`) with `APP_ENV=test` and `NUMERIC_SIGNATURE_GATE=enforce`. Start `mongod` from the same long-lived script that runs the tests; stop it and every test port when done, and say which ports remain open.
- Never `git worktree remove` a worktree whose `node_modules` may be a link: it deletes the main folder's packages (happened 6 Nov 2026; repaired with `npm ci`).
- Never print `.env`. Never put credentials, tokens or customer data in docs, screenshots or commits.
- Files are **CRLF** on disk; Git Bash hides the CR. Edit with scripts that preserve line endings.
- Do not push, merge into `main` or deploy unless the user asks in that turn.

## 5. Factory flow and invariants

Supplier → **Reception** (delivery, weighbridge gross/tare/net, lots, photos; offline outbox) → **QC** (measures, defects, lab, decision with numeric PIN) → **Storage** (zones, placement, quarantine) → **Processing** (cleaning, fumigation CCP, hydration, triage into grades) → **Production orders** → **Packaging** (orders, labels, pallets, seal) → **Shipments / export** (BDE, contracts, COA) → customer. Purchasing, maintenance, HR, costing and analytics sit beside it.

Invariants the UI must never weaken:
- Only a QC decision releases stock; blocked or quarantined stock is never counted as available.
- Premium Deglet Nour triage requires a completed fumigation CCP; consumption requires the source lot's QC release (`STOCK_LIBERE`).
- Quantities move only through domain actions (atomic, compare-and-set, idempotent by `client_request_id`); no free-form stock edits.
- Lot genealogy, the lot event hash chain and mass balance stay intact.
- Releases need the signer's numeric PIN; separation of duties is enforced by the server.

## 6. Roles, tenants and permissions

- 28 roles (`src/types/roles.ts`). `getShellDensity` groups them: **floor** (operators, inspector, storekeeper, technician, reception chiefs, auditor, portal accounts), **supervisor** (production, quality, logistics, purchasing, maintenance, commercial), **direction** (directors, system admin).
- Full role × screen × action matrix: `docs/audits/generated-role-matrix.md` (generated).
- **The server is the authority.** The client hides only what the server refuses (`tabIsServed`, `canRead`, `canWrite`). Never widen a server rule to make a screen work.
- Tenant isolation: the account's `tenant_id` + `factory_id` select a per-factory database (`server/src/db/factory-context.ts`, `factory-database-registry.ts`); the JWT must match the account. Requests run in `runWithFactory`. Never infer a factory from HTTP input, never rename or truncate factory databases (Atlas shared tiers limit names to 38 bytes; see `factoryDatabaseName`).
- Supplier accounts land on `/portail`. Known defect: a supplier currently lists 2 supplier records instead of its own (isolation suite check "a supplier lists only its own record").

## 7. UX north star

- **Task first.** Home answers "what do I do now": current station, next real task, blocked items with the reason.
- **Tablet first, phone ready.** Targets ≥ 44 × 44 px on touch; one primary action per view, last and on the right (start in RTL); sticky actions on long forms.
- **Floor workers** get no ERP sidebar: a small dock (home, tasks, scan, alerts, account) built from the tabs the server serves.
- **Supervisors** get queues, exceptions and approvals; **owners** get KPIs that show source and period, with drill-down.
- **Truth before calm.** An unknown value is never shown as zero; refused data says it is restricted; a failure offers retry (`DataState`). No success message before the server confirms.
- Simplify with progressive disclosure and role relevance, never by removing a field, action, history or document.

## 8. Visual reference contract

- Reference: `docs/design-reference/Date_Harvest_Hub_Multilingual_Customer_Demo.html` and `docs/design-reference/screenshots/`. **Visual and interaction reference only.**
- Emulate: warm off-white surfaces, olive/date green, generous spacing, rounded cards (12–20 px), large station tiles, one big next-task card, step progress, bottom dock on tablets and phones, calm typography.
- Never copy: its demo data, KPI values, lot numbers, the 14 fictional stations, the role switcher, simulated confirmations or demo banners. Stations shown in the app come from the role's real tabs.
- Factory branding (`Settings → Branding`, applied by `SettingsContext.applyTheme`) overrides primary and accent colours.

## 9. Localization contract

- Shipped today: `fr` (default and fallback), `ar` (MSA, RTL), `en` (~1,000 keys each; `en` lacks `cleaning`). Only about 30 of 261 component files use `t()`; most screens are hardcoded French.
- Targets: Tunisian Darija, MSA, English, French, Iraqi Arabic, Levantine Arabic. Dialects override worker wording and fall back to MSA. All dialect text is unreviewed until a native speaker signs it off (`docs/i18n/DIALECT_REVIEW.md`).
- Stored values and domain codes never change with language. Use logical spacing classes (`ms-`, `pe-`, `start-`, `text-start`) so layouts flip in RTL.
- The factory `default_language` setting exists but is not applied yet.

## 10. No-loss contract

Before redesigning a screen, regenerate its inventory (`node scripts/docs/feature-inventory.mjs --json`) and compare it with `docs/evidence/tablet-first-ui/inventory-baseline-1556ff0.json` afterwards. Every label, button, tab, dialog and data hook that disappears must be moved somewhere reachable or explained in `docs/plans/TABLET_FIRST_FEATURE_PARITY.md`. No API contract, schema, migration or business-rule change for a visual redesign. Deep links (`?tab=`, `view=`, `lot=`, `focus=`, `action=new`) keep working.

## 11. Current state (6 Nov 2026)

- `main` CI is green and deployed. Client and server type checks: 0 errors.
- Tablet-first redesign: started on local branch `feature/tablet-first` (not pushed). Progress per screen: `docs/plans/UI_UX_FULL_REBUILD_CHECKLIST.md`.
- Open defects: supplier sees other suppliers (above); inspector navigation lacks "Contrôle qualité"; four roles lack the mobile Scan button.
- Not verified anywhere: physical weighbridge, real factory users, staging (none exists).

## 12. Acceptance gates

A screen is **VERIFIED** only when: the working screen was redesigned (not just a header); its inventory shows no unexplained loss; actions were tried in a real browser as a role that may use them; 375, 768, 1024 and 1440 px were checked, including touch emulation; Arabic RTL and at least one other language were checked; relevant tests pass; before/after screenshots are saved under `docs/evidence/tablet-first-ui/`. Passing UI checks never means the factory is ready to go live.

## 13. How to work here

1. Read this file and the checklist; check `git status` and peer sessions before testing or merging.
2. One screen at a time: inventory → before screenshot → redesign the real component → translate → tests → browser at four widths and RTL → after screenshot → inventory diff → update the checklist row.
3. Run `npm run typecheck`, `npm run lint`, `npm test`, `MSYS_NO_PATHCONV=1 npm run build` before each commit.
4. Stop and report when a change would need a server rule, price, score or calculation to change, when a blocked lot looks available, or when a test would need a weaker assertion.
5. If interrupted, write `docs/design/CHECKPOINT.md`: branch, last commit, phase, last passing gate, next file.

## 14. Canonical documents

- Full audit: `docs/audits/DATE_HARVEST_FULL_PROJECT_AUDIT.md`
- Role × screen × action matrix: `docs/audits/DATE_HARVEST_ROUTE_ROLE_WORKFLOW_MATRIX.md` (with `generated-role-matrix.md`)
- Feature parity: `docs/plans/TABLET_FIRST_FEATURE_PARITY.md` (with `TABLET_FIRST_FEATURE_PARITY.generated.md`)
- Redesign tracker: `docs/plans/UI_UX_FULL_REBUILD_CHECKLIST.md`
- Design system: `docs/design/DATE_HARVEST_DESIGN_SYSTEM.md`
- Evidence: `docs/evidence/tablet-first-ui/`
- Earlier plans (history, not instructions): `docs/design/DATE_HARVEST_UI_UX_MASTER_COMPLETION_PLAN.md`, `docs/plans/PHASE_*`, `docs/plans/DATE_HARVEST_GATE_*`
