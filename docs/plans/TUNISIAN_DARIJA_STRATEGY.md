# Tunisian Darija language strategy (worker floor)

**Status:** Strategy + verified glosses only — **not** a separate locale.  
**Date:** 1 November 2026

## Why not a `tn` locale yet

1. Full locale parity (FR ≈ 968 keys) cannot be maintained in Darija without factory validation of every string.
2. Incomplete locales cause mixed FR/Darija/AR screens and break RTL/LTR expectations.
3. Supervisors, QC reports, and export documents must stay in formal FR / MSA AR.

## Practical approach

| Layer | Language | Use |
|---|---|---|
| System UI (default) | French | Forms, validation, reports, managers |
| Full bilingual | Arabic MSA (`ar`) | Same key tree as FR; RTL verified |
| Worker primary actions | Darija gloss (tooltip) | Only keys in `src/i18n/workerDarija.ts` |

Darija is attached as `title=` / optional helper text via `darijaTitle(key)`, never as a third incomplete JSON locale.

## Rules for adding a Darija term

1. Confirm with at least one floor supervisor and one operator.
2. Prefer Maghrebi Arabic script used on site.
3. Keep FR label as the visible primary CTA (training / audit consistency).
4. Add the key to `WORKER_DARIJA` and a unit assertion that every key maps to a non-empty string.
5. Do not invent slang for quality grades, lot numbers, or legal documents.

## Factory validation still required

Oral acceptance of the current glossary with Royal Palm / Tozeur-area crews before expanding coverage.
