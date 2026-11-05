# Date Harvest — Phase 2 commercial demo walkthrough

**Branch:** `fix/supplier-simplify`  
**Audience:** Factory directors / commercial demos  
**Rule:** Use only live capabilities. Mark demo data clearly. Do **not** invent completed manufacturing stages, stock integrity, or fake real-time events.

## Demo data (isolated / clearly marked)

| Source | Marker | How |
|---|---|---|
| Golden-thread script | `DEMO-DN-*` lots, supplier code `DEMO-DN-SUP` | `npm run demo:golden-thread` |
| Season demo | Script-seeded actors + seasonal flow | `npm run demo:season` |
| Seeded actors | Test roles from `scripts/seed-test-actors.mjs` | Prefer dedicated demo users, not production operators |

Always announce: **“Données de démonstration — lots préfixés DEMO-”**.

## Representative supplier → shipment path (what really works)

1. **Accueil (Factory Command Center)**  
   - Show role landing primary action + “Suivre un lot”.  
   - Realtime badge: trust **En direct** only when the green SSE indicator is present (observed in browser).  
   - Do not claim EN DIRECT if the badge is offline/reconnect.

2. **Fournisseurs**  
   - Open an existing supplier or the `DEMO-DN-SUP` seeded supplier.  
   - Show score / lots / payments as **read from API** — empty lists are truthful, not failures.

3. **Réception**  
   - Create or open a DEMO-prefixed reception (or walk an existing DEMO lot).  
   - Primary CTA is obvious (`Nouvelle réception` / AR `استلام جديد`).  
   - Offline: if network drops, outbox keeps intake pending — UI must not show “réception validée” until the server confirms.

4. **Contrôle qualité**  
   - Open the 5-step QC wizard (Mesures → Défauts → Labo → RQC → Verdict).  
   - Demonstrate Continuer / Retour; Valider remains available without skipping mandatory fields (tests enforce this).  
   - PIN signature for release when required.

5. **Stock**  
   - Show liberated vs quarantined quantities as returned by the API.  
   - **Do not** assert genealogy mass-balance integrity — still an industrial BLOCKER.

6. **Production**  
   - For a stage operator account: only À faire / En cours / Terminé.  
   - For supervisor: full atelier.  
   - Start/finish only stages the lot actually has.

7. **Conditionnement**  
   - SummaryStrip KPIs + OF list.  
   - Call out GS1 placeholder banner if prefix is still `09999999` (honest compliance gap).

8. **Expédition / Logistics**  
   - Prepare a shipment only with lots that exist and are pickable.  
   - Checklist must stay red until lines are truly picked — do not mark shipped for the demo unless the API succeeds.

9. **Traceability**  
   - From Accueil “Suivre un lot”, enter a DEMO lot number.  
   - Walk the timeline of **recorded** events only.

## What not to demo as finished

- Multi-site / multi-tenant SaaS isolation  
- Stock genealogy quantity integrity as closed  
- Invented cost/TND loss estimates (UI shows `null` until costing exists)  
- Darija as a full UI language (tooltips/glosses only)

## Acceptance for the demo itself

PASS when every click produces a server-backed result or an honest empty/error state.  
FAIL if any screen shows completed work that was not committed.
