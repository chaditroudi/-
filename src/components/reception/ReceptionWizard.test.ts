import { describe, expect, it } from "vitest";

import {
  getReceptionWizardStepBlockers,
  getSupplierOptionValue,
  resolveReceptionSupplier,
} from "@/lib/receptionWizardValidation";
import type { Supplier } from "@/types/mes";

const supplier = {
  id: "",
  code: "SUP-0001",
  name: "Cooperative Oasis Tozeur",
  is_active: true,
  supplier_status: "active",
} as Supplier;

describe("ReceptionWizard helpers", () => {
  it("uses supplier code as selection fallback when supplier id is missing", () => {
    expect(getSupplierOptionValue(supplier)).toBe("SUP-0001");
    expect(resolveReceptionSupplier([supplier], "SUP-0001")).toBe(supplier);
  });

  it("allows step 1 to proceed when an active supplier object is resolved", () => {
    const blockers = getReceptionWizardStepBlockers({
      step: 1,
      selectedSupplier: supplier,
      deliveryNoteNumber: "BL-2026-001",
      vehicleNumber: "TU-4521-A",
      gateArrivalAt: "2026-05-24T14:30",
      grossWeightValue: 0,
      tareWeightValue: 0,
      netWeightKg: 0,
      unitCountValue: 1,
      weighingSource: "SCALE",
      manualReason: "",
      arrivalPhotos: [],
      variety: "Deglet Nour",
      maturityStage: "Tamar",
      harvestMethod: "Manuelle traditionnelle",
      arrivalTemperatureC: "24",
      storageZoneCode: "",
      lots: [],
      lotMismatch: false,
    });

    expect(blockers).toEqual([]);
  });

  it("explains step 4 blockers for incomplete lot balancing", () => {
    const blockers = getReceptionWizardStepBlockers({
      step: 4,
      selectedSupplier: supplier,
      deliveryNoteNumber: "BL-2026-001",
      vehicleNumber: "TU-4521-A",
      gateArrivalAt: "2026-05-24T14:30",
      grossWeightValue: 1000,
      tareWeightValue: 100,
      netWeightKg: 900,
      unitCountValue: 1,
      weighingSource: "SCALE",
      manualReason: "",
      arrivalPhotos: ["a", "b"],
      variety: "Deglet Nour",
      maturityStage: "Tamar",
      harvestMethod: "Manuelle traditionnelle",
      arrivalTemperatureC: "24",
      storageZoneCode: "ZR-01",
      lots: [{ lot_supplier: "", quantity: 0, variety: "Deglet Nour", origin_country: "Tunisie", origin_region: "", origin_farm: "", harvest_date: "2026-05-24", rfid_tag: "" }],
      lotMismatch: true,
    });

    expect(blockers).toEqual(
      expect.arrayContaining([
        "renseigner chaque reference lot fournisseur",
        "renseigner chaque quantite de sous-lot",
        "aligner le total des sous-lots avec le poids net",
      ]),
    );
  });
});
