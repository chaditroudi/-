/**
 * Builds the frozen bundle the browser suite runs against, and proves it cannot reach
 * production. The API path is set here rather than in a shell, where Git Bash would rewrite it.
 *
 *   node scripts/build-test-bundle.mjs <outDir> [apiUrl]
 *
 * With a local apiUrl the bundle calls the API across origins, as a deployed site does.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

import { findForbiddenBundleHosts } from "./lib/api-target-guard.mjs";

const [outDir, apiUrl = "/api"] = process.argv.slice(2);
if (!outDir) throw new Error("Usage: node scripts/build-test-bundle.mjs <outDir> [apiUrl]");

const { status } = spawnSync(
  process.execPath,
  [path.join("node_modules", "vite", "bin", "vite.js"), "build", "--outDir", outDir, "--emptyOutDir"],
  { stdio: "inherit", env: { ...process.env, VITE_BUILD_TARGET: "test", VITE_API_URL: apiUrl } },
);
if (status !== 0) process.exit(status ?? 1);

const forbidden = findForbiddenBundleHosts(outDir);
if (forbidden.length > 0) throw new Error(`The test bundle names a forbidden target:\n${forbidden.join("\n")}`);
console.log(`Test bundle in ${outDir}: API ${apiUrl}, no forbidden host.`);
