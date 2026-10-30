import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertLoginAllowed,
  clearLoginFailures,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  recordLoginFailure,
  resetLoginThrottle,
} from "./login-throttle.js";

describe("login throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetLoginThrottle();
  });
  afterEach(() => vi.useRealTimers());

  const fail = (times: number, key = "ip|a@b.c") => {
    for (let i = 0; i < times; i += 1) recordLoginFailure(key);
  };

  it("allows attempts below the limit", () => {
    fail(LOGIN_MAX_FAILURES - 1);
    expect(() => assertLoginAllowed("ip|a@b.c")).not.toThrow();
  });

  it("blocks at the limit with a 429", () => {
    fail(LOGIN_MAX_FAILURES);
    expect(() => assertLoginAllowed("ip|a@b.c")).toThrow(expect.objectContaining({ statusCode: 429 }));
  });

  it("does not block another account", () => {
    fail(LOGIN_MAX_FAILURES);
    expect(() => assertLoginAllowed("ip|other@b.c")).not.toThrow();
  });

  it("lifts the block after the window", () => {
    fail(LOGIN_MAX_FAILURES);
    vi.advanceTimersByTime(LOGIN_WINDOW_MS + 1);
    expect(() => assertLoginAllowed("ip|a@b.c")).not.toThrow();
  });

  it("clears failures after a successful sign-in", () => {
    fail(LOGIN_MAX_FAILURES);
    clearLoginFailures("ip|a@b.c");
    expect(() => assertLoginAllowed("ip|a@b.c")).not.toThrow();
  });
});
