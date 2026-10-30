import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsService } from "./settings.service.js";

const users: Array<Record<string, any>> = [];
const inserted: Record<string, Array<Record<string, unknown>>> = {};
const invalidate = vi.fn();

vi.mock("../../models/auth-user.model.js", () => ({
  AuthUserModel: {
    findOne: (filter: Record<string, unknown>) => {
      const row = users.find((item) => item.email === filter.email || item.id === filter.id) ?? null;
      const lean = () => ({ exec: async () => row });
      return { lean, select: () => ({ lean }) };
    },
    updateOne: (filter: Record<string, unknown>, update: Record<string, any>) => ({
      exec: async () => {
        const row = users.find((item) => item.id === filter.id);
        if (row) Object.assign(row, update.$set || {});
      },
    }),
    create: vi.fn(async (row: Record<string, any>) => {
      users.push(row);
      return row;
    }),
  },
}));

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => ({
    create: async (rows: Array<Record<string, unknown>>) => {
      inserted[collection] = [...(inserted[collection] || []), ...rows];
    },
    updateOne: () => ({ exec: async () => null }),
    deleteMany: () => ({ exec: async () => null }),
    insertMany: async () => null,
  }),
}));

vi.mock("../../db/defaults.js", () => ({
  prepareInsertDocument: async (_collection: string, row: Record<string, unknown>) => ({ id: "row-id", ...row }),
}));

vi.mock("../../middleware/auth.js", () => ({
  invalidateAuthCache: (id: string) => invalidate(id),
}));

vi.mock("../../models/site-settings.model.js", () => ({
  SiteSettingsModel: { findOne: () => ({ lean: () => ({ exec: async () => null }) }) },
}));

const service = new SettingsService();
const valid = {
  email: "New.User@Plant.test",
  password: "first-password-1",
  full_name: "New User",
  role: "operateur_reception",
};

describe("managed users", () => {
  beforeEach(() => {
    users.length = 0;
    invalidate.mockClear();
    Object.keys(inserted).forEach((key) => delete inserted[key]);
  });

  it("creates the account, profile and role row", async () => {
    const user = await service.createManagedUser(valid, "admin-1");
    expect(user).toMatchObject({ email: "new.user@plant.test", roles: ["operateur_reception"] });
    expect(user).not.toHaveProperty("passwordHash");
    expect(users[0].is_active).toBe(true);
    expect(inserted.profiles).toHaveLength(1);
    expect(inserted.user_roles[0]).toMatchObject({ role: "operateur_reception", assigned_by: "admin-1" });
  });

  it("rejects an unknown role", async () => {
    await expect(service.createManagedUser({ ...valid, role: "super_admin" }, "admin-1"))
      .rejects.toMatchObject({ code: "UNKNOWN_ROLE" });
  });

  it("rejects a missing role", async () => {
    await expect(service.createManagedUser({ ...valid, role: "" }, "admin-1"))
      .rejects.toMatchObject({ code: "UNKNOWN_ROLE" });
  });

  it("rejects a short password", async () => {
    await expect(service.createManagedUser({ ...valid, password: "short" }, "admin-1"))
      .rejects.toMatchObject({ code: "PASSWORD_TOO_SHORT" });
  });

  it("rejects an invalid email", async () => {
    await expect(service.createManagedUser({ ...valid, email: "nope" }, "admin-1"))
      .rejects.toMatchObject({ code: "INVALID_EMAIL" });
  });

  it("rejects a duplicate email", async () => {
    await service.createManagedUser(valid, "admin-1");
    await expect(service.createManagedUser(valid, "admin-1"))
      .rejects.toMatchObject({ code: "AUTH_EMAIL_EXISTS" });
  });

  it("rejects an unknown role on update", async () => {
    await expect(service.updateUser("user-1", { roles: ["super_admin"] }))
      .rejects.toMatchObject({ code: "UNKNOWN_ROLE" });
  });

  it("applies an account change at once", async () => {
    users.push({ id: "user-1", email: "a@b.c", user_metadata: {} });
    await service.updateUser("user-1", { is_active: false });
    expect(invalidate).toHaveBeenCalledWith("user-1");
  });
});
