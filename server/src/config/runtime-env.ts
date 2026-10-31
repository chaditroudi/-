/**
 * What this server is, and which database it may touch. Pure, so tests can run it
 * without loading .env. `dev` and `test` refuse a remote database outright; `live-dev`
 * is the one deliberate development stack that runs on one.
 */

export type AppEnv = "production" | "staging" | "live-dev" | "dev" | "test";
export type DatabaseHostClass = "local" | "remote";

const APP_ENVS = new Set<AppEnv>(["production", "staging", "live-dev", "dev", "test"]);
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** Null means nothing was declared: an existing stack that has not been labelled yet. */
export const resolveAppEnv = (raw: string | undefined, nodeEnv: string): AppEnv | null => {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return nodeEnv === "production" ? "production" : null;
  if (!APP_ENVS.has(value as AppEnv)) {
    throw new Error(`Unknown APP_ENV "${raw}": use production, staging, live-dev, dev or test.`);
  }
  return value as AppEnv;
};

export const classifyDatabaseHost = (uri: string): DatabaseHostClass => {
  const authority = uri.replace(/^mongodb(\+srv)?:\/\//, "").split(/[/?]/)[0];
  const hosts = authority
    .slice(authority.lastIndexOf("@") + 1)
    .split(",")
    .map((host) => host.replace(/:\d+$/, "").toLowerCase());
  return hosts.every((host) => LOCAL_HOSTS.has(host)) ? "local" : "remote";
};

/** Returns why this server must not start, or null when it may. */
export const refuseDatabaseTarget = (appEnv: AppEnv | null, nodeEnv: string, host: DatabaseHostClass): string | null => {
  if ((appEnv === "dev" || appEnv === "test") && host === "remote") {
    return `APP_ENV=${appEnv} must use a local database. Point MONGODB_URI at a local replica set.`;
  }
  if (appEnv === "production" && nodeEnv !== "production") {
    return "APP_ENV=production needs NODE_ENV=production.";
  }
  if (appEnv !== "production" && appEnv !== null && nodeEnv === "production") {
    return `NODE_ENV=production cannot run as APP_ENV=${appEnv}.`;
  }
  return null;
};

/** Demo records belong on disposable local databases and nowhere else. */
export const shouldSeedDemoData = (appEnv: AppEnv | null, host: DatabaseHostClass) =>
  host === "local" && (appEnv === "dev" || appEnv === "test" || appEnv === null);

/** Printed at startup so an unlabelled stack on a remote database cannot go unnoticed. */
export const describeUnlabelledTarget = (appEnv: AppEnv | null, host: DatabaseHostClass) =>
  appEnv === null && host === "remote"
    ? "APP_ENV is not set and the database is remote. Demo data is off. Set APP_ENV=live-dev to state this is deliberate."
    : null;
