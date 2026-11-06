
const zoneDefaults = { capacity_kg: 0, current_load_kg: 0, temperature_min: null, temperature_max: null, humidity_min: null, humidity_max: null, notes: null };
import { describe, it, expect } from "vitest";
import { getRecommendedColdStorageZone } from "./QCInspectionDialog";
import type { Module3StorageZone } from "@/types/storage";

describe("getRecommendedColdStorageZone", () => {
  const mockZones: Module3StorageZone[] = [
    {
        ...zoneDefaults,
      id: "zone-1",
      code: "C-01",
      name: "Chambre Froide 1",
      zone_type: "cold_room",
      is_active: true,

      current_load_palettes: 80,
      capacity_palettes: 100,

      current_load_kg: 8000,
      capacity_kg: 10000,

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
        ...zoneDefaults,
      id: "zone-2",
      code: "C-02",
      name: "Chambre Froide 2",
      zone_type: "cold_room",
      is_active: true,

      current_load_palettes: 30,
      capacity_palettes: 100,

      current_load_kg: 3000,
      capacity_kg: 10000,

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
        ...zoneDefaults,
      id: "zone-3",
      code: "C-03-BIO",
      name: "Chambre Froide Bio",
      zone_type: "cold_room",
      is_active: true,

      current_load_palettes: 40,
      capacity_palettes: 100,

      current_load_kg: 4000,
      capacity_kg: 10000,

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
        ...zoneDefaults,
      id: "zone-quar",
      code: "QUAR-01",
      name: "Chambre Quarantaine",
      zone_type: "cold_room",
      is_active: true,

      current_load_palettes: 10,
      capacity_palettes: 100,

      current_load_kg: 1000,
      capacity_kg: 10000,

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
        ...zoneDefaults,
      id: "zone-inactive",
      code: "C-04",
      name: "Chambre En Panne",
      zone_type: "cold_room",
      is_active: false,

      current_load_palettes: 0,
      capacity_palettes: 100,

      current_load_kg: 0,
      capacity_kg: 10000,

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  it("recommends the least occupied cold zone for conventional dates", () => {
    const recommendation = getRecommendedColdStorageZone(mockZones, {
      isBio: false,
      variety: "Deglet Nour",
      lotWeightKg: 2000,
    });

    expect(recommendation).not.toBeNull();
    expect(recommendation?.zone.code).toBe("C-02");
    expect(recommendation?.occupancyPct).toBe(30);
  });

  it("prioritizes Bio cold chamber when isBio is true", () => {
    const recommendation = getRecommendedColdStorageZone(mockZones, {
      isBio: true,
      variety: "Deglet Nour Bio",
      lotWeightKg: 1500,
    });

    expect(recommendation).not.toBeNull();
    expect(recommendation?.zone.code).toBe("C-03-BIO");
    expect(recommendation?.occupancyPct).toBe(40);
  });

  it("never recommends inactive or quarantine zones", () => {
    const onlyInactiveOrQuarantine: Module3StorageZone[] = [
      mockZones[3], // QUAR-01
      mockZones[4], // C-04 inactive
    ];

    const recommendation = getRecommendedColdStorageZone(onlyInactiveOrQuarantine, {
      isBio: false,
    });

    expect(recommendation).toBeNull();
  });

  it("returns null if no cold storage zones exist", () => {
    const dryZones: Module3StorageZone[] = [
      {
        ...zoneDefaults,
        id: "dry-1",
        code: "SEC-01",
        name: "Hangar Sec",
        zone_type: "ventilated",
        is_active: true,

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const recommendation = getRecommendedColdStorageZone(dryZones, {});
    expect(recommendation).toBeNull();
  });
});

