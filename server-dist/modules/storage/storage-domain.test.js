import { describe, expect, it } from "vitest";
import { ROYAL_PALM_MODULE3_ZONES, STORAGE_MOVEMENT_REASONS, STORAGE_MOVEMENT_TYPES, assertValidLocationCode, buildLocationSeedsForZone, computeConditionStatus, computeLocationStatus, } from "./storage-domain.js";
describe("storage module 3 domain", () => {
    it("models the full Royal Palm storage map", () => {
        expect(ROYAL_PALM_MODULE3_ZONES).toHaveLength(23);
        expect(ROYAL_PALM_MODULE3_ZONES.reduce((sum, zone) => sum + zone.capacity_palettes, 0)).toBe(1690);
        expect(ROYAL_PALM_MODULE3_ZONES.find((zone) => zone.code === "CF-A1")).toMatchObject({
            capacity_palettes: 200,
            target_temperature_label: "2-4C",
            temperature_sensor_count: 4,
            humidity_sensor_count: 2,
        });
    });
    it("generates structured location codes and preserves parent zone prefix", () => {
        const zone = ROYAL_PALM_MODULE3_ZONES.find((item) => item.code === "CF-A1");
        const locations = buildLocationSeedsForZone(zone, "zone-id");
        expect(locations).toHaveLength(40);
        expect(locations[0]).toMatchObject({
            code: "CF-A1-01-01-1",
            storage_zone_id: "zone-id",
            capacity_palettes: 5,
        });
        expect(assertValidLocationCode("CF-A1-02-05-3", "CF-A1")).toBe("CF-A1-02-05-3");
        expect(() => assertValidLocationCode("CF-A1-02-05", "CF-A1")).toThrow();
        expect(() => assertValidLocationCode("SB-01-02-05-3", "CF-A1")).toThrow();
    });
    it("classifies condition readings against target ranges", () => {
        const zone = ROYAL_PALM_MODULE3_ZONES.find((item) => item.code === "CF-A1");
        expect(computeConditionStatus(zone, { temperature_c: 3, humidity_percent: 62 })).toMatchObject({
            status: "normal",
            messages: [],
        });
        expect(computeConditionStatus(zone, { temperature_c: 5.5 }).status).toBe("warning");
        expect(computeConditionStatus(zone, { temperature_c: 7.5 }).status).toBe("critical");
    });
    it("keeps blocked and reserved location states stable during occupancy recompute", () => {
        expect(computeLocationStatus(5, 0)).toBe("free");
        expect(computeLocationStatus(5, 2)).toBe("occupied");
        expect(computeLocationStatus(5, 0, "reserved")).toBe("reserved");
        expect(computeLocationStatus(5, 0, "blocked")).toBe("blocked");
    });
    it("exposes the required Module 3 movement type and reason lists", () => {
        expect(STORAGE_MOVEMENT_TYPES).toEqual(["ENTREE_ZONE", "SORTIE_ZONE", "TRANSFERT", "INVENTAIRE", "AJUSTEMENT"]);
        expect(STORAGE_MOVEMENT_REASONS).toEqual([
            "RECEPTION",
            "FUMIGATION",
            "LAVAGE",
            "TRIAGE",
            "EMBALLAGE",
            "PICKING_EXPORT",
            "INVENTAIRE",
            "AUTRE",
        ]);
    });
});
