# Visual acceptance

Status: IN PROGRESS. This is a working checkpoint, not a sign-off. No factory employee has tested any of this.

Branch: `feature/ui-redesign`. Nothing here has been pushed, merged or served on `:8080`.

## How screens are checked

- Private stack only: API on 4130/4131 and Vite on 8130/8131, MongoDB replica set on 27327, databases `ui_design_b6ac8a` and `ui_e2e_b6ac8a`.
- The frozen test bundle is built with `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' VITE_API_URL=/api vite build`, and the output is checked for the Railway host before it is served.
- A screen counts as seen only once its screenshot has been opened and read. No console errors alone does not pass a screen.
- Screenshots are in `docs/design/screenshots/{before,after}/`.

## Status words

- PASS: seen at the stated widths and the stated checks ran.
- FAIL: seen, and it does not meet the criteria.
- BLOCKED: cannot be checked here, with the reason stated.
- NOT VERIFIED: not checked yet.

## Defects the browser checks found

| Defect | Origin | Fix |
|---|---|---|
| First visit on a production build reloads the page when the service worker first takes control | Existing | `src/main.tsx` reloads only when an active worker is replaced |
| Old notifications pop up as new on every page open and cover actions | Existing | `src/hooks/useNotifications.ts` ignores what existed before the screen opened |
| Toasts covered the action bar, then the tab row | Redesign | Bottom left beside the sidebar on a desk, top on a phone |
| `main` was a scroll container that never scrolled, so nothing inside could stick | Existing | `src/pages/Index.tsx` uses `overflow-x-clip` |
| Any zone listed a warning icon | Redesign | Status compared with `normal` and the real states |
| A blocked lot could pick any zone and then fail with no message | Existing | Assignment offers only the zones the storage rule accepts |
| Moving a blocked lot read as `Affecter` | Existing | Reads `Isoler`, and the dialog says the lot stays blocked |
| Order detail showed `undefined undefined` and a raw user id | Existing | Facts panel states what is missing |
| The reason a planned order cannot start was only in a tooltip | Existing | Shown under the action |
| `Score de santé` said EXCELLENT on an idle plant, because a stage with no activity scores 100 | Existing | Score stated as indicative, with that rule printed. Calculation untouched |
| Cost variance showed a green -100 % with no production | Existing | No figure until something was produced |
| `En direct` printed ledger codes | Existing | Labelled in French |
| Pale line colours on percentages failed contrast in Bilan | Existing | Figures use the text colour |

## Open questions for review

- `En direct` and Indicateurs count 75 active notifications while Alertes shows 0 for the same user. The counts come from different sources and have not been reconciled.
- The lot thread lists record ids, because `GoldenThreadLotState` carries no lot number.
- A production build calls the hard-coded Railway URL when `VITE_API_URL` is unset (`src/lib/axiosClient.ts`).
