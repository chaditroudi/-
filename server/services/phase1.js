import { conflictError, validationError } from './apiErrors.js';

const REGION_MAP = {
  tozeur: 'TOZ',
  kebili: 'KEB',
  gabes: 'GAB',
  gafsa: 'GAF',
};

export const normalizeRegionCode = (region) => {
  const key = String(region || '').trim().toLowerCase();
  return REGION_MAP[key] || 'OTH';
};

const pad = (value, size) => String(value).padStart(size, '0');

const formatDateKey = (value = new Date().toISOString()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    return `${fallback.getFullYear()}${pad(fallback.getMonth() + 1, 2)}${pad(fallback.getDate(), 2)}`;
  }
  return `${date.getFullYear()}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}`;
};

export const buildRoyalPalmLotId = ({ region, supplierCode, dateKey, sequence }) => {
  const safeSupplierCode = String(supplierCode || 'UNK')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4) || 'UNK';

  return `RP-${normalizeRegionCode(region)}-${safeSupplierCode}-${dateKey}-${pad(sequence, 3)}`;
};

export const assertUniqueSupplierIdentifier = async (db, { fiscal_identifier, supplierId }) => {
  const normalized = String(fiscal_identifier || '').trim();
  if (!normalized) return;

  const existing = await db.collection('suppliers').find({ fiscal_identifier: normalized }).toArray();
  const duplicate = existing.find((supplier) => supplier.id !== supplierId);
  if (duplicate) {
    throw conflictError('SUPPLIER_IDENTIFIER_EXISTS', 'A supplier with the same fiscal identifier already exists.');
  }
};

export const assertBioCertificationForReception = (supplier, bioDeclared) => {
  if (!bioDeclared) return;

  const certifications = Array.isArray(supplier?.certifications) ? supplier.certifications : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasBio = certifications.some((entry) => {
    if (!['Bio UE', 'Bio Tunisie'].includes(entry?.name)) return false;
    if (!entry?.validUntil) return true;
    const expiry = new Date(entry.validUntil);
    return !Number.isNaN(expiry.getTime()) && expiry.getTime() >= today.getTime();
  });
  if (!hasBio) {
    throw validationError('BIO_CERTIFICATION_REQUIRED', 'Bio reception requires a supplier with valid bio certification.');
  }
};

export const deriveReceptionPhase1State = (payload) => {
  const alerts = Array.isArray(payload.phase1_alerts) ? [...payload.phase1_alerts] : [];
  const weightGap = Number(payload.weight_gap_percent ?? 0);
  const arrivalTemperature = Number(payload.arrival_temperature_c ?? 0);

  if (weightGap > 10 && !alerts.includes('Ecart poids critique')) {
    alerts.push('Ecart poids critique');
  } else if (weightGap > 3 && !alerts.includes('Ecart poids a verifier')) {
    alerts.push('Ecart poids a verifier');
  }

  if (arrivalTemperature > 35 && !alerts.includes("Temperature d'arrivee elevee")) {
    alerts.push("Temperature d'arrivee elevee");
  }

  const blocked = arrivalTemperature > 35;
  return {
    status: blocked ? 'BLOQUE' : payload.status || 'EN_ATTENTE_QC',
    alerts,
  };
};

export const shouldRecalculateSupplier = (beforeRow, afterRow) => {
  if (!afterRow?.supplier_id) return false;
  if (!beforeRow) return true;

  return (
    beforeRow.qc_decision !== afterRow.qc_decision ||
    beforeRow.qc_score !== afterRow.qc_score ||
    beforeRow.qc_grade !== afterRow.qc_grade ||
    beforeRow.weight_gap_percent !== afterRow.weight_gap_percent
  );
};
