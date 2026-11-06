# Date Harvest — full UI/UX rebuild checklist

**Overall: NOT COMPLETE.**

States used below:

- **NOT STARTED** — the working screen is still the previous interface.
- **IN PROGRESS** — a real part of the working screen changed. Not finished.
- **IMPLEMENTED / UNVERIFIED** — the working screen was redesigned, but the verification gates below have not all passed.
- **VERIFIED** — redesigned screen, required functions still available, primary actions tried, 375/768/1024/1440, Arabic RTL where the screen is translated, browser interaction, and the relevant automated checks.
- **BLOCKED** — a named blocker stops the work.

A header, a static path label, or a shared CSS rule is not enough to leave NOT STARTED.

| Screen | Implementation | Verification | What actually changed |
|---|---|---|---|
| Shell / role nav | IN PROGRESS | not verified this pass | Floor menu already limited. Not retested at four widths or in Arabic. |
| Login | IN PROGRESS | browser sign-in reached the home screen | A failed sign-in now shows the error on the form and the button returns. The request times out after 15 seconds instead of staying on Chargement. The screen itself is not redesigned. |
| Home | NOT STARTED | browser opened for the reception operator | Role landing copy exists. The cockpit was not rebuilt. Static path label removed. |
| Reception | IN PROGRESS | browser opened the waiting list; widths and Arabic not run | Today’s list is a task card. Today is empty. En attente shows the draft and two receptions waiting for quality control, with their real weights. Intake and history were not retested in this pass. |
| Quality control | IN PROGRESS | automated flow passed; browser not walked | The inspection path follows the open section and missing humidity, caliber, and lab fields. “Valider la décision” is the primary button only on Verdict. Measurement and defect fields are taller. `QCInspectionFlow.test.tsx`: 3 passed. The inspector was not signed in during this recovery. |
| Production | IN PROGRESS | not verified | Today’s work rows use a full-width primary button (`Démarrer`, `Allouer un lot`, and the same actions as before). Stage screens themselves are unchanged. |
| Stock | NOT STARTED | — | Static path label removed. |
| Packaging / pallets | NOT STARTED | — | Static path label removed. |
| Shipments | NOT STARTED | — | Static path label removed. |
| Export | NOT STARTED | — | Static path label removed. |
| Suppliers | NOT STARTED | — | Unchanged. |
| Purchasing | NOT STARTED | — | Static path label removed. |
| Customers | NOT STARTED | — | Static path label removed. |
| Alerts | NOT STARTED | — | Static path label removed. |
| Traceability | NOT STARTED | — | Unchanged. |
| Indicators | NOT STARTED | — | Unchanged. |
| Cockpit | NOT STARTED | — | Static path label removed. |
| Settings | NOT STARTED | — | Static path label removed. |
| Supplier portal | NOT STARTED | — | Static path label removed. |

## Verification gates still open

- **Gate 0, restored on 6 Nov 2026.** The 38-byte limit comes from MongoDB Atlas shared tiers (`AtlasError` code 8000), not from MongoDB’s normal 64-byte limit and not from application code. The 46-byte name `dhh_f_22fed28b3895f92b91e7abd47b3e46886145a7bf` was never created. The control database still held the factory’s records. Those records were copied, after a backup, into `dhh_f_22fed28b3895f92b91e7abd47b3e4688` (38 bytes). The control database was not deleted. Health returned 200 with the database connected. Sign-in as the reception operator returned 201, and reception search returned the copied records. The browser then opened the operator home and the waiting-reception list (two lots in quality control, one draft).
- Widths 375, 768, 1024, 1440. Not run.
- Arabic RTL. Not run.
- Production build of the UI after the login change. Not re-run. The server compile used by the running API exited 0.
- Frontend tests this pass: factory database name 8 passed, factory isolation 3 passed. Earlier reception and QC tests still stand.

## Evidence

`docs/evidence/ui-ux-rebuild/2026-11-06-reception-qc.md`

Backup, not in git: `backups/date_harvest_hub-pre-factory-adopt`

## Next executable task

Open Réception as `operateur.reception@test.local` and finish the intake form in the browser at 1440 and 375. Then sign in as `inspecteur.qualite@test.local` and walk one inspection from Mesures to Verdict. Continue with stock, packaging, and shipments. Do not mark those modules verified from this recovery.
