/** Tablet-first visual evidence: real screens, real roles, four widths, French and Arabic.
 * Capturing is not acceptance. Read each PNG and record the verdict in docs/plans/UI_UX_FULL_REBUILD_CHECKLIST.md.
 *
 * Owns everything it starts: a loopback replica set, the API (server-dist) and a Vite dev server, all on private
 * ports, with APP_ENV=test and NUMERIC_SIGNATURE_GATE=enforce. Never touches :8080, :4000 or Atlas.
 *   npm run server:build
 *   TABLET_VISUAL_OUT=docs/evidence/tablet-first-ui/before node scripts/e2e/tablet-visual.e2e.mjs
 * Optional: TABLET_VISUAL_ONLY=reception (substring of a capture key), TABLET_VISUAL_WIDTHS=375,768
 */
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';
import { assertSafeDbTarget } from '../lib/db-target-guard.mjs';
import { assertTestStack } from '../lib/api-target-guard.mjs';

const MONGO_PORT = 27341;
const API = 'http://127.0.0.1:4176';
const APP = 'http://127.0.0.1:8176';
const DB = 'tablet_visual_' + Date.now().toString(36);
const MONGO = `mongodb://127.0.0.1:${MONGO_PORT}/?replicaSet=rs-tablet`;
const OUT = process.env.TABLET_VISUAL_OUT || '.local/evidence/tablet-visual';
const ONLY = process.env.TABLET_VISUAL_ONLY || '';
const WIDTHS = (process.env.TABLET_VISUAL_WIDTHS || '375,768,1024,1440').split(',').map(Number);
const MONGOD = process.env.MONGOD_BIN || 'C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe';
const CHROME = process.env.E2E_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!assertSafeDbTarget({ uri: MONGO, dbName: DB, argv: [] }).isLocal) throw Error('A loopback database is required.');
mkdirSync(OUT, { recursive: true });

/** Each capture: a role, a route, the locales to show it in. Routes are real deep links of the shell. */
const CAPTURES = [
  { key: 'reception-operator-home', role: 'operateur_reception', hash: '/?tab=home', locales: ['fr', 'ar'] },
  { key: 'reception-operator-today', role: 'operateur_reception', hash: '/?tab=receptions', locales: ['fr', 'ar'] },
  { key: 'reception-operator-intake', role: 'operateur_reception', hash: '/?tab=receptions&view=new', locales: ['fr', 'ar'] },
  { key: 'inspector-home', role: 'inspecteur_qualite', hash: '/?tab=home', locales: ['fr'] },
  { key: 'inspector-qc-queue', role: 'inspecteur_qualite', hash: '/?tab=receptions&view=qc', locales: ['fr', 'ar'] },
  { key: 'cleaning-operator-home', role: 'operateur_nettoyage', hash: '/?tab=home', locales: ['fr'] },
  { key: 'cleaning-operator-stage', role: 'operateur_nettoyage', hash: '/?tab=production&view=nettoyage', locales: ['fr'] },
  { key: 'packaging-operator', role: 'operateur_conditionnement', hash: '/?tab=packaging', locales: ['fr'] },
  { key: 'storekeeper-stock', role: 'magasinier_wms', hash: '/?tab=storage', locales: ['fr', 'ar'] },
  { key: 'production-supervisor-home', role: 'responsable_production', hash: '/?tab=home', locales: ['fr'] },
  { key: 'production-supervisor-today', role: 'responsable_production', hash: '/?tab=production', locales: ['fr'] },
  { key: 'logistics-supervisor', role: 'responsable_logistique', hash: '/?tab=logistics', locales: ['fr'] },
  { key: 'purchasing-supervisor', role: 'responsable_achats', hash: '/?tab=purchasing', locales: ['fr'] },
  { key: 'director-home', role: 'directeur_usine', hash: '/?tab=home', locales: ['fr', 'ar'] },
  { key: 'director-live', role: 'directeur_usine', hash: '/?tab=live', locales: ['fr'] },
  { key: 'director-analytics', role: 'directeur_usine', hash: '/?tab=analytics', locales: ['fr'] },
  { key: 'admin-settings', role: 'administrateur_systeme', hash: '/?tab=settings', locales: ['fr'] },
].filter((c) => !ONLY || c.key.includes(ONLY));

const env = { ...process.env, APP_ENV: 'test', NODE_ENV: 'development', API_HOST: '127.0.0.1', PORT: '4176',
  MONGODB_URI: MONGO, MONGODB_DB_NAME: DB, JWT_SECRET: 'tablet-visual-test-key-not-secret', NUMERIC_SIGNATURE_GATE: 'enforce',
  WEIGHBRIDGE_SIMULATOR_SECRET: 'tablet-visual-sim', AI_GUIDE_ENABLED: 'false', AI_GUIDE_PROVIDER: 'disabled', CORS_ORIGINS: APP,
  VITE_BUILD_TARGET: 'test', VITE_API_URL: '/api', VITE_API_PROXY_TARGET: API, VITE_DEV_PORT: '8176',
  VITE_CACHE_DIR: path.join(os.tmpdir(), 'dhh-tablet-visual-vite-cache') };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (probe, timeout = 60_000) => { const end = Date.now() + timeout; while (Date.now() < end) { if (await probe().catch(() => false)) return true; await wait(200); } return false; };

const evidence = { head: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain', '--', 'src'], { encoding: 'utf8' }).trim()),
  capturedAt: new Date().toISOString(), database: DB, widths: WIDTHS, checks: [], screens: [], completed: false };
const persist = () => writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(evidence, null, 2));
const check = (name, passed, detail) => { evidence.checks.push({ name, passed: Boolean(passed), ...(detail ? { detail } : {}) }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); persist(); };

const owned = [];
const start = (cmd, args, logName) => {
  const log = openSync(path.join(OUT, logName), 'w');
  const child = spawn(cmd, args, { env, stdio: ['ignore', log, log], windowsHide: true });
  closeSync(log);
  owned.push(child);
  return child;
};
const dbPath = path.join(os.tmpdir(), 'dhh-tablet-visual-' + process.pid);
let browser;

async function signIn(role) {
  const email = role.replaceAll('_', '.') + '@test.local';
  const response = await fetch(API + '/api/auth/signin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test123!' }) });
  const body = await response.json();
  if (!response.ok || !body.data?.access_token) throw Error('Missing test actor ' + role);
  return body.data;
}

async function captureOne(target) {
  const session = await signIn(target.role);
  for (const locale of target.locales) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(120_000); // the first load after a cold Vite cache optimizes every dependency
    const failures = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('response', (response) => { const url = response.url(); if (url.includes('/api/') && !url.includes('/realtime/') && response.status() >= 500) failures.push(response.status() + ' ' + new URL(url).pathname); });
    await page.evaluateOnNewDocument((s, lng) => {
      try { if (window.top === window && !sessionStorage.getItem('seeded')) { localStorage.setItem('date-harvest-hub-session', JSON.stringify(s)); localStorage.setItem('i18nextLng', lng); sessionStorage.setItem('seeded', '1'); } } catch { /* sandboxed frame */ }
    }, session, locale);
    for (const width of WIDTHS) {
      const touch = width < 1100;
      await page.setViewport({ width, height: width < 600 ? 812 : width < 1100 ? 1024 : 900, isMobile: width < 800, hasTouch: touch });
      await page.goto(APP + '/#' + target.hash, { waitUntil: 'domcontentloaded' });
      const settled = await until(() => page.evaluate(() => Boolean(document.querySelector('main')) && document.fonts.status === 'loaded'
        && !document.querySelector('main .animate-spin, main [aria-busy="true"]')), 45_000);
      await wait(600);
      const result = await page.evaluate(() => {
        const controls = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="tab"], [role="combobox"]')].filter((el) => {
          const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility === 'visible' && !el.closest('[aria-hidden="true"]');
        });
        const small = controls.filter((el) => { const r = el.getBoundingClientRect(); return r.height < 44 || r.width < 44; })
          .map((el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 40));
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1, dir: document.documentElement.dir, controls: controls.length,
          smallTargets: small.length, smallExamples: small.slice(0, 8), crash: document.body.innerText.includes('Cet écran a rencontré un problème'),
          heading: document.querySelector('h1')?.textContent?.trim() ?? null };
      });
      const id = `${target.key}-${locale}-${width}`;
      check(id + ' ready', settled);
      check(id + ' no horizontal overflow', !result.overflow);
      check(id + ' no crash', !result.crash);
      check(id + ' direction', result.dir === (locale === 'fr' || locale === 'en' ? 'ltr' : 'rtl'), result.dir);
      const file = id + '.png';
      await page.screenshot({ path: path.join(OUT, file), fullPage: true });
      evidence.screens.push({ id, role: target.role, hash: target.hash, locale, width, touch, file, ...result, reviewed: false });
      persist();
    }
    check(`${target.key}-${locale} no server or script errors`, failures.length === 0, failures.slice(0, 10));
    await context.close();
  }
}

try {
  for (const url of [API + '/api/health', APP]) if (await fetch(url).then(() => true).catch(() => false)) throw Error('Private port is occupied: ' + url);
  if (!existsSync('server-dist/index.js')) throw Error('Run npm run server:build first.');
  mkdirSync(dbPath, { recursive: true });
  start(MONGOD, ['--replSet', 'rs-tablet', '--port', String(MONGO_PORT), '--bind_ip', '127.0.0.1', '--dbpath', dbPath], 'mongod.log');
  const mongoose = (await import('mongoose')).default;
  if (!await until(async () => {
    const c = await mongoose.createConnection(`mongodb://127.0.0.1:${MONGO_PORT}/?directConnection=true`, { serverSelectionTimeoutMS: 1000 }).asPromise();
    try {
      await c.db.admin().command({ replSetInitiate: { _id: 'rs-tablet', members: [{ _id: 0, host: `127.0.0.1:${MONGO_PORT}` }] } }).catch((e) => { if (!/already/.test(e.message)) throw e; });
      const status = await c.db.admin().command({ replSetGetStatus: 1 }).catch(() => null);
      return status?.myState === 1;
    } finally { await c.close(); }
  }, 60_000)) throw Error('Replica set did not start.');
  start(process.execPath, ['server-dist/index.js'], 'api.log');
  start(process.execPath, [path.join(path.dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js'), '--host', '127.0.0.1', '--port', '8176', '--strictPort'], 'vite.log');
  for (const url of [API + '/api/health', APP]) if (!await until(() => fetch(url).then((r) => r.ok), 90_000)) throw Error('Private stack unavailable: ' + url);
  await assertTestStack(API);
  if (spawnSync(process.execPath, ['scripts/seed-test-actors.mjs'], { env, stdio: 'ignore', windowsHide: true }).status) throw Error('Seeding test actors failed.');
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'] });
  for (const target of CAPTURES) { console.log('OPEN ' + target.key); await captureOne(target); }
  evidence.completed = true;
} catch (error) {
  check('tablet visual harness completes', false, error.message);
} finally {
  await browser?.close();
  for (const child of owned.reverse()) child.kill();
  await wait(1500);
  try { rmSync(dbPath, { recursive: true, force: true }); } catch { /* mongod may still hold files briefly */ }
  persist();
}
const failed = evidence.checks.filter((c) => !c.passed).length;
console.log(`${evidence.checks.length - failed}/${evidence.checks.length} checks; ${evidence.screens.length} captures to review in ${OUT}.`);
process.exitCode = failed ? 1 : 0;
