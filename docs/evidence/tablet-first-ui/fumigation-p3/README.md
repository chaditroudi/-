# Fumigation — before / after (7 Nov 2026)

`QC_VISUAL_MODE=fumigation node scripts/e2e/qc-inspection-visual.e2e.mjs`, one locale per run, private stack (:27361/4186/8186).
Each walk books a delivery, releases it through QC with the inspector's PIN (API), creates a fumigation cycle through the API
the screen uses, then signs in as `operateur.fumigation@test.local` and walks the cycle in the browser: today's hero, stage
screen, open the cycle, move to loading, ask for the emergency stop and keep the cycle, save dose + product lot + one
disposition photo, start T0, ventilation, validation, residual test 0.05 ppm, operator signature with the PIN — each step
checked on the server.

- `before/`: panel and dialog at `e101036`, fr × 375/768/1024/1440. The walk stops at "cycle opens" (the old rows are not list
  items for the probe); the old dialog has no disposition-photo field, so T0 could not have been started anyway.
- `after-fr/`, `after-ar/`: **150/150 checks per locale**, 44 captures each. Kept in git: every step at 375 and 1024 px; today,
  ready-to-start, running and operator-signed at 768 and 1440 px. `results.json` lists every capture.
- Not exercised: the quality signature (second visa, another role) and the CCP readings screen.
