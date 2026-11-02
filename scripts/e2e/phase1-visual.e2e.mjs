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
const settingsOnly = process.env.P1_VISUAL_SETTINGS_ONLY === '1';
const analyticsOnly = process.env.P1_VISUAL_ANALYTICS_ONLY === '1';
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
  api: API, app: APP, database: DB, capturedAt: new Date().toISOString(), scope: analyticsOnly ? 'analytics-only-diagnostic' : settingsOnly ? 'settings-only-diagnostic' : 'full', completed: false, checks: [], screens: [], ownership: [] };
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
  return { role, context, page, ready, failures, pending };
}
async function capture(client, key, width, tabKey) {
  const { page } = client;
  await page.setViewport({ width, height: width === 390 ? 844 : 1000, isMobile: width < 800, hasTouch: width < 800 });
  // Changing mobile emulation can reload the page. Select the panel afterwards.
  if (tabKey) {
    if (!await client.ready()) throw Error('Actor and route did not settle before panel selection: ' + key);
    const selector = 'main [role=tablist] [role=tab][id$=' + JSON.stringify('-trigger-' + tabKey) + ']';
    await page.waitForSelector(selector);
    await page.click(selector);
    await page.waitForFunction(selector => { const tab = document.querySelector(selector); return tab?.getAttribute('aria-selected') === 'true' && document.getElementById(tab.getAttribute('aria-controls'))?.getAttribute('data-state') === 'active'; }, { timeout: 10_000 }, selector);
  }
  const settled = await client.ready();
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    clippedControls: [...document.querySelectorAll('main button, main input, main select, main textarea, main a[href], main [role="combobox"]')].filter(control => {
      const rect = control.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(control).visibility !== 'visible' || control.closest('[hidden], [aria-hidden="true"]')) return false;
      if (rect.left >= -1 && rect.right <= innerWidth + 1) return false;
      // Tables and tab strips may intentionally scroll horizontally. Clipping
      // by a non-scrollable shell must not disguise an unreachable control.
      for (let ancestor = control.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
        if (['auto', 'scroll'].includes(getComputedStyle(ancestor).overflowX) && ancestor.scrollWidth > ancestor.clientWidth + 1) return false;
      }
      return true;
    }).map(control => ({ tag: control.tagName, name: control.getAttribute('aria-label') || control.getAttribute('placeholder') || control.textContent?.trim().slice(0, 80) })),
    mainCount: document.querySelectorAll('main').length,
    crash: document.body.innerText.includes('Cet écran a rencontré un problème'),
    activeTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
    activeTabKey: document.querySelector('main [role="tab"][aria-selected="true"]')?.id.split('-trigger-').at(-1),
  }));
  check(key + ' ready ' + width, settled, !settled ? {
    pending: [...client.pending.values()].map(request => request.pathname),
    text: await page.evaluate(() => document.querySelector('main')?.innerText.slice(0, 500)),
  } : undefined);
  if (tabKey) check(key + ' correct panel at capture ' + width, result.activeTabKey === tabKey, result);
  check(key + ' fits ' + width, !result.overflow);
  check(key + ' controls reachable ' + width, result.clippedControls.length === 0, result.clippedControls);
  check(key + ' main landmark ' + width, result.mainCount === 1);
  check(key + ' no crash ' + width, !result.crash);
  const ax = await page.target().createCDPSession();
  const { nodes } = await ax.send('Accessibility.getFullAXTree');
  const unnamedControls = nodes.filter(node => !node.ignored && ['textbox', 'spinbutton', 'combobox', 'checkbox', 'switch', 'button'].includes(node.role?.value) && !node.name?.value).map(node => ({ role: node.role.value, backendDOMNodeId: node.backendDOMNodeId }));
  for (const node of unnamedControls) {
    const resolved = await ax.send('DOM.resolveNode', { backendNodeId: node.backendDOMNodeId });
    const detail = await ax.send('Runtime.callFunctionOn', { objectId: resolved.object.objectId, functionDeclaration: 'function() { return { tag: this.tagName, id: this.id, type: this.type, placeholder: this.getAttribute("placeholder"), nearbyLabel: this.closest("div")?.querySelector("label")?.textContent }; }', returnByValue: true });
    node.control = detail.result.value;
  }
  await ax.detach();
  const file = key + '-' + width + '.png';
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  evidence.screens.push({ key, role: client.role, width, file, ...result, unnamedControls, captured: true, visuallyReviewed: false });
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
  for (const tab of (settingsOnly || analyticsOnly ? [] : ['home', 'scan', 'alerts', 'live', 'receptions', 'storage', 'production', 'packaging', 'logistics', 'purchasing', 'quality', 'suppliers', 'materials', 'export', 'customers', 'hr', 'maintenance', 'analytics', 'settings'])) {
    const routeClient = tab === 'materials' ? await open('responsable_achats') : director;
    diagnosticClient = routeClient;
    routeClient.failures.length = 0;
    routeClient.pending.clear(); // Requests from the departing document do not define readiness of the next one.
    console.log('OPEN ' + tab);
    await routeClient.page.goto(APP + '/#/?tab=' + tab, { waitUntil: 'domcontentloaded' });
    for (const width of [1440, 768, 390]) await capture(routeClient, tab, width);
    check(tab + ' sources and browser JS succeed', routeClient.failures.length === 0, routeClient.failures);
    if (routeClient !== director) await routeClient.context.close();
  }
  await director.context.close();
  for (const role of (settingsOnly ? [] : ['directeur_usine', 'responsable_production', 'responsable_qualite'])) {
    const client = await open(role);
    diagnosticClient = client;
    await client.page.goto(APP + '/#/?tab=analytics', { waitUntil: 'domcontentloaded' });
    if (!await client.ready()) throw Error('Analytics did not become ready: ' + role);
    const tabs = await client.page.evaluate(() => [...(document.querySelector('main [role="tablist"]')?.querySelectorAll('[role="tab"]') ?? [])].map(tab => ({ id: tab.id, text: tab.textContent })));
    for (const tab of tabs) {
      const tabKey = tab.id.split('-trigger-').at(-1);
      const tabSelector = 'main [role=tablist] [role=tab][id$=' + JSON.stringify('-trigger-' + tabKey) + ']';
      await client.page.click(tabSelector);
      const clicked = await client.page.evaluate(selector => { const node = document.querySelector(selector); return node?.getAttribute('aria-selected') === 'true' && document.getElementById(node.getAttribute('aria-controls'))?.getAttribute('data-state') === 'active'; }, tabSelector);
      check(role + ' analytics tab opens: ' + tab.text, clicked);
      const key = 'analytics-' + role + '-' + tab.id.split('-trigger-').at(-1).replace(/[^a-z0-9_-]/gi, '-');
      for (const width of [1440, 768, 390]) await capture(client, key, width, tabKey);
    }
    check(role + ' analytics sources succeed', client.failures.length === 0, client.failures);
    await client.context.close();
  }
  if (!analyticsOnly) {
  // Read-only review of every settings tab; never save factory policy here.
  const admin = await open('administrateur_systeme');
  diagnosticClient = admin;
  await admin.page.goto(APP + '/#/?tab=settings', { waitUntil: 'domcontentloaded' });
  if (!await admin.ready()) throw Error('Settings did not become ready.');
  const settingsTabs = await admin.page.evaluate(() => [...document.querySelectorAll('main [role="tablist"] [role="tab"]')].map(tab => ({ id: tab.id, text: tab.textContent })));
  for (const tab of settingsTabs) {
    const tabKey = tab.id.split('-trigger-').at(-1);
    const selector = 'main [role=tablist] [role=tab][id$=' + JSON.stringify('-trigger-' + tabKey) + ']';
    await admin.page.click(selector);
    check('settings tab selected ' + tab.text, await admin.page.evaluate(selector => { const node = document.querySelector(selector); return node?.getAttribute('aria-selected') === 'true' && document.getElementById(node.getAttribute('aria-controls'))?.getAttribute('data-state') === 'active'; }, selector));
    const key = 'settings-' + tab.id.split('-trigger-').at(-1).replace(/[^a-z0-9_-]/gi, '-');
    for (const width of [1440, 768, 390]) await capture(admin, key, width, tabKey);
  }
  check('all 13 settings tabs are represented', settingsTabs.length === 13);
  check('settings source reads succeed', admin.failures.length === 0, admin.failures);
  for (const target of [{ key: 'sage-operations', hash: '/?tab=sage-operations' }, { key: 'dashboard-redirect', hash: '/dashboard' }, { key: 'not-found', hash: '/phase1-review-missing-route' }, { key: 'passport-missing', hash: '/passport/phase1-review-no-such-lot' }]) {
    admin.failures.length = 0;
    await admin.page.goto(APP + '/#' + target.hash, { waitUntil: 'domcontentloaded' });
    for (const width of [1440, 768, 390]) await capture(admin, target.key, width);
  }
  await admin.context.close();
  const publicContext = await browser.createBrowserContext();
  const authPage = await publicContext.newPage();
  await authPage.goto(APP + '/#/auth', { waitUntil: 'domcontentloaded' });
  await authPage.waitForSelector('input[type="password"]');
  for (const rtl of [false, true]) {
    await authPage.evaluate(value => localStorage.setItem('i18nextLng', value), rtl ? 'ar' : 'fr');
    await authPage.reload({ waitUntil: 'domcontentloaded' });
    await authPage.waitForSelector('input[type="password"]');
    check('auth direction ' + rtl, await authPage.evaluate(expected => document.documentElement.dir === expected, rtl ? 'rtl' : 'ltr'));
    for (const width of [1440, 768, 390]) {
      await authPage.setViewport({ width, height: 1000, isMobile: width < 800, hasTouch: width < 800 });
      const key = rtl ? 'auth-rtl' : 'auth-fr';
      const file = key + '-' + width + '.png';
      check(key + ' fits ' + width, await authPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await authPage.screenshot({ path: path.join(OUT, file), fullPage: true });
      evidence.screens.push({ key, width, file, captured: true, visuallyReviewed: false });
    }
  }
  await publicContext.close();
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
