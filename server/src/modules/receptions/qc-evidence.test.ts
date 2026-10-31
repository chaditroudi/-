import { describe, expect, it } from "vitest";

import { evaluateQcEvidence, type QcRequirements } from "./qc-evidence.js";

const requirements: QcRequirements = {
  checklist_id: "cl",
  checklist_code: "QC-TEST",
  checklist_version: 2,
  items: [
    { id: "a", code: "A", name: "Critique", category: null, severity: "CRITIQUE" },
    { id: "b", code: "B", name: "Majeur", category: null, severity: "MAJEUR" },
  ],
};
const passing = [{ check_code: "A", result: "CONFORME" }, { check_code: "B", result: "CONFORME" }];
const accept = (extra: Record<string, unknown> = {}) =>
  evaluateQcEvidence({ decision: "ACCEPTE", requirements, checkResults: passing, ...extra });
const code = (run: () => unknown) => {
  try {
    run();
    return null;
  } catch (error) {
    return (error as { code?: string }).code;
  }
};

describe("QC evidence", () => {
  it("matches a check by item id or by code and stamps the published version", () => {
    const rows = accept({ checkResults: [{ checklist_item_id: "a", result: "CONFORME" }, { check_code: "B", result: "CONFORME" }] });
    expect(rows.map((row) => [row.check_code, row.severity, row.checklist_version])).toEqual([["A", "CRITIQUE", 2], ["B", "MAJEUR", 2]]);
  });

  it("names what is missing", () => {
    expect(() => accept({ checkResults: passing.slice(0, 1) })).toThrow(/: B\./);
  });

  it("treats an unknown result as not answered", () => {
    expect(code(() => accept({ checkResults: [passing[0], { check_code: "B", result: "OK" }] }))).toBe("QC_EVIDENCE_INCOMPLETE");
  });

  it("refuses a check listed twice, so a failure cannot be hidden beside a pass", () => {
    expect(code(() => accept({ checkResults: [...passing, { check_code: "A", result: "NON_CONFORME" }] }))).toBe("QC_EVIDENCE_INVALID");
  });

  it("does not let the client lower a published severity", () => {
    const checkResults = [{ check_code: "A", result: "NON_CONFORME", severity: "MINEUR" }, passing[1]];
    expect(code(() => accept({ checkResults }))).toBe("QC_CRITICAL_NONCONFORMITY");
  });

  it("offers no justification route past a critical failure", () => {
    const checkResults = [{ check_code: "A", result: "NON_CONFORME" }, passing[1]];
    expect(code(() => accept({ checkResults, overrideJustification: "x".repeat(40), overridePhoto: "photo" }))).toBe("QC_CRITICAL_NONCONFORMITY");
  });

  it("needs both the justification and the photo for a non-critical failure", () => {
    const checkResults = [passing[0], { check_code: "B", result: "NON_CONFORME" }];
    expect(code(() => accept({ checkResults, overrideJustification: "x".repeat(40) }))).toBe("QC_OVERRIDE_JUSTIFICATION_REQUIRED");
    expect(code(() => accept({ checkResults, overrideJustification: "court", overridePhoto: "photo" }))).toBe("QC_OVERRIDE_JUSTIFICATION_REQUIRED");
    expect(code(() => accept({ checkResults, overrideJustification: "x".repeat(20), overridePhoto: "photo" }))).toBeNull();
  });

  it("lets a hold or a rejection go through on one recorded check", () => {
    const checkResults = [{ check_code: "A", result: "NON_CONFORME" }];
    expect(code(() => evaluateQcEvidence({ decision: "QUARANTAINE", requirements, checkResults }))).toBeNull();
    expect(code(() => evaluateQcEvidence({ decision: "REJETE", requirements, checkResults: [] }))).toBe("QC_EVIDENCE_INCOMPLETE");
  });
});
