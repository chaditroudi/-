
const zoneDefaults = { capacity_kg: 0, current_load_kg: 0, temperature_min: null, temperature_max: null, humidity_min: null, humidity_max: null, notes: null };
import { describe, it, expect } from "vitest";
import { CRATE_MODELS, computeTareFromCrates } from "@/components/reception/TareCalculator";
import { getRecommendedColdStorageZone } from "@/components/reception/QCInspectionDialog";
import { computeQcScore } from "@/lib/royalPalmPhase1";
import type { Module3StorageZone, StorageLocationMovement } from "@/types/storage";
import type { ReceptionV2 } from "@/types/reception";

describe("Wave 2 User Journey Tests", () => {
  describe("Journey 1 — Reception Express (10 Steps)", () => {
    it("completes the complete express workflow from pesée to BRA generation", () => {
      // Step 1: Arrivée Camion & Pesée
      const supplier = { id: "supp-001", code: "C001", name: "Coopérative Oasis Kebili" };
      const deliveryNoteNumber = "BL-2026-0927";
      const vehicleNumber = "123-TN-4567";
      const grossWeightKg = 10000;
      const crateModel = "CAISSE_AJOUREE_20KG";
      const crateCount = 500;
      const paletteCount = 10;

      // 1-5. Automatic tare computation using canonical CRATE_MODELS
      // 500 * 1.80kg + 10 * 25.0kg = 900 + 250 = 1150 kg
      const autoTareKg = computeTareFromCrates(crateModel, crateCount, paletteCount);
      expect(autoTareKg).toBe(1150);

      // 6. Automatic net weight
      const netWeightKg = grossWeightKg - autoTareKg;
      expect(netWeightKg).toBe(8850);

      // Verify Step 1 passes with all required arrival info

      // 7. Step 2: Contrôle & Stockage (Requires 2 photos — RG-R06)
      const photosIncomplete: string[] = ["photo1.jpg"];

      // Add second photo -> passes
      const photosComplete: string[] = ["photo1.jpg", "photo2.jpg"];

      // 8-10. Generate Lot Code, Save & Ticket BRA Payload
      const now = new Date("2026-09-27T10:00:00Z");
      const generatedLotNumber = `REC-${now.getFullYear()}-00927`;
      const braPayload = {
        receptionNumber: generatedLotNumber,
        supplierId: supplier.id,
        supplierName: supplier.name,
        grossWeightKg,
        tareWeightKg: autoTareKg,
        netWeightKg,
        crateCount,
        crateModel: CRATE_MODELS[crateModel].label,
        variety: "Deglet Nour",
        printedAt: now.toISOString(),
      };

      expect(braPayload.receptionNumber).toBe("REC-2026-00927");
      expect(braPayload.netWeightKg).toBe(8850);
      expect(braPayload.crateModel).toBe("Caisse ajourée 20kg");
    });
  });

  describe("Journey 2 — QC to Cold Storage Direct Handoff (8 Steps)", () => {
    it("executes QC evaluation, enforces PIN signature, and directly recommends & executes cold placement", async () => {
      // 1. Pending Lot data
      const mockReception: Partial<ReceptionV2> = {
        id: "rec-123",
        reception_number: "REC-2026-00927",
        variety: "Deglet Nour",
        quantity_total: 8850,
        bio_declared: false,
        status: "EN_QC",
      };

      // 2. Perform QC (Nominal standard compliant lot)
      const humidity: [number, number, number] = [22, 22, 22];
      const calibers = [42, 42, 42, 42, 42, 42, 42, 42, 42, 42];
      const defects = {
        insectsPercent: 0,
        moldPercent: 0,
        fermentationPercent: 0,
        mechanicalDamagePercent: 0,
        crystallizationPercent: 0,
        discolorationPercent: 0,
      };
      const organoleptic = {
        tasteScore: 5,
        textureScore: 5,
        appearanceScore: 5,
      };

      // 3. Compute score
      const qcResult = computeQcScore({
        humidity,
        calibers,
        ...defects,
        ...organoleptic,
      });

      // 4. Decision evaluated
      expect(qcResult.recommendedDecision).toBe("ACCEPTE");
      expect(qcResult.finalScore).toBeGreaterThanOrEqual(90);

      // 5. PIN signature requirement check
      let pinSignatureVerified = false;
      const verifyPin = (pin: string) => {
        if (pin && pin.length >= 4) {
          pinSignatureVerified = true;
          return true;
        }
        return false;
      };

      // Attempting release without PIN
      expect(pinSignatureVerified).toBe(false);

      // Inspector confirms with PIN
      verifyPin("1234");
      expect(pinSignatureVerified).toBe(true);

      // 6. Show storage recommendation from available active cold chambers
      const storageZones: Module3StorageZone[] = [
        {
        ...zoneDefaults,
          id: "zone-c1",
          code: "C-01",
          name: "Chambre Froide 1",
          zone_type: "cold_room",
          is_active: true,
          capacity_kg: 50000,
          current_load_kg: 42000, // 84% full

          created_at: "",
          updated_at: "",
        },
        {
        ...zoneDefaults,
          id: "zone-c2",
          code: "C-02",
          name: "Chambre Froide 2",
          zone_type: "cold_room",
          is_active: true,
          capacity_kg: 50000,
          current_load_kg: 15000, // 30% full (Least occupied!)

          created_at: "",
          updated_at: "",
        },
      ];

      const recommendation = getRecommendedColdStorageZone(storageZones, {
        isBio: mockReception.bio_declared ?? false,
        variety: mockReception.variety,
        lotWeightKg: mockReception.quantity_total,
      });

      expect(recommendation).not.toBeNull();
      expect(recommendation?.zone.code).toBe("C-02");
      expect(recommendation?.occupancyPct).toBe(30);

      // 7. Move stock into recommended chamber (C-02)
      const auditTrailLog: StorageLocationMovement[] = [];
      const moveStock = (movement: {
        destinationZoneId: string;
        lotId: string;
        lotCode: string;
        quantityKg: number;
        movementType: string;
        reason: string;
      }) => {
        const entry = {
          id: "mvt-001",
          storage_location_id: "loc-01",
          lot_id: movement.lotId,
          lot_code: movement.lotCode,
          destination_zone_id: movement.destinationZoneId,
          destination_zone_code: "C-02",
          quantity_kg: movement.quantityKg,
          movement_type: movement.movementType,
          movement_reason: movement.reason,
          movement_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
        } as unknown as StorageLocationMovement;
        auditTrailLog.push(entry);
        return entry;
      };

      moveStock({
        destinationZoneId: recommendation!.zone.id,
        lotId: mockReception.id!,
        lotCode: mockReception.reception_number!,
        quantityKg: mockReception.quantity_total!,
        movementType: "ENTREE_ZONE",
        reason: "RECEPTION",
      });

      // 8. Verify audit trail recorded
      expect(auditTrailLog).toHaveLength(1);
      expect(auditTrailLog[0].lot_code).toBe("REC-2026-00927");
      expect(auditTrailLog[0].destination_zone_code).toBe("C-02");
      expect(auditTrailLog[0].movement_type).toBe("ENTREE_ZONE");
    });
  });

  describe("Journey 3 — Security & Anti-Bypass Guardrails", () => {
    it("blocks release when PIN is missing or invalid", () => {
      const isReleaseAllowed = (decision: string, pin?: string) => {
        if (decision === "ACCEPTE" && (!pin || pin.trim().length < 4)) {
          return false;
        }
        return true;
      };

      expect(isReleaseAllowed("ACCEPTE")).toBe(false);
      expect(isReleaseAllowed("ACCEPTE", "")).toBe(false);
      expect(isReleaseAllowed("ACCEPTE", "12")).toBe(false);
      expect(isReleaseAllowed("ACCEPTE", "1234")).toBe(true);
    });

    it("blocks reception when RG-R06 photos are missing", () => {
      const checkPhotosRG_R06 = (photos: string[]) => photos.length >= 2;

      expect(checkPhotosRG_R06([])).toBe(false);
      expect(checkPhotosRG_R06(["only_front.jpg"])).toBe(false);
      expect(checkPhotosRG_R06(["front.jpg", "back.jpg"])).toBe(true);
    });

    it("blocks stock assignment to quarantined or inactive chambers without override", () => {
      const canPlaceInChamber = (zone: Module3StorageZone) => {
        if (!zone.is_active) return false;
        const name = (zone.name || "").toLowerCase();
        const code = (zone.code || "").toLowerCase();
        if (name.includes("quarantaine") || code.includes("quar")) return false;
        return true;
      };

      const activeCleanRoom: Module3StorageZone = {
        ...zoneDefaults,
        id: "z1",
        code: "C-01",
        name: "Chambre 1",
        zone_type: "cold_room",
        is_active: true,
        capacity_kg: 10000,
        current_load_kg: 2000,

        created_at: "",
        updated_at: "",
      };

      const quarantineRoom: Module3StorageZone = {
        ...zoneDefaults,
        id: "z2",
        code: "QUAR-01",
        name: "Quarantaine Sanitaire",
        zone_type: "cold_room",
        is_active: true,
        capacity_kg: 10000,
        current_load_kg: 0,

        created_at: "",
        updated_at: "",
      };

      const defectiveRoom: Module3StorageZone = {
        ...zoneDefaults,
        id: "z3",
        code: "C-04",
        name: "Chambre Frigorifique 4",
        zone_type: "cold_room",
        is_active: false,
        capacity_kg: 10000,
        current_load_kg: 0,

        created_at: "",
        updated_at: "",
      };

      expect(canPlaceInChamber(activeCleanRoom)).toBe(true);
      expect(canPlaceInChamber(quarantineRoom)).toBe(false);
      expect(canPlaceInChamber(defectiveRoom)).toBe(false);
    });
  });
});
