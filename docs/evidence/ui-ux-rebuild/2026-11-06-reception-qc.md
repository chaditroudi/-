# UI/UX rebuild evidence — 6 Nov 2026

## Browser

The Vite client answered at `http://localhost:8080/#/auth`.

Sign-in as `operateur.reception@test.local` stayed on **Chargement…**. The button never left the loading state. No reception screen was reached, so no after-screenshot of the day list or the QC dialog exists.

`http://127.0.0.1:4000/health` refused the connection.

The API process log ends with:

`MongoServerError: Database name dhh_f_22fed28b3895f92b91e7abd47b3e46886145a7bf is too long. Max database name length is 38 bytes.`

That name is 46 characters. Factory database startup failed. Reception and QC could not be exercised in the browser.

Screenshot taken: login screen only, while the button says Chargement. It is not a reception or QC screenshot.

Widths 375 / 768 / 1024 / 1440: not run. Arabic RTL: not run.

## Automated checks

`npx vitest run` on these files:

- `src/lib/roleAccess.test.ts` — 6 passed
- `src/components/reception/intake/StepLotWeighing.test.tsx` — 7 passed
- `src/components/reception/ReceptionWorkspace.test.tsx` — 5 passed
- `src/components/reception/QCInspectionFlow.test.tsx` — first run failed because the start helper looked for one `%` field while several exist. After the helper waits for “Humidité sol” and opens Verdict before “Valider la décision”, the same file passed: 3 tests.

Production build: `npm run build` exited 0 in about 3 minutes 51 seconds. Vite reported `built in 1m 36s`, then generated `dist/sw.js`. A chunk-size warning was printed. No build error.

## Recovery later the same morning

The 38-byte limit is an Atlas shared-tier restriction (`AtlasError` 8000). MongoDB’s own limit is 64 bytes. The 46-byte factory name had never been created. Control data was backed up to `backups/date_harvest_hub-pre-factory-adopt` (85 collections, 312 documents), then 36 operational collections were copied into `dhh_f_22fed28b3895f92b91e7abd47b3e4688` and checked by count and content hash. The control database was kept.

`/health` returned 200, database connected. Sign-in for the reception operator returned 201. Reception search returned 200. In the browser, that operator reached Accueil and Réception → En attente, which showed the draft and REC-20261102-0001 (4 000 kg) and REC-20261102-0002 (750 kg). Phone, tablet, and Arabic were not tested. Quality control was not opened in the browser.
