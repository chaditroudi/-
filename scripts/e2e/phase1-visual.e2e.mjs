/** Local Phase 1 visual evidence. Capturing a screenshot is not visual acceptance.
 * Inspect the PNGs separately and record the reviewer verdict in the migration matrix.
 * APP_ENV=test, a loopback replica set and disposable DB are mandatory.
 */
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { assertSafeDbTarget } from '../lib/db-target-guard.mjs';
import { assertTestStack } from '../lib/api-target-guard.mjs';

const API = 'http://127.0.0.1:4175';
const APP = 'http://127.0.0.1:8175';
const MONGO = process.env.MONGODB_URI;
const DB = process.env.P1_VISUAL_DB;
const OUT = process.env.P1_VISUAL_OUT || '.local/evidence/visual';
if (!MONGO || !DB || !DB.startsWith('phase1_completion_visual_') || !assertSafeDbTarget({ uri: MONGO, dbName: DB, argv: [] }).isLocal) throw Error('A disposable Phase 1 loopback DB is required.');
mkdirSync(OUT, { recursive: true });
const env = { ...process.env, APP_ENV: 'test', API_HOST: '127.0.0.1', PORT: '4175', MONGODB_URI: MONGO,
  MONGODB_DB_NAME: DB, JWT_SECRET: 'phase1-completion-visual-test-key', NUMERIC_SIGNATURE_GATE: 'enforce',
  AI_GUIDE_ENABLED: 'false', AI_GUIDE_PROVIDER: 'disabled', CORS_ORIGINS: APP,
  VITE_BUILD_TARGET: 'test', VITE_API_URL: '/api', VITE_API_PROXY_TARGET: API,
  VITE_DEV_PORT: '8175', VITE_CACHE_DIR: path.resolve('.local/visual-vite-cache'),
  DEBUG: process.env.P1_VISUAL_DEBUG || '',
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(probe, timeout = 45_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await probe()) return true; await wait(150); }
  return false;
}
const owned = [];
let browser;
let diagnosticClient;
const evidence = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain', '--', 'src', 'scripts'], { encoding: 'utf8' }).trim()),
  api: API, app: APP, database: DB, capturedAt: new Date().toISOString(), completed: false, checks: [], screens: [], ownership: [] };
const persist = () => writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(evidence, null, 2));
const check = (name, passed, detail) => {
  evidence.checks.push({ name, passed: Boolean(passed), ...(detail ? { detail } : {}) });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  persist();
};
async function signIn(role) {
  const email = role.replaceAll('_', '.') + '@test.local';
  const response = await fetch(API + '/api/auth/signin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test123!' }) });
  const body = await response.json();
  if (!response.ok || !body.data?.access_token) throw Error('Missing synthetic actor ' + role);
  return body.data;
}
async function open(role) {
  const session = await signIn(role);
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  // CDP request IDs stay stable across cache events, cancellation and redirects.
  const pending = new Map();
  const failures = [];
  const network = await page.target().createCDPSession();
  await network.send('Network.enable');
  await network.send('Page.enable');
  let loaderId;
  network.on('Page.frameNavigated', ({ frame }) => {
    if (frame.parentId) return;
    loaderId = frame.loaderId;
    for (const [id, request] of pending) if (request.loaderId !== loaderId) pending.delete(id);
  });
  network.on('Network.requestWillBeSent', event => {
    const pathname = new URL(event.request.url).pathname;
    if (!/^\/api(?:\/|$)/.test(pathname) || /\/realtime\/(events|stream)/.test(pathname) || event.type === 'EventSource') return;
    if (loaderId && event.loaderId && event.loaderId !== loaderId) return;
    pending.set(event.requestId, { pathname, loaderId: event.loaderId });
  });
  network.on('Network.loadingFinished', ({ requestId }) => pending.delete(requestId));
  network.on('Network.loadingFailed', ({ requestId, canceled, errorText }) => {
    if (pending.has(requestId) && !canceled) failures.push(errorText + ' ' + pending.get(requestId).pathname);
    pending.delete(requestId);
  });
  network.on('Network.responseReceived', ({ requestId, response }) => {
    if (response.mimeType === 'text/event-stream') pending.delete(requestId);
    else if (pending.has(requestId) && response.status >= 400) failures.push(response.status + ' ' + pending.get(requestId).pathname);
  });
  page.on('pageerror', error => failures.push(error.message));
  await page.evaluateOnNewDocument(session => {
    if (!sessionStorage.getItem('visual-seeded')) {
      localStorage.setItem('date-harvest-hub-session', JSON.stringify(session));
      sessionStorage.setItem('visual-seeded', '1');
    }
  }, session);
  async function ready() {
    let stable = 0;
    return until(async () => {
      const rendered = await page.evaluate(() => Boolean(document.querySelector('main')) && document.fonts.status === 'loaded' && !document.querySelector('main .animate-spin') && !/Chargement\s*:|Chargement de|Chargement des|جاري التحميل/.test(document.querySelector('main')?.innerText ?? ''));
      stable = rendered && pending.size === 0 ? stable + 1 : 0;
      return stable >= 3;
    }, 60_000);
  }
  return { context, page, ready, failures, pending };
}
async function capture(client, key, width) {
  const { page } = client;
  await page.setViewport({ width, height: width === 390 ? 844 : 1000, isMobile: width < 800, hasTouch: width < 800 });
  const settled = await client.ready();
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    mainCount: document.querySelectorAll('main').length,
    crash: document.body.innerText.includes('Cet écran a rencontré un problème'),
    activeTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
  }));
  check(key + ' ready ' + width, settled, !settled ? {
    pending: [...client.pending.values()].map(request => request.pathname),
    text: await page.evaluate(() => document.querySelector('main')?.innerText.slice(0, 500)),
  } : undefined);
  check(key + ' fits ' + width, !result.overflow);
  check(key + ' main landmark ' + width, result.mainCount === 1);
  check(key + ' no crash ' + width, !result.crash);
  const file = key + '-' + width + '.png';
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  evidence.screens.push({ key, width, file, ...result, captured: true, visuallyReviewed: false });
  persist();
}
try {
  // Do not reuse or kill another listener on the private ports.
  for (const url of [API + '/api/health', APP]) if (await fetch(url).then(() => true).catch(() => false)) throw Error('Private port is occupied: ' + url);
  for (const args of [['server-dist/index.js'], ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '8175', '--strictPort']]) {
    const log = openSync(path.join(OUT, args[0].includes('vite') ? 'vite.log' : 'api.log'), 'w');
    const child = spawn(process.execPath, args, { env, stdio: ['ignore', log, log], windowsHide: true });
    closeSync(log);
    owned.push(child); evidence.ownership.push({ pid: child.pid, entry: args[0] });
  }
  for (const url of [API + '/api/health', APP]) if (!await until(() => fetch(url).then(r => r.ok).catch(() => false), 60_000)) throw Error('Private stack unavailable: ' + url);
  await assertTestStack(API);
  const seeded = spawnSync(process.execPath, ['scripts/seed-test-actors.mjs'], { env, stdio: 'ignore', windowsHide: true });
  if (seeded.status) throw Error('Synthetic actor seeding failed.');
  browser = await puppeteer.launch({ executablePath: process.env.E2E_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--no-sandbox', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'] });
  const director = await open('directeur_usine');
  diagnosticClient = director;
  for (const tab of ['home', 'scan', 'alerts', 'live', 'receptions', 'storage', 'production', 'packaging', 'logistics', 'purchasing', 'quality', 'suppliers', 'materials', 'export', 'customers', 'hr', 'maintenance', 'analytics', 'settings']) {
    director.failures.length = 0;
    director.pending.clear(); // Requests from the departing document do not define readiness of the next one.
    console.log('OPEN ' + tab);
    await director.page.goto(APP + '/#/?tab=' + tab, { waitUntil: 'domcontentloaded' });
    for (const width of [1440, 768, 390]) await capture(director, tab, width);
    check(tab + ' sources and browser JS succeed', director.failures.length === 0, director.failures);
  }
  await director.context.close();
  for (const role of ['directeur_usine', 'responsable_production', 'responsable_qualite']) {
    const client = await open(role);
    diagnosticClient = client;
    await client.page.goto(APP + '/#/?tab=analytics', { waitUntil: 'domcontentloaded' });
    if (!await client.ready()) throw Error('Analytics did not become ready: ' + role);
    const tabs = await client.page.evaluate(() => [...(document.querySelector('main [role="tablist"]')?.querySelectorAll('[role="tab"]') ?? [])].map(tab => ({ id: tab.id, text: tab.textContent })));
    for (const tab of tabs) {
      const clicked = await client.page.evaluate(id => { const node = document.getElementById(id); if (!node) return false; node.click(); return true; }, tab.id);
      check(role + ' analytics tab opens: ' + tab.text, clicked);
      const key = 'analytics-' + role + '-' + tab.id.split('-trigger-').at(-1).replace(/[^a-z0-9_-]/gi, '-');
      for (const width of [1440, 768, 390]) await capture(client, key, width);
    }
    check(role + ' analytics sources succeed', client.failures.length === 0, client.failures);
    await client.context.close();
  }
  evidence.completed = true;
} catch (error) {
  if (diagnosticClient) {
    evidence.navigationDiagnostic = {
      url: diagnosticClient.page.url(),
      pending: [...diagnosticClient.pending.values()].map(request => request.pathname),
      failures: diagnosticClient.failures,
      document: await diagnosticClient.page.evaluate(() => ({ state: document.readyState, title: document.title, text: document.body?.innerText.slice(0, 1200) })).catch(() => null),
    };
    await diagnosticClient.page.screenshot({ path: path.join(OUT, 'failure-diagnostic.png'), fullPage: true }).catch(() => {});
  }
  check('visual harness completes', false, error.message);
} finally {
  await browser?.close();
  for (const child of owned) child.kill();
  persist();
}
const failed = evidence.checks.filter(row => !row.passed).length;
console.log(`${evidence.checks.length - failed}/${evidence.checks.length} structural checks; ${evidence.screens.length} captures awaiting human/agent visual review.`);
process.exitCode = failed ? 1 : 0;
