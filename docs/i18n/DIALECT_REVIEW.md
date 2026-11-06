# Dialect review register

Status: **all dialect text is UNREVIEWED.** Written by Claude Code on 6 Nov 2026 for worker-facing screens. A native speaker from each region must check it before a factory sees it as final.

## How the locales work

| Code | Language | Direction | Falls back to |
|---|---|---|---|
| `fr` | French (default) | LTR | — |
| `en` | English | LTR | `fr` |
| `ar` | Modern Standard Arabic | RTL | `fr` |
| `tn` | Tunisian Darija (Arabic script) | RTL | `ar`, then `fr` |
| `iq` | Iraqi Arabic | RTL | `ar`, then `fr` |
| `lev` | Levantine (Shami) Arabic | RTL | `ar`, then `fr` |

- Dialect files hold only the keys where everyday wording differs from MSA: greetings, task prompts, buttons and short help on worker screens. Everything else comes from `ar.json`.
- Technical and regulatory words (lot, CCP, HACCP, QC, BRA, BDE, kg) stay as in MSA or French; factories use them as is.
- Stored values and domain codes never change with language.
- Existing `src/i18n/workerDarija.ts` glosses (16 phrases, QC tooltips) stay as they are. The `tn` locale is the full replacement path; the glosses will be retired only once `tn` covers the QC screen.

## Review status

| Locale | Keys | Reviewed by | Date | Notes |
|---|---|---|---|---|
| `tn` | see `src/i18n/locales/tn.json` | — | — | Unreviewed |
| `iq` | see `src/i18n/locales/iq.json` | — | — | Unreviewed |
| `lev` | see `src/i18n/locales/lev.json` | — | — | Unreviewed |

## How to review

1. Switch the app language in the header (or set `localStorage.i18nextLng` to the code).
2. Walk the worker home, reception and QC as an operator account on a test stack.
3. Edit the locale file directly; keep the key, change the text. Mark the row above with name and date.
