# Date Harvest Hub (Royal Palm MES)

**Version 2.1.0 — Enterprise Traceability edition**

MES / ERP for **date manufacturing**: reception → QC → cold store → fumigation CCP → triage → packaging → export, with golden-thread lot traceability, operator fiches techniques, BRA/BDE documents, costing, and settlements.

---

## What a buyer gets

| Pillar | Capability |
|---|---|
| **Parcours lot A→Z** | Employee landing: search lot → next action → station deep-link |
| **Fiches techniques** | FT-01…FT-08 + BRA/BDE — checklist, critical limits, print, go-to-station |
| **Documents** | Bon de Réception Achat (BRA) · Bon d’Expédition (BDE) |
| **Trust / fil d’or** | Gates, mass balance, CCP evidence, passport |
| **Finance ops** | Lot costing, grade settlements, export FX margin |
| **Roles** | Plant roles + supplier / client portals |
| **White-label** | Company name, logo, colors in Settings → Marque |

See [docs/PRODUCT_MAP.md](docs/PRODUCT_MAP.md), [docs/BUYER_HANDOFF.md](docs/BUYER_HANDOFF.md), and [docs/ROADMAP_v2.1.md](docs/ROADMAP_v2.1.md).

Demo: [docs/DEMO_RUNBOOK.md](docs/DEMO_RUNBOOK.md) · UAT: [docs/UAT_CHECKLIST.md](docs/UAT_CHECKLIST.md)

---

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind, shadcn/ui  
- **Backend:** NestJS (Express), Mongoose  
- **Database:** MongoDB (local or Atlas)  
- **Auth:** JWT  

---

## Quick start (demo in minutes)

```sh
npm install
cp .env.example .env   # set MONGODB_URI + JWT_SECRET
npm run build          # compiles server + client
npm run dev            # API + Vite together
```

- App: http://localhost:8080  
- API health: http://localhost:4000/health  

### First admin

Set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` before the first start on an empty database. That account must choose a new password at first sign-in. Later accounts are created in Paramètres → Utilisateurs.

### Useful scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Full stack local |
| `npm run build` | Production build |
| `npm test` | Unit / component tests |
| `npm run product:check` | Buyer readiness check (key tests) |
| `npm run demo:golden-thread` | Demo lot journey data |
| `npm run smoke:wave-a` / `wave-b` / `wave-c` | Trust / cost / settlement smokes |

---

## Environment

Copy `.env.example` → `.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/date_harvest_hub
MONGODB_DB_NAME=date_harvest_hub
JWT_SECRET=change-me-to-a-long-random-secret
PORT=4000
VITE_API_URL=/api
```

Trust gates (optional, after smoke green):

```env
TRUST_MASS_BALANCE_GATE=enforce
TRUST_SCAN_GATE=enforce
TRUST_CCP_GATE=enforce
```

Atlas setup: [docs/mongodb-atlas-setup.md](docs/mongodb-atlas-setup.md)

---

## Docker

```sh
docker compose up --build
```

Frontend `http://localhost:8080` · API `http://localhost:4000/health`

---

## Operator UX (v2)

1. **Simple / Complet** home — one job first; modules collapsed  
2. **Fiches A→Z** — aide by poste next to every next action  
3. **BRA / BDE** — full-page document workspace (not buried tabs)  
4. Settings → **Produit** — edition, version, pillars for buyer handoff  

---

## License

Commercial / proprietary — see [LICENSE](LICENSE). Branding may be white-labeled under license.
