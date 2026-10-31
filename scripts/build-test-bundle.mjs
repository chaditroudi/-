/**
 * Builds the frozen bundle the browser suite runs against, and proves it cannot reach
 * production. The API path is set here rather than in a shell, where Git Bash would rewrite it.
 *
 *   node scripts/build-test-bundle.mjs <outDir>
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

import { findForbiddenBundleHosts } from "./lib/api-target-guard.mjs";

const outDir = process.argv[2];
if (!outDir) throw new Error("Usage: node scripts/build-test-bundle.mjs <outDir>");

const { status } = spawnSync(
  process.execPath,
  [path.join("node_modules", "vite", "bin", "vite.js"), "build", "--outDir", outDir, "--emptyOutDir"],
  { stdio: "inherit", env: { ...process.env, VITE_BUILD_TARGET: "test", VITE_API_URL: "/api" } },
);
if (status !== 0) process.exit(status ?? 1);

const forbidden = findForbiddenBundleHosts(outDir);
if (forbidden.length > 0) throw new Error(`The test bundle names a forbidden target:\n${forbidden.join("\n")}`);
console.log(`Test bundle in ${outDir}: same-origin API, no forbidden host.`);
