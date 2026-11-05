#!/usr/bin/env node
/**
 * Gate 1 regression gate: fail CI/local checks if client TypeScript errors return.
 * Usage: node scripts/gate1-tsc-regression.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outPath = path.join(root, '.local', 'gate1-tsc-regression.txt');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const result = spawnSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.app.json', '--pretty', 'false'],
  { encoding: 'utf8', cwd: root, maxBuffer: 20 * 1024 * 1024 },
);

const output = `${result.stdout || ''}${result.stderr || ''}`;
fs.writeFileSync(outPath, output, 'utf8');
const errors = output.split(/\r?\n/).filter((line) => /error TS\d+/.test(line));

if (errors.length > 0 || result.status !== 0) {
  console.error(`Gate 1 FAILED: ${errors.length} client TypeScript error(s).`);
  errors.slice(0, 40).forEach((line) => console.error(line));
  if (errors.length > 40) console.error(`… +${errors.length - 40} more`);
  process.exit(1);
}

console.log('Gate 1 PASS: 0 client TypeScript errors.');
process.exit(0);
