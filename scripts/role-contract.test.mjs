// @vitest-environment node
/**
 * The client's idea of who may read what, against the route table the server really runs.
 * Lives under scripts because it needs both the client and the server sources.
 */
import { ModulesContainer } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../server/src/app.ts";
import { ALL_ROLES } from "../server/src/middleware/authorization.ts";
import { ANY_ROLE_KEY, IS_PUBLIC_KEY, ROLES_KEY } from "../server/src/nest/route-metadata.ts";
import { canRead, READ_ACCESS, TAB_REQUIRES } from "../src/lib/apiAccess";
import { getAccessibleTabs } from "../src/lib/roleAccess";

const BYPASS = new Set(["admin", "administrateur_systeme", "directeur_general", "directeur_usine"]);
const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "ALL", "OPTIONS", "HEAD"];

const joinPath = (...parts) => `/${parts.flat().filter((part) => part && part !== "/").join("/")}`.replace(/\/+/g, "/");

const readRoutes = (app) => {
  const routes = new Map();
  for (const moduleRef of app.get(ModulesContainer).values()) {
    for (const { metatype: controller } of moduleRef.controllers.values()) {
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name];
        if (name === "constructor" || typeof handler !== "function" || !Reflect.hasMetadata("path", handler)) continue;
        const read = (key) => Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller);
        const key = `${METHODS[Reflect.getMetadata("method", handler)]} ${joinPath(Reflect.getMetadata("path", controller), Reflect.getMetadata("path", handler))}`;
        routes.set(key, { isPublic: Boolean(read(IS_PUBLIC_KEY)), anyRole: Boolean(read(ANY_ROLE_KEY)), roles: read(ROLES_KEY) ?? [] });
      }
    }
  }
  return routes;
};

const roles = ALL_ROLES.filter((role) => role !== "admin");
const serverAllows = (route, role) => route.isPublic || route.anyRole || BYPASS.has(role) || route.roles.includes(role);

describe("role contract", () => {
  let app;
  let routes;

  beforeAll(async () => {
    app = await createApp();
    routes = readRoutes(app);
  });
  afterAll(() => app?.close());

  it("names only routes that exist", () => {
    const missing = Object.values(READ_ACCESS).map((entry) => entry.route).filter((route) => !routes.has(route));
    expect(missing).toEqual([]);
  });

  it("agrees with the server for every role and every resource", () => {
    const differences = [];
    for (const [resource, entry] of Object.entries(READ_ACCESS)) {
      for (const role of roles) {
        const server = serverAllows(routes.get(entry.route), role);
        if (canRead([role], resource) !== server) differences.push(`${role} ${resource}: server ${server}`);
      }
    }
    expect(differences).toEqual([]);
  });

  it("offers no role a tab whose main data the server refuses", () => {
    const refused = [];
    for (const role of roles) {
      for (const tab of getAccessibleTabs([role])) {
        const resource = TAB_REQUIRES[tab];
        if (resource && !serverAllows(routes.get(READ_ACCESS[resource].route), role)) refused.push(`${role} ${tab}`);
      }
    }
    expect(refused).toEqual([]);
  });

  it("gives every screen with its own data a declared requirement", () => {
    const open = new Set(["home", "settings", "stock-dashboard", "stock-lots", "stock-products", "stock-movements"]);
    const undeclared = roles.flatMap((role) => getAccessibleTabs([role])).filter((tab) => !open.has(tab) && !TAB_REQUIRES[tab]);
    expect([...new Set(undeclared)]).toEqual([]);
  });

  it("keeps the Production Manager away from stock and able to run production", () => {
    const tabs = getAccessibleTabs(["responsable_production"]);
    expect(tabs).not.toContain("storage");
    expect(tabs).toEqual(expect.arrayContaining(["production", "packaging", "live", "analytics"]));
  });

  it("keeps the plant-wide wall display from operators the server refuses", () => {
    expect(getAccessibleTabs(["operateur_reception"])).not.toContain("live");
    expect(getAccessibleTabs(["magasinier_wms"])).not.toContain("live");
  });

  it("keeps stock available to the warehouse", () => {
    expect(getAccessibleTabs(["magasinier_wms"])).toContain("storage");
  });

  it("gives directors and administrators everything their profile lists", () => {
    expect(getAccessibleTabs(["directeur_usine"])).toEqual(expect.arrayContaining(["receptions", "storage", "production", "live"]));
    expect(getAccessibleTabs(["administrateur_systeme"])).toEqual(expect.arrayContaining(["settings"]));
  });
});
