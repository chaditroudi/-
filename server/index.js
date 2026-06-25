import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { applyCreateAuditFields, applyUpdateAuditFields, buildAuditLogEntries } from './services/audit.js';
import { createSessionPayload as createJwtSessionPayload, SESSION_DURATION_SECONDS } from './services/auth.js';
import { conflictError, notFoundError, sendApiError, unauthorizedError, validationError } from './services/apiErrors.js';
import { authorizeRpc, authorizeTableAction, createOptionalAuthMiddleware, requireAuth, requireRoles } from './services/middleware.js';
import {
  assertBioCertificationForReception,
  assertUniqueSupplierIdentifier,
  buildRoyalPalmLotId,
  deriveReceptionPhase1State,
  normalizeRegionCode,
  shouldRecalculateSupplier,
} from './services/phase1.js';
import { isSelfServiceRoleAllowed, normalizeRoles } from './services/rbac.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const API_HOST = process.env.API_HOST || '0.0.0.0';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/date_harvest_hub';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'date_harvest_hub';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

const redactMongoUri = (uri) => uri.replace(
  /(mongodb(?:\+srv)?:\/\/)([^:@/?]+)(?::([^@/?]+))?@/,
  '$1<credentials>@',
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});

let db;

const DEFAULT_ADMIN = {
  email: 'admin@ecodatte.local',
  password: 'Admin123!',
  full_name: 'System Administrator',
  role: 'administrateur_systeme',
};

const STEP_DEFINITIONS = [
  { code: 'RECEPTION', name: 'Reception', description: 'Reception et identification des lots', sequence_order: 1 },
  { code: 'QC_IN', name: 'Controle Qualite', description: 'Controle qualite entrant', sequence_order: 2 },
  { code: 'CLEANING', name: 'Nettoyage', description: 'Lavage et nettoyage', sequence_order: 3 },
  { code: 'TREATMENT', name: 'Traitement', description: 'Fumigation et traitement', sequence_order: 4 },
  { code: 'DRYING', name: 'Sechage', description: 'Hydratation / sechage', sequence_order: 5 },
  { code: 'SORTING', name: 'Triage', description: 'Triage et calibrage', sequence_order: 6 },
  { code: 'PACKING', name: 'Conditionnement', description: 'Conditionnement primaire et secondaire', sequence_order: 7 },
  { code: 'STORAGE', name: 'Entreposage', description: 'Stockage et expedition', sequence_order: 8 },
];

const QC_CHECKLISTS = [
  {
    code: 'QC-DATES-STD',
    name: 'Reception dattes',
    reception_type: 'DATTE',
    description: 'Checklist standard reception dattes',
    version: 1,
    items: [
      { code: 'DOCS', category: 'Documents', name: 'Conformite BL et certificats', severity: 'MAJEUR', sequence_order: 1 },
      { code: 'TRACE', category: 'Origine', name: 'Origine et tracabilite', severity: 'CRITIQUE', sequence_order: 2 },
      { code: 'HUM', category: 'Physicochimie', name: 'Humidite reception', severity: 'MAJEUR', sequence_order: 3 },
      { code: 'VIS', category: 'Visuel', name: 'Aspect visuel et defauts', severity: 'MAJEUR', sequence_order: 4 },
      { code: 'CONT', category: 'Contamination', name: 'Parasites / moisissures', severity: 'CRITIQUE', sequence_order: 5 },
    ],
  },
  {
    code: 'QC-PACK-STD',
    name: 'Reception emballages',
    reception_type: 'EMBALLAGE',
    description: 'Checklist standard reception emballages',
    version: 1,
    items: [
      { code: 'REF', category: 'Reference', name: 'Reference article', severity: 'MAJEUR', sequence_order: 1 },
      { code: 'PACKINT', category: 'Emballage', name: 'Integrite emballage', severity: 'MAJEUR', sequence_order: 2 },
      { code: 'LABEL', category: 'Etiquetage', name: 'Etiquetage fournisseur', severity: 'MINEUR', sequence_order: 3 },
    ],
  },
];

const SPECIAL_FK_OVERRIDES = {
  shipment_preparations: 'shipment_id',
  receptions_v2: 'reception_id',
  qc_checklists: 'checklist_id',
  qc_inspections: 'inspection_id',
};

const sanitize = (value) => {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const cloned = {};
    Object.entries(value).forEach(([key, entry]) => {
      if (key !== '_id') {
        cloned[key] = sanitize(entry);
      }
    });
    return cloned;
  }
  return value;
};

const deepClone = (value) => structuredClone(sanitize(value));

const toComparable = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && value.trim() !== '') return asNumber;
    const asDate = Date.parse(value);
    if (!Number.isNaN(asDate)) return asDate;
  }
  if (value instanceof Date) return value.getTime();
  return value;
};

class MongooseCursor {
  constructor(model, query = {}) {
    this.model = model;
    this.query = query;
    this.sortSpec = null;
    this.limitValue = null;
  }

  sort(spec) {
    this.sortSpec = spec;
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  async toArray() {
    let request = this.model.find(this.query).lean();
    if (this.sortSpec) request = request.sort(this.sortSpec);
    if (typeof this.limitValue === 'number') request = request.limit(this.limitValue);
    return deepClone(await request.exec());
  }
}

const createMongooseDb = () => {
  const models = new Map();

  const getModel = (name) => {
    if (models.has(name)) return models.get(name);

    const schema = new mongoose.Schema({}, {
      strict: false,
      versionKey: false,
      collection: name,
    });

    schema.index({ id: 1 }, { unique: false, sparse: true });
    const model = mongoose.models[name] || mongoose.model(name, schema, name);
    models.set(name, model);
    return model;
  };

  return {
    collection(name) {
      const model = getModel(name);

      return {
        async findOne(query = {}) {
          const doc = await model.findOne(query).lean().exec();
          return doc ? deepClone(doc) : null;
        },

        find(query = {}) {
          return new MongooseCursor(model, query);
        },

        async findOneAndUpdate(query = {}, update = {}, options = {}) {
          const doc = await model.findOneAndUpdate(query, update, {
            upsert: options.upsert ?? false,
            new: true,
            returnDocument: options.returnDocument || 'after',
            setDefaultsOnInsert: true,
          }).lean().exec();

          return { value: doc ? deepClone(doc) : null };
        },

        async insertOne(doc) {
          await model.create([doc]);
        },

        async insertMany(docs) {
          if (docs.length === 0) return;
          await model.insertMany(docs, { ordered: true });
        },

        async updateMany(query = {}, update = {}) {
          await model.updateMany(query, update).exec();
        },

        async deleteMany(query = {}) {
          await model.deleteMany(query).exec();
        },

        async countDocuments(query = {}) {
          return model.countDocuments(query).exec();
        },
      };
    },
  };
};

const normalizeFilterValue = (value) => {
  if (Array.isArray(value)) return value.map(normalizeFilterValue);
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

const singularize = (table) => {
  if (SPECIAL_FK_OVERRIDES[table]) return SPECIAL_FK_OVERRIDES[table].replace(/_id$/, '');
  if (table.endsWith('ies')) return `${table.slice(0, -3)}y`;
  if (table.endsWith('s')) return table.slice(0, -1);
  return table;
};

const buildMongoFilter = (filters = []) => {
  const query = {};

  filters.forEach((filter) => {
    const field = filter.column;
    const value = normalizeFilterValue(filter.value);

    if (!query[field] || typeof query[field] !== 'object' || Array.isArray(query[field])) {
      query[field] = {};
    }

    if (filter.type === 'eq') {
      query[field] = value;
    } else if (filter.type === 'in') {
      query[field] = { $in: Array.isArray(value) ? value : [value] };
    } else if (filter.type === 'gte') {
      query[field] = { ...(typeof query[field] === 'object' && !Array.isArray(query[field]) ? query[field] : {}), $gte: value };
    } else if (filter.type === 'lte') {
      query[field] = { ...(typeof query[field] === 'object' && !Array.isArray(query[field]) ? query[field] : {}), $lte: value };
    }
  });

  return query;
};

const buildSort = (orderBy) => {
  if (!orderBy?.column) return undefined;
  return { [orderBy.column]: orderBy.ascending === false ? -1 : 1 };
};

const nextSequence = async (scope) => {
  const counters = db.collection('counters');
  const result = await counters.findOneAndUpdate(
    { scope },
    { $inc: { value: 1 }, $setOnInsert: { scope } },
    { upsert: true, returnDocument: 'after' },
  );
  return result.value?.value || 1;
};

const createNumber = async (prefix) => {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = await nextSequence(`${prefix}-${day}`);
  return `${prefix}-${day}-${String(sequence).padStart(4, '0')}`;
};

const calculateSupplierScore = (receptions = []) => {
  if (!Array.isArray(receptions) || receptions.length === 0) {
    return {
      quality_score: 0,
      delivered_lots_count: 0,
      total_delivered_tons: 0,
      rejection_rate: 0,
      last_delivery_date: null,
      supplier_status: 'pending_approval',
    };
  }

  const qualityValues = receptions.map((reception) => {
    if (reception.qc_grade === 'EXTRA') return 100;
    if (reception.qc_grade === 'CATEGORIE_I') return 80;
    if (reception.qc_grade === 'CATEGORIE_II') return 60;
    if (reception.qc_decision === 'REJETE') return 0;
    return Number(reception.qc_score ?? 0);
  });
  const qualityAverage = qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length;
  const qualityComponent = qualityAverage * 0.4;

  const rejectedCount = receptions.filter((reception) => reception.qc_decision === 'REJETE').length;
  const rejectionRate = receptions.length === 0 ? 0 : (rejectedCount / receptions.length) * 100;
  const rejectionComponent = (100 - rejectionRate) * 0.2;

  const averageWeightGap =
    receptions.reduce((sum, reception) => sum + Math.abs(Number(reception.weight_gap_percent ?? 0)), 0) / receptions.length;
  const quantityComponent = Math.max(0, 100 - averageWeightGap) * 0.15;

  const punctualSamples = receptions.filter((reception) => reception.expected_arrival_date && reception.actual_arrival_date);
  const punctualityRate =
    punctualSamples.length === 0
      ? 100
      : (punctualSamples.filter((reception) => {
          const expected = new Date(reception.expected_arrival_date).getTime();
          const actual = new Date(reception.actual_arrival_date).getTime();
          return Math.abs(actual - expected) <= 24 * 60 * 60 * 1000;
        }).length /
          punctualSamples.length) *
        100;
  const punctualityComponent = punctualityRate * 0.15;

  const completeDocsRate =
    (receptions.filter((reception) => Boolean(reception.delivery_note_number)).length / receptions.length) * 100;
  const documentsComponent = completeDocsRate * 0.1;

  const quality_score = Math.round((qualityComponent + rejectionComponent + quantityComponent + punctualityComponent + documentsComponent) * 10) / 10;
  const totalDeliveredKg = receptions.reduce((sum, reception) => sum + Number(reception.quantity_total ?? 0), 0);
  const last_delivery_date = receptions
    .map((reception) => reception.actual_arrival_date || reception.created_at)
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  return {
    quality_score,
    delivered_lots_count: receptions.length,
    total_delivered_tons: Math.round((totalDeliveredKg / 1000) * 10) / 10,
    rejection_rate: Math.round(rejectionRate * 10) / 10,
    last_delivery_date,
    supplier_status: rejectionRate > 20 ? 'blocked' : 'active',
  };
};

const recalculateSupplierMetrics = async (supplierId) => {
  if (!supplierId) return null;

  const receptions = sanitize(await db.collection('receptions_v2').find({ supplier_id: supplierId }).toArray());
  const metrics = calculateSupplierScore(receptions);
  await db.collection('suppliers').updateMany(
    { id: supplierId },
    {
      $set: {
        quality_score: metrics.quality_score,
        delivered_lots_count: metrics.delivered_lots_count,
        total_delivered_tons: metrics.total_delivered_tons,
        rejection_rate: metrics.rejection_rate,
        last_delivery_date: metrics.last_delivery_date,
        supplier_status: metrics.supplier_status,
      },
    },
  );
  return metrics;
};

const normalizeFiniteNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const distributeUnitCounts = (totalUnits, lots) => {
  const normalizedTotal = Math.max(1, Number(totalUnits || 1));
  const safeLots = Array.isArray(lots) ? lots : [];
  if (safeLots.length === 0) return [];
  if (safeLots.length === 1) return [normalizedTotal];

  const totalQuantity = safeLots.reduce((sum, lot) => sum + Number(lot.quantity || 0), 0);
  if (totalQuantity <= 0) {
    return safeLots.map((_, index) => (index === 0 ? normalizedTotal : 0));
  }

  const provisional = safeLots.map((lot) => {
    const exact = (Number(lot.quantity || 0) / totalQuantity) * normalizedTotal;
    return {
      base: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });

  let assigned = provisional.reduce((sum, item) => sum + item.base, 0);
  while (assigned < normalizedTotal) {
    let targetIndex = 0;
    for (let index = 1; index < provisional.length; index += 1) {
      if (provisional[index].remainder > provisional[targetIndex].remainder) {
        targetIndex = index;
      }
    }
    provisional[targetIndex].base += 1;
    provisional[targetIndex].remainder = 0;
    assigned += 1;
  }

  return provisional.map((item) => item.base);
};

const hoursSince = (dateLike, now = new Date()) => {
  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) return 0;
  return (now.getTime() - parsed.getTime()) / (1000 * 60 * 60);
};

const buildReceptionIntakeAlertEntries = async ({ reception, supplierId, actor, requestId }) => {
  const alertMessages = Array.isArray(reception.phase1_alerts) ? [...reception.phase1_alerts] : [];
  const arrivalDay = String(reception.actual_arrival_date || reception.created_at || '').slice(0, 10);

  if (reception.vehicle_number && arrivalDay) {
    const sameDayVehicleLoads = sanitize(await db.collection('receptions_v2').find({
      vehicle_number: reception.vehicle_number,
      actual_arrival_date: { $gte: `${arrivalDay}T00:00:00.000Z`, $lte: `${arrivalDay}T23:59:59.999Z` },
    }).toArray());

    if (sameDayVehicleLoads.length > 1) {
      const vehicleMessage = 'Vehicule deja enregistre plus tot le meme jour';
      if (!alertMessages.includes(vehicleMessage)) {
        alertMessages.push(vehicleMessage);
      }
    }
  }

  const alerts = [];
  for (const message of alertMessages) {
    alerts.push(await ensureDefaultsForInsert('reception_alerts', applyCreateAuditFields({
      alert_type: 'PHASE1_RECEPTION_ALERT',
      severity: message.includes('critique') || message.includes('elevee') ? 'CRITIQUE' : 'MAJEUR',
      reception_id: reception.id,
      supplier_id: supplierId || null,
      title: 'Alerte reception Phase 1',
      message,
      status: 'ACTIVE',
    }, actor)));
  }

  const notifications = [{
    notification_type: 'RECEPTION_VALIDATED',
    category: 'reception',
    title: `Nouvelle reception ${reception.reception_number}`,
    message: `Lot recu et en attente QC pour ${reception.quantity_total} ${reception.unit}.`,
    severity: reception.status === 'BLOQUE' ? 'warning' : 'info',
    entity_type: 'receptions_v2',
    entity_id: reception.id,
    action_url: '/',
    is_read: false,
    metadata: {
      reception_number: reception.reception_number,
      supplier_id: supplierId,
      status: reception.status,
      request_id: requestId,
    },
  }];

  return { alerts, notifications };
};

const ensureDefaultsForInsert = async (table, input) => {
  const now = new Date().toISOString();
  const doc = sanitize({ ...input });

  doc.id = doc.id || randomUUID();
  doc.created_at = doc.created_at || now;
  doc.updated_at = now;

  switch (table) {
    case 'profiles':
      doc.avatar_url = doc.avatar_url ?? null;
      doc.phone = doc.phone ?? null;
      break;
    case 'user_roles':
      doc.assigned_at = doc.assigned_at || now;
      doc.assigned_by = doc.assigned_by ?? null;
      break;
    case 'suppliers':
      doc.code = doc.code || `SUP-${String(await nextSequence('SUPPLIER')).padStart(4, '0')}`;
      doc.country = doc.country || 'Tunisie';
      doc.is_active = doc.is_active ?? true;
      doc.rating = doc.rating ?? 0;
      doc.supplier_status = doc.supplier_status || 'pending_approval';
      doc.produced_varieties = Array.isArray(doc.produced_varieties) && doc.produced_varieties.length > 0
        ? doc.produced_varieties
        : ['Deglet Nour'];
      break;
    case 'materials':
      doc.code = doc.code || `MAT-${String(await nextSequence('MATERIAL')).padStart(4, '0')}`;
      doc.unit = doc.unit || 'kg';
      doc.min_stock = doc.min_stock ?? 0;
      break;
    case 'employees':
      doc.employee_number = doc.employee_number || `EMP-${String(await nextSequence('EMPLOYEE')).padStart(4, '0')}`;
      doc.status = doc.status || 'active';
      doc.hire_date = doc.hire_date || now.slice(0, 10);
      break;
    case 'purchase_requisitions':
      doc.requisition_number = doc.requisition_number || await createNumber('DA');
      doc.status = doc.status || 'draft';
      doc.requester_id = doc.requester_id ?? null;
      doc.department = doc.department ?? null;
      break;
    case 'purchase_orders':
      doc.order_number = doc.order_number || await createNumber('BC');
      doc.status = doc.status || 'draft';
      doc.order_date = doc.order_date || now.slice(0, 10);
      doc.currency = doc.currency || 'TND';
      break;
    case 'purchase_order_lines':
      doc.received_quantity = Number(doc.received_quantity ?? 0);
      doc.total_price = doc.total_price ?? Number(doc.quantity || 0) * Number(doc.unit_price || 0);
      doc.material_id = doc.material_id ?? null;
      break;
    case 'material_receptions':
      doc.reception_number = doc.reception_number || await createNumber('REC');
      doc.status = doc.status || 'pending';
      doc.received_at = doc.received_at || now;
      break;
    case 'receptions_v2':
      doc.reception_number = !doc.reception_number || String(doc.reception_number).startsWith('REC-TEMP')
        ? await createNumber('REC')
        : doc.reception_number;
      doc.site_id = doc.site_id || 'default-site';
      doc.actual_arrival_date = doc.actual_arrival_date || now;
      {
        const derived = deriveReceptionPhase1State(doc);
        doc.status = derived.status || doc.status || 'BROUILLON';
        doc.phase1_alerts = derived.alerts;
      }
      break;
    case 'reception_lots':
      doc.stock_status = doc.stock_status || 'NON_STOCKE';
      doc.origin_country = doc.origin_country || 'Tunisie';
      if (!doc.reception_id) {
        throw validationError('RECEPTION_ID_REQUIRED', 'reception_id is required for reception lots.');
      }
      if (!doc.lot_internal) {
        const reception = sanitize(await db.collection('receptions_v2').findOne({ id: doc.reception_id }));
        const supplier = reception?.supplier_id
          ? sanitize(await db.collection('suppliers').findOne({ id: reception.supplier_id }))
          : null;
        const dateKey = formatDateKey(reception?.actual_arrival_date || now);
        const sequence = await nextSequence(`LOT-RP-${dateKey}`);
        doc.lot_internal = buildRoyalPalmLotId({
          region: supplier?.region,
          supplierCode: supplier?.code,
          dateKey,
          sequence,
        });
      }
      break;
    case 'reception_units':
      doc.barcode = doc.barcode || `BC-${randomUUID().slice(0, 8).toUpperCase()}`;
      doc.unit_status = doc.unit_status || 'NON_STOCKE';
      break;
    case 'weighbridge_events':
      doc.captured_at = doc.captured_at || now;
      break;
    case 'qc_inspections':
      doc.inspection_number = doc.inspection_number || await createNumber('QC');
      doc.started_at = doc.started_at || now;
      break;
    case 'qc_check_results':
      doc.checked_at = doc.checked_at || now;
      break;
    case 'qc_checklist_items':
      doc.is_active = doc.is_active ?? true;
      break;
    case 'reception_alerts':
      doc.status = doc.status || 'ACTIVE';
      break;
    case 'reception_audit_logs':
      doc.created_at = doc.created_at || now;
      break;
    case 'reception_audit_logs_v2':
      doc.performed_at = doc.performed_at || now;
      doc.performed_by = doc.performed_by || 'system';
      break;
    case 'reception_stock_movements':
      doc.movement_number = doc.movement_number || await createNumber('RSM');
      doc.performed_at = doc.performed_at || now;
      break;
    case 'production_orders':
      doc.order_number = doc.order_number || await createNumber('OF');
      doc.status = doc.status || 'draft';
      doc.priority = Number(doc.priority ?? 1);
      doc.actual_quantity = Number(doc.actual_quantity ?? 0);
      break;
    case 'production_steps':
      doc.status = doc.status || 'pending';
      doc.waste_quantity = Number(doc.waste_quantity ?? 0);
      break;
    case 'quality_checks':
      doc.checked_at = doc.checked_at || now;
      break;
    case 'production_audit_logs':
      doc.created_at = doc.created_at || now;
      break;
    case 'production_step_definitions':
      doc.is_active = doc.is_active ?? true;
      break;
    case 'batches':
      doc.batch_number = doc.batch_number || await createNumber('BAT');
      doc.reception_date = doc.reception_date || now.slice(0, 10);
      doc.status = doc.status || 'pending_inspection';
      doc.initial_weight_kg = Number(doc.initial_weight_kg ?? 0);
      doc.current_weight_kg = Number(doc.current_weight_kg ?? doc.initial_weight_kg ?? 0);
      break;
    case 'quality_inspections':
      doc.inspection_number = doc.inspection_number || await createNumber('INSP');
      doc.inspection_date = doc.inspection_date || now;
      break;
    case 'non_conformities':
      doc.nc_number = doc.nc_number || await createNumber('NC');
      doc.status = doc.status || 'open';
      break;
    case 'alerts':
      doc.status = doc.status || 'active';
      doc.severity = doc.severity || 'warning';
      break;
    case 'storage_zones':
      doc.code = doc.code || `ZONE-${String(await nextSequence('ZONE')).padStart(3, '0')}`;
      doc.is_active = doc.is_active ?? true;
      doc.current_load_kg = Number(doc.current_load_kg ?? 0);
      break;
    case 'batch_movements':
      doc.created_at = doc.created_at || now;
      break;
    case 'products':
      doc.code = doc.code || `PRD-${String(await nextSequence('PRODUCT')).padStart(4, '0')}`;
      doc.unit = doc.unit || 'kg';
      doc.category = doc.category || 'PF';
      doc.rotation_rule = doc.rotation_rule || 'FIFO';
      doc.is_active = doc.is_active ?? true;
      break;
    case 'stock_locations':
      doc.code = doc.code || `LOC-${String(await nextSequence('LOCATION')).padStart(4, '0')}`;
      doc.is_active = doc.is_active ?? true;
      doc.current_load_kg = Number(doc.current_load_kg ?? 0);
      doc.current_load_units = Number(doc.current_load_units ?? 0);
      break;
    case 'stock_lots':
      doc.lot_number = doc.lot_number || await createNumber('STK');
      doc.status = doc.status || 'QUARANTINE';
      doc.origin_country = doc.origin_country || 'Tunisie';
      doc.reception_date = doc.reception_date || now.slice(0, 10);
      doc.current_quantity = Number(doc.current_quantity ?? doc.initial_quantity ?? 0);
      doc.unit = doc.unit || 'kg';
      break;
    case 'stock_movements':
      doc.movement_number = doc.movement_number || await createNumber('MOV');
      doc.movement_date = doc.movement_date || now;
      break;
    case 'stock_alerts':
      doc.status = doc.status || 'active';
      doc.severity = doc.severity || 'warning';
      break;
    case 'inventory_counts':
      doc.inventory_number = doc.inventory_number || await createNumber('INV');
      doc.inventory_date = doc.inventory_date || now.slice(0, 10);
      doc.variance = Number(doc.counted_quantity || 0) - Number(doc.expected_quantity || 0);
      doc.variance_percent = Number(doc.expected_quantity || 0) === 0 ? 0 : (doc.variance / Number(doc.expected_quantity)) * 100;
      doc.adjustment_approved = doc.adjustment_approved ?? false;
      break;
    case 'shipment_preparations':
      doc.shipment_number = doc.shipment_number || await createNumber('SHIP');
      doc.status = doc.status || 'DRAFT';
      break;
    case 'shipment_lines':
      doc.picked_quantity = Number(doc.picked_quantity ?? 0);
      doc.unit = doc.unit || 'kg';
      doc.suggested_by_system = doc.suggested_by_system ?? false;
      break;
    case 'system_notifications':
      doc.is_read = doc.is_read ?? false;
      doc.created_at = doc.created_at || now;
      break;
    case 'system_audit_logs':
      doc.action_label = doc.action_label || doc.action || 'ACTION';
      doc.performed_at = doc.performed_at || now;
      break;
    case 'timesheets':
      doc.status = doc.status || 'draft';
      doc.break_minutes = Number(doc.break_minutes ?? 0);
      break;
    case 'employee_tasks':
      doc.status = doc.status || 'pending';
      doc.priority = doc.priority || 'medium';
      break;
    default:
      break;
  }

  return doc;
};

const ensureSeedData = async () => {
  const authUsers = db.collection('auth_users');
  const profiles = db.collection('profiles');
  const userRoles = db.collection('user_roles');

  const existingAdmin = await authUsers.findOne({ email: DEFAULT_ADMIN.email });
  if (!existingAdmin) {
    const userId = randomUUID();
    const now = new Date().toISOString();
    const password_hash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
    await authUsers.insertOne({ id: userId, email: DEFAULT_ADMIN.email, password_hash, created_at: now, updated_at: now });
    await profiles.insertOne({
      id: randomUUID(),
      user_id: userId,
      email: DEFAULT_ADMIN.email,
      full_name: DEFAULT_ADMIN.full_name,
      avatar_url: null,
      phone: null,
      created_at: now,
      updated_at: now,
    });
    await userRoles.insertOne({
      id: randomUUID(),
      user_id: userId,
      role: DEFAULT_ADMIN.role,
      assigned_at: now,
      assigned_by: null,
    });
  }

  const stepDefinitions = db.collection('production_step_definitions');
  if ((await stepDefinitions.countDocuments()) === 0) {
    for (const definition of STEP_DEFINITIONS) {
      await stepDefinitions.insertOne(await ensureDefaultsForInsert('production_step_definitions', definition));
    }
  }

  const qcChecklists = db.collection('qc_checklists');
  const checklistItems = db.collection('qc_checklist_items');
  if ((await qcChecklists.countDocuments()) === 0) {
    for (const checklist of QC_CHECKLISTS) {
      const { items, ...checklistHeader } = checklist;
      const insertedChecklist = await ensureDefaultsForInsert('qc_checklists', {
        ...checklistHeader,
        is_active: true,
      });
      await qcChecklists.insertOne(insertedChecklist);

      for (const item of items) {
        await checklistItems.insertOne(
          await ensureDefaultsForInsert('qc_checklist_items', {
            checklist_id: insertedChecklist.id,
            ...item,
            is_active: true,
          }),
        );
      }
    }
  }
};

const buildSessionForUser = async (user) => {
  const roleRows = await db.collection('user_roles').find({ user_id: user.id }).toArray();
  const profile = sanitize(await db.collection('profiles').findOne({ user_id: user.id }));
  const rawRoles = roleRows.map((row) => row.role).filter(Boolean);
  const domainRoles = normalizeRoles(rawRoles);
  const fullName = profile?.full_name || user.email?.split('@')?.[0] || 'Utilisateur';

  return createJwtSessionPayload(user, JWT_SECRET, {
    claims: {
      roles: domainRoles,
      legacyRoles: rawRoles,
    },
    user_metadata: {
      full_name: fullName,
      avatar_url: profile?.avatar_url ?? null,
      phone: profile?.phone ?? null,
      roles: rawRoles,
      domains: domainRoles,
      expires_in: SESSION_DURATION_SECONDS,
    },
  });
};

const appendAuditLogs = async (entries) => {
  if (!entries?.length) return;

  const prepared = [];
  for (const entry of entries) {
    prepared.push(await ensureDefaultsForInsert('system_audit_logs', entry));
  }

  if (prepared.length > 0) {
    await db.collection('system_audit_logs').insertMany(prepared);
  }
};

const appendSystemNotifications = async (entries) => {
  if (!entries?.length) return;

  const prepared = [];
  for (const entry of entries) {
    prepared.push(await ensureDefaultsForInsert('system_notifications', entry));
  }

  if (prepared.length > 0) {
    await db.collection('system_notifications').insertMany(prepared);
  }
};

const mapReceptionLotStatusToStockLotStatus = (stockStatus) => {
  if (stockStatus === 'STOCK_LIBERE') return 'VALIDATED';
  if (stockStatus === 'EN_QUARANTAINE') return 'QUARANTINE';
  if (stockStatus === 'STOCK_REJETE') return 'BLOCKED';
  return null;
};

const ensureRawDatesProductForReceptionLot = async ({ reception, receptionLot, actor, now }) => {
  if (reception?.product_id) {
    const existingProduct = sanitize(await db.collection('products').findOne({ id: reception.product_id }));
    if (existingProduct) return existingProduct;
  }

  const variety = receptionLot?.variety || reception?.variety || 'Deglet Nour';
  const byVariety = sanitize(await db.collection('products').findOne({
    category: 'MP',
    variety,
  }));
  if (byVariety) return byVariety;

  const productName = `Dattes ${variety}`;
  const byName = sanitize(await db.collection('products').findOne({
    category: 'MP',
    name: productName,
  }));
  if (byName) return byName;

  const createdProduct = await ensureDefaultsForInsert('products', applyCreateAuditFields({
    name: productName,
    category: 'MP',
    variety,
    unit: receptionLot?.unit || reception?.unit || 'kg',
    description: `Matiere premiere Royal Palm issue du lot d'entree ${receptionLot?.lot_internal || receptionLot?.lot_supplier || ''}`.trim(),
    rotation_rule: 'FIFO',
    threshold_min: 0,
    threshold_security: 0,
    threshold_max: null,
    is_active: true,
  }, actor, now));

  await db.collection('products').insertOne(createdProduct);
  return createdProduct;
};

const syncStockLotFromReceptionLot = async ({ receptionLot, actor = null, now = new Date().toISOString(), reason = 'SYNC_RECEPTION_LOT' }) => {
  if (!receptionLot?.id) return null;

  const stockLotStatus = mapReceptionLotStatusToStockLotStatus(receptionLot.stock_status);
  if (!stockLotStatus) return null;

  const reception = sanitize(await db.collection('receptions_v2').findOne({ id: receptionLot.reception_id }));
  if (!reception) return null;

  const units = sanitize(await db.collection('reception_units').find({ reception_lot_id: receptionLot.id }).toArray());
  const primaryUnit = units.find((unit) => unit.location_id || unit.position) || units[0] || null;
  const product = await ensureRawDatesProductForReceptionLot({ reception, receptionLot, actor, now });
  const existingStockLot = sanitize(await db.collection('stock_lots').findOne({ reception_lot_id: receptionLot.id }));

  const stockLotPayload = {
    product_id: product.id,
    supplier_id: reception.supplier_id || null,
    origin_farm: receptionLot.origin_farm || null,
    origin_country: receptionLot.origin_country || 'Tunisie',
    variety: receptionLot.variety || reception.variety || product.variety || null,
    harvest_date: receptionLot.harvest_date || null,
    reception_date: String(reception.actual_arrival_date || reception.created_at || now).slice(0, 10),
    initial_quantity: Number(existingStockLot?.initial_quantity ?? receptionLot.quantity ?? 0),
    current_quantity: Number(receptionLot.quantity ?? 0),
    unit: receptionLot.unit || reception.unit || product.unit || 'kg',
    status: stockLotStatus,
    quality_notes: `Lot de stock derive du lot d'entree ${receptionLot.lot_internal || receptionLot.lot_supplier}`,
    location_id: primaryUnit?.location_id || null,
    position: primaryUnit?.position || null,
    reception_lot_id: receptionLot.id,
    source_reception_id: reception.id,
    source_reception_number: reception.reception_number || null,
    source_lot_internal: receptionLot.lot_internal || null,
    source_lot_supplier: receptionLot.lot_supplier || null,
    source_stage: 'RECEPTION',
    source_status: receptionLot.stock_status || null,
    source_sync_reason: reason,
  };

  if (existingStockLot) {
    const updatePayload = sanitize(applyUpdateAuditFields(stockLotPayload, actor, now));
    await db.collection('stock_lots').updateMany(
      { id: existingStockLot.id },
      { $set: updatePayload },
    );
    return sanitize(await db.collection('stock_lots').findOne({ id: existingStockLot.id }));
  }

  const createdStockLot = await ensureDefaultsForInsert('stock_lots', applyCreateAuditFields({
    ...stockLotPayload,
    created_by: actor?.id || reception.created_by || null,
  }, actor, now));
  await db.collection('stock_lots').insertOne(createdStockLot);

  await db.collection('stock_movements').insertOne(await ensureDefaultsForInsert('stock_movements', applyCreateAuditFields({
    movement_type: 'RECEPTION',
    lot_id: createdStockLot.id,
    product_id: createdStockLot.product_id,
    quantity: createdStockLot.current_quantity,
    unit: createdStockLot.unit,
    source_location_id: null,
    destination_location_id: createdStockLot.location_id || null,
    document_type: 'RECEPTION_LOT',
    document_reference: reception.reception_number || receptionLot.lot_internal || receptionLot.lot_supplier || null,
    performed_by: actor?.id || reception.created_by || 'system',
    notes: `Creation automatique depuis le lot d'entree ${receptionLot.lot_internal || receptionLot.lot_supplier}`,
  }, actor, now)));

  return createdStockLot;
};

const syncStockLotsForReceptionLots = async ({ receptionLots = [], actor = null, now = new Date().toISOString(), reason }) => {
  const synced = [];
  for (const receptionLot of receptionLots) {
    const stockLot = await syncStockLotFromReceptionLot({ receptionLot, actor, now, reason });
    if (stockLot) synced.push(stockLot);
  }
  return synced;
};

const withApiHandler = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    sendApiError(res, error, req.requestId);
  }
};

app.use(createOptionalAuthMiddleware({
  db: {
    collection: (...args) => db.collection(...args),
  },
  jwtSecret: JWT_SECRET,
}));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    database: MONGODB_DB_NAME,
    mode: 'mongoose',
    authSeed: DEFAULT_ADMIN.email,
  });
});

app.post('/api/auth/signup', withApiHandler(async (req, res) => {
  const { email, password, options } = req.body || {};
  const fullName = options?.data?.full_name?.trim() || email?.split('@')?.[0] || 'Utilisateur';
  const requestedRole = options?.data?.role || 'responsable_production';

  if (!email || !password) {
    throw validationError('AUTH_SIGNUP_INVALID_INPUT', 'Email and password are required.');
  }

  if (!isSelfServiceRoleAllowed(requestedRole)) {
    throw validationError('AUTH_SIGNUP_ROLE_FORBIDDEN', 'This role cannot be requested via self-service signup.');
  }

  const authUsers = db.collection('auth_users');
  const existing = await authUsers.findOne({ email });
  if (existing) {
    throw conflictError('AUTH_USER_EXISTS', 'A user with this email already exists.');
  }

  const now = new Date().toISOString();
  const user = applyCreateAuditFields({
    id: randomUUID(),
    email,
    password_hash: await bcrypt.hash(password, 10),
    created_at: now,
    updated_at: now,
  }, null, now);

  await authUsers.insertOne(user);
  await db.collection('profiles').insertOne(await ensureDefaultsForInsert('profiles', applyCreateAuditFields({
    user_id: user.id,
    email,
    full_name: fullName,
    avatar_url: null,
    phone: null,
  }, user, now)));
  await db.collection('user_roles').insertOne(await ensureDefaultsForInsert('user_roles', applyCreateAuditFields({
    user_id: user.id,
    role: requestedRole,
    assigned_by: null,
  }, user, now)));

  await appendAuditLogs(buildAuditLogEntries({
    action: 'SIGNUP',
    table: 'auth_users',
    actor: user,
    requestId: req.requestId,
    afterRows: [{ id: user.id, email: user.email, role: requestedRole }],
    metadata: { fullName, role: requestedRole },
    performedAt: now,
  }));

  res.json({ data: { user: { id: user.id, email: user.email }, session: null } });
}));

app.post('/api/auth/signin', withApiHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    throw validationError('AUTH_SIGNIN_INVALID_INPUT', 'Email and password are required.');
  }

  const user = await db.collection('auth_users').findOne({ email });
  if (!user) {
    throw unauthorizedError('Invalid credentials.', { email });
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw unauthorizedError('Invalid credentials.', { email });
  }

  const session = await buildSessionForUser(user);
  await appendAuditLogs(buildAuditLogEntries({
    action: 'SIGNIN',
    table: 'auth_users',
    actor: user,
    requestId: req.requestId,
    afterRows: [{ id: user.id, email: user.email }],
    performedAt: new Date().toISOString(),
  }));

  res.json({ data: session });
}));

app.get('/api/auth/session', withApiHandler(async (req, res) => {
  const user = req.auth?.user || null;
  if (!user) {
    return res.json({ data: { session: null, user: null } });
  }

  res.json({
    data: {
      session: await buildSessionForUser(user),
      user: { id: user.id, email: user.email },
    },
  });
}));

app.post('/api/receptions/intake', requireAuth, requireRoles(['reception', 'admin']), withApiHandler(async (req, res) => {
  const actor = req.auth?.user || null;
  const payload = sanitize(req.body || {});
  const now = new Date().toISOString();

  const supplierId = String(payload.supplier_id || '').trim();
  if (!supplierId) {
    throw validationError('SUPPLIER_REQUIRED', 'A valid supplier is required for reception.');
  }

  const supplier = sanitize(await db.collection('suppliers').findOne({ id: supplierId }));
  if (!supplier) {
    throw validationError('SUPPLIER_REQUIRED', 'A valid supplier is required for reception.');
  }
  if ((supplier.supplier_status || 'pending_approval') !== 'active') {
    throw validationError('SUPPLIER_NOT_ACTIVE', 'Reception requires a supplier in active status.');
  }

  const purchaseOrderId = payload.purchase_order_id ? String(payload.purchase_order_id).trim() : null;
  if (purchaseOrderId) {
    const purchaseOrder = sanitize(await db.collection('purchase_orders').findOne({ id: purchaseOrderId }));
    if (!purchaseOrder) {
      throw notFoundError('Purchase order not found.', { purchase_order_id: purchaseOrderId });
    }
    if (purchaseOrder.supplier_id && purchaseOrder.supplier_id !== supplierId) {
      throw validationError('PURCHASE_ORDER_SUPPLIER_MISMATCH', 'The purchase order does not belong to the selected supplier.');
    }
  }

  const deliveryPhotos = Array.isArray(payload.delivery_note_photos) ? payload.delivery_note_photos.filter(Boolean) : [];
  if (deliveryPhotos.length < 2) {
    throw validationError('RECEPTION_PHOTOS_REQUIRED', 'At least 2 reception photos are required.');
  }

  const grossWeightKg = normalizeFiniteNumber(payload.gross_weight_kg, NaN);
  const tareWeightKg = normalizeFiniteNumber(payload.tare_weight_kg, NaN);
  const declaredWeightKg = normalizeFiniteNumber(payload.declared_weight_kg, null);
  const arrivalTemperatureC = normalizeFiniteNumber(payload.arrival_temperature_c, NaN);
  const unitCount = Math.max(1, Number(payload.unit_count || payload.crate_count || 1));
  const weighingSource = payload.weighing_source === 'MANUAL' ? 'MANUAL' : 'SCALE';
  const weighingSupervisor = String(payload.weighing_supervisor || '').trim();
  const weighingManualReason = String(payload.weighing_manual_reason || '').trim();
  const gateArrivalAt = payload.gate_arrival_at || payload.actual_arrival_date || now;
  const grossWeightCapturedAt = payload.gross_weight_captured_at || gateArrivalAt;
  const unloadingStartedAt = payload.unloading_started_at || grossWeightCapturedAt;
  const unloadingCompletedAt = payload.unloading_completed_at || now;
  const tareWeightCapturedAt = payload.tare_weight_captured_at || now;

  if (!(grossWeightKg > 0)) {
    throw validationError('GROSS_WEIGHT_REQUIRED', 'Gross vehicle weight is required.');
  }
  if (!(tareWeightKg >= 0)) {
    throw validationError('TARE_WEIGHT_REQUIRED', 'Tare vehicle weight is required.');
  }
  if (tareWeightKg >= grossWeightKg) {
    throw validationError('INVALID_TARE_WEIGHT', 'Tare weight must be lower than gross weight.');
  }
  if (!Number.isFinite(arrivalTemperatureC)) {
    throw validationError('ARRIVAL_TEMPERATURE_REQUIRED', 'Arrival temperature is required.');
  }

  const vehicleNumber = String(payload.vehicle_number || '').trim();
  const variety = String(payload.variety || '').trim();
  const harvestMethod = String(payload.harvest_method || '').trim();
  const maturityStage = String(payload.maturity_stage || '').trim();
  const storageZoneCode = String(payload.storage_zone_code || '').trim();

  if (!vehicleNumber) {
    throw validationError('VEHICLE_REQUIRED', 'Vehicle identification is required.');
  }
  if (!variety) {
    throw validationError('VARIETY_REQUIRED', 'Date variety is required.');
  }
  if (!harvestMethod) {
    throw validationError('HARVEST_METHOD_REQUIRED', 'Harvest method is required.');
  }
  if (!maturityStage) {
    throw validationError('MATURITY_STAGE_REQUIRED', 'Maturity stage is required.');
  }
  if (!storageZoneCode) {
    throw validationError('TEMPORARY_ZONE_REQUIRED', 'Temporary storage zone is required.');
  }
  if (!weighingSupervisor) {
    throw validationError('WEIGHING_SUPERVISOR_REQUIRED', 'Weighing supervisor is required.');
  }
  if (weighingSource === 'MANUAL' && weighingManualReason.length < 10) {
    throw validationError('MANUAL_WEIGHING_REASON_REQUIRED', 'Manual weighing requires a reason of at least 10 characters.');
  }

  assertBioCertificationForReception(supplier, payload.bio_declared);

  const netWeightKg = Number((grossWeightKg - tareWeightKg).toFixed(2));
  if (!(netWeightKg > 0)) {
    throw validationError('NET_WEIGHT_INVALID', 'Net weight must be greater than zero.');
  }

  const weightGapPercent = declaredWeightKg && declaredWeightKg > 0
    ? Number((Math.abs(netWeightKg - declaredWeightKg) / declaredWeightKg * 100).toFixed(2))
    : null;

  const rawLots = Array.isArray(payload.lots) ? payload.lots : [];
  if (rawLots.length === 0) {
    throw validationError('LOTS_REQUIRED', 'At least one lot is required.');
  }

  const normalizedLots = rawLots.map((lot, index) => ({
    lot_supplier: String(lot?.lot_supplier || `LOT-${index + 1}`).trim(),
    quantity: Number(lot?.quantity || 0),
    origin_country: lot?.origin_country || 'Tunisie',
    origin_region: lot?.origin_region || supplier.region || null,
    origin_farm: lot?.origin_farm || supplier.oasis_name || null,
    harvest_date: lot?.harvest_date || payload.harvest_datetime || null,
    maturity_stage: lot?.maturity_stage || maturityStage || null,
    article_ref: lot?.article_ref || null,
    infestation_rate: normalizeFiniteNumber(lot?.infestation_rate, null),
    variety: lot?.variety || variety,
    rfid_tag: lot?.rfid_tag || null,
    parent_lot_id: lot?.parent_lot_id || null,
  }));

  if (normalizedLots.some((lot) => !lot.lot_supplier || !(lot.quantity > 0))) {
    throw validationError('LOT_DETAILS_REQUIRED', 'Each lot requires a supplier reference and positive quantity.');
  }

  const totalLotQuantity = Number(normalizedLots.reduce((sum, lot) => sum + lot.quantity, 0).toFixed(2));
  if (Math.abs(totalLotQuantity - netWeightKg) > 0.1) {
    throw validationError('LOT_QUANTITY_MISMATCH', 'The sum of lot quantities must match the net weight.');
  }

  const material = payload.material_id
    ? sanitize(await db.collection('materials').findOne({ id: payload.material_id }))
    : null;
  const unit = String(payload.unit || material?.unit || 'kg').trim() || 'kg';
  const grossToValidationMinutes = Math.max(
    0,
    Math.round(((new Date(now).getTime() - new Date(grossWeightCapturedAt).getTime()) / (1000 * 60)) * 10) / 10,
  );
  const receptionDurationMinutes = Math.max(
    0,
    Math.round(((new Date(now).getTime() - new Date(gateArrivalAt).getTime()) / (1000 * 60)) * 10) / 10,
  );
  const regionCode = normalizeRegionCode(payload.origin_region || supplier.region || null);

  const receptionInput = {
    reception_number: payload.reception_number || null,
    site_id: payload.site_id || 'default-site',
    supplier_id: supplierId,
    supplier_code_snapshot: supplier.code || null,
    supplier_name_snapshot: supplier.name || null,
    purchase_order_id: purchaseOrderId,
    spontaneous_delivery: payload.spontaneous_delivery ?? !purchaseOrderId,
    reception_type: payload.reception_type || 'DATTE',
    material_id: payload.material_id || null,
    quantity_total: netWeightKg,
    unit,
    packaging_type: payload.packaging_type || null,
    presentation: payload.presentation || 'En caisses',
    delivery_note_number: payload.delivery_note_number || null,
    delivery_note_photos: deliveryPhotos,
    vehicle_number: vehicleNumber,
    driver_name: payload.driver_name || null,
    remarks: payload.remarks || null,
    gross_weight_kg: grossWeightKg,
    tare_weight_kg: tareWeightKg,
    declared_weight_kg: declaredWeightKg,
    weight_gap_percent: weightGapPercent,
    crate_count: unitCount,
    pallet_count: payload.unit_type === 'PALETTE' ? unitCount : null,
    average_weight_per_crate: Number((netWeightKg / unitCount).toFixed(2)),
    variety,
    maturity_stage: maturityStage,
    harvest_method: harvestMethod,
    harvest_datetime: payload.harvest_datetime || null,
    estimated_harvest_date: payload.estimated_harvest_date || null,
    bio_declared: payload.bio_declared ?? false,
    arrival_temperature_c: arrivalTemperatureC,
    departure_time: payload.departure_time || null,
    transport_condition: payload.transport_condition || null,
    quick_visual_state: payload.quick_visual_state || null,
    quick_check_notes: payload.quick_check_notes || null,
    storage_zone_code: storageZoneCode,
    transport_duration_hours: normalizeFiniteNumber(payload.transport_duration_hours, null),
    phase1_alerts: Array.isArray(payload.phase1_alerts) ? payload.phase1_alerts.filter(Boolean) : [],
    created_by: payload.created_by || actor?.id || null,
    actual_arrival_date: payload.actual_arrival_date || now,
    gate_arrival_at: gateArrivalAt,
    gross_weight_captured_at: grossWeightCapturedAt,
    unloading_started_at: unloadingStartedAt,
    unloading_completed_at: unloadingCompletedAt,
    tare_weight_captured_at: tareWeightCapturedAt,
    reception_duration_minutes: receptionDurationMinutes,
    origin_oasis: payload.origin_oasis || supplier.oasis_name || null,
    origin_gps: payload.origin_gps || supplier.gps_coordinates || null,
    region_code: regionCode,
    weighing_source: weighingSource,
    weighing_supervisor: weighingSupervisor,
    weighing_manual_reason: weighingSource === 'MANUAL' ? weighingManualReason : null,
  };

  if (grossToValidationMinutes > 60 && !receptionInput.phase1_alerts.includes('Delai reception > 60 minutes')) {
    receptionInput.phase1_alerts.push('Delai reception > 60 minutes');
  }

  const reception = await ensureDefaultsForInsert('receptions_v2', applyCreateAuditFields(receptionInput, actor, now));
  await db.collection('receptions_v2').insertOne(reception);

  const lotUnitCounts = distributeUnitCounts(unitCount, normalizedLots);
  const createdLots = [];
  const createdUnits = [];

  for (let index = 0; index < normalizedLots.length; index += 1) {
    const lot = normalizedLots[index];
    const preparedLot = await ensureDefaultsForInsert('reception_lots', applyCreateAuditFields({
      reception_id: reception.id,
      lot_supplier: lot.lot_supplier,
      quantity: lot.quantity,
      unit,
      origin_country: lot.origin_country,
      origin_region: lot.origin_region,
      origin_farm: lot.origin_farm,
      harvest_date: lot.harvest_date,
      maturity_stage: lot.maturity_stage,
      article_ref: lot.article_ref,
      infestation_rate: lot.infestation_rate,
      variety: lot.variety,
      rfid_tag: lot.rfid_tag,
      parent_lot_id: lot.parent_lot_id,
      child_lot_ids: [],
      stock_status: reception.status === 'BLOQUE' ? 'EN_QUARANTAINE' : 'NON_STOCKE',
      quarantine_reason: reception.status === 'BLOQUE' ? 'Reception bloquee a l entree' : null,
    }, actor, now));

    preparedLot.qr_code_payload = JSON.stringify({
      lot_id: preparedLot.lot_internal,
      reception_number: reception.reception_number,
      variety: preparedLot.variety || reception.variety || null,
      net_weight_kg: preparedLot.quantity,
      reception_date: String(reception.actual_arrival_date || now).slice(0, 10),
      supplier_code: supplier.code || null,
    });

    createdLots.push(preparedLot);
  }

  if (createdLots.length > 0) {
    await db.collection('reception_lots').insertMany(createdLots);
  }

  let globalUnitSequence = 1;
  for (let index = 0; index < createdLots.length; index += 1) {
    const lot = createdLots[index];
    const countForLot = Math.max(0, lotUnitCounts[index] || 0);
    if (countForLot === 0) continue;

    const lotNetByUnit = Number((Number(lot.quantity || 0) / countForLot).toFixed(2));
    const lotTareByUnit = Number((tareWeightKg / unitCount).toFixed(2));
    const lotGrossByUnit = Number((lotNetByUnit + lotTareByUnit).toFixed(2));

    for (let unitIndex = 0; unitIndex < countForLot; unitIndex += 1) {
      createdUnits.push(await ensureDefaultsForInsert('reception_units', applyCreateAuditFields({
        reception_lot_id: lot.id,
        unit_type: payload.unit_type || 'PALETTE',
        quantity: lotNetByUnit,
        unit,
        gross_weight: lotGrossByUnit,
        net_weight: lotNetByUnit,
        tare_weight: lotTareByUnit,
        location_id: null,
        position: `${storageZoneCode}-${String(globalUnitSequence).padStart(3, '0')}`,
        unit_status: lot.stock_status,
        label_printed_at: now,
        label_printed_by: actor?.id || null,
        qr_label_text: `${lot.lot_internal} • ${reception.variety || ''} • ${String(lotNetByUnit)} ${unit}`.trim(),
        qr_code_payload: JSON.stringify({
          lot_id: lot.lot_internal,
          reception_number: reception.reception_number,
          unit_sequence: globalUnitSequence,
          quantity: lotNetByUnit,
          unit,
          storage_zone_code: storageZoneCode,
        }),
        rfid_tag: lot.rfid_tag || null,
      }, actor, now)));
      globalUnitSequence += 1;
    }
  }

  if (createdUnits.length > 0) {
    await db.collection('reception_units').insertMany(createdUnits);
  }

  await syncStockLotsForReceptionLots({
    receptionLots: createdLots,
    actor,
    now,
    reason: 'RECEPTION_INTAKE',
  });

  const weighbridgeEvents = [
    await ensureDefaultsForInsert('weighbridge_events', applyCreateAuditFields({
      reception_id: reception.id,
      event_type: 'GROSS',
      weight_kg: grossWeightKg,
      source: weighingSource === 'MANUAL' ? 'MANUAL_OVERRIDE' : 'MODBUS',
      reason: weighingSource === 'MANUAL' ? weighingManualReason : null,
      captured_by: actor?.id || null,
      captured_at: grossWeightCapturedAt,
      supervisor_name: weighingSupervisor,
    }, actor, now)),
    await ensureDefaultsForInsert('weighbridge_events', applyCreateAuditFields({
      reception_id: reception.id,
      event_type: 'TARE',
      weight_kg: tareWeightKg,
      source: weighingSource === 'MANUAL' ? 'MANUAL_OVERRIDE' : 'MODBUS',
      reason: weighingSource === 'MANUAL' ? weighingManualReason : 'Tare captured from current reception workflow.',
      captured_by: actor?.id || null,
      captured_at: tareWeightCapturedAt,
      supervisor_name: weighingSupervisor,
    }, actor, now)),
  ];
  await db.collection('weighbridge_events').insertMany(weighbridgeEvents);

  const { alerts, notifications } = await buildReceptionIntakeAlertEntries({
    reception,
    supplierId,
    actor,
    requestId: req.requestId,
  });
  if (weighingSource === 'MANUAL') {
    alerts.push(await ensureDefaultsForInsert('reception_alerts', applyCreateAuditFields({
      alert_type: 'MANUAL_WEIGHING_OVERRIDE',
      severity: 'MAJEUR',
      reception_id: reception.id,
      supplier_id: supplierId,
      title: 'Pesée manuelle utilisée',
      message: `Pesée manuelle validée par ${weighingSupervisor}: ${weighingManualReason}`,
      status: 'ACTIVE',
    }, actor, now)));
  }

  if (grossToValidationMinutes > 60) {
    alerts.push(await ensureDefaultsForInsert('reception_alerts', applyCreateAuditFields({
      alert_type: 'RECEPTION_DELAY',
      severity: 'MAJEUR',
      reception_id: reception.id,
      supplier_id: supplierId,
      title: 'Delai reception depasse',
      message: `La reception a pris ${grossToValidationMinutes} min entre la pesee brut et la validation.`,
      threshold_value: 60,
      current_value: grossToValidationMinutes,
      status: 'ACTIVE',
    }, actor, now)));
  }

  if (alerts.length > 0) {
    await db.collection('reception_alerts').insertMany(alerts);
  }
  await appendSystemNotifications(notifications);

  const receptionAuditDrafts = [
    {
      entity_type: 'RECEPTION',
      entity_id: reception.id,
      action: 'CREATE',
      old_state: null,
      new_state: { status: reception.status, reception_number: reception.reception_number },
      field_changed: null,
      performed_by: actor?.id || 'system',
      performed_at: now,
      reason: 'Reception intake workflow',
      ip_address: req.ip || null,
    },
    ...createdLots.map((lot) => ({
      entity_type: 'LOT',
      entity_id: lot.id,
      action: 'CREATE',
      old_state: null,
      new_state: { lot_internal: lot.lot_internal, stock_status: lot.stock_status },
      field_changed: null,
      performed_by: actor?.id || 'system',
      performed_at: now,
      reason: 'Reception intake workflow',
      ip_address: req.ip || null,
    })),
    ...createdUnits.map((unitRow) => ({
      entity_type: 'UNIT',
      entity_id: unitRow.id,
      action: 'CREATE',
      old_state: null,
      new_state: { barcode: unitRow.barcode, position: unitRow.position },
      field_changed: null,
      performed_by: actor?.id || 'system',
      performed_at: now,
      reason: 'Reception intake workflow',
      ip_address: req.ip || null,
    })),
  ];
  const receptionAuditEntries = [];
  for (const entry of receptionAuditDrafts) {
    receptionAuditEntries.push(await ensureDefaultsForInsert('reception_audit_logs_v2', entry));
  }

  if (receptionAuditEntries.length > 0) {
    await db.collection('reception_audit_logs_v2').insertMany(receptionAuditEntries);
  }

  await appendAuditLogs(buildAuditLogEntries({
    action: 'CREATE',
    table: 'receptions_v2',
    actor,
    requestId: req.requestId,
    afterRows: [reception],
    metadata: {
      lots_created: createdLots.length,
      units_created: createdUnits.length,
      intake: true,
    },
    performedAt: now,
  }));
  await appendAuditLogs(buildAuditLogEntries({
    action: 'CREATE',
    table: 'reception_lots',
    actor,
    requestId: req.requestId,
    afterRows: createdLots,
    metadata: {
      reception_id: reception.id,
      intake: true,
    },
    performedAt: now,
  }));
  await appendAuditLogs(buildAuditLogEntries({
    action: 'CREATE',
    table: 'reception_units',
    actor,
    requestId: req.requestId,
    afterRows: createdUnits,
    metadata: {
      reception_id: reception.id,
      intake: true,
    },
    performedAt: now,
  }));

  res.json({
    data: {
      reception,
      lots: createdLots,
      units: createdUnits,
      alerts,
      notifications,
    },
  });
}));

app.post('/api/qc/start', requireAuth, requireRoles(['qualite', 'admin']), withApiHandler(async (req, res) => {
  const actor = req.auth?.user || null;
  const { reception_id: receptionId, reception_lot_id: receptionLotId = null, checklist_id: checklistId = null, inspector_name: inspectorName, sampling_method: samplingMethod = null, nb_samples: nbSamples = null } = req.body || {};
  const now = new Date().toISOString();

  if (!receptionId) {
    throw validationError('RECEPTION_REQUIRED', 'QC inspection requires a valid reception.');
  }
  if (!String(inspectorName || '').trim()) {
    throw validationError('INSPECTOR_REQUIRED', 'Inspector name is required.');
  }

  const reception = sanitize(await db.collection('receptions_v2').findOne({ id: receptionId }));
  if (!reception) {
    throw validationError('RECEPTION_REQUIRED', 'QC inspection requires a valid reception.');
  }
  if (['LIBERE', 'REJETE', 'ANNULE'].includes(reception.status)) {
    throw validationError('QC_STATUS_BLOCKED', 'This reception can no longer enter QC.');
  }
  if (reception.created_by && actor?.id && reception.created_by === actor.id && !req.auth?.isAdmin) {
    throw validationError('QC_ROLE_SEPARATION', 'Reception operator cannot inspect the same lot.');
  }

  const existingOpenInspection = sanitize(await db.collection('qc_inspections').findOne({
    reception_id: receptionId,
    decision: null,
  }));

  if (existingOpenInspection) {
    return res.json({ data: existingOpenInspection });
  }

  await db.collection('receptions_v2').updateMany(
    { id: receptionId },
    { $set: applyUpdateAuditFields({ status: 'EN_QC', updated_at: now }, actor) },
  );

  const inspectionDelayHours = Number(hoursSince(reception.actual_arrival_date, new Date(now)).toFixed(2));
  const inspection = await ensureDefaultsForInsert('qc_inspections', applyCreateAuditFields({
    reception_id: receptionId,
    reception_lot_id: receptionLotId,
    checklist_id: checklistId,
    inspector_id: actor?.id || null,
    inspector_name: String(inspectorName).trim(),
    sampling_method: samplingMethod,
    nb_samples: nbSamples,
    sampled_by: String(inspectorName).trim(),
    sampling_time: now,
    inspection_delay_hours: inspectionDelayHours,
  }, actor, now));
  await db.collection('qc_inspections').insertOne(inspection);

  const qcNotifications = [];
  const qcAlerts = [];
  if (inspectionDelayHours > 12) {
    qcNotifications.push({
      notification_type: 'QC_DELAY_CRITICAL',
      category: 'quality',
      title: 'Inspection QC en retard critique',
      message: `La reception ${reception.reception_number} a attendu ${inspectionDelayHours}h avant demarrage QC.`,
      severity: 'error',
      entity_type: 'receptions_v2',
      entity_id: receptionId,
      action_url: '/',
      is_read: false,
      metadata: { inspection_delay_hours: inspectionDelayHours },
    });
    qcAlerts.push(await ensureDefaultsForInsert('reception_alerts', applyCreateAuditFields({
      alert_type: 'QC_DELAY_CRITICAL',
      severity: 'CRITIQUE',
      reception_id: receptionId,
      supplier_id: reception.supplier_id || null,
      title: 'QC demarre au-dela de 12h',
      message: `Inspection demarree apres ${inspectionDelayHours}h.`,
      status: 'ACTIVE',
    }, actor, now)));
  } else if (inspectionDelayHours > 4) {
    qcNotifications.push({
      notification_type: 'QC_DELAY_WARNING',
      category: 'quality',
      title: 'Inspection QC en retard',
      message: `La reception ${reception.reception_number} a attendu ${inspectionDelayHours}h avant demarrage QC.`,
      severity: 'warning',
      entity_type: 'receptions_v2',
      entity_id: receptionId,
      action_url: '/',
      is_read: false,
      metadata: { inspection_delay_hours: inspectionDelayHours },
    });
    qcAlerts.push(await ensureDefaultsForInsert('reception_alerts', applyCreateAuditFields({
      alert_type: 'QC_DELAY_WARNING',
      severity: 'MAJEUR',
      reception_id: receptionId,
      supplier_id: reception.supplier_id || null,
      title: 'QC demarre au-dela de 4h',
      message: `Inspection demarree apres ${inspectionDelayHours}h.`,
      status: 'ACTIVE',
    }, actor, now)));
  }

  if (qcAlerts.length > 0) {
    await db.collection('reception_alerts').insertMany(qcAlerts);
  }
  await appendSystemNotifications(qcNotifications);

  await db.collection('reception_audit_logs_v2').insertOne(await ensureDefaultsForInsert('reception_audit_logs_v2', {
    entity_type: 'QC',
    entity_id: inspection.id,
    action: 'QC_START',
    old_state: null,
    new_state: { reception_id: receptionId, status: 'EN_QC' },
    field_changed: null,
    performed_by: actor?.id || 'system',
    performed_at: now,
    reason: 'QC inspection started',
    ip_address: req.ip || null,
  }));

  res.json({ data: inspection });
}));

app.post('/api/qc/submit', requireAuth, requireRoles(['qualite', 'admin']), withApiHandler(async (req, res) => {
  const actor = req.auth?.user || null;
  const {
    inspectionId,
    decision,
    comment,
    qualitySummary,
    checkResults = [],
    labSampleRequired = false,
    labAnalyses = [],
    labStorageLocation = null,
    secondaryInspectorName = null,
    recommendedDecision = null,
    overrideJustification = null,
  } = req.body || {};
  const now = new Date().toISOString();

  if (!inspectionId) {
    throw validationError('INSPECTION_REQUIRED', 'Inspection id is required.');
  }
  if (!decision) {
    throw validationError('QC_DECISION_REQUIRED', 'QC decision is required.');
  }

  const inspection = sanitize(await db.collection('qc_inspections').findOne({ id: inspectionId }));
  if (!inspection) {
    throw validationError('INSPECTION_REQUIRED', 'Inspection id is required.');
  }
  if (inspection.ended_at) {
    throw validationError('QC_IMMUTABLE', 'Validated QC inspections are immutable. Create a correction instead.');
  }

  const reception = sanitize(await db.collection('receptions_v2').findOne({ id: inspection.reception_id }));
  if (!reception) {
    throw validationError('RECEPTION_REQUIRED', 'QC inspection requires a valid reception.');
  }

  const supplier = reception.supplier_id
    ? sanitize(await db.collection('suppliers').findOne({ id: reception.supplier_id }))
    : null;
  const doubleInspectionRequired = Number(reception.quantity_total || 0) > 10000;
  const labRequiredByRule = Number(reception.quantity_total || 0) > 5000 || Number(supplier?.delivered_lots_count || 0) === 0;

  if (doubleInspectionRequired && String(secondaryInspectorName || '').trim().length < 3) {
    throw validationError('QC_SECOND_INSPECTOR_REQUIRED', 'Lots above 10 tonnes require a second inspector name.');
  }
  if (labRequiredByRule && !labSampleRequired) {
    throw validationError('QC_LAB_REQUIRED', 'This lot requires a laboratory sample according to Phase 1 rules.');
  }
  if (labSampleRequired && (!Array.isArray(labAnalyses) || labAnalyses.length === 0)) {
    throw validationError('QC_LAB_ANALYSES_REQUIRED', 'At least one laboratory analysis must be selected.');
  }
  if (labSampleRequired && String(labStorageLocation || '').trim().length < 2) {
    throw validationError('QC_LAB_LOCATION_REQUIRED', 'Sample storage location is required.');
  }
  if (recommendedDecision && recommendedDecision !== decision && String(overrideJustification || '').trim().length < 20) {
    throw validationError('QC_OVERRIDE_JUSTIFICATION_REQUIRED', 'Override decision requires a justification of at least 20 characters.');
  }

  const preparedCheckResults = [];
  for (const result of checkResults) {
    preparedCheckResults.push(await ensureDefaultsForInsert('qc_check_results', applyCreateAuditFields({
      inspection_id: inspectionId,
      checklist_item_id: result.checklist_item_id || null,
      check_code: result.check_code,
      check_name: result.check_name,
      category: result.category || null,
      severity: result.severity,
      result: result.result,
      note: result.note || null,
      measured_value: result.measured_value || null,
      expected_value: result.expected_value || null,
      checked_by: actor?.id || null,
    }, actor, now)));
  }
  if (preparedCheckResults.length > 0) {
    await db.collection('qc_check_results').insertMany(preparedCheckResults);
  }

  const labSampleCode = labSampleRequired
    ? `LAB-${String((reception.reception_number || reception.id || 'REC')).replace(/[^A-Z0-9-]/gi, '').toUpperCase()}-01`
    : null;

  await db.collection('qc_inspections').updateMany(
    { id: inspectionId },
    {
      $set: applyUpdateAuditFields({
        decision,
        comment: comment || null,
        ended_at: now,
        lab_sample_required: labSampleRequired,
        lab_analyses: labSampleRequired ? labAnalyses : [],
        lab_storage_location: labSampleRequired ? String(labStorageLocation).trim() : null,
        lab_sample_code: labSampleCode,
        secondary_inspector_name: doubleInspectionRequired ? String(secondaryInspectorName).trim() : null,
        recommended_decision: recommendedDecision,
        override_justification: recommendedDecision && recommendedDecision !== decision ? String(overrideJustification).trim() : null,
      }, actor),
    },
  );

  const statusMap = {
    ACCEPTE: { receptionStatus: 'LIBERE', lotStatus: 'STOCK_LIBERE', alertSeverity: null, locationId: 'ZONE_MP_LIBEREE' },
    QUARANTAINE: { receptionStatus: 'BLOQUE', lotStatus: 'EN_QUARANTAINE', alertSeverity: 'MAJEUR', locationId: 'ZONE_QUARANTAINE' },
    REJETE: { receptionStatus: 'REJETE', lotStatus: 'STOCK_REJETE', alertSeverity: 'CRITIQUE', locationId: 'ZONE_REJET' },
  };
  const mapped = statusMap[decision];
  if (!mapped) {
    throw validationError('QC_DECISION_INVALID', 'Unsupported QC decision.');
  }

  const existingAlerts = Array.isArray(reception.phase1_alerts) ? [...reception.phase1_alerts] : [];
  if (labSampleRequired && !existingAlerts.includes('En attente labo')) {
    existingAlerts.push('En attente labo');
  }

  await db.collection('receptions_v2').updateMany(
    { id: inspection.reception_id },
    {
      $set: applyUpdateAuditFields({
        status: mapped.receptionStatus,
        qc_decision: decision,
        qc_score: qualitySummary?.score ?? null,
        qc_grade: qualitySummary?.grade ?? null,
        qc_auto_reject_reasons: qualitySummary?.automaticRejectReasons || null,
        qc_closed_at: now,
        qc_closed_by: actor?.id || inspection.inspector_id || null,
        lab_pending: labSampleRequired,
        lab_sample_code: labSampleCode,
        phase1_alerts: existingAlerts,
      }, actor),
    },
  );

  const lotUpdate = mapped.receptionStatus === 'LIBERE'
    ? {
        stock_status: mapped.lotStatus,
        release_date: now,
        released_by: actor?.id || inspection.inspector_id || null,
        quarantine_reason: null,
        quarantine_date: null,
      }
    : {
        stock_status: mapped.lotStatus,
        release_date: null,
        released_by: null,
        quarantine_date: now,
        quarantine_reason:
          comment ||
          (decision === 'REJETE'
            ? 'Reception rejetee apres controle qualite'
            : 'Reception placee en quarantaine apres controle qualite'),
      };

  await db.collection('reception_lots').updateMany(
    { reception_id: inspection.reception_id },
    { $set: applyUpdateAuditFields(lotUpdate, actor) },
  );
  const updatedReceptionLots = sanitize(await db.collection('reception_lots').find({ reception_id: inspection.reception_id }).toArray());
  await db.collection('reception_units').updateMany(
    { reception_lot_id: { $in: updatedReceptionLots.map((lot) => lot.id) } },
    { $set: applyUpdateAuditFields({ unit_status: mapped.lotStatus, location_id: mapped.locationId }, actor) },
  );

  await syncStockLotsForReceptionLots({
    receptionLots: updatedReceptionLots,
    actor,
    now,
    reason: 'QC_DECISION',
  });

  const qcAlertEntries = [];
  const qcNotifications = [];

  if (decision !== 'ACCEPTE') {
    qcAlertEntries.push(await ensureDefaultsForInsert('reception_alerts', applyCreateAuditFields({
      alert_type: decision === 'REJETE' ? 'QC_REJECTION' : 'QC_QUARANTINE',
      severity: mapped.alertSeverity,
      reception_id: inspection.reception_id,
      supplier_id: reception.supplier_id || null,
      title: decision === 'REJETE' ? 'Reception rejetee apres QC' : 'Reception en quarantaine',
      message: comment || `Decision ${decision} enregistree pour l'inspection ${inspection.inspection_number}`,
      status: 'ACTIVE',
    }, actor, now)));
  }

  if (labSampleRequired) {
    qcNotifications.push({
      notification_type: 'QC_LAB_PENDING',
      category: 'quality',
      title: 'Echantillon labo en attente',
      message: `Le lot de la reception ${reception.reception_number} avance avec un suivi labo ${labSampleCode}.`,
      severity: 'warning',
      entity_type: 'receptions_v2',
      entity_id: inspection.reception_id,
      action_url: '/',
      is_read: false,
      metadata: { lab_sample_code: labSampleCode, analyses: labAnalyses },
    });
  }

  if (decision === 'REJETE') {
    qcNotifications.push({
      notification_type: 'QC_REJECTION',
      category: 'quality',
      title: 'Lot rejete apres inspection QC',
      message: `La reception ${reception.reception_number} a ete rejetee.`,
      severity: 'error',
      entity_type: 'receptions_v2',
      entity_id: inspection.reception_id,
      action_url: '/',
      is_read: false,
      metadata: { supplier_id: reception.supplier_id, inspection_id: inspectionId },
    });
  }

  if (qcAlertEntries.length > 0) {
    await db.collection('reception_alerts').insertMany(qcAlertEntries);
  }
  await appendSystemNotifications(qcNotifications);

  const updatedInspection = sanitize(await db.collection('qc_inspections').findOne({ id: inspectionId }));

  await db.collection('reception_audit_logs_v2').insertOne(await ensureDefaultsForInsert('reception_audit_logs_v2', {
    entity_type: 'QC',
    entity_id: inspectionId,
    action: 'QC_DECISION',
    old_state: null,
    new_state: {
      decision,
      reception_status: mapped.receptionStatus,
      lab_sample_required: labSampleRequired,
      lab_sample_code: labSampleCode,
    },
    field_changed: null,
    performed_by: actor?.id || 'system',
    performed_at: now,
    reason: 'QC decision recorded',
    ip_address: req.ip || null,
  }));

  await appendAuditLogs(buildAuditLogEntries({
    action: 'UPDATE',
    table: 'receptions_v2',
    actor,
    requestId: req.requestId,
    afterRows: [sanitize(await db.collection('receptions_v2').findOne({ id: inspection.reception_id }))],
    metadata: {
      qc_decision: decision,
      inspection_id: inspectionId,
      endpoint: 'qc_submit',
    },
    performedAt: now,
  }));

  res.json({ data: updatedInspection });
}));

app.post('/api/reception-units/mark-printed', requireAuth, requireRoles(['reception', 'admin']), withApiHandler(async (req, res) => {
  const actor = req.auth?.user || null;
  const { unitId } = req.body || {};
  const now = new Date().toISOString();

  if (!unitId) {
    throw validationError('UNIT_REQUIRED', 'Unit id is required.');
  }

  const unit = sanitize(await db.collection('reception_units').findOne({ id: unitId }));
  if (!unit) {
    throw validationError('UNIT_REQUIRED', 'Unit id is required.');
  }

  await db.collection('reception_units').updateMany(
    { id: unitId },
    {
      $set: applyUpdateAuditFields({
        label_printed_at: now,
        label_printed_by: actor?.id || null,
      }, actor),
    },
  );

  const updatedUnit = sanitize(await db.collection('reception_units').findOne({ id: unitId }));
  await db.collection('reception_audit_logs_v2').insertOne(await ensureDefaultsForInsert('reception_audit_logs_v2', {
    entity_type: 'UNIT',
    entity_id: unitId,
    action: 'LABEL_PRINTED',
    old_state: null,
    new_state: { label_printed_at: now },
    field_changed: 'label_printed_at',
    performed_by: actor?.id || 'system',
    performed_at: now,
    reason: 'Label printed',
    ip_address: req.ip || null,
  }));

  res.json({ data: updatedUnit });
}));

app.post('/api/db/query', requireAuth, authorizeTableAction('read'), withApiHandler(async (req, res) => {
  const { table, filters = [], orderBy, limit } = req.body || {};
  if (!table) {
    throw validationError('TABLE_REQUIRED', 'Table is required.');
  }

  let cursor = db.collection(table).find(buildMongoFilter(filters));
  const sort = buildSort(orderBy);
  if (sort) cursor = cursor.sort(sort);
  if (limit) cursor = cursor.limit(Number(limit));

  const rows = sanitize(await cursor.toArray());
  res.json({ data: rows });
}));

app.post('/api/db/insert', requireAuth, authorizeTableAction('write'), withApiHandler(async (req, res) => {
  const { table, values } = req.body || {};
  if (!table) {
    throw validationError('TABLE_REQUIRED', 'Table is required.');
  }

  const actor = req.auth?.user || null;
  const rows = Array.isArray(values) ? values : [values];
  const prepared = [];
  for (const row of rows) {
    if (table === 'suppliers') {
      await assertUniqueSupplierIdentifier(db, {
        fiscal_identifier: row?.fiscal_identifier,
        supplierId: row?.id,
      });
    }

    if (table === 'receptions_v2') {
      const supplier = row?.supplier_id
        ? sanitize(await db.collection('suppliers').findOne({ id: row.supplier_id }))
        : null;
      if (!supplier) {
        throw validationError('SUPPLIER_REQUIRED', 'A valid supplier is required for reception.');
      }
      if ((supplier.supplier_status || 'pending_approval') !== 'active') {
        throw validationError('SUPPLIER_NOT_ACTIVE', 'Reception requires a supplier in active status.');
      }
      if (!Array.isArray(row?.delivery_note_photos) || row.delivery_note_photos.length < 2) {
        throw validationError('RECEPTION_PHOTOS_REQUIRED', 'At least 2 reception photos are required.');
      }
      assertBioCertificationForReception(supplier, row?.bio_declared);
    }

    if (table === 'qc_inspections') {
      const reception = row?.reception_id
        ? sanitize(await db.collection('receptions_v2').findOne({ id: row.reception_id }))
        : null;
      if (!reception) {
        throw validationError('RECEPTION_REQUIRED', 'QC inspection requires a valid reception.');
      }
      if (reception.created_by && actor?.id && reception.created_by === actor.id && !req.auth?.isAdmin) {
        throw validationError('QC_ROLE_SEPARATION', 'Reception operator cannot inspect the same lot.');
      }
      row.inspector_id = actor?.id || null;
    }

    prepared.push(await ensureDefaultsForInsert(table, applyCreateAuditFields(row || {}, actor)));
  }

  if (prepared.length > 0) {
    await db.collection(table).insertMany(prepared);
  }

  if (table === 'receptions_v2') {
    const alertsToCreate = [];
    const systemNotifications = [];
    for (const row of prepared) {
      const alertMessages = Array.isArray(row.phase1_alerts) ? row.phase1_alerts : [];
      const arrivalDay = String(row.actual_arrival_date || row.created_at || '').slice(0, 10);
      if (row.vehicle_number && arrivalDay) {
        const sameDayVehicleLoads = sanitize(await db.collection('receptions_v2').find({
          vehicle_number: row.vehicle_number,
          actual_arrival_date: { $gte: `${arrivalDay}T00:00:00.000Z`, $lte: `${arrivalDay}T23:59:59.999Z` },
        }).toArray());

        if (sameDayVehicleLoads.length > 1) {
          const vehicleMessage = 'Vehicule deja enregistre plus tot le meme jour';
          if (!alertMessages.includes(vehicleMessage)) {
            alertMessages.push(vehicleMessage);
          }
        }
      }

      for (const message of alertMessages) {
        alertsToCreate.push(await ensureDefaultsForInsert('reception_alerts', {
          alert_type: 'PHASE1_RECEPTION_ALERT',
          severity: message.includes('critique') || message.includes('elevee') ? 'CRITIQUE' : 'MAJEUR',
          reception_id: row.id,
          supplier_id: row.supplier_id || null,
          title: 'Alerte reception Phase 1',
          message,
          status: 'ACTIVE',
        }));
      }

      systemNotifications.push({
        notification_type: 'RECEPTION_VALIDATED',
        category: 'reception',
        title: `Nouvelle reception ${row.reception_number}`,
        message: `Lot recu et en attente QC pour ${row.quantity_total} ${row.unit}.`,
        severity: row.status === 'BLOQUE' ? 'warning' : 'info',
        entity_type: 'receptions_v2',
        entity_id: row.id,
        action_url: `/`,
        is_read: false,
        metadata: {
          reception_number: row.reception_number,
          supplier_id: row.supplier_id,
          status: row.status,
        },
      });
    }

    if (alertsToCreate.length > 0) {
      await db.collection('reception_alerts').insertMany(alertsToCreate);
    }
    await appendSystemNotifications(systemNotifications);
  }

  if (table === 'reception_lots') {
    await syncStockLotsForReceptionLots({
      receptionLots: prepared,
      actor,
      now: new Date().toISOString(),
      reason: 'INSERT_RECEPTION_LOT',
    });
  }

  if (table !== 'system_audit_logs') {
    await appendAuditLogs(buildAuditLogEntries({
      action: 'CREATE',
      table,
      actor,
      requestId: req.requestId,
      afterRows: prepared,
      performedAt: new Date().toISOString(),
    }));
  }

  res.json({ data: sanitize(prepared) });
}));

app.post('/api/db/update', requireAuth, authorizeTableAction('write'), withApiHandler(async (req, res) => {
  const { table, filters = [], values = {} } = req.body || {};
  if (!table) {
    throw validationError('TABLE_REQUIRED', 'Table is required.');
  }

  const actor = req.auth?.user || null;
  const query = buildMongoFilter(filters);
  const before = sanitize(await db.collection(table).find(query).toArray());

  if (table === 'suppliers' && values?.fiscal_identifier) {
    for (const row of before) {
      await assertUniqueSupplierIdentifier(db, {
        fiscal_identifier: values.fiscal_identifier,
        supplierId: row.id,
      });
    }
  }

  if (table === 'qc_inspections') {
    const lockedInspection = before.find((row) => row.ended_at);
    if (lockedInspection) {
      throw validationError('QC_IMMUTABLE', 'Validated QC inspections are immutable. Create a correction instead.');
    }
  }

  const updatePayload = sanitize(applyUpdateAuditFields({ ...values, updated_at: new Date().toISOString() }, actor));
  delete updatePayload.id;
  delete updatePayload.createdBy;
  delete updatePayload.created_by;

  await db.collection(table).updateMany(query, { $set: updatePayload });

  const ids = before.map((item) => item.id);
  const after = ids.length > 0
    ? sanitize(await db.collection(table).find({ id: { $in: ids } }).toArray())
    : [];

  if (table === 'receptions_v2') {
    const systemNotifications = [];
    for (let index = 0; index < after.length; index += 1) {
      const current = after[index];
      const previous = before[index] || null;
      if (shouldRecalculateSupplier(previous, current)) {
        const previousSupplier = current.supplier_id
          ? sanitize(await db.collection('suppliers').findOne({ id: current.supplier_id }))
          : null;
        const previousScore = Number(previousSupplier?.quality_score ?? 0);
        const previousStatus = previousSupplier?.supplier_status || 'pending_approval';
        const metrics = await recalculateSupplierMetrics(current.supplier_id);
        if (metrics) {
          if (previousScore >= 60 && metrics.quality_score < 60) {
            systemNotifications.push({
              notification_type: 'SUPPLIER_SCORE_ALERT',
              category: 'suppliers',
              title: 'Score fournisseur sous 60',
              message: `Le fournisseur lie a ${current.reception_number} est passe a ${metrics.quality_score}/100.`,
              severity: 'warning',
              entity_type: 'suppliers',
              entity_id: current.supplier_id,
              action_url: '/',
              is_read: false,
              metadata: metrics,
            });
          }
          if (previousStatus !== 'blocked' && metrics.supplier_status === 'blocked') {
            systemNotifications.push({
              notification_type: 'SUPPLIER_BLOCKED',
              category: 'suppliers',
              title: 'Fournisseur bloque automatiquement',
              message: `Le taux de rejet depasse 20% pour le fournisseur lie a ${current.reception_number}.`,
              severity: 'error',
              entity_type: 'suppliers',
              entity_id: current.supplier_id,
              action_url: '/',
              is_read: false,
              metadata: metrics,
            });
          }
        }
      }
    }
    await appendSystemNotifications(systemNotifications);
  }

  if (table === 'reception_lots') {
    await syncStockLotsForReceptionLots({
      receptionLots: after,
      actor,
      now: new Date().toISOString(),
      reason: 'UPDATE_RECEPTION_LOT',
    });
  }

  if (table !== 'system_audit_logs') {
    await appendAuditLogs(buildAuditLogEntries({
      action: 'UPDATE',
      table,
      actor,
      requestId: req.requestId,
      beforeRows: before,
      afterRows: after,
      performedAt: new Date().toISOString(),
    }));
  }

  res.json({ data: after, before });
}));

app.post('/api/db/delete', requireAuth, authorizeTableAction('write'), withApiHandler(async (req, res) => {
  const { table, filters = [] } = req.body || {};
  if (!table) {
    throw validationError('TABLE_REQUIRED', 'Table is required.');
  }

  const actor = req.auth?.user || null;
  const query = buildMongoFilter(filters);
  const removed = sanitize(await db.collection(table).find(query).toArray());

  if (table === 'suppliers') {
    for (const supplier of removed) {
      const linkedReceptions = await db.collection('receptions_v2').countDocuments({ supplier_id: supplier.id });
      const linkedLegacyReceptions = await db.collection('material_receptions').countDocuments({ supplier_id: supplier.id });
      if (linkedReceptions > 0 || linkedLegacyReceptions > 0) {
        throw validationError('SUPPLIER_DELETE_BLOCKED', 'Supplier with recorded lots/receptions cannot be deleted. Archive it instead.');
      }
    }
  }

  if (table === 'reception_lots') {
    await db.collection('stock_lots').deleteMany({ reception_lot_id: { $in: removed.map((lot) => lot.id) } });
  }

  await db.collection(table).deleteMany(query);

  if (table !== 'system_audit_logs') {
    await appendAuditLogs(buildAuditLogEntries({
      action: 'DELETE',
      table,
      actor,
      requestId: req.requestId,
      beforeRows: removed,
      performedAt: new Date().toISOString(),
    }));
  }

  res.json({ data: removed });
}));

app.post('/api/rpc/:name', requireAuth, authorizeRpc, withApiHandler(async (req, res) => {
  const { name } = req.params;

  if (name !== 'suggest_lots_for_picking') {
    throw notFoundError('RPC_NOT_FOUND', `Unknown RPC: ${name}`);
  }

  const { p_product_id, p_quantity } = req.body || {};
  const requestedQuantity = Number(p_quantity || 0);
  const product = sanitize(await db.collection('products').findOne({ id: p_product_id }));

  if (!product) {
    return res.json({ data: [] });
  }

  const lots = sanitize(await db.collection('stock_lots')
    .find({
      product_id: p_product_id,
      current_quantity: { $gt: 0 },
      status: 'VALIDATED',
    })
    .toArray());

  const rotationRule = product.rotation_rule || 'FIFO';
  const sortedLots = lots.sort((left, right) => {
    const leftKey = rotationRule === 'FEFO'
      ? left.dlc_date || left.dluo_date || left.reception_date || left.created_at
      : left.reception_date || left.created_at;
    const rightKey = rotationRule === 'FEFO'
      ? right.dlc_date || right.dluo_date || right.reception_date || right.created_at
      : right.reception_date || right.created_at;
    return toComparable(leftKey) - toComparable(rightKey);
  });

  let remaining = requestedQuantity;
  const suggestions = [];

  for (const lot of sortedLots) {
      if (remaining <= 0) break;
      const available = Number(lot.current_quantity || 0);
      if (available <= 0) continue;
      const suggested = Math.min(available, remaining);
      suggestions.push({
        lot_id: lot.id,
        lot_number: lot.lot_number,
        available_qty: available,
        suggested_qty: suggested,
        sort_date: rotationRule === 'FEFO'
          ? lot.dlc_date || lot.dluo_date || lot.reception_date || lot.created_at
          : lot.reception_date || lot.created_at,
        rotation_rule: rotationRule,
      });
      remaining -= suggested;
    }

  await appendAuditLogs(buildAuditLogEntries({
    action: 'RPC',
    table: 'stock_lots',
    actor: req.auth?.user || null,
    requestId: req.requestId,
    afterRows: suggestions.map((suggestion) => ({ id: suggestion.lot_id, ...suggestion })),
    metadata: { rpcName: name, productId: p_product_id, requestedQuantity },
    performedAt: new Date().toISOString(),
  }));

  res.json({ data: suggestions });
}));

app.use((error, req, res, next) => {
  if (!error) return next();
  if (res.headersSent) return next(error);
  return sendApiError(res, error, req.requestId);
});

const start = async () => {
  await mongoose.connect(MONGODB_URI, {
    dbName: MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  db = createMongooseDb();
  console.log(`Mongoose connected: ${MONGODB_DB_NAME}`);

  await ensureSeedData();

  app.listen(PORT, API_HOST, () => {
    console.log(`API listening on http://${API_HOST}:${PORT}`);
    console.log('Storage mode: mongoose');
    console.log(`Seed admin: ${DEFAULT_ADMIN.email} / ${DEFAULT_ADMIN.password}`);
  });
};

start().catch((error) => {
  console.error('MongoDB is required for this application.');
  console.error(`Connection target: ${redactMongoUri(MONGODB_URI)}`);
  console.error('Start MongoDB locally or set MONGODB_URI to a reachable MongoDB/Atlas instance.');
  console.error('Failed to start API:', error);
  process.exit(1);
});
