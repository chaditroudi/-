/** QC inspection in a real browser: one real delivery per run, walked by the quality inspector from Start to the signed release.
 * Captures every step at each width and locale, checks overflow, direction and touch targets inside the dialog,
 * and confirms on the database that the lot was released only after the PIN.
 *
 * Owns everything it starts: a loopback replica set, the API (server-dist) and a Vite dev server, all on private
 * ports, with APP_ENV=test and NUMERIC_SIGNATURE_GATE=enforce. Never touches :8080, :4000 or Atlas.
 *   npm run server:build
 *   QC_VISUAL_OUT=docs/evidence/tablet-first-ui/qc-after node scripts/e2e/qc-inspection-visual.e2e.mjs
 * Optional: QC_VISUAL_LOCALES=fr,ar  QC_VISUAL_WIDTHS=375,768,1024,1440
 * QC_VISUAL_MODE=detail walks the reception detail instead, as the reception supervisor: every section, the
 * correction and cancel actions, and the weighing record of a lot.
 * QC_VISUAL_MODE=cleaning: a lot released through QC (API, with the PIN), a cleaning cycle created through the API the
 * panel uses, then the cleaning operator's today screen, stage screen, new-cycle dialog and the close with real weights.
 * QC_VISUAL_MODE=fumigation: a released lot in a fumigation cycle created through the API, then the fumigation operator
 * walks it: loading, emergency stop asked and kept, T0 start, ventilation, validation, residual test, operator PIN signature.
 */
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';
import { assertSafeDbTarget } from '../lib/db-target-guard.mjs';
import { assertTestStack } from '../lib/api-target-guard.mjs';
import { syntheticIntakeFields } from '../lib/intake-contract.mjs';

const MONGO_PORT = 27361;
const API = 'http://127.0.0.1:4186';
const APP = 'http://127.0.0.1:8186';
const DB = 'qc_visual_' + Date.now().toString(36);
const MONGO = `mongodb://127.0.0.1:${MONGO_PORT}/?replicaSet=rs-qcvisual`;
const OUT = process.env.QC_VISUAL_OUT || '.local/evidence/qc-visual';
const WIDTHS = (process.env.QC_VISUAL_WIDTHS || '375,768,1024,1440').split(',').map(Number);
const LOCALES = (process.env.QC_VISUAL_LOCALES || 'fr,ar').split(',');
const MODE = process.env.QC_VISUAL_MODE || 'qc';
const MONGOD = process.env.MONGOD_BIN || 'C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe';
const CHROME = process.env.E2E_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PASSWORD = 'Test123!';
const PIN = '482915';
if (!assertSafeDbTarget({ uri: MONGO, dbName: DB, argv: [] }).isLocal) throw Error('A loopback database is required.');
mkdirSync(OUT, { recursive: true });

// Labels in every shipped language, so the same walk drives the old French-only dialog and the translated one.
const locale = (code) => JSON.parse(readFileSync(`src/i18n/locales/${code}.json`, 'utf8'));
const L = Object.fromEntries(['fr', 'en', 'ar'].map((code) => [code, locale(code)]));
const labels = (pick) => [...new Set(Object.values(L).map((json) => { try { return pick(json); } catch { return undefined; } }).filter(Boolean))];
const START_QC = [...labels((j) => j.qcQueue.start), ...labels((j) => j.qcQueue.resume)];
const START = ["Démarrer l'inspection", ...labels((j) => j.qcInspect.actions.start)];
const APPLY_ALL = ['Appliquer à tous', ...labels((j) => j.qcInspect.caliber.applyAll)];
const VALIDATE = ['Valider la décision', ...labels((j) => j.qcInspect.actions.validate)];
const SIGN = ['Signer et libérer', ...labels((j) => j.qcInspect.pin.confirm)];
const CORRECT = ['Corriger', ...labels((j) => j.receptionDetail.correct)];
const CANCEL = ['Annuler la réception', ...labels((j) => j.receptionDetail.cancel)];
const VIEW_WEIGHING = ['Voir la pesée', ...labels((j) => j.receptionDetail.lots.viewWeighing)];
const IN_PROGRESS_TAB = labels((j) => j.productionNav.item.inProgress);
const NEW_CYCLE = labels((j) => j.cleaning.newCycle);
const CLOSE_CYCLE = labels((j) => j.cleaning.close);
const SUBMIT_CLOSE = labels((j) => j.cleaning.submitClose);
// The panel's own wording for "source lots could not be loaded", in every language.
const SOURCE_ERROR = labels((j) => j.cleaning.sourceError);
const FUM = (pick) => labels((j) => pick(j.fumigation));

const env = { ...process.env, APP_ENV: 'test', NODE_ENV: 'development', API_HOST: '127.0.0.1', PORT: '4186',
  MONGODB_URI: MONGO, MONGODB_DB_NAME: DB, JWT_SECRET: 'qc-visual-test-key-not-secret', NUMERIC_SIGNATURE_GATE: 'enforce',
  WEIGHBRIDGE_SIMULATOR_SECRET: 'qc-visual-sim',
  // The API seeds this factory's defaults (QC checklists, step definitions) at start, as it does for a real site.
  INITIAL_ADMIN_TENANT_ID: 'demo-company', INITIAL_ADMIN_FACTORY_ID: 'demo-site', AI_GUIDE_ENABLED: 'false', AI_GUIDE_PROVIDER: 'disabled', CORS_ORIGINS: APP,
  VITE_BUILD_TARGET: 'test', VITE_API_URL: '/api', VITE_API_PROXY_TARGET: API, VITE_DEV_PORT: '8186',
  VITE_CACHE_DIR: path.join(os.tmpdir(), 'dhh-qc-visual-vite-cache') };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (probe, timeout = 30_000) => { const end = Date.now() + timeout; while (Date.now() < end) { if (await probe().catch(() => false)) return true; await wait(200); } return false; };

const evidence = { head: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain', '--', 'src'], { encoding: 'utf8' }).trim()),
  capturedAt: new Date().toISOString(), database: DB, widths: WIDTHS, locales: LOCALES, checks: [], screens: [], completed: false };
const persist = () => writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(evidence, null, 2));
const check = (name, passed, detail) => { evidence.checks.push({ name, passed: Boolean(passed), ...(detail !== undefined ? { detail } : {}) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${passed || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 300)}`); persist(); };

const owned = [];
const start = (cmd, args, logName) => {
  const log = openSync(path.join(OUT, logName), 'w');
  const child = spawn(cmd, args, { env, stdio: ['ignore', log, log], windowsHide: true });
  closeSync(log);
  owned.push(child);
  return child;
};
const dbPath = path.join(os.tmpdir(), 'dhh-qc-visual-' + process.pid);
let browser;
let mongoose;
let factoryDb;

const api = async (method, url, token, body) => {
  const response = await fetch(`${API}/api${url}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json().catch(() => null) };
};
const signIn = async (email) => {
  const { status, body } = await api('POST', '/auth/signin', null, { email, password: PASSWORD });
  if (status >= 300 || !body?.data?.access_token) throw Error('Missing test actor ' + email);
  return body.data;
};

/** Clicks the visible button whose text is one of `names` (exact, or starting with it when `prefix`). */
const clickButton = async (page, names, { prefix = false, within = '[role="dialog"]' } = {}) => {
  const ok = await page.evaluate((names, prefix, within) => {
    const root = document.querySelector(within) ?? document;
    const button = [...root.querySelectorAll('button')].find((b) => {
      if (!b.getClientRects().length || b.disabled) return false;
      const text = b.innerText.replace(/\s+/g, ' ').trim();
      return names.some((n) => (prefix ? text.startsWith(n) : text === n));
    });
    button?.scrollIntoView({ block: 'center' });
    button?.click();
    return Boolean(button);
  }, names, prefix, within);
  if (!ok) throw Error('No button ' + names.join(' / '));
  await wait(250);
};
const typeInto = async (page, selector, value) => {
  const handle = await page.$(selector);
  if (!handle) throw Error('No field ' + selector);
  await handle.click({ clickCount: 3 });
  await handle.type(value);
};

/** Layout facts for the open dialog: overflow, direction, touch targets under 44 px. */
const inspect = (page) => page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  const scope = dialog ?? document.querySelector('main') ?? document;
  const controls = [...scope.querySelectorAll('button, input, textarea, select, [role="checkbox"], label')].filter((el) => {
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility === 'visible' && !el.closest('[aria-hidden="true"]');
  });
  const interactive = controls.filter((el) => el.tagName !== 'LABEL');
  // A checkbox inside a label is pressed through the whole label row.
  const small = interactive.filter((el) => { const r = (el.closest('label') ?? el).getBoundingClientRect(); return r.height < 44 || r.width < 44; })
    .map((el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.getAttribute('role') || el.tagName).trim().slice(0, 30));
  const box = dialog?.getBoundingClientRect();
  return { overflow: document.documentElement.scrollWidth > innerWidth + 1 || Boolean(dialog && dialog.scrollWidth > dialog.clientWidth + 1),
    dialogFits: Boolean(box && box.left >= -1 && box.right <= innerWidth + 1),
    dir: document.documentElement.dir, controls: interactive.length, smallTargets: small.length, smallExamples: [...new Set(small)].slice(0, 10),
    crash: document.body.innerText.includes('Cet écran a rencontré un problème'), dialog: Boolean(dialog) };
});
const capture = async (page, id, step) => {
  await wait(350);
  const facts = await inspect(page);
  // The dialog body scrolls; a full-page shot would only show its first screen, so capture the dialog's whole content height.
  const file = `${id}-${step}.png`;
  await page.evaluate(() => {
    const body = document.querySelector('[role="dialog"] .overflow-y-auto') ?? document.querySelector('[role="dialog"] [data-radix-scroll-area-viewport]');
    if (body) body.scrollTop = 0;
  });
  await page.screenshot({ path: path.join(OUT, file), fullPage: !facts.dialog });
  evidence.screens.push({ id: `${id}-${step}`, step, file, ...facts, reviewed: false });
  check(`${id} ${step}: no horizontal overflow`, !facts.overflow && (!facts.dialog || facts.dialogFits), facts);
  check(`${id} ${step}: no crash`, !facts.crash);
  persist();
  return facts;
};

const book = async (operator, supplier, reference) => {
  const intake = await api('POST', '/receptions/intake', operator.access_token, {
    ...syntheticIntakeFields(reference), client_request_id: randomUUID(), supplier_id: supplier.id, variety: 'Deglet Nour',
    gross_weight_kg: 300, tare_weight_kg: 20, lots: [{ lot_supplier: reference, quantity: 280 }],
  });
  if (intake.status >= 300) throw Error('delivery not booked ' + JSON.stringify(intake.body).slice(0, 200));
  return intake.body.data.reception;
};

const openPage = async (session, lang, width, hash) => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120_000);
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => { const url = response.url(); if (url.includes('/api/') && !url.includes('/realtime/') && response.status() >= 500) failures.push(response.status() + ' ' + new URL(url).pathname); });
  await page.evaluateOnNewDocument((s, lng) => {
    try { if (window.top === window && !sessionStorage.getItem('seeded')) { localStorage.setItem('date-harvest-hub-session', JSON.stringify(s)); localStorage.setItem('i18nextLng', lng); sessionStorage.setItem('seeded', '1'); } } catch { /* sandboxed frame */ }
  }, session, lang);
  await page.setViewport({ width, height: width < 600 ? 812 : width < 1100 ? 1024 : 900, isMobile: width < 800, hasTouch: width < 1100 });
  await page.goto(APP + '/#' + hash, { waitUntil: 'domcontentloaded' });
  return { context, page, failures };
};

/** Reception detail as the reception supervisor: the delivery opened from today's list, every section captured. */
async function walkDetail(operator, supervisor, supplier, lang, width, index) {
  const id = `detail-${lang}-${width}`;
  const reception = await book(operator, supplier, `DTV-${lang}-${width}-${index}`);
  const { context, page, failures } = await openPage(supervisor, lang, width, '/?tab=receptions');
  const opened = await until(() => page.evaluate((number) => {
    const card = [...document.querySelectorAll('main button')].filter((b) => b.getClientRects().length).find((b) => b.innerText.includes(number));
    card?.click();
    return Boolean(card);
  }, reception.reception_number), 60_000);
  check(`${id} opens from today's list`, opened);
  if (!opened) { await context.close(); return; }
  check(`${id} sections shown`, await until(() => page.evaluate(() => document.querySelectorAll('[role="tab"]').length >= 6), 20_000));
  await wait(600);
  await capture(page, id, '0-overview');
  const has = (names) => page.evaluate((names) => [...document.querySelectorAll('main button')].some((b) => b.getClientRects().length && names.includes(b.innerText.replace(/s+/g, ' ').trim())), names);
  check(`${id} supervisor can correct the reception`, await until(() => has(CORRECT), 5_000));
  check(`${id} supervisor can cancel before the QC decision`, await until(() => has(CANCEL), 5_000));
  // Both dialogs open over the page and close without writing anything.
  for (const [names, step] of [[CORRECT, '0b-correct'], [CANCEL, '0c-cancel']]) {
    await clickButton(page, names, { within: 'main' });
    check(`${id} ${step} dialog opens`, await until(() => page.$('[role="dialog"], [role="alertdialog"]'), 10_000));
    await capture(page, id, step);
    await page.keyboard.press('Escape');
    await until(() => page.evaluate(() => !document.querySelector('[role="dialog"], [role="alertdialog"]')), 5_000);
  }
  const steps = ['1-lots', '2-qc', '3-stock', '4-documents', '5-history'];
  for (const [i, step] of steps.entries()) {
    await page.evaluate((n) => { const tab = document.querySelectorAll('[role="tab"]')[n]; tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); tab.click(); }, i + 1);
    await wait(500);
    await capture(page, id, step);
    if (step === '1-lots') {
      // Pressing the lot's own button is the proof that the action is there.
      const pressed = await until(() => clickButton(page, VIEW_WEIGHING, { within: 'main' }).then(() => true), 10_000);
      check(`${id} lot shows its weighing action`, pressed);
      check(`${id} weighing record opens`, await until(() => page.$('[role="dialog"]'), 10_000));
      await capture(page, id, '1b-weighing');
      await page.keyboard.press('Escape');
      await until(() => page.evaluate(() => !document.querySelector('[role="dialog"]')), 5_000);
    }
  }
  check(`${id} no server or script errors`, failures.length === 0, failures.slice(0, 10));
  await context.close();
}

/** Releases a booked delivery through the QC API with the inspector's PIN, as the inspection dialog does. */
const releaseByApi = async (inspector, reception) => {
  const started = await api('POST', '/qc/start', inspector.access_token, { reception_id: reception.id, inspector_name: 'Inspectrice Visuel' });
  if (started.status >= 300) throw Error('qc start ' + JSON.stringify(started.body).slice(0, 200));
  const checklist = await factoryDb.collection('qc_checklists').findOne({ reception_type: 'DATTE', is_active: true });
  const items = await factoryDb.collection('qc_checklist_items').find({ checklist_id: checklist.id, is_active: true }).toArray();
  const decision = await api('POST', '/qc/submit', inspector.access_token, {
    inspectionId: started.body.data.id, decision: 'ACCEPTE', pin: PIN, comment: 'Libération pour le parcours visuel',
    checkResults: items.map((item) => ({ checklist_item_id: item.id, check_code: item.code, result: 'CONFORME' })),
    qualitySummary: { score: 100, grade: 'EXTRA', automaticRejectReasons: [], lab_humidity_pct: 22, lab_defects_pct: 0 },
    labSampleRequired: false, labAnalyses: [], labStorageLocation: '', recommendedDecision: 'ACCEPTE',
  });
  if (decision.status >= 300) throw Error('qc submit ' + JSON.stringify(decision.body).slice(0, 300));
  return factoryDb.collection('reception_lots').findOne({ reception_id: reception.id });
};

/** Cleaning as the cleaning operator: today, the stage, the new-cycle dialog and a real close with weights. */
async function walkCleaning(operator, inspector, cleaner, supplier, lang, width, index) {
  const id = `cleaning-${lang}-${width}`;
  const reception = await book(operator, supplier, `CLV-${lang}-${width}-${index}`);
  const lot = await releaseByApi(inspector, reception);
  check(`${id} lot released through QC`, lot?.stock_status === 'STOCK_LIBERE', lot?.stock_status);
  const stock = await factoryDb.collection('stock_lots').findOne({ reception_lot_id: lot.id });
  const created = await api('POST', '/phase2/cleaning/cycles', cleaner.access_token, {
    source_stock_lot_id: stock?.id, reception_id: reception.id, lot_number: lot.lot_internal, variety: 'Deglet Nour', program: 'B', operator_name: 'Opérateur Visuel', created_by: 'Opérateur Visuel',
  });
  check(`${id} cleaning cycle created`, created.status < 300, created.body);
  if (created.status >= 300) return;
  const cycle = created.body.data ?? created.body;
  const { context, page, failures } = await openPage(cleaner, lang, width, '/?tab=production&view=today');
  check(`${id} today shows the running cycle`, await until(() => page.evaluate((n) => document.body.innerText.includes(n), cycle.cycle_number), 60_000));
  await wait(500);
  await capture(page, id, '0-today');
  await clickButton(page, IN_PROGRESS_TAB, { within: 'main' });
  check(`${id} stage screen lists the cycle`, await until(() => page.evaluate((n) => [...document.querySelectorAll('main li')].some((li) => li.innerText.includes(n)), cycle.cycle_number), 20_000));
  await capture(page, id, '1-stage');
  await clickButton(page, NEW_CYCLE, { within: 'main' });
  check(`${id} new-cycle dialog opens`, await until(() => page.$('[role="dialog"]'), 10_000));
  await wait(800);
  const sourceState = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '');
  check(`${id} released lots listed for a new cycle`, !SOURCE_ERROR.some((text) => sourceState.includes(text)), sourceState.slice(0, 160));
  await capture(page, id, '2-new-cycle');
  await page.keyboard.press('Escape');
  await until(() => page.evaluate(() => !document.querySelector('[role="dialog"]')), 5_000);
  await clickButton(page, CLOSE_CYCLE, { within: 'main' });
  check(`${id} close dialog opens`, await until(() => page.$('#cleaning-input'), 10_000));
  await typeInto(page, '#cleaning-input', '280');
  await typeInto(page, '#cleaning-output', '270');
  await typeInto(page, '#cleaning-waste', '10');
  await capture(page, id, '3-close-form');
  await clickButton(page, SUBMIT_CLOSE, { within: 'body' });
  const closed = await until(async () => (await factoryDb.collection('cleaning_cycles').findOne({ id: cycle.id }))?.status === 'TERMINE', 20_000);
  const stored = await factoryDb.collection('cleaning_cycles').findOne({ id: cycle.id });
  check(`${id} cycle closed on the server with the typed weights`, closed && stored.weight_in_kg === 280 && stored.weight_out_kg === 270, { status: stored?.status, in: stored?.weight_in_kg, out: stored?.weight_out_kg });
  await wait(600);
  await capture(page, id, '4-closed');
  check(`${id} no server or script errors`, failures.length === 0, failures.slice(0, 10));
  await context.close();
}

/** Fumigation as the fumigation operator, step by step on one real cycle, checking the server after each step. */
async function walkFumigation(operator, inspector, fumigator, supplier, lang, width, index) {
  const id = `fumigation-${lang}-${width}`;
  const reception = await book(operator, supplier, `FUV-${lang}-${width}-${index}`);
  const lot = await releaseByApi(inspector, reception);
  check(`${id} lot released through QC`, lot?.stock_status === 'STOCK_LIBERE', lot?.stock_status);
  const created = await api('POST', '/phase2/fumigation/cycles', fumigator.access_token, {
    chamber: 'FU-01', protocol: 'FUM-PH3-72', total_weight_kg: 280, fill_rate_percent: 2.8, created_by: 'Opérateur Visuel',
    lot_refs: [{ reception_id: reception.id, lot_number: reception.reception_number, variety: 'Deglet Nour', weight_kg: 280, is_bio: false }],
  });
  check(`${id} fumigation cycle created`, created.status < 300, created.body);
  if (created.status >= 300) return;
  const cycle = created.body.data ?? created.body;
  const status = async () => (await factoryDb.collection('fumigation_cycles').findOne({ id: cycle.id }))?.status;
  const { context, page, failures } = await openPage(fumigator, lang, width, '/?tab=production&view=today');
  check(`${id} today shows the cycle`, await until(() => page.evaluate((n) => document.body.innerText.includes(n), cycle.cycle_number), 60_000));
  await wait(500);
  await capture(page, id, '0-today');
  await clickButton(page, IN_PROGRESS_TAB, { within: 'main' });
  await until(() => page.evaluate((n) => [...document.querySelectorAll('main li')].some((li) => li.innerText.includes(n)), cycle.cycle_number), 20_000);
  await capture(page, id, '1-stage');
  const opened = await page.evaluate((n, names) => {
    const card = [...document.querySelectorAll('main li')].find((li) => li.innerText.includes(n));
    const button = [...(card?.querySelectorAll('button') ?? [])].find((b) => names.some((name) => b.innerText.trim().startsWith(name)));
    button?.click();
    return Boolean(button);
  }, cycle.cycle_number, FUM((f) => f.open));
  check(`${id} cycle opens`, opened && await until(() => page.$('[role="dialog"]'), 10_000));
  await capture(page, id, '2-preparation');
  const step = async (names, expected, shot) => {
    await clickButton(page, names, { within: '[role="dialog"]' });
    const reached = await until(async () => (await status()) === expected, 15_000);
    check(`${id} ${shot}: server status ${expected}`, reached, await status());
    await wait(700);
    await capture(page, id, shot);
  };
  await step(FUM((f) => f.actions.toLoading), 'CHARGEMENT', '3-loading');
  // Emergency stop: the first tap only asks; keeping the cycle leaves it untouched.
  await clickButton(page, FUM((f) => f.stop.button), { within: '[role="dialog"]' });
  check(`${id} emergency stop asks for confirmation`, await until(() => page.evaluate((names) => [...document.querySelectorAll('[role="dialog"] button')].some((b) => names.some((n) => b.innerText.includes(n))), FUM((f) => f.stop.confirm)), 5_000));
  await capture(page, id, '3b-stop-confirm');
  await clickButton(page, FUM((f) => f.stop.keep), { within: '[role="dialog"]' });
  check(`${id} cycle kept after cancelling the stop`, (await status()) === 'CHARGEMENT', await status());
  // T0 needs a dose, a product lot and one disposition photo on the server.
  await typeInto(page, '#fum-dose', '2500');
  await typeInto(page, '#fum-product-lot', 'PH3-VISUEL-01');
  const photoFile = path.join(os.tmpdir(), 'dhh-visual-disposition.jpg');
  writeFileSync(photoFile, Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z', 'base64'));
  const fileInput = await page.$('[role="dialog"] input[type="file"]');
  await fileInput.uploadFile(photoFile);
  await until(() => page.evaluate(() => document.querySelectorAll('[role="dialog"] img').length > 0), 10_000);
  await clickButton(page, FUM((f) => f.dosage.save), { within: '[role="dialog"]' });
  const saved = await until(async () => {
    const row = await factoryDb.collection('fumigation_cycles').findOne({ id: cycle.id });
    return row?.dose_applied_g === 2500 && row?.product_lot_number === 'PH3-VISUEL-01' && (row?.photo_disposition_urls?.length ?? 0) > 0;
  }, 15_000);
  check(`${id} dose, product lot and disposition photo saved`, saved);
  await wait(700);
  await capture(page, id, '3c-ready-to-start');
  await step(FUM((f) => f.actions.start), 'EN_COURS', '4-running');
  await step(FUM((f) => f.actions.toVentilation), 'VENTILATION', '5-ventilation');
  await step(FUM((f) => f.actions.toValidation), 'VALIDATION', '6-validation');
  await typeInto(page, '#fum-residual', '0.05');
  await clickButton(page, FUM((f) => f.residual.save), { within: '[role="dialog"]' });
  check(`${id} residual test stored`, await until(async () => (await factoryDb.collection('fumigation_cycles').findOne({ id: cycle.id }))?.residual_concentration_ppm === 0.05, 10_000));
  await clickButton(page, FUM((f) => f.sign.operator), { within: '[role="dialog"]' });
  const padOpen = await until(() => page.evaluate((names) => [...document.querySelectorAll('button')].some((b) => names.includes(b.innerText.trim())), FUM((f) => f.sign.confirm)), 5_000);
  check(`${id} operator signature asks for the PIN`, padOpen);
  await capture(page, id, '7-sign-pad');
  await page.evaluate((digits, names) => {
    const confirm = [...document.querySelectorAll('button')].find((b) => names.includes(b.innerText.trim()));
    const padRoot = confirm.closest('.rounded-lg.border') ?? confirm.parentElement.parentElement;
    for (const digit of digits) [...padRoot.querySelectorAll('button')].find((b) => b.innerText.trim() === digit)?.click();
  }, PIN, FUM((f) => f.sign.confirm));
  await wait(200);
  await clickButton(page, FUM((f) => f.sign.confirm), { within: 'body' });
  const signed = await until(async () => Boolean((await factoryDb.collection('fumigation_cycles').findOne({ id: cycle.id }))?.operator_signed_at), 15_000);
  check(`${id} operator signature stored with the PIN`, signed);
  await wait(700);
  await capture(page, id, '8-operator-signed');
  check(`${id} no server or script errors`, failures.length === 0, failures.slice(0, 10));
  await context.close();
}

async function walk(operator, inspector, supplier, lang, width, index) {
  const id = `qc-${lang}-${width}`;
  const reference = `QCV-${lang}-${width}-${index}`;
  const intake = await api('POST', '/receptions/intake', operator.access_token, {
    ...syntheticIntakeFields(reference), client_request_id: randomUUID(), supplier_id: supplier.id, variety: 'Deglet Nour',
    gross_weight_kg: 300, tare_weight_kg: 20, lots: [{ lot_supplier: reference, quantity: 280 }],
  });
  if (intake.status >= 300) throw Error('delivery not booked ' + JSON.stringify(intake.body).slice(0, 200));
  const reception = intake.body.data.reception;

  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120_000);
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (response) => { const url = response.url(); if (url.includes('/api/') && !url.includes('/realtime/') && response.status() >= 500) failures.push(response.status() + ' ' + new URL(url).pathname); });
  await page.evaluateOnNewDocument((s, lng) => {
    try { if (window.top === window && !sessionStorage.getItem('seeded')) { localStorage.setItem('date-harvest-hub-session', JSON.stringify(s)); localStorage.setItem('i18nextLng', lng); sessionStorage.setItem('seeded', '1'); } } catch { /* sandboxed frame */ }
  }, inspector, lang);
  const touch = width < 1100;
  await page.setViewport({ width, height: width < 600 ? 812 : width < 1100 ? 1024 : 900, isMobile: width < 800, hasTouch: touch });
  await page.goto(`${APP}/#/?tab=receptions&view=qc`, { waitUntil: 'domcontentloaded' });

  // Open this delivery from the QC queue, as the inspector would.
  const opened = await until(() => page.evaluate((number, names) => {
    const button = [...document.querySelectorAll('button')].filter((b) => b.getClientRects().length)
      .find((b) => names.includes(b.innerText.trim()) && (b.closest('article, li, [data-lot], .rounded-2xl, .rounded-xl')?.innerText ?? '').includes(number));
    button?.click();
    return Boolean(button);
  }, reception.reception_number, START_QC), 60_000);
  check(`${id} opens from the QC queue`, opened);
  if (!opened) { await page.screenshot({ path: path.join(OUT, `${id}-queue-failed.png`) }); await context.close(); return; }
  await until(() => page.$('[role="dialog"]'));
  await capture(page, id, '0-start');

  // The suite types the name too: the profile may not have loaded when the dialog opened.
  const name = (await page.$('#qc-inspector')) ?? await page.evaluateHandle(() => [...document.querySelectorAll('label')]
    .find((l) => l.innerText.startsWith('Inspecteur principal'))?.parentElement.querySelector('input'));
  if (name?.asElement && name.asElement() && !(await name.asElement().evaluate((n) => n.value))) await name.asElement().type('Inspectrice Visuel');
  await clickButton(page, START);
  check(`${id} inspection started`, await until(() => page.$('input[placeholder="%"]'), 20_000));
  await capture(page, id, '1-measures-empty');
  for (const input of await page.$$('[role="dialog"] input[placeholder="%"]')) { await input.click({ clickCount: 3 }); await input.type('22'); }
  const [fill] = await page.$$('[role="dialog"] input[placeholder="mm"]');
  await fill.click({ clickCount: 3 }); await fill.type('46');
  await clickButton(page, APPLY_ALL);
  await capture(page, id, '1-measures-filled');

  await clickButton(page, ['2 · '], { prefix: true });
  await capture(page, id, '2-defects');
  await clickButton(page, ['3 · '], { prefix: true });
  // A new supplier's first deliveries need a laboratory sample.
  const aflatoxin = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].some((b) => b.innerText.trim() === 'Aflatoxines' && b.getClientRects().length));
  if (aflatoxin) {
    await clickButton(page, ['Aflatoxines']);
    const location = (await page.$('#qc-lab-location')) ? '#qc-lab-location' : null;
    if (location) await typeInto(page, location, 'Frigo labo');
    else {
      const handle = await page.evaluateHandle(() => [...document.querySelectorAll('label')].find((l) => l.innerText.startsWith("Emplacement de l")).parentElement.querySelector('input'));
      await handle.asElement().type('Frigo labo');
    }
  }
  await capture(page, id, '3-lab');
  await clickButton(page, ['4 · '], { prefix: true });
  await capture(page, id, '4-rqc');
  await clickButton(page, ['5 · '], { prefix: true });
  await capture(page, id, '5-verdict');

  // Refused first: the checklist is unanswered, so nothing may be sent.
  await clickButton(page, VALIDATE, { within: 'body' });
  const refused = await until(() => page.evaluate(() => /Grille qualité incomplète|Quality checklist incomplete|قائمة الفحص ناقصة/.test(document.body.innerText)), 10_000);
  check(`${id} unanswered checklist is refused with a message`, refused);
  await capture(page, id, '6-refused');
  for (const button of await page.$$('[data-testid="qc-checklist"] button[aria-label$=": conforme"]')) await button.click();
  await clickButton(page, VALIDATE, { within: 'body' });
  const pad = await until(() => page.evaluate((names) => [...document.querySelectorAll('button')].some((b) => names.includes(b.innerText.trim())), SIGN), 10_000);
  check(`${id} release asks for the signature PIN in the same dialog`, pad);
  await capture(page, id, '7-pin');
  const lot = await factoryDb.collection('reception_lots').findOne({ reception_id: reception.id });
  check(`${id} nothing released before the PIN`, lot?.stock_status !== 'STOCK_LIBERE', lot?.stock_status);
  await page.evaluate((digits, names) => {
    const confirm = [...document.querySelectorAll('button')].find((b) => names.includes(b.innerText.trim()));
    const padRoot = confirm.closest('.rounded-lg.border') ?? confirm.parentElement.parentElement;
    for (const digit of digits) [...padRoot.querySelectorAll('button')].find((b) => b.innerText.trim() === digit)?.click();
  }, PIN, SIGN);
  await wait(200);
  await clickButton(page, SIGN, { within: 'body' });
  const released = await until(async () => (await factoryDb.collection('reception_lots').findOne({ reception_id: reception.id }))?.stock_status === 'STOCK_LIBERE', 20_000);
  check(`${id} lot released on the server after the signed decision`, released);
  await until(() => page.evaluate(() => !document.querySelector('[role="dialog"] input[placeholder="%"]')), 10_000);
  await capture(page, id, '8-confirmed');
  check(`${id} no server or script errors`, failures.length === 0, failures.slice(0, 10));
  await context.close();
}

try {
  for (const url of [API + '/api/health', APP]) if (await fetch(url).then(() => true).catch(() => false)) throw Error('Private port is occupied: ' + url);
  if (!existsSync('server-dist/index.js')) throw Error('Run npm run server:build first.');
  mkdirSync(dbPath, { recursive: true });
  start(MONGOD, ['--replSet', 'rs-qcvisual', '--port', String(MONGO_PORT), '--bind_ip', '127.0.0.1', '--dbpath', dbPath], 'mongod.log');
  mongoose = (await import('mongoose')).default;
  if (!await until(async () => {
    const c = await mongoose.createConnection(`mongodb://127.0.0.1:${MONGO_PORT}/?directConnection=true`, { serverSelectionTimeoutMS: 1000 }).asPromise();
    try {
      await c.db.admin().command({ replSetInitiate: { _id: 'rs-qcvisual', members: [{ _id: 0, host: `127.0.0.1:${MONGO_PORT}` }] } }).catch((e) => { if (!/already/.test(e.message)) throw e; });
      const status = await c.db.admin().command({ replSetGetStatus: 1 }).catch(() => null);
      return status?.myState === 1;
    } finally { await c.close(); }
  }, 60_000)) throw Error('Replica set did not start.');
  start(process.execPath, ['server-dist/index.js'], 'api.log');
  start(process.execPath, [path.join(path.dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js'), '--host', '127.0.0.1', '--port', '8186', '--strictPort'], 'vite.log');
  for (const url of [API + '/api/health', APP]) if (!await until(() => fetch(url).then((r) => r.ok), 90_000)) throw Error('Private stack unavailable: ' + url);
  await assertTestStack(API);
  if (spawnSync(process.execPath, ['scripts/seed-test-actors.mjs'], { env, stdio: 'ignore', windowsHide: true }).status) throw Error('Seeding test actors failed.');

  const { factoryDatabaseName } = await import(new URL('../../server-dist/db/factory-database-name.js', import.meta.url).href);
  const connection = await mongoose.createConnection(MONGO).asPromise();
  factoryDb = connection.useDb(factoryDatabaseName(DB, { tenant_id: 'demo-company', factory_id: 'demo-site' }), { useCache: true });

  const operator = await signIn('operateur.reception@test.local');
  const supervisor = await signIn('chef.reception@test.local');
  const cleaner = MODE === 'cleaning' ? await signIn('operateur.nettoyage@test.local') : null;
  const fumigator = MODE === 'fumigation' ? await signIn('operateur.fumigation@test.local') : null;
  if (fumigator) {
    const fumPin = await api('POST', '/auth/signature-pin', fumigator.access_token, { pin: PIN, password: PASSWORD });
    check('fumigation operator signature PIN provisioned', fumPin.status < 300, fumPin.body);
  }
  const inspector = await signIn('inspecteur.qualite@test.local');
  const director = await signIn('directeur.usine@test.local');
  const pinSet = await api('POST', '/auth/signature-pin', inspector.access_token, { pin: PIN, password: PASSWORD });
  check('inspector signature PIN provisioned', pinSet.status < 300, pinSet.body);
  await api('POST', '/storage/module3/seed', director.access_token, {});
  const now = new Date().toISOString();
  // New supplier with no delivered lots: the lab-sample rule applies, so the Labo step is exercised.
  const supplier = { id: randomUUID(), code: 'SUP-QCV', name: 'Oasis Essai Visuel', is_active: true, supplier_status: 'active', region: 'Tozeur',
    oasis_name: 'Oasis QC', created_at: now, updated_at: now,
    // The cleaning walk releases by API without a lab sample: a supplier with earlier deliveries.
    ...(MODE === 'cleaning' || MODE === 'fumigation' ? { delivered_lots_count: 5 } : {}) };
  await factoryDb.collection('suppliers').insertOne(supplier);

  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'] });
  // Warm the dev server once so the first capture does not pay the dependency optimisation.
  { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); await p.goto(APP, { waitUntil: 'domcontentloaded', timeout: 180_000 }).catch(() => undefined); await wait(3000); await ctx.close(); }
  let index = 0;
  for (const lang of LOCALES) {
    for (const width of WIDTHS) {
      index += 1;
      console.log(`WALK ${lang} ${width}`);
      try {
        if (MODE === 'detail') await walkDetail(operator, supervisor, supplier, lang, width, index);
        else if (MODE === 'cleaning') await walkCleaning(operator, inspector, cleaner, supplier, lang, width, index);
        else if (MODE === 'fumigation') await walkFumigation(operator, inspector, fumigator, supplier, lang, width, index);
        else await walk(operator, inspector, supplier, lang, width, index);
      }
      catch (error) { check(`${MODE}-${lang}-${width} walk completes`, false, error.message); }
    }
  }
  await connection.close();
  evidence.completed = true;
} catch (error) {
  check('qc visual harness completes', false, error.message);
} finally {
  await browser?.close();
  for (const child of owned.reverse()) child.kill();
  await wait(1500);
  try { rmSync(dbPath, { recursive: true, force: true }); } catch { /* mongod may still hold files briefly */ }
  persist();
}
const failed = evidence.checks.filter((c) => !c.passed).length;
console.log(`${evidence.checks.length - failed}/${evidence.checks.length} checks; ${evidence.screens.length} captures in ${OUT}.`);
process.exitCode = failed ? 1 : 0;
