var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from "@nestjs/common";
import { badRequest, notFound } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { buildLotTraceabilityDossier } from "./traceability-dossier.js";
import { buildGenealogyFromDossier } from "./genealogy-builder.js";
const Receptions = () => getCollectionModel("receptions_v2");
const Suppliers = () => getCollectionModel("suppliers");
const FumigationCycles = () => getCollectionModel("fumigation_cycles");
const FumigationSensorReadings = () => getCollectionModel("fumigation_sensor_readings");
const CleaningCycles = () => getCollectionModel("cleaning_cycles");
const HydrationCycles = () => getCollectionModel("hydration_cycles");
const TriageSessions = () => getCollectionModel("triage_sessions");
const TriageQualityChecks = () => getCollectionModel("triage_quality_checks");
const TriageSublots = () => getCollectionModel("triage_sublots");
const StockLots = () => getCollectionModel("stock_lots");
const StockMovements = () => getCollectionModel("stock_movements");
const Notifications = () => getCollectionModel("system_notifications");
const ELIGIBLE_PHASE2_RECEPTION_STATUSES = ["LIBERE", "VALIDE", "ACCEPTE", "EN_ATTENTE_TRAITEMENT"];
const SUBLOT_SUFFIX = {
    EXTRA: "-EX",
    CATEGORIE_I: "-C1",
    CATEGORIE_II: "-C2",
    REJETE: "-RJ",
};
const SUBLOT_DESTINATION = {
    EXTRA: "CONDITIONNEMENT_PREMIUM",
    CATEGORIE_I: "CONDITIONNEMENT_STANDARD",
    CATEGORIE_II: "TRANSFORMATION",
    REJETE: "DESTRUCTION",
};
const PHASE2_ALERT_CODES = [
    "AL-FUM-01",
    "AL-FUM-02",
    "AL-FUM-03",
    "AL-FUM-04",
    "AL-FUM-05",
    "AL-FUM-06",
    "AL-FUM-07",
    "AL-NET-01",
    "AL-NET-02",
    "AL-NET-03",
    "AL-HYD-01",
    "AL-HYD-02",
    "AL-TRI-01",
    "AL-TRI-02",
    "AL-TRI-03",
    "AL-GLB-01",
    "AL-GLB-02",
    "AL-GLB-03",
    "AL-PKG-01",
    "AL-PKG-02",
    "AL-PKG-05",
];
const FUMIGATION_PROTOCOL_CONFIG = {
    "FUM-PH3-72": {
        min_duration_min: 4320,
        allows_bio: false,
    },
    "FUM-CO2-96": {
        min_duration_min: 5760,
        allows_bio: true,
    },
    "FUM-THERM-04": {
        min_duration_min: 240,
        allows_bio: true,
    },
};
const nowIso = () => new Date().toISOString();
const todayIsoDate = () => nowIso().slice(0, 10);
const todayCompact = () => todayIsoDate().replace(/-/g, "");
const readNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const readNullableNumber = (value) => {
    if (value == null || value === "")
        return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const readString = (...values) => {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "";
};
const cleanPatch = (patch, blocked = []) => {
    const next = {};
    for (const [key, value] of Object.entries(patch || {})) {
        if (value === undefined)
            continue;
        if (blocked.includes(key))
            continue;
        next[key] = value;
    }
    return next;
};
const round1 = (value) => Math.round(value * 10) / 10;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const suggestHydrationProgram = (humidityPercent) => {
    if (humidityPercent < 18)
        return "HYD-LONG";
    if (humidityPercent < 20)
        return "HYD-COURT";
    if (humidityPercent <= 26)
        return "SKIP";
    if (humidityPercent <= 28)
        return "SEC-COURT";
    return "SEC-LONG";
};
const nextFumigationCycleNumber = async (chamber) => {
    const prefix = `FUM-${chamber.replace("-", "")}-${todayCompact()}-`;
    const count = await FumigationCycles().countDocuments({
        cycle_number: { $regex: `^${escapeRegex(prefix)}` },
    }).exec();
    return `${prefix}${String(count + 1).padStart(3, "0")}`;
};
const nextCleaningCycleNumber = async () => {
    const prefix = `NET-${todayCompact()}-`;
    const count = await CleaningCycles().countDocuments({
        cycle_number: { $regex: `^${escapeRegex(prefix)}` },
    }).exec();
    return `${prefix}${String(count + 1).padStart(3, "0")}`;
};
const nextHydrationCycleNumber = async (chamber) => {
    const prefix = `HYD-${chamber.replace("-", "")}-${todayCompact()}-`;
    const count = await HydrationCycles().countDocuments({
        cycle_number: { $regex: `^${escapeRegex(prefix)}` },
    }).exec();
    return `${prefix}${String(count + 1).padStart(3, "0")}`;
};
const nextTriageSessionNumber = async (line) => {
    const prefix = `TRI-${line}-${todayCompact()}-`;
    const count = await TriageSessions().countDocuments({
        session_number: { $regex: `^${escapeRegex(prefix)}` },
    }).exec();
    return `${prefix}${String(count + 1).padStart(3, "0")}`;
};
const buildStatusFilter = (raw) => {
    const values = String(raw || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    return values;
};
const buildSupplierMap = async (ids) => {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    if (uniqueIds.length === 0) {
        return new Map();
    }
    const rows = sanitizeDocument(await Suppliers().find({ id: { $in: uniqueIds } }).select("id name").lean().exec());
    return new Map(rows.map((row) => [String(row.id || ""), row]));
};
const createPhase2Notification = async (input) => {
    const notification = await prepareInsertDocument("system_notifications", {
        notification_type: input.code,
        type: input.code,
        category: "phase2",
        title: input.title,
        message: input.message,
        severity: input.severity,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        metadata: input.metadata ?? null,
        status: "ACTIVE",
        is_read: false,
    });
    await Notifications().create([notification]);
    return sanitizeDocument(notification);
};
let Phase2Service = class Phase2Service {
    async listAvailableLots() {
        const rows = sanitizeDocument(await Receptions()
            .find({ status: { $in: ELIGIBLE_PHASE2_RECEPTION_STATUSES } })
            .select("id reception_number variety quantity_total unit status qc_grade storage_zone_code actual_arrival_date is_bio supplier_id supplier_name_snapshot")
            .sort({ actual_arrival_date: -1 })
            .limit(200)
            .lean()
            .exec());
        const suppliers = await buildSupplierMap(rows.map((row) => readString(row.supplier_id)));
        return rows.map((row) => ({
            id: String(row.id || ""),
            reception_number: readString(row.reception_number),
            variety: readString(row.variety) || null,
            quantity_total: readNullableNumber(row.quantity_total),
            unit: readString(row.unit) || null,
            status: readString(row.status),
            qc_grade: readString(row.qc_grade) || null,
            storage_zone_code: readString(row.storage_zone_code) || null,
            actual_arrival_date: readString(row.actual_arrival_date) || null,
            is_bio: Boolean(row.is_bio),
            supplier_name: readString(row.supplier_name_snapshot)
                || readString(suppliers.get(readString(row.supplier_id))?.name)
                || null,
        }));
    }
    async listFumigationCycles(rawStatus) {
        const statuses = buildStatusFilter(rawStatus);
        const filter = statuses.length > 0 ? { status: { $in: statuses } } : {};
        return sanitizeDocument(await FumigationCycles().find(filter).sort({ created_at: -1 }).limit(100).lean().exec());
    }
    async getFumigationCycle(id) {
        const row = sanitizeDocument(await FumigationCycles().findOne({ id }).lean().exec());
        if (!row)
            throw notFound("FUMIGATION_CYCLE_NOT_FOUND", "Cycle de fumigation introuvable.");
        return row;
    }
    async listFumigationSensorReadings(cycleId) {
        return sanitizeDocument(await FumigationSensorReadings()
            .find({ cycle_id: cycleId })
            .sort({ read_at: 1 })
            .limit(2000)
            .lean()
            .exec());
    }
    async createFumigationCycle(payload) {
        const chamber = readString(payload.chamber);
        const protocol = readString(payload.protocol);
        const lotRefs = Array.isArray(payload.lot_refs) ? payload.lot_refs : [];
        if (!chamber)
            throw badRequest("CHAMBER_REQUIRED", "La chambre de fumigation est requise.");
        if (!protocol)
            throw badRequest("PROTOCOL_REQUIRED", "Le protocole de fumigation est requis.");
        if (lotRefs.length === 0)
            throw badRequest("LOT_REFS_REQUIRED", "Au moins un lot est requis.");
        const hasBioLots = lotRefs.some((lot) => Boolean(lot?.is_bio));
        if (hasBioLots && !FUMIGATION_PROTOCOL_CONFIG[protocol]?.allows_bio) {
            throw badRequest("BIO_PROTOCOL_FORBIDDEN", `Le protocole ${protocol} est interdit pour les lots biologiques. Utilisez FUM-CO2-96 ou FUM-THERM-04.`);
        }
        const now = nowIso();
        const cycle = await prepareInsertDocument("fumigation_cycles", {
            cycle_number: await nextFumigationCycleNumber(chamber),
            chamber,
            protocol,
            status: "PREPARATION",
            lot_refs: lotRefs,
            total_weight_kg: readNumber(payload.total_weight_kg),
            fill_rate_percent: readNumber(payload.fill_rate_percent),
            has_bio_lots: hasBioLots,
            dose_calculated_g: null,
            dose_applied_g: null,
            dose_variance_percent: null,
            product_lot_number: null,
            product_expiry_date: null,
            photo_disposition_urls: [],
            t0_start: null,
            t_end_real: null,
            duration_minutes: null,
            minimum_duration_minutes: FUMIGATION_PROTOCOL_CONFIG[protocol]?.min_duration_min ?? null,
            duration_compliant: null,
            parameters_compliant: null,
            residual_concentration_ppm: null,
            residual_tlv_compliant: null,
            operator_id: null,
            operator_name: null,
            operator_signed_at: null,
            quality_inspector_id: null,
            quality_inspector_name: null,
            quality_signed_at: null,
            certificate_pdf_url: null,
            certificate_generated_at: null,
            created_by: readString(payload.created_by) || null,
            created_at: now,
            updated_at: now,
        });
        await FumigationCycles().create([cycle]);
        return sanitizeDocument(cycle);
    }
    async updateFumigationCycle(id, payload) {
        const existing = sanitizeDocument(await FumigationCycles().findOne({ id }).lean().exec());
        if (!existing)
            throw notFound("FUMIGATION_CYCLE_NOT_FOUND", "Cycle de fumigation introuvable.");
        const nextPatch = cleanPatch(payload, ["id", "cycle_number", "created_at", "readings"]);
        if ("protocol" in nextPatch || "lot_refs" in nextPatch) {
            const nextProtocol = readString(nextPatch.protocol, existing.protocol);
            const nextLotRefs = Array.isArray(nextPatch.lot_refs) ? nextPatch.lot_refs : existing.lot_refs || [];
            const hasBioLots = nextLotRefs.some((lot) => Boolean(lot?.is_bio));
            if (hasBioLots && !FUMIGATION_PROTOCOL_CONFIG[nextProtocol]?.allows_bio) {
                throw badRequest("BIO_PROTOCOL_FORBIDDEN", `Le protocole ${nextProtocol} est interdit pour les lots biologiques. Utilisez FUM-CO2-96 ou FUM-THERM-04.`);
            }
            nextPatch.has_bio_lots = hasBioLots;
            nextPatch.minimum_duration_minutes =
                readNullableNumber(nextPatch.minimum_duration_minutes)
                    ?? FUMIGATION_PROTOCOL_CONFIG[nextProtocol]?.min_duration_min
                    ?? existing.minimum_duration_minutes
                    ?? null;
        }
        nextPatch.updated_at = nowIso();
        await FumigationCycles().updateOne({ id }, { $set: nextPatch }).exec();
        return sanitizeDocument(await FumigationCycles().findOne({ id }).lean().exec());
    }
    async startFumigationCycle(id) {
        const current = sanitizeDocument(await FumigationCycles()
            .findOne({ id })
            .select("status photo_disposition_urls dose_applied_g product_lot_number")
            .lean()
            .exec());
        if (!current)
            throw notFound("FUMIGATION_CYCLE_NOT_FOUND", "Cycle de fumigation introuvable.");
        if (current.status !== "CHARGEMENT") {
            throw badRequest("INVALID_FUMIGATION_STATUS", `Impossible de démarrer: statut actuel est ${current.status}.`);
        }
        if (!readNullableNumber(current.dose_applied_g)) {
            throw badRequest("DOSE_APPLIED_REQUIRED", "Dose appliquée obligatoire avant démarrage.");
        }
        if (!readString(current.product_lot_number)) {
            throw badRequest("PRODUCT_LOT_REQUIRED", "N° lot produit obligatoire avant démarrage.");
        }
        if (!Array.isArray(current.photo_disposition_urls) || current.photo_disposition_urls.length === 0) {
            throw badRequest("PHOTO_REQUIRED", "Au moins une photo de disposition est requise avant démarrage.");
        }
        const now = nowIso();
        await FumigationCycles().updateOne({ id }, { $set: { status: "EN_COURS", t0_start: now, updated_at: now } }).exec();
        return sanitizeDocument(await FumigationCycles().findOne({ id }).lean().exec());
    }
    async signFumigationCycle(id, payload) {
        const current = sanitizeDocument(await FumigationCycles()
            .findOne({ id })
            .select("status operator_signed_at quality_signed_at")
            .lean()
            .exec());
        if (!current)
            throw notFound("FUMIGATION_CYCLE_NOT_FOUND", "Cycle de fumigation introuvable.");
        if (current.status !== "VALIDATION") {
            throw badRequest("SIGNATURE_NOT_AVAILABLE", `Signatures disponibles uniquement en phase VALIDATION (actuel: ${current.status}).`);
        }
        const role = readString(payload.role);
        const signerName = readString(payload.signerName, payload.signer_name);
        const signerId = readString(payload.signerId, payload.signer_id);
        if (!role || !signerName || !signerId) {
            throw badRequest("SIGNATURE_FIELDS_REQUIRED", "Le rôle, le nom et l'identifiant du signataire sont requis.");
        }
        const now = nowIso();
        const patch = role === "operator"
            ? { operator_id: signerId, operator_name: signerName, operator_signed_at: now }
            : role === "quality"
                ? { quality_inspector_id: signerId, quality_inspector_name: signerName, quality_signed_at: now }
                : null;
        if (!patch) {
            throw badRequest("INVALID_SIGNATURE_ROLE", "Le rôle de signature doit être operator ou quality.");
        }
        await FumigationCycles().updateOne({ id }, { $set: { ...patch, updated_at: now } }).exec();
        const refreshed = sanitizeDocument(await FumigationCycles().findOne({ id }).lean().exec());
        if (refreshed?.operator_signed_at && refreshed?.quality_signed_at) {
            await FumigationCycles().updateOne({ id }, { $set: { status: "TERMINE", updated_at: now } }).exec();
        }
        return sanitizeDocument(await FumigationCycles().findOne({ id }).lean().exec());
    }
    async addFumigationSensorReading(payload) {
        const cycleId = readString(payload.cycle_id);
        if (!cycleId)
            throw badRequest("CYCLE_ID_REQUIRED", "Le cycle de fumigation est requis.");
        const cycle = sanitizeDocument(await FumigationCycles().findOne({ id: cycleId }).select("id status").lean().exec());
        if (!cycle)
            throw notFound("FUMIGATION_CYCLE_NOT_FOUND", "Cycle de fumigation introuvable.");
        const reading = await prepareInsertDocument("fumigation_sensor_readings", {
            ...payload,
            cycle_id: cycleId,
            read_at: readString(payload.read_at) || nowIso(),
            created_by: readString(payload.created_by) || "system",
        });
        await FumigationSensorReadings().create([reading]);
        const sanitizedReading = sanitizeDocument(reading);
        const notifications = [];
        if (cycle.status === "EN_COURS"
            && readNullableNumber(sanitizedReading.external_leak_ppm) != null
            && readNumber(sanitizedReading.external_leak_ppm) > 0.3) {
            notifications.push(await createPhase2Notification({
                code: "AL-FUM-03",
                title: "Fuite gaz externe détectée",
                message: `Cycle ${cycleId} — fuite externe: ${readNumber(sanitizedReading.external_leak_ppm)} ppm > seuil 0.3 ppm. Evacuation immédiate.`,
                severity: "error",
                entityType: "fumigation_cycle",
                entityId: cycleId,
                metadata: { external_leak_ppm: readNumber(sanitizedReading.external_leak_ppm) },
            }));
        }
        return {
            data: sanitizedReading,
            notifications,
        };
    }
    async getFumigationKpis() {
        const rows = sanitizeDocument(await FumigationCycles()
            .find({})
            .select("status duration_compliant parameters_compliant total_weight_kg")
            .sort({ created_at: -1 })
            .limit(200)
            .lean()
            .exec());
        const active = rows.filter((row) => row.status === "EN_COURS" || row.status === "VENTILATION" || row.status === "VALIDATION");
        const completed = rows.filter((row) => row.status === "TERMINE");
        const compliancePct = completed.length > 0
            ? Math.round((completed.filter((row) => row.duration_compliant && row.parameters_compliant).length / completed.length) * 100)
            : null;
        return {
            active_count: active.length,
            completed_count: completed.length,
            compliance_pct: compliancePct,
            total_kg_treated: rows.reduce((sum, row) => sum + readNumber(row.total_weight_kg), 0),
        };
    }
    async listCleaningCycles(rawStatus) {
        const statuses = buildStatusFilter(rawStatus);
        const filter = statuses.length > 0 ? { status: { $in: statuses } } : {};
        return sanitizeDocument(await CleaningCycles().find(filter).sort({ created_at: -1 }).limit(100).lean().exec());
    }
    async getCleaningCycle(id) {
        const row = sanitizeDocument(await CleaningCycles().findOne({ id }).lean().exec());
        if (!row)
            throw notFound("CLEANING_CYCLE_NOT_FOUND", "Cycle de nettoyage introuvable.");
        return row;
    }
    async createCleaningCycle(payload) {
        const program = readString(payload.program);
        if (!program) {
            throw badRequest("PROGRAM_REQUIRED", "Le programme de nettoyage est requis.");
        }
        const lotNumber = readString(payload.lot_number);
        if (!lotNumber) {
            throw badRequest("LOT_NUMBER_REQUIRED", "Le numero de lot est requis.");
        }
        const now = nowIso();
        const cycle = await prepareInsertDocument("cleaning_cycles", {
            cycle_number: await nextCleaningCycleNumber(),
            reception_id: readString(payload.reception_id) || "",
            lot_number: lotNumber,
            variety: readString(payload.variety) || null,
            status: "EN_COURS",
            program,
            program_forced_reason: readString(payload.program_forced_reason) || null,
            weight_in_kg: null,
            weight_out_kg: null,
            yield_percent: null,
            water_volume_liters: null,
            water_recycled_percent: null,
            water_temperature_c: null,
            turbidity_ntu: null,
            ph_water: null,
            waste_weight_kg: null,
            waste_category: null,
            waste_photo_urls: [],
            started_at: now,
            ended_at: null,
            operator_name: readString(payload.operator_name) || null,
            created_by: readString(payload.created_by) || null,
            created_at: now,
            updated_at: now,
        });
        await CleaningCycles().create([cycle]);
        return sanitizeDocument(cycle);
    }
    async closeCleaningCycle(id, payload) {
        const existing = sanitizeDocument(await CleaningCycles().findOne({ id }).lean().exec());
        if (!existing)
            throw notFound("CLEANING_CYCLE_NOT_FOUND", "Cycle de nettoyage introuvable.");
        const weightInKg = readNumber(payload.weight_in_kg, Number.NaN);
        const weightOutKg = readNumber(payload.weight_out_kg, Number.NaN);
        const wasteWeightKg = readNumber(payload.waste_weight_kg, Number.NaN);
        const wasteCategory = readString(payload.waste_category);
        if (!Number.isFinite(weightInKg) || !Number.isFinite(weightOutKg)) {
            throw badRequest("WEIGHTS_REQUIRED", "Les poids d'entree et de sortie sont requis.");
        }
        if (!Number.isFinite(wasteWeightKg) || !wasteCategory) {
            throw badRequest("WASTE_REQUIRED", "Les donnees de dechets sont requises pour cloturer le cycle.");
        }
        const yieldPercent = weightInKg > 0 ? round1((weightOutKg / weightInKg) * 100) : null;
        const now = nowIso();
        await CleaningCycles().updateOne({ id }, {
            $set: {
                status: "TERMINE",
                weight_in_kg: weightInKg,
                weight_out_kg: weightOutKg,
                yield_percent: yieldPercent,
                waste_weight_kg: wasteWeightKg,
                waste_category: wasteCategory,
                water_volume_liters: readNullableNumber(payload.water_volume_liters),
                water_recycled_percent: readNullableNumber(payload.water_recycled_percent),
                water_temperature_c: readNullableNumber(payload.water_temperature_c),
                turbidity_ntu: readNullableNumber(payload.turbidity_ntu),
                ph_water: readNullableNumber(payload.ph_water),
                ended_at: now,
                updated_at: now,
            },
        }).exec();
        const cycle = sanitizeDocument(await CleaningCycles().findOne({ id }).lean().exec());
        const notifications = [];
        if (yieldPercent != null && yieldPercent < 92) {
            notifications.push(await createPhase2Notification({
                code: "AL-NET-01",
                title: "Rendement nettoyage < 92%",
                message: `Cycle ${readString(existing.cycle_number, id)} — rendement: ${yieldPercent}% (seuil: 92%). Verifier reglage tapis.`,
                severity: "warning",
                entityType: "cleaning_cycle",
                entityId: id,
                metadata: { yield_percent: yieldPercent },
            }));
        }
        const turbidity = readNullableNumber(payload.turbidity_ntu);
        if (turbidity != null && turbidity > 200) {
            notifications.push(await createPhase2Notification({
                code: "AL-NET-02",
                title: "Turbidite eau excessive",
                message: `Cycle ${readString(existing.cycle_number, id)} — turbidite: ${turbidity} NTU > 200 NTU. Changer l'eau.`,
                severity: "warning",
                entityType: "cleaning_cycle",
                entityId: id,
                metadata: { turbidity_ntu: turbidity },
            }));
        }
        const phWater = readNullableNumber(payload.ph_water);
        if (phWater != null && (phWater < 6.5 || phWater > 8.5)) {
            notifications.push(await createPhase2Notification({
                code: "AL-NET-03",
                title: "pH eau hors plage",
                message: `Cycle ${readString(existing.cycle_number, id)} — pH: ${phWater} (plage autorisee: 6.5–8.5).`,
                severity: "warning",
                entityType: "cleaning_cycle",
                entityId: id,
                metadata: { ph_water: phWater },
            }));
        }
        return {
            data: { yield_percent: yieldPercent },
            cycle,
            notifications,
        };
    }
    async updateCleaningCycle(id, payload) {
        const existing = await CleaningCycles().findOne({ id }).lean().exec();
        if (!existing)
            throw notFound("CLEANING_CYCLE_NOT_FOUND", "Cycle de nettoyage introuvable.");
        await CleaningCycles().updateOne({ id }, {
            $set: {
                ...cleanPatch(payload, ["id", "cycle_number", "created_at"]),
                updated_at: nowIso(),
            },
        }).exec();
        return sanitizeDocument(await CleaningCycles().findOne({ id }).lean().exec());
    }
    async getCleaningKpis() {
        const rows = sanitizeDocument(await CleaningCycles()
            .find({})
            .select("status yield_percent program")
            .sort({ created_at: -1 })
            .limit(200)
            .lean()
            .exec());
        const active = rows.filter((row) => row.status === "EN_COURS").length;
        const completed = rows.filter((row) => row.status === "TERMINE");
        const avgYield = completed.length > 0
            ? round1(completed.reduce((sum, row) => sum + readNumber(row.yield_percent), 0) / completed.length)
            : null;
        const programCounts = rows.reduce((acc, row) => {
            const program = readString(row.program);
            if (program)
                acc[program] = (acc[program] || 0) + 1;
            return acc;
        }, {});
        return {
            active_count: active,
            completed_count: completed.length,
            avg_yield_pct: avgYield,
            program_counts: programCounts,
        };
    }
    async listHydrationCycles(rawStatus) {
        const statuses = buildStatusFilter(rawStatus);
        const filter = statuses.length > 0 ? { status: { $in: statuses } } : {};
        return sanitizeDocument(await HydrationCycles().find(filter).sort({ created_at: -1 }).limit(100).lean().exec());
    }
    async getHydrationCycle(id) {
        const row = sanitizeDocument(await HydrationCycles().findOne({ id }).lean().exec());
        if (!row)
            throw notFound("HYDRATION_CYCLE_NOT_FOUND", "Cycle d'hydratation introuvable.");
        return row;
    }
    async createHydrationCycle(payload) {
        const chamber = readString(payload.chamber);
        if (!chamber) {
            throw badRequest("CHAMBER_REQUIRED", "La chambre est requise.");
        }
        const lotRefs = Array.isArray(payload.lot_refs) ? payload.lot_refs : [];
        if (lotRefs.length === 0) {
            throw badRequest("LOT_REFS_REQUIRED", "Au moins un lot est requis.");
        }
        const humidityIn = readNullableNumber(payload.humidity_in_percent);
        const suggested = humidityIn != null ? suggestHydrationProgram(humidityIn) : "SKIP";
        const applied = readString(payload.program_override, payload.program_applied) || suggested;
        const overrideReason = readString(payload.program_override_reason);
        if (applied !== suggested && overrideReason.length < 20) {
            throw badRequest("OVERRIDE_REASON_REQUIRED", `La raison de derogation doit comporter au moins 20 caracteres (programme suggere: ${suggested}).`);
        }
        const now = nowIso();
        const cycle = await prepareInsertDocument("hydration_cycles", {
            cycle_number: await nextHydrationCycleNumber(chamber),
            chamber,
            lot_refs: lotRefs,
            status: "EN_COURS",
            humidity_in_percent: humidityIn,
            program_suggested: suggested,
            program_applied: applied,
            program_override_reason: applied !== suggested ? overrideReason || null : null,
            temperature_t1_c: null,
            temperature_t2_c: null,
            air_humidity_percent: null,
            steam_injected_kg: null,
            energy_kwh: null,
            humidity_out_1: null,
            humidity_out_2: null,
            humidity_out_3: null,
            humidity_out_avg: null,
            conformity: null,
            additional_cycle_count: 0,
            non_conformity_action: null,
            started_at: now,
            ended_at: null,
            operator_name: readString(payload.operator_name) || null,
            inspector_name: null,
            created_by: readString(payload.created_by) || null,
            created_at: now,
            updated_at: now,
        });
        await HydrationCycles().create([cycle]);
        return sanitizeDocument(cycle);
    }
    async recordHydrationExit(id, payload) {
        const existing = sanitizeDocument(await HydrationCycles().findOne({ id }).lean().exec());
        if (!existing)
            throw notFound("HYDRATION_CYCLE_NOT_FOUND", "Cycle d'hydratation introuvable.");
        const humidityOut1 = readNumber(payload.humidity_out_1, Number.NaN);
        const humidityOut2 = readNumber(payload.humidity_out_2, Number.NaN);
        const humidityOut3 = readNumber(payload.humidity_out_3, Number.NaN);
        if (!Number.isFinite(humidityOut1) || !Number.isFinite(humidityOut2) || !Number.isFinite(humidityOut3)) {
            throw badRequest("EXIT_HUMIDITY_REQUIRED", "Les trois mesures de sortie sont requises.");
        }
        const avg = round1((humidityOut1 + humidityOut2 + humidityOut3) / 3);
        let conformity;
        if (avg >= 20 && avg <= 26)
            conformity = "VERT";
        else if ((avg >= 18 && avg < 20) || (avg > 26 && avg <= 28))
            conformity = "JAUNE";
        else
            conformity = "ROUGE";
        const now = nowIso();
        await HydrationCycles().updateOne({ id }, {
            $set: {
                humidity_out_1: humidityOut1,
                humidity_out_2: humidityOut2,
                humidity_out_3: humidityOut3,
                humidity_out_avg: avg,
                conformity,
                inspector_name: readString(payload.inspector_name) || null,
                updated_at: now,
            },
        }).exec();
        const cycle = sanitizeDocument(await HydrationCycles().findOne({ id }).lean().exec());
        const notifications = [];
        if (conformity === "ROUGE") {
            notifications.push(await createPhase2Notification({
                code: "AL-HYD-01",
                title: "Humidite sortie hors plage critique",
                message: `Cycle ${readString(existing.cycle_number, id)} — humidite moy: ${avg}% (plage: 20–26%). Action requise.`,
                severity: "error",
                entityType: "hydration_cycle",
                entityId: id,
                metadata: { humidity_out_avg: avg, conformity },
            }));
        }
        return {
            data: { avg, conformity },
            cycle,
            notifications,
        };
    }
    async closeHydrationCycle(id, payload) {
        const current = sanitizeDocument(await HydrationCycles()
            .findOne({ id })
            .select("id conformity additional_cycle_count humidity_out_avg")
            .lean()
            .exec());
        if (!current)
            throw notFound("HYDRATION_CYCLE_NOT_FOUND", "Cycle d'hydratation introuvable.");
        if (current.humidity_out_avg == null) {
            throw badRequest("EXIT_HUMIDITY_REQUIRED", "Enregistrer les mesures humidite sortie avant de cloturer.");
        }
        const action = readString(payload.non_conformity_action);
        const isNonConform = current.conformity === "ROUGE" || current.conformity === "JAUNE";
        if (isNonConform && !action) {
            throw badRequest("NON_CONFORMITY_ACTION_REQUIRED", "Action de non-conformite obligatoire.");
        }
        if (action === "REFAIRE" && readNumber(current.additional_cycle_count) >= 1) {
            throw badRequest("ADDITIONAL_CYCLE_LIMIT_REACHED", "Limite de 1 cycle additionnel atteinte. Action ACCEPTER ou REJETER obligatoire.");
        }
        const now = nowIso();
        const status = isNonConform && action !== "ACCEPTER" ? "NON_CONFORME" : "TERMINE";
        await HydrationCycles().updateOne({ id }, {
            $set: {
                status,
                non_conformity_action: action || null,
                additional_cycle_count: action === "REFAIRE"
                    ? readNumber(current.additional_cycle_count) + 1
                    : readNumber(current.additional_cycle_count),
                ended_at: now,
                updated_at: now,
            },
        }).exec();
        return sanitizeDocument(await HydrationCycles().findOne({ id }).lean().exec());
    }
    async updateHydrationSensors(id, payload) {
        const existing = await HydrationCycles().findOne({ id }).lean().exec();
        if (!existing)
            throw notFound("HYDRATION_CYCLE_NOT_FOUND", "Cycle d'hydratation introuvable.");
        await HydrationCycles().updateOne({ id }, {
            $set: {
                ...cleanPatch(payload, ["id", "cycle_number", "created_at"]),
                updated_at: nowIso(),
            },
        }).exec();
        return sanitizeDocument(await HydrationCycles().findOne({ id }).lean().exec());
    }
    async getHydrationKpis() {
        const rows = sanitizeDocument(await HydrationCycles()
            .find({})
            .select("status conformity program_applied program_suggested")
            .sort({ created_at: -1 })
            .limit(200)
            .lean()
            .exec());
        const active = rows.filter((row) => row.status === "EN_COURS").length;
        const completed = rows.filter((row) => row.status === "TERMINE" || row.status === "NON_CONFORME");
        const conformPct = completed.length > 0
            ? Math.round((completed.filter((row) => row.conformity === "VERT").length / completed.length) * 100)
            : null;
        const overrideCount = rows.filter((row) => row.program_applied !== row.program_suggested).length;
        return {
            active_count: active,
            completed_count: completed.length,
            conform_pct: conformPct,
            override_count: overrideCount,
        };
    }
    async listTriageSessions(rawStatus) {
        const statuses = buildStatusFilter(rawStatus);
        const filter = statuses.length > 0 ? { status: { $in: statuses } } : {};
        return sanitizeDocument(await TriageSessions().find(filter).sort({ created_at: -1 }).limit(100).lean().exec());
    }
    async getTriageSession(id) {
        const row = sanitizeDocument(await TriageSessions().findOne({ id }).lean().exec());
        if (!row)
            throw notFound("TRIAGE_SESSION_NOT_FOUND", "Session de triage introuvable.");
        return row;
    }
    async listTriageQualityChecks(sessionId) {
        return sanitizeDocument(await TriageQualityChecks()
            .find({ session_id: sessionId })
            .sort({ checked_at: -1 })
            .limit(50)
            .lean()
            .exec());
    }
    async listTriageSublots(sessionId) {
        return sanitizeDocument(await TriageSublots()
            .find({ session_id: sessionId })
            .sort({ created_at: 1 })
            .limit(10)
            .lean()
            .exec());
    }
    async createTriageSession(payload) {
        const workerCount = readNumber(payload.worker_count, Number.NaN);
        if (!Number.isFinite(workerCount) || workerCount < 1) {
            throw badRequest("WORKER_COUNT_REQUIRED", "Au moins 1 operateur requis.");
        }
        if (workerCount > 12) {
            throw badRequest("WORKER_COUNT_TOO_HIGH", "Maximum 12 operateurs par ligne.");
        }
        const line = readString(payload.line);
        if (!line)
            throw badRequest("LINE_REQUIRED", "La ligne de triage est requise.");
        const lotNumber = readString(payload.parent_lot_number);
        if (!lotNumber)
            throw badRequest("LOT_NUMBER_REQUIRED", "Le numero de lot parent est requis.");
        const now = nowIso();
        const session = await prepareInsertDocument("triage_sessions", {
            session_number: await nextTriageSessionNumber(line),
            line,
            parent_reception_id: readString(payload.parent_reception_id) || "",
            parent_lot_number: lotNumber,
            variety: readString(payload.variety) || null,
            parent_weight_kg: readNumber(payload.parent_weight_kg),
            status: "EN_COURS",
            worker_count: workerCount,
            worker_ids: Array.isArray(payload.worker_ids) ? payload.worker_ids : [],
            chef_ligne: readString(payload.chef_ligne) || null,
            tape_speed: readString(payload.tape_speed) || "STANDARD",
            weight_extra_kg: 0,
            weight_cat1_kg: 0,
            weight_cat2_kg: 0,
            weight_reject_kg: 0,
            total_sorted_kg: 0,
            extra_percent: 0,
            cat1_percent: 0,
            cat2_percent: 0,
            reject_percent: 0,
            yield_kg_per_hour: null,
            quality_score_percent: null,
            started_at: now,
            ended_at: null,
            duration_minutes: null,
            created_by: readString(payload.created_by) || null,
            created_at: now,
            updated_at: now,
        });
        await TriageSessions().create([session]);
        return sanitizeDocument(session);
    }
    async updateTriageWeights(id, payload) {
        const existing = sanitizeDocument(await TriageSessions().findOne({ id }).lean().exec());
        if (!existing)
            throw notFound("TRIAGE_SESSION_NOT_FOUND", "Session de triage introuvable.");
        const weightExtraKg = readNumber(payload.weight_extra_kg);
        const weightCat1Kg = readNumber(payload.weight_cat1_kg);
        const weightCat2Kg = readNumber(payload.weight_cat2_kg);
        const weightRejectKg = readNumber(payload.weight_reject_kg);
        const total = weightExtraKg + weightCat1Kg + weightCat2Kg + weightRejectKg;
        const extraPercent = total > 0 ? round1((weightExtraKg / total) * 100) : 0;
        const cat1Percent = total > 0 ? round1((weightCat1Kg / total) * 100) : 0;
        const cat2Percent = total > 0 ? round1((weightCat2Kg / total) * 100) : 0;
        const rejectPercent = total > 0 ? round1((weightRejectKg / total) * 100) : 0;
        const startedAt = readString(payload.started_at, existing.started_at);
        const durationHours = startedAt ? (Date.now() - new Date(startedAt).getTime()) / 3_600_000 : 0;
        const yieldKgPerHour = durationHours > 0 ? round1(total / durationHours) : null;
        const now = nowIso();
        await TriageSessions().updateOne({ id }, {
            $set: {
                weight_extra_kg: weightExtraKg,
                weight_cat1_kg: weightCat1Kg,
                weight_cat2_kg: weightCat2Kg,
                weight_reject_kg: weightRejectKg,
                total_sorted_kg: total,
                extra_percent: extraPercent,
                cat1_percent: cat1Percent,
                cat2_percent: cat2Percent,
                reject_percent: rejectPercent,
                yield_kg_per_hour: yieldKgPerHour,
                updated_at: now,
            },
        }).exec();
        const session = sanitizeDocument(await TriageSessions().findOne({ id }).lean().exec());
        const notifications = [];
        if (rejectPercent > 10 && total > 50) {
            notifications.push(await createPhase2Notification({
                code: "AL-TRI-01",
                title: "Taux de rejet > 10%",
                message: `Session ${readString(existing.session_number, id)} — rejet: ${rejectPercent}% (${weightRejectKg} kg). Verifier calibrage tapis.`,
                severity: "warning",
                entityType: "triage_session",
                entityId: id,
                metadata: { reject_percent: rejectPercent, weight_reject_kg: weightRejectKg },
            }));
        }
        return {
            data: session,
            session,
            notifications,
        };
    }
    async addTriageQualityCheck(payload) {
        const sessionId = readString(payload.session_id);
        if (!sessionId)
            throw badRequest("SESSION_ID_REQUIRED", "La session de triage est requise.");
        const session = sanitizeDocument(await TriageSessions().findOne({ id: sessionId }).lean().exec());
        if (!session)
            throw notFound("TRIAGE_SESSION_NOT_FOUND", "Session de triage introuvable.");
        const sampleWeightKg = readNumber(payload.sample_weight_kg, Number.NaN);
        if (!Number.isFinite(sampleWeightKg) || sampleWeightKg <= 0) {
            throw badRequest("SAMPLE_WEIGHT_REQUIRED", "Le poids d'echantillon est requis.");
        }
        const totalItemsChecked = sampleWeightKg * 40;
        const totalErrors = readNumber(payload.extra_error_count)
            + readNumber(payload.cat1_error_count)
            + readNumber(payload.cat2_error_count)
            + readNumber(payload.reject_error_count);
        const errorRatePercent = totalItemsChecked > 0
            ? round1(((totalItemsChecked - totalErrors) / totalItemsChecked) * 100)
            : 100;
        const now = nowIso();
        const check = await prepareInsertDocument("triage_quality_checks", {
            session_id: sessionId,
            checked_at: now,
            inspector_name: readString(payload.inspector_name) || null,
            sample_weight_kg: sampleWeightKg,
            extra_error_count: readNumber(payload.extra_error_count),
            cat1_error_count: readNumber(payload.cat1_error_count),
            cat2_error_count: readNumber(payload.cat2_error_count),
            reject_error_count: readNumber(payload.reject_error_count),
            error_rate_percent: errorRatePercent,
            notes: readString(payload.notes) || null,
        });
        await TriageQualityChecks().create([check]);
        await TriageSessions().updateOne({ id: sessionId }, { $set: { quality_score_percent: errorRatePercent, updated_at: now } }).exec();
        const notifications = [];
        if (errorRatePercent < 90) {
            notifications.push(await createPhase2Notification({
                code: "AL-TRI-03",
                title: "Score qualite triage < 90%",
                message: `Session ${readString(session.session_number, sessionId)} — score: ${errorRatePercent}%. Pause et re-calibrage requis.`,
                severity: "warning",
                entityType: "triage_session",
                entityId: sessionId,
                metadata: { quality_score_percent: errorRatePercent },
            }));
        }
        return {
            data: sanitizeDocument(check),
            session: sanitizeDocument(await TriageSessions().findOne({ id: sessionId }).lean().exec()),
            notifications,
        };
    }
    async closeTriageSession(id) {
        const session = sanitizeDocument(await TriageSessions().findOne({ id }).lean().exec());
        if (!session)
            throw notFound("TRIAGE_SESSION_NOT_FOUND", "Session de triage introuvable.");
        if (session.status !== "EN_COURS" && session.status !== "PAUSE") {
            throw badRequest("TRIAGE_SESSION_NOT_CLOSABLE", "Seule une session EN_COURS ou en PAUSE peut etre cloturee.");
        }
        const now = nowIso();
        const durationMinutes = session.started_at
            ? Math.round((Date.now() - new Date(session.started_at).getTime()) / 60_000)
            : 0;
        const yieldKgPerHour = durationMinutes > 0
            ? round1(readNumber(session.total_sorted_kg) / (durationMinutes / 60))
            : null;
        await TriageSessions().updateOne({ id }, {
            $set: {
                status: "TERMINE",
                ended_at: now,
                duration_minutes: durationMinutes,
                yield_kg_per_hour: yieldKgPerHour,
                updated_at: now,
            },
        }).exec();
        const gradeMap = [
            { grade: "EXTRA", weight_kg: readNumber(session.weight_extra_kg) },
            { grade: "CATEGORIE_I", weight_kg: readNumber(session.weight_cat1_kg) },
            { grade: "CATEGORIE_II", weight_kg: readNumber(session.weight_cat2_kg) },
            { grade: "REJETE", weight_kg: readNumber(session.weight_reject_kg) },
        ];
        const subLots = [];
        for (const item of gradeMap.filter((entry) => entry.weight_kg > 0)) {
            const subLot = await prepareInsertDocument("triage_sublots", {
                session_id: id,
                parent_reception_id: readString(session.parent_reception_id) || "",
                parent_lot_number: readString(session.parent_lot_number),
                grade: item.grade,
                lot_number: `${readString(session.parent_lot_number)}${SUBLOT_SUFFIX[item.grade]}`,
                weight_kg: item.weight_kg,
                percent_of_parent: readNumber(session.parent_weight_kg) > 0
                    ? round1((item.weight_kg / readNumber(session.parent_weight_kg)) * 100)
                    : 0,
                destination: SUBLOT_DESTINATION[item.grade],
                qr_label_url: null,
                created_at: now,
            });
            subLots.push(sanitizeDocument(subLot));
        }
        if (subLots.length > 0) {
            await TriageSublots().create(subLots);
        }
        const stockLots = [];
        for (const subLot of subLots.filter((entry) => entry.destination !== "DESTRUCTION")) {
            const stockLot = await prepareInsertDocument("stock_lots", {
                lot_number: subLot.lot_number,
                product_id: null,
                source_reception_id: readString(subLot.parent_reception_id) || null,
                source_lot_internal: readString(subLot.parent_lot_number) || null,
                source_stage: "TRIAGE",
                variety: readString(session.variety) || null,
                origin_country: "TN",
                initial_quantity: readNumber(subLot.weight_kg),
                current_quantity: readNumber(subLot.weight_kg),
                unit: "kg",
                status: "QUARANTINE",
                reception_date: now.slice(0, 10),
                location_id: null,
                batch_id: null,
                created_by: readString(session.created_by) || null,
                created_at: now,
                updated_at: now,
            });
            stockLots.push(sanitizeDocument(stockLot));
        }
        if (stockLots.length > 0) {
            await StockLots().create(stockLots);
        }
        const stockMovements = [];
        for (const stockLot of stockLots) {
            const movement = await prepareInsertDocument("stock_movements", {
                movement_type: "RECEPTION",
                lot_id: stockLot.id,
                product_id: null,
                quantity: readNumber(stockLot.initial_quantity),
                unit: readString(stockLot.unit) || "kg",
                document_type: "TRIAGE_CLOSE",
                document_reference: readString(session.session_number, id),
                performed_by: readString(session.created_by) || null,
                notes: `Entree stock triage — ${readString(session.session_number, id)}`,
                created_at: now,
            });
            stockMovements.push(sanitizeDocument(movement));
        }
        if (stockMovements.length > 0) {
            await StockMovements().create(stockMovements);
        }
        return {
            data: {
                session_number: readString(session.session_number, id),
                sub_lots_created: subLots.length,
                duration_minutes: durationMinutes,
            },
            session: sanitizeDocument(await TriageSessions().findOne({ id }).lean().exec()),
            subLots,
            stockLots,
            stockMovements,
        };
    }
    async toggleTriageRunState(id, payload) {
        const session = sanitizeDocument(await TriageSessions().findOne({ id }).lean().exec());
        if (!session)
            throw notFound("TRIAGE_SESSION_NOT_FOUND", "Session de triage introuvable.");
        const action = readString(payload.action);
        const nextStatus = action === "PAUSE"
            ? "PAUSE"
            : action === "RESUME"
                ? "EN_COURS"
                : session.status === "EN_COURS"
                    ? "PAUSE"
                    : "EN_COURS";
        await TriageSessions().updateOne({ id }, { $set: { status: nextStatus, updated_at: nowIso() } }).exec();
        return {
            data: { status: nextStatus },
            session: sanitizeDocument(await TriageSessions().findOne({ id }).lean().exec()),
        };
    }
    async getTriageKpis() {
        const rows = sanitizeDocument(await TriageSessions()
            .find({})
            .select("status extra_percent cat1_percent cat2_percent reject_percent yield_kg_per_hour quality_score_percent total_sorted_kg")
            .sort({ created_at: -1 })
            .limit(200)
            .lean()
            .exec());
        const active = rows.filter((row) => row.status === "EN_COURS" || row.status === "PAUSE").length;
        const completed = rows.filter((row) => row.status === "TERMINE");
        const avgExtra = completed.length > 0
            ? round1(completed.reduce((sum, row) => sum + readNumber(row.extra_percent), 0) / completed.length)
            : null;
        const avgReject = completed.length > 0
            ? round1(completed.reduce((sum, row) => sum + readNumber(row.reject_percent), 0) / completed.length)
            : null;
        const totalSortedKg = rows.reduce((sum, row) => sum + readNumber(row.total_sorted_kg), 0);
        return {
            active_count: active,
            completed_count: completed.length,
            avg_extra_pct: avgExtra,
            avg_reject_pct: avgReject,
            total_sorted_kg: totalSortedKg,
        };
    }
    async getLotTraceability(lotNumber) {
        return buildLotTraceabilityDossier(lotNumber);
    }
    async getLotGenealogy(lotNumber) {
        const dossier = await buildLotTraceabilityDossier(lotNumber);
        return buildGenealogyFromDossier(dossier);
    }
    async acknowledgePhase2Alert(id, readBy) {
        const notification = sanitizeDocument(await Notifications().findOne({ id }).lean().exec());
        if (!notification)
            throw notFound("PHASE2_ALERT_NOT_FOUND", "Alerte Phase 2 introuvable.");
        const code = readString(notification.notification_type, notification.type);
        if (!PHASE2_ALERT_CODES.includes(code)) {
            throw badRequest("NOT_PHASE2_ALERT", "Cette notification n'appartient pas au centre d'alertes Phase 2.");
        }
        const readAt = nowIso();
        await Notifications().updateOne({ id }, {
            $set: {
                is_read: true,
                read_at: readAt,
                read_by: readString(readBy) || "operator",
                updated_at: readAt,
            },
        }).exec();
        return sanitizeDocument(await Notifications().findOne({ id }).lean().exec());
    }
    async acknowledgeAllPhase2Alerts(readBy) {
        const filter = {
            is_read: { $ne: true },
            $or: [
                { notification_type: { $in: PHASE2_ALERT_CODES } },
                { type: { $in: PHASE2_ALERT_CODES } },
            ],
        };
        const unread = sanitizeDocument(await Notifications().find(filter).lean().exec());
        const ids = unread.map((row) => String(row.id || "")).filter(Boolean);
        if (ids.length === 0) {
            return {
                data: [],
                notifications: [],
            };
        }
        const readAt = nowIso();
        await Notifications().updateMany({ id: { $in: ids } }, {
            $set: {
                is_read: true,
                read_at: readAt,
                read_by: readString(readBy) || "operator",
                updated_at: readAt,
            },
        }).exec();
        return {
            data: ids,
            notifications: sanitizeDocument(await Notifications().find({ id: { $in: ids } }).lean().exec()),
        };
    }
};
Phase2Service = __decorate([
    Injectable()
], Phase2Service);
export { Phase2Service };
