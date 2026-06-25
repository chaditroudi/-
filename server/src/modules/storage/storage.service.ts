import { Injectable } from "@nestjs/common";
import mongoose from "mongoose";
import { badRequest, conflict, notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import {
  ROYAL_PALM_MODULE3_ZONES,
  STORAGE_MOVEMENT_REASONS,
  STORAGE_MOVEMENT_TYPES,
  assertValidLocationCode,
  buildLocationSeedsForZone,
  computeDlcAlertLevel,
  computeConditionStatus,
  computeLocationStatus,
  evaluateDoorRule,
  evaluateTemperatureRule,
  isRawStorageDelayed,
  sortLocationsForSuggestion,
  sortLotsForFefo,
  type Module3ZoneSeed,
  type StorageLotRuleInput,
  type StorageLocationStatus,
  type StorageMovementReason,
  type StorageMovementType,
} from "./storage-domain.js";

const nowIso = () => new Date().toISOString();

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const unique = <T>(items: T[]) => Array.from(new Set(items.filter(Boolean)));
const compactRows = <T>(items: Array<T | null | undefined>) => items.filter(Boolean) as T[];

const normalizeLotReference = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const beforePipe = raw.split("|")[0]?.trim();
  return beforePipe || raw;
};

const extractLotReferences = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return [] as string[];

  const references = [normalizeLotReference(raw)];

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    [
      "stock_lot_id",
      "stockLotId",
      "lot_id",
      "lotId",
      "lot_code",
      "lotCode",
      "lot_number",
      "lotNumber",
      "lot_internal",
      "lotInternal",
      "barcode",
      "unit_barcode",
      "unitBarcode",
      "qr_code_payload",
      "qrCodePayload",
      "qr_label_text",
      "qrLabelText",
      "sscc",
    ].forEach((key) => {
      if (parsed[key]) references.push(normalizeLotReference(parsed[key]));
    });
  } catch {
    // QR labels may contain plain LOT-ID text, unit barcode text, or a URL.
  }

  try {
    const url = new URL(raw);
    [
      "lot",
      "lotId",
      "lot_id",
      "lotCode",
      "lot_code",
      "lotNumber",
      "lot_number",
      "barcode",
      "unit",
      "unitBarcode",
      "unit_barcode",
      "sscc",
    ].forEach((key) => {
      const candidate = url.searchParams.get(key);
      if (candidate) references.push(normalizeLotReference(candidate));
    });
  } catch {
    // Not a URL.
  }

  return unique(references);
};

type StorageRecord = Record<string, unknown> & {
  id?: string;
  code?: string;
  zone_code?: string | null;
  name?: string | null;
  storage_family?: string | null;
  zone_type?: string | null;
  is_bio_only?: boolean | null;
  allowed_varieties?: unknown[];
  storage_zone_id?: string | null;
  location_status?: StorageLocationStatus;
  capacity_palettes?: number;
  occupied_palettes?: number;
  occupied_kg?: number;
  last_movement_at?: string | null;
  lot_ids_present?: unknown[];
};

type StorageAlertRow = Record<string, unknown> & {
  id?: string;
  alert_key?: string | null;
  alert_type?: string | null;
  title?: string | null;
  message?: string | null;
  severity?: string | null;
  lot_id?: string | null;
  storage_zone_id?: string | null;
  storage_location_id?: string | null;
  dlc_alert_level?: string | null;
  created_at?: string | null;
  status?: string | null;
};

type StorageNotificationRow = Record<string, unknown> & {
  id?: string;
  notification_type?: string | null;
  category?: string | null;
  title?: string | null;
  message?: string | null;
  severity?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  created_at?: string | null;
  is_read?: boolean;
  metadata?: Record<string, unknown> | null;
};

type StorageUser = {
  id?: string;
} | null;

type RecordReadingPayload = Record<string, unknown> & {
  storageZoneId?: string;
  zoneCode?: string;
  locationId?: string;
  locationCode?: string;
  temperatureC?: number | string;
  humidityPercent?: number | string;
  gasPpm?: number | string;  
  sensorRef?: string;
  recordedBy?: string;
  readingAt?: string;
};

type MoveStockPayload = Record<string, unknown> & {
  sourceLocationId?: string;
  sourceLocationCode?: string;
  destinationLocationId?: string;
  destinationLocationCode?: string;
  destinationZoneId?: string;
  destinationZoneCode?: string;
  lotId?: string;
  lotCode?: string;
  productId?: string;
  variety?: string;
  lotIsBio?: boolean;
  quantityPalettes?: number | string;
  quantityKg?: number | string;
  movementType?: string;
  reason?: string;
  fefoOverrideReason?: string;
  notes?: string;
};

type DoorEventPayload = Record<string, unknown> & {
  storageZoneId?: string;
  zoneCode?: string;
  eventType?: "OPEN" | "CLOSE" | string;
  eventAt?: string;
  sensorRef?: string;
};

type SuggestLocationPayload = Record<string, unknown> & {
  destinationZoneId?: string;
  destinationZoneCode?: string;
  quantityPalettes?: number | string;
  variety?: string;
  lotIsBio?: boolean;
  rotationMode?: "FIFO" | "VARIETY";
};

type FefoPayload = Record<string, unknown> & {
  productId?: string;
  variety?: string;
  limit?: number;
};

const normalizeMovementType = (value: unknown): StorageMovementType => {
  const raw = String(value || "").trim();
  if (!raw) {
    throw badRequest("MOVEMENT_TYPE_REQUIRED", "Movement type is required.");
  }

  const movementType = raw.toUpperCase() as StorageMovementType;
  if (!STORAGE_MOVEMENT_TYPES.includes(movementType)) {
    throw badRequest("INVALID_MOVEMENT_TYPE", "Movement type must be ENTREE_ZONE, SORTIE_ZONE, TRANSFERT, INVENTAIRE, or AJUSTEMENT.");
  }
  return movementType;
};

const normalizeMovementReason = (value: unknown): StorageMovementReason => {
  const reason = String(value || "").trim().toUpperCase() as StorageMovementReason;
  if (!reason) {
    throw badRequest("MOVEMENT_REASON_REQUIRED", "Movement reason is required.");
  }
  if (!STORAGE_MOVEMENT_REASONS.includes(reason)) {
    throw badRequest("INVALID_MOVEMENT_REASON", "Movement reason is not part of the Module 3 list.");
  }
  return reason;
};

const parseRequiredPaletteQuantity = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return 1;
  }

  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw badRequest("MOVEMENT_PALETTE_QUANTITY_REQUIRED", "Palette quantity must be greater than zero.");
  }

  return quantity;
};

const getModelRowsByCode = async (collection: string, codes: string[]) => {
  const Model = getCollectionModel(collection);
  return sanitizeDocument(await Model.find({ code: { $in: codes } }).lean().exec()) as StorageRecord[];
};

const findLocation = async (payload: { id?: string | null; code?: string | null }) => {
  const Locations = getCollectionModel("storage_locations");
  const id = payload.id ? String(payload.id) : "";
  const code = payload.code ? String(payload.code).trim().toUpperCase() : "";
  if (!id && !code) return null;

  const query = id ? { id } : { code };
  return sanitizeDocument(await Locations.findOne(query).lean().exec()) as StorageRecord | null;
};

const findZone = async (payload: { id?: string | null; code?: string | null }) => {
  const Zones = getCollectionModel("storage_zones");
  const id = payload.id ? String(payload.id) : "";
  const code = payload.code ? String(payload.code).trim().toUpperCase() : "";
  if (!id && !code) return null;

  const query = id ? { id } : { code };
  return sanitizeDocument(await Zones.findOne(query).lean().exec()) as StorageRecord | null;
};

const Alerts = () => getCollectionModel("alerts");
const SystemNotifications = () => getCollectionModel("system_notifications");

const mapNotificationSeverity = (value: unknown) => {
  const severity = String(value || "").trim().toLowerCase();
  if (severity === "critical" || severity === "error") return "error" as const;
  if (severity === "warning") return "warning" as const;
  if (severity === "success") return "success" as const;
  return "info" as const;
};

const mapStorageAlertNotificationType = (alert: StorageAlertRow) => {
  const alertType = String(alert.alert_type || "").trim().toUpperCase();
  if (alertType === "DLC_PROGRESSIVE") {
    const level = String(alert.dlc_alert_level || "").trim().toLowerCase();
    if (level === "red") return "DLC_CRITIQUE";
    if (level === "orange") return "DLC_WARNING";
    return "DLC_ALERT";
  }
  return alertType || "STORAGE_ALERT";
};

const mapStorageAlertEntity = (alert: StorageAlertRow) => {
  if (alert.lot_id) {
    return { entity_type: "stock_lot", entity_id: String(alert.lot_id) };
  }
  if (alert.storage_location_id) {
    return { entity_type: "storage_location", entity_id: String(alert.storage_location_id) };
  }
  if (alert.storage_zone_id) {
    return { entity_type: "storage_zone", entity_id: String(alert.storage_zone_id) };
  }
  return { entity_type: "storage", entity_id: null };
};

const createNotificationForStorageAlert = async (alert: StorageAlertRow) => {
  const alertKey = String(alert.alert_key || "").trim();
  if (alertKey) {
    const existing = sanitizeDocument(
      await SystemNotifications().findOne({ "metadata.alert_key": alertKey }).lean().exec(),
    ) as StorageNotificationRow | null;
    if (existing) return existing;
  }

  const entity = mapStorageAlertEntity(alert);
  const notification = await prepareInsertDocument("system_notifications", {
    notification_type: mapStorageAlertNotificationType(alert),
    category: "stockage",
    title: String(alert.title || "Alerte stockage"),
    message: String(alert.message || "Une alerte stockage a ete detectee."),
    severity: mapNotificationSeverity(alert.severity),
    entity_type: entity.entity_type,
    entity_id: entity.entity_id,
    status: "ACTIVE",
    is_read: false,
    metadata: sanitizeDocument({
      alert_id: alert.id || null,
      alert_key: alert.alert_key || null,
      alert_type: alert.alert_type || null,
      dlc_alert_level: alert.dlc_alert_level || null,
      storage_zone_id: alert.storage_zone_id || null,
      storage_location_id: alert.storage_location_id || null,
      lot_id: alert.lot_id || null,
    }) as Record<string, unknown>,
  });

  await SystemNotifications().insertMany([notification]);
  return sanitizeDocument(notification) as StorageNotificationRow;
};

const ensureAlert = async (payload: Record<string, unknown>) => {
  const alertKey = String(payload.alert_key || "");

  if (alertKey) {
    const existing = await Alerts().findOne({
      alert_key: alertKey,
      status: { $in: ["active", "ACTIVE", "acknowledged"] },
    }).lean().exec();
    if (existing) {
      return {
        alert: sanitizeDocument(existing) as StorageAlertRow,
        created: false,
      };
    }
  }

  const prepared = await prepareInsertDocument("alerts", {
    status: "active",
    ...payload,
  });
  await Alerts().insertMany([prepared]);
  return {
    alert: sanitizeDocument(prepared) as StorageAlertRow,
    created: true,
  };
};

const ensureAlertWithNotification = async (payload: Record<string, unknown>) => {
  const result = await ensureAlert(payload);
  const notification = result.created
    ? await createNotificationForStorageAlert(result.alert)
    : null;

  return {
    alerts: result.created ? [result.alert] : [] as StorageAlertRow[],
    notifications: compactRows([notification]),
  };
};

const suggestDestinationLocation = async (payload: {
  destinationZoneId?: string;
  destinationZoneCode?: string;
  quantityPalettes: number;
  variety?: string;
  lotIsBio?: boolean;
}) => {
  const Locations = getCollectionModel("storage_locations");
  const zoneQuery: Record<string, unknown> = { is_active: true, location_status: { $ne: "blocked" } };
  if (payload.destinationZoneId) zoneQuery.storage_zone_id = payload.destinationZoneId;
  if (payload.destinationZoneCode) zoneQuery.zone_code = String(payload.destinationZoneCode).trim().toUpperCase();

  const candidates = sanitizeDocument(await Locations.find(zoneQuery).lean().exec()) as StorageRecord[];
  return sortLocationsForSuggestion(candidates, {
    quantityPalettes: payload.quantityPalettes,
    variety: payload.variety,
    rotationMode: payload.variety ? "VARIETY" : "FIFO",
  })[0] || null;
};

const updateZoneLoad = async (zoneId: string | null | undefined, palettesDelta: number, kgDelta: number) => {
  if (!zoneId) return;
  const Zones = getCollectionModel("storage_zones");
  const zone = sanitizeDocument(await Zones.findOne({ id: zoneId }).lean().exec()) as StorageRecord | null;
  if (!zone) return;

  await Zones.updateOne(
    { id: zoneId },
    {
      $set: {
        current_load_palettes: Math.max(0, asNumber(zone.current_load_palettes) + palettesDelta),
        current_load_kg: Math.max(0, asNumber(zone.current_load_kg) + kgDelta),
        updated_at: nowIso(),
      },
    },
  ).exec();
};

const resolveStockLotByRef = async (payload: { lotId?: string; lotCode?: string }) => {
  const lotIds = extractLotReferences(payload.lotId);
  const lotCodes = extractLotReferences(payload.lotCode);
  const references = unique([...lotIds, ...lotCodes]);
  if (references.length === 0) return null;

  const StockLots = getCollectionModel("stock_lots");
  const clauses = [];
  for (const lotId of lotIds) {
    clauses.push({ id: lotId });
  }
  for (const reference of references) {
    clauses.push({ id: reference });
    clauses.push({ lot_number: reference });
    clauses.push({ source_lot_internal: reference });
    clauses.push({ source_lot_supplier: reference });
    clauses.push({ reception_lot_id: reference });
  }

  const stockLot = sanitizeDocument(await StockLots.findOne({ $or: clauses }).lean().exec()) as (StorageLotRuleInput & {
    id?: string;
    product_id?: string;
    unit?: string;
  }) | null;
  if (stockLot) return stockLot;

  const ReceptionUnits = getCollectionModel("reception_units");
  const unitClauses = references.flatMap((reference) => [
    { id: reference },
    { barcode: reference },
    { qr_code_payload: reference },
    { qr_label_text: reference },
    { sscc: reference },
  ]);
  const unit = sanitizeDocument(await ReceptionUnits.findOne({ $or: unitClauses }).lean().exec()) as {
    reception_lot_id?: string;
  } | null;

  if (!unit?.reception_lot_id) return null;

  return sanitizeDocument(await StockLots.findOne({ reception_lot_id: unit.reception_lot_id }).lean().exec()) as (StorageLotRuleInput & {
    id?: string;
    product_id?: string;
    unit?: string;
  }) | null;
};

const getLotIdentifiers = (
  payload: { lotId?: string; lotCode?: string },
  lot: Record<string, unknown> | null,
) => unique([
  payload.lotId,
  payload.lotCode,
  lot?.id,
  lot?.lot_number,
  lot?.lot_code,
  lot?.source_lot_internal,
  lot?.source_lot_supplier,
]).map((value) => String(value));

const getFefoCandidates = async (payload: FefoPayload) => {
  const StockLots = getCollectionModel("stock_lots");
  // Only VALIDATED lots are eligible for picking — QUARANTINE and BLOCKED must not appear
  const query: Record<string, unknown> = {
    current_quantity: { $gt: 0 },
    status: "VALIDATED",
  };
  if (payload.productId) query.product_id = payload.productId;
  if (payload.variety) query.variety = payload.variety;

  const rows = sanitizeDocument(await StockLots.find(query).lean().exec()) as StorageLotRuleInput[];
  return sortLotsForFefo(rows).slice(0, Number(payload.limit || 50));
};

const validateFefoPicking = async (payload: MoveStockPayload, lot: Awaited<ReturnType<typeof resolveStockLotByRef>>) => {
  if (payload.reason !== "PICKING_EXPORT" || !lot?.product_id) {
    return {
      alerts: [] as StorageAlertRow[],
      notifications: [] as StorageNotificationRow[],
    };
  }

  const candidates = await getFefoCandidates({
    productId: lot.product_id,
    variety: payload.variety || lot.variety || undefined,
    limit: 20,
  });
  const recommended = candidates[0];
  if (!recommended) {
    return {
      alerts: [] as StorageAlertRow[],
      notifications: [] as StorageNotificationRow[],
    };
  }

  const selectedRef = String(lot.lot_number || payload.lotCode || lot.id || "");
  const recommendedRef = String(recommended.lot_number || recommended.lot_code || "");
  if (!recommendedRef || recommendedRef === selectedRef) {
    return {
      alerts: [] as StorageAlertRow[],
      notifications: [] as StorageNotificationRow[],
    };
  }

  if (!payload.fefoOverrideReason) {
    throw badRequest("FEFO_OVERRIDE_REASON_REQUIRED", "FEFO override requires a reason.");
  }

  return ensureAlertWithNotification({
    alert_key: `FEFO_OVERRIDE:${selectedRef}:${recommendedRef}`,
    alert_type: "FEFO_OVERRIDE",
    title: "Override FEFO picking export",
    message: `Lot ${selectedRef} picked before FEFO lot ${recommendedRef}. Motif: ${payload.fefoOverrideReason}`,
    severity: "warning",
    lot_id: lot.id || null,
  });
};

const enforceVarietyAndBioRules = async (payload: MoveStockPayload, destination: StorageRecord | null, lot: Awaited<ReturnType<typeof resolveStockLotByRef>>) => {
  if (!destination?.storage_zone_id) {
    return {
      alerts: [] as StorageAlertRow[],
      notifications: [] as StorageNotificationRow[],
    };
  }
  const zone = await findZone({ id: destination.storage_zone_id });
  if (!zone) {
    return {
      alerts: [] as StorageAlertRow[],
      notifications: [] as StorageNotificationRow[],
    };
  }

  const lotVariety = String(payload.variety || lot?.variety || "").trim();
  const lotIsBio = Boolean(payload.lotIsBio ?? lot?.is_bio ?? (lot as Record<string, unknown> | null)?.bio_declared);

  if (zone.is_bio_only && !lotIsBio) {
    throw conflict("BIO_ZONE_REQUIRES_BIO_LOT", "Bio cold rooms accept only Bio lots.");
  }

  const allowedVarieties = Array.isArray(zone.allowed_varieties) ? zone.allowed_varieties.map(String).filter(Boolean) : [];
  if (allowedVarieties.length > 0 && lotVariety && !allowedVarieties.includes(lotVariety)) {
    return ensureAlertWithNotification({
      alert_key: `VARIETY_ZONE:${zone.id}:${lotVariety}`,
      alert_type: "STORAGE_VARIETY_COHERENCE",
      title: `Variete differente dans ${zone.code}`,
      message: `Lot ${payload.lotCode || payload.lotId} (${lotVariety}) affecte a une zone configuree pour ${allowedVarieties.join(", ")}.`,
      severity: "warning",
      storage_zone_id: zone.id || null,
    });
  }

  return {
    alerts: [] as StorageAlertRow[],
    notifications: [] as StorageNotificationRow[],
  };
};

const syncLotMovementHistory = async (
  payload: MoveStockPayload,
  lot: Awaited<ReturnType<typeof resolveStockLotByRef>>,
  source: StorageRecord | null,
  destination: StorageRecord | null,
  quantityKg: number,
  movementDate: string,
  movementType: StorageMovementType,
  operatorId: string | null,
) => {
  if (!lot?.id || !lot.product_id) return;
  const StockMovements = getCollectionModel("stock_movements");
  await StockMovements.insertMany([
    await prepareInsertDocument("stock_movements", {
      movement_type: movementType,
      movement_date: movementDate,
      lot_id: lot.id,
      product_id: lot.product_id,
      quantity: quantityKg || payload.quantityKg || payload.quantityPalettes || 0,
      unit: lot.unit || "kg",
      source_location_id: source?.id || null,
      destination_location_id: destination?.id || null,
      document_type: "MODULE_3_STORAGE",
      document_reference: payload.reason || null,
      performed_by: operatorId,
      notes: payload.notes || null,
    }),
  ]);
};

@Injectable()
export class StorageService {
  async listModule3Zones() {
    const [rawZones, lotAgg] = await Promise.all([
      getCollectionModel("storage_zones").find({ is_active: true }).sort({ code: 1 }).lean().exec(),
      getCollectionModel("reception_lots").aggregate([
        { $match: { stock_status: { $in: ["EN_QUARANTAINE", "STOCK_LIBERE"] }, storage_zone_code: { $exists: true, $ne: null } } },
        { $group: { _id: "$storage_zone_code", total_kg: { $sum: "$quantity" }, lot_count: { $sum: 1 } } },
      ]).exec(),
    ]);

    const kgByZone = new Map<string, { kg: number; lots: number }>();
    for (const row of lotAgg) {
      kgByZone.set(String(row._id || ""), { kg: Number(row.total_kg || 0), lots: Number(row.lot_count || 0) });
    }

    const KG_PER_PALETTE = 800;
    const zones = sanitizeDocument(rawZones) as StorageRecord[];
    return zones.map((zone) => {
      const live = kgByZone.get(String(zone.code || "")) ?? { kg: 0, lots: 0 };
      return {
        ...zone,
        current_load_kg: live.kg,
        current_load_palettes: Math.ceil(live.kg / KG_PER_PALETTE),
        current_lots_count: live.lots,
      };
    });
  }

  async listModule3Locations(storageZoneId?: string) {
    const query: Record<string, unknown> = { is_active: true };
    if (storageZoneId && storageZoneId !== "all") {
      query.storage_zone_id = storageZoneId;
    }

    const [locations, zones, lotsByZoneAgg, lotInternalsAgg] = await Promise.all([
      sanitizeDocument(
        await getCollectionModel("storage_locations")
          .find(query)
          .sort({ code: 1 })
          .lean()
          .exec(),
      ) as Promise<StorageRecord[]>,
      sanitizeDocument(
        await getCollectionModel("storage_zones")
          .find({ is_active: true })
          .lean()
          .exec(),
      ) as Promise<StorageRecord[]>,
      // kg + count per zone code (reception_lots.storage_zone_code matches location.zone_code)
      getCollectionModel("reception_lots").aggregate([
        { $match: { stock_status: { $in: ["EN_QUARANTAINE", "STOCK_LIBERE"] }, storage_zone_code: { $exists: true, $ne: null } } },
        { $group: { _id: "$storage_zone_code", total_kg: { $sum: "$quantity" }, lot_count: { $sum: 1 } } },
      ]).exec(),
      // lot_internal codes per zone code (for "lots présents" display)
      getCollectionModel("reception_lots").aggregate([
        { $match: { stock_status: { $in: ["EN_QUARANTAINE", "STOCK_LIBERE"] }, storage_zone_code: { $exists: true, $ne: null }, lot_internal: { $exists: true, $ne: null } } },
        { $group: { _id: "$storage_zone_code", internals: { $push: "$lot_internal" } } },
      ]).exec(),
    ]);

    // zone-level stats keyed by zone code
    const KG_PER_PALETTE = 800;
    const zoneStats = new Map<string, { kg: number; lots: number }>();
    for (const row of lotsByZoneAgg) {
      zoneStats.set(String(row._id || ""), { kg: Number(row.total_kg || 0), lots: Number(row.lot_count || 0) });
    }
    const zoneLotInternals = new Map<string, string[]>();
    for (const row of lotInternalsAgg) {
      zoneLotInternals.set(String(row._id || ""), (row.internals as string[]) || []);
    }
    // how many active locations per zone (to show zone stats on each location row)
    const locationsPerZone = new Map<string, number>();
    for (const loc of locations as StorageRecord[]) {
      const zc = String((loc as any).zone_code || "");
      locationsPerZone.set(zc, (locationsPerZone.get(zc) ?? 0) + 1);
    }

    const zonesById = new Map(zones.map((zone) => [String(zone.id || ""), zone]));
    return (locations as StorageRecord[]).map((location) => {
      const zoneCode = String((location as any).zone_code || "");
      const stats = zoneStats.get(zoneCode) ?? { kg: 0, lots: 0 };
      const internals = zoneLotInternals.get(zoneCode) ?? [];
      const locCount = Math.max(1, locationsPerZone.get(zoneCode) ?? 1);
      return {
        ...location,
        // zone-level occupancy split evenly across sub-locations
        occupied_kg: Math.round((stats.kg / locCount) * 10) / 10,
        occupied_palettes: Math.ceil(stats.kg / KG_PER_PALETTE / locCount),
        // full zone stats for display context
        zone_total_kg: stats.kg,
        zone_lot_count: stats.lots,
        lot_ids_present: internals,
        storage_zone: zonesById.get(String((location as any).storage_zone_id || "")) || null,
      };
    });
  }

  async listStorageConditionReadings(limit = 80) {
    const safeLimit = Math.min(Math.max(Number(limit || 80), 1), 500);
    const [rows, zones, locations] = await Promise.all([
      sanitizeDocument(
        await getCollectionModel("storage_condition_readings")
          .find({})
          .sort({ reading_at: -1 })
          .limit(safeLimit)
          .lean()
          .exec(),
      ) as Promise<StorageRecord[]>,
      sanitizeDocument(await getCollectionModel("storage_zones").find({}).lean().exec()) as Promise<StorageRecord[]>,
      sanitizeDocument(await getCollectionModel("storage_locations").find({}).lean().exec()) as Promise<StorageRecord[]>,
    ]);

    const zonesById = new Map(zones.map((zone) => [String(zone.id || ""), zone]));
    const locationsById = new Map(locations.map((location) => [String(location.id || ""), location]));

    return rows.map((row) => ({
      ...row,
      storage_zone: zonesById.get(String(row.storage_zone_id || "")) || null,
      storage_location: locationsById.get(String(row.storage_location_id || "")) || null,
    }));
  }

  async listStorageLocationMovements(limit = 80) {
    const safeLimit = Math.min(Math.max(Number(limit || 80), 1), 500);
    const [rows, locations] = await Promise.all([
      sanitizeDocument(
        await getCollectionModel("storage_location_movements")
          .find({})
          .sort({ movement_date: -1 })
          .limit(safeLimit)
          .lean()
          .exec(),
      ) as Promise<StorageRecord[]>,
      sanitizeDocument(await getCollectionModel("storage_locations").find({}).lean().exec()) as Promise<StorageRecord[]>,
    ]);

    const locationsById = new Map(locations.map((location) => [String(location.id || ""), location]));
    return rows.map((row) => ({
      ...row,
      source_location: locationsById.get(String(row.source_location_id || "")) || null,
      destination_location: locationsById.get(String(row.destination_location_id || "")) || null,
    }));
  }

  async listStorageDoorEvents(limit = 80) {
    const safeLimit = Math.min(Math.max(Number(limit || 80), 1), 500);
    return sanitizeDocument(
      await getCollectionModel("storage_door_events")
        .find({})
        .sort({ event_at: -1 })
        .limit(safeLimit)
        .lean()
        .exec(),
    ) as StorageRecord[];
  }

  async listStorageDlcAlerts(limit = 15) {
    const safeLimit = Math.min(Math.max(Number(limit || 15), 1), 100);
    const [notifications, alerts] = await Promise.all([
      sanitizeDocument(
        await SystemNotifications()
          .find({
            is_read: { $ne: true },
            notification_type: { $in: ["DLC_ALERT", "DLC_WARNING", "DLC_CRITIQUE"] },
          })
          .sort({ created_at: -1 })
          .limit(safeLimit)
          .lean()
          .exec(),
      ) as Promise<StorageNotificationRow[]>,
      sanitizeDocument(
        await Alerts()
          .find({
            alert_type: "DLC_PROGRESSIVE",
            status: { $in: ["active", "ACTIVE", "acknowledged"] },
          })
          .sort({ created_at: -1 })
          .limit(safeLimit)
          .lean()
          .exec(),
      ) as Promise<StorageAlertRow[]>,
    ]);

    const mappedAlerts = alerts.map((alert) => ({
      id: String(alert.id || ""),
      title: String(alert.title || "Alerte DLC"),
      message: String(alert.message || ""),
      severity: mapNotificationSeverity(alert.severity),
      notification_type: mapStorageAlertNotificationType(alert),
      created_at: String(alert.created_at || nowIso()),
    }));

    const merged = new Map<string, {
      id: string;
      title: string;
      message: string;
      severity: string;
      notification_type: string;
      created_at: string;
    }>();

    notifications.forEach((notification) => {
      if (!notification.notification_type) return;
      merged.set(String(notification.id || ""), {
        id: String(notification.id || ""),
        title: String(notification.title || ""),
        message: String(notification.message || ""),
        severity: String(notification.severity || "info"),
        notification_type: String(notification.notification_type || ""),
        created_at: String(notification.created_at || nowIso()),
      });
    });

    mappedAlerts.forEach((alert) => {
      if (merged.has(alert.id)) return;
      merged.set(alert.id, alert);
    });

    return Array.from(merged.values())
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(0, safeLimit);
  }

  async seedModule3() {
    const Zones = getCollectionModel("storage_zones");
    const Locations = getCollectionModel("storage_locations");
    const zoneCodes = ROYAL_PALM_MODULE3_ZONES.map((zone) => zone.code);
    const existingZones = await getModelRowsByCode("storage_zones", zoneCodes);
    const zonesByCode = new Map<string, StorageRecord>(existingZones.map((zone) => [String(zone.code), zone]));
    const zonesToInsert: Record<string, unknown>[] = [];

    for (const seed of ROYAL_PALM_MODULE3_ZONES) {
      const existing = zonesByCode.get(seed.code);
      if (existing) {
        const updated = {
          ...seed,
          current_load_kg: asNumber(existing.current_load_kg),
          current_load_palettes: asNumber(existing.current_load_palettes),
          is_active: true,
          updated_at: nowIso(),
        };
        await Zones.updateOne({ id: existing.id }, { $set: updated }).exec();
        zonesByCode.set(seed.code, { ...existing, ...updated });
        continue;
      }

      zonesToInsert.push(
        await prepareInsertDocument("storage_zones", {
          ...seed,
          current_load_kg: 0,
          current_load_palettes: 0,
          condition_status: "normal",
          is_active: true,
        }),
      );
    }

    if (zonesToInsert.length > 0) {
      await Zones.insertMany(zonesToInsert);
      zonesToInsert.forEach((zone) => zonesByCode.set(String(zone.code), zone));
    }

    const locationSeeds = ROYAL_PALM_MODULE3_ZONES.flatMap((zoneSeed) => {
      const zone = zonesByCode.get(zoneSeed.code);
      return buildLocationSeedsForZone(zoneSeed, zone?.id);
    });
    const existingLocations = await getModelRowsByCode(
      "storage_locations",
      locationSeeds.map((location) => location.code),
    );
    const existingLocationCodes = new Set(existingLocations.map((location) => location.code));
    const missingLocations = locationSeeds.filter((location) => !existingLocationCodes.has(location.code));
    const preparedLocations: Record<string, unknown>[] = [];

    for (const location of locationSeeds.filter((item) => existingLocationCodes.has(item.code))) {
      await Locations.updateOne(
        { code: location.code },
        {
          $set: {
            storage_zone_id: location.storage_zone_id,
            zone_code: location.zone_code,
            capacity_palettes: location.capacity_palettes,
            capacity_kg: location.capacity_kg,
            door_distance_rank: location.door_distance_rank,
            updated_at: nowIso(),
          },
        },
      ).exec();
    }

    for (const location of missingLocations) {
      preparedLocations.push(await prepareInsertDocument("storage_locations", location));
    }

    if (preparedLocations.length > 0) {
      await Locations.insertMany(preparedLocations);
    }

    return {
      zonesInserted: zonesToInsert.length,
      zonesSynced: ROYAL_PALM_MODULE3_ZONES.length,
      locationsInserted: preparedLocations.length,
      locationsSynced: locationSeeds.length,
    };
  }

  async suggestLocation(rawPayload: unknown) {
    const payload = rawPayload as SuggestLocationPayload;
    const quantityPalettes = asNumber(payload.quantityPalettes, 1);
    const zone = await findZone({
      id: payload.destinationZoneId,
      code: payload.destinationZoneCode,
    });

    if (!zone) {
      throw notFound("STORAGE_ZONE_NOT_FOUND", "Storage zone was not found.");
    }

    if (zone.is_bio_only && payload.lotIsBio === false) {
      throw conflict("BIO_ZONE_REQUIRES_BIO_LOT", "Bio cold rooms accept only Bio lots.");
    }

    const Locations = getCollectionModel("storage_locations");
    const candidates = sanitizeDocument(
      await Locations.find({
        storage_zone_id: zone.id,
        is_active: true,
        location_status: { $ne: "blocked" },
      }).lean().exec(),
    ) as StorageRecord[];
    const sorted = sortLocationsForSuggestion(candidates, {
      quantityPalettes,
      variety: payload.variety,
      rotationMode: payload.rotationMode || (payload.variety ? "VARIETY" : "FIFO"),
    });

    return {
      zone,
      suggestion: sorted[0] || null,
      alternatives: sorted.slice(0, 5),
      algorithm: payload.variety ? "VARIETY_GROUP_THEN_DOOR_DISTANCE" : "FIFO_DOOR_DISTANCE",
    };
  }

  async suggestFefo(rawPayload: unknown) {
    const payload = rawPayload as FefoPayload;
    const lots = await getFefoCandidates(payload);
    return lots.map((lot) => ({
      ...lot,
      dlc_alert_level: computeDlcAlertLevel(lot.dlc_date),
    }));
  }

  async recordDoorEvent(rawPayload: unknown, user: StorageUser) {
    const payload = rawPayload as DoorEventPayload;
    const zone = await findZone({
      id: payload.storageZoneId,
      code: payload.zoneCode,
    });

    if (!zone) {
      throw notFound("STORAGE_ZONE_NOT_FOUND", "Storage zone was not found.");
    }

    const eventType = String(payload.eventType || "OPEN").trim().toUpperCase();
    if (!["OPEN", "CLOSE"].includes(eventType)) {
      throw badRequest("INVALID_DOOR_EVENT", "Door event must be OPEN or CLOSE.");
    }

    const DoorEvents = getCollectionModel("storage_door_events");
    const eventAt = payload.eventAt || nowIso();
    const prepared = await prepareInsertDocument("storage_door_events", {
      storage_zone_id: zone.id,
      zone_code: zone.code,
      event_type: eventType,
      event_at: eventAt,
      sensor_ref: payload.sensorRef || null,
      recorded_by: user?.id || null,
    });
    await DoorEvents.insertMany([prepared]);

    const recentEvents = sanitizeDocument(
      await DoorEvents.find({
        storage_zone_id: zone.id,
        event_at: { $gte: new Date(Date.now() - 60 * 60_000).toISOString() },
      }).lean().exec(),
    ) as Array<{ event_type?: string | null; event_at?: string | null }>;
    const doorRule = evaluateDoorRule(recentEvents);
    const createdAlerts: StorageAlertRow[] = [];
    const createdNotifications: StorageNotificationRow[] = [];

    if (doorRule.level !== "none") {
      const result = await ensureAlertWithNotification({
        alert_key: `DOOR:${doorRule.level}:${zone.id}`,
        alert_type: doorRule.level === "responsable" ? "COLD_ROOM_DOOR_FREQUENCY" : "COLD_ROOM_DOOR_OPEN",
        title: doorRule.level === "responsable"
          ? `Frequence ouvertures porte ${zone.code}`
          : `Porte ouverte ${zone.code}`,
        message: doorRule.level === "responsable"
          ? `${doorRule.openingsLastHour} ouvertures sur la derniere heure.`
          : `Porte ouverte depuis ${doorRule.openMinutes || 0} min.`,
        severity: doorRule.level === "responsable" ? "warning" : "critical",
        storage_zone_id: zone.id || null,
        notification_channel: doorRule.level === "responsable" ? "RESPONSABLE_STOCK" : "OPERATOR",
      });
      createdAlerts.push(...result.alerts);
      createdNotifications.push(...result.notifications);
    }

    return {
      event: sanitizeDocument(prepared),
      rule: doorRule,
      alerts: createdAlerts,
      notifications: createdNotifications,
    };
  }

  async evaluateBusinessRules() {
    const Zones = getCollectionModel("storage_zones");
    const Locations = getCollectionModel("storage_locations");
    const StockLots = getCollectionModel("stock_lots");
    const CycleCounts = getCollectionModel("storage_cycle_counts");
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    let dlcAlerts = 0;
    let rawDelayAlerts = 0;
    let cycleCountsCreated = 0;
    const createdAlerts: StorageAlertRow[] = [];
    const createdNotifications: StorageNotificationRow[] = [];
    const createdCycleCounts: Record<string, unknown>[] = [];

    const lots = sanitizeDocument(
      await StockLots.find({ current_quantity: { $gt: 0 } }).lean().exec(),
    ) as Array<StorageLotRuleInput & { id?: string }>;

    for (const lot of lots) {
      const level = computeDlcAlertLevel(lot.dlc_date, now);
      if (!level) continue;
      dlcAlerts += 1;
      const result = await ensureAlertWithNotification({
        alert_key: `DLC:${level}:${lot.id || lot.lot_number}`,
        alert_type: "DLC_PROGRESSIVE",
        title: `Alerte DLC ${level.toUpperCase()} - ${lot.lot_number || lot.lot_code}`,
        message: `Lot a prioriser en picking export. DLC: ${lot.dlc_date}.`,
        severity: level === "red" ? "critical" : "warning",
        lot_id: lot.id || null,
        dlc_alert_level: level,
      });
      createdAlerts.push(...result.alerts);
      createdNotifications.push(...result.notifications);
    }

    const rawLocations = sanitizeDocument(
      await Locations.find({
        zone_code: /^SB-/,
        lot_ids_present: { $exists: true, $ne: [] },
      }).lean().exec(),
    ) as StorageRecord[];

    for (const location of rawLocations) {
      if (!isRawStorageDelayed(location as { zone_code?: string | null; last_movement_at?: string | null }, now)) continue;
      rawDelayAlerts += 1;
      const result = await ensureAlertWithNotification({
        alert_key: `RAW_DELAY:${location.id}`,
        alert_type: "RAW_STORAGE_DELAY",
        title: `Delai stockage brut depasse - ${location.code}`,
        message: "Lot en zone SB depuis plus de 48h sans orientation fumigation.",
        severity: "warning",
        storage_location_id: location.id || null,
        storage_zone_id: location.storage_zone_id || null,
      });
      createdAlerts.push(...result.alerts);
      createdNotifications.push(...result.notifications);
    }

    const zones = sanitizeDocument(await Zones.find({ is_active: true }).lean().exec()) as StorageRecord[];
    for (const zone of zones) {
      const existing = await CycleCounts.findOne({
        storage_zone_id: zone.id,
        count_month: currentMonth,
      }).lean().exec();
      if (existing) continue;

      const cycleCount = await prepareInsertDocument("storage_cycle_counts", {
        storage_zone_id: zone.id,
        zone_code: zone.code,
        count_month: currentMonth,
        scheduled_for: `${currentMonth}-28`,
        status: "scheduled",
      });
      await CycleCounts.insertMany([cycleCount]);
      createdCycleCounts.push(sanitizeDocument(cycleCount) as Record<string, unknown>);
      cycleCountsCreated += 1;
    }

    return {
      dlcAlerts,
      rawDelayAlerts,
      cycleCountsCreated,
      evaluatedAt: now.toISOString(),
      alerts: createdAlerts,
      notifications: createdNotifications,
      cycleCounts: createdCycleCounts,
    };
  }

  async recordReading(rawPayload: unknown, user: StorageUser) {
    const payload = rawPayload as RecordReadingPayload;
    const Zones = getCollectionModel("storage_zones");
    const Locations = getCollectionModel("storage_locations");
    const Readings = getCollectionModel("storage_condition_readings");

    const zoneCode = payload.zoneCode ? String(payload.zoneCode).trim().toUpperCase() : "";
    const zoneId = payload.storageZoneId ? String(payload.storageZoneId) : "";
    const zone = sanitizeDocument(
      await Zones.findOne(zoneId ? { id: zoneId } : { code: zoneCode }).lean().exec(),
    ) as StorageRecord | null;

    if (!zone) {
      throw notFound("STORAGE_ZONE_NOT_FOUND", "Storage zone was not found.");
    }

    const location = await findLocation({
      id: payload.locationId,
      code: payload.locationCode,
    });

    if (payload.locationCode) {
      try {
        assertValidLocationCode(payload.locationCode, zone.code);
      } catch (error) {
        throw badRequest(
          "INVALID_LOCATION_CODE",
          error instanceof Error ? error.message : "Invalid location code.",
        );
      }
    }

    if (location && location.storage_zone_id && location.storage_zone_id !== zone.id) {
      throw badRequest("LOCATION_ZONE_MISMATCH", "Location does not belong to the selected storage zone.");
    }

    const reading = {
      storage_zone_id: zone.id || null,
      zone_code: zone.code,
      storage_location_id: location?.id || null,
      location_code: location?.code || (payload.locationCode ? String(payload.locationCode).trim().toUpperCase() : null),
      temperature_c: payload.temperatureC === "" || payload.temperatureC === undefined ? null : Number(payload.temperatureC),
      humidity_percent: payload.humidityPercent === "" || payload.humidityPercent === undefined ? null : Number(payload.humidityPercent),
      gas_ppm: payload.gasPpm === "" || payload.gasPpm === undefined ? null : Number(payload.gasPpm),
      sensor_ref: payload.sensorRef || null,
      recorded_by: payload.recordedBy || user?.id || null,
      reading_at: payload.readingAt || nowIso(),
    };

    const result = computeConditionStatus(zone as Partial<Module3ZoneSeed>, {
      temperature_c: reading.temperature_c,
      humidity_percent: reading.humidity_percent,
      gas_ppm: reading.gas_ppm,
    });

    const prepared = await prepareInsertDocument("storage_condition_readings", {
      ...reading,
      condition_status: result.status,
      messages: result.messages,
    });
    await Readings.insertMany([prepared]);

    const recentReadings = sanitizeDocument(
      await Readings.find({
        storage_zone_id: zone.id,
        reading_at: { $gte: new Date(Date.now() - 31 * 60_000).toISOString() },
      }).lean().exec(),
    ) as Array<{ temperature_c?: number | null; reading_at?: string | null }>;
    const temperatureRule = evaluateTemperatureRule(
      zone as Partial<Module3ZoneSeed>,
      [...recentReadings, prepared as { temperature_c?: number | null; reading_at?: string | null }],
    );
    const createdAlerts: StorageAlertRow[] = [];
    const createdNotifications: StorageNotificationRow[] = [];

    const conditionUpdate = {
      current_temperature_c: reading.temperature_c,
      current_humidity_percent: reading.humidity_percent,
      current_gas_ppm: reading.gas_ppm,
      condition_status: result.status,
      condition_messages: result.messages,
      last_reading_at: reading.reading_at,
      updated_at: nowIso(),
    };

    await Zones.updateOne({ id: zone.id }, { $set: conditionUpdate }).exec();
    if (location) {
      await Locations.updateOne({ id: location.id }, { $set: conditionUpdate }).exec();
    }

    if (result.status === "critical") {
      const alertResult = await ensureAlertWithNotification({
        alert_key: `STORAGE_CONDITION:${zone.id}:${reading.reading_at}`,
        alert_type: "STORAGE_CONDITION",
        title: `Storage condition critical - ${zone.code}`,
        message: result.messages.join(" | ") || "Critical storage condition detected.",
        severity: "critical",
        storage_zone_id: zone.id || null,
      });
      createdAlerts.push(...alertResult.alerts);
      createdNotifications.push(...alertResult.notifications);
    }

    if (temperatureRule.level !== "none") {
      const alertResult = await ensureAlertWithNotification({
        alert_key: `TEMP:${temperatureRule.level}:${zone.id}`,
        alert_type: temperatureRule.level === "critical_sms" ? "COLD_ROOM_TEMP_CRITICAL_SMS" : "COLD_ROOM_TEMP_RED",
        title: temperatureRule.level === "critical_sms"
          ? `Temperature critique ${zone.code} - SMS direction`
          : `Alerte rouge temperature ${zone.code}`,
        message: temperatureRule.level === "critical_sms"
          ? `Temperature > 10C pendant ${temperatureRule.durationMinutes} min. SMS direction requis.`
          : `Temperature > 8C pendant ${temperatureRule.durationMinutes} min.`,
        severity: "critical",
        storage_zone_id: zone.id || null,
        sms_required: temperatureRule.level === "critical_sms",
        notification_channel: temperatureRule.level === "critical_sms" ? "SMS_DIRECTION" : "OPERATOR",
      });
      createdAlerts.push(...alertResult.alerts);
      createdNotifications.push(...alertResult.notifications);
    }

    return sanitizeDocument({
      reading: prepared,
      status: result.status,
      messages: result.messages,
      alerts: createdAlerts,
      notifications: createdNotifications,
    });
  }

  async moveStock(rawPayload: unknown, user: StorageUser) {
    const payload = rawPayload as MoveStockPayload;
    const Locations = getCollectionModel("storage_locations");
    const Movements = getCollectionModel("storage_location_movements");
    const movementType = normalizeMovementType(payload.movementType);
    const movementReason = normalizeMovementReason(payload.reason);
    const quantityPalettes = parseRequiredPaletteQuantity(payload.quantityPalettes);
    const quantityKg = asNumber(payload.quantityKg, 0);
    const lotRef = String(payload.lotId || payload.lotCode || "").trim();
    const lot = await resolveStockLotByRef({ lotId: payload.lotId, lotCode: payload.lotCode });

    if (!lotRef) {
      throw badRequest("LOT_ID_REQUIRED", "LOT-ID is required and should come from a QR scan or selection.");
    }

    if (!lot) {
      throw notFound("LOT_NOT_FOUND", "Scanned LOT-ID was not found in stock lots.");
    }

    const lotIdentifiers = getLotIdentifiers(payload, lot as Record<string, unknown>);
    const movementLotId = String(lot.id || payload.lotId || "");
    const movementLotCode = String(
      lot.lot_number
        || (lot as Record<string, unknown>).source_lot_internal
        || (lot as Record<string, unknown>).source_lot_supplier
        || payload.lotCode
        || lotRef,
    );

    const source = await findLocation({
      id: payload.sourceLocationId,
      code: payload.sourceLocationCode,
    });
    let destination = await findLocation({
      id: payload.destinationLocationId,
      code: payload.destinationLocationCode,
    });

    const sourceRequired = movementType !== "ENTREE_ZONE";
    const destinationRequired = movementType !== "SORTIE_ZONE";

    if (sourceRequired && !source) {
      throw badRequest("SOURCE_LOCATION_REQUIRED", "Source location is required except for zone entry movements.");
    }

    if (!destination && destinationRequired) {
      destination = await suggestDestinationLocation({
        destinationZoneId: payload.destinationZoneId,
        destinationZoneCode: payload.destinationZoneCode,
        quantityPalettes,
        variety: payload.variety || lot?.variety || undefined,
        lotIsBio: payload.lotIsBio ?? lot?.is_bio ?? undefined,
      });
    }

    if (destinationRequired && !destination) {
      throw notFound("DESTINATION_LOCATION_NOT_FOUND", "Destination location was not found.");
    }

    if (destination) {
      const destinationStatus = String(destination.location_status || "free") as StorageLocationStatus;
      if (destinationStatus === "blocked") {
        throw conflict("DESTINATION_BLOCKED", "Destination location is blocked.");
      }
    }

    if (source && asNumber(source.occupied_palettes) < quantityPalettes) {
      throw conflict("SOURCE_QUANTITY_EXCEEDED", "Source location does not contain enough palettes.");
    }

    if (source) {
      const sourceLots = Array.isArray(source.lot_ids_present) ? source.lot_ids_present.map(String) : [];
      if (sourceLots.length > 0 && !sourceLots.some((item) => lotIdentifiers.includes(item))) {
        throw conflict("LOT_NOT_IN_SOURCE_LOCATION", "Scanned LOT-ID is not present in the selected source location.");
      }
    }

    const destCapacityPalettes = destination ? asNumber(destination.capacity_palettes) : 0;
    const destOccupiedPalettes = destination ? asNumber(destination.occupied_palettes) : 0;
    if (destination && destCapacityPalettes > 0 && destOccupiedPalettes + quantityPalettes > destCapacityPalettes) {
      throw conflict("DESTINATION_CAPACITY_EXCEEDED", "Destination capacity would be exceeded.");
    }

    const fefoAlertBundle = await validateFefoPicking(payload, lot);
    const varietyAlertBundle = await enforceVarietyAndBioRules(payload, destination, lot);

    const sourceAfterPalettes = source ? Math.max(0, asNumber(source.occupied_palettes) - quantityPalettes) : 0;
    const sourceAfterKg = source ? Math.max(0, asNumber(source.occupied_kg) - quantityKg) : 0;
    const destinationAfterPalettes = destOccupiedPalettes + quantityPalettes;
    const destinationAfterKg = destination ? asNumber(destination.occupied_kg) + quantityKg : 0;
    const movementDate = nowIso();

    if (source) {
      const currentLots = Array.isArray(source.lot_ids_present) ? source.lot_ids_present.map(String) : [];
      const nextLots = sourceAfterPalettes <= 0 && lotRef
        ? currentLots.filter((item) => !lotIdentifiers.includes(item))
        : currentLots;

      await Locations.updateOne(
        { id: source.id },
        {
          $set: {
            occupied_palettes: sourceAfterPalettes,
            occupied_kg: sourceAfterKg,
            location_status: computeLocationStatus(asNumber(source.capacity_palettes), sourceAfterPalettes, source.location_status),
            lot_ids_present: nextLots,
            last_movement_at: movementDate,
            updated_at: nowIso(),
          },
        },
      ).exec();
      await updateZoneLoad(source.storage_zone_id, -quantityPalettes, -quantityKg);
    }

    if (destination) {
      await Locations.updateOne(
        { id: destination.id },
        {
          $set: {
            occupied_palettes: destinationAfterPalettes,
            occupied_kg: destinationAfterKg,
            location_status: computeLocationStatus(destCapacityPalettes, destinationAfterPalettes, destination.location_status),
            lot_ids_present: unique([...(Array.isArray(destination.lot_ids_present) ? destination.lot_ids_present.map(String) : []), movementLotCode]),
            last_movement_at: movementDate,
            updated_at: nowIso(),
          },
        },
      ).exec();
      await updateZoneLoad(destination.storage_zone_id, quantityPalettes, quantityKg);
    }

    const preparedMovement = await prepareInsertDocument("storage_location_movements", {
      movement_type: movementType,
      movement_date: movementDate,
      lot_id: movementLotId || null,
      lot_code: movementLotCode || null,
      source_location_id: source?.id || null,
      source_location_code: source?.code || null,
      source_zone_code: source?.zone_code || null,
      destination_location_id: destination?.id || null,
      destination_location_code: destination?.code || null,
      destination_zone_code: destination?.zone_code || payload.destinationZoneCode || null,
      quantity_palettes: quantityPalettes,
      quantity_kg: quantityKg,
      movement_reason: movementReason,
      reason: movementReason,
      destination_suggested_by_system: !payload.destinationLocationId && !payload.destinationLocationCode && !!destination,
      performed_by: user?.id || null,
      notes: payload.notes || null,
    });

    await Movements.insertMany([preparedMovement]);
    await syncLotMovementHistory(payload, lot, source, destination, quantityKg, movementDate, movementType, user?.id || null);

    if (movementLotId) {
      const StockLots = getCollectionModel("stock_lots");
      const lotUpdate: Record<string, unknown> = { updated_at: nowIso() };
      if (destination) {
        lotUpdate.storage_location_id = destination.id;
        lotUpdate.storage_location_code = destination.code || null;
      } else if (movementType === "SORTIE_ZONE") {
        lotUpdate.storage_location_id = null;
        lotUpdate.storage_location_code = null;
      }
      await StockLots.updateOne({ id: movementLotId }, { $set: lotUpdate }).exec();

      // Keep reception_lots.storage_zone_code in sync so listModule3Zones aggregation stays accurate
      const ReceptionLots = getCollectionModel("reception_lots");
      const receptionLotUpdate: Record<string, unknown> = { updated_at: nowIso() };
      if (destination?.zone_code) {
        receptionLotUpdate.storage_zone_code = destination.zone_code;
      } else if (movementType === "SORTIE_ZONE") {
        receptionLotUpdate.storage_zone_code = null;
      }
      if (Object.keys(receptionLotUpdate).length > 1) {
        await ReceptionLots.updateOne(
          {
            $or: [
              { id: movementLotId },
              { lot_internal: movementLotCode },
              { lot_supplier: movementLotCode },
            ],
          },
          { $set: receptionLotUpdate },
        ).exec();
      }
    }

    const updatedRows = sanitizeDocument(
      await Locations.find({
        id: { $in: [source?.id, destination?.id].filter(Boolean) },
      }).lean().exec(),
    );

    return {
      movement: sanitizeDocument(preparedMovement),
      locations: updatedRows,
      alerts: [...fefoAlertBundle.alerts, ...varietyAlertBundle.alerts],
      notifications: [...fefoAlertBundle.notifications, ...varietyAlertBundle.notifications],
    };
  }

  // ── Zone CRUD ─────────────────────────────────────────────────────────────

  /** Find a zone by its application `id` field OR by MongoDB `_id` as fallback (for legacy documents). */
  private async findZoneById(id: string): Promise<StorageRecord | null> {
    const Zones = getCollectionModel("storage_zones");
    let doc = sanitizeDocument(await Zones.findOne({ id }).lean().exec()) as StorageRecord | null;
    if (!doc && mongoose.Types.ObjectId.isValid(id)) {
      doc = sanitizeDocument(
        await Zones.findOne({ _id: new mongoose.Types.ObjectId(id) }).lean().exec(),
      ) as StorageRecord | null;
    }
    return doc;
  }

  /** Build the query filter that matches a zone regardless of whether it uses `id` field or `_id`. */
  private zoneFilter(id: string, storedId?: unknown): Record<string, unknown> {
    if (storedId) return { id: storedId };
    if (mongoose.Types.ObjectId.isValid(id)) return { _id: new mongoose.Types.ObjectId(id) };
    return { id };
  }

  async createZone(payload: Record<string, unknown>) {
    const Zones = getCollectionModel("storage_zones");
    const code = String(payload.code || "").trim().toUpperCase();
    if (!code) throw badRequest("ZONE_CODE_REQUIRED", "Zone code is required.");
    if (!payload.name) throw badRequest("ZONE_NAME_REQUIRED", "Zone name is required.");

    const existing = sanitizeDocument(await Zones.findOne({ code }).lean().exec());
    if (existing) throw conflict("ZONE_CODE_EXISTS", `Zone ${code} already exists.`);

    const prepared = await prepareInsertDocument("storage_zones", {
      code,
      name: String(payload.name).trim(),
      storage_family: String(payload.storage_family || "raw"),
      zone_type: String(payload.zone_type || "standard"),
      capacity_kg: asNumber(payload.capacity_kg, 0),
      capacity_palettes: payload.capacity_palettes != null ? asNumber(payload.capacity_palettes) : null,
      current_load_kg: 0,
      current_load_palettes: 0,
      temperature_min: payload.temperature_min != null ? asNumber(payload.temperature_min) : null,
      temperature_max: payload.temperature_max != null ? asNumber(payload.temperature_max) : null,
      humidity_min: payload.humidity_min != null ? asNumber(payload.humidity_min) : null,
      humidity_max: payload.humidity_max != null ? asNumber(payload.humidity_max) : null,
      is_bio_only: Boolean(payload.is_bio_only ?? false),
      is_active: payload.is_active !== false,
      notes: payload.notes ? String(payload.notes) : null,
      condition_status: "normal",
    });
    await Zones.insertMany([prepared]);
    return sanitizeDocument(prepared);
  }

  async updateZone(id: string, payload: Record<string, unknown>) {
    const Zones = getCollectionModel("storage_zones");
    const zone = await this.findZoneById(id);
    if (!zone) throw notFound("ZONE_NOT_FOUND", "Storage zone not found.");

    if (payload.code) {
      const newCode = String(payload.code).trim().toUpperCase();
      const dup = sanitizeDocument(await Zones.findOne({ code: newCode }).lean().exec()) as StorageRecord | null;
      if (dup && dup.id !== zone.id) throw conflict("ZONE_CODE_EXISTS", `Zone code ${newCode} is already used.`);
    }

    const update: Record<string, unknown> = { updated_at: nowIso() };
    if (payload.code !== undefined) update.code = String(payload.code).trim().toUpperCase();
    if (payload.name !== undefined) update.name = String(payload.name).trim();
    if (payload.storage_family !== undefined) update.storage_family = String(payload.storage_family);
    if (payload.capacity_kg !== undefined) update.capacity_kg = asNumber(payload.capacity_kg);
    if (payload.capacity_palettes !== undefined) update.capacity_palettes = payload.capacity_palettes != null ? asNumber(payload.capacity_palettes) : null;
    if (payload.temperature_min !== undefined) update.temperature_min = payload.temperature_min != null ? asNumber(payload.temperature_min) : null;
    if (payload.temperature_max !== undefined) update.temperature_max = payload.temperature_max != null ? asNumber(payload.temperature_max) : null;
    if (payload.humidity_min !== undefined) update.humidity_min = payload.humidity_min != null ? asNumber(payload.humidity_min) : null;
    if (payload.humidity_max !== undefined) update.humidity_max = payload.humidity_max != null ? asNumber(payload.humidity_max) : null;
    if (payload.is_bio_only !== undefined) update.is_bio_only = Boolean(payload.is_bio_only);
    if (payload.is_active !== undefined) update.is_active = Boolean(payload.is_active);
    if (payload.notes !== undefined) update.notes = payload.notes ? String(payload.notes) : null;

    await Zones.updateOne(this.zoneFilter(id, zone.id), { $set: update }).exec();
    return sanitizeDocument({ ...zone, ...update });
  }

  async deleteZone(id: string) {
    const Zones = getCollectionModel("storage_zones");
    const zone = await this.findZoneById(id);
    if (!zone) throw notFound("ZONE_NOT_FOUND", "Storage zone not found.");

    const activeLots = await getCollectionModel("reception_lots").countDocuments({
      storage_zone_code: zone.code,
      stock_status: { $in: ["EN_QUARANTAINE", "STOCK_LIBERE"] },
    }).exec();
    if (activeLots > 0) {
      throw conflict("ZONE_HAS_ACTIVE_LOTS", `Cannot delete zone ${zone.code}: ${activeLots} active lot(s) assigned. Move or reject them first.`);
    }

    await Zones.updateOne(this.zoneFilter(id, zone.id), { $set: { is_active: false, updated_at: nowIso() } }).exec();
    return { id: zone.id, code: zone.code };
  }

  // ── Location CRUD ─────────────────────────────────────────────────────────

  async createLocation(payload: Record<string, unknown>) {
    const Locations = getCollectionModel("storage_locations");
    const code = String(payload.code || "").trim().toUpperCase();
    if (!code) throw badRequest("LOCATION_CODE_REQUIRED", "Location code is required.");
    if (!payload.storage_zone_id) throw badRequest("STORAGE_ZONE_ID_REQUIRED", "Storage zone ID is required.");

    const existing = sanitizeDocument(await Locations.findOne({ code }).lean().exec());
    if (existing) throw conflict("LOCATION_CODE_EXISTS", `Location ${code} already exists.`);

    const zone = sanitizeDocument(await getCollectionModel("storage_zones").findOne({ id: String(payload.storage_zone_id) }).lean().exec()) as StorageRecord | null;
    if (!zone) throw notFound("ZONE_NOT_FOUND", "Storage zone not found.");

    const prepared = await prepareInsertDocument("storage_locations", {
      code,
      name: String(payload.name || "").trim() || code,
      storage_zone_id: String(payload.storage_zone_id),
      zone_code: zone.code || null,
      capacity_palettes: asNumber(payload.capacity_palettes, 0),
      capacity_kg: payload.capacity_kg != null ? asNumber(payload.capacity_kg) : 0,
      occupied_palettes: 0,
      occupied_kg: 0,
      location_status: "free" as StorageLocationStatus,
      lot_ids_present: [],
      condition_status: "normal",
      is_active: payload.is_active !== false,
    });
    await Locations.insertMany([prepared]);
    return sanitizeDocument({ ...prepared, storage_zone: zone });
  }

  private async findLocationById(id: string): Promise<StorageRecord | null> {
    const Locations = getCollectionModel("storage_locations");
    let doc = sanitizeDocument(await Locations.findOne({ id }).lean().exec()) as StorageRecord | null;
    if (!doc && mongoose.Types.ObjectId.isValid(id)) {
      doc = sanitizeDocument(
        await Locations.findOne({ _id: new mongoose.Types.ObjectId(id) }).lean().exec(),
      ) as StorageRecord | null;
    }
    return doc;
  }

  private locationFilter(id: string, storedId?: unknown): Record<string, unknown> {
    if (storedId) return { id: storedId };
    if (mongoose.Types.ObjectId.isValid(id)) return { _id: new mongoose.Types.ObjectId(id) };
    return { id };
  }

  async updateLocation(id: string, payload: Record<string, unknown>) {
    const Locations = getCollectionModel("storage_locations");
    const loc = await this.findLocationById(id);
    if (!loc) throw notFound("LOCATION_NOT_FOUND", "Storage location not found.");

    const update: Record<string, unknown> = { updated_at: nowIso() };
    if (payload.code !== undefined) {
      const newCode = String(payload.code).trim().toUpperCase();
      const dup = sanitizeDocument(await Locations.findOne({ code: newCode }).lean().exec()) as StorageRecord | null;
      if (dup && dup.id !== loc.id) throw conflict("LOCATION_CODE_EXISTS", `Location code ${newCode} is already used.`);
      update.code = newCode;
    }
    if (payload.name !== undefined) update.name = String(payload.name).trim();
    if (payload.capacity_palettes !== undefined) update.capacity_palettes = asNumber(payload.capacity_palettes);
    if (payload.capacity_kg !== undefined) update.capacity_kg = asNumber(payload.capacity_kg);
    if (payload.is_active !== undefined) update.is_active = Boolean(payload.is_active);

    if (payload.storage_zone_id && payload.storage_zone_id !== loc.storage_zone_id) {
      const zone = await this.findZoneById(String(payload.storage_zone_id));
      if (!zone) throw notFound("ZONE_NOT_FOUND", "Storage zone not found.");
      update.storage_zone_id = String(payload.storage_zone_id);
      update.zone_code = zone.code || null;
    }

    await Locations.updateOne(this.locationFilter(id, loc.id), { $set: update }).exec();
    return sanitizeDocument({ ...loc, ...update });
  }

  async deleteLocation(id: string) {
    const Locations = getCollectionModel("storage_locations");
    const loc = await this.findLocationById(id);
    if (!loc) throw notFound("LOCATION_NOT_FOUND", "Storage location not found.");

    const lotsPresent = Array.isArray(loc.lot_ids_present) ? loc.lot_ids_present.filter(Boolean) : [];
    if (lotsPresent.length > 0) {
      throw conflict("LOCATION_HAS_LOTS", `Cannot delete location ${loc.code}: ${lotsPresent.length} lot(s) present. Move them first.`);
    }

    await Locations.updateOne(this.locationFilter(id, loc.id), { $set: { is_active: false, updated_at: nowIso() } }).exec();
    return { id: loc.id, code: loc.code };
  }
}

export const storageService = new StorageService();
