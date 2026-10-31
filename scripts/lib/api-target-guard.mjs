/**
 * Demo and smoke scripts write real records through the API, and the dev API on
 * :4000 runs against whatever .env points at. So there is no default target: a
 * script must be told which API to use, and only a separate local one is allowed.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const FORBIDDEN_IN_TEST_BUNDLE = [/\.railway\.app/i, /program files[\\/]git/i];
const DEVELOPMENT_PORTS = new Set(["4000", "8080"]);

export const resolveTestApi = (value = process.env.SMOKE_API_URL) => {
  if (!value) throw new Error("A test API URL is required (SMOKE_API_URL, or API_URL for simulators); these scripts have no default target.");

  const url = new URL(value);
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing ${url.hostname}: these scripts run only against a local test API.`);
  }
  if (DEVELOPMENT_PORTS.has(url.port || "80")) {
    throw new Error(`Refusing port ${url.port}: it is the development stack. Start a test API on another port.`);
  }
  return value.replace(/\/$/, "");
};

const filesUnder = (dir) => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? filesUnder(full) : [full];
});

/** Text files in a built bundle that name a live host, or a path Git Bash rewrote. */
export const findForbiddenBundleHosts = (dir) => filesUnder(dir)
  .filter((file) => /\.(js|mjs|html|css|json|webmanifest|map)$/.test(file))
  .flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return FORBIDDEN_IN_TEST_BUNDLE.filter((pattern) => pattern.test(text)).map((pattern) => `${file}: ${pattern}`);
  });
