## Current Phase 1 evidence policy — 2026-11-02

The candidate is codex/phase-1-completion in C:/Users/DELL/Desktop/date-harvest-hub-phase1-completion. The authoritative fresh-run ledger is [.local/evidence/acceptance-final/manifest.json](../../.local/evidence/acceptance-final/manifest.json). Its HEAD must match Git HEAD. Source, test and target metadata are recorded there after commit. The rows below are historical unless explicitly re-evidenced by that ledger and a manual review.

Current inspection uses real pointer activation and verifies the active tab/panel after every viewport change; changing Puppeteer mobile emulation reloads the document. Earlier repeated nested-panel captures are invalidated, not promoted to PASS. The audit read-window restart defect was corrected and has regression coverage.

The matrix separates structural fit/landmarks/source health, accessible control names, visible layout review, interaction proof and industrial acceptance. A screenshot does not prove saving, stock correctness, signed CCP compliance, physical hardware or tenant isolation. Factory-dependent production/stock/packaging redesigns and factory policy adoption remain BLOCKED. Existing dark theme tokens are retained; there is no new global dark-mode feature or acceptance claim.

Reviewed root snapshots include desktop and phone home, scanner, alerts, live, reception QC, stock, production overview, packaging, logistics, quality, suppliers, purchasing, customers, export, HR, maintenance and settings. The Articles denial snapshot is valid only for its curated director workspace; its functional view uses the purchasing role. Genuine nested analytics and settings reviews must use selected-panel evidence, not the invalidated earlier sweep. Settings tab navigation is tested read-only; policy saves and industrial operations are not certified. Existing Arabic resources and RTL snapshots are preserved; linguistic/factory sign-off remains separate.

Final image folders: .local/evidence/acceptance-final/visual, roles-screens, reception-frozen/screens and reception-dev/screens. Final stage counts and accessible-name findings are in the ledger. Local source verification is separate from staging/production and compatibility with the concurrent fix/supplier-simplify checkout.

---

## Historical matrix/checkpoint

## 2026-11-01 continuation evidence (supersedes historical counts, not unseen-screen verdicts)

Branch: codex/phase-1-completion; reconciliation HEAD d617d587eb0ffebde4d3bfa66bafcc11c9ac78ad. Current UI corrections remain uncommitted pending final acceptance. Dev preflight: 458/458 structural checks, 105 captures at 1440/768/390, under .local/evidence/visual-preflight-08. Opened representative screens: home desktop, alerts phone, live desktop/phone, reception QC desktop/phone, stock desktop/phone, production tablet. Capture-only rows do not become PASS. Frozen reception now passes 17/17 after correction of phone-toast obstruction R; both failed and successful evidence are retained. Role preflight 1687/1687 and isolation 23/23 pass on their recorded snapshots. Factory trial, staging, production and industrial-quantity-dependent workflows remain unaccepted. See the current Phase 1 report for precise gates and next actions.

---

# Visual acceptance

Verdict: **DESIGN NOT FINISHED.** The checks below pass, but most routes have not met the acceptance criteria. See `SCREEN_MIGRATION_MATRIX.md`: 7 routes PASS, 1 is BLOCKED, the rest are NOT VERIFIED. No factory employee has tested any of this.

## Results on the final code

| Check | Result |
|---|---|
| Browser scenarios through the dev proxy | PASS, 17 of 17 |
| Browser scenarios on a frozen build with the service worker | See `docs/plans/PHASE_0_REPORT.md`. Run on a static host with a cross-origin API, not `vite preview`. Staging remains NOT VERIFIED |
| Unit and integration tests | PASS, 553 of 553 |
| Client type errors | 213, the same as the baseline |
| Server type errors | 0 |
| Lint | 0 errors, 358 warnings |
| Overflow, blank pages, console errors on 19 tabs at 1440, 1280, 768 and 390 | PASS before the last edits. This proves layout stability, not design |
| Contrast on 19 tabs | PASS on 18. `En direct` failed and was corrected, not re-measured |
| QC security | PASS. No server file changed since `dd7856d`. The only QC client changes are wording and holding back a provisional verdict on screen. Scenarios G, S, V, P and Q pass |
| Dark theme | NOT VERIFIED |
| Empty, loading, error, long content and restricted states on every route | NOT VERIFIED |
| Factory employee trial | NOT VERIFIED |

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
| The sidebar Alertes showed 0 while `/alerts` held 75 | Existing | One alert centre; the stock view is a tab inside it |
| The public passport showed raw status codes and jargon | Existing | Plain French |
| Two nested `main` landmarks | Existing | One |
| Summary strip left a grey gap with five figures | Redesign | Last cell fills the row |
| Purchasing total read `0.0k TND` | Existing | Real amount |
| Pale line colours on percentages failed contrast in Bilan | Existing | Figures use the text colour |

## Open questions for review

- Production managers trigger 403 on `reception-alerts`, `stock/reception-lots`, `stock/lots` and `stock/shipments`. Those screens may be quietly empty for that role. Traced to the requests, not to the cause.
- A staging run must still confirm scenarios H and J.
- The lot thread lists record ids, because `GoldenThreadLotState` carries no lot number.

## Where to resume

1. Open the screens marked "before the change" in the matrix and read them again.
2. Seed active cycles and an in-progress order, then read the stage panels, step form and output lots with real data.
3. Open every Paramètres tab and the eight Indicateurs tabs.
4. Measure accessibility inside dialogs. The audit above only covers what is on screen when a tab opens.
5. Run the state checks: empty, loading, error, long content, restricted action.
6. Decide on the dark theme.
7. Run scenarios H and J on staging.
