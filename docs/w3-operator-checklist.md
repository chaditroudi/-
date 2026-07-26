# W3 plant rollout — operator checklist

Use this after deploying W3 with `TRUST_SCAN_GATE=warn`.

## Before the shift

- [ ] API healthy on the plant network
- [ ] `npm run smoke:w3` passes against the plant API
- [ ] Reception tablet opens offline after one online load (PWA shell)
- [ ] Weighbridge simulator or device pushes one GROSS + one TARE reading
- [ ] Scanner camera / handheld opens on stock transfer

## During the shift (warn mode)

- [ ] Create one reception while online — number + label available immediately
- [ ] Create one reception offline (airplane mode) — badge shows pending
- [ ] Restore network — badge drains and official number appears
- [ ] Scan lot QR before a stock transfer — transfer blocked without scan in enforce later
- [ ] Capture device weight in reception weighing dialog
- [ ] Use RG-R08 manual weighing only with witnesses if scale is down
- [ ] Confirm passport QR opens without login

## After one clean shift

- [ ] Set `TRUST_SCAN_GATE=enforce` and restart API
- [ ] Re-run `npm run smoke:w3`
- [ ] Confirm missing scan blocks stock moves
- [ ] Confirm break-glass override (stock manager + reason) still works and alerts

## Demo lot (direction / buyer)

Run the automated golden thread:

```bash
npm run demo:golden-thread
```

Then open the printed passport URL and run a recall drill from Chaîne Hub.
