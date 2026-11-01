import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { seedDatabase } from "./seed.js";

const users: Array<Record<string, any>> = [];
const created: string[] = [];
const updateOne = vi.fn();

vi.mock("./models/auth-user.model.js", () => ({
  AuthUserModel: {
    findOne: (filter: Record<string, any>) => ({
      lean: () => ({
        exec: async () => {
          const roles = filter["user_metadata.roles"]?.$in as string[];
          return users.find((row) => row.user_metadata.roles.some((role: string) => roles.includes(role))) ?? null;
        },
      }),
    }),
    create: vi.fn(async (row: Record<string, any>) => {
      users.push(row);
      return row;
    }),
    updateOne: (...args: unknown[]) => {
      updateOne(...args);
      return { exec: async () => null };
    },
  },
}));

vi.mock("./db/dynamic-model.js", () => ({
  getCollectionModel: (collection: string) => ({
    findOne: () => ({ lean: () => ({ exec: async () => null }) }),
    create: async () => {
      created.push(collection);
    },
  }),
}));

vi.mock("./db/defaults.js", () => ({
  prepareInsertDocument: async (_collection: string, row: Record<string, unknown>) => ({ id: "row-id", ...row }),
}));

describe("seedDatabase", () => {
  beforeEach(() => {
    users.length = 0;
    created.length = 0;
    updateOne.mockClear();
    vi.stubEnv("INITIAL_ADMIN_EMAIL", "Owner@Plant.test");
    vi.stubEnv("INITIAL_ADMIN_PASSWORD", "first-password-1");
    vi.stubEnv("NODE_ENV", "development");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("writes demo records to a local database", async () => {
    await seedDatabase();
    expect(created).toEqual(expect.arrayContaining(["suppliers", "products"]));
  });

  it("never writes demo records to a remote database, whatever else is set", async () => {
    vi.stubEnv("MONGODB_URI", "mongodb+srv://user:secret@cluster0.example.mongodb.net/app");
    await seedDatabase();
    expect(created).not.toContain("suppliers");
    expect(created).not.toContain("products");
    expect(created).not.toContain("stock_locations");
  });

  it("creates the first admin from the environment and forces a password change", async () => {
    await seedDatabase();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      email: "owner@plant.test",
      must_change_password: true,
      is_active: true,
      user_metadata: { roles: ["administrateur_systeme"] },
    });
    expect(users[0].passwordHash).not.toContain("first-password-1");
  });

  it("creates no admin without the environment values", async () => {
    vi.stubEnv("INITIAL_ADMIN_PASSWORD", "");
    await seedDatabase();
    expect(users).toHaveLength(0);
  });

  it("refuses a short initial password", async () => {
    vi.stubEnv("INITIAL_ADMIN_PASSWORD", "short");
    await seedDatabase();
    expect(users).toHaveLength(0);
  });

  it("never modifies an existing admin", async () => {
    users.push({ email: "boss@plant.test", is_active: false, user_metadata: { roles: ["administrateur_systeme"] } });
    await seedDatabase();
    expect(users).toHaveLength(1);
    expect(users[0].is_active).toBe(false);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("seeds demo data outside production", async () => {
    await seedDatabase();
    expect(created).toContain("suppliers");
  });

  it("seeds configuration but no demo data in production", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");
    await seedDatabase();
    expect(created).toContain("production_step_definitions");
    expect(created).not.toContain("suppliers");
    expect(created).not.toContain("products");
  });
});
