# Buyer handoff — Date Harvest Hub v2.0

Use this checklist when delivering or evaluating the product for purchase.

## 1. Delivery package

- [x] Source: React client (`src/`) + Nest API (`server/`)
- [x] `README.md` — run, env, demo admin
- [x] `LICENSE` — commercial terms placeholder
- [x] `docs/PRODUCT_MAP.md` — A→Z feature map
- [x] `.env.example` — no secrets
- [x] Tests: `npm test` / `npm run product:check`
- [ ] Buyer fills production `JWT_SECRET` + MongoDB Atlas
- [ ] Buyer changes seeded admin password
- [ ] Buyer sets brand (Settings → Marque)

## 2. Demo path (30 minutes)

1. `npm install` → configure `.env` → `npm run dev`
2. Sign in with the first admin from `INITIAL_ADMIN_EMAIL`
3. Home **Simple** → search or pick a lot → **Prochaine action**
4. Open **Fiche technique** → check steps → **Aller au poste**
5. Documents: **Créer BRA** / **Créer BDE** → print
6. Settings → **Produit** — confirm edition v2.0.0
7. Optional: `npm run demo:golden-thread` then refresh Parcours

## 3. Roles to show

| Audience | What to open |
|---|---|
| Direction | Analytics, export margin, Settings → Produit |
| Réception | Parcours + BRA + FT-01…FT-03 |
| Production | Phase 2 fumigation / triage + FT-05 / FT-06 |
| Logistique | BDE + FT-08 |
| Achats | Settlements grades (Wave C) |

## 4. Production go-live (buyer IT)

1. MongoDB Atlas (or dedicated cluster) + backups  
2. Strong `JWT_SECRET`  
3. `npm run build` → host `dist/` (static) + `node server-dist/index.js` (or process manager)  
4. Reverse proxy TLS; `VITE_API_URL=/api` behind same origin  
5. Trust gates: start `warn`, then `enforce` after smoke green  
6. Seed plant users; disable default admin or rotate password  

## 5. Customization without forking chaos

| Need | Where |
|---|---|
| Logo / colors / name | Settings → Marque |
| Module flags | Settings → Modules |
| Fiche text (limits °C, %) | `src/lib/fichesTechniques.ts` (v2 content pack) |
| FX / costing | Settings → Coûts |

## 6. Known scope boundaries

- Fiches techniques are curated content (not a full DMS CMS).  
- Portals (supplier/client) are role-scoped; enable per contract.  
- `server-dist/` is build output — compile with `npm run server:build`.  

## 7. Support contacts

Fill at sale: commercial owner · technical contact · SLA · escrow if any.
