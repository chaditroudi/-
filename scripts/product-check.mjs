/**
 * Buyer readiness gate — fast check before demo / handover.
 * Usage: npm run product:check
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

const requiredFiles = [
  'README.md',
  'LICENSE',
  'docs/BUYER_HANDOFF.md',
  'docs/PRODUCT_MAP.md',
  'docs/ROADMAP_v2.1.md',
  'docs/DEMO_RUNBOOK.md',
  'docs/UAT_CHECKLIST.md',
  '.env.example',
  'src/lib/fichesTechniques.ts',
  'src/lib/productMeta.ts',
  'src/components/fiches/FichesTechniquesHub.tsx',
  'src/components/documents/DocumentsWorkspace.tsx',
  'src/components/settings/FichesCmsPanel.tsx',
];

let failed = false;

console.log('Date Harvest Hub — product:check\n');

for (const rel of requiredFiles) {
  const ok = existsSync(resolve(root, rel));
  console.log(`${ok ? 'OK' : 'MISSING'}  ${rel}`);
  if (!ok) failed = true;
}

console.log('\nRunning critical unit tests…');
const vitest = spawnSync(
  'npm',
  ['exec', '--', 'vitest', 'run', 'src/lib/fichesTechniques.test.ts', 'src/lib/lotJourney.test.ts', '--reporter=dot'],
  { cwd: root, stdio: 'inherit', shell: true },
);

if (vitest.status !== 0) {
  failed = true;
  console.error('\nproduct:check FAILED — tests');
} else if (failed) {
  console.error('\nproduct:check FAILED — missing files');
} else {
  console.log('\nproduct:check PASSED — ready for buyer demo handoff');
}

process.exit(failed ? 1 : 0);
