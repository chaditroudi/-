import { describe, it, expect } from "vitest";
import { getLotStatusMeta } from "./LotStatusBadge";

describe("LotStatusBadge getLotStatusMeta", () => {
  it("resolves French labels correctly for core statuses", () => {
    expect(getLotStatusMeta("STOCK_LIBERE", false).label).toBe("Stock libéré");
    expect(getLotStatusMeta("EN_QUARANTAINE", false).label).toBe("En quarantaine");
    expect(getLotStatusMeta("STOCK_REJETE", false).label).toBe("Stock rejeté");
    expect(getLotStatusMeta("ACCEPTE", false).label).toBe("Accepté");
    expect(getLotStatusMeta("EN_ATTENTE_QC", false).label).toBe("Attente QC");
  });

  it("resolves Arabic labels correctly when isArabic is true", () => {
    expect(getLotStatusMeta("STOCK_LIBERE", true).label).toBe("مخزون محرر");
    expect(getLotStatusMeta("EN_QUARANTAINE", true).label).toBe("في الحجر");
    expect(getLotStatusMeta("STOCK_REJETE", true).label).toBe("مخزون مرفوض");
    expect(getLotStatusMeta("ACCEPTE", true).label).toBe("مقبول");
  });

  it("handles null/undefined gracefully", () => {
    expect(getLotStatusMeta(null, false).label).toBe("—");
    expect(getLotStatusMeta(null, true).label).toBe("غير محدد");
    expect(getLotStatusMeta(undefined, false).label).toBe("—");
  });

  it("provides fallback for unknown statuses", () => {
    const meta = getLotStatusMeta("CUSTOM_TEST_STATUS", false);
    expect(meta.label).toBe("CUSTOM TEST STATUS");
    expect(meta.style).toContain("slate");
  });

  it("assigns appropriate color variants for compliance, warning, and rejection", () => {
    expect(getLotStatusMeta("STOCK_LIBERE", false).style).toContain("emerald");
    expect(getLotStatusMeta("EN_QUARANTAINE", false).style).toContain("amber");
    expect(getLotStatusMeta("STOCK_REJETE", false).style).toContain("red");
    expect(getLotStatusMeta("EN_QC", false).style).toContain("sky");
  });
});

