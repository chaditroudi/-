import { describe, expect, it } from "vitest";

import { AppError } from "../../core/app-error.js";
import { planExpeditionDecrement } from "./expedition-decrement.js";

const released = {
  id: "lot-1",
  lot_number: "PF-1",
  status: "VALIDATED",
  current_quantity: 100,
};

describe("planExpeditionDecrement", () => {
  it("accepts a released lot when the pick does not exceed the quantity", () => {
    const totals = planExpeditionDecrement(
      [{ lot_id: "lot-1", quantity: 40 }, { lot_id: "lot-1", quantity: 10 }],
      [released],
    );
    expect(totals.get("lot-1")).toBe(50);
  });

  it("rejects a missing lot, a quarantine status, a non-positive quantity, and an overweight pick", () => {
    expect(() => planExpeditionDecrement([{ lot_id: "missing", quantity: 1 }], [released])).toThrow(AppError);
    expect(() => planExpeditionDecrement([{ lot_id: "missing", quantity: 1 }], [released])).toThrow(
      expect.objectContaining({ code: "EXPEDITION_LOT_NOT_FOUND" }),
    );

    expect(() => planExpeditionDecrement(
      [{ lot_id: "lot-1", quantity: 1 }],
      [{ ...released, status: "QUARANTINE" }],
    )).toThrow(expect.objectContaining({ code: "LOT_NOT_CONSUMABLE" }));

    expect(() => planExpeditionDecrement(
      [{ lot_id: "lot-1", quantity: 0 }],
      [released],
    )).toThrow(expect.objectContaining({ code: "EXPEDITION_QUANTITY_INVALID" }));

    expect(() => planExpeditionDecrement(
      [{ lot_id: "lot-1", quantity: 100.1 }],
      [released],
    )).toThrow(expect.objectContaining({ code: "INSUFFICIENT_STOCK" }));
  });

  it("accepts the other released statuses used by packaging", () => {
    for (const status of ["RELEASED", "STOCK_LIBERE", "LIBERE"]) {
      expect(planExpeditionDecrement(
        [{ lot_id: "lot-1", quantity: 1 }],
        [{ ...released, status }],
      ).get("lot-1")).toBe(1);
    }
  });
});
