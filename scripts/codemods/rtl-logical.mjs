#!/usr/bin/env node
// Rewrites physical Tailwind spacing/position classes to logical ones so layouts mirror in Arabic.
//   ml-2 → ms-2, pr-4 → pe-4, left-3 → start-3, text-right → text-end, border-l → border-s, rounded-r-lg → rounded-e-lg …
// Safety rules:
// - only quoted strings in which EVERY word looks like a Tailwind class are touched (French text, HTML and code are not);
// - `class="…"` (HTML built for printing) and id/htmlFor/key/name/test-id values are never touched, and print*.ts files plus ui/sidebar.tsx are skipped;
// - strings that slide or translate on the x axis keep their physical left/right (centering, sheets, animations);
// - left-1/2 and right-1/2 (centering) stay physical.
//   node scripts/codemods/rtl-logical.mjs            → dry run, prints counts
//   node scripts/codemods/rtl-logical.mjs --write    → rewrites files, preserving CRLF
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

const root = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const write = process.argv.includes("--write");
const SKIP_FILES = new Set(["src/components/ui/sidebar.tsx", "src/components/ui/chart.tsx", "src/lib/fichesTechniques.ts"]);

const MAP = {
  ml: "ms", mr: "me", pl: "ps", pr: "pe", "scroll-ml": "scroll-ms", "scroll-mr": "scroll-me", "scroll-pl": "scroll-ps", "scroll-pr": "scroll-pe",
  left: "start", right: "end", "text-left": "text-start", "text-right": "text-end",
  "border-l": "border-s", "border-r": "border-e",
  "rounded-l": "rounded-s", "rounded-r": "rounded-e", "rounded-tl": "rounded-ss", "rounded-tr": "rounded-se", "rounded-bl": "rounded-es", "rounded-br": "rounded-ee",
};
const UTIL = Object.keys(MAP).sort((a, b) => b.length - a.length).map((u) => u.replace(/-/g, "\\-")).join("|");
const TOKEN = new RegExp(`^((?:[^\\s:]+:)*)(!?)(-?)(${UTIL})(-[^\\s]*)?$`);
// A word that could be a Tailwind class (variants, arbitrary values, fractions, opacity…).
const CLASSY = /^[!-]?[a-z0-9@&>*_\[\]\/.:%#(),=+-]+$/i;

const convertToken = (token, allowX) => {
  const m = TOKEN.exec(token);
  if (!m) return token;
  const [, variants, important, negative, util, rest = ""] = m;
  const needsValue = ["ml", "mr", "pl", "pr", "scroll-ml", "scroll-mr", "scroll-pl", "scroll-pr", "left", "right"].includes(util);
  if (needsValue && !rest) return token;
  if ((util === "left" || util === "right") && (!allowX || rest === "-1/2")) return token;
  return `${variants}${important}${negative}${MAP[util]}${rest}`;
};

const convertList = (text) => {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length || !words.every((w) => CLASSY.test(w))) return text;
  if (!words.some((w) => /[a-z]/i.test(w) && /-/.test(w))) return text; // a lone word is not a class list
  const allowX = !/(?:^|[\s:])(-?translate-x|slide-(?:in|out)-from-(?:left|right)|inset-x)/.test(text);
  return text.replace(/[^\s]+/g, (w) => convertToken(w, allowX));
};

// Quoted segments with no line breaks, braces or angle brackets; template parts split around ${…}.
const SEGMENT = /((?:class|id|htmlFor|key|name|data-testid|aria-controls|aria-labelledby|aria-describedby|form)=)?(["'])([^"'\n<>{}]*)\2|`([^`\n<>{}$]*)(?=`|\$\{)|\}([^`\n<>{}$]*)(?=`|\$\{)/g;

const transform = (src) => {
  let changed = 0;
  const out = src.replace(SEGMENT, (all, htmlClass, quote, quoted, tplHead, tplTail) => {
    if (htmlClass) return all;
    const body = quoted ?? tplHead ?? tplTail ?? "";
    const next = convertList(body);
    if (next === body) return all;
    changed += body.split(/\s+/).filter((w, i) => w !== next.split(/\s+/)[i]).length;
    if (quoted !== undefined) return `${quote}${next}${quote}`;
    if (tplHead !== undefined) return "`" + next;
    return "}" + next;
  });
  return { out, changed };
};

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    if (!/\.(tsx?|jsx?)$/.test(name) || /\.test\./.test(name) || /^print/i.test(basename(name))) continue;
    if (SKIP_FILES.has(relative(root, path).split(sep).join("/"))) continue;
    files.push(path);
  }
};
walk(join(root, "src"));

let total = 0, touched = 0;
for (const path of files) {
  const raw = readFileSync(path, "utf8");
  const crlf = raw.includes("\r\n");
  const { out, changed } = transform(raw.replace(/\r\n/g, "\n"));
  if (!changed) continue;
  total += changed; touched += 1;
  if (write) writeFileSync(path, crlf ? out.replace(/\n/g, "\r\n") : out);
  else if (process.argv.includes("--verbose")) console.log(`${changed}\t${relative(root, path)}`);
}
console.log(`${write ? "Rewrote" : "Would rewrite"} ${total} classes in ${touched} files.`);
