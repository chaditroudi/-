# Date Harvest Hub — Contrôle Qualité 2.0 master plan

Status: plan only, nothing implemented. Written 2026-10-31 against `feature/reception-2` at `febf1ab`.

## 1. Conclusions

1. **Keep the domain, move the rules.** The inspection lifecycle, ledger, genealogy and transactions are sound. The defect is where the rules run: the score, the thresholds, the mandatory evidence and the recommended decision exist only in the browser. The server accepts `ACCEPTE` with no measurement at all.
2. **Close three proven bypasses before anything else.** See section 4, D1 to D3. They do not wait for the QMS rebuild.
3. **The quality rules already exist.** `royal-palm-phase1-detail.txt` (Spécification v4.0, module 4) defines the scoring, thresholds and RG-Q01 to RG-Q12. Nothing has to be invented. The factory quality manager must confirm the values before they become an approved plan, and the open questions are in section 19.
4. **No new QMS application.** One `quality` server module, one Quality workspace, and the existing collections extended. No rules engine, no microservice, no Redis or Kafka.
5. **Reception 2.0 must land first.** QMS work branches from merged Reception code, or it will conflict with `receptions.service.ts`.

## 2. Evidence and limits

| Level | Meaning | Used for |
|---|---|---|
| Executed | Run against a local replica set and throwaway data | D1, D2, D3, Reception chain, combined-merge results |
| Read | Source read in this audit | Files marked read in section 3 |
| Searched | Found by search; consumers known, body not fully read | Files marked `searched` in section 3 |
| Documented | Official page fetched | Section 7 benchmark |

**Coverage is not complete.** Files marked `NOT VERIFIED` need reading in Phase 1 before they are edited. No employee was observed. The live Atlas database was not accessed. Standards text was not re-verified: `docs/standards-matrix.md` already records which sources are confirmed, and no numeric limit in this plan comes from a standard.

## 3. Current inventory and source audit

### Server

| File | Role | Evidence | Decision |
|---|---|---|---|
| `server/src/modules/receptions/receptions.service.ts` | `startQcInspection`, `submitQcDecision`, `replayQcDecision`, `applyQcDecisionToReception`, `changeLotQualityStatus`, `blockReceptionForLab`, supplier metrics (2,616 lines) | Read | REFACTOR: move QC to `modules/quality`; keep the logic |
| `server/src/modules/receptions/receptions.controller.ts` | `/qc/start`, `/qc/submit`, `quality-status`, `quality-block`, checklists | Read | KEEP routes; delegate |
| `server/src/modules/receptions/reception-roles.ts` | `QUALITY_ROLES` | Read | KEEP; add decision role sets |
| `server/src/modules/receptions-ext/receptions-ext.controller.ts` | `PATCH /qc-inspections/:id`, `GET /qc-inspections` | Read | FIX: remove the generic PATCH (D3) |
| `server/src/modules/quality-ext/quality-ext.controller.ts` | CAPA, inbound notices, lab list | Read | REFACTOR: CAPA moves to `modules/quality`, with no raw body writes |
| `server/src/modules/batches/*` | Legacy `non_conformities`, tied to `batch_id` | Read in part | MERGE: one NC model, keyed by lot |
| `server/src/modules/stock/stock.controller.ts` | `PATCH/POST /stock/lots` | Read | FIX (D1, D2) |
| `server/src/modules/collections/collections.service.ts` | Generic writes; guards only `reception_lots`, `receptions_v2` | Read | FIX: add `stock_lots`, `qc_inspections` guards |
| `server/src/modules/trust/gate-rules.ts`, `gate-rules.service.ts` | Release gate | Read | FIX: see D4 |
| `server/src/modules/trust/lot-state-machine.ts`, `lot-lifecycle.service.ts`, `lot-ledger*.ts` | Golden thread, ledger | Read | KEEP |
| `server/src/modules/trust/trust.controller.ts` | `POST /lots/:id/advance` | Read | FIX: refuse `QC_DECIDED` and `REJECTED` here (D5) |
| `server/src/modules/trust/write-guard.ts`, `regulated-collections.ts` | Generic-write policy | Read | IMPROVE: add new collections |
| `server/src/modules/phase2/traceability-dossier.ts`, `genealogy-builder.ts` | Authoritative genealogy | Searched | KEEP; extend read side |
| `server/src/modules/phase2/phase2.service.ts` | Stage consumption, `listAvailableLots` by reception status | Searched | NOT VERIFIED: gate on each stage |
| `server/src/modules/production/production.service.ts` | Double gate `STOCK_LIBERE` + `VALIDATED` | Read | KEEP: this is the model to copy |
| `server/src/modules/packaging/packaging.service.ts`, `stock/expedition-decrement.ts`, `atp/atp.service.ts`, `purchasing/stock-reorder.service.ts` | Trust `stock_lots.status` alone | Searched | FIX through D1, then NOT VERIFIED for the rest |
| `server/src/modules/analytics/analytics.service.ts` | Reads `moisture_pct`, `sugar_content_brix`, `defect_rate_pct` | Read in part | FIX: those fields are never written, so the averages have no data |
| `server/src/seed.ts` | Seeds `qc_checklists` | Searched | IMPROVE: becomes the plan seed |

### Client

| File | Role | Evidence | Decision |
|---|---|---|---|
| `src/components/reception/QCInspectionDialog.tsx` (1,334 lines) | The whole inspection in one dialog | Read to line 620 | REPLACE with the guided flow; keep `getRecommendedColdStorageZone` |
| `src/components/reception/ReceptionQcQueue.tsx` | Queue and scan | Written in Reception 2.0 | MERGE into Quality workspace |
| `src/components/reception/LabResultsDialog.tsx`, `src/hooks/useQCLabResults.ts` | Lab results; the block is called from the browser | Read in part | REFACTOR: server-side, atomic |
| `src/components/quality/QualityDashboard.tsx` | Two tabs: CAPA, audit | Read | REPLACE with the workspace |
| `src/components/quality/CAPAPanel.tsx`, `src/hooks/useCAPATickets.ts` | CAPA tickets | Searched | KEEP, relabel, link to NC |
| `src/components/quality/AuditTrailPanel.tsx` | Audit journal | Searched | KEEP |
| `src/components/reception/RapportQCDialog.tsx`, `printRQC.ts` | RQC paper form | Searched | KEEP; never distort print layouts |
| `src/components/reception/ReclamationFournisseurDialog.tsx`, `BonReclamationDialog.tsx` | Supplier claims | Searched | KEEP |
| `src/lib/royalPalmPhase1.ts` `computeQcScore` | Scoring | Read | MOVE to the server; the client shows the server's result |
| `src/lib/phase1RuleEngine.ts` | Supplier score writes from the browser, rejection and lab notifications | Read | REMOVE the writes (D8) |
| `src/lib/qcNCCodes.ts` | NC code list | Read | MOVE to the plan/NC configuration |
| `src/components/production/QualityCheckDialog.tsx`, `ProductionStepCard.tsx`, `phase2/triage/TriagePanel.tsx` | Other quality checks | Searched | NOT VERIFIED; R1 leaves them alone |
| `src/hooks/useReceptionsV2.ts` | QC hooks; strips `overridePhoto` | Read in part | REFACTOR into `useQuality.ts` |

Tests today: 7 client QC tests, reception lifecycle and integration suites, browser scenarios G and S.

## 4. Critical defects

| # | Severity | Defect | Evidence | Fix phase |
|---|---|---|---|---|
| D1 | **Critical** | A warehouse user can set `stock_lots.status = VALIDATED` and any quantity. `PATCH /stock/lots/:id` writes the raw body. Executed: quarantined lot became released, 100 kg became 5,000 kg, the reception lot stayed `EN_QUARANTAINE`. Packaging, expedition and ATP read this status | Executed | 2 |
| D2 | **Critical** | `POST /stock/lots` creates released stock with no reception, QC or ledger. Executed: 201, `VALIDATED`, 777 kg | Executed | 2 |
| D3 | **Critical** | `PATCH /qc-inspections/:id` rewrites a decided inspection with no audit row. Executed: comment and justification overwritten, 0 audit rows. Violates RG-Q10 | Executed | 2 |
| D4 | High | `isLotReleasedForProduction` accepts stock status **or** reception status, so one forged field passes. Production's own double check is stricter | Read | 2 |
| D5 | High | `POST /trust/lots/:id/advance` lets quality roles record `QC_DECIDED` with no inspection | Read | 2 |
| D6 | **Critical** | The server accepts any decision with no evidence. `submitQcDecision` takes the decision, score, grade and check results from the client. The integration test accepts `ACCEPTE` with only an inspection id | Read, executed | 4 |
| D7 | High | RG-Q04, RG-Q05, RG-Q06 and the REJETÉ NC rule are browser-only. `overridePhoto` is stripped in `useReceptionsV2.ts`. `nonconformityCodes` is sent and never stored | Read | 4 |
| D8 | High | The browser writes supplier scores and auto-block through `phase1RuleEngine.ts`, racing the server's `recalculateSupplierMetrics` | Read | 7 |
| D9 | High | **Fabricated defaults.** Six defect rates start at 0% and three tasting notes at 5/5, so unmeasured means perfect. The spec marks tasting notes mandatory with no default. Lab results default to `conformant: true` | Read | 6 |
| D10 | High | RG-Q07 is partial. `blockReceptionForLab` quarantines the reception's own lots; the spec requires blocking "même s'il est déjà en production". Derived lots are not reached, and the block is triggered from the browser, separately from saving the result | Read | 7 |
| D11 | Medium | RG-Q08 cannot work. Nothing writes `QC_CALIBRATION_OK`, only a read exists, so the warning is permanent and instruments are not modelled | Searched | 5 |
| D12 | Medium | Spec divergences: sampling guidance in code (≤1 t / >5 t) differs from the spec (<2 t, 2–5 t, >5 t); `lab_sample_code` is `LAB-${Date.now()}`, the spec wants `LAB-[LOT-ID]-[SEQ]`; "Seuils configurables par variété" is not implemented; the humidity range 10–40 and two inspection photos are not enforced | Read | 3–5 |
| D13 | Medium | The decision applies to every lot of a reception. Sage X3 decides per lot, and multi-lot receptions now exist | Read | 4 |
| D14 | Medium | Two NC stores with no link: `non_conformities` keyed to legacy `batch_id`; `capa_tickets` written with raw bodies by `quality-ext` | Read | 9 |
| D15 | Medium | Quality work lives under Réception; the Qualité tab holds only CAPA and audit (spec finding C5). Inspection has no assignment or request record | Read | 6 |
| D16 | Low | Analytics average fields that nothing writes (see section 3) | Read | 9 |
| D17 | Low | `getCalibrationStatus` and RG-Q11 daily report: scheduled report not found | Searched | 9, NOT VERIFIED |

**Stock statuses.** `reception_lots.stock_status` and `stock_lots.status` hold the same fact twice, joined by `reception-stock-sync.ts`. R1 keeps both, because many consumers read them, and makes them unwritable except through the quality service.

## 5. Reception 2.0 integration matrix

Verified on `febf1ab`.

| Step | State | Evidence |
|---|---|---|
| Reception confirmed | **Verified** | Scenarios A, L |
| Lot identified, quarantined | **Verified** | `EN_QUARANTAINE` lot, `QUARANTINE` stock, ledger events |
| QC work available | **Partial** | Implicit: the queue is a filter on `EN_ATTENTE_QC`. No request record, assignment or due date |
| Inspection performed | **Partial** | Works, with evidence kept only as the client sent it |
| Quality decision | **Partial** | Transactional and audited (N verified), but not validated (D6) |
| Stock eligibility updated | **Verified, with bypass** | Integration test; D1, D2 |
| Traceability updated | **Verified** | `QC_DECIDED` event; dossier reads QC tables |
| Authorized views refreshed | **Verified** | Scenarios J, S |

Contract to preserve: `POST /receptions/intake`, drafts, search and corrections stay unchanged. Reception owns delivery data, weighing and the intake lot. QMS reads them and never writes them. Stock owns quantities and movements. QMS changes eligibility only through `syncReceptionLotsToStock`.

**No season or campaign exists anywhere in the model.** Adding it belongs to Reception and needs a decision (section 19). QMS trend reports by season wait for it.

**Handoff gap.** `material-receptions` is a separate path for packaging and supplies. Whether those need QC is a factory question.

## 6. Existing vs proposed architecture

| Subsystem | Current | Defect | Keep | Proposed | Migration | Impact | Tests | Decision |
|---|---|---|---|---|---|---|---|---|
| Inspection lifecycle | Service inside receptions | Mixed concerns | Claim, replay, transaction | `modules/quality/inspection.service.ts` | Low | Reception delegates | Lifecycle moved intact | REFACTOR |
| Scoring | Browser | D6 | Formula | Pure `qc-evaluation.ts` on the server | Low | Client displays | Spec scenarios A, B as fixtures | REBUILD location |
| Criteria | Hard-coded; checklists seeded and unused | D12 | Spec values | Versioned plans on `qc_checklists` | Medium | None | Plan versioning | IMPROVE |
| Evidence | `rqc` blob, client `checkResults` | Unstructured | RQC form | `qc_check_results` with value states | Medium | Print reads them | Compatibility O | IMPROVE |
| Decision | `/qc/submit` | D6, D7 | Route, PIN, claim | Same route, server recomputes | Low | Dialog replaced | D, E, F, H | IMPROVE |
| Stock gate | Two statuses | D1, D2, D4 | Double check | Domain-only writes | Low | Stock UI, if any writes status | F, G | IMPROVE |
| NC / CAPA | Two stores | D14 | CAPA screen, codes | NC keyed by lot, CAPA linked | Medium | Batches legacy read-only | J | MERGE |
| Lab | Client orchestration | D10 | Screen | Server command, atomic, genealogy walk | Medium | Production blocks | G, N | REFACTOR |
| Inspection UI | 1,334-line dialog | D9, D15 | Print, zone suggestion | Guided page | High | Reception detail links | P | REPLACE |
| Traceability | Dossier, ledger | None found | Everything | Add QC read sections | Low | None | K | KEEP |
| Realtime | Id-only events | None | Bus, reconnect | New events through the same path | Low | None | K, L | KEEP |

## 7. Benchmark

Sources fetched: [Sage X3 Quality control](https://online-help.sagex3.com/erp/12/en-us/Content/FCT/GESSTQ.htm) (page truncated by the fetch tool; costing and reports sections not read), [Dolibarr Reception](https://wiki.dolibarr.org/index.php?title=Module_Reception), [Dolibarr Stock](https://wiki.dolibarr.org/index.php?title=Module_Stock). Both Dolibarr pages describe no quality control or inspection function, so Dolibarr offers no QMS benchmark. Other Dolibarr modules were not checked. **No superiority claim is supported by this.**

| Capability | Sage X3 (as documented) | Date Harvest Hub | Status | R1 |
|---|---|---|---|---|
| Stock statuses | A, Q, R plus sub-status | `VALIDATED`, `QUARANTINE`, `BLOCKED` | EXISTING, verified, bypassable | Fix |
| Automatic analysis request | From Q status, by product category | Implicit queue | PARTIAL | Yes |
| Control lead time | Receipt date + quality lead time | RG-Q01 browser alert | PARTIAL | Yes |
| Technical sheet of questions | Questions with non-standard responses that can block | Hard-coded form | PARTIAL | Yes: plans |
| Blocking responses | Can force rejection or new control | Auto-reject browser-only | BROKEN | Yes |
| Decision per lot/sub-lot | Yes, with split to several statuses | Whole reception | PARTIAL | Lot level; quantity split R2 |
| Accepted/refused quantity | Yes | All or nothing | MISSING | R2, REQUIRES FACTORY APPROVAL |
| AQL sampling | Size, rejection size, limit | Spec table only | MISSING | R2 |
| Two-stage entry then status | Yes | One step | PARTIAL | Yes |
| Reason codes | Miscellaneous table | NC codes | PARTIAL | Yes |
| Certificates | Not in the text read | RQC print | NOT VERIFIED | Store external documents only |
| Supplier history | Not in the text read | Scores | EXISTING | Server-owned |
| Trace to shipment | Not in the text read | Genealogy | EXISTING, verified | Yes |

## 8. Date-specific requirements

Values are from Spec v4.0 unless marked. **All require quality-manager confirmation before publication.**

| Criterion | Kind | Rule in spec | Status |
|---|---|---|---|
| Humidity × 3 | Objective, instrument | 10–40; average; green 20–26 (DN), yellow 18–20 or 26–28, red otherwise; configurable by variety | Partial |
| Length × 10 | Objective, instrument | Mean, standard deviation; INNORPI classes ≥45 / 40–45 / 35–40 / <35. INNORPI number not verified in `standards-matrix.md` | Partial |
| Six defects | Visual estimate | Extra, downgrade and reject thresholds per defect | Reject partly; **Extra and downgrade thresholds unimplemented** |
| Three tasting notes | Sensory | 1–5, mandatory, no default | Defect D9 |
| Photos ≥ 2 | Evidence | Overview and defect close-up | Not enforced |
| Lab sample | Document/result | Required > 5 t, new supplier or suspected contamination | Partial |
| Sampling | Procedure | 2 kg / 3 kg / 5 kg by lot size, opened crates | Divergent (D12) |
| Bio | Document | Certification check at intake (RG-R05) | Verified at intake |
| Score, grade | Derived | Weighted /100; EXTRA ≥85, CAT I 70–84, CAT II 55–69, REJETÉ <55 | Client only |
| Auto-reject | Rule | Mold >2, fermentation >1, insects >5, humidity >32 or <14 | Client only |
| Color, foreign bodies, packaging integrity | Candidate | **Not in the spec** | REQUIRES FACTORY APPROVAL |
| RQC grid (infestée, fermentée…) | Paper form | In code, not in Spec v4.0 | REQUIRES FACTORY APPROVAL: both forms, or one? |

Evidence classes on every result: `MEASURED`, `OBSERVED`, `DOCUMENT`, `DEVICE`, `DERIVED`, `DECISION`. Value states: `NOT_MEASURED`, `MEASURED`, `MISSING_EVIDENCE`, `NOT_APPLICABLE`, `INVALID`, `AWAITING_REVIEW`. A missing value is never a pass.

Spec scenario A and scenario B become the first test fixtures.

## 9. Employee workflow

Four steps on one page, not a dialog. Spec target: 20–30 minutes per lot.

1. **Choisir le lot.** Queue oldest first, or scan. Lot card: supplier, variety, weight, zone, time since arrival, sampling quantity from the plan.
2. **Inspecter.** Groups from the plan: Humidité, Calibre, Défauts, Dégustation, Photos, Labo if required. Numeric keypad; 10 length entries in a row. Saved on each change. A clear reject shows immediately, as spec scenario B requires, and the inspector need not finish every field.
3. **Vérifier.** Server result: score, grade, recommended decision, what is missing, and why.
4. **Décider.** Accept with PIN, quarantine or reject. Deviating from the recommendation needs 20 characters and a photo. Over 10 t a second inspector enters independently and sees the first result only afterwards.

Result screen: status, what happens next, and the storage link for released lots.

## 10. Workspace

The `quality` tab becomes one page, with inspectors landing on it.

| Section | Contents | Roles |
|---|---|---|
| À contrôler | Pending, oldest first, RG-Q02 delay flags | All quality |
| En cours | Open inspections, awaiting second inspector, awaiting lab | All quality |
| Non-conformités | Open NC, then linked CAPA | All quality; close by manager |
| Historique | Search by lot, supplier, date, decision | Read roles |
| Pilotage | Section 15 | Managers |
| Journal d'audit | Existing panel | Audit roles |

Réception's Contrôle QC tab becomes a link. Old `?tab=receptions&view=qc` deep links redirect. The lot's detail page keeps a read-only Qualité section.

## 11. Data model

Extend, do not add parallel stores.

| Collection | Change |
|---|---|
| `qc_checklists` | Adds `version`, `status` (`DRAFT`, `PUBLISHED`, `RETIRED`), `applies_to` (variety, reception type), `sampling_rules`, `scoring`, `published_by/at`. Published rows are immutable |
| `qc_checklist_items` | Adds `kind`, `unit`, `sample_count`, `required`, `min/max`, `bands`, `auto_reject` |
| `qc_inspections` | Adds `lot_ids`, `plan_id`, `plan_version`, `plan_snapshot`, `state` (`OPEN`, `SUBMITTED`, `AWAITING_SECOND`, `DECIDED`), `version`, `evaluation`, `second_inspector_id`, `due_at`. `decision` stays. Immutable once decided |
| `qc_check_results` | Adds `item_id`, `evidence_class`, `value_state`, `values[]`, `unit`, `instrument_id`, `recorded_by/at`. One row per criterion |
| `qc_evidence` (new) | One document per photo or file; hash, type, size, author. Validated by content, 5 MB limit as at intake |
| `qc_corrections` (new) | Append-only RG-Q10 corrections linked to the original |
| `qc_instruments` (new) | Instrument, calibration date, next due, for RG-Q08 |
| `non_conformities` | Adds `lot_ids`, `inspection_id`, `nc_code`, `status`, `disposition`, `resolved_by`. Legacy `batch_id` kept |
| `capa_tickets` | Adds `nc_id`; server-owned status transitions |

Historic inspections carry no plan and display as "plan antérieur" using stored values. They are never rescored.

## 12. Decision and authorization model

| Action | Roles | Conditions enforced by the server |
|---|---|---|
| Open, record | `QUALITY_ROLES` | Not the reception's creator (RG-Q12) |
| Submit | Same | All required items resolved |
| Accept | Same (spec: inspector decides) | Complete evidence, no auto-reject, PIN, override rules, second inspector over 10 t, separate people |
| Quarantine, reject | Same | Reason; reject needs an NC code |
| Lot release from quarantine | Same, with PIN | Existing checks plus separation |
| Correct | `responsable_qualite`, `resp_management_qualite`, `resp_qualite_haccp` | Reason; original untouched |
| Publish plan | Quality managers | Never an inspector |

Inspector-versus-supervisor release is a factory decision (section 19). The spec lets inspectors decide, so R1 does not invent a stricter split.

**Gate.** A lot is eligible only when `reception_lots.stock_status = STOCK_LIBERE` **and** `stock_lots.status = VALIDATED`, through one shared `assertLotEligible`. RG-Q06: a lot may advance as `En attente labo`, as the spec says.

**Stock mapping stays as it is:** `EN_QUARANTAINE`→`QUARANTINE`, `STOCK_LIBERE`→`VALIDATED`, `STOCK_REJETE`→`BLOCKED`. No new statuses.

## 13. Stock and non-conformity flows

**Decision transaction:** claim inspection → results → NC rows → lots → units → stock projection → order → reception header → ledger → audit. Notifications, supplier metrics and realtime run after commit. The pattern already exists and is tested by scenario N's precursor.

**NC lifecycle:** `OUVERTE` (from a decision, or manually) → `EN_TRAITEMENT` → `DISPOSITION_PROPOSEE` → `RESOLUE` → `CLOTUREE`. The lot stays restricted throughout. Disposition values come from the factory, because release, rework, return and destruction need written rules (section 19). Spec scenario B gives return within 48 h, so that one is known. Full CAPA effectiveness review is R2.

**Lab results:** one server command stores results and, if non-conforming, in one transaction blocks the lot and every lot derived from it found through genealogy, raises a critical alert, and records the ledger. Consumed quantities are never reversed automatically.

## 14. Realtime and traceability

New events use `publishRealtimeDbChange` through `afterCommit`, ids only, staff roles: `qc_results_saved`, `qc_submitted`, `qc_decided`, `qc_lab_recorded`, `nc_changed`. Add a `Quality` RTK tag. Reconnect refresh and the silent-stream watchdog from Reception 2.0 already cover recovery. Saves use `version`, so two editors get `QC_STALE` instead of overwriting.

Traceability: no second engine. `traceability-dossier.ts` gains plan version, evidence, corrections and NC. An investigation view reads backward and forward from the existing genealogy to answer the six manager questions.

## 15. Reporting

| Measure | Definition |
|---|---|
| À contrôler, en retard | Open inspections; over 4 h, over 12 h from gate arrival |
| Décisions | Count by decision over the period; denominator is decided inspections |
| Taux de rejet par fournisseur | Rejected ÷ decided, with the count shown |
| Défauts récurrents | NC by code and variety |
| Temps d'inspection | `ended_at − started_at`, median |
| Blocages labo | Lab blocks and affected lots |

Each figure links to its inspections. Retest rate and yield need data that does not exist yet and are R2. RG-Q11's nightly email needs mail configuration verified first.

## 16. Migration

Additive only. Never run against production during development.

1. Seed the plan as `DRAFT`; a manager publishes it.
2. No backfill of historic inspections. They stay readable.
3. Unique partial index: one open inspection per lot, created best-effort with the replacement pattern from Reception.
4. Check for existing duplicates before each unique index and report rather than delete.
5. Backup and dry run on a copy; rollback is removing new routes, as old fields are untouched.

## 17. Releases

**R1 — Reception-stage quality.** Bypass closure, server evaluation, published plan, lot-level decision, evidence, lab, NC, workspace, realtime, traceability, core reporting, tests.

**R2.** AQL sampling, quantity split, instruments with reminders, in-process and finished-product plans, CAPA effectiveness, supplier scorecards, season reporting.

**R3.** Read-only assistant through the same domain services, document extraction, trend explanation. It never measures, decides, releases or moves stock. Vision only after hardware and data validation.

**R1 acceptance:** every row of section 20 passes in a browser against a replica set, the quality manager signs the plan values, and a real inspector completes spec scenarios A and B. Hardware and floor acceptance are reported separately.

## 18. Execution phases

Each phase ends with its tests green and is committed on its own. Rollback is reverting that phase's commits unless stated.

### Phase 0 — Baseline
Commit or merge per the Reception handoff; branch `feature/qms-r1` from the result. Record test and type baselines. **Done when** the Reception suite passes on the base, including scenario H on the combined code.

### Phase 1 — Complete the audit
Read every `searched` and `NOT VERIFIED` file. Trace every writer of `stock_status`, `stock_lots.status` and `qc_*`. Confirm each consumer of `PATCH /stock/lots` first. Update section 3. **No code changes.**

### Phase 2 — Close bypasses (shippable alone)
Edit `collections.service.ts`: guards for `stock_lots` status and quantities, and `qc_inspections`, with `trustedInternal`. Edit `stock.controller.ts`: allowlist for PATCH; POST cannot set released status. Edit `receptions-ext.controller.ts`: remove the inspection PATCH and move lab results to a command. Edit `gate-rules.ts`: require both statuses. Edit `trust.controller.ts`: refuse quality stages. Edit `write-guard.ts`.
**Preserve** inventory adjustments through movements, and packaging and phase-2 internal writes. **Risk:** a legitimate caller of the PATCH; Phase 1 finds it. **Tests:** each of D1–D5 executed as an API test that fails today.

Phase 2 is extended by section 23, which closes D18 to D28 and the release-gate parts of D6 and D7.

### Phase 3 — Contracts
Create `server/src/modules/quality/quality.module.ts`, `inspection.service.ts`, `qc-evaluation.ts`, `qc-plans.service.ts`, `quality.controller.ts`, `quality-roles.ts`. Create `src/types/quality.ts`. Move QC code from `receptions.service.ts` with no behaviour change. **Tests:** existing lifecycle tests pass untouched, which is the proof.

### Phase 4 — Server rules
Implement `qc-evaluation.ts` from section 4.3 of the spec, with spec scenarios as fixtures. `submitQcDecision` recomputes and refuses inconsistent decisions; client score fields are ignored. Enforce RG-Q04, Q05, Q06, REJETÉ NC, RG-Q12. Decide at lot level, keeping reception-level as "all lots". **Keep** `/qc/start`, `/qc/submit`, replay and PIN. **Tests:** D, E, F, H, N.

### Phase 5 — Plans and evidence
Plan versioning in `qc-plans.service.ts`; seed from the spec as `DRAFT`. Result saving with `version`. `qc_evidence` validation. `qc_instruments` for RG-Q08. **Tests:** changing a published plan creates a new version; a historic inspection keeps its result; invalid file refused.

### Phase 6 — Workspace and flow
Create `src/components/quality/QualityWorkspace.tsx`, `inspection/InspectionFlow.tsx`, `StepSelectLot`, `StepInspect`, `StepReview`, `StepDecide`, `src/hooks/useQuality.ts`. Replace `QualityDashboard`. Remove `QCInspectionDialog` after migrating `getRecommendedColdStorageZone`, its importers and tests. Measurements start empty. No client scoring. **Tests:** React interaction, 375/768/1280 widths, accessibility, French copy.

### Phase 7 — Stock, production, reception
Shared `assertLotEligible` for production, phase 2, packaging, expedition and ATP. Server-side lab command with genealogy block. Delete browser writes in `phase1RuleEngine.ts`. **Tests:** G, Q and retroactive block on a derived lot.

### Phase 8 — Realtime and traceability
Events, tags, dossier additions, investigation view. **Tests:** K, L.

### Phase 9 — NC and reporting
Merge NC, link CAPA, reporting endpoints, remove dead analytics fields. **Tests:** J; figures match seeded data exactly.

### Phase 10 — Cleanup
Remove dead QC code, split the remaining large service, resolve lint in changed files, measure queue and save timing.

### Phase 11 — Verification
Full matrix on a replica set; `scripts/e2e/quality.e2e.mjs` beside the reception suite.

### Phase 12 — Acceptance
Update `docs/`, record exact results, run the plan-approval and floor session.

Dependencies: 0 → 1 → 2, 3 → 4 → 5 → 6, then 7, 8, 9 in parallel → 10 → 11 → 12. Phase 2 ships independently and should not wait.

## 19. Decisions needed from the factory

| # | Question | Needed by |
|---|---|---|
| Q1 | Are the spec's thresholds, weights and classes current for Deglet Nour, and per variety? | Phase 5 |
| Q2 | May an inspector release alone, or must a supervisor approve? | Phase 4 |
| Q3 | Which dispositions are permitted, by whom? | Phase 9 |
| Q4 | Keep both the spec form and the RQC grid, or merge them? | Phase 5 |
| Q5 | Does quarantine for CAT II match the spec's "Transformation ou marché local"? | Phase 4 |
| Q6 | Are color, foreign bodies and packaging integrity checked? | Phase 5 |
| Q7 | Is season/campaign required, and how is it defined? | R2 |
| Q8 | Do packaging and supplies need incoming QC? | Phase 1 |
| Q9 | RG-Q03 SMS and email: which provider, and is it wanted? | Phase 9 |

## 20. Acceptance matrix

| ID | Scenario | Type |
|---|---|---|
| A | Reception creates the QC handoff | Integration, browser |
| B | Inspector opens a pending inspection | Browser |
| C | Measurements recorded with units and provenance | Unit, browser |
| D | Missing evidence blocks the decision, including through a direct API call | API |
| E | Approved lot becomes eligible in both statuses | Integration |
| F | Warehouse and reception roles cannot release, by any route | API |
| G | Rejected or quarantined lot refused by production, phase 2, packaging, expedition | API |
| H | Two users cannot produce conflicting decisions | Integration |
| I | Duplicate submission creates one inspection and one decision | Integration |
| J | NC keeps its lots through disposition | Integration |
| K | Authorized clients update; portal accounts receive nothing | Browser, API |
| L | Reconnect recovers state | Browser |
| M | Original evidence and corrections both readable | Integration |
| N | Forced failure at each write leaves nothing partial | Integration |
| O | Historic records open, unrescored | Browser |
| P | Full QC journey, tablet and desktop | Browser |
| Q | Golden-thread gates respected; fumigation and CCP unchanged | Integration |
| R | Spec scenarios A and B produce the spec's scores | Unit |
| S | D1–D5 stay closed | API |

Hardware instruments and factory acceptance are reported as NOT VERIFIED until performed on site.

## 21. Agent Mode instructions

1. Do not start until Phase 0 is true. Never use the main checkout or Atlas. Use a local replica set.
2. Work one phase at a time. Inspect, write the failing test, implement, verify, then commit only if the user has authorised commits.
3. Do not change a threshold, role or status beyond this plan. A gap goes to section 19.
4. Measurements never get a default. No client value is trusted for a score, grade or decision.
5. Keep Reception's contracts. Run its full browser suite after Phases 2, 4, 7 and 11.
6. Report PASS, FAIL, BLOCKED or NOT VERIFIED with commands and results.

## 22. Risks

| Risk | Mitigation |
|---|---|
| Closing D1 breaks a hidden caller | Phase 1 traces all callers; API tests |
| Stricter gate blocks real lots with stale statuses | Report-only dry run on a copy before the gate is enforced |
| Spec is outdated | Q1 sign-off; plans are versioned |
| Workspace rebuild delays safety fixes | Phases 2 and 4 ship before the UI |

## 23. QC release boundary (added 2026-10-31)

This section records what the release gate found after Phase 2 and what now holds. It extends the plan and changes neither its objective nor its phases: a simple, modern, real-time, date-specific QMS integrated with Reception 2.0.

### Bypasses found and closed

| # | Severity | Path | Proof before the fix | Closed by |
|---|---|---|---|---|
| D18 | **Critical** | `POST /batches/:id/decide` wrote `stock_status` on every lot of a reception, with no inspection, PIN or audit, and took the decider's name from the body | Draft reception, batch decision and one lot edit reached `VALIDATED`, then allocation returned 201, with PIN and scan gates enforced | Route and `decideQC` removed; no client, script or test used them. `qc_decision` fields on batches refused on generic writes |
| D19 | **Critical** | `syncReceptionLotsToStock` raised stock to `VALIDATED` for any caller | The last step of D18 | Only a QC decision can raise stock. Other callers can hold or reject, and otherwise leave the status alone |
| D20 | **Critical** | `/qc/submit` accepted `ACCEPTE` with no checks | 0 check rows, lot released, even with a valid PIN | `qc-evidence.ts`, section below |
| D21 | **Critical** | `/qc/submit` accepted a `CRITIQUE` failure with `REJETE` recommended | Lot released | Refused, with no override |
| D22 | **Critical** | `NUMERIC_SIGNATURE_GATE` defaulted to `warn`, so a QC release needed no PIN | Released with `release_pin_verified: false` | Fails closed, section below |
| D23 | **Critical** | Lot `RELEASE` needed only a reason | Quarantined lot released with no new evidence | Re-inspection, section below |
| D24 | High | A same-decision replay re-applied a decision without evidence or PIN when a reception was still in QC | Read | A replay returns the record and applies nothing |
| D25 | High | A storage move wrote `VALIDATED` to stock for a lot whose reception side read released | Read, then tested | A move can hold a lot, never release it |
| D26 | High | The production gate refused fully consumed lots and could miss a held row of a split lot | Tested | `stockSideStatus`, and every stock row is read at allocation and start |
| D28 | High | An acceptance on a held reception covered every lot, so a lot rejected on its own through a reject zone was released with the others | Tested: rejected lot read `STOCK_LIBERE` | An acceptance covers only lots that are not rejected |
| D27 | High | Demo, smoke and simulator scripts defaulted to `:4000`, which runs on live Atlas | Two test suppliers written to Atlas on 2026-10-31, since deleted | `resolveTestApi`: no default, local only, development ports refused |

### Canonical release boundary

- **Reception** owns intake records and creates lots in quarantine.
- **QMS** owns evidence and decisions. Only two commands can release a lot: `POST /qc/submit` and `POST /reception-lots/:lotId/quality-status` with `RELEASE`. Both run the same evidence rules and the same signature. No other route, projection or generic write can record a QC decision or raise stock to `VALIDATED`.
- **Stock** owns quantities and locations. Its routes cannot change status, quantities, the reception link or QC stamps.
- **Production** checks actual eligibility: both statuses released, every active stock row, at allocation and at start.
- **Ledger and genealogy** keep the history. Earlier inspections are never edited.

`server/src/modules/receptions/qc-evidence.ts` is the interim contract. Phase 3 moves it into the quality module; it must not become a second engine.

### Evidence validation

Requirements come from the active `qc_checklists` version for the reception type, not from code. The seeded `QC-DATES-STD` v1 and `QC-PACK-STD` v1 are what exists today and still need the factory's sign-off (Q1 in section 19).

| Case | Result |
|---|---|
| No active checklist or no items | `QC_POLICY_UNAVAILABLE`, nothing recorded |
| Two active checklists | `QC_POLICY_AMBIGUOUS`, nothing recorded |
| `ACCEPTE` with any item unanswered, or `NA` | `QC_EVIDENCE_INCOMPLETE`, naming the items |
| `QUARANTAINE` or `REJETE` with no answered check | `QC_EVIDENCE_INCOMPLETE`; one check is enough, so a hold stays quick |
| Check listed twice | `QC_EVIDENCE_INVALID` |
| `CRITIQUE` failure, or any automatic rejection reason, on `ACCEPTE` | `QC_CRITICAL_NONCONFORMITY`, with no override |
| Other failure on `ACCEPTE`, or a changed recommendation | RG-Q04: 20-character justification and a photo |

Severity comes from the checklist, so the client cannot lower it. The decision stores `checklist_id`, `checklist_code` and `checklist_version`, and each check row stores its item and version.

**Still open for Phase 4 (D6, D7):** thresholds, score and recommended decision are still computed in the browser. The server enforces that the checklist was answered and refuses what it is told is critical, but does not yet recompute measurements. `NA` counts as missing because no policy says when it is allowed; the factory must decide that.

### PIN enforcement

`releaseSignatureGateMode()` applies to `qc_release`. Production always enforces, whatever is configured. Elsewhere, an unset gate enforces and a weaker mode must be set explicitly. Fumigation and purchasing signatures keep `numericSignatureGateMode()`, so they remain `warn` by default; that needs its own decision.

Before this reaches a stack with real users: run `scripts/audit-pin-readiness.mjs` on a sanitized snapshot, and have every quality user set a PIN. A user with no PIN cannot release.

### Re-release after a hold

`RELEASE` is a re-inspection, not a status edit. It needs a reason, the full checklist answered again, and a signature. It creates a new `qc_inspections` row with `purpose: REINSPECTION`, `reception_lot_id` and `supersedes_inspection_id`, in one transaction with the release. The decision that held the lot is not touched. A rejected lot has no release path.

### Lot eligibility

A lot is eligible only if its reception status and every non-consumed stock row are released. Consumed rows say nothing about quality. Lots with one side on record (packaged goods, older reception lots) are judged on that side. FEFO suggestions, `listAvailableLots` and expedition still read the stock status only; Phase 7's shared `assertLotEligible` replaces them.

### Historical reconciliation

No historical lot is changed automatically. `scripts/audit-lot-reconciliation.mjs` reads a sanitized snapshot and reports 13 finding types with an owner and a remediation. Each critical finding is resolved by a person through a new inspection. Lots already released without evidence stay on the report as a HACCP record; they are not re-signed. Running against Atlas needs the owner's explicit approval.

### Required regression tests

`qc-release.http.integration.test.ts` (real HTTP, real replica set) must stay green, and covers: draft to batch to edit to allocation; evidence missing or partial; policy missing or ambiguous; critical failures; PIN missing, wrong, unconfigured and correct; unauthorized roles; re-release; replay; conflicting decisions; failed transactions; split and consumed stock; blocked allocation. Browser scenarios P and Q cover the PIN dialog and the re-inspection screen.

**DATE HARVEST HUB — CONTRÔLE QUALITÉ 2.0 MASTER PLAN READY FOR AGENT MODE**
