import { describe, expect, it } from "vitest";

import { AppError } from "../../core/app-error.js";
import {
  assertLotsReleasedForProduction,
  assertNoOrganicConventionalMix,
  assertShipmentNotClosableWhenIncomplete,
  evaluateShipmentDossier,
  isLotReleasedForProduction,
} from "./gate-rules.js";

describe("W0 gate rules", () => {
  it("requires both statuses to agree when a lot carries both", () => {
    expect(isLotReleasedForProduction({ id: "1", status: "VALIDATED", stock_status: "STOCK_LIBERE" })).toBe(true);
    expect(isLotReleasedForProduction({ id: "2", status: "VALIDATED", stock_status: "EN_QUARANTAINE" })).toBe(false);
    expect(isLotReleasedForProduction({ id: "3", status: "BLOCKED", stock_status: "STOCK_LIBERE" })).toBe(false);
  });

  it("allows production only on QC-released lots", () => {
    expect(isLotReleasedForProduction({ id: "1", status: "VALIDATED" })).toBe(true);
    expect(isLotReleasedForProduction({ id: "2", stock_status: "STOCK_LIBERE" })).toBe(true);
    expect(isLotReleasedForProduction({ id: "3", status: "QUARANTINE" })).toBe(false);
    expect(isLotReleasedForProduction({ id: "4" })).toBe(false);

    expect(() =>
      assertLotsReleasedForProduction(
        [{ id: "A", status: "QUARANTINE" }],
        ["A"],
      ),
    ).toThrow(AppError);

    expect(() =>
      assertLotsReleasedForProduction(
        [{ id: "A", status: "VALIDATED" }],
        ["A"],
      ),
    ).not.toThrow();
  });

  it("blocks organic and conventional mix", () => {
    expect(() =>
      assertNoOrganicConventionalMix([
        { id: "bio", is_organic: true },
        { id: "conv", is_organic: false },
      ]),
    ).toThrow(/Organic and conventional/);

    expect(() =>
      assertNoOrganicConventionalMix([
        { id: "bio1", certification: "Bio UE" },
        { id: "bio2", bio: true },
      ]),
    ).not.toThrow();
  });

  it("blocks shipment closure when dossier is incomplete", () => {
    const incomplete = evaluateShipmentDossier({
      hasGenealogy: true,
      hasQcDecision: false,
      requiresCcp: true,
      hasCcpCertificate: false,
      hasPackaging: true,
    });

    expect(incomplete.missing).toEqual(["qc_decision", "ccp_certificate"]);

    expect(() => assertShipmentNotClosableWhenIncomplete("CLOSED", incomplete)).toThrow(
      /dossier is incomplete/,
    );

    const complete = evaluateShipmentDossier({
      hasGenealogy: true,
      hasQcDecision: true,
      requiresCcp: true,
      hasCcpCertificate: true,
      hasPackaging: true,
    });

    expect(() => assertShipmentNotClosableWhenIncomplete("CLOSED", complete)).not.toThrow();
    expect(() => assertShipmentNotClosableWhenIncomplete("DRAFT", incomplete)).not.toThrow();
  });
});
