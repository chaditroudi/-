import { beforeEach, describe, expect, it, vi } from "vitest";

import { storageService } from "./storage.service.js";

type TestRow = Record<string, unknown>;

const inserted: Record<string, TestRow[]> = {};
const locations: TestRow[] = [];
const stockLots: TestRow[] = [];
const receptionUnits: TestRow[] = [];

const makeQuery = <T>(value: T) => ({
  lean: () => ({
    exec: async () => value,
  }),
});

const matchesOrClause = (row: TestRow, query: Record<string, unknown>) => {
  const clauses = Array.isArray(query.$or) ? query.$or as TestRow[] : [query];
  return clauses.some((clause) =>
    Object.entries(clause).every(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value) && "$in" in value) {
        return (value.$in as unknown[]).includes(row[key]);
      }
      return row[key] === value;
    }),
  );
};

vi.mock("../../db/dynamic-model.js", () => ({
  sanitizeDocument: <T>(value: T) => value,
  getCollectionModel: (collection: string) => {
    if (collection === "stock_lots") {
      return {
        findOne: vi.fn((query: TestRow) => makeQuery(stockLots.find((row) => matchesOrClause(row, query)) || null)),
        updateOne: vi.fn((query: TestRow, update: { $set?: TestRow }) => {
          const row = stockLots.find((item) => matchesOrClause(item, query));
          if (row && update.$set) Object.assign(row, update.$set);
          return { exec: async () => ({ acknowledged: true }) };
        }),
      };
    }

    if (collection === "reception_units") {
      return {
        findOne: vi.fn((query: TestRow) => makeQuery(receptionUnits.find((row) => matchesOrClause(row, query)) || null)),
      };
    }

    if (collection === "storage_locations") {
      return {
        findOne: vi.fn((query: TestRow) => makeQuery(locations.find((row) => matchesOrClause(row, query)) || null)),
        find: vi.fn((query: TestRow) => makeQuery(locations.filter((row) => matchesOrClause(row, query)))),
        updateOne: vi.fn((query: TestRow, update: { $set?: TestRow }) => {
          const row = locations.find((item) => matchesOrClause(item, query));
          if (row && update.$set) Object.assign(row, update.$set);
          return { exec: async () => ({ acknowledged: true }) };
        }),
      };
    }

    if (collection === "storage_zones") {
      return {
        findOne: vi.fn(() => makeQuery(null)),
        updateOne: vi.fn(() => ({ exec: async () => ({ acknowledged: true }) })),
      };
    }

    return {
      findOne: vi.fn(() => makeQuery(null)),
      find: vi.fn(() => makeQuery([])),
      insertMany: vi.fn(async (rows: TestRow[]) => {
        inserted[collection] = [...(inserted[collection] || []), ...rows];
      }),
      updateOne: vi.fn(() => ({ exec: async () => ({ acknowledged: true }) })),
    };
  },
}));

vi.mock("../../db/defaults.js", () => ({
  prepareInsertDocument: vi.fn(async (collection: string, value: TestRow) => ({
    id: `${collection}-id-${(inserted[collection]?.length || 0) + 1}`,
    created_at: "2026-10-18T10:00:00.000Z",
    updated_at: "2026-10-18T10:00:00.000Z",
    ...(collection === "storage_location_movements" ? { movement_number: "MV20261018-0042" } : {}),
    ...value,
  })),
}));

describe("storageService.moveStock", () => {
  beforeEach(() => {
    Object.keys(inserted).forEach((key) => delete inserted[key]);
    receptionUnits.splice(0, receptionUnits.length);
    locations.splice(
      0,
      locations.length,
      {
        id: "source-1",
        code: "SRC-01",
        occupied_palettes: 5,
        occupied_kg: 1000,
        capacity_palettes: 10,
        location_status: "occupied",
        lot_ids_present: ["LOT-A"],
        storage_zone_id: null,
      },
      {
        id: "dest-1",
        code: "DST-01",
        occupied_palettes: 0,
        occupied_kg: 0,
        capacity_palettes: 10,
        location_status: "free",
        lot_ids_present: [],
        storage_zone_id: null,
      },
    );
    stockLots.splice(0, stockLots.length, { id: "lot-1", lot_number: "LOT-A", current_quantity: 1000 });
  });

  it("uses system timestamp, authenticated operator, canonical lot, and default one palette", async () => {
    await storageService.moveStock(
      {
        movementType: "TRANSFERT",
        lotCode: "LOT-A",
        sourceLocationId: "source-1",
        destinationLocationId: "dest-1",
        reason: "RECEPTION",
        movementDate: "2020-01-01T00:00:00.000Z",
        performedBy: "spoofed-user",
      } as TestRow,
      { id: "user-1" },
    );

    const movement = inserted.storage_location_movements[0];
    expect(movement.movement_number).toBe("MV20261018-0042");
    expect(movement.lot_id).toBe("lot-1");
    expect(movement.lot_code).toBe("LOT-A");
    expect(movement.quantity_palettes).toBe(1);
    expect(movement.performed_by).toBe("user-1");
    expect(movement.movement_date).not.toBe("2020-01-01T00:00:00.000Z");
  });

  it("resolves reception unit barcode scans to the parent stock lot", async () => {
    stockLots.splice(0, stockLots.length, {
      id: "lot-1",
      lot_number: "STK-1",
      source_lot_internal: "LOT-A",
      reception_lot_id: "reception-lot-1",
      current_quantity: 1000,
    });
    receptionUnits.splice(0, receptionUnits.length, {
      id: "unit-1",
      barcode: "UNIT-1",
      qr_code_payload: "UNIT-1",
      qr_label_text: "UNIT-1 | 100 kg",
      reception_lot_id: "reception-lot-1",
    });

    await storageService.moveStock(
      {
        movementType: "ENTREE_ZONE",
        lotCode: "UNIT-1 | 100 kg",
        destinationLocationId: "dest-1",
        reason: "RECEPTION",
      },
      { id: "user-1" },
    );

    const movement = inserted.storage_location_movements[0];
    expect(movement.lot_id).toBe("lot-1");
    expect(movement.lot_code).toBe("STK-1");
    expect(stockLots[0].storage_location_id).toBe("dest-1");
  });

  it("rejects unknown scanned LOT-ID values", async () => {
    await expect(storageService.moveStock(
      {
        movementType: "TRANSFERT",
        lotCode: "UNKNOWN",
        sourceLocationId: "source-1",
        destinationLocationId: "dest-1",
        reason: "RECEPTION",
      },
      { id: "user-1" },
    )).rejects.toMatchObject({ code: "LOT_NOT_FOUND" });
  });

  it("rejects zero palette movements", async () => {
    await expect(storageService.moveStock(
      {
        movementType: "TRANSFERT",
        lotCode: "LOT-A",
        sourceLocationId: "source-1",
        destinationLocationId: "dest-1",
        quantityPalettes: 0,
        reason: "RECEPTION",
      },
      { id: "user-1" },
    )).rejects.toMatchObject({ code: "MOVEMENT_PALETTE_QUANTITY_REQUIRED" });
  });
});
