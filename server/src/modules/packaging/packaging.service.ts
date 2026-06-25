import { Injectable } from "@nestjs/common";

import { badRequest, notFound } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";

type LabelStatus = "BROUILLON" | "VALIDE" | "ARCHIVE";
type PackagingOrderStatus = "PLANIFIE" | "EN_COURS" | "PAUSE" | "TERMINE" | "ANNULE";

type PackagingBomRow = Record<string, unknown> & {
  id?: string;
  is_active?: boolean | null;
};

type LabelTemplateRow = Record<string, unknown> & {
  id?: string;
  status?: LabelStatus | null;
  is_active?: boolean | null;
};

type PrivateLabelClientRow = Record<string, unknown> & {
  id?: string;
  active?: boolean | null;
};

type PackagingOrderRow = Record<string, unknown> & {
  id?: string;
  order_number?: string;
  status?: PackagingOrderStatus | null;
  source_sublot_id?: string | null;
  source_lot_number?: string | null;
  target_units?: number | null;
  produced_units?: number | null;
  created_by?: string | null;
  bom_name?: string | null;
  grade?: string | null;
  label_template_id?: string | null;
};

type PackagingPaletteRow = Record<string, unknown> & {
  id?: string;
  order_id?: string | null;
  palette_number?: string | null;
  status?: string | null;
  net_weight_kg?: number | null;
  storage_location_id?: string | null;
};

type TriageSubLotRow = Record<string, unknown> & {
  id?: string;
  lot_number?: string | null;
  grade?: string | null;
  weight_kg?: number | null;
  destination?: string | null;
  origin_country?: string | null;
  parent_reception_id?: string | null;
  parent_lot_number?: string | null;
  variety?: string | null;
};

const PackagingBoms = () => getCollectionModel("packaging_bom");
const LabelTemplates = () => getCollectionModel("label_templates");
const PrivateLabelClients = () => getCollectionModel("private_label_clients");
const PackagingOrders = () => getCollectionModel("packaging_orders");
const PackagingPalettes = () => getCollectionModel("packaging_palettes");
const TriageSublots = () => getCollectionModel("triage_sublots");
const StockLots = () => getCollectionModel("stock_lots");
const StockMovements = () => getCollectionModel("stock_movements");
const Notifications = () => getCollectionModel("system_notifications");

const readNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const computeTargetUnits = (sourceWeightKg: number, netWeightG: number) =>
  Math.floor((sourceWeightKg * 1000) / netWeightG);

const computePaletteGrossWeightKg = (
  boxCount: number,
  grossWeightG: number,
  palletWeightKg = 25,
) => Number((((boxCount * grossWeightG) / 1000) + palletWeightKg).toFixed(2));

const computeGS1CheckDigit = (digits: string) => {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const digit = parseInt(digits[digits.length - 1 - index] || "0", 10);
    sum += digit * (index % 2 === 0 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
};

const generateSSCC = (serialNumber: number) => {
  const extension = "0";
  const companyPrefix = "09999999";
  const serial = String(serialNumber).padStart(8, "0");
  const base17 = extension + companyPrefix + serial;
  return base17 + computeGS1CheckDigit(base17);
};

const nowIso = () => new Date().toISOString();
const todayIsoDate = () => nowIso().slice(0, 10);
const todayCompact = () => todayIsoDate().replace(/-/g, "");

const nextPackagingOrderNumber = async () => {
  const dayStart = `${todayIsoDate()}T00:00:00.000Z`;
  const seq = (await PackagingOrders().countDocuments({ created_at: { $gte: dayStart } }).exec()) + 1;
  return `PKG-${todayCompact()}-${String(seq).padStart(3, "0")}`;
};

const nextPaletteNumber = async () => {
  const dayStart = `${todayIsoDate()}T00:00:00.000Z`;
  const seq = (await PackagingPalettes().countDocuments({ created_at: { $gte: dayStart } }).exec()) + 1;
  return `PAL-${todayCompact()}-${String(seq).padStart(3, "0")}`;
};

const createPackagingNotification = async (input: {
  notification_type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error" | "success";
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
}) => {
  try {
    const notification = await prepareInsertDocument("system_notifications", {
      notification_type: input.notification_type,
      category: "packaging",
      title: input.title,
      message: input.message,
      severity: input.severity,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      metadata: input.metadata ?? null,
      status: "ACTIVE",
      is_read: false,
    });
    await Notifications().create([notification]);
  } catch (error) {
    console.error("[Packaging] failed to create system notification:", error);
  }
};

const cleanPatch = (patch: Record<string, unknown>, blocked: string[] = []) => {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch || {})) {
    if (value === undefined) continue;
    if (blocked.includes(key)) continue;
    next[key] = value;
  }
  return next;
};

@Injectable()
export class PackagingService {
  async listBoms() {
    return sanitizeDocument(
      await PackagingBoms().find({}).sort({ name: 1 }).lean().exec(),
    ) as PackagingBomRow[];
  }

  async createBom(payload: Record<string, unknown>) {
    const now = nowIso();
    const bom = await prepareInsertDocument("packaging_bom", {
      ...payload,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
    await PackagingBoms().create([bom]);
    return sanitizeDocument(bom);
  }

  async updateBom(id: string, payload: Record<string, unknown>) {
    const existing = await PackagingBoms().findOne({ id }).lean().exec();
    if (!existing) throw notFound("PACKAGING_BOM_NOT_FOUND", "Nomenclature introuvable.");

    await PackagingBoms().updateOne(
      { id },
      {
        $set: {
          ...cleanPatch(payload, ["id", "created_at"]),
          updated_at: nowIso(),
        },
      },
    ).exec();

    return sanitizeDocument(await PackagingBoms().findOne({ id }).lean().exec());
  }

  async toggleBomActive(id: string, isActive: boolean) {
    const existing = await PackagingBoms().findOne({ id }).lean().exec();
    if (!existing) throw notFound("PACKAGING_BOM_NOT_FOUND", "Nomenclature introuvable.");

    await PackagingBoms().updateOne(
      { id },
      { $set: { is_active: !isActive, updated_at: nowIso() } },
    ).exec();

    return sanitizeDocument(await PackagingBoms().findOne({ id }).lean().exec());
  }

  async listLabelTemplates(status?: LabelStatus) {
    const query = status ? { status } : {};
    return sanitizeDocument(
      await LabelTemplates().find(query).sort({ name: 1 }).lean().exec(),
    ) as LabelTemplateRow[];
  }

  async createLabelTemplate(payload: Record<string, unknown>) {
    const now = nowIso();
    const template = await prepareInsertDocument("label_templates", {
      ...payload,
      status: "BROUILLON" as LabelStatus,
      approved_by: null,
      approved_at: null,
      is_active: false,
      created_at: now,
      updated_at: now,
    });
    await LabelTemplates().create([template]);
    return sanitizeDocument(template);
  }

  async updateLabelTemplate(id: string, payload: Record<string, unknown>) {
    const existing = await LabelTemplates().findOne({ id }).lean().exec();
    if (!existing) throw notFound("LABEL_TEMPLATE_NOT_FOUND", "Modèle d'étiquette introuvable.");

    await LabelTemplates().updateOne(
      { id },
      {
        $set: {
          ...cleanPatch(payload, ["id", "created_at"]),
          updated_at: nowIso(),
        },
      },
    ).exec();

    return sanitizeDocument(await LabelTemplates().findOne({ id }).lean().exec());
  }

  async approveLabelTemplate(id: string, approvedBy: string) {
    if (!readString(approvedBy)) {
      throw badRequest("APPROVER_REQUIRED", "approved_by est requis.");
    }

    const existing = await LabelTemplates().findOne({ id }).lean().exec();
    if (!existing) throw notFound("LABEL_TEMPLATE_NOT_FOUND", "Modèle d'étiquette introuvable.");

    await LabelTemplates().updateOne(
      { id },
      {
        $set: {
          status: "VALIDE",
          approved_by: approvedBy,
          approved_at: nowIso(),
          is_active: true,
          updated_at: nowIso(),
        },
      },
    ).exec();

    return sanitizeDocument(await LabelTemplates().findOne({ id }).lean().exec());
  }

  async archiveLabelTemplate(id: string) {
    const existing = await LabelTemplates().findOne({ id }).lean().exec();
    if (!existing) throw notFound("LABEL_TEMPLATE_NOT_FOUND", "Modèle d'étiquette introuvable.");

    await LabelTemplates().updateOne(
      { id },
      { $set: { status: "ARCHIVE", is_active: false, updated_at: nowIso() } },
    ).exec();

    return sanitizeDocument(await LabelTemplates().findOne({ id }).lean().exec());
  }

  async listPrivateLabelClients() {
    return sanitizeDocument(
      await PrivateLabelClients().find({}).sort({ name: 1 }).lean().exec(),
    ) as PrivateLabelClientRow[];
  }

  async createPrivateLabelClient(payload: Record<string, unknown>) {
    const now = nowIso();
    const client = await prepareInsertDocument("private_label_clients", {
      ...payload,
      active: true,
      created_at: now,
      updated_at: now,
    });
    await PrivateLabelClients().create([client]);
    return sanitizeDocument(client);
  }

  async togglePrivateLabelClient(id: string, active: boolean) {
    const existing = await PrivateLabelClients().findOne({ id }).lean().exec();
    if (!existing) throw notFound("PRIVATE_LABEL_CLIENT_NOT_FOUND", "Client marque blanche introuvable.");

    await PrivateLabelClients().updateOne(
      { id },
      { $set: { active: !active, updated_at: nowIso() } },
    ).exec();

    return sanitizeDocument(await PrivateLabelClients().findOne({ id }).lean().exec());
  }

  async listAvailableSublots() {
    const [sublots, orders] = await Promise.all([
      sanitizeDocument(
        await TriageSublots()
          .find({ destination: { $in: ["CONDITIONNEMENT_PREMIUM", "CONDITIONNEMENT_STANDARD"] } })
          .sort({ created_at: -1 })
          .lean()
          .exec(),
      ) as Promise<TriageSubLotRow[]>,
      sanitizeDocument(
        await PackagingOrders().find({}).sort({ created_at: -1 }).lean().exec(),
      ) as Promise<PackagingOrderRow[]>,
    ]);

    const usedIds = new Set(
      orders
        .filter((order) => String(order.status || "") !== "ANNULE")
        .map((order) => String(order.source_sublot_id || ""))
        .filter(Boolean),
    );

    return sublots.filter((sublot) => !usedIds.has(String(sublot.id || "")));
  }

  async listOrders(status?: PackagingOrderStatus) {
    const rows = sanitizeDocument(
      await PackagingOrders().find({}).sort({ created_at: -1 }).limit(200).lean().exec(),
    ) as PackagingOrderRow[];

    return status ? rows.filter((row) => row.status === status) : rows;
  }

  async createOrder(payload: Record<string, unknown>) {
    const orderNumber = await nextPackagingOrderNumber();
    const targetUnits = computeTargetUnits(
      readNumber(payload.source_weight_kg),
      readNumber(payload.bom_net_weight_g),
    );
    const now = nowIso();

    const order = await prepareInsertDocument("packaging_orders", {
      order_number: orderNumber,
      status: "PLANIFIE" as PackagingOrderStatus,
      source_sublot_id: payload.source_sublot_id,
      source_lot_number: payload.source_lot_number,
      source_weight_kg: readNumber(payload.source_weight_kg),
      grade: payload.grade,
      bom_id: payload.bom_id,
      bom_name: payload.bom_name,
      bom_format: payload.bom_format,
      label_template_id: payload.label_template_id,
      label_template_name: payload.label_template_name,
      target_units: targetUnits,
      produced_units: 0,
      rejected_units: 0,
      checkweigher_count: 0,
      checkweigher_failures: 0,
      metal_detector_failures: 0,
      line: payload.line,
      planned_at: payload.planned_at,
      operator_name: payload.operator_name,
      chef_ligne: payload.chef_ligne ?? null,
      worker_count: readNumber(payload.worker_count),
      notes: payload.notes ?? null,
      started_at: null,
      ended_at: null,
      duration_minutes: null,
      created_by: payload.created_by ?? null,
      created_at: now,
      updated_at: now,
    });

    await PackagingOrders().create([order]);

    try {
      const stockLot = sanitizeDocument(
        await StockLots()
          .findOne({ lot_number: order.source_lot_number, source_stage: "TRIAGE" })
          .lean()
          .exec(),
      ) as Record<string, unknown> | null;

      if (stockLot?.id) {
        await StockLots().updateOne(
          { id: stockLot.id },
          { $set: { status: "CONSUMED", updated_at: now } },
        ).exec();

        const movement = await prepareInsertDocument("stock_movements", {
          movement_type: "CONSOMMATION",
          lot_id: stockLot.id,
          product_id: null,
          quantity: readNumber(stockLot.current_quantity),
          unit: stockLot.unit ?? "kg",
          document_type: "PACKAGING_ORDER",
          document_reference: order.order_number,
          performed_by: order.created_by ?? null,
          notes: `Consommation par OF ${order.order_number}`,
          created_at: now,
        });
        await StockMovements().create([movement]);
      }
    } catch (error) {
      console.error("[Packaging] triage stock consumption sync failed:", error);
    }

    return sanitizeDocument(order);
  }

  async startOrder(id: string, labelStatus: LabelStatus) {
    const existing = await PackagingOrders().findOne({ id }).lean().exec();
    if (!existing) throw notFound("PACKAGING_ORDER_NOT_FOUND", "Ordre de conditionnement introuvable.");

    if (labelStatus !== "VALIDE") {
      await createPackagingNotification({
        notification_type: "AL-PKG-03",
        title: "Démarrage OF avec étiquette non validée",
        message: `Tentative de démarrage de l'OF ${String((existing as any)?.order_number || id)} avec une étiquette non validée.`,
        severity: "warning",
        entity_type: "packaging_order",
        entity_id: id,
      });
      throw badRequest("LABEL_NOT_VALIDATED", "L'étiquette doit être validée (statut VALIDE) avant le démarrage.");
    }

    await PackagingOrders().updateOne(
      { id },
      { $set: { status: "EN_COURS", started_at: nowIso(), updated_at: nowIso() } },
    ).exec();

    return sanitizeDocument(await PackagingOrders().findOne({ id }).lean().exec());
  }

  async updateProgress(id: string, payload: Record<string, unknown>) {
    const existing = sanitizeDocument(await PackagingOrders().findOne({ id }).lean().exec()) as PackagingOrderRow | null;
    if (!existing) throw notFound("PACKAGING_ORDER_NOT_FOUND", "Ordre de conditionnement introuvable.");

    const checkweigherCount = readNumber(payload.checkweigher_count);
    const checkweigherFailures = readNumber(payload.checkweigher_failures);
    const metalDetectorFailures = readNumber(payload.metal_detector_failures);
    const orderNumber = readString(payload.order_number, existing.order_number, id);

    if (metalDetectorFailures > 0) {
      await createPackagingNotification({
        notification_type: "AL-PKG-02",
        title: `Détection métal — OF ${orderNumber}`,
        message: `Détection métal enregistrée sur l'OF ${orderNumber}. Arrêt immédiat requis.`,
        severity: "error",
        entity_type: "packaging_order",
        entity_id: id,
        metadata: { metal_detector_failures: metalDetectorFailures },
      });
    }

    if (checkweigherCount > 0 && checkweigherFailures / checkweigherCount > 0.02) {
      await createPackagingNotification({
        notification_type: "AL-PKG-01",
        title: `Taux d'échec pondéral élevé — OF ${orderNumber}`,
        message: `Taux d'échec pondéral ${((checkweigherFailures / checkweigherCount) * 100).toFixed(1)}% sur l'OF ${orderNumber}.`,
        severity: "warning",
        entity_type: "packaging_order",
        entity_id: id,
        metadata: {
          checkweigher_count: checkweigherCount,
          checkweigher_failures: checkweigherFailures,
        },
      });
    }

    await PackagingOrders().updateOne(
      { id },
      {
        $set: {
          produced_units: readNumber(payload.produced_units),
          rejected_units: readNumber(payload.rejected_units),
          checkweigher_count: checkweigherCount,
          checkweigher_failures: checkweigherFailures,
          metal_detector_failures: metalDetectorFailures,
          updated_at: nowIso(),
        },
      },
    ).exec();

    return sanitizeDocument(await PackagingOrders().findOne({ id }).lean().exec());
  }

  async toggleRunState(id: string, currentStatus: PackagingOrderStatus) {
    const existing = await PackagingOrders().findOne({ id }).lean().exec();
    if (!existing) throw notFound("PACKAGING_ORDER_NOT_FOUND", "Ordre de conditionnement introuvable.");

    const nextStatus = currentStatus === "EN_COURS" ? "PAUSE" : "EN_COURS";
    await PackagingOrders().updateOne(
      { id },
      { $set: { status: nextStatus, updated_at: nowIso() } },
    ).exec();

    return { status: nextStatus };
  }

  async closeOrder(id: string, payload: Record<string, unknown>) {
    const existing = sanitizeDocument(await PackagingOrders().findOne({ id }).lean().exec()) as PackagingOrderRow | null;
    if (!existing) throw notFound("PACKAGING_ORDER_NOT_FOUND", "Ordre de conditionnement introuvable.");

    const startedAt = readString(payload.started_at, existing.started_at);
    if (!startedAt) {
      throw badRequest("START_TIME_REQUIRED", "started_at est requis pour clôturer l'ordre.");
    }

    const producedUnits = readNumber(payload.produced_units, existing.produced_units);
    const targetUnits = readNumber(payload.target_units, existing.target_units);
    const orderNumber = readString(payload.order_number, existing.order_number, id);
    const now = new Date();
    const durationMinutes = Math.round((now.getTime() - new Date(startedAt).getTime()) / 60_000);

    if (targetUnits > 0 && producedUnits / targetUnits < 0.95) {
      await createPackagingNotification({
        notification_type: "AL-PKG-04",
        title: `Rendement faible — OF ${orderNumber}`,
        message: `Rendement ${((producedUnits / targetUnits) * 100).toFixed(1)}% inférieur à 95% sur l'OF ${orderNumber}.`,
        severity: "warning",
        entity_type: "packaging_order",
        entity_id: id,
      });
    }

    await PackagingOrders().updateOne(
      { id },
      {
        $set: {
          status: "TERMINE",
          ended_at: now.toISOString(),
          duration_minutes: durationMinutes,
          updated_at: now.toISOString(),
        },
      },
    ).exec();

    return sanitizeDocument(await PackagingOrders().findOne({ id }).lean().exec());
  }

  async listPalettes(orderId?: string) {
    const query = orderId ? { order_id: orderId } : {};
    const cursor = PackagingPalettes().find(query);
    if (orderId) {
      cursor.sort({ created_at: 1 });
    } else {
      cursor.sort({ created_at: -1 }).limit(500);
    }
    return sanitizeDocument(await cursor.lean().exec()) as PackagingPaletteRow[];
  }

  async createPalette(payload: Record<string, unknown>) {
    const paletteNumber = await nextPaletteNumber();
    const boxCount = readNumber(payload.box_count);
    const grossWeightPerBoxG = readNumber(payload.gross_weight_per_box_g);
    const now = nowIso();
    const grossWeightKg = computePaletteGrossWeightKg(boxCount, grossWeightPerBoxG);
    const netWeightKg = Number((((boxCount * (grossWeightPerBoxG - 50)) / 1000)).toFixed(2));

    const palette = await prepareInsertDocument("packaging_palettes", {
      palette_number: paletteNumber,
      order_id: payload.order_id,
      order_number: payload.order_number,
      status: "EN_COURS",
      bom_id: payload.bom_id,
      box_count: boxCount,
      gross_weight_kg: grossWeightKg,
      net_weight_kg: netWeightKg,
      seal_number: null,
      sealed_by: null,
      sealed_at: null,
      sscc: null,
      storage_location_id: null,
      created_at: now,
      updated_at: now,
    });

    await PackagingPalettes().create([palette]);
    return sanitizeDocument(palette);
  }

  async sealPalette(id: string, payload: Record<string, unknown>) {
    const existing = sanitizeDocument(await PackagingPalettes().findOne({ id }).lean().exec()) as PackagingPaletteRow | null;
    if (!existing) throw notFound("PACKAGING_PALETTE_NOT_FOUND", "Palette introuvable.");

    const orderId = readString(payload.order_id, existing.order_id);
    const paletteNumber = readString(payload.palette_number, existing.palette_number, id);
    const sealNumber = readString(payload.seal_number, payload.sealNumber);
    const sealedBy = readString(payload.sealed_by, payload.sealedBy);
    const serialCounter = readNumber(payload.serial_counter, Date.now() % 100_000_000);
    const sscc = generateSSCC(serialCounter);
    const now = nowIso();

    if (!sealNumber) {
      await createPackagingNotification({
        notification_type: "AL-PKG-05",
        title: `Palette ${paletteNumber} scellée sans numéro d'emballage`,
        message: `La palette ${paletteNumber} a été scellée sans numéro de sceau renseigné.`,
        severity: "warning",
        entity_type: "packaging_palette",
        entity_id: id,
      });
    }

    await PackagingPalettes().updateOne(
      { id },
      {
        $set: {
          status: "SCELLE",
          seal_number: sealNumber || null,
          sealed_by: sealedBy || null,
          sealed_at: now,
          sscc,
          updated_at: now,
        },
      },
    ).exec();

    try {
      const [palette, order] = await Promise.all([
        sanitizeDocument(await PackagingPalettes().findOne({ id }).lean().exec()) as Promise<PackagingPaletteRow | null>,
        sanitizeDocument(await PackagingOrders().findOne({ id: orderId }).lean().exec()) as Promise<PackagingOrderRow | null>,
      ]);

      if (palette && order) {
        let variety: string | null = order.grade ? `Grade ${order.grade}` : null;
        let originCountry = "TN";
        let sourceReceptionId: string | null = null;

        if (order.source_sublot_id) {
          const sublot = sanitizeDocument(
            await TriageSublots()
              .findOne({ id: order.source_sublot_id })
              .lean()
              .exec(),
          ) as TriageSubLotRow | null;
          if (sublot) {
            variety = readString(sublot.variety) || variety;
            originCountry = readString(sublot.origin_country) || "TN";
            sourceReceptionId = readString(sublot.parent_reception_id) || null;
          }
        }

        const newLot = await prepareInsertDocument("stock_lots", {
          lot_number: sscc || paletteNumber,
          product_id: null,
          source_stage: "PACKAGING",
          source_lot_internal: order.source_lot_number ?? null,
          variety,
          origin_country: originCountry,
          initial_quantity: readNumber(palette.net_weight_kg),
          current_quantity: readNumber(palette.net_weight_kg),
          unit: "kg",
          status: "VALIDATED",
          reception_date: now.slice(0, 10),
          packaging_date: now.slice(0, 10),
          source_reception_id: sourceReceptionId,
          location_id: palette.storage_location_id ?? null,
          batch_id: null,
          created_by: sealedBy || null,
          created_at: now,
          updated_at: now,
          quality_notes: `${readString(order.bom_name)} · Grade ${readString(order.grade)}`.trim() || null,
        });
        await StockLots().create([newLot]);

        const movement = await prepareInsertDocument("stock_movements", {
          movement_type: "RECEPTION",
          lot_id: newLot.id,
          product_id: null,
          quantity: readNumber(palette.net_weight_kg),
          unit: "kg",
          document_type: "PALETTE_SEAL",
          document_reference: sscc || paletteNumber,
          performed_by: sealedBy || null,
          notes: `Entrée stock PF — palette ${paletteNumber} scellée`,
          created_at: now,
        });
        await StockMovements().create([movement]);
      }
    } catch (error) {
      console.error("[Packaging] finished goods stock sync failed after sealing palette:", error);
    }

    return { sscc, palette_number: paletteNumber };
  }
}
