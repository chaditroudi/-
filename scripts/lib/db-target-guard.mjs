/**
 * Refuses to run a maintenance script against a remote database by accident.
 * A remote target needs both --i-know and --confirm-db=<database name>.
 */

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

const hostsOf = (uri) => {
  const withoutScheme = String(uri).replace(/^mongodb(\+srv)?:\/\//, "");
  const authority = withoutScheme.split(/[/?]/)[0];
  const hosts = authority.slice(authority.lastIndexOf("@") + 1);
  return hosts.split(",").map((host) => host.replace(/:\d+$/, ""));
};

/** Host names only, safe to print: never includes credentials. */
export const describeHosts = (uri) => hostsOf(uri).join(",");

export const assertSafeDbTarget = ({ uri, dbName, argv = process.argv.slice(2) }) => {
  if (!uri) throw new Error("MONGODB_URI is required; this script has no default target.");

  const isLocal = hostsOf(uri).every((host) => LOCAL_HOSTS.has(host));
  if (isLocal) return { isLocal };

  const hosts = describeHosts(uri);
  if (!argv.includes("--i-know")) {
    throw new Error(`Refusing remote database ${hosts}: pass --i-know and --confirm-db=<database name>.`);
  }
  if (!argv.includes(`--confirm-db=${dbName}`)) {
    throw new Error(`Refusing remote database ${hosts}: --confirm-db must equal the target database name.`);
  }
  return { isLocal };
};
