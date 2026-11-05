import { describe, expect, it } from "vitest";

import { AppError } from "../../core/app-error.js";
import { appendSupplierPerformanceSnapshot, normalizeSupplierDocument } from "./supplier-domain.js";

describe("supplier domain", () => {
  it("normalizes multilingual identity, qualification, contracts, and compliance", () => {
    const supplier = normalizeSupplierDocument({
      code: " RP-001 ",
      name: " Collecteur Tozeur ",
      name_ar: " مجمع تمور توزر ",
      identification_status: "verified",
      qualification_status: "approved",
      supplier_status: "active",
      quality_score: 91,
      delivery_reliability_score: 86,
      traceability_score: 94,
      rejection_rate: 2,
      contract_type: "saisonnier",
      contract_start_date: "2026-01-01",
      contract_end_date: "2026-12-31",
      contract_records: [
        {
          reference: "CTR-2026-001",
          status: "active",
          start_date: "2026-01-01",
          end_date: "2026-12-31",
          document_url: "/contracts/ctr.pdf",
          compliance_status: "compliant",
        },
      ],
    });

    expect(supplier.name).toBe("Collecteur Tozeur");
    expect(supplier.name_ar).toBe("مجمع تمور توزر");
    expect(supplier.qualification_status).toBe("approved");
    expect(supplier.compliance_status).toBe("compliant");
    expect(supplier.contract_records[0].reference).toBe("CTR-2026-001");
    expect(supplier.contract_expiry_alert_at).toBe("2026-12-01");
    expect(supplier.contract_records[0].expiry_alert_at).toBe("2026-12-01");
  });

  it("requires verified identity before approval", () => {
    expect(() =>
      normalizeSupplierDocument({
        name: "Collecteur non verifie",
        qualification_status: "approved",
        identification_status: "unverified",
        contract_start_date: "2026-01-01",
        contract_end_date: "2026-12-31",
      }),
    ).toThrow(AppError);
  });

  it("defaults a seasonal contract window when dates are omitted", () => {
    const supplier = normalizeSupplierDocument({
      name: "Producteur minimal",
      actor_type: "producteur_direct",
      region: "Tozeur",
    });
    expect(supplier.contract_type).toBe("saisonnier");
    expect(supplier.contract_start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(supplier.contract_end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(String(supplier.contract_end_date)).getTime()).toBeGreaterThan(
      new Date(String(supplier.contract_start_date)).getTime(),
    );
  });

  it("lowercases identity keys for duplicate-safe storage", () => {
    const supplier = normalizeSupplierDocument({
      name: "Producteur CIN",
      code: "SUP-ABC",
      fiscal_identifier: "AB123456",
      id_document_number: "CIN-99",
      email: "Farmer@Example.TN",
      contract_start_date: "2026-01-01",
      contract_end_date: "2026-12-31",
    });
    expect(supplier.code).toBe("sup-abc");
    expect(supplier.fiscal_identifier).toBe("ab123456");
    expect(supplier.id_document_number).toBe("cin-99");
    expect(supplier.email).toBe("farmer@example.tn");
  });

  it("rejects inverted contract dates", () => {
    expect(() =>
      normalizeSupplierDocument({
        name: "Collecteur dates inversees",
        contract_type: "saisonnier",
        contract_start_date: "2026-12-31",
        contract_end_date: "2026-05-24",
      }),
    ).toThrow(AppError);
  });

  it("preserves a supplier performance history snapshot when tracked fields change", () => {
    const before = normalizeSupplierDocument({
      name: "Collecteur Tozeur",
      quality_score: 70,
      supplier_status: "pending_approval",
      contract_start_date: "2026-01-01",
      contract_end_date: "2026-12-31",
    });
    const after = normalizeSupplierDocument({ quality_score: 82, supplier_status: "active" }, before);

    const history = appendSupplierPerformanceSnapshot(before, after, "user-1");

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      by: "user-1",
      quality_score: 82,
      supplier_status: "active",
    });
  });
});
