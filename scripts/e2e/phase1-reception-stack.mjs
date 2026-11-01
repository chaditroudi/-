/** Owns a verified local stack and runs the existing 17 reception scenarios unchanged. */
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertSafeDbTarget } from '../lib/db-target-guard.mjs';
import { assertTestStack, findForbiddenBundleHosts } from '../lib/api-target-guard.mjs';

const MODE = process.env.RECEPTION_MODE || 'frozen';
const DB = process.env.RECEPTION_DB;
const MONGO = process.env.MONGODB_URI;
const OUT = process.env.RECEPTION_OUT || '.local/evidence/reception-' + MODE;
const BUNDLE = process.env.RECEPTION_BUNDLE || '.local/bundles/reception';
const API = 'http://127.0.0.1:4171', APP = 'http://127.0.0.1:8171';
if (!['frozen', 'dev'].includes(MODE) || !DB?.startsWith('phase1_completion_reception_') || !MONGO || !assertSafeDbTarget({ uri: MONGO, dbName: DB, argv: [] }).isLocal) throw Error('Refusing an unverified reception test target.');
if (MODE === 'frozen' && findForbiddenBundleHosts(BUNDLE).length) throw Error('Unsafe frontend bundle.');
mkdirSync(OUT, { recursive: true });
const env = { ...process.env, APP_ENV: 'test', PORT: '4171', API_HOST: '127.0.0.1', MONGODB_URI: MONGO, MONGODB_DB_NAME: DB,
  JWT_SECRET: 'phase1-completion-reception-test-key', NUMERIC_SIGNATURE_GATE: 'enforce', AI_GUIDE_ENABLED: 'false', AI_GUIDE_PROVIDER: 'disabled',
  CORS_ORIGINS: APP, E2E_API: API, E2E_APP: APP, E2E_DB_NAME: DB, E2E_REPORT: path.resolve(OUT, 'results.json'),
  E2E_SCREENSHOTS: path.resolve(OUT, 'screens'), WEIGHBRIDGE_SIMULATOR_SECRET: 'local-e2e-sim-secret',
  VITE_BUILD_TARGET: 'test', VITE_API_URL: '/api', VITE_API_PROXY_TARGET: API, VITE_DEV_PORT: '8171', VITE_CACHE_DIR: path.resolve('.local/reception-dev-cache') };
const owned = [];
const until = async probe => { const end = Date.now() + 60_000; while (Date.now() < end) { if (await probe()) return; await new Promise(resolve => setTimeout(resolve, 200)); } throw Error('Local stack did not become ready.'); };
const metadata = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), mode: MODE, api: API, app: APP, database: DB, ownership: [], exitCode: null };
try {
  for (const url of [API + '/api/health', APP]) if (await fetch(url).then(() => true).catch(() => false)) throw Error('Private port is occupied: ' + url);
  const seeded = spawnSync(process.execPath, ['scripts/seed-test-actors.mjs'], { env, stdio: 'inherit', windowsHide: true });
  if (seeded.status) throw Error('Synthetic actor seeding failed.');
  const entries = [['server-dist/index.js'], MODE === 'dev' ? ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '8171', '--strictPort'] : ['scripts/e2e/static-server.mjs', BUNDLE, '8171']];
  for (const args of entries) { const child = spawn(process.execPath, args, { env, stdio: 'ignore', windowsHide: true }); owned.push(child); metadata.ownership.push({ pid: child.pid, entry: args[0] }); }
  for (const url of [API + '/api/health', APP]) await until(() => fetch(url).then(r => r.ok).catch(() => false));
  if (owned.some(child => child.exitCode !== null)) throw Error('Owned stack process exited before acceptance.');
  await assertTestStack(API);
  env.E2E_API_PID = String(owned[0].pid);
  const suite = spawn(process.execPath, ['scripts/e2e/reception.e2e.mjs'], { env, stdio: 'inherit', windowsHide: true });
  metadata.exitCode = await new Promise(resolve => suite.on('exit', resolve));
  process.exitCode = metadata.exitCode ?? 1;
} catch (error) {
  console.error(error.message); process.exitCode = 1;
} finally {
  for (const child of owned) child.kill();
  writeFileSync(path.join(OUT, 'stack.json'), JSON.stringify(metadata, null, 2));
}
