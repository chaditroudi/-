import { describe, expect, it } from "vitest";

import { ALL_ROLES, hasAnyRole, normalizeRolesFromMetadata, STAFF_READ_ROLES, STAFF_ROLES } from "./authorization.js";

describe("role resolution", () => {
  it("does not grant roles from domains", () => {
    const roles = normalizeRolesFromMetadata({ roles: ["auditeur_externe"], domains: ["qualite", "direction"] });
    expect(roles).toEqual(["auditeur_externe"]);
  });

  it("keeps expanding aliases held as roles", () => {
    expect(normalizeRolesFromMetadata({ roles: ["operateur"] })).toContain("operateur_reception");
  });

  it("does not treat an operator with a management domain as an admin", () => {
    const req = { auth: { user: { user_metadata: { roles: ["operateur_reception"], domains: ["direction"] } } } };
    expect(hasAnyRole(req, ["responsable_achats"])).toBe(false);
  });

  it("keeps external roles out of staff access", () => {
    for (const role of ["fournisseur_externe", "client_externe", "partenaire_client_export", "auditeur_externe"]) {
      expect(STAFF_ROLES).not.toContain(role);
    }
    expect(STAFF_READ_ROLES).toContain("auditeur_externe");
    expect(ALL_ROLES).toContain("fournisseur_externe");
  });
});
