import { describe, expect, it } from 'vitest';
import { parseApiUrl, refuseBuildTarget, resolveApiBaseUrl, resolveBuildTarget } from './apiTarget';

const LIVE = 'https://api-production.up.railway.app/api';

describe('parseApiUrl', () => {
  it('accepts a same-origin path and trims its slash', () => {
    expect(parseApiUrl('/api/')).toEqual({ ok: true, url: '/api', kind: 'relative' });
  });

  it('tells a local API from a remote one', () => {
    expect(parseApiUrl('http://127.0.0.1:4131/api')).toMatchObject({ ok: true, kind: 'local' });
    expect(parseApiUrl(LIVE)).toMatchObject({ ok: true, kind: 'remote' });
  });

  it.each(['', '   ', undefined, null])('refuses a missing value: %j', (value) => {
    expect(parseApiUrl(value).ok).toBe(false);
  });

  it.each(['C:/Program Files/Git/api', 'C:\\Program Files\\Git\\api'])('names the Git Bash rewrite: %s', (value) => {
    const parsed = parseApiUrl(value);
    expect(parsed).toMatchObject({ ok: false });
    expect(!parsed.ok && parsed.reason).toMatch(/Git Bash/);
  });

  it.each(['api', 'ftp://host/api', '//host/api', 'not a url'])('refuses an invalid value: %s', (value) => {
    expect(parseApiUrl(value).ok).toBe(false);
  });
});

describe('resolveApiBaseUrl', () => {
  it('stays on this origin when the value is missing or invalid', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('/api');
    expect(resolveApiBaseUrl('C:/Program Files/Git/api')).toBe('/api');
  });

  it('uses a configured production host', () => {
    expect(resolveApiBaseUrl(LIVE)).toBe(LIVE);
  });
});

describe('resolveBuildTarget', () => {
  it('treats anything but a production mode as a test build', () => {
    expect(resolveBuildTarget(undefined, 'development')).toBe('test');
    expect(resolveBuildTarget(undefined, 'production')).toBe('production');
    expect(resolveBuildTarget('staging', 'production')).toBe('staging');
  });

  it('refuses an unknown target', () => {
    expect(resolveBuildTarget('prod', 'production')).toBeNull();
  });
});

describe('refuseBuildTarget', () => {
  it.each(['test', 'staging', 'production'] as const)('refuses a %s build with no API', (target) => {
    expect(refuseBuildTarget(undefined, target)).toMatch(/must name its API/);
  });

  it('allows a test build only on this origin or a local API', () => {
    expect(refuseBuildTarget('/api', 'test')).toBeNull();
    expect(refuseBuildTarget('http://127.0.0.1:4131/api', 'test')).toBeNull();
    expect(refuseBuildTarget(LIVE, 'test')).toMatch(/test build/);
  });

  it('allows staging only on a host marked as a test environment', () => {
    expect(refuseBuildTarget('https://api-staging.example.com/api', 'staging')).toBeNull();
    expect(refuseBuildTarget(LIVE, 'staging')).toMatch(/staging build/);
  });

  it('keeps the production deployment working and refuses a local or plain target', () => {
    expect(refuseBuildTarget(LIVE, 'production')).toBeNull();
    expect(refuseBuildTarget('/api', 'production')).toBeNull();
    expect(refuseBuildTarget('http://127.0.0.1:4000/api', 'production')).toMatch(/https/);
    expect(refuseBuildTarget('http://api.example.com/api', 'production')).toMatch(/https/);
  });
});
