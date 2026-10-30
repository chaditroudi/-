const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export const parseAllowedOrigins = (value: string | undefined) =>
  String(value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

const isLocalOrigin = (origin: string) => {
  try {
    return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
};

/** Requests without an Origin header are not browser cross-site requests. */
export const isAllowedOrigin = (origin: string | undefined, allowed: string[], nodeEnv: string) => {
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  return nodeEnv !== "production" && isLocalOrigin(origin);
};
