# Smoke-test checklist — W0–W2 + realtime notifications

Goal: prove one Deglet Nour lot is trusted (ledger), live (SSE), role-scoped (espaces), and buyer-verifiable (passport + recall).

## Automated (preferred)

API must be running (`npm run server` or `npm run dev`, default port 4000):

```bash
npm run smoke:notifications
```

This seeds test actors, runs a full golden-thread lot, checks role-scoped notifications, passport, verify, and recall.

Expect: `SMOKE PASS` (exit 0).

Test logins (password `Test123!`):

| Role | Email |
|---|---|
| Réception | `operateur.reception@test.local` |
| Qualité | `responsable.qualite@test.local` |
| Logistique | `responsable.logistique@test.local` |
| Direction | `directeur.usine@test.local` |

Optional: `npm run seed:actors` alone.

---

## Manual UI (SSE toasts)

| # | Check | Pass? |
|---|---|---|
| P1 | Backend + frontend up | ☐ |
| P2 | Browser A = qualité, B = logistique (emails above) | ☐ |
| P3 | Optional: direction sees all | ☐ |
| P4 | SSE `GET /api/realtime/events` connected | ☐ |
| 1 | Intake → A gets toast, B does not | ☐ |
| 2 | Advance to ship → B gets **Lot expédié**, A does not | ☐ |
| 3 | Passport `#/passport/:lotId` without login | ☐ |
| 4 | Recall drill in Chaîne Hub | ☐ |
| 5 | One stage → one toast (no double) | ☐ |

---

## Done when

- [ ] `npm run smoke:notifications` → `SMOKE PASS`
- [ ] (Optional) Manual two-role toast check
