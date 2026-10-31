/**
 * Reception acceptance in a real browser against a real API and replica set.
 * Local only: it drops E2E_DB_NAME. Start mongod and Vite first (see docs/reception-2.md).
 *
 *   E2E_API=http://127.0.0.1:4127 E2E_APP=http://127.0.0.1:8127 node scripts/e2e/reception.e2e.mjs
 */
import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import mongoose from "mongoose";
import puppeteer from "puppeteer-core";

import { assertSafeDbTarget } from "../lib/db-target-guard.mjs";

const API = process.env.E2E_API || "http://127.0.0.1:4127";
const APP = process.env.E2E_APP || "http://127.0.0.1:8127";
const MONGO = process.env.MONGODB_URI || "mongodb://127.0.0.1:27327/?replicaSet=rs-reception";
const DB = process.env.E2E_DB_NAME || "reception_e2e";
const BROWSER = process.env.E2E_BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SHOTS = process.env.E2E_SCREENSHOTS || "";
const ONLY = (process.env.E2E_ONLY || "").split(",").filter(Boolean);
const SIM_SECRET = process.env.WEIGHBRIDGE_SIMULATOR_SECRET || "local-e2e-sim-secret";
const PASSWORD = "Test123!";
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z",
  "base64",
);

assertSafeDbTarget({ uri: MONGO, dbName: DB });

let apiProcess = null;

const results = [];
const col = (name) => mongoose.connection.db.collection(name);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const check = (condition, message, evidence = "") => {
  if (!condition) throw new Error(`${message}${evidence !== "" ? ` — ${JSON.stringify(evidence)}` : ""}`);
};

const until = async (probe, message, timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await probe();
    if (last) return last;
    await sleep(150);
  }
  throw new Error(`Timeout: ${message}`);
};

const api = async (method, url, token, body) => {
  const response = await fetch(`${API}/api${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
};

const signIn = async (email) => {
  const { status, body } = await api("POST", "/auth/signin", null, { email, password: PASSWORD });
  check(status === 200 || status === 201, `sign in ${email}`, status);
  return body.data;
};

const browser = await puppeteer.launch({
  executablePath: BROWSER,
  headless: true,
  args: ["--no-sandbox", "--use-fake-ui-for-media-stream"],
});

const openPages = new Set();

const openApp = async (session, { viewport = { width: 1280, height: 900 }, tab = "receptions" } = {}) => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  page.on("pageerror", (error) => console.log(`  [pageerror] ${error.message.slice(0, 160)}`));
  page.on("response", async (response) => {
    if (response.status() >= 400 && /intake|reception-drafts/.test(response.url())) {
      const body = await response.text().catch(() => "");
      console.log(`  [${response.status()}] ${response.url().replace(APP, "")} ${body.slice(0, 220)}`);
    }
  });
  if (process.env.E2E_TRACE) {
    page.on("response", (response) => { if (/realtime|receptions\/search/.test(response.url())) console.log(`  <- ${response.status()} ${response.url().replace(APP, "").slice(0, 70)}`); });
    page.on("requestfailed", (request) => { if (/realtime/.test(request.url())) console.log(`  !! ${request.url().replace(APP, "").slice(0, 50)} ${request.failure()?.errorText}`); });
    page.on("request", (request) => { if (/\/api\/(receptions\/intake|reception-drafts)/.test(request.url())) console.log(`  -> ${request.method()} ${request.url().replace(APP, "")}`); });
    page.on("requestfailed", (request) => console.log(`  !! ${request.url().replace(APP, "")} ${request.failure()?.errorText}`));
    page.on("response", (response) => { if (/\/api\/(receptions\/intake|reception-drafts)/.test(response.url())) console.log(`  <- ${response.status()} ${response.url().replace(APP, "")}`); });
    page.on("console", (message) => { if (message.type() === "error") console.log(`  [console] ${message.text().slice(0, 200)}`); });
  }
  openPages.add(page);
  page.on("dialog", (dialog) => void dialog.accept());
  // Signed in before the first script runs, and only once: scenarios change the session themselves.
  await page.evaluateOnNewDocument((value) => {
    if (sessionStorage.getItem("e2e-seeded")) return;
    sessionStorage.setItem("e2e-seeded", "1");
    localStorage.setItem("date-harvest-hub-session", JSON.stringify(value));
  }, session);
  await page.goto(`${APP}/#/?tab=${tab}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.body.innerText.includes("Réception des dattes") || document.body.innerText.includes("Contrôle Qualité Entrée"),
    { timeout: 90000 },
  );
  return page;
};

const text = (page) => page.evaluate(() => document.body.innerText);
// innerText follows CSS text-transform, so comparisons ignore case.
const hasText = async (page, value) => (await text(page)).toLowerCase().includes(value.toLowerCase());
const waitText = (page, value, timeoutMs = 15000) =>
  until(() => hasText(page, value), `"${value}" on screen`, timeoutMs);

const clickByText = async (page, label, options = {}) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await clickOnce(page, label, options);
    } catch (error) {
      // The list re-rendered under the pointer, as live refreshes do.
      if (attempt >= 3 || !/detached|not clickable/i.test(error.message)) throw error;
      await sleep(250);
    }
  }
};

const clickOnce = async (page, label, { selector = "button", exact = false } = {}) => {
  const handle = await page.evaluateHandle((target, css, wholeText) => {
    const visible = (element) => element.getClientRects().length > 0 && !element.disabled;
    return [...document.querySelectorAll(css)].find((element) => {
      const value = element.innerText?.trim().toLowerCase() ?? "";
      const wanted = target.toLowerCase();
      return visible(element) && (wholeText ? value === wanted : value.includes(wanted));
    }) ?? null;
  }, label, selector, exact);
  const element = handle.asElement();
  check(element, `button "${label}" available`);
  // A real pointer: Radix tabs react to mouse down, and a covered button must fail here too.
  await element.click();
};

const buttonEnabled = (page, label) => page.evaluate((target) =>
  [...document.querySelectorAll("button")].some((button) => button.innerText.includes(target) && !button.disabled), label);

/** React inputs need the native setter, as a real keystroke would go through. */
const fill = async (page, label, value) => {
  const done = await page.evaluate((target, next) => {
    const labelNode = [...document.querySelectorAll("label")].find((node) => node.innerText.trim().replace(/\s*\*$/, "").startsWith(target));
    const input = labelNode && document.getElementById(labelNode.getAttribute("for"));
    if (!input) return false;
    const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(input, next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, label, value);
  check(done, `field "${label}" available`);
};

const pickSupplier = async (page, name) => {
  await page.click('[aria-label="Fournisseur"]');
  await page.waitForSelector("[cmdk-input]");
  await page.type("[cmdk-input]", name);
  await sleep(200);
  await clickByText(page, name, { selector: "[cmdk-item]" });
};

const pickZone = async (page) => {
  await until(async () => (await page.evaluate(() =>
    document.querySelector('[aria-label="Zone de stockage temporaire"]')?.innerText ?? "")).match(/ZR|SB/), "a zone is suggested");
};

const addPhotos = async (page) => {
  const input = await page.$('input[type="file"]');
  const dir = process.env.TEMP || ".";
  const file = path.join(dir, `e2e-${randomUUID()}.jpg`);
  writeFileSync(file, JPEG);
  await input.uploadFile(file);
  await waitText(page, "Ajoutez", 200).catch(() => undefined);
  await sleep(400);
  await input.uploadFile(file);
  await until(async () => hasText(page, "Photos obligatoires ajoutées"), "two photos attached");
};

const stepOne = async (page, { supplier, note, plate = "123 TU 4567", orderNumber }) => {
  // Toasts last 5 s but pause under the pointer, so move it away and let them clear.
  await page.mouse.move(600, 700);
  await until(async () => !(await page.$("[data-sonner-toast]")), "notifications cleared", 12000);
  await clickByText(page, "Nouvelle réception", { exact: true });
  await waitText(page, "Fournisseur & livraison");
  await pickSupplier(page, supplier);
  if (orderNumber) {
    await until(() => hasText(page, orderNumber), "order offered");
    await clickByText(page, orderNumber);
  }
  await fill(page, "N° bon de livraison", note);
  await fill(page, "Immatriculation", plate);
  await clickByText(page, "Deglet Nour", { selector: '[role="radio"]' });
  await clickByText(page, "Tamar", { selector: '[role="radio"]' });
  await clickByText(page, "Manuelle traditionnelle", { selector: '[role="radio"]' });
  await clickByText(page, "Continuer");
  await waitText(page, "Mode", 100).catch(() => undefined);
  await until(() => page.$('[aria-label="Mode de pesée"]'), "weighing step");
};

const stepTwoManual = async (page, { gross, tare, declared }) => {
  await fill(page, "Poids brut", String(gross));
  await fill(page, "Tare", String(tare));
  if (declared) await fill(page, "Poids annoncé", String(declared));
  await fill(page, "Nombre de supports", "4");
  await fill(page, "Température à l'arrivée", "24");
  await pickZone(page);
  await addPhotos(page);
};

const goToReview = async (page) => {
  await clickByText(page, "Continuer");
  await waitText(page, "Provenance du poids");
};

const confirmReception = async (page) => {
  await clickByText(page, "Confirmer la réception");
  await until(() => page.$('[data-testid="reception-number"]'), "reception confirmed");
  return page.$eval('[data-testid="reception-number"]', (node) => node.innerText.trim());
};

const backToList = async (page) => {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.innerText.includes("Réception des dattes"), { timeout: 90000 });
};

const readOutbox = (page) => page.evaluate(() => new Promise((resolve) => {
  const open = indexedDB.open("royal-palm-edge", 1);
  open.onerror = () => resolve([]);
  open.onsuccess = () => {
    const request = open.result.transaction("outbox").objectStore("outbox").getAll();
    request.onsuccess = () => resolve(request.result.map((item) => item.status));
  };
}));

/** After sign-in the app redirects to Accueil, so this keeps asking until Réception is on screen. */
const openReceptions = (page) => until(async () => {
  await page.evaluate(() => { window.location.hash = "#/?tab=receptions"; });
  await sleep(700);
  return hasText(page, "Réception des dattes");
}, "Réception open", 30000);

const receptionByNote = (note) => col("receptions_v2").findOne({ delivery_note_number: note });

const shot = async (page, name) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
};

const run = async (id, title, scenario) => {
  if (ONLY.length > 0 && !ONLY.includes(id)) return;
  const started = Date.now();
  try {
    const evidence = await scenario();
    results.push({ id, title, status: "PASS", evidence: evidence ?? "" });
    console.log(`PASS ${id} ${title} (${Date.now() - started} ms) ${evidence ?? ""}`);
  } catch (error) {
    results.push({ id, title, status: "FAIL", evidence: error.message });
    console.log(`FAIL ${id} ${title}: ${error.message}`);
    for (const page of openPages) {
      if (page.isClosed()) continue;
      await shot(page, `failed-${id}`).catch(() => undefined);
      console.log(`  [screen] ${(await text(page).catch(() => "")).replace(/\s+/g, " ").slice(-420)}`);
      if (process.env.E2E_TRACE) {
        console.log("  [state]", await page.evaluate(async () => {
          const withTimeout = (promise) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve("TIMEOUT"), 3000))]);
          const dbs = await withTimeout(indexedDB.databases());
          const opened = await withTimeout(new Promise((resolve) => {
            const open = indexedDB.open("royal-palm-edge", 1);
            open.onblocked = () => resolve("blocked");
            open.onerror = () => resolve(`error ${open.error}`);
            open.onsuccess = () => {
              const names = [...open.result.objectStoreNames];
              if (!names.includes("outbox")) return resolve({ names });
              const request = open.result.transaction("outbox").objectStore("outbox").getAll();
              request.onsuccess = () => resolve({ names, items: request.result.map((item) => [item.status, item.lastError]) });
            };
          }));
          return JSON.stringify({ online: navigator.onLine, dbs, opened });
        }));
      }
    }
  } finally {
    for (const page of openPages) {
      if (!page.isClosed()) await page.browserContext().close().catch(() => undefined);
    }
    openPages.clear();
  }
};

await mongoose.connect(MONGO, { dbName: DB });
if (!(await fetch(`${API}/api/health`).then((response) => response.ok).catch(() => false))) await startApi();
for (const name of [
  "receptions_v2", "reception_lots", "reception_units", "stock_lots", "weighing_records", "lot_events", "reception_drafts",
  "idempotency_commands", "purchase_orders", "purchase_order_lines", "purchase_order_receiving_lots", "suppliers",
  "reception_alerts", "reception_audit_logs_v2", "weighbridge_readings", "weighbridge_devices", "qc_inspections",
]) {
  await col(name).deleteMany({});
}

const operator = await signIn("operateur.reception@test.local");
const supervisor = await signIn("chef.reception@test.local");
const inspector = await signIn("inspecteur.qualite@test.local");
const director = await signIn("directeur.usine@test.local");
const production = await signIn("responsable.production@test.local");

await api("POST", "/storage/module3/seed", director.access_token, {});
// The first load compiles the app; no scenario should pay for that.
await (await openApp(operator)).browserContext().close();
openPages.clear();
const now = new Date().toISOString();
const supplierRow = (code, name) => ({
  id: randomUUID(), code, name, is_active: true, supplier_status: "active", region: "Tozeur", oasis_name: "Oasis E2E",
  created_at: now, updated_at: now,
});
const supplierA = supplierRow("SUP-E2E-A", "Oasis Essai Alpha");
const supplierB = supplierRow("SUP-E2E-B", "Oasis Essai Beta");
await col("suppliers").insertMany([supplierA, supplierB]);
await col("purchase_orders").insertOne({
  id: "po-e2e", order_number: "PO-E2E-1", supplier_id: supplierB.id, status: "confirmed", created_at: now, updated_at: now,
});
await col("purchase_order_lines").insertOne({
  id: "pol-e2e", order_id: "po-e2e", line_number: 1, description: "Deglet Nour brute", quantity: 1000, received_quantity: 0,
  unit: "kg", created_at: now, updated_at: now,
});

await run("A", "Standard supplier reception", async () => {
  const page = await openApp(operator);
  await stepOne(page, { supplier: "Oasis Essai Alpha", note: "BL-A" });
  await stepTwoManual(page, { gross: 1000, tare: 100, declared: 900 });
  await shot(page, "step2-manual");
  await goToReview(page);
  await shot(page, "step3-review");
  check(await hasText(page, "Saisie manuelle · lu sur la bascule"), "honest provenance on review");
  const number = await confirmReception(page);
  await shot(page, "result");
  check(await hasText(page, "En quarantaine, en attente du contrôle qualité"), "QC state after confirmation");
  const reception = await receptionByNote("BL-A");
  const lots = await col("reception_lots").find({ reception_id: reception.id }).toArray();
  const stock = await col("stock_lots").find({ reception_lot_id: lots[0].id }).toArray();
  const events = await col("lot_events").find({ lot_id: lots[0].id }).toArray();
  check(reception.status === "EN_ATTENTE_QC" && reception.reception_number === number, "reception state", reception.status);
  check(lots.length === 1 && lots[0].quantity === 900 && lots[0].stock_status === "EN_QUARANTAINE", "lot");
  check(stock.length === 1 && stock[0].status === "QUARANTINE", "stock in quarantine", stock.length);
  check(events.some((e) => e.event_type === "LOT_WEIGHED") && events.some((e) => e.event_type === "LOT_CREATED"), "ledger");
  check(await col("reception_audit_logs_v2").countDocuments({ entity_id: reception.id, action: "RECEPTION_CONFIRMED" }) === 1, "audit");
  await page.browserContext().close();
  return `${number} lot ${lots[0].lot_internal}`;
});

await run("B", "Partial purchase-order reception", async () => {
  const page = await openApp(operator);
  await stepOne(page, { supplier: "Oasis Essai Beta", note: "BL-B1", orderNumber: "PO-E2E-1" });
  await stepTwoManual(page, { gross: 500, tare: 100 });
  check(await hasText(page, "Livraison partielle"), "partial delivery explained");
  check(await hasText(page, "1000 kg"), "expected quantity shown");
  await goToReview(page);
  await confirmReception(page);
  const line = await col("purchase_order_lines").findOne({ id: "pol-e2e" });
  const order = await col("purchase_orders").findOne({ id: "po-e2e" });
  const reception = await receptionByNote("BL-B1");
  check(line.received_quantity === 400, "received quantity", line.received_quantity);
  check(order.status === "partially_delivered", "order status", order.status);
  check(reception.po_expected_kg === 1000 && reception.po_variance_kg === -600, "order vs received kept", [reception.po_expected_kg, reception.po_variance_kg]);

  await backToList(page);
  await stepOne(page, { supplier: "Oasis Essai Beta", note: "BL-B2", orderNumber: "PO-E2E-1" });
  await stepTwoManual(page, { gross: 700, tare: 100 });
  await goToReview(page);
  await confirmReception(page);
  const closed = await col("purchase_order_lines").findOne({ id: "pol-e2e" });
  const finalOrder = await col("purchase_orders").findOne({ id: "po-e2e" });
  check(closed.received_quantity === 1000, "second delivery completes the line", closed.received_quantity);
  check(finalOrder.status === "delivered", "order delivered", finalOrder.status);

  const over = await api("POST", "/receptions/intake", operator.access_token, {
    ...await legalPayload(supplierB.id, "BL-OVER"), purchase_order_id: "po-e2e", purchase_order_line_id: "pol-e2e",
  });
  check(over.status === 400, "no further receipt on a closed order", over.status);
  await page.browserContext().close();
  return "400 kg then 600 kg of 1000 kg; order delivered; over-receipt refused";
});

async function legalPayload(supplierId, note, overrides = {}) {
  return {
    client_request_id: randomUUID(), supplier_id: supplierId, reception_type: "DATTE", delivery_note_number: note,
    vehicle_number: "999 TU 1", variety: "Deglet Nour", maturity_stage: "Tamar", harvest_method: "Manuelle traditionnelle",
    arrival_temperature_c: 24, storage_zone_code: "ZR-02", delivery_note_photos: ["p1", "p2"], unit_count: 1,
    weighing_source: "SCALE", gross_weight_kg: 300, tare_weight_kg: 100, lots: [{ lot_supplier: note, quantity: 200 }],
    ...overrides,
  };
}

await run("C", "Manual weighing without a scale", async () => {
  const page = await openApp(operator);
  await stepOne(page, { supplier: "Oasis Essai Alpha", note: "BL-C", plate: "222 TU 2222" });
  await fill(page, "Poids brut", "800");
  await fill(page, "Tare", "100");
  await clickByText(page, "Sans bascule", { selector: '[role="radio"]' });
  await fill(page, "Nombre de supports", "2");
  await fill(page, "Température à l'arrivée", "22");
  await pickZone(page);
  await addPhotos(page);
  await sleep(300);
  const blocked = await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Continuer"))?.disabled);
  check(blocked === true, "reason required before continuing");
  await fill(page, "Pourquoi la bascule", "Bascule en panne depuis ce matin");
  await goToReview(page);
  check(await hasText(page, "Saisie manuelle · sans bascule"), "provenance on review");
  await confirmReception(page);
  const reception = await receptionByNote("BL-C");
  const records = await col("weighing_records").find({ reception_id: reception.id }).toArray();
  check(reception.weighing_source === "MANUAL" && reception.weighing_verified_device === false, "reception provenance");
  check(records.length === 2 && records.every((r) => r.source === "MANUAL" && r.signature_verified === false && r.manual_reason), "weighing records", records.length);
  const alert = await col("reception_alerts").findOne({ reception_id: reception.id, message: /RG-R08/ });
  check(alert, "scale-failure alert");
  await page.browserContext().close();
  return "records MANUAL, unsigned, reason kept, RG-R08 alert raised";
});

const pushReading = async (readingId, weightKg, direction, secret = SIM_SECRET) => {
  const capturedAt = new Date().toISOString();
  const body = { readingId, deviceCode: "SIM-01", capturedAt, weightKg, unit: "kg", stable: true, direction };
  const signature = createHmac("sha256", secret)
    .update(["SIM-01", readingId, capturedAt, weightKg.toFixed(3), "kg", "1", direction].join(":"))
    .digest("hex");
  return api("POST", "/weighbridge/readings", null, { ...body, signature });
};

await run("D", "Connected weighing adapter (simulator, not hardware)", async () => {
  const forged = await pushReading(`FORGED-${Date.now()}`, 5000, "GROSS", "wrong-secret");
  check(forged.status === 401, "forged reading refused", forged.status);

  const page = await openApp(operator);
  await stepOne(page, { supplier: "Oasis Essai Alpha", note: "BL-D", plate: "333 TU 3333" });
  await clickByText(page, "Bascule connectée", { selector: '[role="radio"]' });
  await waitText(page, "Aucune lecture disponible");
  const grossId = `G-${Date.now()}`;
  check((await pushReading(grossId, 1500, "GROSS")).status < 300, "gross reading accepted");
  await until(() => buttonEnabled(page, "Prendre comme brut"), "reading offered");
  await clickByText(page, "Prendre comme brut");
  await until(async () => page.evaluate(() =>
    [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Prendre comme tare"))?.disabled === true), "gross reading cannot be reused");
  const tareId = `T-${Date.now()}`;
  check((await pushReading(tareId, 300, "TARE")).status < 300, "tare reading accepted");
  await until(() => buttonEnabled(page, "Prendre comme tare"), "tare reading offered");
  await clickByText(page, "Prendre comme tare");
  await waitText(page, "1200 kg");
  await shot(page, "step2-connected");
  await fill(page, "Nombre de supports", "3");
  await fill(page, "Température à l'arrivée", "25");
  await pickZone(page);
  await addPhotos(page);
  await goToReview(page);
  check(await hasText(page, "Bascule connectée · lecture signée"), "device provenance");
  await confirmReception(page);
  const reception = await receptionByNote("BL-D");
  const records = await col("weighing_records").find({ reception_id: reception.id }).toArray();
  const consumed = await col("weighbridge_readings").countDocuments({ reading_id: { $in: [grossId, tareId] }, consumed: true });
  check(reception.weighing_source === "DEVICE" && reception.weighing_verified_device === true && reception.gross_weight_kg === 1500, "device reception");
  check(records.length === 2 && records.every((r) => r.source === "DEVICE" && r.signature_verified === true && r.reading_id), "device evidence", records);
  check(consumed === 2, "readings consumed", consumed);
  const replay = await api("POST", "/receptions/intake", operator.access_token, await legalPayload(supplierA.id, "BL-D2", {
    gross_reading_id: grossId, tare_reading_id: tareId, weighing_source: undefined,
  }));
  check(replay.status === 400, "a consumed reading cannot be replayed", replay.status);
  await page.browserContext().close();
  return "signed readings consumed once; forged and replayed readings refused";
});

await run("E", "Duplicate confirmation", async () => {
  const page = await openApp(operator);
  await stepOne(page, { supplier: "Oasis Essai Alpha", note: "BL-E", plate: "444 TU 4444" });
  await stepTwoManual(page, { gross: 400, tare: 100 });
  await goToReview(page);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Confirmer la réception"));
    button.click();
    button.click();
    button.click();
  });
  await until(() => page.$('[data-testid="reception-number"]'), "confirmed");
  check(await col("receptions_v2").countDocuments({ delivery_note_number: "BL-E" }) === 1, "one reception after triple click");

  const payload = await legalPayload(supplierA.id, "BL-E2");
  const responses = await Promise.all([1, 2, 3, 4].map(() => api("POST", "/receptions/intake", operator.access_token, payload)));
  await sleep(300);
  const replay = await api("POST", "/receptions/intake", operator.access_token, payload);
  check(replay.status < 300 && replay.body?.meta?.replayed === true, "retry replays", replay.status);
  check(await col("receptions_v2").countDocuments({ delivery_note_number: "BL-E2" }) === 1, "one reception after concurrent retries");
  const conflict = await api("POST", "/receptions/intake", operator.access_token, { ...payload, gross_weight_kg: 350, lots: [{ lot_supplier: "BL-E2", quantity: 250 }] });
  check(conflict.status === 409 && conflict.body?.error?.code === "IDEMPOTENT_PAYLOAD_MISMATCH", "edited retry refused", conflict.status);
  await page.browserContext().close();
  return `4 concurrent API calls → statuses ${responses.map((r) => r.status).join(",")}, 1 reception`;
});

await run("F", "Concurrent employee edits", async () => {
  const pageA = await openApp(operator);
  await stepOne(pageA, { supplier: "Oasis Essai Alpha", note: "BL-F", plate: "555 TU 5555" });
  const draft = await until(() => col("reception_drafts").findOne({ "payload.delivery_note_number": "BL-F", status: "OPEN" }), "draft shared");
  const pageB = await openApp(supervisor);
  await clickByText(pageB, "En attente");
  await waitText(pageB, "En attente de pesée brute");
  await shot(pageB, "pending");
  await clickByText(pageB, "Reprendre");
  await until(() => pageB.$('[aria-label="Mode de pesée"]'), "second employee in the draft");
  await fill(pageB, "Poids brut", "610");
  await clickByText(pageB, "Enregistrer et quitter");
  await until(async () => (await col("reception_drafts").findOne({ id: draft.id })).version > draft.version, "second save");

  await fill(pageA, "Poids brut", "999");
  await clickByText(pageA, "Enregistrer et quitter");
  await waitText(pageA, "Réception des dattes");
  const stored = await col("reception_drafts").findOne({ id: draft.id });
  check(stored.payload.gross_weight_kg === "610", "stale save lost nothing", stored.payload.gross_weight_kg);
  await pageA.browserContext().close();
  await pageB.browserContext().close();
  return `version ${stored.version}: the later stale screen did not overwrite`;
});

await run("G", "QC-pending lot cannot be used or self-released", async () => {
  const reception = await receptionByNote("BL-A");
  const lot = await col("reception_lots").findOne({ reception_id: reception.id });
  const order = await api("POST", "/production/orders", production.access_token, {
    order_number: `OF-E2E-${Date.now()}`, planned_quantity: 100, unit: "kg", status: "planned",
  });
  const orderId = order.body?.data?.id;
  const allocate = await api("POST", `/production/orders/${orderId}/allocate-lot`, production.access_token, { lot_id: lot.id, allocated_kg: 100 });
  check(allocate.status >= 400, "quarantined lot refused by production", [order.status, allocate.status]);

  const selfQc = await api("POST", "/qc/start", operator.access_token, { reception_id: reception.id });
  check(selfQc.status === 403, "operator cannot start QC", selfQc.status);
  const selfRelease = await api("POST", `/reception-lots/${lot.id}/quality-status`, operator.access_token, { action: "RELEASE", reason: "x" });
  check(selfRelease.status === 403, "operator cannot release", selfRelease.status);
  const direct = await api("PATCH", `/reception-lots/${lot.id}`, operator.access_token, { stock_status: "STOCK_LIBERE", variety: "Autre" });
  check(direct.status === 409, "booked lot cannot be patched", direct.status);
  const stock = await col("stock_lots").findOne({ reception_lot_id: lot.id });
  check(stock.status === "QUARANTINE", "stock still quarantined", stock.status);

  const page = await openApp(inspector);
  await until(() => hasText(page, "Contrôle Qualité Entrée"), "inspector lands on the QC queue");
  await waitText(page, reception.reception_number);
  check(
    !(await page.evaluate(() => [...document.querySelectorAll("button")].some((button) => /nouvelle réception/i.test(button.innerText)))),
    "inspector does not register deliveries",
  );
  await page.browserContext().close();
  return `allocate ${allocate.status}, self-QC ${selfQc.status}, release ${selfRelease.status}, patch ${direct.status}`;
});

await run("H", "Offline, session expiry and server restart recovery", async () => {
  const page = await openApp(operator);
  await stepOne(page, { supplier: "Oasis Essai Alpha", note: "BL-H", plate: "666 TU 6666" });
  await stepTwoManual(page, { gross: 650, tare: 150 });

  // Browser reload keeps the draft.
  await sleep(500);
  await backToList(page);
  await clickByText(page, "En attente");
  await until(() => hasText(page, "BL BL-H"), "draft listed after reload");
  await clickByText(page, "Reprendre");
  await until(() => page.$('[aria-label="Mode de pesée"]'), "draft resumed");
  await goToReview(page);

  // Session ends at the moment of confirming: the app returns to sign-in and nothing is lost.
  const good = await page.evaluate(() => localStorage.getItem("date-harvest-hub-session"));
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem("date-harvest-hub-session"));
    session.access_token = "expired.token.value";
    localStorage.setItem("date-harvest-hub-session", JSON.stringify(session));
    [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Confirmer la réception")).click();
  });
  await until(() => page.url().includes("/auth"), "session end returns to sign-in");
  await waitText(page, "Mot de passe");
  await until(async () => (await readOutbox(page)).length === 1, "delivery kept in the outbox");
  await shot(page, "session-expired");
  check(await col("receptions_v2").countDocuments({ delivery_note_number: "BL-H" }) === 0, "nothing booked yet");

  // Survives a reload on the sign-in page.
  await page.reload({ waitUntil: "domcontentloaded" });
  check((await readOutbox(page)).length === 1, "delivery survives a reload in the outbox");

  // Same user signs in again: it goes out once, by itself.
  await page.evaluate((value) => localStorage.setItem("date-harvest-hub-session", value), good);
  await page.reload({ waitUntil: "domcontentloaded" });
  await until(async () => (await col("receptions_v2").countDocuments({ delivery_note_number: "BL-H" })) === 1, "synced after sign-in", 30000);
  await sleep(1500);
  check(await col("receptions_v2").countDocuments({ delivery_note_number: "BL-H" }) === 1, "exactly one reception");
  check((await readOutbox(page)).length === 0, "outbox emptied");

  // Session ends while a delivery is only half entered: typed weights come back.
  await openReceptions(page);
  await stepOne(page, { supplier: "Oasis Essai Alpha", note: "BL-H1", plate: "666 TU 6667" });
  await fill(page, "Poids brut", "720");
  await sleep(600);
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem("date-harvest-hub-session"));
    session.access_token = "expired.token.value";
    localStorage.setItem("date-harvest-hub-session", JSON.stringify(session));
  });
  await clickByText(page, "Enregistrer et quitter");
  await until(() => page.url().includes("/auth"), "half-entered delivery: return to sign-in");
  await page.evaluate((value) => localStorage.setItem("date-harvest-hub-session", value), good);
  await page.reload({ waitUntil: "domcontentloaded" });
  await openReceptions(page);
  await clickByText(page, "En attente");
  await until(() => hasText(page, "BL BL-H1"), "draft listed after sign-in");
  const row = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((button) =>
      button.innerText.trim() === "Reprendre" && button.parentElement.innerText.includes("BL BL-H1")));
  await row.asElement().click();
  await until(() => page.$('[aria-label="Mode de pesée"]'), "draft resumed");
  await waitText(page, "Mode", 100).catch(() => undefined);
  const gross = await page.evaluate(() => {
    const label = [...document.querySelectorAll("label")].find((node) => node.innerText.startsWith("Poids brut"));
    return document.getElementById(label.getAttribute("for"))?.value;
  });
  check(gross === "720", "typed weight restored after sign-in", gross);
  await clickByText(page, "Abandonner");
  await waitText(page, "Réception des dattes");

  // Network drop, then back.
  await stepOne(page, { supplier: "Oasis Essai Alpha", note: "BL-H2", plate: "666 TU 7777" });
  await stepTwoManual(page, { gross: 300, tare: 100 });
  await goToReview(page);
  await page.setOfflineMode(true);
  await waitText(page, "Hors ligne");
  await sleep(500);
  await clickByText(page, "Confirmer la réception");
  await waitText(page, "Pas de connexion : réception gardée sur cet appareil");
  await page.setOfflineMode(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await until(async () => (await col("receptions_v2").countDocuments({ delivery_note_number: "BL-H2" })) === 1, "synced after reconnect", 30000);

  // Server down at confirmation, restarted later.
  await backToList(page);
  await stepOne(page, { supplier: "Oasis Essai Alpha", note: "BL-H3", plate: "666 TU 8888" });
  await stepTwoManual(page, { gross: 300, tare: 100 });
  await goToReview(page);
  await stopApi();
  try {
    await clickByText(page, "Confirmer la réception");
    // Vite's proxy holds the request instead of refusing it, so the client's own timeouts decide here.
    await waitText(page, "gardée sur cet appareil", 50000);
    check(await col("receptions_v2").countDocuments({ delivery_note_number: "BL-H3" }) === 0, "nothing booked while the server is down");
  } finally {
    await startApi();
  }
  await until(async () => (await col("receptions_v2").countDocuments({ delivery_note_number: "BL-H3" })) === 1, "synced after server restart", 45000);
  await sleep(1500);
  check(await col("receptions_v2").countDocuments({ delivery_note_number: "BL-H3" }) === 1, "exactly one after restart");
  await page.browserContext().close();
  return "reload, session expiry, network drop and server restart: one reception each";
});

await run("I", "Correction by an authorised supervisor", async () => {
  const reception = await receptionByNote("BL-C");
  const denied = await api("POST", `/receptions/${reception.id}/corrections`, operator.access_token, {
    reason: "tentative opérateur", fields: { delivery_note_number: "X" },
  });
  check(denied.status === 403, "operator denied", denied.status);
  const noReason = await api("POST", `/receptions/${reception.id}/corrections`, supervisor.access_token, { reason: "court", fields: { vehicle_number: "X" } });
  check(noReason.status === 400, "reason required", noReason.status);
  const weights = await api("POST", `/receptions/${reception.id}/corrections`, supervisor.access_token, {
    reason: "tentative de changer le poids", fields: { gross_weight_kg: 1, quantity_total: 1 },
  });
  check(weights.status === 400, "weights not correctable here", weights.status);

  const operatorPage = await openApp(operator);
  await clickByText(operatorPage, "Historique");
  await waitText(operatorPage, reception.reception_number);
  await clickByText(operatorPage, reception.reception_number);
  await waitText(operatorPage, "Prochaine étape");
  check(!(await operatorPage.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Corriger"))), "no correction control for operators");
  await operatorPage.browserContext().close();

  const page = await openApp(supervisor);
  await clickByText(page, "Historique");
  await page.type('[aria-label="Rechercher une réception"]', "BL-C");
  await sleep(700);
  await clickByText(page, reception.reception_number);
  await waitText(page, "Prochaine étape");
  await waitText(page, "Saisie manuelle · sans bascule");
  await clickByText(page, "Corriger", { exact: true });
  await waitText(page, "Motif de la correction");
  await page.evaluate(() => {
    const set = (id, value) => {
      const input = document.getElementById(id);
      const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("correction-delivery_note_number", "BL-C-CORRIGE");
    set("correction-reason", "Erreur de frappe sur le numéro du BL");
  });
  await sleep(200);
  await clickByText(page, "Enregistrer la correction");
  await until(async () => (await col("receptions_v2").findOne({ id: reception.id })).delivery_note_number === "BL-C-CORRIGE", "correction stored");
  const audit = await col("reception_audit_logs_v2").findOne({ entity_id: reception.id, action: "CORRECTED" });
  check(audit.previous_state.delivery_note_number === "BL-C" && /frappe/.test(audit.new_state.reason), "original value and reason kept", audit);
  await page.browserContext().close();
  return "operator 403; old value, new value, reason and actor in audit";
});

await run("J", "Real-time update across two clients", async () => {
  const watcher = await openApp(supervisor);
  await waitText(watcher, "Réceptions du jour");
  const before = await text(watcher);
  const payload = await legalPayload(supplierA.id, "BL-J");
  const created = await api("POST", "/receptions/intake", operator.access_token, payload);
  const number = created.body?.data?.reception?.reception_number;
  check(number && !before.includes(number), "new reception", created.status);
  await until(() => hasText(watcher, number), "list refreshed with no reload", 10000);

  const draftId = randomUUID();
  await api("PUT", `/reception-drafts/${draftId}`, operator.access_token, {
    payload: { supplier_id: supplierA.id }, summary: { supplier: "Brouillon temps réel", deliveryNote: "BL-RT", vehicle: "", waitingFor: "En attente de pesée brute" },
  });
  await clickByText(watcher, "En attente");
  await waitText(watcher, "Brouillon temps réel");

  await stopApi();
  await sleep(500);
  const missed = await legalPayload(supplierA.id, "BL-J2");
  await startApi();
  const createdWhileAway = await api("POST", "/receptions/intake", operator.access_token, missed);
  const missedNumber = createdWhileAway.body?.data?.reception?.reception_number;
  check(createdWhileAway.status === 201 && missedNumber, "reception created right after the restart", createdWhileAway);
  await clickByText(watcher, "Réceptions du jour");
  // Worst case: the stream dies silently and the client's 40 s watchdog has to notice.
  await until(() => hasText(watcher, missedNumber), "reconnect recovers events", 80000);
  await watcher.browserContext().close();
  return `${number} and ${missedNumber} appeared without a reload, the second across a server restart`;
});

await run("K", "Historical reception compatibility", async () => {
  await col("receptions_v2").insertOne({
    id: "legacy-1", reception_number: "REC-20250101-0001", status: "LIBERE", supplier_id: supplierA.id,
    supplier_name_snapshot: "Oasis Essai Alpha", quantity_total: 1200, unit: "kg", client_request_id: null,
    delivery_note_number: "BL-LEGACY", delivery_note_photos: ["data:image/jpeg;base64,AAAA"], weighing_source: "SCALE",
    gross_weight_kg: 1500, tare_weight_kg: 300, created_at: "2025-01-01T08:00:00.000Z", actual_arrival_date: "2025-01-01T08:00:00.000Z",
    qc_decision: "ACCEPTE",
  });
  await col("receptions_v2").insertOne({
    id: "legacy-2", reception_number: "REC-20250101-0002", status: "LIBERE", supplier_id: supplierA.id, quantity_total: 10, unit: "kg",
    client_request_id: null, created_at: "2025-01-01T09:00:00.000Z", actual_arrival_date: "2025-01-01T09:00:00.000Z",
  }).catch((error) => { throw new Error(`second historical null key refused: ${error.message}`); });
  await col("reception_lots").insertOne({
    id: "legacy-lot", reception_id: "legacy-1", lot_internal: "LOT-0001", lot_supplier: "L", quantity: 1200, unit: "kg", stock_status: "STOCK_LIBERE",
  });

  const page = await openApp(operator);
  await clickByText(page, "Historique");
  await page.type('[aria-label="Rechercher une réception"]', "BL-LEGACY");
  await waitText(page, "REC-20250101-0001");
  await clickByText(page, "REC-20250101-0001");
  await waitText(page, "Prochaine étape");
  await waitText(page, "Saisie manuelle · lu sur la bascule");
  check(!(await hasText(page, "Bascule connectée")), "old typed weight is not presented as a device reading");
  await clickByText(page, "Lots", { selector: '[role="tab"]' });
  await waitText(page, "LOT-0001");
  await clickByText(page, "Voir la pesée");
  await waitText(page, "réception enregistrée avant la conservation");
  await page.browserContext().close();
  return "old records open; missing evidence is stated, not invented";
});

await run("L", "Refused confirmation keeps every entry", async () => {
  const page = await openApp(operator);
  await stepOne(page, { supplier: "Oasis Essai Beta", note: "BL-L", plate: "888 TU 8888" });
  await stepTwoManual(page, { gross: 500, tare: 100 });
  await goToReview(page);
  await col("suppliers").updateOne({ id: supplierB.id }, { $set: { supplier_status: "blocked" } });
  await clickByText(page, "Confirmer la réception");
  await waitText(page, "n'est pas actif");
  await shot(page, "refused");
  check(await hasText(page, "BL-L"), "entries still on screen");
  check(await col("receptions_v2").countDocuments({ delivery_note_number: "BL-L" }) === 0, "nothing persisted");
  const outbox = await page.evaluate(() => new Promise((resolve) => {
    const open = indexedDB.open("royal-palm-edge", 1);
    open.onsuccess = () => {
      const request = open.result.transaction("outbox").objectStore("outbox").getAll();
      request.onsuccess = () => resolve(request.result.length);
    };
  }));
  check(outbox === 0, "a refused delivery does not retry forever", outbox);
  await col("suppliers").updateOne({ id: supplierB.id }, { $set: { supplier_status: "active" } });
  await clickByText(page, "Confirmer la réception");
  await until(() => page.$('[data-testid="reception-number"]'), "confirmation after the supplier is reactivated");
  check(await col("receptions_v2").countDocuments({ delivery_note_number: "BL-L" }) === 1, "one reception after recovery");
  await page.browserContext().close();
  return "server refusal shown in French, nothing written, retry succeeded once";
});

await run("S", "QC decision reaches other screens without approving anything else", async () => {
  const reception = await receptionByNote("BL-E");
  const watcher = await openApp(operator);
  await waitText(watcher, reception.reception_number);
  const started = await api("POST", "/qc/start", inspector.access_token, { reception_id: reception.id, inspector_name: "E2E" });
  check(started.status === 201, "inspector opens the QC", started.status);
  await until(async () => (await col("receptions_v2").findOne({ id: reception.id })).status === "EN_QC", "reception in QC");
  const decision = await api("POST", "/qc/submit", inspector.access_token, {
    inspectionId: started.body.data.id, decision: "QUARANTAINE", comment: "Humidité à recontrôler",
  });
  check(decision.status < 300, "quarantine decision", decision);
  await waitText(watcher, "Bloqué");
  const lot = await col("reception_lots").findOne({ reception_id: reception.id });
  const stock = await col("stock_lots").findOne({ reception_lot_id: lot.id });
  check(lot.stock_status === "EN_QUARANTAINE" && stock.status === "QUARANTINE", "lot and stock stay blocked", [lot.stock_status, stock.status]);
  const release = await api("POST", "/qc/submit", operator.access_token, { inspectionId: started.body.data.id, decision: "ACCEPTE" });
  check(release.status === 403, "operator cannot decide", release.status);
  return "quarantine shown live on the operator's screen; lot and stock stayed blocked";
});

await run("R", "Tablet and phone widths", async () => {
  for (const [name, viewport] of [["tablet", { width: 768, height: 1024 }], ["phone", { width: 375, height: 812 }]]) {
    const page = await openApp(operator, { viewport });
    await shot(page, `workspace-${name}`);
    await clickByText(page, "Nouvelle réception", { exact: true });
    await until(() => page.$('[data-testid="intake-actions"]'), "intake open");
    await shot(page, `step1-${name}`);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 3 }));
    await sleep(200);
    const reachable = await page.evaluate(() => {
      const button = [...document.querySelectorAll('[data-testid="intake-actions"] button')].find((b) => b.innerText.includes("Continuer"));
      const box = button.getBoundingClientRect();
      const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      // A disabled button lets the pointer through to its bar, which is still what is on top here.
      return box.bottom <= window.innerHeight && box.top >= 0 && Boolean(top?.closest('[data-testid="intake-actions"]'));
    });
    check(reachable, `primary action on screen and not covered on ${name}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 1, `no horizontal scroll on ${name}`, overflow);
    await page.browserContext().close();
  }
  return "768 px and 375 px without horizontal scroll";
});

async function stopApi() {
  if (process.env.E2E_API_PID && !apiProcess) {
    process.kill(Number(process.env.E2E_API_PID));
    process.env.E2E_API_PID = "";
  } else {
    apiProcess?.kill();
    apiProcess = null;
  }
  await until(async () => fetch(`${API}/api/health`).then(() => false).catch(() => true), "API stopped");
}

async function startApi() {
  apiProcess = spawn(process.execPath, ["server-dist/index.js"], { stdio: "ignore", env: process.env });
  await until(async () => fetch(`${API}/api/health`).then((response) => response.ok).catch(() => false), "API restarted", 30000);
}

const failed = results.filter((result) => result.status !== "PASS");
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
if (process.env.E2E_REPORT) writeFileSync(process.env.E2E_REPORT, JSON.stringify(results, null, 2));
await browser.close();
await mongoose.disconnect();
apiProcess?.kill();
process.exit(failed.length ? 1 : 0);
