/**
 * Phase 0 regression: what one account can see of another, on a real API and a frozen
 * build with its service worker running. It owns its own API and drops its own database.
 *
 *   node scripts/build-test-bundle.mjs <dir> http://127.0.0.1:4161/api
 *   ISOLATION_BUNDLE=<dir> MONGODB_URI=<local replica set> node scripts/e2e/isolation.e2e.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";
import puppeteer from "puppeteer-core";

import { assertTestStack } from "../lib/api-target-guard.mjs";
import { assertSafeDbTarget } from "../lib/db-target-guard.mjs";
import { syntheticIntakeFields } from "../lib/intake-contract.mjs";

const API_PORT = 4161;
const APP_PORT = 8161;
const API = `http://127.0.0.1:${API_PORT}`;
const APP = `http://127.0.0.1:${APP_PORT}`;
const MONGO = process.env.MONGODB_URI || "mongodb://127.0.0.1:27327/?replicaSet=rs-reception";
const DB = process.env.ISOLATION_DB_NAME || "isolation_e2e";
const BUNDLE = process.env.ISOLATION_BUNDLE;
const BROWSER = process.env.E2E_BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PASSWORD = "Test123!";

if (!BUNDLE) throw new Error("ISOLATION_BUNDLE must name a test bundle built for this API.");
if (!assertSafeDbTarget({ uri: MONGO, dbName: DB, argv: [] }).isLocal) throw new Error("This suite drops its database: local only.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const check = (condition, label, evidence = "") => {
  results.push(Boolean(condition));
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${condition || evidence === "" ? "" : `  ${JSON.stringify(evidence)}`}`);
};

const until = async (probe, label, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await sleep(150);
  }
  throw new Error(`Timeout: ${label}`);
};

const api = async (method, path, token, body) => {
  const response = await fetch(`${API}/api${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, headers: response.headers, body: await response.json().catch(() => null) };
};

const login = async (email) => {
  const { body } = await api("POST", "/auth/signin", null, { email, password: PASSWORD });
  const token = body?.data?.session?.access_token || body?.data?.access_token;
  if (!token) throw new Error(`Sign-in failed for ${email}`);
  return token;
};

/** Reads a stream until told to stop, and keeps every event. */
const openStream = async (token) => {
  const ticket = (await api("POST", "/realtime/ticket", token)).body.data.ticket;
  const controller = new AbortController();
  const response = await fetch(`${API}/api/realtime/events?ticket=${ticket}`, { signal: controller.signal });
  const events = [];
  const decoder = new TextDecoder();
  let buffer = "";
  void (async () => {
    try {
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const part of parts) {
          const name = part.match(/^event: (.+)$/m)?.[1];
          const data = part.match(/^data: (.+)$/m)?.[1];
          if (name && data) events.push({ name, data: JSON.parse(data) });
        }
      }
    } catch { /* closed by the test */ }
  })();
  await until(() => events.some((event) => event.name === "connected"), "stream connected");
  return { events, ticket, close: () => controller.abort() };
};

const env = {
  ...process.env,
  APP_ENV: "test",
  PORT: String(API_PORT),
  API_HOST: "127.0.0.1",
  MONGODB_URI: MONGO,
  MONGODB_DB_NAME: DB,
  JWT_SECRET: "local-isolation-secret-of-any-value",
  NUMERIC_SIGNATURE_GATE: "enforce",
  CORS_ORIGINS: APP,
};

await mongoose.connect(MONGO, { dbName: DB });
await mongoose.connection.dropDatabase();

const apiProcess = spawn(process.execPath, ["server-dist/index.js"], { stdio: "ignore", env });
const appProcess = spawn(process.execPath, ["scripts/e2e/static-server.mjs", BUNDLE, String(APP_PORT)], { stdio: "ignore" });
let browser = null;

try {
  await until(() => fetch(`${API}/api/health`).then((response) => response.ok).catch(() => false), "API ready", 40_000);
  await assertTestStack(API);

  const seeded = spawnSync(process.execPath, ["scripts/seed-test-actors.mjs"], { env, encoding: "utf8" });
  if (seeded.status !== 0) throw new Error(seeded.stderr);

  console.log("\nStream authentication");
  const director = await login("directeur.usine@test.local");
  const warehouse = await login("magasinier.wms@test.local");
  const operator = await login("operateur.reception@test.local");
  const portal = await login("fournisseur.externe@test.local");

  const byToken = await fetch(`${API}/api/realtime/events?token=${encodeURIComponent(director)}`);
  check(byToken.status === 401, "a valid session token in the URL opens nothing", byToken.status);

  const noTicket = await api("POST", "/realtime/ticket");
  check(noTicket.status === 401, "no ticket without a session", noTicket.status);

  const guessed = await fetch(`${API}/api/realtime/events?ticket=guess`);
  check(guessed.status === 401, "an invented ticket opens nothing", guessed.status);

  const opStream = await openStream(operator);
  const replay = await fetch(`${API}/api/realtime/events?ticket=${opStream.ticket}`);
  check(replay.status === 401, "a ticket works once", replay.status);

  const health = await api("GET", "/health");
  check(health.body.environment === "test", "health names the environment", health.body.environment);
  check(health.body.database_host_class === "local", "health names the database class", health.body.database_host_class);
  check(!JSON.stringify(health.body).includes("27327"), "health does not show the connection string");

  console.log("\nRealtime contents");
  const portalStream = await openStream(portal);
  const suppliers = await api("POST", "/suppliers", director, {
    code: `ISO-${Date.now()}`, name: "Fournisseur fictif", email: "fournisseur.externe@test.local", supplier_status: "active",
    is_active: true, country: "TN", agreed_price_tnd_per_kg: 10, contract_start_date: "2026-01-01", contract_end_date: "2099-12-31",
  });
  const other = await api("POST", "/suppliers", director, {
    code: `ISO-B-${Date.now()}`, name: "Autre fournisseur", email: "autre@test.local", supplier_status: "active",
    is_active: true, country: "TN", contract_start_date: "2026-01-01", contract_end_date: "2099-12-31",
  });
  const intake = await api("POST", "/receptions/intake", operator, {
    client_request_id: randomUUID(), supplier_id: suppliers.body.data.id, ...syntheticIntakeFields(), spontaneous_delivery: true,
    unit: "kg", quantity_total: 100, gross_weight_kg: 110, tare_weight_kg: 10, variety: "Deglet Nour",
    lots: [{ lot_supplier: `ISO-${Date.now()}`, variety: "Deglet Nour", quantity: 100, unit: "kg" }],
  });
  const lots = (await api("GET", "/stock/lots", director)).body.data;
  const lot = lots[0];
  const edit = await api("PATCH", `/stock/lots/${lot.id}`, warehouse, { notes: "Note de test" });
  check(edit.status === 200, "warehouse can make an ordinary stock edit", edit.status);

  const stockEvent = await until(() => opStream.events.find((event) => event.data.type === "stock_lot_updated"), "stock event");
  check(!("rows" in stockEvent.data), "the event carries no record");
  check(Array.isArray(stockEvent.data.rowIds) && stockEvent.data.rowIds[0] === lot.id, "the event carries the id");
  const operatorRead = await api("GET", "/stock/lots", operator);
  check(operatorRead.status === 403, "the operator still cannot read that record", operatorRead.status);

  await sleep(300);
  const leaked = portalStream.events.filter((event) => event.name === "db-change");
  check(leaked.length === 0, "a supplier account hears nothing about the factory", leaked.map((event) => event.data.type));

  console.log("\nSupplier portal scope");
  const own = await api("GET", "/suppliers", portal);
  check(own.status === 200 && own.body.data.length === 1 && own.body.data[0].id === suppliers.body.data.id, "a supplier lists only its own record", own.body?.data?.length);
  const foreign = await api("GET", `/suppliers/${other.body.data.id}/lots`, portal);
  check(foreign.status === 403, "a supplier cannot read another supplier's lots", foreign.status);
  const payments = await api("GET", `/suppliers/${other.body.data.id}/payments`, portal);
  check(payments.status === 403, "a supplier cannot read another supplier's payments", payments.status);

  console.log("\nResponses");
  const stored = await api("GET", "/suppliers", director);
  check(stored.headers.get("cache-control") === "no-store", "answers are marked not to be stored", stored.headers.get("cache-control"));

  opStream.close();
  portalStream.close();
  await until(async () => (await openStream(director).then((probe) => { probe.close(); return probe; })).events[0].data.connectedClients === 1, "probe streams closed");

  console.log("\nShared tablet, in a browser with the service worker active");
  browser = await puppeteer.launch({
    executablePath: BROWSER,
    headless: true,
    args: ["--no-sandbox", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"],
  });
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const requested = [];
  page.on("request", (request) => requested.push(request.url()));

  const signInThroughForm = async (email) => {
    await page.waitForSelector('input[type="email"]');
    await page.$eval('input[type="email"]', (input) => { input.value = ""; });
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', PASSWORD);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !location.hash.includes("/auth") && !location.pathname.endsWith("/auth"), { timeout: 20_000 }).catch(() => undefined);
  };

  // Signing out revokes the browser's token, so the count comes from another account.
  const connectedClients = async () => {
    const probe = await openStream(warehouse);
    const count = probe.events[0].data.connectedClients;
    probe.close();
    await sleep(150);
    return count;
  };

  await page.goto(`${APP}/#/auth`, { waitUntil: "domcontentloaded" });
  await signInThroughForm("directeur.usine@test.local");
  await until(() => page.evaluate(async () => Boolean(await navigator.serviceWorker?.getRegistration())), "service worker registered");
  await until(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), "service worker in control");
  await page.goto(`${APP}/#/?tab=storage`, { waitUntil: "domcontentloaded" });
  await until(() => requested.some((url) => url.includes("/api/stock/lots")), "stock loaded");
  await until(async () => (await connectedClients()) === 2, "browser stream open");

  const realtimeUrls = requested.filter((url) => url.includes("/realtime/"));
  check(realtimeUrls.some((url) => url.includes("/realtime/events?ticket=")), "the browser streams with a ticket");
  check(!requested.some((url) => /[?&]token=/.test(url)), "no request URL carries a session token");

  const cachesAfterUse = await page.evaluate(() => caches.keys());
  check(!cachesAfterUse.includes("api-cache"), "the service worker keeps no API cache", cachesAfterUse);

  await page.evaluate(() => {
    const control = [...document.querySelectorAll("button")].find((button) => /déconnexion|déconnecter|sign out/i.test(`${button.getAttribute("aria-label") ?? ""} ${button.title} ${button.textContent}`));
    if (!control) throw new Error("No sign-out control found");
    control.click();
  });
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await until(async () => (await connectedClients()) === 1, "stream closed at sign-out").then(
    () => check(true, "the stream closes at sign-out"),
    () => check(false, "the stream closes at sign-out"),
  );

  await signInThroughForm("operateur.reception@test.local");
  await until(async () => (await connectedClients()) === 2, "stream for the new account").then(
    () => check(true, "the next account gets its own stream"),
    () => check(false, "the next account gets its own stream"),
  );

  const session = await page.evaluate(() => JSON.parse(localStorage.getItem("date-harvest-hub-session"))?.user?.email);
  check(session === "operateur.reception@test.local", "the session belongs to the new account", session);

  await page.setOfflineMode(true);
  const offlineRead = await page.evaluate(async (url) => {
    try {
      const response = await fetch(url);
      return { served: true, status: response.status };
    } catch {
      return { served: false };
    }
  }, `${API}/api/stock/lots`);
  check(!offlineRead.served, "offline, the director's stock answer is not served to the next user", offlineRead);
  await page.setOfflineMode(false);
} finally {
  await browser?.close().catch(() => undefined);
  apiProcess.kill();
  appProcess.kill();
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoose.disconnect();
}

const failed = results.filter((passed) => !passed).length;
console.log(`\n${results.length - failed}/${results.length} isolation checks passed`);
process.exit(failed ? 1 : 0);
