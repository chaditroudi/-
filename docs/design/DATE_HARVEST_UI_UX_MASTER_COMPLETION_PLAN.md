# Date Harvest Hub: UI/UX master completion plan

Approved 2026-10-31. Wave 0 not started. Sequenced by `docs/plans/DATE_HARVEST_FINAL_PRODUCT_AND_ECODATTES_READINESS.md`, which moves W3 and W4 after the stock and thread fixes.
Prepared 2026-10-31 against `feature/ui-redesign` at `7d01d5f`. Paths are relative to the repository root.

## Context

The redesign exists but is unfinished. The earlier report counted 7 of 39 "routes" as accepted. This investigation re-examined that state, and found the largest remaining problem is not visual: **screens tell employees things that are not true when the server refuses or fails a request.** The goal of this plan is to finish the product as one coherent system, in an order where safety and truthfulness come first and visual completion builds on them, and to let Agent Mode execute without another discovery phase.

**Evidence tags** used throughout:
`[CODE]` verified in code. `[BROWSER]` verified in a real browser this session. `[TESTS]` supported by existing tests. `[DESIGN]` proposed design decision. `[UNVERIFIED]` requires acceptance.

**How the browser evidence was gathered.** Playwright MCP against the private stack (`:8130` → `:4130` → Mongo `127.0.0.1:27327`, database `ui_design_b6ac8a`), proved by launch command and matching `lastConnectedAt`. `:8080`/`:4000` (Atlas) was only asked for `/api/health`. Network log: only GETs and test sign-ins. Something else also used that visible Chrome window during the session (URL changes and a `sidebar:state` cookie I did not cause), so nothing below rests on those URL changes.

---

## 1. Executive product design verdict

**The design language is right. The product is not finished, and it is not yet truthful.**

- **Keep:** Datte/Sel/Palme/Deglet identity, Barlow, the Filière thread, flat surfaces, `SummaryStrip`, register rows, the three-step intake. This is a distinctive direction and should not be restarted. `[DESIGN]`
- **Fix first:** a refused or failed request renders as a calm, empty, plausible screen. On the factory floor that is a safety problem. `[BROWSER]`
- **Real completion is lower than reported.** Of the 7 PASS rows, 4 must be reopened (section 2).
- **The gap is shared infrastructure.** No ErrorBoundary, no shared error, empty or restricted state, no formatter module, no table abstraction `[CODE]`. Finishing screen by screen without these repeats the same defects 40 times.
- **Factory-worker acceptance: NOT VERIFIED.** No employee has used any of this.

---

## 2. Current repository and release state

| Item | Finding | Tag |
|---|---|---|
| `feature/ui-redesign` | `7d01d5f`, 15 commits ahead of local `main`, clean, checked out in `.claude/worktrees/reception-2` | `[CODE]` |
| This worktree | `claude/date-harvest-design-plan-751fc7` at `4c876c9`, clean before this session | `[CODE]` |
| `:8080` / `:4000` | Parent checkout on `stabilize/baseline` `8ab1bc5`, Atlas. **Does not contain `dd7856d`, so the QC bypass route still exists there** | `[CODE]` |
| `main` | Local `4c876c9`. Pushing `main` deploys to GitHub Pages | `[CODE]` |
| Peer session | Reception 2.0 fork `b6ac8a`, idle. Owns the private stack naming | `[BROWSER]` |
| Private stack left running | `:8130`, `:4130`, `:8131`, Mongo `:27327`. `:4131` is down | `[BROWSER]` |
| Staging | None exists in the repo: Railway config is API-only, nothing names a staging host | `[CODE]` |

**Corrections to the earlier report**

| Earlier claim | Actual |
|---|---|
| Railway fallback is an open risk | **Fixed** in `608e670`. `VISUAL_ACCEPTANCE.md` still lists it, so the doc is stale |
| 15/17 frozen build, cause unknown | `7d01d5f` records 17/17 on a static host with a cross-origin API and blames the `vite preview` proxy. Not rerun here |
| "39 routes" | 39 **matrix rows**, including Shell and Dark theme. Real: 7 paths, 20 `?tab=` values, 3 `view=` variants, 4 legacy aliases |
| `/dashboard` redirects, PASS | It renders `Index` in place. Keep, correct the row `[CODE]` |
| Storage overview PASS | **Reopen**: false zeros for roles the API refuses `[BROWSER]` |
| Reception register PASS | **Reopen**: active-list errors unread, gives a false "Aucune" (`ReceptionDashboardV2:373,316`) `[CODE]` |
| QC queue PASS | **Reopen**: no empty state, errors handled on scan only `[CODE]` |
| Shell PASS | **Reopen**: navigation offers screens the API refuses `[BROWSER]` |
| 19-tab sweep is complete | Misses `?tab=materials`: the director cannot open it `[CODE]` |
| Analytics has 9 tabs | 9 for ADM, a **different 5-tab screen** for other roles `[CODE]` |

**Re-measured gates on `7d01d5f`:** client TypeScript 215 (reported 213), lint warnings 994 (reported 358), server TypeScript 0, Vitest 505 passed with 73 skipped. Details in section 21. The 17 browser scenarios were not rerun.

---

## 3. Environment safety findings

**Already solved `[CODE]`:** `src/lib/apiTarget.ts` has no built-in host. `resolveApiBaseUrl` falls back to same-origin. `vite.config.ts` refuses a build with no named target. `scripts/build-test-bundle.mjs` fails if a Railway host or a Git Bash-rewritten path appears in output. `scripts/lib/api-target-guard.mjs` refuses non-local hosts and ports 4000/8080. `deploy.yml` requires the `VITE_API_URL` secret. `dotenv.config()` has no `override`, so exported variables win.

**Still unsafe**

| ID | Risk | Evidence | Fix |
|---|---|---|---|
| E1 | Any extra Vite server defaults its proxy to `:4000` (Atlas) | `vite.config.ts:112` `[CODE]` | Throw if `VITE_DEV_PORT` is not 8080 and `VITE_API_PROXY_TARGET` is unset |
| E2 | The server has no database guard at startup | `server/src/index.ts` only logs `[CODE]` | Add `APP_ENV` (`production`, `live-dev`, `dev`, `test`). `test` and `dev` refuse non-local hosts |
| E3 | `seedDatabase()` writes demo records on every start when `NODE_ENV !== production`, so `:4000` runs it against Atlas | `server/src/seed.ts:70`, `index.ts:16` `[CODE]`; effect on Atlas `[UNVERIFIED]` | Run demo seed only when `APP_ENV` is `dev` or `test`. Read-only check of Atlas needs the user's go-ahead |
| E4 | `/health` does not say what it is | `app.controller.ts:6-35` `[CODE]` | Add `environment` and `database_host_class` (`local`/`remote`), never the URI |
| E5 | Scripts cannot prove the target | `[CODE]` | Preflight: every mutating test asserts `environment === 'test'` and `local` first |
| E6 | The screen looks identical on every stack, which already confused the user | memory, `[BROWSER]` | Non-production ribbon in the header naming the environment |
| E7 | Migrations and `create_*_collections.js` have no guard; one hardcodes `date_harvest_hub` | `[CODE]` | Add `assertSafeDbTarget` |
| E8 | Private stack runs `NUMERIC_SIGNATURE_GATE=warn` | launch command `[BROWSER]` | Acceptance stack uses `enforce`, otherwise a QC pass proves nothing |

**Environment contract `[DESIGN]`**

| Env | Ports | Database | `APP_ENV` | Writes by automation |
|---|---|---|---|---|
| Live dev, the user's | 8080 / 4000 | Atlas | `live-dev` | **Never** |
| Isolated dev with hot reload | 8090 / 4090 | local replica set `:27327`, `dhh_dev` | `dev` | Yes |
| Browser tests | 8091 / 4091 | `dhh_e2e_<session>` | `test` | Yes, wiped per run |
| Frozen build | 8092 static / 4092 | `dhh_e2e_<session>` | `test` | Yes, via `build:test` and `static-server.mjs` |
| Staging | hosted, name contains a test label | its own | `staging` | Yes, after the user provisions it |
| Production | GitHub Pages + Railway | Atlas | `production` | Never |

`:8080` keeps working unchanged: the user adds one line `APP_ENV=live-dev` to `.env`. Until then an unset value warns and does not refuse. The user keeps the single URL they know; acceptance happens beside it. Stop any test stack after use and tell the user, per the standing rule.

---

## 4. Full route-by-route audit matrix

**Class:** A redesigned. B inherited styling only. C inspected, interaction not verified. D blocked by permission or missing data. E obsolete.
**Evidence** is Desktop / Tablet-phone / Interaction / A11y / browser Test: `✓` done, `~` partial or stale, `–` none. Today's evidence comes from `SCREEN_MIGRATION_MATRIX.md` plus this session.
**Severity** is the worst open defect: S1 false information or data exposure, S2 blocks or misleads a task, S3 quality, S4 polish.
**ADM** = `directeur_usine`, `directeur_general`, `administrateur_systeme`.

### Top-level paths

| # | Route | Component (lines) | Roles | Job | Class | Evidence | Sev | Action | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `/auth` | `Auth` | all | Sign in | C | ✓ ~ ✓ – H | S4 | POLISH: "Show" in English, flag-emoji button name, three product names | 1 |
| 2 | `/` | `Index` | all | Shell, resolves tab | C | ✓ ✓ ✓ ~ all | S1 | RESTRUCTURE nav vs permissions; split `Index.tsx` data fetching | 1 |
| 3 | `/dashboard` | `Dashboard` renders `Index` | all | Legacy link | A | ✓ ✓ – – – | S4 | KEEP, fix matrix wording | 7 |
| 4 | `/alerts` | `AlertsCenter` | any signed-in | Standalone alerts | C | ✓ ~ ~ ✓ – | S3 | MERGE: redirect to `?tab=alerts` after checking consumers (`notifications.ts:145`) | 6 |
| 5 | `/portail` | `SupplierPortal` (441) | `fournisseur_externe` | Supplier self-service | D | ~ ~ – – – | S1 | RESTRUCTURE: blocked, no seed account, no in-app link, no role check, fetches all suppliers | 6 |
| 6 | `/passport/:lotId` | `PassportPage` (143) | public | Public trust page | C | ~ ~ – – – | S3 | POLISH: `tipHash` shown publicly, raw error text | 6 |
| 7 | `*` | `NotFound` | all | Recovery | B | ✓ – – ✓ – | S4 | KEEP | 7 |

### Today

| # | Route | Component (lines) | Roles | Job | Class | Evidence | Sev | Action | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 8 | `?tab=home` | `HomePage` (241) | all | What to do now, follow a lot | C | ✓ – – ~ – | S1 | RESTRUCTURE: "Rien d'urgent" unguarded, "Lot sans numéro" for restricted roles `[BROWSER]`, tinted tiles | 6 |
| 9 | `home&view=fiches` | `FichesTechniquesHub` | all | Reference sheets | – | none, **not in matrix** | S3 | POLISH | 6 |
| 10 | `?tab=scan` | `ScanStation` (1379) | 25 roles | Scan a lot, see its history | C | ✓ ~ – ~ – | S2 | RESTRUCTURE: raw `.slice(-6)` ids, raw status, nested tabs | 4 |
| 11 | `?tab=alerts` | `AlertsCenter`, `FactoryAlertsCenter` (597) | 23 roles | See what is wrong | C | ✓ ~ ~ ✓ – | S1 | RESTRUCTURE: 14 roles refused `reception-alerts`, no error state | 6 |
| 12 | `?tab=live` | `FactoryCommandCenter` (574) | 25 roles | Wall display | C | ~ ~ – ~ – | S1 | RESTRUCTURE: `?? 0` with no error state; refused for operators `[BROWSER]`; limit nav to roles the API serves | 6 |

### Filière

| # | Route | Component (lines) | Roles | Job | Class | Evidence | Sev | Action | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 13 | `receptions` today, registry | `ReceptionDashboardV2` (528) | reception, quality, ADM | Register | A, reopened | ✓ ✓ ✓ ✓ ABJKR | S1 | POLISH: false "Aucune", lists cap at 100 | 2 |
| 14 | `receptions` pending | same | same | Open drafts | C | **not in matrix** | S2 | POLISH | 2 |
| 15 | `receptions` alerts | same | same | Reception alerts | C | **not in matrix** | S3 | POLISH | 2 |
| 16 | `receptions` intake | `ReceptionIntakeFlow` (487), `StepDelivery`, `StepLotWeighing` | operator, chef | Book a delivery | A | ✓ ✓ ✓ ✓ A-F,H,L,R | S2 | RESTRUCTURE step 2, states acceptance | 2 |
| 17 | Reception detail | `ReceptionDetailV2` (767) | same | One reception | B | **not in matrix** | S2 | RESTRUCTURE: 6 sections, 13 dialogs, 1 hover-pattern control | 2 |
| 18 | `receptions&view=bra` | `DocumentsWorkspace` | same | Print BRA | B | **not in matrix** | S3 | POLISH | 2 |
| 19 | `receptions` QC queue | `ReceptionQcQueue` (223) | quality | What to inspect | A, reopened | ✓ ✓ ✓ ✓ GSVPQ | S2 | POLISH: empty and error states; give inspectors a direct route | 2 |
| 20 | QC inspection | `QCInspectionDialog` (1374) | quality | Inspect and decide | C | ✓ – ✓ – PQ | S1 | RESTRUCTURE into a full workspace | 2 |
| 21 | `storage` overview | `StorageZonesOverview` (1978) | 13 roles | Warehouse now | A, reopened | ✓ ✓ ✓ ✓ V | S1 | RESTRUCTURE: false zeros `[BROWSER]`, "Temps réel" always live | 1, 4 |
| 22 | `storage` lots | same | same | Find, place, isolate | C | ✓ ~ ~ ✓ – | S2 | RESTRUCTURE: master-detail, quarantine view | 4 |
| 23 | `storage` zones | same | same | Zone contents | A | ✓ ✓ ✓ ✓ – | S3 | KEEP, add error state | 4 |
| 24 | `storage` mouvements, conditions | same | same | History, conditions | C | – ~ – ~ – | S3 | POLISH | 4 |
| 25 | `storage` gestion | same | `canManage` | Zone config | C | – ~ – ~ – | S3 | POLISH | 4 |
| 26 | `production` today | `ProductionToday` (215) | ADM, production | Today's work | C | ✓ ✓ ~ ✓ – | S1 | POLISH: "Rien pour le moment" has no loading or error branch | 3 |
| 27 | `production` orders | `ProductionOrdersList` (119) | same | Order list | C | ✓ ~ ~ ✓ – | S3 | POLISH | 3 |
| 28 | Order detail | `ProductionOrderDetail` (348) | same | Run an order | C | ~ – ~ – – | S1 | RESTRUCTURE: page not dialog, cancel unconfirmed, hardcoded 15 % / 5 % | 3 |
| 29 | `production` pipeline | `ProductionPipelinePanel` (214) | same | Lots to launch | C | **not in matrix** | S2 | POLISH: raw `EN_COURS`, broken lot handoff | 3 |
| 30 | `production` stages | `Fumigation`, `Nettoyage`, `Hydratation`, `Triage` panels | operators | Run a cycle | C | ~ ~ ~ ~ – | S2 | RESTRUCTURE with active-cycle data; icon-only actions in Triage | 3 |
| 31 | `production` alertes | `Phase2AlertsPanel` (490) | same | Stage alerts | C | **not in matrix** | S3 | POLISH | 3 |
| 32 | `production` lignes | `ProductionLinesPanel` (616) | same | F1–F8 | C | ✓ ~ ~ ✓ – | S3 | POLISH: "Flux F1–F8" stale name | 3 |
| 33 | `production` bilan | `MaterialBalancePanel` (372) | same | Mass balance | C | ~ ~ – ~ – | S2 | RESTRUCTURE states: none exist; "données MongoDB" | 3 |
| 34 | `production` HACCP | `HaccpDashboard` (294) | same | HACCP plan | C | ✓ ~ ~ ✓ – | S3 | POLISH | 3 |
| 35 | `production` indicateurs | `ProductionKpiPanel` (341) | same | KPIs | C | ✓ ~ – ✓ – | S1 | RESTRUCTURE: FS2=0 reads on target, 9 null KPIs | 3 |
| 36 | `packaging` | `PackagingDashboard` (206) | packaging, ADM | Orders, BOM, labels, palettes | B | ~ ~ – ✓ – | S3 | POLISH, 4 tabs | 5 |
| 37 | `logistics` | `LogisticsDashboard` (1289), `TransportWorkspace` (1358) | logistics, ADM | Ship goods | B | ~ ~ – ~ – | S2 | RESTRUCTURE: 6 tabs, no loading or error, "MOCK RECALL EXERCISE" | 5 |
| 38 | `logistics&view=bde` | `DocumentsWorkspace` | same | Print BDE | B | **not in matrix** | S3 | POLISH | 5 |

### Bureau

| # | Route | Component (lines) | Roles | Job | Class | Evidence | Sev | Action | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 39 | `quality` | `QualityDashboard`, `CAPAPanel`, `AuditTrailPanel` | quality managers, ADM | CAPA, audit | B | ~ ✓ – ✓ – | S3 | POLISH, translate severities and audit codes | 2 |
| 40 | `suppliers` | `SuppliersList` (346), `SupplierDetailSheet` (956), `SupplierDialog` (951) | ADM, buyers | Manage suppliers | C | ✓ ~ – ✓ – | S2 | POLISH: score and filter use different formulas | 5 |
| 41 | `materials` | `MaterialsList` | admin, buyers | Article master | **Unseen** | **not in matrix** | S3 | RESTRUCTURE: never inspected, native confirm | 5 |
| 42 | `purchasing` | `PurchasingDashboard` (742) | buyers, ADM | P2P | B | ✓ ✓ – ✓ – | S2 | RESTRUCTURE: three competing primaries `[BROWSER]`, red on a constructive action, 8 tabs | 5 |
| 43 | `customers` | `CustomersDashboard` (270) | ADM, commercial | Client records | B | ~ – – ~ – | S3 | POLISH | 5 |
| 44 | `export` | `ExportDashboard` (841) | logistics, ADM | Contracts, COA | B | ✓ ~ – ~ – | S2 | RESTRUCTURE: ~8 title-only row actions, status step has no confirmation | 5 |
| 45 | `maintenance` | `MaintenanceDashboard` (179) | maintenance, ADM | Requests | B | ~ ~ – ✓ – | S3 | POLISH: title-only icons, raw ids | 6 |
| 46 | `hr` | `HRDashboard` (996) | managers | Attendance, tasks | B | ~ ~ – ✓ – | S3 | POLISH: title-only icons, raw ids | 6 |

### Direction

| # | Route | Component (lines) | Roles | Job | Class | Evidence | Sev | Action | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 47 | `analytics`, ADM | `FounderAnalyticsDashboard` (184), 9 tabs | ADM | Plant view | C | ~ ~ – ✓ – | S1 | RESTRUCTURE: undisclosed 100 defaults, "100%", "15 s" | 6 |
| 48 | `analytics`, others | `AnalyticsDashboard` (123), 5 tabs | managers | Department view | **Unseen** | **not in matrix** | S1 | RESTRUCTURE | 6 |
| 49 | `sage-operations` | `SageOperationsHub` (157), `MarginCockpitPanel`, `GoldenThreadPanel` | ADM, managers | Cross-module cockpit | C | ~ ~ – ~ – | S3 | POLISH: "Hash OK", "W1", raw `lotId`, Blocages capped at 5 | 6 |
| 50 | `settings` | `SettingsDashboard` (152), 13 tabs | ADM | Configuration | C | ~ ~ – ~ – | S2 | RESTRUCTURE: flat 13 tabs; silent `DEFAULT_SETTINGS` on failure | 6 |

**Global rows:** dark theme, decision in section 5. Legacy `stock-*` aliases, KEEP as redirects, the unreachable `:354-360` cases go. Obsolete (class E) is listed in section 14; no route is class E.

---

## 5. Design system assessment

**Keep unchanged `[DESIGN]`:** palette scales and the Tailwind remap, radii (3/4/6), flat shadows, Barlow and Semi Condensed, tabular figures, underline tabs, `SummaryStrip`, bottom-left toasts, Filière thread. Remapping put 3,267 legacy classes on the system with no per-file churn, and that was a good decision.

**Real inconsistencies `[CODE]` unless noted**

| Area | Finding | Decision |
|---|---|---|
| Deglet discipline | Amber CTA "Affecter les lots", amber `Générer…` buttons `[BROWSER]`. Rule says Deglet is the thread only | Actions are Palme or neutral. Banner tone carries urgency |
| Semantic colour | Red "Générer les DA de réappro" `[BROWSER]`: danger on a safe action | Red only for destructive actions and danger status |
| Type sizes | `text-[`: 337 uses, 241 are `11px`. Below the 12 px floor the doc states | Add a `text-2xs` token at 12 px, codemod `11px`/`10px` outside print files |
| Fonts | Google `@import`, nothing precached, no `woff2` in `dist` | Self-host Barlow 400/500/600 and Semi Condensed 500/600/700 in `public/fonts`, drop the `@import`. Factory offline is the normal case |
| Bold | `font-bold` available but Barlow 700 not loaded | Add it or map to 600 |
| Touch | `size="sm"` is `h-8`, `pointer-coarse:h-10`, used 277 times. Doc promises 44 | `pointer-coarse:h-11`. 32 px at fine pointer is measured `[BROWSER]`; coarse needs a touch-emulated run |
| Page headers | `ModuleHero` in 3 files, `h1` in 9 | One header in `TopHeader`. Delete `ModuleHero` after migrating |
| Status | 18 colour maps in `types/*`, 12+ local, `LotStatusBadge` dead in the app | One `StatusBadge` keyed by domain, labels in one place |
| Loading | 89 `animate-spin`, 3 Skeleton, uppercase "CHARGEMENT" `[BROWSER]` | One loader, sentence case |
| Template tells | Middle-dot strings, chevrons on every row, `→` on buttons `[BROWSER]` | Remove. Keep an arrow only when leaving the screen |
| Brand | "MES Dattes", "Date Harvest Hub", "Royal Palm"; `#107754` theme colour vs primary `#0E5A4B`; `v2.0` vs `v2.1.0` | **Date Harvest Hub** is the product, the factory name comes from Branding |
| Dark theme | `.dark` tokens predate the redesign, no code sets the class, 48 `dark:` uses | **Not supported.** Remove the block and classes in Wave 7. A factory-floor dark mode would be a separate project |
| Hex | 639 in tsx, top files are print templates; screen hex in `analytics/founder/*` | Print keeps its own. Screen hex moves to tokens with Wave 6 |

**Verdict:** focused improvement reaches premium quality. No replacement, no second component library.

---

## 6. Final proposed visual direction

Checked against the installed `frontend-design` skill, whose SKILL.md was read this session.

**A. Identity.** Date Harvest Hub looks like instrumentation built by someone who has stood in a Tozeur packing hall: warm, exact, unornamented. It should read as equipment, not software marketing.

**B. Principles.**
1. Truth before calm: an unknown is never displayed as zero.
2. The next permitted action is the most visible thing on screen.
3. Blocked is stated with its reason and who can unblock it.
4. A status always has a word.
5. One primary action per view, last and on the right.
6. Density for desks, reach for tablets: the same layout, adjusted by pointer.
7. Employee language: "Mettre en quarantaine", never `QUARANTAINE`.

**C. Typography.** Barlow; Semi Condensed for titles, table heads and codes. Scale: 12 label, 14 body, 16 tablet body, 18 title, 22 section figure, 32 measure. Figures are tabular with slashed zero for codes. Units sit one step smaller beside the number (`900 kg`). The 32 px measure is reserved for what an operator must read at arm's length: net weight, cycle time, remaining quantity. This is the one expressive move in the type system.

**D. Colour.** Tokens stay. Corrections are in section 5.

**E. Density.**

| Context | Row | Control | Body |
|---|---|---|---|
| Desk, fine pointer | 36 px | 40 px, compact 32 px | 14 px |
| Tablet, coarse pointer | 48 px | 44 px minimum | 16 px |
| Phone | Stacked rows | 44 px | 16 px |

**F. Navigation.** Section 7.

**G. Components.** Section 14.

**H. Workflow.** Every operational screen answers, top to bottom: my work, next permitted action, quantities, progress, what blocks. Each operation has one page; dialogs only for the PIN and short confirmations.

**I. Feedback.** Five truthful states, one component (`DataState`): loading, empty, error with retry, restricted, offline/stale. Copy states what happened, then what to do. English server messages never reach the screen.

**J. Visual signature.** **The Filière thread becomes the lot's journey.** Today it lives only in the sidebar. The same thin Deglet line carries through the Home lot view, the order's steps and the lot history, so one mark always means "where this lot is". It is the only ornament in the product, and Deglet is taken off everything else so the mark keeps its meaning.

**Skill challenge.** Reviewed against the skill's listed defaults. Not the cream-and-terracotta look; not near-black with an acid accent; the salt background is cool and grounded in Chott el Djerid. Risks found and addressed: identical tile rows (Home, section 5), template chrome (section 5). Tested by imagining a similar brief: a generic factory ERP lands on dark green, card grids and KPI tiles, and this plan moves away from each.

---

## 7. Role-based navigation architecture

Groups stay **Aujourd'hui, Filière, Bureau, Direction**: they follow how lots actually move, and they already work with the thread. The conceptual groups in the brief map onto them.

**Proposed sidebar `[DESIGN]`**

```
Aujourd'hui   Accueil, Scanner, Alertes, En direct*
Filière       Réception, Contrôle qualité (new entry), Stock, Production,
              Conditionnement, Expédition
Bureau        Qualité, Fournisseurs, Articles, Achats, Clients, Export,
              Maintenance, Ressources humaines
Direction     Indicateurs, Cockpit usine
Système       Paramètres
* only for roles the API serves
```

**Rules**
- "Contrôle qualité" opens the existing queue via `receptions&view=qc`. Inspectors have no `quality` tab, so their main job is four clicks away behind "Réception" today `[CODE]`. No new screen, one link.
- A tab is shown only if the role can load its primary data. Server stays authoritative.
- Add `materials` to ADM client access only if the server already permits it; otherwise record it.
- Portal roles land on `/portail`, with its own minimal shell.
- Mobile sheet includes Scanner, which it omits today `[CODE]`.
- Breadcrumbs are not needed: depth is two levels. "Retour" on detail pages is enough.
- Global search keeps `CommandMenu`, and adds lot number lookup.

**Role experience**

| Role | Primary tasks | Lands on | Must be immediate | Remove from view |
|---|---|---|---|---|
| Reception operator | Book deliveries | Réception, today | Nouvelle réception, drafts, sync state | En direct, unrelated Stock |
| Quality inspector | Inspect, record evidence | QC queue | Queue, missing evidence | Stock (API refuses), Indicateurs |
| Warehouse employee | Place, move, isolate | Stock, lots | Scan, lots to place, quarantine | En direct, Conditionnement |
| Line operator | Run a cycle | Own stage | Active cycle, next action, blockers | Everything outside the stage |
| Supervisor | Exceptions, assign | Module today | Blocked items, overdue | Founder analytics |
| Manager | Plant visibility | Home, Indicateurs | Exceptions with sources | Step-level forms |
| Admin | Users, settings, audit | Paramètres | Permissions, audit | Operator lists |

**403 answer.** Production Manager 403s are **an integration mismatch, not a permissions bug** `[BROWSER]` `[CODE]`. `getAccessibleTabs` grants `storage`, while `STOCK_ACCESS_ROLES` and `STORAGE_ROLES` exclude the role. The server rule is the authority and is **not weakened**. Client navigation is corrected, and a contract test keeps both sides aligned. If the factory wants production managers to read stock, that is a separate decision for the user.

Measured 403s by role, private stack `[BROWSER]`:

| Role | Refused of 20 sampled reads | Notable |
|---|---|---|
| `responsable_production` | 8 | All stock and storage, `receptions`, `reception-alerts` |
| `inspecteur_qualite` | 10 | All stock, storage, analytics |
| `operateur_reception` | 9 | Stock, `live-factory` (yet En direct is in nav) |
| `operateur_fumigation` | 12 | Includes `reception-alerts`, `live-factory` |
| `magasinier_wms` | 3 | `live-factory`, packaging |
| `auditeur_externe` | 13 | Holds `receptions` tab while `receptions` is refused |
| `responsable_stock`, `directeur_usine` | 0 | |

---

## 8. Reception redesign requirements

The engine stays. `useReceptionDraft`, `lib/receptionIntake.ts`, the outbox and idempotency are not rewritten.

| Question the operator asks | Today | Required |
|---|---|---|
| Who is delivering? | `SUP-E2E-A · Oasis Essai Alpha` in the header | Name first, code secondary |
| What is arriving? | Fine | Keep |
| What is the real weight? | Net in a tile, mid-form | Net in the 32 px measure, pinned in the sticky bar on steps 2 and 3 |
| What is missing? | Blockers on step 3 | Same list live on step 2, each link jumps to its field |
| Can I confirm? | Button | Disabled state states the reason in words |
| What happens next? | Good line on step 3 | Keep. Result screen names lot numbers and "Va en contrôle qualité" |

**Step 2 restructure.** It is 1,700 px tall and mixes weighing, lots, arrival and photos `[BROWSER]`. Split into three labelled sections inside the step: Pesée, Lot et supports, Arrivée et photos. Each collapses to a one-line summary when complete. **Keep three steps.**

**Provenance.** Connected readings are stored only after HMAC verification, `signature_verified: true` (`weighbridge.service.ts:152`) `[CODE]`, so "lecture signée" is accurate for server readings. Still pass the reading's flag explicitly at `ReceptionIntakeFlow:419`, so the wording cannot claim more than the data. Manual stays visibly manual.

**States to accept.** Empty, loading and error of each list; long supplier names; Draft resumed; conflict (two editors); closed by another; offline; pending sync; failed sync; session expired during drain; duplicate confirmation; refused confirmation; camera denied.

**Fixes.** False "Aucune" (D-09). `4 palette` plural. Failed outbox items need a discard path with a supervisor-visible record. Registry lists past 100 need paging. Native `confirm` replaced. Photo removal visible on touch. `ReceptionDetailV2` opens on the facts, 13 dialogs reduced where a section can hold the content.

**Not verified and stays so:** physical scale, factory UAT.

---

## 9. Quality redesign requirements

**Independent gate review**

| Item | Status | Tag |
|---|---|---|
| `POST /batches/:id/decide` removed | Yes on this branch, **still present on `:8080`** | `[CODE]` |
| Release PIN fails closed | `releaseSignatureGateMode` enforces in production and when unset | `[CODE]` |
| Only a QC decision raises stock to VALIDATED | Per `dd7856d`, scenarios G, S, V, P, Q | `[TESTS]`, rerun in Wave 0 |
| Evidence required by server | `qc-evidence.ts`, checklist version enforced | `[CODE]` partial |
| Provisioning | PINs unset for real users; checklist unsigned | `[UNVERIFIED]` external |
| Decided-inspection rewrite, proven in the QMS plan | Closed per commit messages, not independently re-proven | `[UNVERIFIED]`: add a read of `collections.service.ts` guards to Wave 0 |

Passing tests do not establish that security is complete. Wave 0 reruns them with `NUMERIC_SIGNATURE_GATE=enforce`.

**Defects in the inspection**

| ID | Finding | Tag | Fix (display and entry only, no scoring change) |
|---|---|---|---|
| D-05 | With measurements missing, classification is hidden, but "Rejet automatique" (`:953`) and the "auto" tag (`:994`) still show | `[CODE]` | Guard both on `missingMeasurements === 0` |
| D-06 | Empty humidity list scores 0 | `[CODE]` | Show "À mesurer", not a figure, per criterion |
| D-07 | Taste, texture, appearance start at 5/5; lab `conformant: true`; defects start at 0 | `[CODE]` | Start empty, require an answer. **This strengthens evidence.** Confirm rule with `royal-palm-phase1-detail.txt` first |
| D-08 | Closing the dialog drops measurements; resume restores only the inspector | `[CODE]` | Keep a local draft keyed by inspection |
| D-10 | Raw `ACCEPTE` on buttons, English "Warning" | `[CODE]` | Labels |

**Workspace.** Replace the 1,374-line dialog with a page, `?tab=receptions&view=qc&inspection=<id>`. Keep validation logic and extract `useQcInspection`.

```
+----------------------------------------------------+
| LOT-0016  Deglet Nour  900 kg  Fournisseur          |
| Thread: Réception ── Contrôle ─ ─ Stock             |
+-----------------------------+----------------------+
| Measures                    | À faire              |
| Checklist                   | 2 mesures manquantes |
| Defects                     | 1 photo requise      |
| Evidence                    | Qui décide:          |
|                             | responsable qualité  |
|                             | Décision + PIN       |
+-----------------------------+----------------------+
```

At 768 px the right column becomes a sticky bottom summary. The PIN stays a focused dialog. Restricted roles see a read-only record and "Décision réservée à…". A refused decision keeps every entry.

---

## 10. Production redesign requirements

No calculation changes.

- **Navigation.** 12 views exist in three groups in code, but at 768 px they are one sideways strip of plain buttons `[BROWSER]`. Keep the Travail, Étapes, Suivi groups, use `role="tablist"`. At desk width: visible groups. Under 1280 px: the group chip row plus a Vue menu, nothing hidden off-screen.
- **Role scoping.** Line operators see Travail plus their own stage. `Suivi` belongs to supervisors and managers.
- **Order detail becomes a page**, `?tab=production&order=<id>`, so reload works and the dialog rule holds. Header: code, product, status, one next action. Below: thread of steps, lots, quantities. Facts move to a secondary panel.
- **Step names.** Existing screenshot shows "Étape 1, 2, 3" with no name `[BROWSER]`. Use the definitions in `types/production-lines.ts`. Cause not traced.
- **Blockers.** Every disabled action prints its reason. "Les étapes précédentes doivent être terminées" is the model.
- **Safety.** Cancelling a running order needs a confirmation naming the consequence (D-11).
- **Lot handoff.** Pass `lotQuery` to stage panels, and read `?view=` on load so reload keeps the view (D-19).
- **Metrics.** Replace hardcoded 15 %/5 % progress with real steps, or remove them. KPI cells with no data read "Pas encore de données", never on target. "MAJ 30 s" only if confirmed.
- **Management view.** Bilan, HACCP and Indicateurs stay in `Suivi`, so they never appear in an operator's work.

**Acceptance data:** one active fumigation cycle, cleaning in progress, hydration paused, triage session, in-progress order with allocated lots, blocked order, completed order with output lots, HACCP deviation, stage alert. Needs the fixture seed from Wave 0. Quantities are synthetic, with `Données de démonstration` notes.

---

## 11. Stock and warehouse redesign requirements

**Layout decision `[DESIGN]`**

| Task | Layout |
|---|---|
| Find, filter, compare lots | Table with sticky head |
| Act on one lot | Master-detail: side panel on the same page |
| Understand zones | Existing list with one open zone. Keep |
| Spatial map | **Rejected**: no coordinate data, would invent a floor plan |

**Requirements**
- Quarantine is a first-class view with a count, and `focus=quarantine` works (`HomePage:87` drops it today).
- `defaultTab="zones"` is honoured (`Index:358`).
- Blocked stock is never summed into available; `V` scenario stays green.
- "Temps réel" pill reflects the real SSE state (D-13).
- Occupation shows the method: unweighted average of zones is misleading, so show used/total capacity if the data supports it, otherwise label it. No silent formula change: confirm first.
- Replace `RG-S10` with a sentence. Remove `.slice(-6)`.
- Assign flow stays the single path, and `StorageAssignment` (537) is compared with the dialog at `:1653` to remove divergence, not logic.
- Tablet: table collapses to two-line rows, primary action stays visible.

**Refactor.** Split `StorageZonesOverview` (1,978 lines) into `stock/overview`, `lots`, `zones`, `movements`, `conditions`, `management` with `useStorageData`. The dead `batches/tabs/*` island is stale: **delete it, do not revive it.** UX benefit: each tab can have honest states, and code review of QC-eligibility paths becomes possible.

---

## 12. Commercial and logistics requirements

Pricing, settlements, scoring, separation of duties and financial calculations do not change.

| Module | Goal | Shortest safe workflow | Key changes |
|---|---|---|---|
| Suppliers | Find, assess, maintain | List → side sheet | Alert in words, not a tooltip. Show one score, and record the two-formula mismatch for a decision |
| Articles | Master data | List → edit | First inspection, shared table, replace native confirm |
| Purchasing | Need to payment | Needs → DA → BC → receipt → invoice | Merge two generate banners into one "À réapprovisionner" row. Primary is "Préparer une DA". Group 8 tabs as Besoins, Commandes, Suivi. Remove false "Synchronisation SAGE" loader. Icon actions get labels |
| Clients | Records | List → sheet | Shared table, sticky head |
| Export | Contract to shipment | Order row → next action | One visible next action, rest in a menu. Status step gets confirmation and error handling. "Pas de lignes" instead of a computed 0 % COA |
| Packaging | Order → labels → pallets | Orders first | Keep 4 tabs, states |
| Logistics | Ship | Shipments → next action | Rename "MOCK RECALL EXERCISE" as "Exercice de rappel". Remove the fake `generationTime`. Accents |
| Transport | Plan a load | Workspace | Add states, split 1,358 lines |
| Portal | Supplier self-service | Own record | Seed a supplier account. Separate error from no-account. Confirm `GET /suppliers` is scoped server-side (D-04) |

---

## 13. Dashboard and support requirements

**Status of the earlier findings**

| Finding | Status |
|---|---|
| Idle stages as EXCELLENT | Disclosed in text; sub-scores still default to 100 server-side `[CODE]`. Show "Pas d'activité" per sub-score. Calculation unchanged |
| Cost variance | Held back with no production `[CODE]` |
| Notification count mismatch | One centre `[CODE]`. Refused data for 14 roles means counts can still differ by role: state it |
| Passport codes | Replaced; `tipHash` remains public |

**Remaining `[CODE]`:** Undisclosed `condCompliance` and `yieldRate` default to 100. "15 s" and "100%" hardcoded in Analytics. Trend is 0 or a negated reject rate. Blocages capped at 5. A failed query shows `0/100`.

**Rule:** every figure has a source and a period, and can open the records behind it. No data reads "Pas de données". A failed load is an error. Decorative tiles go. Home keeps tasks, drops the six tinted tiles, because the sidebar already does that job.

**Settings.** 13 flat tabs, grouped as Usine, Exploitation, Système. "Produit" and diagnostics go last, plain words. Failed load states that defaults are shown, and disables saving. Currently the failure is silent, which could overwrite real settings.

**Scan.** Search first, then one lot page with the thread. Six inner tabs stay. **RH, Maintenance:** labels on icons, names in place of `.slice(0, 8)` ids.

---

## 14. Shared component architecture

Each item earns its place by a defect it closes. Nothing else is added. No new runtime dependencies except self-hosted font files.

| New or changed | File | Replaces | UX benefit |
|---|---|---|---|
| `DataState` | `src/components/shared/DataState.tsx` | ~100 ad hoc branches | The five truthful states everywhere |
| `AppErrorBoundary` | `src/components/shared/AppErrorBoundary.tsx` | none, 0 today | A crash is recoverable, not a white page |
| Global query handler | `src/App.tsx` `QueryCache` | none | Session and 403 handled consistently |
| `friendlyError` | `src/lib/apiErrors.ts` | English strings in `axiosClient:78-79` | French, actionable messages |
| `format` module | `src/lib/format.ts` | 43 local helpers | One way to write `1 250,5 kg` and dates; unify `fr-FR` vs `fr-TN` once |
| `StatusBadge` | `src/components/shared/StatusBadge.tsx` | 30+ maps | One status vocabulary |
| `LotRef` | `src/components/shared/LotRef.tsx` | 74 render sites | Same lot reads the same everywhere; never "undefined", never a UUID |
| `DataTable` | `src/components/shared/DataTable.tsx` | Raw markup in high-traffic lists | Sticky head, sort, density, built on `ui/table`. **No TanStack Table** |
| `ConfirmAction` | `src/components/shared/ConfirmAction.tsx` | 4 native `confirm` | Consequence in words, safe on touch |
| `useRoleAccess` contract | `src/lib/roleAccess.ts` plus a test | Drift | Nav never offers a refused screen |
| `useFactoryShellMetrics` | Returns unknown, not `[]`, when refused | Silent zeros | Header and Home stop lying |

**Forms:** keep hand-rolled forms that work. Use `react-hook-form` + zod only in forms rebuilt in this plan. `SupplierPicker` is promoted and reused in 8 forms. **State:** no new library.

**Delete after verifying no importer:** `FlowStepper`, `NavLink`, `layout/index.ts`, `stock/*`, `tasks/*`, `timesheets/*`, `batches/tabs/*`, `employees/EmployeeManagement|Dialog|List`, four `analytics/*Panel`, tablet carousel in `WorkflowNavigation:71-341,396-429`, `Index` leftovers, `ModuleHero`. **Check first:** `tasks` and `timesheets` may be unfinished work the user wants. `useForm`/zod files sit there. Ask before deleting those two.

---

## 15. Responsive and accessibility strategy

**Widths:** 1440, 1280, 1024, 768, 390. **Task checks, not overflow checks:** can this role complete this job at this width with the primary action visible? Tablet checks use **touch emulation with coarse pointer**: the sweep so far did not `[BROWSER]`.

**Long content fixture:** `Société Agricole de Tozeur et du Djérid`, `Non-conformité majeure`, `LOT-0016-AB`, `1 250 000 kg`, 14-digit references.

**Automated per route and state:** axe-core in the browser run (dev dependency, justified: this repo has no a11y tooling). Also: contrast, names, landmarks, one `h1`, keyboard path, dialog focus trap and return, `aria-sort`, `role="tablist"`, `aria-live` for errors and toasts, `prefers-reduced-motion`, 44 px targets on coarse. **Open items:** Production view strip lacks tab semantics `[BROWSER]`, title-only buttons (`HRDashboard`, `Export`, `RequisitionsList`, `Triage`), dialogs never measured.

**Acceptance is by a person reading the screenshot.** Passing axe is necessary, not sufficient.

---

## 16. Offline and realtime strategy

**Classification**

| Observation | Class |
|---|---|
| 15/17 through `vite preview` | DEVELOPMENT PROXY DIFFERENCE per `7d01d5f` `[TESTS]`, rerun required |
| 17/17 static host, cross-origin API, SW active | Local topology only, `[TESTS]`, rerun required |
| API cache shared between users | APPLICATION DEFECT `[CODE]`, runtime `[UNVERIFIED]` |
| SSE stream survives sign-out | APPLICATION DEFECT `[CODE]`, runtime `[UNVERIFIED]` |
| JWT in stream URL | APPLICATION DEFECT `[BROWSER]` |
| Unconditional reload on SW update can drop a form | APPLICATION DEFECT `[CODE]` |
| Reconnect refreshes only receptions, stock, POs | APPLICATION DEFECT `[CODE]` |
| "Temps réel" always live | APPLICATION DEFECT `[CODE]` |
| Null-owner outbox item claimed by the next user | APPLICATION DEFECT `[CODE]` |
| Vite dev SW kill-switch means dev runs prove nothing about SW | TEST HARNESS DEFECT `[CODE]` |
| Real TLS, CDN, Railway restarts, proxies | STAGING TOPOLOGY, NOT VERIFIED |

**Decision on API cache `[DESIGN]`:** set `/api` to `NetworkOnly` and exclude `/realtime`. Offline capability today lives in the outbox and drafts, and a 5-minute shared read cache adds risk on shared tablets for little gain. Verify scenario H still passes. On sign-out: `queryClient.clear()`, `resetSseConnection()`, close stream.

**Update behaviour:** do not auto-reload while a form is dirty. Show "Nouvelle version prête" with a button; auto-apply when idle.

**Employee-facing states**

| State | Words | Where | Action |
|---|---|---|---|
| Offline | Hors ligne. Vos réceptions sont gardées sur cet appareil | Header strip | None |
| Pending | 2 réceptions en attente d'envoi | Strip | Voir |
| Syncing | Envoi en cours | Strip | None |
| Sync failed | Réception refusée: reason in French | Strip, draft row | Ouvrir |
| Session expired | Reconnectez-vous pour envoyer | Strip | Se reconnecter |
| Reconnecting | Données en pause depuis 14:02 | Strip, on data pages | Actualiser |
| Stale | Dernière mise à jour 14:02 | Replaces "Temps réel" | Actualiser |

One banner, the existing `OfflineSyncStatus`, grows into this. It must work signed out, where the "Se reconnecter" button is missing today.

**Verification required:** rerun 17 scenarios on the frozen topology; add T1 cross-user cache, T2 stream change after sign-out, T3 dirty form during SW update, T4 reconnect refreshes production; run H and J on staging when provisioned.

---

## 17. Browser visual testing strategy

**Tooling.** No duplicate. `puppeteer-core` remains the runner for `scripts/e2e/*`. The Playwright MCP is the agent's eye for inspection. Do not add `@playwright/test`.

**Harness to build (Wave 0)**
- `scripts/seed-acceptance.mjs`: promotes the session-only `seed-ui.mjs` into the repo, with `assertSafeDbTarget`, `resolveTestApi` and all states from section 10, plus a supplier-portal account.
- `scripts/e2e/visual.mjs`: for route × role × width × state, sign in, open, wait for loaded, screenshot to `docs/design/screenshots/acceptance/<route>/`, record console and failed requests, run axe.
- `scripts/e2e/role-matrix.mjs`: the 20-endpoint read matrix, as a repeatable test.
- npm scripts: `e2e`, `e2e:visual`, `e2e:roles`.

**States to force:** Loaded and long via fixtures, empty via an empty database, loading and error via `page.setRequestInterception`, restricted via role, offline via `setOfflineMode`, validation by submitting incomplete, dialog open, blocked action.

**Review loop per screen:** real route → synthetic records → baseline → defects → change → render → screenshot → compare → fix → interactions → tablet and desk → record.

**Capture rule learned this session:** take each screenshot in a later step than its wait, assert the route and role before capturing, and use a browser no one else controls. Close it when finished.

**Rubric, per screen, 0 to 2 each**

| Criterion | 2 means |
|---|---|
| Visual hierarchy | The job is obvious in five seconds |
| Clarity | Plain French, no codes, units on all numbers |
| Density | Right data on screen at that width |
| Interaction efficiency | Main job in the fewest safe steps |
| Consistency | Shared components and tokens only |
| Responsive usability | Task completes at tablet and phone with touch |
| Accessibility | Axe clean, keyboard path works |
| Operational correctness | Numbers trace to source, restrictions visible, all five states honest |

**PASS:** at least 13 of 16, and **Accessibility and Operational correctness both 2**. The reviewer states what was seen. This is engineering acceptance only. Factory-worker acceptance stays NOT VERIFIED.

---

## 18. Prioritized defect register

| ID | Sev | Defect | Evidence | Wave |
|---|---|---|---|---|
| D-01 | S1 | Refused or failed data renders as zeros and "Aucun". Stock showed 0 blocked with 12 quarantined, "Temps réel", active "Déplacer un lot" | `[BROWSER]` | 1 |
| D-02 | S1 | Shared-tablet cache: `api-cache` keyed by URL, never cleared | `[CODE]` | 0 |
| D-03 | S1 | SSE stream and query cache survive sign-out | `[CODE]` | 0 |
| D-04 | S3 | Supplier portal: server already scopes rows (`filterOwnSuppliers`, `assertOwnSupplier`). Confirm with a portal account; corrected from S1 | `[CODE]` | 6 |
| D-05 | S1 | QC reject verdict shown before measurements | `[CODE]` | 2 |
| D-07 | S1 | QC answers prefilled best-case | `[CODE]` | 2 |
| D-11 | S1 | Running order cancelled with no confirmation | `[CODE]` | 3 |
| D-12 | S1 | JWT in stream URL, risk in logs and caches | `[BROWSER]` | 0 |
| D-14 | S1 | Demo seed runs at start on the API using Atlas | `[CODE]` | 0 |
| D-09 | S2 | Reception false "Aucune" on error | `[CODE]` | 2 |
| D-13 | S2 | "Temps réel" not tied to connection | `[CODE]` | 1 |
| D-15 | S2 | No ErrorBoundary | `[CODE]` | 1 |
| D-16 | S2 | Nav offers refused screens | `[BROWSER]` | 1 |
| D-17 | S2 | "Lot sans numéro" for restricted roles | `[BROWSER]` | 1 |
| D-18 | S2 | English errors reach employees | `[CODE]` | 1 |
| D-19 | S2 | Deep links and lot handoff lost | `[CODE]` | 3, 4 |
| D-20 | S2 | Fonts need internet | `[CODE]` | 1 |
| D-21 | S2 | SW update can reload mid-entry | `[CODE]` | 0 |
| D-22 | S2 | Settings failure silent, save possible | `[CODE]` | 6 |
| D-23 | S2 | Touch targets 40, not 44, on `size="sm"` | `[CODE]` | 1 |
| D-24 | S2 | Undisclosed metric defaults | `[CODE]` | 6 |
| D-25 | S2 | Production views not exposed as tabs, overflow at tablet | `[BROWSER]` | 3 |
| D-26 | S2 | Inspector has no direct path to QC | `[CODE]` | 1 |
| D-27 | S2 | Purchasing competing primaries, wrong red | `[BROWSER]` | 5 |
| D-06 | S3 | Empty measurement scored 0 | `[CODE]` | 2 |
| D-08 | S3 | QC dialog close loses measurements | `[CODE]` | 2 |
| D-10 | S3 | Raw codes across modules | `[CODE]` | each |
| D-28 | S3 | Three product names, mismatched colours and versions | `[BROWSER]` | 1 |
| D-29 | S3 | `/portail`, `/alerts` have no role check | `[CODE]` | 6 |
| D-30 | S3 | E2E not in CI, no npm script | `[CODE]` | 0, 8 |
| D-31 | S3 | Outbox: null-owner claim, any 401 reads as expired, no discard | `[CODE]` | 2 |
| D-32 | S4 | Dead code, stale docs, `.playwright-mcp` not ignored | `[CODE]` | 0, 7 |

**Withdrawn this session:** Deep-link "bounce" to Production and sidebar expanded at 768: not attributable, because something else used the browser. Password prefilled after sign-out: Chromium form restore, the app stores nothing `[BROWSER]`.

---

## 19. Dependency-aware implementation waves

```
W0 safety ──> W1 system and truth ──┬─> W2 reception, quality
                                    ├─> W3 production
                                    ├─> W4 stock
                                    ├─> W5 commercial
                                    └─> W6 management
                                             └─> W7 global QA ──> W8 integration, gate
```

W2 to W6 can run in any order after W1, but in the listed order by employee value. Run them one at a time: all five touch `format`, `StatusBadge` and shared hooks.

### Wave 0: repository and environment safety

| | |
|---|---|
| **Goal** | Automation cannot reach Atlas; S1 data-exposure fixes land; a repeatable fixture and harness exist |
| **Routes** | None visually |
| **Defects** | E1 to E8, D-02, D-03, D-04, D-12, D-14, D-21, D-30, D-32 |
| **Design change** | Environment ribbon only |
| **Reuse** | `apiTarget.ts`, `api-target-guard.mjs`, `db-target-guard.mjs`, `static-server.mjs`, `build-test-bundle.mjs` |
| **Dependencies** | None. **Backend edits are separate commits and listed for review** |
| **Integration impact** | `:8080` needs `APP_ENV=live-dev`; warns until then |
| **Tests** | 17 scenarios with `enforce`, frozen topology; `seed.test.ts`; new T1 to T4; guard tests |
| **Visual acceptance** | Ribbon reads correctly on each env |
| **Risks** | Removing API cache changes offline reads. Scenario H is the check |
| **Rollback** | Revert per commit. Env guards behind `APP_ENV` default warn |
| **Done when** | A test proves refusal of non-local targets; T1, T2 pass; harness produces a screenshot set |

### Wave 1: design system and truthful states

| | |
|---|---|
| **Goal** | Honest data everywhere; one system; correct navigation |
| **Routes** | Shell, `/auth`, plus every route through shared states; first applied to `storage` overview, Home header metrics |
| **Defects** | D-01, D-13, D-15 to D-18, D-20, D-23, D-26, D-28; section 5 table |
| **Design change** | Section 5, 7, 14 |
| **Reuse** | `SummaryStrip`, `ui/*`, `ApiRequestError`, `roleAccess` |
| **Dependencies** | W0 |
| **Integration impact** | Touches shared hooks; high regression surface. `App.tsx`, `Index.tsx`, `AppSidebar`, `TopHeader`, `useFactoryShellMetrics` |
| **Tests** | `role-matrix` contract, `DataState` unit tests, boundary test, 17 scenarios |
| **Visual acceptance** | As `responsable_production`: no Stock in nav; forced URL shows restricted state, never zeros |
| **Risks** | Hiding a tab a role uses via partial data. Check each mismatch with the matrix first |
| **Rollback** | Commit per component; nav change is one commit |
| **Done when** | No role reaches a screen whose primary data is refused without a stated reason |

### Wave 2: Reception and Quality

| | |
|---|---|
| **Goal** | Sections 8, 9 |
| **Routes** | Matrix 13 to 20, 39 |
| **Defects** | D-05 to D-10, D-31 |
| **Dependencies** | W1 |
| **Integration impact** | Must not change payloads. `buildIntakePayload` tests stay green. QC submit body unchanged except stricter client entry |
| **Tests** | A to L, S, V, P, Q, R, plus new: QC with no measurements shows no verdict; refused decision keeps entries; tablet QC |
| **Visual acceptance** | All listed states at 1440, 768 touch, 390 |
| **Risks** | QC page move breaks P, Q selectors; update tests with care, never loosen assertions |
| **Rollback** | Dialog retained until the page passes, then removed in its own commit |
| **Done when** | Rows pass rubric. PIN through a browser verified with `enforce` |

### Wave 3: Production

| | |
|---|---|
| **Goal** | Section 10 |
| **Routes** | 26 to 35 |
| **Defects** | D-11, D-19, D-25 |
| **Dependencies** | W1, acceptance fixtures |
| **Integration impact** | Order URL added to `Index`; no calculation or API change |
| **Tests** | New scenario W: start, record, pause, complete a step, blocked action shows reason, cancel needs confirmation |
| **Risks** | Order dialog consumers beyond the list: search for `ProductionOrderDetail` importers |
| **Rollback** | Page behind a route param; dialog kept until verified |
| **Done when** | Operator role reaches current work in one click, active-cycle states seen with data |

### Wave 4: Stock and warehouse

| | |
|---|---|
| **Goal** | Section 11 |
| **Routes** | 10, 21 to 25 |
| **Defects** | D-19, remaining stock items |
| **Dependencies** | W1, W2 (shared QC eligibility wording) |
| **Integration impact** | Large file split. Move code unchanged first, then change it, in separate commits |
| **Tests** | V, G, new X: assign, isolate, move, zone rule refusal, blocked never available |
| **Risks** | Regressing QC eligibility. **Stop and report if any blocked lot appears available** |
| **Rollback** | Split commit reverts whole |
| **Done when** | Warehouse role completes place, move, isolate at 768 touch |

### Wave 5: Commercial and logistics

| | |
|---|---|
| **Goal** | Section 12 |
| **Routes** | 36 to 38, 40 to 44 |
| **Defects** | D-27, module raws |
| **Dependencies** | W1 |
| **Integration impact** | Display only. Any change touching amounts stops and is reported |
| **Tests** | New Y: one P2P path to BC; export status step; separation-of-duties refusal shown truthfully |
| **Risks** | Module size. Logistics and Transport split last, only if needed for states |
| **Rollback** | One commit per module |
| **Done when** | Rows pass rubric with real workflows driven |

### Wave 6: Management and support

| | |
|---|---|
| **Goal** | Section 13 |
| **Routes** | 4 to 6, 8, 9, 11, 12, 45 to 50 |
| **Defects** | D-22, D-24, D-29 |
| **Dependencies** | W1, W3 and W4 data shapes |
| **Tests** | Each metric has a test for no data; portal scenario; settings failure disables save |
| **Risks** | Metrics needing server edits are recorded, not silently changed |
| **Done when** | Every figure has source and period; all 9 + 5 + 13 tabs read and accepted |

### Wave 7: Global visual QA

**Goal:** full matrix × roles × widths × states. Remove dark tokens, delete approved dead code, finalize docs. **Risks:** deletion; one commit per island. **Done:** all rows PASS or honestly BLOCKED.

### Wave 8: Integration, performance, acceptance

**Goal:** release candidate. Bundle review (lazy chunks exist), frozen topology, staging H and J, section 21 matrix. Add e2e to CI. **Dependencies:** user provisions staging; PINs; checklist; credential rotation. **Done:** section 23.

---

## 20. Exact file-level execution tasks

**Wave 0**
- `.gitignore`: add `.playwright-mcp/`, `docs/design/screenshots/acceptance/tmp/`.
- Fast-forward this worktree to `7d01d5f`, copy this plan to `docs/design/`.
- `vite.config.ts`: E1 guard; `/api` runtime route to `NetworkOnly`, exclude `/realtime`.
- `server/src/config/env.ts`, `index.ts`, `seed.ts`, `nest/app.controller.ts`: E2 to E4. `.env.example`: `APP_ENV`.
- `src/main.tsx`: dirty-form-aware update prompt.
- `src/lib/sseClient.ts` callers, `src/hooks/useAuth.ts`: sign-out cleanup.
- `server/src/modules/realtime/*`, `src/lib/sseClient.ts`, `server/src/app.ts`: short-lived stream ticket replaces `?token=`.
- `server/src/modules/suppliers/suppliers.controller.ts`: read scoping; add a test before any change.
- `scripts/`: `seed-acceptance.mjs`, `e2e/visual.mjs`, `e2e/role-matrix.mjs`; guard in `migrate-user-membership.mjs`, `backfill-mass-balance.mjs`, `create_*_collections.js`.
- `package.json`: `e2e`, `e2e:visual`, `e2e:roles`.
- `docs/design/VISUAL_ACCEPTANCE.md`, `SCREEN_MIGRATION_MATRIX.md`: correct section 2, adopt section 4 rows.

**Wave 1**
- Create section 14 files. `src/App.tsx`: boundary, `QueryCache`.
- `src/hooks/useFactoryShellMetrics.ts`, `src/lib/axiosClient.ts`, `src/lib/roleAccess.ts`, `src/components/layout/AppSidebar.tsx`, `TopHeader.tsx`, `OfflineSyncStatus.tsx`, `src/pages/Index.tsx`, `src/pages/Auth.tsx`.
- `tailwind.config.ts`, `src/index.css`, `src/components/ui/button.tsx`, `public/fonts/`, `index.html`.
- `server/src/modules/auth/authz-matrix.test.ts`: tab-to-endpoint contract.

**Wave 2:** `ReceptionDashboardV2.tsx`, `ReceptionDetailV2.tsx`, `intake/*`, `ReceptionQcQueue.tsx`, new `reception/qc/QcInspectionPage.tsx`, `useQcInspection.ts`, remove `QCInspectionDialog.tsx`; `LabResultsDialog.tsx`, `quality/*`, `lib/offline/outbox.ts`, `scripts/e2e/reception.e2e.mjs`.

**Wave 3:** `production/ProductionWorkspace.tsx`, `views.ts`, `ProductionToday.tsx`, `ProductionOrderDetail.tsx`, `ProductionPipelinePanel.tsx`, `MaterialBalancePanel.tsx`, `ProductionKpiPanel.tsx`, `phase2/*Panel.tsx`, `pages/Index.tsx`.

**Wave 4:** split `batches/StorageZonesOverview.tsx` into `components/stock-workspace/*`; `reception/StorageAssignment.tsx`, `scan/ScanStation.tsx`, `pages/Index.tsx`, `home/HomePage.tsx`.

**Wave 5:** `purchasing/PurchasingDashboard.tsx`, `RequisitionsList.tsx`; `export/ExportDashboard.tsx`; `logistics/*`; `mes/SuppliersList.tsx`, `MaterialsList.tsx`; `customers/*`; `packaging/*`.

**Wave 6:** `home/*`, `alerts/*`, `analytics/**`, `settings/SettingsDashboard.tsx`, `pages/PassportPage.tsx`, `pages/SupplierPortal.tsx`, `employees/HRDashboard.tsx`, `maintenance/*`, `App.tsx`.

**Wave 7:** dead-code removal per section 14, `src/index.css` dark block.

**Editing rule:** files are CRLF on disk. Use CRLF-preserving edits, and keep comments and naming in the surrounding style.

---

## 21. Acceptance and regression matrix

**Baseline gates on `7d01d5f`, rerun this session with no database URI set**

| Check | Earlier report | Measured now | Note |
|---|---|---|---|
| Vitest | 553/553 | **505 passed, 73 skipped, 578 total** | The skipped are the two replica-set suites (`reception.integration`, `qc-release.http`), which need a URI. So the DB-backed QC tests were **not** run here |
| Client TypeScript | 213 | **215** | 2 more than reported. 76 are in dead `stock/StockLotsList` and `MovementsList`; deleting the island removes them |
| Server TypeScript | 0 | **0** | |
| ESLint | 0 errors, 358 warnings | **0 errors, 994 warnings** | Cause of the gap not established; check what the worktree run includes in Wave 0 |
| 17 browser scenarios | 17/17 | **Not rerun** | They need their own stack and write to a database, so they belong in Wave 0 |

The 215 and 994 become the baselines. The `redesign` worktree stayed clean through this run.

| Gate | Target | Applies |
|---|---|---|
| Vitest | All pass, count never drops | Each commit |
| Replica-set integration suite | All pass, on `:27327`, `enforce` | Each wave |
| Client TypeScript | No new errors over baseline, reduced in touched files | Each commit |
| Server TypeScript | 0 | Each commit |
| ESLint | 0 errors | Each commit |
| 17 scenarios, dev | Pass | Each wave |
| 17 scenarios, frozen cross-origin, SW on | Pass | W0, W8 |
| New scenarios W, X, Y, T1 to T4 | Pass | From their wave |
| Role matrix contract | No refused primary | W1 onward |
| Visual run | Rubric PASS per row | Each wave, W7 all |
| Axe | No critical or serious | Each wave |
| Bundle output | No forbidden host | Every build |
| Staging H, J | Pass | W8, `[UNVERIFIED]` until provisioned |
| Physical scale, factory UAT | NOT VERIFIED | External |

---

## 22. Safe integration and rollback strategy

- Work on the session branch, fast-forwarded to `7d01d5f`. `feature/ui-redesign` stays as the safe point until the user merges.
- One logical commit per change, local tag `design/wave-N` when a wave passes. **Never push, merge or deploy** without the user.
- Backend changes are separate commits, listed in the wave report.
- Reaching `:8080`: only on the user's instruction, after all gates and confirmation that QC blockers are unaffected. This is also what removes the QC bypass from `:8080`. Check `ListAgents` first.
- Order for a real release: credentials rotated → PINs provisioned → checklist signed → staging → production.
- Database: no migrations are planned. Any new index or backfill goes to the user first.
- Rollback: revert wave commits; route-param pages coexist with old dialogs until accepted.

---

## 23. Definition of Done

COMPLETE only when: route inventory reconciled; every screen has a recorded decision; high-priority workflows redesigned and driven; one visual system; every required screen meets the rubric; responsive verified with touch; critical accessibility closed; actions obvious; no new client TypeScript errors; core browser scenarios pass; offline and reconnect verified on staging; tests cannot reach production data; QC, stock and manufacturing restrictions intact and proved under `enforce`; production build verified; external requirements listed.

A blocked route is reported as blocked. CSS, a successful build or absence of overflow do not count as completion. **Factory-worker acceptance remains NOT VERIFIED until real employees take part.**

---

## 24. Final Agent Mode handoff instructions

**Agent contract**
1. Read this plan and `VISUAL_ACCEPTANCE.md`. Do not repeat the audit.
2. Run `ListAgents`, and check ports. Use your own stack from section 3.
3. Before any write, assert `/health` says `test` and `local`. **Never drive `:8080` or `:4000`.**
4. One wave at a time, W0 first. Implement source, not notes.
5. For every screen run the section 17 loop. Read each screenshot. A screen counts as seen only then.
6. Run the gates, update the matrix, commit coherent progress.
7. Preserve correct components. No new libraries beyond section 14 and 15.
8. Stop and report when: a calculation, price, score or server permission would have to change; a blocked lot looks available; a scenario needs a weaker assertion; or data would need deleting.
9. Never deploy, push or merge.
10. Interrupted? Write `docs/design/CHECKPOINT.md` with branch, commit, wave, last passing gate, next step, then stop.
11. Stop your test stacks at the end, and say which ports remain open.
12. Do not declare a wave complete before its acceptance passes, or the product finished while any required route is unverified.

**Decisions already made in this plan:** keep the design language; Date Harvest Hub as product name; dark theme unsupported; `/api` not cached by the service worker; order detail and QC as pages; no spatial warehouse view; no TanStack Table; no Playwright test dependency; server permissions unchanged.

**Needs the user, none blocking Wave 0 to 7:**
- Add `APP_ENV=live-dev` to `.env`.
- Allow a read-only look at Atlas to see whether the demo seed wrote there.
- Confirm deletion of `tasks/*` and `timesheets/*`.
- Whether production managers should read stock (a factory rule, not a design one).
- Which supplier score is official.
- Provision staging, PINs, checklist sign-off and credential rotation.

**Start with:** Wave 0, first task.
