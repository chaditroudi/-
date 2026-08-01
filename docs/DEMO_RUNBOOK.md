# Demo runbook (30 minutes) — Buyer evaluation

**Product:** Royal Palm MES / Date Harvest Hub v2  
**Audience:** Ops director + IT + Quality  

## Prep (5 min, before buyer arrives)

```sh
cp .env.example .env   # Mongo + JWT_SECRET
npm install
npm run product:check
npm run dev
```

Optional rich data: `npm run demo:golden-thread`

Login: `admin@ecodatte.local` / `Admin123!` → **change password after demo**.

## Script

### 1. Positioning (2 min)
- “MES traçabilité dattes — fil d’or A→Z, pas un ERP comptable complet.”  
- Settings → **Produit** — edition, pillars, Waves A/B/C.

### 2. Employee landing (5 min)
- Home **Simple** mode.  
- Search / pick a lot → **Prochaine action**.  
- Open **Fiche technique** → check 2 steps → **Aller au poste**.

### 3. Documents (5 min)
- **Créer BRA** → fill → print preview.  
- **Créer BDE** → same.  
- Show Aide fiche on BRA/BDE.

### 4. Trust / production (8 min)
- Production → Phase 2 → fumigation (CCP story).  
- Triage → mass balance / grades mention.  
- Export → margin if role allows.

### 5. White-label (3 min)
- Settings → Marque — change name/color (revert after).  
- Settings → **Fiches** — edit one critical limit, save, reopen fiche from Parcours.

### 6. Close (2 min)
- Show `docs/BUYER_HANDOFF.md` + roadmap SKUs: Core / Ops+ / ERP Connect.  
- Q&A: finance = Connect add-on, not Core.

## Fail-safes
- API down: `/health` — Mongo retry message.  
- Empty DB: seed admin auto-creates.  
- No lots: run `demo:golden-thread` or create reception live.
