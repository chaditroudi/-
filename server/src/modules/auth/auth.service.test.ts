import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "./auth.service.js";

const users: Array<Record<string, any>> = [];

const matches = (row: Record<string, any>, filter: Record<string, unknown>) =>
  Object.entries(filter).every(([key, value]) => row[key] === value);

vi.mock("../../models/auth-user.model.js", () => ({
  AuthUserModel: {
    findOne: (filter: Record<string, unknown>) => ({
      lean: () => ({
        exec: async () => {
          const row = users.find((item) => matches(item, filter));
          return row ? { ...row } : null;
        },
      }),
    }),
    updateOne: (filter: Record<string, unknown>, update: Record<string, any>) => ({
      exec: async () => {
        const row = users.find((item) => matches(item, filter));
        if (!row) return;
        Object.assign(row, update.$set || {});
        for (const [key, value] of Object.entries(update.$inc || {})) {
          row[key] = Number(row[key] || 0) + Number(value);
        }
      },
    }),
  },
}));

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
}));

vi.mock("./numeric-signature.js", () => ({
  userHasSignaturePin: () => false,
  setUserSignaturePin: vi.fn(),
  clearUserSignaturePin: vi.fn(),
}));

const service = new AuthService();
const auth = { user: { id: "user-1" } };
const CURRENT = "current-password";

describe("AuthService", () => {
  beforeEach(async () => {
    users.length = 0;
    users.push({
      id: "user-1",
      email: "a@b.c",
      passwordHash: await bcrypt.hash(CURRENT, 4),
      is_active: true,
      token_version: 3,
      must_change_password: true,
      user_metadata: { roles: ["admin"] },
    });
  });

  it("no longer offers self-registration", () => {
    expect("signUp" in service).toBe(false);
  });

  it("signs tokens with a version and without roles", async () => {
    const session = await service.signIn({ email: "a@b.c", password: CURRENT });
    const claims = jwt.decode(session.access_token) as Record<string, unknown>;
    expect(claims.tv).toBe(3);
    expect(claims.user_metadata).toBeUndefined();
    expect(session.user.must_change_password).toBe(true);
  });

  it("issues sessions for 8 hours", async () => {
    const session = await service.signIn({ email: "a@b.c", password: CURRENT });
    expect(session.expires_in).toBe(8 * 60 * 60);
  });

  it("refuses a password change with the wrong current password", async () => {
    await expect(
      service.changePassword(auth, { current_password: "wrong", new_password: "new-password-1" }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("refuses a short new password", async () => {
    await expect(
      service.changePassword(auth, { current_password: CURRENT, new_password: "short" }),
    ).rejects.toMatchObject({ code: "PASSWORD_TOO_SHORT" });
  });

  it("refuses reusing the current password", async () => {
    await expect(
      service.changePassword(auth, { current_password: CURRENT, new_password: CURRENT }),
    ).rejects.toMatchObject({ code: "PASSWORD_UNCHANGED" });
  });

  it("changes the password, ends other sessions and clears the pending flag", async () => {
    const session = await service.changePassword(auth, {
      current_password: CURRENT,
      new_password: "new-password-1",
    });

    expect(users[0].token_version).toBe(4);
    expect(users[0].must_change_password).toBe(false);
    expect(await bcrypt.compare("new-password-1", users[0].passwordHash)).toBe(true);
    expect((jwt.decode(session.access_token) as Record<string, unknown>).tv).toBe(4);
  });

  it("ends every session on logout", async () => {
    await service.logout(auth);
    expect(users[0].token_version).toBe(4);
  });
});
