# Date Harvest Hub: final product and EcoDattes readiness plan

Prepared 2026-10-31 against `feature/ui-redesign` at `7d01d5f`. Plan only: no source file was changed to produce it.

This is the one roadmap. It does not repeat two approved documents, it sequences them:
- `docs/design/DATE_HARVEST_UI_UX_MASTER_COMPLETION_PLAN.md` (UI plan, waves W0 to W8)
- `docs/plans/DATE_HARVEST_QMS_2_MASTER_PLAN.md` (QMS plan, on `feature/ui-redesign`)

**Status words:** IMPLEMENTED AND VERIFIED, IMPLEMENTED BUT NOT VERIFIED, PARTIALLY IMPLEMENTED, BROKEN, MISSING, NOT REQUIRED FOR FIRST CUSTOMER, NEEDS FACTORY APPROVAL.

**Evidence:** `[EXEC]` executed this session on a private API (`:4150`, local replica set, throwaway database, `NUMERIC_SIGNATURE_GATE=enforce`). `[CODE]` read in source. `[TESTS]` tests run this session. `[DOC]` read in a document. `[PUBLIC]` public source, cited at the end. `[UNVERIFIED]` not established.

Atlas and Railway were not touched. The throwaway database and API were removed afterwards.

---

## 1. Current truth-based product assessment

**Verdict.** Reception, QC release and the audit ledger are strong. **The product cannot yet carry one lot from supplier to customer through its real screens**, its stock figures are wrong after the first processing step, and its cost figures can be 2.5× too high. It is not demo-ready yet, and that is fixable: the architecture is sound, and the gaps are specific and known.

### What one 1,000 kg lot did `[EXEC]`

| Step | Result |
|---|---|
| Intake 1,000 kg at 10 TND/kg | Lot created, quarantine, cost 10,000 TND. **Correct** |
| QC release with PIN under `enforce` | Stock VALIDATED. **Correct** |
| Cleaning 1,000 to 960 kg, 40 kg waste | Cycle closed. **Stock still 1,000 kg, no movement** |
| Triage of 400 kg of that lot, **no fumigation performed** | Accepted, with gates at their default `warn` |
| Triage close | Three sub-lots in QUARANTINE. **Parent stays 1,000 kg. Book stock now 1,380 kg from a 1,000 kg lot** |
| Cost of 400 kg triaged | Whole lot's 10,000 TND applied: **26.47 TND/kg instead of about 10.5** |
| Packaging from a sub-lot | **Refused: `LOT_NOT_CONSUMABLE`** |
| Releasing the sub-lot | `quality-status` 404. Direct edit refused for the director too (`STOCK_LOT_DOMAIN_ONLY`). **No path exists** |
| Ledger after triage | Triage not recorded, because the safe recorder swallows failure. `PACKED` then refused `LOT_TRIAGE_REQUIRED` |
| Director posts `FUMIGATION_CCP` | **Accepted, with no cycle behind it** |
| Period summary | 25.14 TND/kg, 738 % over a default 3 TND target |

The existing `demo-golden-thread.mjs` passes because it posts stage events. It does not run cycles, so it does not prove the thread. Packing, palletizing and shipping could not be reached this way, so those steps are read from code only.

### Gate results at `7d01d5f`

| Gate | Result | Note |
|---|---|---|
| Unit and integration, no DB | PASS 505, 73 skipped | `[TESTS]` |
| Replica-set suites, including QC bypass and rollback | **PASS 73 of 73** | `[TESTS]` |
| Server TypeScript | PASS, 0 | |
| Client TypeScript | FAIL as a target: 215 | 76 in dead files |
| Lint | 0 errors, 994 warnings | Jump from 358 unexplained |
| 17 browser scenarios | NOT VERIFIED | Earlier claim, not rerun |
| Golden thread via real cycles | **FAIL** | Section above |
| Stock integrity | **FAIL** | 1,380 kg from 1,000 |
| Authorization of realtime | **FAIL** | Section 3 |
| Backup and restore | BLOCKED | No tooling in repo |
| Staging | BLOCKED | Does not exist |
| Hardware, factory workers, cost validation | NOT VERIFIED | |

### Commercial gates today

| Gate | State |
|---|---|
| DEMO READY | **Not met.** Needs Phases 0 to 3 |
| PILOT READY | Not met |
| PRODUCTION READY | Not met |

### Repository state

| Item | Finding |
|---|---|
| `origin/main` | **27 commits behind local `main`**, an August merge. No safety work has been pushed |
| Deployed version | `[UNVERIFIED]`: whatever Pages and Railway run predates all fixes here. Assume exposed |
| `:8080` | `8ab1bc5`, Atlas, without `dd7856d`: the QC bypass route still exists there |
| `feature/ui-redesign` | 15 commits ahead of local `main`; all safety and UI work lives here, unpushed |
| Credentials | Memory records the Atlas URI and JWT secret as public on `gh-pages` history. Rotation **not confirmed** |

---

## 2. Complete functionality gap matrix

| Area | Capability | Status | Evidence |
|---|---|---|---|
| **ERP** | Suppliers, scoring, contracts | IMPLEMENTED BUT NOT VERIFIED; two score formulas | `[CODE]` |
| | Requisition → RFQ → PO → goods receipt → invoice → 3-way match → payment | IMPLEMENTED BUT NOT VERIFIED | `[CODE]` |
| | PO link at reception, double-receipt guard | IMPLEMENTED AND VERIFIED | Scenario B, earlier |
| | Grade settlements | PARTIALLY IMPLEMENTED | `[DOC]` gap analysis |
| | Customers | PARTIALLY IMPLEMENTED: 70-line module | `[CODE]` |
| | Sales orders outside export | **MISSING** | `[CODE]` |
| | Customer invoicing | **MISSING**. Decide: interface to the existing accounting, not a ledger | `[CODE]` |
| | General ledger, tax accounting | NOT REQUIRED FOR FIRST CUSTOMER: stay out of scope | |
| **MES** | Production orders, steps, allocation | IMPLEMENTED BUT NOT VERIFIED | `[CODE]` |
| | Fumigation, cleaning, hydration, triage cycles | PARTIALLY IMPLEMENTED: records exist, no stock effect before triage | `[EXEC]` |
| | Output of production orders into stock | **MISSING**: `production_output_lots` never becomes a stock lot | `[CODE]` |
| | Two transformation models (phase 2 cycles vs orders) | **BROKEN** as a whole: not reconciled | `[CODE]` |
| | Deviations, yield, waste | PARTIALLY IMPLEMENTED | `[CODE]` |
| **WMS** | Zones, locations, moves, FEFO, conditions | IMPLEMENTED BUT NOT VERIFIED | `[CODE]` |
| | Availability never includes blocked lots | IMPLEMENTED AND VERIFIED | Scenario V, earlier |
| | Quantity integrity through processing | **BROKEN** | `[EXEC]` |
| | Inventory counts and reconciliation | PARTIALLY IMPLEMENTED | `[CODE]` |
| **QMS** | Release boundary, PIN, evidence, re-inspection | IMPLEMENTED AND VERIFIED | `[TESTS]` 73/73 |
| | Server recomputes score and thresholds | **MISSING**: browser only (QMS D6, D7) | `[DOC]` |
| | Post-triage and finished-product release | **MISSING** | `[EXEC]` |
| | NC and CAPA as one model | PARTIALLY IMPLEMENTED | `[DOC]` |
| | HACCP plan content | NEEDS FACTORY APPROVAL | |
| **Traceability** | Hash-chained ledger, dossier, genealogy, recall drill | IMPLEMENTED BUT NOT VERIFIED end to end | `[CODE]` |
| | Ledger reflects real operations | **BROKEN** | `[EXEC]` |
| **Reporting** | Dashboards, KPIs | PARTIALLY IMPLEMENTED: misleading defaults | UI plan |
| | Cost and yield | PARTIALLY IMPLEMENTED: errors in section 8 | `[EXEC]` |
| **Platform** | Offline reception | IMPLEMENTED AND VERIFIED locally | Earlier scenarios |
| | Backup, restore, staging, monitoring | **MISSING** | `[CODE]` |
| | Multi-factory | NOT REQUIRED FOR FIRST CUSTOMER: one deployment per factory | |

**Benchmark, no parity claimed.** Sage X3 partner material describes lot and sub-lot control, forward and backward trace, quality plans, certificates of analysis, by-products and co-products, and costing methods including lot actual. The QMS plan read Sage's own quality help. Most of what was found this session is vendor or partner material, so treat it as indicative. Dolibarr documents BOM and manufacturing orders, and lots and serials through Stock, with specifics thin in official pages; its quality function was not found in pages read earlier.

**Useful conclusion, not a superiority claim:** the capabilities a date factory needs that generic systems do not ship ready-made are the differentiators to finish: grade-based triage, date-specific QC evidence, fumigation records, process mass balance. Whether those beat a configured X3 is unproven.

---

## 3. Critical defects and safety blockers

| ID | Blocker | Status | Evidence | Fail-closed remediation | Phase |
|---|---|---|---|---|---|
| B1 | QC bypass present on `:8080`; deployed code predates all fixes | BROKEN on those stacks | `[CODE]` | Do not run real decisions there. Land only through the release sequence, on the user's instruction | 0, 8 |
| B2 | Credentials reported public, rotation unconfirmed | NOT VERIFIED | Memory | User rotates. **Blocks any real data** | 0 |
| B3 | Dev API runs on Atlas with demo seed at every start | Effect NOT VERIFIED | `[CODE]` | `APP_ENV`, seed only in `dev`/`test`, refuse remote DB there | 0 |
| B4 | No backup or restore tooling in repo | MISSING | `[CODE]` | Scripts plus a timed restore rehearsal. Confirm Atlas backup tier | 0 |
| B5 | **Realtime sends full rows to every signed-in user.** Operator refused `stock/lots` received a stock row with `cost_tnd_per_kg` | BROKEN | `[EXEC]` | Default deny: ids only, role targeting required, `rows` removed. Clients refetch through guarded APIs | 0 |
| B6 | Session JWT in stream URL | BROKEN | `[BROWSER]` earlier | Short-lived single-use ticket | 0 |
| B7 | Stream and caches survive sign-out; `api-cache` shared between users | Code only | `[CODE]` | `NetworkOnly`, clear on sign-out; cross-user test | 0 |
| B8 | Refused data shown as calm zeros | BROKEN | `[BROWSER]` earlier | UI W1 | 1 |
| B9 | **Book stock inflates through processing** | BROKEN | `[EXEC]` | Section 4 | 2 |
| B10 | **Sub-lots cannot leave quarantine, thread stops** | BROKEN | `[EXEC]` | Section 4 | 2 |
| B11 | Multi-document stage writes are not atomic: `runInTransaction` used only in Reception | BROKEN | `[CODE]` count 9, all in `receptions.service` | Wrap closes and consumption | 2 |
| B12 | Triage ran with no fumigation; CCP, stage, mass-balance gates default `warn` | Gap | `[EXEC]` | Pilot config `enforce`, route set by approved site plan. Refuse to start in production with gates unset | 2 |
| B13 | Ledger accepts stages with no work behind them, and hides recording failure | BROKEN | `[EXEC]` | `advance` requires a linked record or a reasoned, audited override. `recordStageSafe` failure raises an alert | 2 |
| B14 | Cost overstated on partial triage | BROKEN | `[EXEC]` | Section 8 | 5 |
| B15 | Client-only QC thresholds; best-case prefilled answers | Open | `[CODE]` | QMS Phase 4, UI D-05, D-07 | 2 |
| B16 | Fumigation and purchasing signatures still default `warn` | Open | `[DOC]` | Decide per signature; enforce in pilot | 2 |
| B17 | PINs unset for real users; checklist unsigned | NEEDS FACTORY APPROVAL | `[DOC]` | `audit-pin-readiness.mjs` on a sanitized copy | 8 |

**Reviewed and acceptable**

| Item | Finding |
|---|---|
| Supplier portal scope | **Better than the UI plan said:** server filters (`filterOwnSuppliers`, `assertOwnSupplier`). Code only; no portal account yet. Downgraded from S1 |
| Direct stock status edits | Refused even for the director `[EXEC]` |
| Simulator and smoke scripts | `resolveTestApi`, `assertSafeDbTarget` guard them. Migrations and `create_*` scripts are still unguarded |
| Connected weighing | Readings stored only after HMAC verification `[CODE]` |
| Build target | Railway fallback removed in `608e670` |

---

## 4. End-to-end factory process coverage

| Handoff | Owner | State | Stock | Ledger | Realtime | Status |
|---|---|---|---|---|---|---|
| Purchasing → supplier | Purchasing | RFQ, PO | n/a | n/a | Partial | IMPLEMENTED BUT NOT VERIFIED |
| Supplier → reception | Reception | PO link, partial receipt | n/a | Yes | Yes | IMPLEMENTED AND VERIFIED |
| Reception → weighing | Reception | Manual and signed device | Lot, quarantine | Yes | Yes | IMPLEMENTED AND VERIFIED; no physical scale |
| Weighing → QC | QMS | Implicit queue | n/a | Yes | Yes | PARTIALLY IMPLEMENTED |
| QC → release | QMS | PIN, evidence | VALIDATED | Yes | Yes | IMPLEMENTED AND VERIFIED |
| Release → cold storage | Stock | Moves, zones | Location | Yes | Yes | IMPLEMENTED BUT NOT VERIFIED |
| → Fumigation, HACCP | Phase 2 | CCP evidence, signature | **None** | Partial | Yes | PARTIALLY IMPLEMENTED; applicability NEEDS FACTORY APPROVAL |
| → Cleaning, hydration | Phase 2 | Cycles | **None** | Mass balance only | Yes | BROKEN |
| → Triage, grading | Phase 2 | Grades, sub-lots | **Parent not reduced** | **Can fail silently** | Yes | BROKEN |
| Triage → packaging | Packaging | Consumption with manual rollback | Blocked | n/a | Partial | BROKEN |
| Packaging → palletization | Packaging | Palette, seal, PF stock VALIDATED | Yes | Partial | Partial | IMPLEMENTED BUT NOT VERIFIED. Hardcoded 50 g box tare. SSCC blocked by placeholder prefix. PF lot has no cost |
| Pallet → shipment | Stock | `planExpeditionDecrement` | Yes | Yes | Yes | IMPLEMENTED BUT NOT VERIFIED |
| Shipment → export, customer | Export | Orders, COA, BDE | n/a | n/a | Partial | PARTIALLY IMPLEMENTED: loose link |
| → Cost and profitability | Costing | Lot, order margin | n/a | n/a | n/a | PARTIALLY IMPLEMENTED |

**Rule of ownership.** Reception owns intake. QMS owns evidence and decisions. Stock owns quantities and locations. Stage services own process records and, in one transaction, ask Stock to apply quantity effects. Ledger records what committed. No generic write path changes any of these.

### Thread fixes

**Stage quantity effects.** Close of each stage, in one transaction: consume input, add output, classify the difference. This needs a factory rule on one question, so it is designed to work for both answers: does stock follow every stage, or only triage? Default: **every stage**, because that is what makes loss visible. Hydration increases mass, so it must be a recorded gain, not a variance.

**Parent decrement.** Triage consumes `parent_weight_kg` from the parent stock lot, refusing if unavailable. Partial triage leaves the rest.

**Post-triage release (B10).** Default proposal: one more command under the same boundary. A quality user signs with PIN, against a published checklist, creating an inspection with `purpose: STAGE_RELEASE`. It extends QMS section 23 rather than opening a side door. Whether sub-lots inherit release from an approved parent instead is NEEDS FACTORY APPROVAL. Never automatic until the factory says so.

**Two models.** Keep both, connect them. Stage cycles record what happens to a lot; a production order is the plan that references them. Orders for pitted dates and paste must produce stock output through the same stage rules. Do not rebuild either.

---

## 5. Date-industry specialization

| Topic | Today | Status |
|---|---|---|
| Deglet Nour | Default route, full path | PARTIALLY IMPLEMENTED |
| Other varieties | `ROYAL_PALM_VARIETIES` client list; QC not by variety (QMS D12) | PARTIALLY IMPLEMENTED |
| Organic | Declared at intake, certification check, storage mix block `[CODE]`. **Triage stock rows carry no organic field** | PARTIALLY IMPLEMENTED; chain of custody not proven |
| Whole dates | F1, F2, triage grades | PARTIALLY IMPLEMENTED |
| Pitted, paste, syrup, sugar, pits | F3, F5 to F8 exist as codes; outputs never reach stock | BROKEN path; scope NEEDS FACTORY APPROVAL |
| Grades | EXTRA, CAT I, CAT II, REJETE | IMPLEMENTED BUT NOT VERIFIED |
| Packaging variants, private label | BOM, labels, clients | IMPLEMENTED BUT NOT VERIFIED. **BOM materials are not consumed from stock** |
| Customer and supplier specifications | No model | MISSING; add only if EcoDattes needs it |
| Season or campaign | None in the model | MISSING; NEEDS FACTORY APPROVAL |
| Genealogy | Dossier, builder | IMPLEMENTED BUT NOT VERIFIED beyond triage |

**Organic rule.** If EcoDattes handles organic, status follows the lot through every derived lot, and mixing is refused unless a documented rule allows it. The software records evidence; it never declares a product certified.

**Do not inherit Royal Palm.** All thresholds in the repo come from `royal-palm-phase1-detail.txt`, a Royal Palm specification. **They are not EcoDattes's rules.** They are configuration to confirm, and the name also leaks into the PWA manifest and code identifiers.

---

## 6. Real-time and offline acceptance

Keep the SSE bus, id-based invalidation, outbox and idempotency. Post-commit publication is correct: `publishRealtimeDbChange` defers through `afterCommit` inside a transaction `[CODE]`. The risk is the many stage writes that run with no transaction, and event content.

| ID | Scenario | Pass means |
|---|---|---|
| RT-1 | Two users, one lot | B sees A's committed change without reload, within the agreed time |
| RT-2 | Forced failure in a stage close | No event, no partial data |
| RT-3 | Event payload | Ids only. Unauthorized roles get nothing useful, portal accounts nothing |
| RT-4 | Sign-out, new user on tablet | Old stream closed, no old data, online or offline |
| RT-5 | Stale cache on a shared tablet | Network failure shows an error, never another user's data |
| RT-6 | Network drop 10 min | Screens say stale since when; refresh covers **all** resources (today only three) |
| RT-7 | API restart during work | Reconnect, no duplicate, no lost committed work |
| RT-8 | Offline intake then reconnect | Exactly one reception; idempotent replay |
| RT-9 | Session expires during drain | Items wait, sign-in resumes, owner preserved |
| RT-10 | App update during entry | No reload mid-form |
| RT-11 | Service worker on frozen build | All above pass with the worker active |
| RT-12 | Staging topology | RT-1, 6, 7 on hosted TLS |

Scenarios H and J already cover parts of RT-7 and RT-8 locally. QC, CCP and shipment stay online-only, as designed.

---

## 7. Production and quality readiness

**HACCP boundary.** The software holds records and enforces the plan the factory approves. It does not define the plan, and claims no certification. Fumigation as a mandatory step is a site decision: `GENERIC` route exists, and gap analysis already flags it.

**Required before real decisions.** Server-side evaluation (QMS Phase 4). Measurements with no defaults. Published checklist signed by the factory. PINs provisioned. Gates set to `enforce` under the approved route. Calibration records (RG-Q08 cannot work today). `stockSide` eligibility shared by every consumer (`assertLotEligible`, QMS Phase 7).

**Roles.** Client tab list is aligned with server lists by a contract test. Server rules do not widen to make a screen work.

**Transaction scope.** `closeCleaningCycle`, `closeHydrationCycle`, `closeTriageSession`, packaging create, close and seal, production start, complete and cancel, expedition, storage moves, settlement approval. Notifications move to `afterCommit`. Each gets a forced-failure test.

**Hardcoded values to make configuration:** 50 g tare, yield alert thresholds (92 %, 95 %), default rates, FX defaults.

---

## 8. Financial loss-control design

### Flaws in today's costing

| Flaw | Effect | Evidence |
|---|---|---|
| Whole-lot cost applied to a partial triage | 2.5× overstatement; repeat sessions charge the lot again | `[EXEC]` |
| Period cost sums purchases received, divided by output produced | Timing mismatch; a heavy buying month looks expensive | `[CODE]` |
| Waste cost added on top of material that already carries it | Double count | `[CODE]` |
| `updated_at` includes old rows in a period | Any edit moves history | `[CODE]` |
| Reject stream gets zero value | Reasonable, but **value weights all 1**: grades get equal cost per kg | `[CODE]` |
| `waste` is one bucket | Normal change cannot be told from loss | `[CODE]` |
| PF lots carry no cost | Export margin falls back to purchase price, understating cost | `[CODE]` |
| Energy always 0 (`energyKwh: 0`) | Cost incomplete and looks complete | `[CODE]` |
| Default rates 8, 0.4, 0.15, target 3 and FX 3.35, 3.1, 0.83 | Invented figures appear as facts | `[CODE]` |
| `trend: 0`, `maintenance: 0`, `lossPercentOfRevenue: 0` | Unknown reads as zero | `[CODE]` |
| Agreed price used as cost | Not invoice cost | `[CODE]` |
| Labour uses elapsed time with no pause handling; bad data gives `null` | Unreliable | `[EXEC]` partial |

### Mass classification

Every kilogram leaving a stage gets one class, stored on `stock_movements` (`mass_class`, `reason_code`, `measured_by`, `source_doc`).

| Class | Meaning | Example, if the factory confirms |
|---|---|---|
| `SALEABLE_OUTPUT` | Lot that can be sold | Graded dates |
| `BYPRODUCT` | Saleable secondary output | Pits, paste feedstock |
| `REWORK` | Returns to a stage | Re-sorted dates |
| `NORMAL_PROCESS_CHANGE` | Expected physical change, within an approved range | Drying, hydration gain |
| `MEASURED_LOSS` | Weighed and attributed | Rejects, spillage |
| `UNEXPLAINED_VARIANCE` | Input minus everything else | The remainder |

**Normal ranges are factory data.** With none approved, nothing is called normal: the difference stays `UNEXPLAINED_VARIANCE`.

### Financial layers, always separate

| Layer | Definition | May be shown as |
|---|---|---|
| Measured loss | Weighed kg by reason | kg |
| Normal process change | Within the approved range | kg, not a cost problem |
| Unexplained variance | Unattributed kg | kg, under investigation |
| Estimated financial exposure | kg × a documented unit cost | **"Estimated"**, with its method |
| Verified realized savings | Only after a closed action, with a before/after on a comparable basis, signed by the factory | Never computed automatically |

### Costing rules
- Material follows **quantity consumed**, not the lot total.
- Cost flows lot to lot through genealogy, and each stage adds only what it measured.
- Source order: invoice, then agreed price (labelled). Otherwise NOT AVAILABLE.
- Labour, energy, equipment: only when measured or an approved standard, tagged `ACTUAL` or `STANDARD`. Never a built-in default.
- Allocation between grades uses factory-approved value weights.
- By-product treatment (credit or joint cost) is a finance decision.
- Cost per input kg, per finished kg, lot, order, shipment margin all carry coverage: "71 % of kg have a cost".

**Reporting basis.** Use cost of what was produced in the period, not purchases of the period. Inventory valuation stays out of scope for the pilot.

### Management view

For each variance: what happened (kg, TND estimate), where (lot, stage, line, shift), why (reason codes, or "unexplained"), how it was calculated (formula, inputs), which records support it (links to cycles, weighings), who is investigating, and state. Supplier view: price and quality variance per supplier, with sample size, and no ranking on thin data. Discrepancy investigations reuse NC and CAPA.

### Data collection needed from the factory

Scale points at each stage, reason code list, shift and line identification, labour records, energy meters if any, packaging material consumption, invoice prices, approved normal ranges, grade value weights.

---

## 9. EcoDattes-specific discovery questions

**Known publicly `[PUBLIC]`:** a Gulfood exhibitor page describes Afrimex as a Tunisian processor, packer and exporter of date products, with a plant named ECODATTES with large cold rooms, exporting to markets including Brazil, UAE, India and Indonesia. **Not confirmed:** Degache location, certifications, volumes, ownership. A generic Tozeur listing mentioning Degache is not linked to them. Treat all of this as unverified until the customer confirms it.

| Topic | Questions |
|---|---|
| **Company** | Legal entity vs plant? Who decides, who pays, who uses? Season dates, tonnage, peak day, staff? |
| **Today's tools** | Paper, Excel, existing software? What must stay? Accounting system? |
| **Reception** | Trucks per day? Weighbridge make, connectivity? Tare method? Crates or pallets? Contract growers or collectors? How is a lot defined? |
| **Quality** | Written plan? Who decides? Instruments, calibration? Lab, in-house or external? Sampling? Criteria by variety? |
| **Certification** | Which certificates are current (do not assume)? Audit requirements? Organic scope? Customer audits? |
| **Process** | Exact stage order? Fumigation method and provider, always required? Hydration? Sorting lines? Pitting, paste? |
| **Quantities** | Where do you weigh? Accepted shrinkage? Reject reasons? What happens to rejects, pits? |
| **Packaging** | Formats, BOM, private labels, label rules, GS1 prefix, pallet patterns? |
| **Storage** | Cold rooms, locations, FEFO rule, sensors? Mixing rules? |
| **Sales** | Contract types, Incoterms, currencies, documents, forwarders? Who invoices? |
| **Cost** | How do you calculate cost today? Which figures do you trust? Labour basis? Energy meters? Value weights? |
| **Pain** | What do you want to stop losing? **Ask, do not assume.** Which loss do you already measure? |
| **IT** | Internet quality, Wi-Fi coverage, tablets, printers, power, IT contact? Hosting expectations? Data rules? |
| **People** | Languages used on the floor? Literacy, tablet comfort? Who trains? |

---

## 10. Demo scope

**Purpose:** show a real manager one believable lot, on safe data, without any claim about their factory.

| Item | Rule |
|---|---|
| Data | Synthetic, marked as such, no real names. Runs on a local or isolated host |
| Story | Delivery → QC with PIN → storage → stage → triage → packaging → pallet → shipment → recall → mass balance → NOT AVAILABLE cost states |
| Must work | Through real cycles, not `advance` |
| Language | French UI; Arabic management presentation |
| Roles | Operator, inspector, manager on tablet and desktop |
| Not shown | Live AI, ROI figures, certifications, X3 comparison claims |

**DEMO READY:** safe synthetic data, no live connection, the thread passes as an automated scenario, truthful states, rehearsed twice.

---

## 11. Pilot scope

**Discovery first.** One to two days on site, ideally observing a live day, before any scope is signed. Pilot content below is a hypothesis to confirm.

**Timing risk.** Today is 2026-10-31, and Deglet Nour harvest commonly falls around this period `[UNVERIFIED]`, which should be confirmed with EcoDattes. Do not cut over during peak. Observe now; **shadow-run** on one line, paper remaining official, until accepted.

| Dimension | Proposal |
|---|---|
| **In scope** | Supplier reception, QC, lot and stock trace, one transformation and packaging flow they choose, management view, mass balance, initial cost analysis |
| **Out of scope** | Accounting, payroll, sensors, AI, Arabic on all screens, multi-site |
| **Data needed** | Suppliers, articles, varieties, BOMs, zones, users, QC plan, cost inputs |
| **Equipment** | Tablets, label printer, scanner, Wi-Fi at each station. Scale integration only if the device supports it; manual stays honest |
| **Roles** | Reception operator, inspector, warehouse, line lead, quality manager, management sponsor, local key user |
| **Training** | Role-based short sessions on the floor, with printed cards in the working language |
| **Approved policies** | QC checklist, release rule, HACCP route, mass-balance tolerance, reason codes, signed by the factory |
| **Baseline KPIs** | Measured **before** go-live: time per truck, time to QC decision, time to trace a lot, stock discrepancy at a count, unexplained kg per stage, cost figure availability |
| **Acceptance** | Scripted scenarios on their data; recall drill timed |
| **Support** | Named contact, hours agreed for season, incident log |
| **Security and privacy** | Dedicated deployment, rotated secrets, role review, data ownership written down |
| **Deployment and rollback** | Separate database, verified backup, paper fallback rehearsed. Rollback means paper remains valid throughout shadow |
| **Exit criteria** | Continue, extend or stop, decided against the agreed metrics |

**Fair measurement.** Compare comparable periods and product mix. Record volume, mix, season, staffing and quality of incoming fruit alongside each KPI. Say "associated with" unless a change is clearly attributable. A shadow pilot measures visibility and time, and does not by itself show savings.

**PILOT READY:** B1 to B17 closed for the pilot scope, selected workflows verified, roles trained, SOPs approved, deployment safe, restore rehearsed, customer checklist signed.

---

## 12. Production acceptance criteria

PRODUCTION READY needs all of:
- Full agreed operations verified through a real period
- Backup and restore rehearsed with a measured recovery time
- Stable permissions, reviewed by the customer
- QC safety and stock integrity proved by tests and physical count comparison
- Performance measured at peak-day volume
- Audit trail reviewed by the quality manager
- Monitoring, incident process, agreed service levels
- Cost and yield calculations validated by management
- Hardware acceptance where equipment exists
- Factory-worker usability acceptance with real employees
- Signed customer acceptance

**Passing tests alone never grants this label.**

### Evidence required

| Gate | Result now |
|---|---|
| Unit, integration | PASS, with counts above |
| Mongo transaction rollback | PASS for Reception and QC; **FAIL as coverage** for stages |
| QC evidence and PIN bypass regression | PASS |
| Authorization and data isolation | **FAIL** (B5) |
| Browser E2E with realistic data | NOT VERIFIED |
| Multi-user realtime | NOT VERIFIED |
| Offline recovery | NOT VERIFIED on this commit |
| Production build | NOT VERIFIED on this commit |
| Typechecks | Server PASS; client 215 baseline |
| Migration checks | NOT VERIFIED |
| Backup and restore rehearsal | BLOCKED |
| Hardware | NOT VERIFIED |
| Factory-worker usability | NOT VERIFIED |
| Management validation of cost and yield | NOT VERIFIED |

---

## 13. Commercial delivery options

| Option | For | Against | Fit |
|---|---|---|---|
| Free pilot | Easy start | Low commitment, sets a bad precedent | Not recommended |
| **Paid pilot** | Tests real intent, funds on-site time | Needs defined scope | **Recommended** |
| **Implementation and configuration fee** | Pays for discovery, data, training | Upfront ask | **Recommended, can merge with pilot** |
| **Recurring subscription or support agreement** | Sustains maintenance | Must show value | **Recommended after acceptance** |
| Per-factory license | Simple for one site | Scales poorly with size differences | Sensible unit, one deployment per factory |
| Per-user license | Familiar | Discourages floor adoption | Not recommended |
| Hardware | Convenience | Margin and support burden | Optional pass-through, via their supplier |
| Training and support | Essential | Time | Included, then packaged |
| AI add-on | Future value | Must wait for data | Later, optional |

**No price is proposed**, because the inputs below are missing. Inputs needed: hosting cost, on-site days and travel, support hours in season, developer time, tonnage and users, their budget and comparable quotes, payment terms, currency, tax, your target margin.

**Risk to raise before contracting:** a single developer supporting a season-critical system. Name the backup, source escrow or handover plan, and limits of liability. Have a Tunisian lawyer review the terms.

### Commercial deliverables (produced in Phase 9, from verified facts)

Product demonstration, Arabic management presentation, French technical overview, current capability matrix generated from section 2, pilot scope, acceptance criteria, ROI measurement approach, support and maintenance responsibilities, deployment and data ownership terms.

**ROI approach:** the method is promised, not the number. Baseline, comparable period, agreed attribution, verified savings only. No fabricated ROI, certifications or customer stories.

---

## 14. Prioritized implementation roadmap

Mapping: QMS section 23 is done. UI W0 → P0. W1 → P1. W2 + QMS 3 to 5, 7 → P2. New thread work → P3. W5 → P4. New loss engine → P5. New realtime set → P6. W3, W4, W6, W7 → P7. W8 → P8.

**One change to the UI plan:** Production and Stock screens (W3, W4) wait for P3, because redesigning screens over quantity rules about to change is rework.

### Phase 0: Safety, isolation, database integrity

| | |
|---|---|
| **Verified state** | Script guards work. Server has none. B5 proven |
| **Missing** | E1 to E8, B3 to B7, recovery |
| **Source** | UI plan W0 list, plus `realtime.bus.ts` deny-by-default, every `publishRealtimeDbChange` caller, `scripts/backup.mjs`, `scripts/restore-rehearsal.mjs` |
| **Backend / frontend** | `/health` environment; client refetches on ids |
| **Data** | None |
| **Realtime** | `rows` removed, `targetRoles` required |
| **Tests** | RT-3, RT-4, RT-5; guard refusal; 17 scenarios rerun with `enforce` |
| **Risks** | Clients that depend on `rows`: search first. API cache removal |
| **Dependencies** | User: rotate secrets, confirm Atlas backup tier |
| **Done** | Tests cannot reach Atlas, restore timed locally, B5 regression test |
| **Impact** | Required for Demo, Pilot, Production |

### Phase 1: Shared truthful states

| | |
|---|---|
| **Verified state** | Refusals appear as zeros |
| **Missing** | `DataState`, boundary, nav contract, fonts offline |
| **Source** | UI W1, section 14 of the UI plan |
| **Backend** | None beyond contract test |
| **Data** | None |
| **Realtime** | Real connection state replaces "Temps réel" |
| **Tests** | Role matrix contract |
| **Risks** | Hiding a tab someone uses |
| **Dependencies** | P0 |
| **Done** | No role sees a refused screen without a stated reason |
| **Impact** | Demo, Pilot, Production |

### Phase 2: Reception, QMS, Stock, Production safety and handoffs

| | |
|---|---|
| **Verified state** | Reception and QC boundary strong; stages neither atomic nor connected |
| **Missing** | B9 to B13, B15, B16 |
| **Source** | `phase2.service.ts`, `packaging.service.ts`, `production.service.ts`, `stock/*`, `trust/lot-lifecycle.service.ts`, `trust.controller.ts`, new `modules/stock/stock-quantity.service.ts`, `assertLotEligible`; QMS Phases 3, 4, 5, 7; UI W2 |
| **Backend / frontend** | Stage service asks one quantity service. UI W2 for reception and QC |
| **Data** | `stock_movements.mass_class`, `reason_code`. Additive. **Report-only reconciliation on a copy before any correction** |
| **Realtime** | Publish after commit from all closes |
| **Tests** | Forced failure on each close, parent decrement, no double count, `advance` refused without record |
| **Risks** | Existing real lots stay inflated: never auto-corrected, reported by `audit-lot-reconciliation` |
| **Dependencies** | P1; factory rule for release, defaults stay fail-closed |
| **Done** | 1,000 kg stays 1,000 kg through every stage |
| **Impact** | Demo needs quantity and release; Pilot needs all |

### Phase 3: Full manufacturing golden thread

| | |
|---|---|
| **Verified state** | Stops after triage |
| **Missing** | Stage release, packaging to pallet to shipment verified, production output into stock, BOM consumption, organic carried, PF cost |
| **Source** | Packaging, production, stock, `traceability-dossier.ts`, `seed-acceptance.mjs`, new `scripts/e2e/thread.e2e.mjs` |
| **Data** | Organic on derived lots, PF cost fields |
| **Realtime** | All stages |
| **Tests** | One lot through real cycles to customer; forward and backward trace; recall; a blocked lot refused at each gate |
| **Risks** | Scope creep to all F-codes: only the agreed flows |
| **Dependencies** | P2 |
| **Done** | The thread scenario replaces `demo-golden-thread` as proof |
| **Impact** | **Unlocks DEMO READY** |

### Phase 4: Commercial and logistics completeness

| | |
|---|---|
| **Verified state** | Purchasing and export exist, unverified |
| **Missing** | Shipment to customer link; invoice interface decision; sales order only if EcoDattes needs one |
| **Source** | `export/*`, `customers/*`, `stock` shipments; UI W5 |
| **Data** | Link fields only |
| **Tests** | P2P path; shipment documents; separation of duties |
| **Risks** | Building an accounting system. Don't |
| **Dependencies** | P3, discovery |
| **Done** | Shipment traces to customer and document |
| **Impact** | Pilot if in scope, Production |

### Phase 5: Material balance and financial-loss intelligence

| | |
|---|---|
| **Verified state** | Section 8 flaws |
| **Missing** | Consumed-quantity cost, classes, coverage, NOT AVAILABLE, variance view |
| **Source** | `costing/*`, `settlement/export-margin.service.ts`, `settlement-domain.ts`, settings, new `src/components/costing/VarianceWorkspace.tsx` |
| **Data** | Rates tagged, reason codes, approved ranges. Historic records never rewritten |
| **Realtime** | None required |
| **Tests** | The 400 of 1,000 kg case; no double count; hand-worked examples checked by the factory |
| **Risks** | Changing a financial calculation: **needs explicit approval, this plan is that request** |
| **Dependencies** | P3; factory data |
| **Done** | Each figure traceable; missing data reads NOT AVAILABLE; management validates a sample |
| **Impact** | Pilot, Production; core differentiator |

### Phase 6: Realtime and offline resilience

Section 6 scenarios, full refresh on reconnect, stale states, safe updates, frozen topology. **Done:** RT-1 to RT-11 pass; RT-12 on staging. **Impact:** Pilot.

### Phase 7: Complete UI/UX and accessibility

UI W3, W4, W6, W7. Add `ar` RTL for station screens, using real factory terminology. Darija has no standard spelling, so treat it as a tested glossary and spoken guidance, reviewed by employees. `ar.json` has 776 lines against 1,081 in French, and many strings are literals. **Done:** UI plan definition of done. **Impact:** Pilot for priority screens, Production for all.

### Phase 8: Production-like integration and factory acceptance

Staging, deployment runbook, monitoring, restore rehearsal, peak volume test, PIN provisioning, checklist sign-off, credential rotation confirmed, release sequence. **Dependencies:** user provisions. **Done:** section 12 gates reported honestly. **Impact:** **Unlocks PILOT READY.**

### Phase 9: Pilot, commercial package, rollout

Discovery, offer, shadow pilot, measurement, deliverables. **Impact:** first customer.

### Phase 10: Optional advanced AI

**Not a prerequisite for anything above.**

- A safe base exists: read-only guide, tools behind guards, response validator, swappable `AiGuideProvider`, Ollama today.
- Add an xAI adapter behind the same interface; the key stays on the server.
- Answers cite record ids and say when data is missing. Lot investigation, variance explanation, quality summary, supplier comparison, cost anomaly, document help, in French, Arabic and Darija.
- **Never** approves quality, invents measurements, releases stock, or changes financial records. Enforced by having no write tools.
- Before sending customer data: confirm xAI's current retention, training and regional terms from its official documents. Third-party sources conflict `[PUBLIC]`. Customer consent in writing. Evaluate on a labelled question set.

---

## 15. Exact executable Agent Mode handoff

**Order of work**
1. `git merge --ff-only 7d01d5f` in this worktree. Commit both plans.
2. Run UI plan W0, plus the P0 additions, one commit each. Backend commits listed for the user's review.
3. Own stack: API `:4091`, Vite `:8091`, database `dhh_e2e_<session>`, `NUMERIC_SIGNATURE_GATE=enforce`.
4. Convert this document's probe into `scripts/e2e/thread.e2e.mjs` **first**, as a failing test. It is the acceptance test for P2 and P3.

**Agent rules**
- Run `ListAgents` first. Never test on `:8080` or `:4000`. Check `/health` says `test` and `local` before writes.
- No push, merge, deploy, live restart or Atlas access without the user's explicit words.
- One phase at a time. Write the failing test, fix, verify, commit.
- Never weaken a QC, PIN, stage or stock check to pass a test.
- **Stop and ask** before changing a cost calculation beyond section 8, a permission, a threshold, or existing records.
- Factory facts go to section 9, never into code as defaults.
- Report every gate as PASS, FAIL, BLOCKED or NOT VERIFIED, with commands and counts. Skipped is not passed.
- Interrupted: write `docs/plans/CHECKPOINT.md`, then stop. Stop test stacks at the end and name open ports.

**Needs the user**

| When | Item |
|---|---|
| Before Phase 0 | Authorize local implementation |
| Phase 0 | Rotate credentials; `APP_ENV=live-dev` in `.env`; confirm Atlas backup tier; allow a read-only check for demo seed effects |
| Phase 2 | Decide post-triage release default, with the factory if possible |
| Phase 5 | Approve cost calculation changes |
| Phase 8 | Provision staging |
| Phase 9 | Arrange EcoDattes contact; pricing inputs; legal review |

**Sources**
- [Afrimex-Ecodattes, Gulfood exhibitor page](https://www.gulfood.com/exhibitors/afrimex-ecodattes)
- [Kapitalis: Tozeur exports](https://kapitalis.com/tunisie/2016/07/22/tozeur-exporte-20-000-tonnes-de-dattes-au-7-juillet/)
- [Sage X3 process manufacturing, partner page](https://www.netatwork.com/solutions/erp-accounting/sage-x3/sage-x3-for-process-manufacturing)
- [SEM for Food Production, partner ebook](https://www.swktech.com/wp-content/uploads/2019/08/SEM-for-Food-Production_Ebook_Final_X3-Rebrand.pdf)
- [Sage X3 quality management, third party](https://erpresearch.com/erp/sage-x3/quality-management)
- [Dolibarr Module Manufacturing Orders](https://wiki.dolibarr.org/index.php/Module_Manufacturing_Orders)
- [Dolibarr production presentation](https://www.dolibarr.org/presentation-production.php)
- [xAI API, Metronome pricing index](https://metronome.com/pricing-index/xai-api)
- [Grok 3 listing, Requesty](https://requesty.ai/models/xai/grok-3)
- [Know Your LLMs: Grok, CData](https://www.cdata.com/kb/articles/know-llm-grok.rst)

**DATE HARVEST HUB — FINAL PRODUCT COMPLETION & ECODATTES PILOT PLAN READY FOR AGENT MODE.**
