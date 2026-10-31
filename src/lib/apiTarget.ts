/**
 * Where the client sends its API calls. There is deliberately no built-in host: a build
 * names its target, so a test build can never reach production by leaving a variable unset.
 * vite.config.ts imports this too, so it must stay free of browser APIs and `@/` aliases.
 */

export type BuildTarget = 'test' | 'staging' | 'production';

type ParsedApiUrl =
  | { ok: true; url: string; kind: 'relative' | 'local' | 'remote' }
  | { ok: false; reason: string };

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const STAGING_LABEL = /(^|[.-])(staging|preview|dev|test|qa|sandbox)([.-]|$)/i;

export const parseApiUrl = (raw: string | undefined | null): ParsedApiUrl => {
  const value = (raw ?? '').trim();
  if (!value) return { ok: false, reason: 'VITE_API_URL is not set.' };
  if (/^[a-z]:[\\/]/i.test(value) || /program files/i.test(value)) {
    return {
      ok: false,
      reason: `VITE_API_URL is the file path "${value}". Git Bash rewrote "/api": use "npm run build:test", or set MSYS_NO_PATHCONV=1.`,
    };
  }
  if (value.startsWith('//')) return { ok: false, reason: `VITE_API_URL "${value}" is ambiguous: give a scheme or one leading slash.` };
  if (value.startsWith('/')) return { ok: true, url: value.replace(/\/$/, ''), kind: 'relative' };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: `VITE_API_URL "${value}" is neither a path nor a URL.` };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: `VITE_API_URL must use http or https, not ${url.protocol}` };
  }
  return { ok: true, url: value.replace(/\/$/, ''), kind: LOCAL_HOSTS.has(url.hostname) ? 'local' : 'remote' };
};

/** At runtime a bad or missing value falls back to same-origin, which can only reach this site. */
export const resolveApiBaseUrl = (raw: string | undefined | null) => {
  const parsed = parseApiUrl(raw);
  return parsed.ok ? parsed.url : '/api';
};

export const resolveBuildTarget = (raw: string | undefined | null, mode: string): BuildTarget | null => {
  const value = (raw ?? '').trim() || (mode === 'production' ? 'production' : 'test');
  return value === 'test' || value === 'staging' || value === 'production' ? value : null;
};

/** Returns why this build must not be produced, or null when it may. */
export const refuseBuildTarget = (raw: string | undefined | null, target: BuildTarget): string | null => {
  const parsed = parseApiUrl(raw);
  if (!parsed.ok) return `${parsed.reason} A ${target} build must name its API.`;
  if (parsed.kind === 'relative') return null;

  const { hostname, protocol } = new URL(parsed.url);
  if (target === 'test') {
    return parsed.kind === 'local' ? null : `A test build may only use a same-origin path or a local API, not ${hostname}.`;
  }
  if (target === 'staging' && !STAGING_LABEL.test(hostname)) {
    return `A staging build needs a host marked as a test environment (staging, preview, dev, test, qa, sandbox), not ${hostname}.`;
  }
  if (target === 'production' && (parsed.kind === 'local' || protocol !== 'https:')) {
    return `A production build needs an https API, not ${parsed.url}.`;
  }
  return null;
};

const LIVE_DEV_PORT = 8080;
const LIVE_DEV_API_PORT = "4000";

/**
 * The API on :4000 runs on live data, so only the :8080 stack may proxy to it. Any other
 * dev server must name a target, because it looks identical and writes wherever it points.
 */
export const refuseDevProxy = (port: number, explicitTarget: string | undefined): string | null => {
  if (port === LIVE_DEV_PORT) return null;
  const target = (explicitTarget ?? '').trim();
  if (!target) return `A dev server on port ${port} must set VITE_API_PROXY_TARGET: the default is the live development API.`;
  if (new URL(target).port === LIVE_DEV_API_PORT) return `A dev server on port ${port} may not use the live development API (${target}).`;
  return null;
};
