# Roadmap — Game changer next (v2.1+)

**Position:** Traceability kernel shipped → harden claims → margin → supply loyalty → ATP  
**Thesis:** Close *money* and *defensible claims* so the plant runs on the MES — not another good tracing tool.

Supersedes foundation W0–W4 planning. See canvas: `mes-game-changer.canvas.tsx`.

---

## Honest inventory (Aug 2026)

| Capability | State |
|---|---|
| Hash ledger · passport · recall | **Built** |
| Signed weighbridge / CCP | **Built** |
| Mass balance kernel (+ partial pack consume) | **Built** (gate default **warn**) |
| Costing · settlements · export margin | **Built** (partial) |
| UX atelier · fiches · BRA/BDE · PF · TVA | **Built** |
| ATP / promise ship week | **Absent** |
| Real GS1 company prefix | **Configurable** — still defaults to placeholder `09999999` |
| Trust gates SCAN / CCP / MASS_BALANCE | Default **warn** — flip after green shift |

---

## Three bets

1. **Margin engine** — reconcile kg → TND/kg (mass balance before costing before promising)  
2. **Supply loyalty** — grade settlement from signed weights + triage  
3. **Committable capacity** — ATP + finite chambers/lines → system ship week  

---

## Waves

| Wave | Wk | Theme | Exit |
|---|---|---|---|
| **B0 Harden** | 2 | Cover ledger swallow sites · GATE_BLOCKED · dossier from chain · flip to **enforce** | Zero `LOT_LEDGER_STAGE_FAILED` for a shift |
| **B Margin** | 4–6 | Waste as output · tolerance enforce · margin roll-up | Closed order reconciles + TND/kg |
| **C Supply** | 3–4 | Grade settlements via portal | Same-day farmer statement |
| **D Capacity** | 4–6 | ATP + OEE reasons + promise dates | System ship week on export order |
| **E Sellable trust** | 3–4 | Real GS1 · EPCIS · anchored tip · server PDF | Buyer verifies SSCC |

### B0 shipped in code (ops still to flip)

- `TRUST_STAGE_GATE=warn|enforce` — `recordStageSafe` alerts + `GATE_BLOCKED`, rethrows on enforce  
- `GET /api/trust/gates` + Settings → Produit **TrustGatesPanel**  
- GS1 SSCC helpers (`gs1-sscc.ts`) + placeholder detection  
- `STOCK_SYNCED` on reception / collections / ext paths; enforce rethrows ledger miss  
- Mass-balance packaging close already supports `TRUST_MASS_BALANCE_GATE=enforce`  
- Smoke: `npm run smoke:b0`

**Ops exit:** clean warn shift → set `TRUST_SCAN_GATE` / `TRUST_CCP_GATE` / `TRUST_STAGE_GATE=enforce` + real GS1 prefix.

### Wave B surfaced (in progress)

- Packaging close: declare **déchets kg** → mass balance + standard cost on OF  
- Triage close: declare **déchets process kg** (grades ≠ waste)  
- OF history / dialog show **TND/kg** + Δ matière  
- **MarginCockpitPanel** + **Pack CFO** print on Cockpit / Settings → Coûts  
- Lot cost card includes closed packaging OF  

### Wave C surfaced

- Settlement auto-draft on triage close (existing)  
- **Relevé grades** print (Achats + Portail fournisseur)  

### Wave D scaffold

- `GET /api/atp/promise?qty_kg=` + `GET /api/atp/summary`  
- **ATP panel** on Export dashboard (FEFO stock → ship week)  

Still open: ATP line capacity / OEE, EPCIS, SMTP, real GS1.

Cross-cut: Arabic operator UI · offline beyond reception · delete orphaned duplicates.

---

## Next 10 working days

1. Commit / push baseline ahead of origin  
2. ~~Cover remaining `recordStageSafe` sites + harness~~ (shipped — stage enforce path)  
3. ~~Confirm `STOCK_SYNCED` on every reception→stock path~~  
4. ~~Extend `GATE_BLOCKED` on refused writes~~ (`recordStageSafe` + shipment gates)  
5. ~~Regression: shipment dossier from `lot_events`~~ (`gate-rules.service` tests)  
6. Warn-mode shift → `TRUST_SCAN_GATE=enforce` + `TRUST_CCP_GATE=enforce` + `TRUST_STAGE_GATE=enforce`  
7. **Business:** start GS1 Tunisia company-prefix application  
8. Plant picks Wave B routes + waste ownership  
9. **TODO later — SMTP (supplier BC email):** fill production `.env` per plant  
   (`SMTP_HOST`, `SMTP_PORT=587`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`, `APP_PUBLIC_URL`).  
   Without SMTP, emails log to server console (local demo OK). Also enable Settings → Alertes → notifications email.

Env knobs (`.env.example`):

```bash
# TRUST_SCAN_GATE=warn|enforce
# TRUST_CCP_GATE=warn|enforce
# TRUST_STAGE_GATE=warn|enforce
# TRUST_MASS_BALANCE_GATE=warn|enforce
# GS1_COMPANY_PREFIX=09999999
```

Settings → Documents → **Préfixe société GS1**. Settings → Produit → **Trust B0 panel**.  
Smoke: `npm run smoke:b0`.

---

## Undercutters (fix before selling hard)

- Permissive gates (warn defaults)  
- Best-effort ledger (`recordStageSafe`)  
- Placeholder GS1 SSCC  

---

## Packaging for sale

| SKU | Includes |
|---|---|
| **Core MES** | Parcours · CCP · fiches · BRA/BDE · passport · recall |
| **Ops+** | Mass balance · costing · settlements · labels · lab QC |
| **ERP Connect** | Facture+TVA · CSV · (later AR lite) |
| **Game changer** | Enforce trust · real GS1 · ATP · farmer settlement |
