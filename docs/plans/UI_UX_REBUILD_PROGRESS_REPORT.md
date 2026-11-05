# Date Harvest — UI/UX rebuild progress report

**Date:** 1 November 2026  
**Branch:** `fix/supplier-simplify` (from Phase 1 candidate `3c7b695`)  
**Status:** Incremental rebuild in progress — **not** a claim of full commercial completion.

## 1. Verdict

The Datte / Sel / Palme / Deglet design language, Filière navigation, SummaryStrip, three-step reception intake, role landings, and truthful DataState infrastructure were already the right foundation. This session **did not restart the product**. It reconciled preserved honesty patches, finished the supplier simplification already underway, hardened worker primary actions, added shared operational primitives, and removed fabricated analytics yield/cost defaults.

Independent audit ([Frontend UI audit](029543b4-c535-4e47-8ee7-032d68596c9d)) confirms: shell/tokens are credible; prefer density/navigation passes and shared primitives; do not rewrite reception/QC/stock/phase2 domain engines.

Follow-up from that audit: deleted unused `FlowStepper`; slimmed `WorkflowNavigation` to phone bottom bar + overflow sheet (removed dead tablet carousel).

Industrial blockers (stock reconciliation, genealogy quantity integrity, multi-tenant SaaS isolation) remain **open** and are not disguised as UI success.

## 2. Before → after (this session)

| Area | Before | After |
|---|---|---|
| Suppliers create/edit | Enormous dialog (~900+ lines), many always-visible fields | Progressive disclosure: Essentiel first; identité / oasis / commercial / conformité collapsible |
| Supplier detail | Oversized sheet | Compact sheet: identity, score (or honest unavailable), linked lots/orders/payments |
| Supplier score | Risk of showing invented 0 scores | `hasSupplierScoreData` → « Score indisponible » until operational facts exist |
| Supplier pickers | Could offer non-active suppliers | `isReceivableSupplier` gate on reception / PO / requisition / inbound notice |
| Supplier list chrome | ModuleHero title/stats ignored by current ModuleHero | SummaryStrip + EmptyState aligned with design system |
| Offline reception honesty | Patch preserved but unapplied on dirty tree | Applied `.local/phase1/preexisting.patch` (outbox retry, intake confirmation wording, draft conflict) |
| Worker home CTA | Compact role button | Full-width `min-h-12` primary action; clearer copy |
| Shared ops kit | Scattered local EmptyStates | `QuantityDisplay`, `LotReference`, `OperatorActionBar`, `PageHeader`, `EmptyState` + barrel export |
| Reception register | Raw mono + bare kg numbers | `LotReference` + `QuantityDisplay`, taller touch rows |
| Analytics yield | Default **100 %** with no mass | `null` → « Non mesuré » |
| Analytics downtime | Fabricated category split | Measured delays only, or empty |
| Loss cost TND | Hardcoded 2.2 TND/kg | `costEstimate: null` until costing source exists |

## 3. Routes / components touched

### Frontend
- `src/components/mes/SupplierDialog.tsx`, `SupplierDetailSheet.tsx`, `SuppliersList.tsx`, `SupplierScorePanel.tsx` (new)
- `src/pages/SupplierPortal.tsx`
- `src/components/purchasing/PurchaseOrderDialog.tsx`, `RequisitionDialog.tsx`
- `src/components/reception/InboundNoticeDialog.tsx`, `QCInspectionDialog.tsx`, `intake/StepDelivery.tsx`
- `src/components/reception/intake/ReceptionIntakeFlow.tsx` (+ offline honesty)
- `src/components/reception/ReceptionDashboardV2.tsx`, `ReceptionQcQueue.tsx`
- `src/components/home/RoleLanding.tsx`, `HomePage.tsx`
- `src/components/layout/OfflineSyncStatus.tsx`
- `src/hooks/useReceptionDraft.ts`, `useReceptionIntake.ts`, `useAdvancedAnalytics.ts`
- `src/lib/offline/outbox.ts`, `apiTarget.ts`, `royalPalmPhase1.ts`
- `src/components/shared/*` (new primitives + index)
- `src/components/analytics/ExecutiveDashboard.tsx`, `AdvancedProductionPanel.tsx`, `AdvancedQualityPanel.tsx`
- `src/types/analytics.ts`

### Backend (supplier integrity, already in working tree)
- `server/src/modules/suppliers/*`, `receptions.service.ts`, `collections.service.ts`, `seed.ts`, `config/constants.ts`

## 4. Design system

**Preserved as source of truth:** `tailwind.config.ts`, `src/index.css`, `docs/design/DATE_HARVEST_DESIGN_SYSTEM.md`.

Tokens: Datte shell, Sel page, Palme primary, Deglet Filière thread only, Barlow / Barlow Semi Condensed, flat surfaces, 3–6 px radii, no resting shadows.

New reusable ops components follow that system (no glows, no competing purple themes).

## 5. Operational workflow changes

- Reception pickers only list **active** suppliers.
- Supplier create path focuses on fields workers/buyers need first.
- Score shown only when delivery/QC facts exist.
- Offline confirmation no longer implies a server lot number before persistence.
- Executive/production analytics no longer claim perfect yield or invented TND loss cost.

## 6. Real-time

Unchanged architecture: SSE via `getSseConnection()`, `RealtimeIndicator`, Factory Command Center refetch on `db_change`. No fake live transactions added. Offline outbox honesty restored from the preserved patch.

## 7. Verification run (this session)

| Check | Result |
|---|---|
| Focused Vitest (supplier, offline, role landing, intake, QC, supplier domain/controller) | **87/87 PASS** (7 files) |
| Full frontend `tsc` | **NOT RERUN** — historical ~205 diagnostics remain baseline debt |
| Full Vitest / Playwright role suite | **NOT RERUN** this session |
| Factory employee acceptance | **NOT VERIFIED** |
| Screenshots this session | **Not newly captured** — prior evidence under `docs/design/screenshots/` and `docs/plans/evidence/2026-11-01-phase1/` |

## 8. Confirmed blockers (unchanged industrial)

1. Stock reconciliation / parent–sub-lot quantity inflation (historical manufacturing thread).
2. Incomplete real manufacturing end-to-end for some routes.
3. No production-ready multi-customer / multi-site tenant isolation claim.
4. Analytics still partial; many zero/unmeasured fields need screen-by-screen honesty pass.
5. Arabic/Darija: `ar.json` + RTL dir exist; full terminology validation with factory workers **NOT VERIFIED**.
6. FactoryCommandCenter wall view still uses a dark “ops board” aesthetic with motion accents — intentional for `?tab=live`, not yet fully flattened to Sel surfaces.

## 9. Outstanding work (priority)

1. Finish remaining Phase 1 visual/action coverage matrix rows.
2. Adopt shared primitives (`EmptyState`, `QuantityDisplay`, `LotReference`, `OperatorActionBar`) across stock, QC queue, packaging, logistics.
3. Worker tablet pass on QC inspection checklist density.
4. Traceability Lot Journey visual polish on real genealogy only.
5. Tunisian Darija keys for reception/QC worker strings (validated with operators).
6. Commit supplier-simplify + offline honesty after review (user-requested commit only).
7. Full role browser suite + screenshots on disposable local stack.

## 10. Customer demo walkthrough (~10 minutes)

Use a **demo/test** database only. Never mix synthetic events into a live factory DB.

1. **Sign-in** as `directeur_usine` → Accueil shows role workspace + « Voir l’activité de l’usine ».
2. **Cockpit / Accueil** → « À faire aujourd’hui » queue (alerts, QC, quarantine, shipments) with honest coverage warnings if any source failed.
3. **Fournisseurs** → Search a Deglet Nour producer (Tozeur/Kebili). Open sheet: oasis, score or « indisponible », linked lots.
4. Switch to **`operateur_reception`** → large « Nouvelle réception ».
5. **Intake 3 steps:** fournisseur actif → pesée → confirmer. Show offline banner if disconnected; no lot number until server confirms.
6. **`inspecteur_qualite`** → Contrôler un lot → checklist + PIN release (no QC bypass).
7. **Stock** → quarantined vs available (truthful empty/restricted states).
8. **Scan / passport** → lot journey supplier → reception → QC → next stage (only real links).
9. **Expédition** (if seeded) → pending shipment status.
10. Close with **Indicateurs**: yield shows « Non mesuré » when no mass — commercial honesty.

## Route coverage matrix (current product tabs)

| Route / tab | UX class | Session status |
|---|---|---|
| `/auth` | Existing | Untouched |
| `/` shell + Filière | Existing Phase 1 | Preserved |
| `?tab=home` | Role landing + tasks | Worker CTA / touch density improved |
| `?tab=scan` | Partial | Untouched |
| `?tab=alerts` | Partial | Untouched |
| `?tab=live` | Wall board | Untouched (known aesthetic debt) |
| `?tab=receptions` | Strong | Register + offline honesty + receivable suppliers |
| `?tab=receptions&view=qc` | Strong | Worker scan targets, EmptyState, LotReference/QuantityDisplay |
| `?tab=storage` (+ stock-*) | Partial | Untouched |
| `?tab=production` | Partial | Untouched |
| `?tab=packaging` | Partial | Untouched |
| `?tab=logistics` | Partial | Untouched |
| `?tab=export` | Partial | Untouched |
| `?tab=suppliers` | Restructured | **Simplified this session** |
| `?tab=purchasing` | Partial | Receivable supplier filter |
| `?tab=materials` | Partial | Untouched |
| `?tab=customers` | Partial | Untouched |
| `?tab=quality` | Partial | Untouched |
| `?tab=maintenance` | Partial | Untouched |
| `?tab=hr` | Partial | Untouched |
| `?tab=analytics` | Partial | Yield/cost honesty |
| `?tab=sage-operations` | Partial | Untouched |
| `?tab=settings` | Partial | Untouched |
| `/portail` | Supplier portal | Simplified alignment |
| `/passport/:lotId` | Public | Untouched |
| `/alerts` | Standalone | Untouched |
| `/dashboard` | Alias → Index | Untouched |

**Do not treat this matrix as 100 % visual acceptance.** Rows marked Untouched still rely on Phase 1 / earlier redesign evidence.
