/**
 * Phase 1 acceptance: what each role is offered, what the server refuses, and what the
 * screen says when data is denied, failing, empty, offline or old. Runs on a frozen build.
 * It owns its API and drops its own database. Local only.
 *
 *   node scripts/build-test-bundle.mjs <dir> http://127.0.0.1:4165/api
 *   ROLES_BUNDLE=<dir> MONGODB_URI=<local replica set> node scripts/e2e/roles.e2e.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import mongoose from "mongoose";
import puppeteer from "puppeteer-core";

import { assertTestStack } from "../lib/api-target-guard.mjs";
import { assertSafeDbTarget } from "../lib/db-target-guard.mjs";
import { syntheticIntakeFields } from "../lib/intake-contract.mjs";

const API_PORT = 4165;
const APP_PORT = 8165;
const API = `http://127.0.0.1:${API_PORT}`;
const APP = `http://127.0.0.1:${APP_PORT}`;
const MONGO = process.env.MONGODB_URI || "mongodb://127.0.0.1:27327/?replicaSet=rs-reception";
const DB = process.env.ROLES_DB_NAME || "roles_e2e";
const BUNDLE = process.env.ROLES_BUNDLE;
const SHOTS = process.env.ROLES_SCREENSHOTS || "docs/design/screenshots/phase1";
const BROWSER = process.env.E2E_BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PASSWORD = "Test123!";
const SESSION_KEY = "date-harvest-hub-session";

if (!BUNDLE) throw new Error("ROLES_BUNDLE must name a test bundle built for this API.");
if (!assertSafeDbTarget({ uri: MONGO, dbName: DB, argv: [] }).isLocal) throw new Error("This suite drops its database: local only.");

const FALSE_CALM = [/Aucune zone configurée/, /Rien d'urgent/, /0 lots disponibles/, /Lot sans numéro/];

const ROLES = [
  {
    key: "operateur", email: "operateur.reception@test.local", name: "Reception Operator",
    nav: ["Accueil", "Réception"], notNav: ["Stock", "En direct", "Production", "Indicateurs", "Paramètres"],
    denied: ["storage", "production", "live"], screens: ["receptions"],
    primary: { tab: "receptions", route: /\/api\/receptions\/search/, text: "Aucune réception aujourd'hui" },
  },
  {
    key: "inspecteur", email: "inspecteur.qualite@test.local", name: "Quality Inspector",
    nav: ["Accueil", "Réception", "Contrôle qualité"], notNav: ["Stock", "En direct", "Production"],
    denied: ["storage", "live"], screens: ["receptions"],
    primary: { tab: "receptions", view: "qc", route: /\/api\/receptions\/search/, text: "Aucun lot en attente de contrôle" },
  },
  {
    key: "production", email: "responsable.production@test.local", name: "Production Manager",
    nav: ["Accueil", "Production", "Conditionnement", "En direct"], notNav: ["Stock", "Réception", "Contrôle qualité"],
    denied: ["storage", "receptions"], screens: ["production"],
    primary: { tab: "production", route: /\/api\/production\/orders/, text: "Rien pour le moment" },
  },
  {
    key: "magasinier", email: "magasinier.wms@test.local", name: "Warehouse Employee",
    nav: ["Accueil", "Stock"], notNav: ["En direct", "Conditionnement", "Paramètres"],
    denied: ["live", "packaging"], screens: ["storage"],
    primary: { tab: "storage", route: /\/api\/stock\/reception-lots/, text: "Vue d'ensemble" },
  },
  {
    key: "directeur", email: "directeur.usine@test.local", name: "Factory Director",
    nav: ["Accueil", "Réception", "Stock", "Production", "En direct", "Paramètres"], notNav: [],
    denied: [], screens: ["storage", "production", "receptions"],
    primary: { tab: "storage", route: /\/api\/stock\/reception-lots/, text: "Vue d'ensemble" },
  },
  {
    key: "admin", email: "administrateur.systeme@test.local", name: "System Administrator",
    nav: ["Accueil", "Paramètres", "Stock"], notNav: [],
    denied: [], screens: ["settings"],
    primary: { tab: "storage", route: /\/api\/stock\/reception-lots/, text: "Vue d'ensemble" },
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const check = (role, label, passed, evidence = "") => {
  results.push({ role, label, passed: Boolean(passed) });
  if (!passed) console.log(`  FAIL  [${role}] ${label}${evidence === "" ? "" : `  ${JSON.stringify(evidence).slice(0, 220)}`}`);
};

const until = async (probe, timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await sleep(150);
  }
  return null;
};

const api = async (method, url, token, body) => {
  const response = await fetch(`${API}/api${url}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
};

const signIn = async (email) => (await api("POST", "/auth/signin", null, { email, password: PASSWORD })).body.data;

const env = {
  ...process.env,
  APP_ENV: "test",
  PORT: String(API_PORT),
  API_HOST: "127.0.0.1",
  MONGODB_URI: MONGO,
  MONGODB_DB_NAME: DB,
  JWT_SECRET: "local-roles-secret-of-any-value",
  NUMERIC_SIGNATURE_GATE: "enforce",
  CORS_ORIGINS: APP,
};

const WIDTHS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
  tablet: { width: 768, height: 1024, isMobile: true, hasTouch: true },
};

await mongoose.connect(MONGO, { dbName: DB });
await mongoose.connection.dropDatabase();
mkdirSync(SHOTS, { recursive: true });

const appProcess = spawn(process.execPath, ["scripts/e2e/static-server.mjs", BUNDLE, String(APP_PORT)], { stdio: "ignore" });
let apiProcess = spawn(process.execPath, ["server-dist/index.js"], { stdio: "ignore", env });
let browser = null;

const apiReady = () => until(() => fetch(`${API}/api/health`).then((response) => response.ok).catch(() => false), 40_000);

/** One browser context per account, as one tablet per person. */
const openFor = async (session, layout = "desktop") => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(WIDTHS[layout]);
  const responses = [];
  const rules = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/")) responses.push({ status: response.status(), url: response.url() });
  });
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const rule = request.method() !== "OPTIONS" && rules.find((candidate) => candidate.pattern.test(request.url()));
    if (!rule) return void request.continue();
    if (rule.delayMs) await sleep(rule.delayMs);
    if (rule.passthrough) return void request.continue();
    void request.respond({
      status: rule.status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": APP, "access-control-allow-headers": "*" },
      body: JSON.stringify(rule.body),
    });
  });
  await page.evaluateOnNewDocument((key, value) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem(key, value);
  }, SESSION_KEY, JSON.stringify(session));
  return { page, context, responses, rules };
};

const settle = async (page) => {
  await until(() => page.evaluate(() => !/Chargement|Préparation de votre espace/.test(document.body.innerText)), 12_000);
  await sleep(350);
};

const visit = async (page, tab, extra = "") => {
  await page.goto(`${APP}/#/?tab=${tab}${extra}`, { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
};

const text = (page) => page.evaluate(() => document.body.innerText);
const navLabels = (page) => page.evaluate(() =>
  [...document.querySelectorAll('[data-sidebar="menu-button"]')].map((item) => item.textContent.trim()));
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

try {
  await apiReady();
  await assertTestStack(API);

  const seeded = spawnSync(process.execPath, ["scripts/seed-test-actors.mjs"], { env, encoding: "utf8" });
  if (seeded.status !== 0) throw new Error(seeded.stderr);

  const director = await signIn("directeur.usine@test.local");
  const operator = await signIn("operateur.reception@test.local");
  await api("POST", "/storage/module3/seed", director.access_token, {});
  const supplier = await api("POST", "/suppliers", director.access_token, {
    code: "ROLES-001", name: "Oasis fictive", email: "fournisseur.externe@test.local", supplier_status: "active", is_active: true,
    country: "TN", agreed_price_tnd_per_kg: 10, contract_start_date: "2026-01-01", contract_end_date: "2099-12-31",
  });
  for (let index = 0; index < 3; index += 1) {
    await api("POST", "/receptions/intake", operator.access_token, {
      client_request_id: randomUUID(), supplier_id: supplier.body.data.id, ...syntheticIntakeFields(`ROLES-${index}`), spontaneous_delivery: true,
      unit: "kg", quantity_total: 500, gross_weight_kg: 550, tare_weight_kg: 50, variety: "Deglet Nour",
      lots: [{ lot_supplier: `ROLES-${index}`, variety: "Deglet Nour", quantity: 500, unit: "kg" }],
    });
  }

  browser = await puppeteer.launch({
    executablePath: BROWSER,
    headless: true,
    args: ["--no-sandbox", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"],
  });

  for (const role of ROLES) {
    console.log(`\n${role.name}`);
    const session = await signIn(role.email);
    const { page, context, responses, rules } = await openFor(session);

    await visit(page, "home");
    await until(() => page.evaluate(() => document.querySelector('[data-testid="realtime-status"]')?.textContent.includes("En direct")), 12_000);
    const nav = await navLabels(page);
    for (const label of role.nav) check(role.key, `navigation offers ${label}`, nav.includes(label), nav);
    for (const label of role.notNav) check(role.key, `navigation hides ${label}`, !nav.includes(label), nav);
    check(role.key, "says the stream is live", (await text(page)).includes("En direct"));
    await shot(page, `${role.key}-home-1440`);
    if (role.key === "operateur") {
      const home = await text(page);
      check(role.key, "is not offered QC work reserved to inspectors", !/contrôles? QC à faire|Ouvrir QC réception/.test(home), home.slice(0, 200));
    }

    await sleep(600);
    const refused = responses.filter((response) => response.status === 403 || response.status === 401);
    check(role.key, "Home asks for nothing the server refuses", refused.length === 0, refused.map((row) => row.url.replace(API, "")));
    check(role.key, "Home names every lot", !/Lot sans numéro/.test(await text(page)));
    const journey = await until(async () => !/Chargement du parcours/.test(await text(page)), 8_000);
    check(role.key, "the lot journey finishes loading", journey, responses.filter((row) => /trust/.test(row.url)).map((row) => `${row.status} ${row.url.replace(API, "")}`));

    for (const tab of role.denied) {
      responses.length = 0;
      await visit(page, tab);
      const body = await text(page);
      check(role.key, `direct address ${tab} says access is reserved`, /accès réservé/i.test(body), body.slice(0, 160));
      check(role.key, `direct address ${tab} stays on that address`, (await page.url()).includes(`tab=${tab}`), page.url());
      check(role.key, `direct address ${tab} shows no figures`, !/\d+ lots? (disponibles|en quarantaine)/.test(body));
      await shot(page, `${role.key}-denied-${tab}-1440`);
    }

    const { tab, view, route, text: expected } = role.primary;
    const extra = view ? `&view=${view}` : "";

    await visit(page, tab, extra);
    await shot(page, `${role.key}-${tab}-1440`);

    // The server fails.
    rules.push({ pattern: route, status: 500, body: { error: { code: "BOOM", message: "boom" } } });
    await visit(page, tab, extra);
    let body = await text(page);
    check(role.key, `500 on ${tab} is stated as unavailable`, /indisponibles/i.test(body), body.slice(0, 200));
    check(role.key, `500 on ${tab} is not an empty result`, !FALSE_CALM.some((pattern) => pattern.test(body)) && !/Aucune réception aujourd|Aucun lot en attente|Rien pour le moment/.test(body), body.slice(0, 200));
    await shot(page, `${role.key}-${tab}-500-1440`);
    rules.length = 0;

    // The server refuses something this screen normally gets.
    rules.push({ pattern: route, status: 403, body: { error: { code: "FORBIDDEN", message: "Refusé" } } });
    await visit(page, tab, extra);
    body = await text(page);
    check(role.key, `403 on ${tab} says access is reserved`, /accès réservé/i.test(body), body.slice(0, 200));
    check(role.key, `403 on ${tab} is not an empty result`, !/Aucune réception aujourd|Aucun lot en attente|Rien pour le moment|0 lots disponibles/.test(body), body.slice(0, 200));
    check(role.key, `403 on ${tab} offers no retry`, !/Réessayer/.test(body));
    await shot(page, `${role.key}-${tab}-403-1440`);
    rules.length = 0;

    // A true empty answer is allowed to say so.
    rules.push({ pattern: route, status: 200, body: route.source.includes("search") ? { data: { rows: [], nextBefore: null } } : { data: [] } });
    await visit(page, tab, extra);
    body = await text(page);
    if (role.key === "operateur" || role.key === "inspecteur" || role.key === "production") {
      check(role.key, `a real empty ${tab} says so`, body.includes(expected), body.slice(0, 200));
    }
    check(role.key, `empty ${tab} shows no failure`, !/indisponibles|Accès réservé/.test(body), body.slice(0, 200));
    await shot(page, `${role.key}-${tab}-empty-1440`);
    rules.length = 0;

    // Lost connection, then back.
    await visit(page, tab, extra);
    await page.setOfflineMode(true);
    const offline = await until(async () => /Hors ligne/.test(await text(page)), 8_000);
    check(role.key, "says it is offline", offline);
    await shot(page, `${role.key}-${tab}-offline-1440`);
    await page.setOfflineMode(false);
    const back = await until(() => page.evaluate(() => document.querySelector('[data-testid="realtime-status"]')?.textContent.includes("En direct")), 45_000);
    check(role.key, "goes back to live on its own", back);

    await context.close();
  }

  if (process.env.PHASE1_MATRIX_FILE) {
    const matrix = JSON.parse(readFileSync(process.env.PHASE1_MATRIX_FILE, 'utf8'));
    for (const item of matrix) {
      const email = item.role.replaceAll('_', '.') + '@test.local';
      const session = await signIn(email);
      if (!session?.access_token) throw new Error('Missing role fixture: ' + item.role);
      for (const { route, allowed } of Object.values(item.reads)) {
        const result = await api('GET', route.replace('GET /api', ''), session.access_token);
        check(item.role, route + ' matches backend authorization', allowed ? result.status === 200 : result.status === 403, result.status);
      }
      const { page, context, responses } = await openFor(session);
      await visit(page, 'home');
      const body = await text(page);
      const externalClient = ['client_externe', 'partenaire_client_export'].includes(item.role);
      if (externalClient) {
        check(item.role, 'external client sees no internal navigation', (await navLabels(page)).length === 0 && body.includes('Espace client'));
      } else if (item.role !== 'fournisseur_externe') {
        check(item.role, 'home identifies the operational responsibility', body.includes(item.profile.workspaceLabel), body.slice(0, 180));
        check(item.role, 'home performs no unauthorized requests', !responses.some(row => row.status === 403), responses.filter(row => row.status === 403));
        if (item.action) {
          const clicked = await page.evaluate(label => {
            const button = [...document.querySelectorAll('button')].find(button => button.textContent.includes(label));
            button?.click(); return Boolean(button);
          }, item.action.label);
          await settle(page);
          check(item.role, 'the primary daily action is reachable', clicked && page.url().includes('tab=' + item.action.tab), page.url());
        }
      }
      check(item.role, 'desktop has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await shot(page, item.role + '-daily-1440');
      for (const layout of ['tablet', 'mobile']) {
        await page.setViewport(WIDTHS[layout]);
        await sleep(250);
        check(item.role, layout + ' has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await shot(page, item.role + '-daily-' + WIDTHS[layout].width);
      }
      await context.close();
    }
  }

  console.log('\nNotification and settings boundaries');
  {
    const session = await signIn('administrateur.systeme@test.local');
    const { page, context, rules } = await openFor(session);
    for (const status of [403, 500]) {
      rules.push({ pattern: /\/api\/settings$/, status, body: { error: { code: 'TEST_FAILURE', message: 'Refus de test' } } });
      await visit(page, 'settings');
      const body = await text(page);
      check('admin', 'settings ' + status + ' never opens editable defaults', /Accès réservé|Données indisponibles/.test(body) && !body.includes('Infos Usine'), body.slice(0, 180));
      await shot(page, 'settings-' + status + '-1440');
      rules.length = 0;
      rules.push({ pattern: /\/api\/notifications(?:\?|$)/, status, body: { error: { code: 'TEST_FAILURE', message: 'Refus de test' } } });
      await visit(page, 'home');
      await page.click('button[aria-label^="Notifications"]');
      await sleep(500);
      check('admin', 'notification ' + status + ' explains failure', /Accès réservé|Données indisponibles/.test(await text(page)));
      await shot(page, 'notifications-' + status + '-1440');
      rules.length = 0;
    }
    await context.close();
  }

  console.log('\nIndependent viewers and committed notification refresh');
  {
    const viewer = await openFor(await signIn('operateur.reception@test.local'));
    const outsider = await openFor(await signIn('fournisseur.externe@test.local'));
    await visit(viewer.page, 'home'); await visit(outsider.page, 'home');
    const title = 'Notification de réception isolée ' + Date.now();
    const created = await api('POST', '/notifications', director.access_token, {
      notification_type: 'PHASE1_ACCEPTANCE', category: 'RECEPTION', title,
      message: 'Événement fictif local', severity: 'info', target_roles: ['operateur_reception'],
      action_url: '/?tab=receptions',
    });
    check('realtime', 'authorized notification committed', created.status === 201, created.status);
    await viewer.page.click('button[aria-label^="Notifications"]');
    const refreshed = await until(async () => (await text(viewer.page)).includes(title), 15000);
    check('realtime', 'IDs-only committed change refetches the authorized viewer', refreshed);
    const supplierList = await api('GET', '/notifications', (await signIn('fournisseur.externe@test.local')).access_token);
    check('realtime', 'external viewer receives no sensitive notification content', !JSON.stringify(supplierList.body).includes(title) && !(await text(outsider.page)).includes(title));
    await shot(viewer.page, 'notifications-committed-1440');
    await viewer.context.close(); await outsider.context.close();
  }

  console.log('\nLoading, expiration and RTL');
  {
    const { page, context, rules } = await openFor(await signIn('administrateur.systeme@test.local'));
    rules.push({ pattern: /\/api\/settings$/, delayMs: 1800, passthrough: true });
    await page.goto(`${APP}/#/?tab=settings`, { waitUntil: 'domcontentloaded' });
    check('states', 'settings loading is visible before the real response', await until(async () => (await text(page)).includes('Chargement : les paramètres'), 8000));
    await shot(page, 'settings-loading-1440');
    rules.length = 0;
    await settle(page);
    await context.close();
  }
  {
    const { page, context, rules } = await openFor(await signIn('operateur.reception@test.local'));
    await visit(page, 'receptions');
    rules.push({ pattern: /\/api\/receptions\/search/, status: 401, body: { error: { code: 'SESSION_REQUIRED', message: 'Session expirée' } } });
    await visit(page, 'receptions');
    check('states', 'session expiry returns to sign-in', await until(() => page.$('input[type="email"]'), 10000));
    check('states', 'expired session retains no account token', await page.evaluate(key => localStorage.getItem(key) === null, SESSION_KEY));
    await shot(page, 'session-expired-1440');
    await context.close();
  }
  {
    const { page, context } = await openFor(await signIn('inspecteur.qualite@test.local'), 'mobile');
    await visit(page, 'receptions', '&view=qc');
    await page.click('button[aria-label^="Langue"]');
    const menu = await page.$$('[role="menuitem"]');
    for (const item of menu) if ((await item.evaluate(node => node.textContent)).includes('العربية')) { await item.click(); break; }
    await sleep(250);
    check('rtl', 'Arabic preference sets document direction and language', await page.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'ar'));
    check('rtl', 'Arabic mobile QC has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await shot(page, 'inspecteur-qc-rtl-390');
    await context.close();
  }

  console.log("\nExternal Supplier");
  {
    const session = await signIn("fournisseur.externe@test.local");
    const { page, context, responses } = await openFor(session);
    await visit(page, "storage");
    await until(() => page.url().includes("/portail"), 10_000);
    check("fournisseur", "a factory address leads to the portal", page.url().includes("/portail"), page.url());
    await settle(page);
    const body = await text(page);
    check("fournisseur", "sees their own record", body.includes("Oasis fictive"), body.slice(0, 200));
    check("fournisseur", "sees no factory navigation", (await navLabels(page)).length === 0);
    const refused = responses.filter((response) => response.status === 403);
    check("fournisseur", "asks for nothing refused", refused.length === 0, refused.map((row) => row.url.replace(API, "")));
    await shot(page, "fournisseur-portail-1440");
    await context.close();
  }

  console.log("\nOld data on a failed refresh");
  {
    const session = await signIn("magasinier.wms@test.local");
    const { page, context, rules } = await openFor(session);
    await visit(page, "storage");
    await until(async () => /Disponible/.test(await text(page)));
    rules.push({ pattern: /\/api\/stock\/reception-lots/, status: 500, body: { error: { code: "BOOM", message: "boom" } } });
    await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Actualiser")?.click());
    const stale = await until(async () => /Mise à jour impossible/.test(await text(page)), 10_000);
    const body = await text(page);
    check("magasinier", "a failed refresh says the data may be old", stale, body.slice(0, 200));
    check("magasinier", "and keeps showing it", /Bloqué, non utilisable/.test(body), body.slice(0, 200));
    await shot(page, "magasinier-storage-stale-1440");
    await context.close();
  }

  console.log("\nStream drop when the API restarts");
  {
    const session = await signIn("directeur.usine@test.local");
    const { page, context } = await openFor(session);
    await visit(page, "home");
    await until(async () => (await text(page)).includes("En direct"));
    apiProcess.kill();
    const lost = await until(async () => /Reconnexion/.test(await text(page)), 50_000);
    check("directeur", "a dropped stream stops claiming to be live", lost);
    await shot(page, "directeur-reconnecting-1440");
    apiProcess = spawn(process.execPath, ["server-dist/index.js"], { stdio: "ignore", env });
    await apiReady();
    const back = await until(async () => (await text(page)).includes("En direct"), 60_000);
    check("directeur", "it reconnects when the API returns", back);
    await context.close();
  }

  console.log("\nSwitching users on one tablet");
  {
    const session = await signIn("directeur.usine@test.local");
    const { page, context } = await openFor(session);
    await visit(page, "storage");
    await until(async () => /Disponible/.test(await text(page)));
    await page.evaluate(() => document.querySelector('[aria-label="Se déconnecter"]')?.click());
    await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
    await page.type('input[type="email"]', "operateur.reception@test.local");
    await page.type('input[type="password"]', PASSWORD);
    await page.keyboard.press("Enter");
    await until(async () => (await navLabels(page)).includes("Réception"), 15_000);
    await settle(page);
    const nav = await navLabels(page);
    check("switch", "the next account gets its own navigation", !nav.includes("Stock") && !nav.includes("Paramètres"), nav);
    check("switch", "nothing of the previous account is on screen", !/Driss/.test(await text(page)));
    await context.close();
  }

  console.log("\nTablet, touch");
  for (const layout of ["tablet", "mobile"]) for (const { name, email, tab, extra = "" } of [
    { name: "operateur", email: "operateur.reception@test.local", tab: "receptions" },
    { name: "inspecteur", email: "inspecteur.qualite@test.local", tab: "receptions", extra: "&view=qc" },
    { name: "production", email: "responsable.production@test.local", tab: "production" },
    { name: "magasinier", email: "magasinier.wms@test.local", tab: "storage" },
  ]) {
    const session = await signIn(email);
    const { page, context, rules } = await openFor(session, layout);
    await visit(page, "home");
    await shot(page, `${name}-home-${WIDTHS[layout].width}-touch`);
    await visit(page, tab, extra);
    await shot(page, `${name}-${tab}-${WIDTHS[layout].width}-touch`);
    if (layout === 'mobile') {
      const scanner = await page.evaluate(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Scan'));
      check(name, 'mobile navigation retains the authorized scanner', scanner);
    }
    const small = await page.evaluate(() => [...document.querySelectorAll("button, [role='tab']")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.height < 44 && getComputedStyle(element).visibility !== "hidden";
      })
      .map((element) => (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 30)));
    check(name, `${tab} has no control under 44 px on touch`, small.length === 0, small.slice(0, 8));
    const coarse = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
    check(name, "touch emulation reports a coarse pointer", coarse);
    if (name === "inspecteur") {
      const hidden = await page.evaluate(() => {
        const tab = [...document.querySelectorAll('[role="tab"]')].find((element) => element.textContent.includes("Contrôle QC"));
        const box = tab?.getBoundingClientRect();
        const covering = box && document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return !box || !tab.contains(covering);
      });
      check(name, "the active QC tab is not covered", !hidden);
      await page.focus('[role="tab"][data-state="active"]');
      await page.keyboard.press('ArrowLeft');
      check(name, 'reception tabs support arrow-key focus and activation', await page.evaluate(() => document.activeElement?.getAttribute('role') === 'tab' && document.activeElement?.getAttribute('aria-selected') === 'true'));
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    check(name, `${tab} does not scroll sideways`, !overflow);
    rules.push({ pattern: /\/api\/(stock\/reception-lots|receptions\/search|production\/orders)/, status: 500, body: { error: { code: "BOOM", message: "boom" } } });
    await visit(page, tab, extra);
    await shot(page, `${name}-${tab}-500-${WIDTHS[layout].width}-touch`);
    await context.close();
  }

  console.log("\nA crash stays inside its screen");
  {
    const session = await signIn("magasinier.wms@test.local");
    const { page, context, rules } = await openFor(session);
    rules.push({ pattern: /\/api\/storage\/module3\/zones/, status: 200, body: { data: "not a list" } });
    await visit(page, "storage");
    let body = await text(page);
    check("magasinier", "a crash in one screen keeps the navigation", /Cet écran a rencontré un problème/.test(body) && body.includes("Accueil"), body.slice(0, 200));
    await shot(page, "magasinier-crash-1440");
    rules.length = 0;
    rules.push({ pattern: /\/api\/stock\/reception-lots/, status: 200, body: { data: "not a list" } });
    await visit(page, "home");
    body = await text(page);
    check("magasinier", "a crash in the shell still gives a way out", /Cet écran a rencontré un problème/.test(body) && /Recharger/.test(body), body.slice(0, 200));
    await context.close();
  }
} finally {
  await browser?.close().catch(() => undefined);
  apiProcess.kill();
  appProcess.kill();
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoose.disconnect();
}

if (process.env.ROLES_RESULTS) writeFileSync(process.env.ROLES_RESULTS, JSON.stringify(results, null, 2));
const failed = results.filter((row) => !row.passed).length;
console.log(`\n${results.length - failed}/${results.length} role checks passed across ${new Set(results.map((row) => row.role)).size} accounts`);
process.exit(failed ? 1 : 0);
