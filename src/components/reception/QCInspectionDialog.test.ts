import { describe, it, expect } from "vitest";
import { getRecommendedColdStorageZone } from "./QCInspectionDialog";
import type { Module3StorageZone } from "@/types/storage";

describe("getRecommendedColdStorageZone", () => {
  const mockZones: Module3StorageZone[] = [
    {
      id: "zone-1",
      code: "C-01",
      name: "Chambre Froide 1",
      zone_type: "CHAMBRE_FROIDE",
      is_active: true,
      current_occupancy_palettes: 80,
      current_load_palettes: 80,
      capacity_palettes: 100,
      current_occupancy_kg: 8000,
      current_load_kg: 8000,
      capacity_kg: 10000,
      status: "ACTIVE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "zone-2",
      code: "C-02",
      name: "Chambre Froide 2",
      zone_type: "CHAMBRE_FROIDE",
      is_active: true,
      current_occupancy_palettes: 30,
      current_load_palettes: 30,
      capacity_palettes: 100,
      current_occupancy_kg: 3000,
      current_load_kg: 3000,
      capacity_kg: 10000,
      status: "ACTIVE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "zone-3",
      code: "C-03-BIO",
      name: "Chambre Froide Bio",
      zone_type: "CHAMBRE_FROIDE",
      is_active: true,
      current_occupancy_palettes: 40,
      current_load_palettes: 40,
      capacity_palettes: 100,
      current_occupancy_kg: 4000,
      current_load_kg: 4000,
      capacity_kg: 10000,
      status: "ACTIVE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "zone-quar",
      code: "QUAR-01",
      name: "Chambre Quarantaine",
      zone_type: "CHAMBRE_FROIDE",
      is_active: true,
      current_occupancy_palettes: 10,
      current_load_palettes: 10,
      capacity_palettes: 100,
      current_occupancy_kg: 1000,
      current_load_kg: 1000,
      capacity_kg: 10000,
      status: "ACTIVE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "zone-inactive",
      code: "C-04",
      name: "Chambre En Panne",
      zone_type: "CHAMBRE_FROIDE",
      is_active: false,
      current_occupancy_palettes: 0,
      current_load_palettes: 0,
      capacity_palettes: 100,
      current_occupancy_kg: 0,
      current_load_kg: 0,
      capacity_kg: 10000,
      status: "MAINTENANCE",
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
        id: "dry-1",
        code: "SEC-01",
        name: "Hangar Sec",
        zone_type: "SEC",
        is_active: true,
        status: "ACTIVE",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const recommendation = getRecommendedColdStorageZone(dryZones, {});
    expect(recommendation).toBeNull();
  });
});

