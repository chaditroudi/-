# Tablet-first feature parity

Baseline: `main` at `1556ff0`, 6 Nov 2026. Purpose: prove that the redesign removes **nothing** a user could see or do.

## How parity is checked

1. **Generated inventory.** `node scripts/docs/feature-inventory.mjs --json` lists, per screen file, its field labels, labelled buttons, tabs, dialog titles, placeholders and data hooks. Baseline: `docs/evidence/tablet-first-ui/inventory-baseline-1556ff0.json` (219 files, 646 labels, 430 buttons, 61 tabs, 57 dialogs, 460 hook imports). Human-readable copy: `TABLET_FIRST_FEATURE_PARITY.generated.md`.
2. **Diff after each redesign.** `node scripts/docs/parity-diff.mjs docs/evidence/tablet-first-ui/inventory-baseline-1556ff0.json` compares the current tree with the baseline across *all* files (so text moved to a new component still counts as present). It prints every label, button, tab, dialog or hook that no longer appears anywhere. Each one must be listed below with where it went, or the change is not done.
3. **Translation.** When a French string becomes a `t()` key, the diff runs on the French locale value (the script resolves `t('key')` against `src/i18n/locales/fr.json`), so translating is not counted as a loss.
4. **Hand checks.** Icon-only buttons, text built in `{…}` expressions, permission gates and server calls are checked by reading the code and by the role browser suite (`scripts/e2e/roles.e2e.mjs`).

## Critical content per workflow (must survive every redesign)

| Workflow | Must keep |
|---|---|
| Reception intake | Supplier picker (search by name/code), delivery note number, vehicle, purchase order link, variety, maturity, harvest method, gross/tare/net with weighbridge capture ("Prendre comme brut/tare") and manual entry, unit count and supports, lots with supplier lot numbers and split ("Séparer en plusieurs lots"), arrival temperature, storage zone, photos (≥2), remarks; drafts shared between devices with conflict load ("Charger la dernière version"); offline outbox with retry, discard and session-expired states; blockers list with "Corriger"; result screen with "Ouvrir la réception" / "Lancer le contrôle qualité" |
| Reception lists | Today, pending (drafts and waiting QC), registry with search, alerts; cancel with reason; BRA documents and printing |
| Reception detail | All sections and dialogs (weighing, lots, photos, documents, history, cancel, storage placement, BRA) |
| QC inspection | Humidity readings, calibre, sensory scores, defects (moisissure, fermentation, dégâts mécaniques, cristallisation, décoloration …), lab results, checklist version, photos/evidence, missing-measure guidance, automatic classification only when measures are complete, decision (accept / hold / reject) with numeric PIN, refused decision keeps entries |
| Stock | Lots, zones, movements, conditions, management; quarantine focus; placement and moves through `storageMove`; inventory counts; blocked never available |
| Production stages | Orders (create, plan, start, steps, quality checks, allocate/remove lots, outputs, complete, cancel with confirmation); cleaning, fumigation (dual signature, CCP), hydration, triage (grades, sub-lots, mass balance) |
| Packaging | Orders, BOM, labels, pallets, seal, run toggle, progress, close; daily report print |
| Shipments / export | Shipment lines with lot suggestions, readiness checklist, BDE print, transport, compliance, recall exercise; export orders, contracts, COA |
| Office modules | Purchasing 8 tabs (requisitions → settlements), suppliers with scores/history/documents, materials, customers, maintenance requests, HR attendance and tasks |
| Management | Both analytics dashboards (5 and 9 tabs), live command centre, cockpit, alerts, settings (13 tabs incl. users and PINs), supplier portal, passport |

## Moves and explained differences

Each redesigned screen adds a row here when the parity diff reports something missing.

| Date | Screen | Item reported missing | Where it is now / why |
|---|---|---|---|
| 6 Nov 2026 | Home (`home/HomePage`) | button: "Alertes {activeAlertsCount > 0 && (" | Still on the home header: same Alerts button and count badge, label now `t("worker.alerts")` (fr "Alertes"). The extractor reads the old JSX text, not the key. |
| 6 Nov 2026 | Home | `RoleLanding` card | Its parts moved into the home header and hero: role names, workspace label, floor/manager sentence (same French), and the daily action as the hero task when nothing is queued. `RoleLanding` stays in the code base with its 35 tests. |
| 6 Nov 2026 | Shell, floor roles | sidebar | Replaced by the dock at every width for floor roles. Every tab stays reachable from the dock or its "Plus" sheet; password change and sign-out moved into the sheet. Supervisors and direction keep the sidebar. |
