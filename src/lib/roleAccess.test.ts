import { describe, expect, it } from "vitest";

import { canAccessTab, canPerformAction, getAccessibleTabs } from "@/lib/roleAccess";

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
        "stock-dashboard",
        "stock-lots",
        "stock-products",
        "stock-movements",
        "sage-operations",
      ]),
    );
    expect(canPerformAction(["administrateur_systeme"], "purchasing_management")).toBe(true);
    expect(canPerformAction(["administrateur_systeme"], "warehouse_operations")).toBe(true);
    expect(canPerformAction(["administrateur_systeme"], "reception_data_entry")).toBe(true);
  });

  it("opens purchasing planning to responsable_stock but keeps magasinier out", () => {
    expect(canAccessTab(["responsable_stock"], "purchasing")).toBe(true);
    expect(canAccessTab(["magasinier_wms"], "purchasing")).toBe(false);
    expect(canPerformAction(["responsable_stock"], "purchasing_management")).toBe(false);
  });
});
