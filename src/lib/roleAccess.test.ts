import { describe, expect, it } from "vitest";

import { canAccessTab, canPerformAction, getAccessibleTabs, getRoleWorkspaceProfile } from "@/lib/roleAccess";

describe("roleAccess", () => {
  it("gives system administrators all operational tabs and actions", () => {
    const tabs = getAccessibleTabs(["administrateur_systeme"]);

    expect(tabs).toEqual(
      expect.arrayContaining([
        "home",
        "receptions",
        "storage",
        "production",
        "logistics",
        "purchasing",
        "analytics",
        "alerts",
        "suppliers",
        "materials",
        "sage-operations",
      ]),
    );
    // Stock is consolidated into a single 'storage' work-center; the legacy
    // stock-* ids stay routable for deep links but are no longer sidebar tabs.
    expect(tabs).toContain("storage");
    expect(tabs).not.toContain("stock-dashboard");
    expect(canPerformAction(["administrateur_systeme"], "purchasing_management")).toBe(true);
    expect(canPerformAction(["administrateur_systeme"], "warehouse_operations")).toBe(true);
    expect(canPerformAction(["administrateur_systeme"], "reception_data_entry")).toBe(true);
  });

  it("opens purchasing planning to responsable_stock but keeps magasinier out", () => {
    expect(canAccessTab(["responsable_stock"], "purchasing")).toBe(true);
    expect(canAccessTab(["magasinier_wms"], "purchasing")).toBe(false);
    expect(canPerformAction(["responsable_stock"], "purchasing_management")).toBe(false);
  });

  it("lands employees on Parcours lot without removing their tools", () => {
    const reception = getRoleWorkspaceProfile(["operateur_reception"]);
    expect(reception.defaultTab).toBe("home");
    expect(reception.primaryTabs[0]).toBe("home");
    expect(reception.primaryTabs).toEqual(expect.arrayContaining(["receptions", "alerts"]));

    const fumigation = getRoleWorkspaceProfile(["operateur_fumigation"]);
    expect(fumigation.defaultTab).toBe("home");
    expect(fumigation.primaryTabs).toEqual(expect.arrayContaining(["production"]));

    const portal = getRoleWorkspaceProfile(["client_externe"]);
    expect(portal.defaultTab).toBe("logistics");
  });

  it("shows only the home screen to an account with no known role", () => {
    expect(getAccessibleTabs([])).toEqual(["home"]);
  });

  it("keeps plant-wide screens away from portal accounts", () => {
    const tabs = getAccessibleTabs(["fournisseur_externe"]);
    expect(tabs).not.toContain("scan");
    expect(tabs).not.toContain("live");
  });
});
