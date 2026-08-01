# Roadmap v2.1 — Date Harvest Hub

**Position:** MES traçabilité dattes (Core) → Ops+ → ERP Connect  
**Goal:** close buyer gaps without overselling “full ERP”.

---

## Horizon A — 2 weeks (ship now / in progress)

| # | Deliverable | Why buyers care | Status |
|---|---|---|---|
| A1 | **Fiche CMS** — edit steps / limits / if-blocked, save to site settings | Floor SOPs match the real plant | **In progress** |
| A2 | **Sales kit** — DEMO_RUNBOOK + UAT_CHECKLIST | Repeatable demos & acceptance | **In progress** |
| A3 | Product map + handoff already in v2.0 | Clarity of scope | Done |
| A4 | `npm run product:check` | Pre-demo gate | Done |

**Exit criteria (2 weeks)**  
- Quality manager can change FT-05 CCP limits without a code deploy  
- Demo script runs in ≤ 30 minutes  
- UAT checklist signed by buyer IT / Ops  

---

## Horizon B — 6 weeks (Ops+)

| # | Deliverable | Why |
|---|---|---|
| B1 | **Lab QC fields** linked to reception decision (humidité, défauts %) | Real QC, not only status |
| B2 | **Recall report** timed PDF (upstream + downstream) | Audit / client export |
| B3 | **Label templates** PF (lot, grade, net weight, QR) | Shipping floor |
| B4 | **Fiche acknowledgment** — operator marks “lu / appliqué” per shift | Training evidence |
| B5 | One-click **demo:season** seed (full A→Z lot story) | Sales acceleration |

**Exit criteria**  
- Recall drill demo &lt; 10 minutes with printable report  
- Labels printable from packing close  

---

## Horizon C — 3 months (ERP Connect)

| # | Deliverable | Why |
|---|---|---|
| C1 | **Facture export lite** (HT / TVA / TTC, TND) | Commercial close |
| C2 | **TVA rates** in settings (TN) | Local compliance |
| C3 | **Sage / CSV export** of invoices + settlements | Don’t replace GL — bridge it |
| C4 | Optional lite AR (invoice status: draft / sent / paid) | Cash visibility |
| C5 | Multi-site settings hardening (already P2P sites) | Group plants |

**Exit criteria**  
- Buyer can issue export invoice with TVA and push CSV to accountant / Sage  
- Contract wording: “MES + Connect compta”, not “ERP complet”  

---

## Explicit non-goals (for now)

- Full GL / bank reconciliation / paie CNSS  
- Replacing Sage as system of record  
- Offline-first mobile OS apps (PWA later)  

---

## Packaging for sale

| SKU | Includes | Price framing |
|---|---|---|
| **Core MES** | Parcours, CCP, triage, packing, BRA/BDE, fiches (+ CMS) | Base |
| **Ops+** | Costing, settlements, margin, recall, labels, lab | + |
| **ERP Connect** | Invoices, TVA, Sage/CSV bridge | Add-on |

---

## This sprint focus

1. A1 Fiche CMS  
2. A2 Demo + UAT docs  
3. Kickoff notes for B1/B2 in PRODUCT_MAP  

Track progress in git commits tagged `v2.1-*`.
