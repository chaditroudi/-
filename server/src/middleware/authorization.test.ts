import { describe, expect, it } from "vitest";

import { canAccessRpc } from "./authorization.js";

const makeReq = (roles: string[]) => ({
  auth: { user: { id: "u-1", email: "user@example.com", user_metadata: { roles } } },
});

describe("RPC policy", () => {
  it("allows stock roles to suggest lots for picking", () => {
    expect(canAccessRpc(makeReq(["magasinier_wms"]), "suggest_lots_for_picking")).toBe(true);
  });

  it("denies other roles", () => {
    expect(canAccessRpc(makeReq(["operateur_conditionnement"]), "suggest_lots_for_picking")).toBe(false);
  });

  it("denies unknown procedures for non-admins", () => {
    expect(canAccessRpc(makeReq(["magasinier_wms"]), "drop_everything")).toBe(false);
  });
});
