#!/usr/bin/env node
// Lists every label, button, tab, dialog title, placeholder and data hook present in a baseline inventory
// that no longer appears anywhere in the current tree. Translated strings count as present when the
// French locale holds the same text, so moving copy into t() keys is not reported as a loss.
//   node scripts/docs/parity-diff.mjs docs/evidence/tablet-first-ui/inventory-baseline-1556ff0.json [--only src/components/reception]
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const [baselinePath, ...rest] = process.argv.slice(2);
if (!baselinePath) { console.error("usage: parity-diff.mjs <baseline.json> [--only <path prefix>]"); process.exit(2); }
const only = rest[0] === "--only" ? rest[1] : null;

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const current = JSON.parse(execFileSync(process.execPath, [new URL("./feature-inventory.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), "--json"], { encoding: "utf8", maxBuffer: 64 << 20 }));

const flatten = (value, out = []) => {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object") for (const v of Object.values(value)) flatten(v, out);
  return out;
};
const norm = (s) => s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
const french = new Set(flatten(JSON.parse(readFileSync(new URL("../../src/i18n/locales/fr.json", import.meta.url), "utf8"))).map(norm));

const KINDS = ["labels", "buttons", "tabs", "dialogs", "placeholders", "serverCalls"];
const present = Object.fromEntries(KINDS.map((k) => [k, new Set(current.flatMap((f) => f[k]).map(norm))]));
const anywhere = new Set(KINDS.flatMap((k) => [...present[k]]));

let missing = 0;
for (const file of baseline) {
  if (only && !file.file.startsWith(only)) continue;
  const lost = [];
  for (const kind of KINDS) {
    for (const item of file[kind]) {
      const key = norm(item);
      if (present[kind].has(key) || (kind !== "serverCalls" && (anywhere.has(key) || french.has(key)))) continue;
      lost.push(`${kind.slice(0, -1)}: ${item}`);
    }
  }
  if (lost.length) {
    missing += lost.length;
    console.log(`\n${file.file}`);
    for (const line of lost) console.log(`  - ${line}`);
  }
}
console.log(missing ? `\n${missing} item(s) no longer found. Each must be explained in docs/plans/TABLET_FIRST_FEATURE_PARITY.md.` : "No baseline item is missing.");
process.exit(missing ? 1 : 0);
