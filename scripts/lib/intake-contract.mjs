// 1x1 JPEG: synthetic stand-in for the arrival photos RG-R06 requires. Local scripts only.
const SYNTHETIC_PHOTO =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z";

/** Delivery facts the intake API requires, with visibly synthetic values for scripted runs. */
export const syntheticIntakeFields = (reference = `SCRIPT-${Date.now()}`) => ({
  reception_type: "DATTE",
  delivery_note_number: `BL-${reference}`,
  vehicle_number: "SCRIPT-0000",
  maturity_stage: "Tamar",
  harvest_method: "Manuelle traditionnelle",
  arrival_temperature_c: 24,
  storage_zone_code: "ZR-SCRIPT",
  delivery_note_photos: [SYNTHETIC_PHOTO, SYNTHETIC_PHOTO],
  unit_count: 1,
  unit_type: "PALETTE",
  weighing_source: "MANUAL",
  weighing_manual_reason: "Exécution scriptée sans bascule",
});
