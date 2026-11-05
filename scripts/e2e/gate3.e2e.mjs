/** Narrow Gate 3 browser acceptance, not the full industrial golden thread. Disposable local stack only. */
import 'reflect-metadata';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve('.local/gate3-2026-11-04');
const DB = 'gate3_browser_it';
const PASSWORD = 'Local-gate3-browser-1';
const API = 'http://127.0.0.1:4143';
const APP = 'http://127.0.0.1:8143';
if (process.env.APP_ENV !== 'test' || !/^mongodb:\/\/127\.0\.0\.1:27431\//.test(process.env.MONGODB_URI ?? '')) throw Error('APP_ENV=test and disposable local MongoDB on :27431 required');
process.env.MONGODB_DB_NAME = DB;
const { connectToDatabase } = await import('../../server-dist/db/mongoose.js');
const { factoryConnection, runWithFactory } = await import('../../server-dist/db/factory-context.js');
const { getCollectionModel } = await import('../../server-dist/db/dynamic-model.js');
const { AuthUserModel } = await import('../../server-dist/models/auth-user.model.js');
const { ensureTrustIndexes } = await import('../../server-dist/db/indexes.js');
const { createApp } = await import('../../server-dist/app.js');
const { closeAllClients } = await import('../../server-dist/modules/realtime/realtime.bus.js');
const scopes = [
  { tenant_id: 'browser-company-a', factory_id: 'site-one' },
  { tenant_id: 'browser-company-b', factory_id: 'site-one' },
];
let app, browser, staticServer;
const errors = [];
const checks = [];
const check = (condition, message) => { if (!condition) throw Error(message); checks.push(message); };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  await connectToDatabase();
  if (mongoose.connection.name !== DB) throw Error('Unexpected test database');
  await mongoose.connection.dropDatabase();
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  for (const [index, scope] of scopes.entries()) {
    const key = index === 0 ? 'a' : 'b';
    await AuthUserModel.create({ id: `browser-${key}`, email: `${key}@gate3-browser.test`, passwordHash, ...scope,
      user_metadata: { full_name: `Test ${key}`, role: 'administrateur_systeme', roles: ['administrateur_systeme'] }, is_active: true,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    await runWithFactory(scope, async () => {
      await factoryConnection().dropDatabase();
      await ensureTrustIndexes(factoryConnection().db, true);
      await getCollectionModel('site_settings').create({ id: 'global', company_name: `Usine Test ${key.toUpperCase()}`, plant_name: `Site ${key}` });
      await getCollectionModel('suppliers').create({ id: `supplier-${key}`, code: 'SUP-SAME', name: `Oasis Privee ${key.toUpperCase()}`, supplier_status: 'active', is_active: true });
    });
  }
  app = await createApp();
  await app.listen(4143, '127.0.0.1');
  staticServer = spawn(process.execPath, ['scripts/e2e/static-server.mjs', path.join(ROOT, 'frontend'), '8143'], { windowsHide: true, stdio: 'ignore' });
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await fetch(APP).then((r) => r.ok).catch(() => false)) break;
    await wait(100);
  }
  browser = await puppeteer.launch({ executablePath: process.env.E2E_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--no-sandbox', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluateOnNewDocument(() => localStorage.setItem('i18nextLng', 'fr'));
  await page.goto(`${APP}/#/auth`, { waitUntil: 'domcontentloaded' });
  const login = async (key) => {
    await page.waitForSelector('#email', { visible: true });
    await page.type('#email', `${key}@gate3-browser.test`);
    await page.type('#password', PASSWORD);
    await page.click('form button[type="submit"]');
    await page.waitForFunction((id) => JSON.parse(localStorage.getItem('date-harvest-hub-session') ?? 'null')?.user.id === id, {}, `browser-${key}`);
    await page.evaluate(() => { location.hash = '/?tab=suppliers'; });
    await page.waitForFunction((label) => document.body.innerText.toLowerCase().includes(label.toLowerCase()), { timeout: 30_000 }, `Oasis Privee ${key.toUpperCase()}`);
  };
  await login('a');
  check(!(await page.evaluate(() => document.body.innerText)).includes('Oasis Privee B'), 'Factory A browser shows only its own supplier');
  await page.screenshot({ path: path.join(ROOT, 'browser-factory-a.png'), fullPage: true });
  await page.click('[aria-label="Se déconnecter"]');
  await login('b');
  const text = await page.evaluate(() => document.body.innerText);
  check(!text.includes('Oasis Privee A'), 'Shared tablet clears Factory A data before rendering Factory B');
  check(text.includes('Oasis Privee B'), 'Factory B loads its independent supplier with the same business reference');
  await page.screenshot({ path: path.join(ROOT, 'browser-factory-b.png'), fullPage: true });
  await page.setViewport({ width: 768, height: 1024 });
  await page.click('button[aria-label^="Langue"]');
  await page.waitForSelector('[role="menuitem"]');
  const arabic = await page.evaluateHandle(() => [...document.querySelectorAll('[role="menuitem"]')].find((node) => node.textContent.includes('العربية')));
  await arabic.click();
  await page.waitForFunction(() => document.documentElement.dir === 'rtl' || Boolean(document.querySelector('[dir="rtl"]')));
  check(await page.evaluate(() => document.documentElement.dir === 'rtl' || Boolean(document.querySelector('[dir="rtl"]'))), 'Arabic RTL remains available on a tablet');
  await page.screenshot({ path: path.join(ROOT, 'browser-factory-b-ar-tablet.png'), fullPage: true });
  check(errors.length === 0, 'No uncaught browser errors during factory switching');
  await writeFile(path.join(ROOT, 'browser-result.json'), `${JSON.stringify({ status: 'PASS', checks, errors, api: API, app: APP }, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'PASS', checks, errors }, null, 2));
} catch (error) {
  await mkdir(ROOT, { recursive: true });
  await writeFile(path.join(ROOT, 'browser-result.json'), `${JSON.stringify({ status: 'FAIL', checks, errors, failure: error.message }, null, 2)}\n`);
  throw error;
} finally {
  await browser?.close();
  staticServer?.kill();
  closeAllClients();
  await app?.close();
  if (mongoose.connection.name === DB && mongoose.connection.readyState === 1) {
    for (const scope of scopes) await runWithFactory(scope, () => factoryConnection().dropDatabase());
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
}
