import { describe, expect, it } from "vitest";

import { buildPurchaseOrderSupplierEmail } from "./purchase-order-email.js";
import { escapeHtml } from "./mailer.js";

describe("purchase-order supplier email", () => {
  it("brands the message with manufacturer site settings (not hard-coded Royal Palm)", () => {
    const { subject, html, text } = buildPurchaseOrderSupplierEmail(
      {
        companyName: "EcoDatte",
        plantName: "Usine Kebili",
        primaryColor: "#0f766e",
        plantEmail: "achats@ecodatte.tn",
        siteCode: "ECO-KEB",
        currency: "TND",
      },
      {
        orderNumber: "BC-2026-00012",
        orderDate: "2026-08-01",
        expectedDeliveryDate: "2026-08-10",
        currency: "TND",
        totalAmount: 12500,
        paymentTerms: "30 jours",
        supplierName: "Oasis Dates SARL",
        buyerName: "Amina",
        lines: [
          {
            materialName: "Caisse 5kg",
            quantity: 200,
            unit: "u",
            lineTotal: 4000,
          },
        ],
      },
    );

    expect(subject).toContain("EcoDatte");
    expect(subject).toContain("BC-2026-00012");
    expect(html).toContain("EcoDatte");
    expect(html).toContain("Usine Kebili");
    expect(html).toContain("Oasis Dates SARL");
    expect(html).toContain("Caisse 5kg");
    expect(html).not.toContain("Royal Palm");
    expect(text).toContain("achats@ecodatte.tn");
  });

  it("escapes HTML in supplier-controlled fields", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });
});
