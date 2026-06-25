import { describe, expect, it, vi } from "vitest";

import { authorizeDbAction, authorizeRpc, requireRoles, tableWritePolicy } from "./authorization.js";
import { AppError } from "../core/app-error.js";

const makeReq = (options?: {
  roles?: string[];
  domains?: string[];
  role?: string;
  table?: string;
  rpcName?: string;
}) => ({
  auth: {
    user: {
      id: "u-1",
      email: "user@example.com",
      user_metadata: {
        roles: options?.roles || [],
        domains: options?.domains || [],
        role: options?.role,
      },
    },
  },
  body: { table: options?.table },
  params: { name: options?.rpcName },
});

const runMiddleware = async (middleware: any, req: any) => {
  const next = vi.fn();
  await middleware(req, {}, next);
  return next.mock.calls[0]?.[0];
};

describe("authorization policy", () => {
  it("enforces write policy table by table", async () => {
    const tables = Object.keys(tableWritePolicy);

    for (const table of tables) {
      const allowedRoles = tableWritePolicy[table] || [];
      const allowedRole = allowedRoles[0];
      expect(allowedRole).toBeTruthy();

      const allowedError = await runMiddleware(
        authorizeDbAction("write"),
        makeReq({ roles: [allowedRole], table }),
      );
      expect(allowedError).toBeUndefined();

      const deniedError = await runMiddleware(
        authorizeDbAction("write"),
        makeReq({ roles: ["fournisseur_externe"], table }),
      );
      expect(deniedError).toBeInstanceOf(AppError);
      expect(deniedError.statusCode).toBe(403);
    }
  });

  it("allows purchasing role to write purchase_orders", async () => {
    const error = await runMiddleware(
      authorizeDbAction("write"),
      makeReq({ roles: ["responsable_achats"], table: "purchase_orders" }),
    );
    expect(error).toBeUndefined();
  });

  it("allows stock manager to write purchase_requisitions", async () => {
    const error = await runMiddleware(
      authorizeDbAction("write"),
      makeReq({ roles: ["responsable_stock"], table: "purchase_requisitions" }),
    );
    expect(error).toBeUndefined();
  });

  it("keeps stock manager blocked from writing purchase_orders", async () => {
    const error = await runMiddleware(
      authorizeDbAction("write"),
      makeReq({ roles: ["responsable_stock"], table: "purchase_orders" }),
    );
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
  });

  it("denies reception operator to write purchase_orders", async () => {
    const error = await runMiddleware(
      authorizeDbAction("write"),
      makeReq({ roles: ["operateur_reception"], table: "purchase_orders" }),
    );
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
  });

  it("allows reception operator to write receptions_v2", async () => {
    const error = await runMiddleware(
      authorizeDbAction("write"),
      makeReq({ roles: ["operateur_reception"], table: "receptions_v2" }),
    );
    expect(error).toBeUndefined();
  });

  it("denies unknown table writes for non-admin", async () => {
    const error = await runMiddleware(
      authorizeDbAction("write"),
      makeReq({ roles: ["responsable_reception"], table: "unknown_table" }),
    );
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
  });

  it("allows admin write on unknown table", async () => {
    const error = await runMiddleware(
      authorizeDbAction("write"),
      makeReq({ roles: ["administrateur_systeme"], table: "unknown_table" }),
    );
    expect(error).toBeUndefined();
  });

  it("denies non-HR user from restricted read table", async () => {
    const error = await runMiddleware(
      authorizeDbAction("read"),
      makeReq({ roles: ["responsable_achats"], table: "auth_users" }),
    );
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
  });

  it("allows HR/admin roles to read restricted tables", async () => {
    const error = await runMiddleware(
      authorizeDbAction("read"),
      makeReq({ roles: ["directeur_general"], table: "auth_users" }),
    );
    expect(error).toBeUndefined();
  });

  it("supports role aliases from domains via requireRoles", async () => {
    const error = await runMiddleware(
      requireRoles(["responsable_reception"]),
      makeReq({ domains: ["reception"] }),
    );
    expect(error).toBeUndefined();
  });

  it("allows stock role to call suggest_lots_for_picking RPC", async () => {
    const error = await runMiddleware(
      authorizeRpc,
      makeReq({ roles: ["responsable_stock"], rpcName: "suggest_lots_for_picking" }),
    );
    expect(error).toBeUndefined();
  });

  it("denies non-stock/non-reception role for suggest_lots_for_picking RPC", async () => {
    const error = await runMiddleware(
      authorizeRpc,
      makeReq({ roles: ["responsable_achats"], rpcName: "suggest_lots_for_picking" }),
    );
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
  });
});
