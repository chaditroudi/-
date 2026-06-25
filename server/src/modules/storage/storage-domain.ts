export type StorageConditionStatus = "normal" | "warning" | "critical";

export type StorageLocationStatus = "free" | "occupied" | "reserved" | "blocked";

export type StorageMovementType = "ENTREE_ZONE" | "SORTIE_ZONE" | "TRANSFERT" | "INVENTAIRE" | "AJUSTEMENT";

export type StorageMovementReason =
  | "RECEPTION"
  | "FUMIGATION"
  | "LAVAGE"
  | "TRIAGE"
  | "EMBALLAGE"
  | "PICKING_EXPORT"
  | "INVENTAIRE"
  | "AUTRE";

export const STORAGE_MOVEMENT_TYPES: StorageMovementType[] = [
  "ENTREE_ZONE",
  "SORTIE_ZONE",
  "TRANSFERT",
  "INVENTAIRE",
  "AJUSTEMENT",
];

export const STORAGE_MOVEMENT_REASONS: StorageMovementReason[] = [
  "RECEPTION",
  "FUMIGATION",
  "LAVAGE",
  "TRIAGE",
  "EMBALLAGE",
  "PICKING_EXPORT",
  "INVENTAIRE",
  "AUTRE",
];

export type Module3ZoneSeed = {
  code: string;
  name: string;
  storage_family: "reception" | "raw" | "cold" | "fumigation" | "export";
  zone_type: "ventilated" | "cold_room" | "processing";
  capacity_palettes: number;
  capacity_kg: number;
  capacity_label: string;
  physical_type: string;
  target_temperature_label: string;
  temperature_min: number | null;
  temperature_max: number | null;
  humidity_min: number | null;
  humidity_max: number | null;
  temperature_sensor_count: number;
  humidity_sensor_count: number;
  gas_sensor_count: number;
  sensor_summary: string;
  notes: string;
};

export type StorageReadingInput = {
  temperature_c?: number | null;
  humidity_percent?: number | null;
  gas_ppm?: number | null;
};

export type StorageSuggestionCandidate = {
  id?: string;
  code?: string;
  zone_code?: string | null;
  capacity_palettes?: number | null;
  occupied_palettes?: number | null;
  door_distance_rank?: number | null;
  preferred_variety?: string | null;
  location_status?: StorageLocationStatus | string | null;
};

export type StorageLotRuleInput = {
  lot_number?: string | null;
  lot_code?: string | null;
  variety?: string | null;
  is_bio?: boolean | null;
  dlc_date?: string | null;
  dluo_date?: string | null;
  current_quantity?: number | null;
  status?: string | null;
};

export type TemperatureRuleLevel = "none" | "red" | "critical_sms";

export type DoorRuleLevel = "none" | "operator" | "responsable";

const KG_PER_PALETTE = 600;

const range = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const receptionZones = [
  ...range(1, 6).map((index) => ({
    code: `ZR-${String(index).padStart(2, "0")}`,
    capacity_palettes: 30,
    capacity_kg: 30 * KG_PER_PALETTE,
    notes: "Zone reception temporaire couverte et ventilee",
  })),
  ...range(7, 10).map((index) => ({
    code: `ZR-${String(index).padStart(2, "0")}`,
    capacity_palettes: 20,
    capacity_kg: 20 * KG_PER_PALETTE,
    notes: "Zone reception secondaire couverte et ventilee",
  })),
];

export const ROYAL_PALM_MODULE3_ZONES: Module3ZoneSeed[] = [
  ...receptionZones.map((zone) => ({
    ...zone,
    name: `Zone Reception ${zone.code.slice(-2)}`,
    storage_family: "reception" as const,
    zone_type: "ventilated" as const,
    capacity_label: `${zone.capacity_palettes} palettes`,
    physical_type: "Couvert, ventile",
    target_temperature_label: "Ambiante",
    temperature_min: null,
    temperature_max: null,
    humidity_min: null,
    humidity_max: 75,
    temperature_sensor_count: 2,
    humidity_sensor_count: 2,
    gas_sensor_count: 0,
    sensor_summary: "Temp + humid (2)",
  })),
  ...range(1, 4).map((index) => ({
    code: `SB-${String(index).padStart(2, "0")}`,
    name: `Stockage brut attente ${index}`,
    storage_family: "raw" as const,
    zone_type: "ventilated" as const,
    capacity_palettes: 50,
    capacity_kg: 50 * KG_PER_PALETTE,
    capacity_label: "50 palettes",
    physical_type: "Batiment ferme",
    target_temperature_label: "< 30C",
    temperature_min: null,
    temperature_max: 30,
    humidity_min: null,
    humidity_max: 70,
    temperature_sensor_count: 4,
    humidity_sensor_count: 4,
    gas_sensor_count: 0,
    sensor_summary: "Temp + humid (4)",
    notes: "Stockage brut en attente de traitement",
  })),
  {
    code: "CF-A1",
    name: "Chambre froide A1",
    storage_family: "cold",
    zone_type: "cold_room",
    capacity_palettes: 200,
    capacity_kg: 200 * KG_PER_PALETTE,
    capacity_label: "200 palettes",
    physical_type: "Froid positif",
    target_temperature_label: "2-4C",
    temperature_min: 2,
    temperature_max: 4,
    humidity_min: null,
    humidity_max: 70,
    temperature_sensor_count: 4,
    humidity_sensor_count: 2,
    gas_sensor_count: 0,
    sensor_summary: "Temp x 4 + humid x 2",
    notes: "Produits finis sous froid positif",
  },
  {
    code: "CF-A2",
    name: "Chambre froide A2",
    storage_family: "cold",
    zone_type: "cold_room",
    capacity_palettes: 200,
    capacity_kg: 200 * KG_PER_PALETTE,
    capacity_label: "200 palettes",
    physical_type: "Froid positif",
    target_temperature_label: "2-4C",
    temperature_min: 2,
    temperature_max: 4,
    humidity_min: null,
    humidity_max: 70,
    temperature_sensor_count: 4,
    humidity_sensor_count: 2,
    gas_sensor_count: 0,
    sensor_summary: "Temp x 4 + humid x 2",
    notes: "Produits finis sous froid positif",
  },
  {
    code: "CF-A3",
    name: "Chambre froide A3",
    storage_family: "cold",
    zone_type: "cold_room",
    capacity_palettes: 150,
    capacity_kg: 150 * KG_PER_PALETTE,
    capacity_label: "150 palettes",
    physical_type: "Froid positif",
    target_temperature_label: "4-6C",
    temperature_min: 4,
    temperature_max: 6,
    humidity_min: null,
    humidity_max: 70,
    temperature_sensor_count: 4,
    humidity_sensor_count: 2,
    gas_sensor_count: 0,
    sensor_summary: "Temp x 4 + humid x 2",
    notes: "Produits finis sous froid positif",
  },
  {
    code: "CF-B1",
    name: "Chambre froide B1",
    storage_family: "cold",
    zone_type: "cold_room",
    capacity_palettes: 250,
    capacity_kg: 250 * KG_PER_PALETTE,
    capacity_label: "250 palettes",
    physical_type: "Froid positif",
    target_temperature_label: "2-4C",
    temperature_min: 2,
    temperature_max: 4,
    humidity_min: null,
    humidity_max: 70,
    temperature_sensor_count: 4,
    humidity_sensor_count: 2,
    gas_sensor_count: 0,
    sensor_summary: "Temp x 4 + humid x 2",
    notes: "Produits finis sous froid positif",
  },
  {
    code: "CF-B2",
    name: "Chambre froide B2",
    storage_family: "cold",
    zone_type: "cold_room",
    capacity_palettes: 250,
    capacity_kg: 250 * KG_PER_PALETTE,
    capacity_label: "250 palettes",
    physical_type: "Froid positif",
    target_temperature_label: "2-4C",
    temperature_min: 2,
    temperature_max: 4,
    humidity_min: null,
    humidity_max: 70,
    temperature_sensor_count: 4,
    humidity_sensor_count: 2,
    gas_sensor_count: 0,
    sensor_summary: "Temp x 4 + humid x 2",
    notes: "Produits finis sous froid positif",
  },
  {
    code: "CF-B3",
    name: "Chambre froide B3",
    storage_family: "cold",
    zone_type: "cold_room",
    capacity_palettes: 150,
    capacity_kg: 150 * KG_PER_PALETTE,
    capacity_label: "150 palettes",
    physical_type: "Froid positif",
    target_temperature_label: "4-6C",
    temperature_min: 4,
    temperature_max: 6,
    humidity_min: null,
    humidity_max: 70,
    temperature_sensor_count: 4,
    humidity_sensor_count: 2,
    gas_sensor_count: 0,
    sensor_summary: "Temp x 4 + humid x 2",
    notes: "Produits finis sous froid positif",
  },
  ...range(1, 2).map((index) => ({
    code: `FU-${String(index).padStart(2, "0")}`,
    name: `Chambre fumigation ${index}`,
    storage_family: "fumigation" as const,
    zone_type: "processing" as const,
    capacity_palettes: 0,
    capacity_kg: 25000,
    capacity_label: "25 tonnes",
    physical_type: "Hermetique",
    target_temperature_label: "Ambiante",
    temperature_min: null,
    temperature_max: null,
    humidity_min: null,
    humidity_max: null,
    temperature_sensor_count: 6,
    humidity_sensor_count: 0,
    gas_sensor_count: 4,
    sensor_summary: "Gaz x 4, Temp x 6",
    notes: "Chambre hermetique fumigation",
  })),
  {
    code: "ZE-01",
    name: "Zone preparation export",
    storage_family: "export",
    zone_type: "processing",
    capacity_palettes: 30,
    capacity_kg: 30 * KG_PER_PALETTE,
    capacity_label: "30 palettes",
    physical_type: "Quai couvert",
    target_temperature_label: "Ambiante",
    temperature_min: null,
    temperature_max: null,
    humidity_min: null,
    humidity_max: null,
    temperature_sensor_count: 0,
    humidity_sensor_count: 0,
    gas_sensor_count: 0,
    sensor_summary: "-",
    notes: "Preparation export et staging quai",
  },
];

export const LOCATION_CODE_PATTERN = /^([A-Z]{2}-(?:[A-Z]\d|\d{2}))-\d{2}-\d{2}-\d$/;

export const getZoneCodeFromLocationCode = (code: string) => {
  const match = String(code || "").trim().toUpperCase().match(LOCATION_CODE_PATTERN);
  return match?.[1] || null;
};

export const assertValidLocationCode = (code: string, expectedZoneCode?: string) => {
  const normalized = String(code || "").trim().toUpperCase();
  const zoneCode = getZoneCodeFromLocationCode(normalized);

  if (!zoneCode) {
    throw new Error("Location code must use [ZONE]-[AISLE]-[RACK]-[LEVEL], for example CF-A1-02-05-3.");
  }

  if (expectedZoneCode && zoneCode !== expectedZoneCode) {
    throw new Error(`Location code must start with parent zone ${expectedZoneCode}.`);
  }

  return normalized;
};

export const buildLocationSeedsForZone = (zone: Module3ZoneSeed, storageZoneId?: string) => {
  const slotCount = zone.capacity_palettes > 0 ? Math.ceil(zone.capacity_palettes / 5) : Math.ceil(zone.capacity_kg / 5000);
  const rows = [];
  let remainingPalettes = zone.capacity_palettes;
  let remainingKg = zone.capacity_kg;

  for (let index = 0; index < slotCount; index += 1) {
    const aisle = Math.floor(index / 20) + 1;
    const rack = Math.floor((index % 20) / 4) + 1;
    const level = (index % 4) + 1;
    const capacityPalettes = zone.capacity_palettes > 0 ? Math.min(5, remainingPalettes) : 0;
    const capacityKg = zone.capacity_palettes > 0
      ? capacityPalettes * KG_PER_PALETTE
      : Math.min(5000, remainingKg);

    rows.push({
      code: `${zone.code}-${String(aisle).padStart(2, "0")}-${String(rack).padStart(2, "0")}-${level}`,
      name: `${zone.code} emplacement ${String(index + 1).padStart(2, "0")}`,
      storage_zone_id: storageZoneId || null,
      zone_code: zone.code,
      capacity_palettes: capacityPalettes,
      capacity_kg: capacityKg,
      occupied_palettes: 0,
      occupied_kg: 0,
      location_status: "free" satisfies StorageLocationStatus,
      lot_ids_present: [],
      last_movement_at: null,
      current_temperature_c: null,
      current_humidity_percent: null,
      current_gas_ppm: null,
      door_distance_rank: index + 1,
      preferred_variety: null,
      is_active: true,
    });

    remainingPalettes -= capacityPalettes;
    remainingKg -= capacityKg;
  }

  return rows;
};

const normalizeText = (value?: string | null) => String(value || "").trim().toLowerCase();

const toTime = (value?: string | null) => {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : null;
};

const daysUntil = (targetDate?: string | null, now = new Date()) => {
  const targetTime = toTime(targetDate);
  if (targetTime === null) return null;
  return Math.ceil((targetTime - now.getTime()) / 86_400_000);
};

export const sortLocationsForSuggestion = <T extends StorageSuggestionCandidate>(
  candidates: T[],
  options: { quantityPalettes?: number; variety?: string | null; rotationMode?: "FIFO" | "VARIETY" } = {},
) => {
  const requestedPalettes = Number(options.quantityPalettes ?? 1);
  const requestedVariety = normalizeText(options.variety);

  return candidates
    .filter((location) => {
      if (location.location_status === "blocked") return false;
      const capacity = Number(location.capacity_palettes ?? 0);
      const occupied = Number(location.occupied_palettes ?? 0);
      return capacity <= 0 || occupied + requestedPalettes <= capacity;
    })
    .sort((left, right) => {
      const leftVarietyMatch = requestedVariety && normalizeText(left.preferred_variety) === requestedVariety ? 0 : 1;
      const rightVarietyMatch = requestedVariety && normalizeText(right.preferred_variety) === requestedVariety ? 0 : 1;
      if (leftVarietyMatch !== rightVarietyMatch) return leftVarietyMatch - rightVarietyMatch;

      const leftDoor = Number(left.door_distance_rank ?? Number.MAX_SAFE_INTEGER);
      const rightDoor = Number(right.door_distance_rank ?? Number.MAX_SAFE_INTEGER);
      if (leftDoor !== rightDoor) return leftDoor - rightDoor;

      const leftCapacity = Math.max(1, Number(left.capacity_palettes ?? 0));
      const rightCapacity = Math.max(1, Number(right.capacity_palettes ?? 0));
      return Number(left.occupied_palettes ?? 0) / leftCapacity - Number(right.occupied_palettes ?? 0) / rightCapacity;
    });
};

export const sortLotsForFefo = (lots: StorageLotRuleInput[]) =>
  [...lots].sort((left, right) => {
    const leftDate = toTime(left.dlc_date) ?? toTime(left.dluo_date) ?? Number.MAX_SAFE_INTEGER;
    const rightDate = toTime(right.dlc_date) ?? toTime(right.dluo_date) ?? Number.MAX_SAFE_INTEGER;
    if (leftDate !== rightDate) return leftDate - rightDate;
    return normalizeText(left.lot_number || left.lot_code).localeCompare(normalizeText(right.lot_number || right.lot_code));
  });

export const computeDlcAlertLevel = (date?: string | null, now = new Date()) => {
  const days = daysUntil(date, now);
  if (days === null || days < 0 || days > 30) return null;
  if (days <= 7) return "red";
  if (days <= 15) return "orange";
  return "yellow";
};

export const evaluateTemperatureRule = (
  zone: Partial<Module3ZoneSeed>,
  readings: Array<{ temperature_c?: number | null; reading_at?: string | null }>,
  now = new Date(),
) => {
  if (zone.zone_type !== "cold_room") {
    return { level: "none" as TemperatureRuleLevel, durationMinutes: 0 };
  }

  const ordered = readings
    .filter((reading) => typeof reading.temperature_c === "number" && toTime(reading.reading_at) !== null)
    .sort((left, right) => (toTime(left.reading_at) || 0) - (toTime(right.reading_at) || 0));

  const latest = ordered[ordered.length - 1];
  if (!latest || typeof latest.temperature_c !== "number" || latest.temperature_c <= 8) {
    return { level: "none" as TemperatureRuleLevel, durationMinutes: 0 };
  }

  const threshold = latest.temperature_c > 10 ? 10 : 8;
  const requiredMinutes = threshold === 10 ? 30 : 5;
  const reversed = [...ordered].reverse();
  const continuous = [];

  for (const reading of reversed) {
    if (typeof reading.temperature_c !== "number" || reading.temperature_c <= threshold) break;
    continuous.push(reading);
  }

  const oldest = continuous[continuous.length - 1];
  const oldestTime = toTime(oldest?.reading_at);
  const durationMinutes = oldestTime === null ? 0 : Math.floor((now.getTime() - oldestTime) / 60_000);

  if (durationMinutes >= requiredMinutes) {
    return {
      level: threshold === 10 ? "critical_sms" as TemperatureRuleLevel : "red" as TemperatureRuleLevel,
      durationMinutes,
    };
  }

  return { level: "none" as TemperatureRuleLevel, durationMinutes };
};

export const evaluateDoorRule = (
  events: Array<{ event_type?: string | null; event_at?: string | null }>,
  now = new Date(),
) => {
  const ordered = events
    .filter((event) => toTime(event.event_at) !== null)
    .sort((left, right) => (toTime(left.event_at) || 0) - (toTime(right.event_at) || 0));
  const latest = ordered[ordered.length - 1];
  const oneHourAgo = now.getTime() - 60 * 60_000;
  const openingsLastHour = ordered.filter(
    (event) => event.event_type === "OPEN" && (toTime(event.event_at) || 0) >= oneHourAgo,
  ).length;

  if (openingsLastHour > 15) {
    return { level: "responsable" as DoorRuleLevel, openingsLastHour };
  }

  if (latest?.event_type === "OPEN") {
    const openedAt = toTime(latest.event_at);
    const openMinutes = openedAt === null ? 0 : Math.floor((now.getTime() - openedAt) / 60_000);
    if (openMinutes > 5) {
      return { level: "operator" as DoorRuleLevel, openingsLastHour, openMinutes };
    }
  }

  return { level: "none" as DoorRuleLevel, openingsLastHour };
};

export const isRawStorageDelayed = (location: {
  zone_code?: string | null;
  last_movement_at?: string | null;
}, now = new Date()) => {
  if (!String(location.zone_code || "").startsWith("SB-")) return false;
  const lastMovement = toTime(location.last_movement_at);
  if (lastMovement === null) return false;
  return now.getTime() - lastMovement > 48 * 60 * 60_000;
};

const worstStatus = (current: StorageConditionStatus, next: StorageConditionStatus): StorageConditionStatus => {
  const severityOrder = { normal: 0, warning: 1, critical: 2 };
  return severityOrder[next] > severityOrder[current] ? next : current;
};

export const computeConditionStatus = (zone: Partial<Module3ZoneSeed>, reading: StorageReadingInput) => {
  let status: StorageConditionStatus = "normal";
  const messages: string[] = [];

  if (typeof reading.temperature_c === "number") {
    const min = typeof zone.temperature_min === "number" ? zone.temperature_min : null;
    const max = typeof zone.temperature_max === "number" ? zone.temperature_max : null;

    if (min !== null && reading.temperature_c < min) {
      const next = reading.temperature_c < min - 2 ? "critical" : "warning";
      status = worstStatus(status, next);
      messages.push(`Temperature below target (${reading.temperature_c}C < ${min}C)`);
    }

    if (max !== null && reading.temperature_c > max) {
      const next = reading.temperature_c > max + 2 ? "critical" : "warning";
      status = worstStatus(status, next);
      messages.push(`Temperature above target (${reading.temperature_c}C > ${max}C)`);
    }
  }

  if (typeof reading.humidity_percent === "number") {
    const min = typeof zone.humidity_min === "number" ? zone.humidity_min : null;
    const max = typeof zone.humidity_max === "number" ? zone.humidity_max : null;

    if (min !== null && reading.humidity_percent < min) {
      status = worstStatus(status, "warning");
      messages.push(`Humidity below target (${reading.humidity_percent}% < ${min}%)`);
    }

    if (max !== null && reading.humidity_percent > max) {
      const next = reading.humidity_percent > max + 10 ? "critical" : "warning";
      status = worstStatus(status, next);
      messages.push(`Humidity above target (${reading.humidity_percent}% > ${max}%)`);
    }
  }

  if (typeof reading.gas_ppm === "number" && reading.gas_ppm > 0) {
    const next = reading.gas_ppm >= 20 ? "critical" : "warning";
    status = worstStatus(status, next);
    messages.push(`Gas detected (${reading.gas_ppm} ppm)`);
  }

  return { status, messages };
};

export const computeLocationStatus = (
  capacityPalettes: number,
  occupiedPalettes: number,
  currentStatus?: StorageLocationStatus,
): StorageLocationStatus => {
  if (currentStatus === "blocked") return "blocked";
  if (currentStatus === "reserved") return "reserved";
  if (occupiedPalettes <= 0) return "free";
  if (capacityPalettes > 0 && occupiedPalettes >= capacityPalettes) return "occupied";
  return "occupied";
};
