import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "../config/env.js";
import { clearAuthCache, invalidateAuthCache, resolveAuthToken } from "./auth.js";

const users = new Map<string, Record<string, unknown>>();
const findOne = vi.fn(({ id }: { id: string }) => ({
  lean: () => ({
    exec: async () => {
      const user = users.get(id);
      return user ? { ...user } : null;
    },
  }),
}));

vi.mock("../models/auth-user.model.js", () => ({
  AuthUserModel: { findOne: (...args: [{ id: string }]) => findOne(...args) },
}));

const sign = (claims: Record<string, unknown>, secret = env.jwtSecret) =>
  jwt.sign({ email: "a@b.c", tenant_id: "company-a", factory_id: "site-a", ...claims }, secret, { subject: "user-1", expiresIn: 3600 });

describe("resolveAuthToken", () => {
  beforeEach(() => {
    clearAuthCache();
    findOne.mockClear();
    users.clear();
    users.set("user-1", {
      id: "user-1",
      email: "a@b.c",
      is_active: true,
      token_version: 2,
      tenant_id: "company-a",
      factory_id: "site-a",
      user_metadata: { roles: ["operateur_reception"] },
    });
  });

  afterEach(() => vi.useRealTimers());

  it("rejects a token signed with another secret", async () => {
    await expect(resolveAuthToken(sign({ tv: 2 }, "forged-secret"))).resolves.toBeNull();
  });

  it("takes roles from the database, never from the token", async () => {
    const auth = await resolveAuthToken(sign({ tv: 2, user_metadata: { roles: ["admin"] } }));
    expect(auth?.user.user_metadata).toEqual({ roles: ["operateur_reception"] });
  });

  it("rejects a token issued before the version was bumped", async () => {
    await expect(resolveAuthToken(sign({ tv: 1 }))).resolves.toBeNull();
  });

  it("treats a token with no version as version zero", async () => {
    users.get("user-1")!.token_version = 0;
    await expect(resolveAuthToken(sign({}))).resolves.not.toBeNull();
  });

  it("rejects an unknown user", async () => {
    users.clear();
    await expect(resolveAuthToken(sign({ tv: 2 }))).resolves.toBeNull();
  });

  it("revokes a deactivated session on its next use across processes", async () => {
    const token = sign({ tv: 2 });
    await expect(resolveAuthToken(token)).resolves.not.toBeNull();

    users.get("user-1")!.is_active = false;
    await expect(resolveAuthToken(token)).resolves.toBeNull();
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it("applies a role change at once when the cache is invalidated", async () => {
    const token = sign({ tv: 2 });
    await resolveAuthToken(token);
    users.get("user-1")!.user_metadata = { roles: ["chef_reception"] };
    invalidateAuthCache("user-1");
    const auth = await resolveAuthToken(token);
    expect(auth?.user.user_metadata).toEqual({ roles: ["chef_reception"] });
  });

  it("fails closed when the database read throws", async () => {
    findOne.mockImplementationOnce(() => {
      throw new Error("database unavailable");
    });
    await expect(resolveAuthToken(sign({ tv: 2 }))).resolves.toBeNull();
  });

  it("reports a pending password change", async () => {
    users.get("user-1")!.must_change_password = true;
    const auth = await resolveAuthToken(sign({ tv: 2 }));
    expect(auth?.mustChangePassword).toBe(true);
  });

  it("rejects an account without an assigned factory", async () => {
    delete users.get("user-1")!.factory_id;
    await expect(resolveAuthToken(sign({ tv: 2 }))).resolves.toBeNull();
  });

  it("rejects a token for a different company or factory", async () => {
    await expect(resolveAuthToken(sign({ tv: 2, tenant_id: "company-b" }))).resolves.toBeNull();
    await expect(resolveAuthToken(sign({ tv: 2, factory_id: "site-b" }))).resolves.toBeNull();
  });

  it("revokes old sessions immediately when factory membership changes", async () => {
    const token = sign({ tv: 2 });
    await expect(resolveAuthToken(token)).resolves.not.toBeNull();
    users.get("user-1")!.factory_id = "site-b";
    await expect(resolveAuthToken(token)).resolves.toBeNull();
  });
});
