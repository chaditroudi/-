/**
 * Demo and smoke scripts write real records through the API, and the dev API on
 * :4000 runs against whatever .env points at. So there is no default target: a
 * script must be told which API to use, and only a separate local one is allowed.
 */

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
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
