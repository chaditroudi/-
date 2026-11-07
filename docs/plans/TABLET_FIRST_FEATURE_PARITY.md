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
| 6 Nov 2026 | Reception intake review | button: "Ouvrir …" | Same button on a refused duplicate confirmation, label now `t('intake.review.open', { number })` (fr "Ouvrir REC-…"). Interpolated keys are not resolved by the extractor. |
| 6 Nov 2026 | Reception intake delivery | button: "Reprendre …" | Same "Reprendre <plaque>" shortcut under Immatriculation, label now `t('intake.delivery.reuse', { plate })`. |
| 6 Nov 2026 | Reception lists, intake | native `window.confirm` on abandon | Replaced by in-app confirmation dialogs ("Abandonner la réception", "Abandonner le brouillon"); same outcome, readable on tablets and translated. |
| 7 Nov 2026 | QC inspection (`reception/QCInspectionDialog`) | label: "Mesure …" | Same three humidity fields, label now `t('qcInspect.humidity.reading', { n })` (fr "Mesure 1" … "Mesure 3"). Interpolated keys are not resolved by the extractor. |
| 7 Nov 2026 | QC inspection | button: "Appliquer à tous" | Same button beside the "Même valeur partout" field above the 10 calibre readings; label now `t('qcInspect.caliber.applyAll')` (fr "Appliquer à tous"). The extractor read the old inline handler as text. |
| 7 Nov 2026 | QC inspection | label: "Deuxieme inspecteur *" | Same field on Verdict, shown only for lots over 10 t; spelling corrected to "Deuxième inspecteur *". Validation RG-Q05 unchanged. |
| 7 Nov 2026 | QC inspection | label: "Modifier la décision" and the three buttons "ACCEPTE / QUARANTAINE / REJETE … auto" | Replaced by the "Décision" group: three large option cards (Accepter, Quarantaine, Rejeter) with the proposed one marked "Proposée" and preselected. Choosing another one still sets the override, which still requires the RG-Q04 justification (≥ 20 characters) and photo. |
| 7 Nov 2026 | QC inspection | `WorkPath` strip at the top of the dialog | Replaced by the task header: eyebrow "Contrôle qualité · REC-…", a title per step, the same guidance sentence (missing readings, blocked decision, lab sample), and a five-segment progress bar whose segments open each section (red when Mesures or Labo is incomplete, with the missing count). |
| 7 Nov 2026 | QC inspection | read-only input "Moyenne" (humidity) | Same average, now a display tile beside the three readings (not an entry field), tinted by the existing humidity score (≥ 60 conform). Every entry field, rule and action is unchanged: 15 inputs + textarea + 4 checkboxes + photo + checklist + PIN pad + print RQC + assign to storage, same `submit()` and validations. |
| 7 Nov 2026 | Reception detail (`reception/ReceptionDetailV2`) | tab: "Lots (…)" | Same tab "Lots"; the count is now a badge on the tab (shown when at least one lot exists). |
| 7 Nov 2026 | Reception detail | "Données du code QR" block always open | Same payload, now in a collapsible row "Données du code QR" under each lot (one tap; progressive disclosure). |
| 7 Nov 2026 | Reception detail | empty values shown as "-" | Shown as "Non renseigné" (shared `ReviewList`), so an unknown value never reads as a value. Dates use the locale formatter instead of a fixed `dd/MM/yyyy`. |
| 7 Nov 2026 | Reception detail | header line "fournisseur · quantité unité" | Supplier is now the page title; net weight, gross weight, lot count and arrival time are figures under it. Every field of the three former cards (supplier & order, weighing & product, transport) is in the Fiche sections, with the same labels. |
| 7 Nov 2026 | Reception correction dialog | hint "N caractères minimum." | Same rule (`MIN_MANUAL_REASON_LENGTH`); the hint now also shows how many characters are typed ("N caractères minimum (n saisis)."). Fields, ids (`correction-*`), labels and "Enregistrer la correction" unchanged. |
| 7 Nov 2026 | Shared reception text | French-only next steps, statuses, grades, weighing source | Same French (library text is the fallback); `lib/receptionWorkflow` steps carry a `key`, `lib/receptionLabels.ts` reads `receptionNext`, `receptionStatus`, `stockStatus`, `qcDecided`, `qcGrade`, `weighingSource` in the chosen language. No stored code changed. |
| 7 Nov 2026 | Reception correction dialog | dialog: "Corriger la réception …" | Same dialog and title, now `t('receptionCorrection.title', { number })` (fr "Corriger la réception REC-…"). Interpolated keys are not resolved by the extractor. |
| 7 Nov 2026 | Production workspace | left section menu (lg) / scrolling chips (phones) | Same 13 sections in the same groups and order, as one pill bar (group dividers) for supervisors and three large tabs (À faire / En cours / Terminé) for a stage operator. Same badges (lots to start, alerts), same role filtering (`lib/productionNav`, labels now with `labelKey`). |
| 7 Nov 2026 | Production today | rows in one bordered list | Same rows, actions and rules as cards with one large action; counts strip (unknown shows "—" when the workshop cycles failed to load); a stage operator's first running cycle is shown as the hero next task and not repeated below. |
| 7 Nov 2026 | Cleaning (`phase2/nettoyage/NettoyagePanel`) | wash program and waste category as drop-downs | Same values (A–D, ORGANIQUE/INERTE/MAUVAISES_DATTES), now shown all at once as large choices; same defaults (B, ORGANIQUE). |
| 7 Nov 2026 | Cleaning | "Variété" field always shown | Shown when the chosen lot has no variety of its own (the lot's variety was always the one sent); nothing typed is lost. Native lot select kept (large) so tablets open their system picker. |
| 7 Nov 2026 | Cleaning close | yield line under the weights | Same yield and 92 % threshold, now a tile; adds a read-only balance line (input − output − waste) before the server's own MASS_BALANCE check. Turbidity and pH now have label/field links. |
| 7 Nov 2026 | Fumigation (`phase2/fumigation/*`) | protocol drop-down; status badges; rows clickable as a whole | Same four protocols as large choices showing minimum duration and the bio rule; same statuses with a five-step bar; each cycle opens from its large "Ouvrir" button. Chamber chips, lot selector, bio auto-switch to CO2, fill-rate formula unchanged. |
| 7 Nov 2026 | Fumigation cycle dialog | actions as a row of small buttons | Same actions and patches; the next status change is the one large primary button, print and the emergency stop sit apart. The emergency stop now asks once ("Confirmer l'arrêt" / "Continuer le cycle") before setting INTERROMPU: same outcome, no stop on a single mis-tap. |
| 7 Nov 2026 | Fumigation cycle dialog | (missing) disposition photo | **Added**: the server refuses T0 without `photo_disposition_urls` (rule unchanged) but no screen could attach one, so no cycle could start from the app. Photos are taken/imported in the dosage section and saved with the dosage through the same PATCH; a readiness list (dose, product lot, photo) shows what the server will check and the start button waits for it. |
| 7 Nov 2026 | Fumigation | dialog kept the cycle object it was opened with | The open cycle is read from the live list by id, so each step shows the server's new status at once (before, the dialog showed the old status until reopened). |
