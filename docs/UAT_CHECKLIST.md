# UAT checklist — Date Harvest Hub (buyer acceptance)

Project: ________________  Site: ________________  Date: ________  

Tester Ops: ________________  Tester IT: ________________  

Mark **OK** / **Fail** / **N/A**. Failures need ticket #.

## A. Access & branding
| # | Test | Result | Notes |
|---|---|---|---|
| A1 | Login admin works | | |
| A2 | Change password / create plant user | | |
| A3 | Logo + company name visible | | |
| A4 | Settings → Produit shows version | | |

## B. Parcours lot
| # | Test | Result | Notes |
|---|---|---|---|
| B1 | Search lot by id/number | | |
| B2 | Next action CTA opens correct module | | |
| B3 | Fiche technique opens for next stage | | |
| B4 | Simple / Complet toggle persists | | |

## C. Documents
| # | Test | Result | Notes |
|---|---|---|---|
| C1 | Create + print BRA | | |
| C2 | Create + print BDE | | |
| C3 | BRA/BDE Aide fiche opens | | |

## D. Fiches CMS (v2.1)
| # | Test | Result | Notes |
|---|---|---|---|
| D1 | Edit FT critical limit in Settings → Fiches | | |
| D2 | Save; reopen fiche — text updated | | |
| D3 | Reset fiche to default pack | | |

## E. Operations smoke
| # | Test | Result | Notes |
|---|---|---|---|
| E1 | Reception create / QC path | | |
| E2 | Stock zone move | | |
| E3 | Phase2 fumigation or triage visible | | |
| E4 | Packaging or logistics accessible by role | | |

## F. Non-functional
| # | Test | Result | Notes |
|---|---|---|---|
| F1 | `npm run product:check` green | | |
| F2 | `.env` not committed; JWT set | | |
| F3 | Backup / Mongo plan documented | | |

## Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Operations | | | |
| Quality | | | |
| IT | | | |
| Commercial (seller) | | | |

**Accepted packages:** ☐ Core MES  ☐ Ops+  ☐ ERP Connect (roadmap)
