// @vitest-environment node
import type { ExecutionContext, INestApplication } from "@nestjs/common";
import { ModulesContainer, Reflector } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { clearAuthCache } from "../middleware/auth.js";
import { ALL_ROLES } from "../middleware/authorization.js";
import { RolesGuard } from "./route-guards.js";
import { ANY_ROLE_KEY, IS_PUBLIC_KEY, ROLES_KEY } from "./route-metadata.js";

const users = new Map<string, Record<string, unknown>>();
const factory = { tenant_id: "matrix-company", factory_id: "matrix-site" };
// This suite exercises route authorization without infrastructure. Real namespaces/indexes
// are exercised separately in gate3.http.integration.test.ts.
vi.mock("../db/indexes.js", () => ({ ensureTrustIndexes: async () => undefined }));
vi.mock("../db/factory-context.js", async (original) => ({
  ...await original<object>(), factoryConnection: () => ({ db: {}, models: {}, model: () => { throw new Error("No database in route authorization matrix"); } }),
}));

vi.mock("../models/auth-user.model.js", () => ({
  AuthUserModel: {
    findOne: ({ id }: { id: string }) => ({
      lean: () => ({
        exec: async () => {
          const user = users.get(id);
          return user ? { ...user } : null;
        },
      }),
    }),
  },
}));

vi.mock("../db/mongoose.js", async (original) => ({
  ...(await original<object>()),
  isDatabaseConnected: () => true,
}));

vi.mock("../middleware/security-audit.js", async (original) => ({
  ...(await original<object>()),
  appendDeniedAccessAudit: async () => undefined,
}));

const PUBLIC_ROUTES = [
  "GET /api/auth/session",
  "GET /api/health",
  "GET /api/realtime/events",
  "GET /api/settings",
  "GET /health",
  "POST /api/auth/signin",
  "POST /api/ccp-sensors/readings",
  "POST /api/weighbridge/readings",
];

const ANY_ROLE_ROUTES = [
  "DELETE /api/auth/signature-pin",
  "GET /api/notifications",
  "GET /api/notifications/stats",
  "GET /api/notifications/summary",
  "PATCH /api/notifications/:id/read",
  "POST /api/auth/change-password",
  "POST /api/auth/logout",
  "POST /api/auth/signature-pin",
  "POST /api/notifications/mark-all-read",
  "POST /api/realtime/ticket",
  "POST /api/rpc/:name",
];

const ADMIN_ROLES = new Set(["admin", "administrateur_systeme", "directeur_general", "directeur_usine"]);
const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "ALL", "OPTIONS", "HEAD"];

type Route = {
  key: string;
  method: string;
  path: string;
  handler: (...args: unknown[]) => unknown;
  controller: new (...args: unknown[]) => unknown;
  isPublic: boolean;
  anyRole: boolean;
  roles: string[];
};

const joinPath = (...parts: unknown[]) =>
  `/${parts.flat().filter((part) => part && part !== "/").join("/")}`.replace(/\/+/g, "/");

const readRouteTable = (app: INestApplication) => {
  const routes: Route[] = [];
  for (const moduleRef of app.get(ModulesContainer).values()) {
    for (const { metatype } of moduleRef.controllers.values()) {
      const controller = metatype as Route["controller"];
      const prototype = controller.prototype as Record<string, Route["handler"]>;
      for (const name of Object.getOwnPropertyNames(prototype)) {
        const handler = prototype[name];
        if (name === "constructor" || typeof handler !== "function") continue;
        if (!Reflect.hasMetadata("path", handler)) continue;

        const read = <T>(key: string) =>
          (Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller)) as T | undefined;
        const method = HTTP_METHODS[Reflect.getMetadata("method", handler) as number];
        const path = joinPath(Reflect.getMetadata("path", controller), Reflect.getMetadata("path", handler));
        routes.push({
          key: `${method} ${path}`,
          method,
          path,
          handler,
          controller,
          isPublic: Boolean(read(IS_PUBLIC_KEY)),
          anyRole: Boolean(read(ANY_ROLE_KEY)),
          roles: read<string[]>(ROLES_KEY) ?? [],
        });
      }
    }
  }
  return routes;
};

const tokenFor = (id: string, tv = 0) => jwt.sign({ email: `${id}@test.local`, tv, ...factory }, env.jwtSecret, { subject: id, expiresIn: 3600 });

const addUser = (id: string, roles: string[], extra: Record<string, unknown> = {}) => {
  users.set(id, { id, email: `${id}@test.local`, ...factory, is_active: true, user_metadata: { roles }, ...extra });
  return tokenFor(id);
};

describe("authorization matrix", () => {
  let app: INestApplication;
  let baseUrl: string;
  let routes: Route[];

  const call = (method: string, path: string, token?: string, body?: unknown) =>
    fetch(`${baseUrl}${path.replace(/:\w+/g, "x")}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  const inBatches = async <T>(items: T[], run: (item: T) => Promise<void>) => {
    for (let i = 0; i < items.length; i += 25) await Promise.all(items.slice(i, i + 25).map(run));
  };

  beforeAll(async () => {
    app = await createApp();
    await app.listen(0, "127.0.0.1");
    baseUrl = (await app.getUrl()).replace("[::1]", "127.0.0.1");
    routes = readRouteTable(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    users.clear();
    clearAuthCache();
  });

  it("reads the whole route table", () => {
    expect(routes.length).toBeGreaterThan(400);
  });

  it("gives every route an explicit decision", () => {
    const undecided = routes.filter((route) => !route.isPublic && !route.anyRole && route.roles.length === 0);
    expect(undecided.map((route) => route.key)).toEqual([]);
  });

  it("keeps public routes to the agreed list", () => {
    expect(routes.filter((route) => route.isPublic).map((route) => route.key).sort()).toEqual([...PUBLIC_ROUTES].sort());
  });

  it("keeps any-role routes to the agreed list", () => {
    expect(routes.filter((route) => route.anyRole).map((route) => route.key).sort()).toEqual([...ANY_ROLE_ROUTES].sort());
  });

  it("answers 401 on every non-public route without a token", async () => {
    const wrong: string[] = [];
    await inBatches(routes.filter((route) => !route.isPublic), async (route) => {
      const response = await call(route.method, route.path);
      if (response.status !== 401) wrong.push(`${route.key} -> ${response.status}`);
    });
    expect(wrong).toEqual([]);
  }, 60_000);

  it("answers 403 on every role-gated route for a role outside its list", async () => {
    const tokens = new Map(ALL_ROLES.map((role) => [role, addUser(`user-${role}`, [role])]));
    const wrong: string[] = [];
    await inBatches(routes.filter((route) => route.roles.length > 0), async (route) => {
      const outsider = ALL_ROLES.find((role) => !ADMIN_ROLES.has(role) && !route.roles.includes(role));
      if (!outsider) return;
      const response = await call(route.method, route.path, tokens.get(outsider));
      if (response.status !== 403) wrong.push(`${route.key} as ${outsider} -> ${response.status}`);
    });
    expect(wrong).toEqual([]);
  }, 60_000);

  it("lets a listed role and an admin through the role guard on every route", () => {
    const guard = new RolesGuard(new Reflector());
    const allows = (route: Route, roles: string[]) =>
      guard.canActivate({
        getHandler: () => route.handler,
        getClass: () => route.controller,
        switchToHttp: () => ({ getRequest: () => ({ auth: { user: { id: "u", user_metadata: { roles } } } }) }),
      } as unknown as ExecutionContext);

    for (const route of routes.filter((item) => item.roles.length > 0)) {
      expect(allows(route, [route.roles[0]]), route.key).toBe(true);
      expect(allows(route, ["administrateur_systeme"]), route.key).toBe(true);
    }
  });

  it("refuses a route with no decision, for admins too", () => {
    class Undecided {
      handler() {}
    }
    const guard = new RolesGuard(new Reflector());
    expect(() =>
      guard.canActivate({
        getHandler: () => Undecided.prototype.handler,
        getClass: () => Undecided,
        switchToHttp: () => ({ getRequest: () => ({ auth: { user: { id: "u", user_metadata: { roles: ["admin"] } } } }) }),
      } as unknown as ExecutionContext),
    ).toThrow();
  });

  it("has no self-registration route", async () => {
    const response = await call("POST", "/api/auth/signup", undefined, { email: "x@y.z", password: "p", options: { data: { roles: ["admin"] } } });
    expect(response.status).toBe(404);
  });

  it("has no generic database API, even for an admin", async () => {
    const token = addUser("admin-1", ["administrateur_systeme"]);
    for (const action of ["query", "insert", "update", "delete"]) {
      const response = await call("POST", `/api/db/${action}`, token, { table: "suppliers", filters: [{ $where: "1" }] });
      expect(response.status).toBe(404);
    }
  });

  it("rejects a forged token", async () => {
    addUser("user-1", ["administrateur_systeme"]);
    const forged = jwt.sign({ email: "x", tv: 0 }, "not-the-secret", { subject: "user-1" });
    expect((await call("GET", "/api/suppliers", forged)).status).toBe(401);
  });

  it("rejects a deactivated account", async () => {
    const token = addUser("user-2", ["administrateur_systeme"], { is_active: false });
    expect((await call("GET", "/api/audit/stats", token)).status).toBe(401);
  });

  it("rejects a token from before logout", async () => {
    addUser("user-3", ["administrateur_systeme"], { token_version: 5 });
    expect((await call("GET", "/api/audit/stats", tokenFor("user-3", 4))).status).toBe(401);
  });

  it("accepts no session token in a URL", async () => {
    const token = addUser("user-4", ["administrateur_systeme"]);
    expect((await call("GET", `/api/audit/stats?token=${token}`)).status).toBe(401);
    expect((await call("GET", `/api/realtime/events?token=${token}`)).status).toBe(401);
  });

  it("opens the realtime stream with a single-use ticket", async () => {
    const token = addUser("user-41", ["operateur_reception"]);
    const issued = await call("POST", "/api/realtime/ticket", token);
    expect(issued.status).toBe(201);
    const { ticket } = (await issued.json()).data;

    const stream = await call("GET", `/api/realtime/events?ticket=${ticket}`);
    expect(stream.status).toBe(200);
    await stream.body?.cancel();

    expect((await call("GET", `/api/realtime/events?ticket=${ticket}`)).status).toBe(401);
    expect((await call("GET", "/api/realtime/events")).status).toBe(401);
  });

  it("issues no realtime ticket without a session", async () => {
    expect((await call("POST", "/api/realtime/ticket")).status).toBe(401);
  });

  it("marks answers as not to be stored", async () => {
    const response = await call("GET", "/api/audit/stats", addUser("user-42", ["administrateur_systeme"]));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("holds an account with a pending password change at the change screen", async () => {
    const token = addUser("user-5", ["administrateur_systeme"], { must_change_password: true });
    const response = await call("GET", "/api/audit/stats", token);
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("refuses manual stage recording for an operator", async () => {
    const token = addUser("user-6", ["operateur_reception"]);
    const response = await call("POST", "/api/trust/lots/lot-1/advance", token, { toStage: "QC_DECIDED" });
    expect(response.status).toBe(403);
  });

  it("does not let a management domain unlock an operator", async () => {
    const token = addUser("user-7", ["operateur_reception"]);
    users.get("user-7")!.user_metadata = { roles: ["operateur_reception"], domains: ["direction"] };
    expect((await call("GET", "/api/audit/stats", token)).status).toBe(403);
  });

  it("keeps audit logs from any account outside the audit roles", async () => {
    const token = addUser("user-8", ["responsable_stock"]);
    expect((await call("GET", "/api/audit/logs", token)).status).toBe(403);
  });
});
