# Product map A→Z — Date manufacturing MES

## Golden thread (lot journey)

| # | Stage | Station | Fiche | Key artifacts |
|---|---|---|---|---|
| 1 | SUPPLIER_INTAKE | Réception | FT-01 | Reception, BL |
| 2 | WEIGHED | Bascule | FT-02 | Net weight |
| 3 | QC_DECIDED | QC | FT-03 | Release / quarantine / reject |
| 4 | COLD_STORE | Stock | FT-04 | Zone move, FIFO |
| 5 | FUMIGATION_CCP | Phase 2 | FT-05 | CCP sensors + dual sign |
| 6 | TRIAGE | Phase 2 | FT-06 | Grades, mass balance |
| 7 | PACKED | Conditionnement | FT-07 | PF lots, labels |
| 8 | SHIPPED | Logistique | FT-08 | BDE, export, passport |

## Documents

| Doc | Meaning | UI |
|---|---|---|
| BRA | Bon de Réception Achat | Documents workspace / Réception |
| BDE | Bon d’Expédition | Documents workspace / Logistique |
| FT-BRA / FT-BDE | Operator aides | Fiches hub + Aide buttons |

## Commercial waves (already in product)

- **Wave A** — Trust / scan / CCP gates  
- **Wave B** — Mass-balance ledger, partial OF, lot cost roll-up  
- **Wave C** — Grade settlements, export FX margin  

## UX modes

- **Simple** (default home) — urgent strip + parcours + docs/fiches; modules collapsed  
- **Complet** — pipeline + full queues + quick access  

## Traceability extras

| Feature | Where |
|---|---|
| Recall drill &lt; 60s | Sage hub · Logistique → Recall · API `POST /trust/recall` |
| **Rapport recall PDF** | Parcours → Rapport recall PDF · bouton on drill panel |

## Deep-links (for training)

- `?tab=home&view=fiches` — fiches catalog  
- `?tab=receptions&view=bra` — BRA workspace  
- `?tab=logistics&view=bde` — BDE workspace  
- `?tab=production&view=phase2&module=fumigation` — CCP station  
