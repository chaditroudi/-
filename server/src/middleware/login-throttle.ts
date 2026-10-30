import { AppError } from "../core/app-error.js";

export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 10_000;

const failures = new Map<string, { count: number; firstAt: number }>();

const liveEntry = (key: string) => {
  const entry = failures.get(key);
  if (!entry) return null;
  if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    failures.delete(key);
    return null;
  }
  return entry;
};

export const assertLoginAllowed = (key: string) => {
  const entry = liveEntry(key);
  if (entry && entry.count >= LOGIN_MAX_FAILURES) {
    throw new AppError(429, "LOGIN_RATE_LIMITED", "Trop de tentatives. Réessayez dans 15 minutes.");
  }
};

export const recordLoginFailure = (key: string) => {
  if (failures.size >= MAX_TRACKED_KEYS) failures.clear();
  const entry = liveEntry(key);
  if (entry) entry.count += 1;
  else failures.set(key, { count: 1, firstAt: Date.now() });
};

export const clearLoginFailures = (key: string) => {
  failures.delete(key);
};

export const resetLoginThrottle = () => {
  failures.clear();
};
