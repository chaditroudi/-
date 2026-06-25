import { randomUUID } from "node:crypto";

import { badRequest } from "../../core/app-error.js";

const SUPPLIER_STATUSES = new Set(["active", "inactive", "pending_approval", "blocked", "archived"]);
const IDENTIFICATION_STATUSES = new Set(["unverified", "verified", "expired", "rejected"]);
const QUALIFICATION_STATUSES = new Set(["prospect", "qualified", "approved", "suspended", "blacklisted"]);
const COMPLIANCE_STATUSES = new Set(["compliant", "warning", "non_compliant"]);
const RISK_LEVELS = new Set(["low", "medium", "high"]);
const CONTRACT_TYPES = new Set(["annuel", "saisonnier", "ponctuel", "achat_sur_pied"]);
const CONTRACT_STATUSES = new Set(["draft", "active", "expired", "terminated", "under_review"]);
const FARMING_MODES = new Set(["traditionnel", "traditionnel_oasien", "moderne_intensif", "biologique_certifie"]);
const IRRIGATION_SOURCES = new Set(["puits_artesien", "source_naturelle", "forage", "reseau_gid"]);

const nowIso = () => new Date().toISOString();
type SupplierRecord = Record<string, unknown> & {
  contract_records?: SupplierRecord[];
  performance_history?: SupplierRecord[];
};

const nullableString = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const boundedNumber = (value: unknown, min: number, max: number, fallback = 0) => {
  const numeric = Number(value ?? fallback);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

const nullableNumber = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  if (value === null || value === undefined || value === "") return null;
  return boundedNumber(value, min, max, min);
};

const normalizeEnum = <T extends string>(value: unknown, allowed: Set<string>, fallback: T): T => {
  const normalized = String(value ?? "").trim();
  return (allowed.has(normalized) ? normalized : fallback) as T;
};

const normalizeDate = (value: unknown) => {
  const normalized = nullableString(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw badRequest("INVALID_SUPPLIER_DATE", "Supplier contains an invalid date.");
  }
  return normalized.slice(0, 10);
};

const requireDate = (value: unknown, code: string, message: string) => {
  const normalized = normalizeDate(value);
  if (!normalized) {
    throw badRequest(code, message);
  }
  return normalized;
};

const assertDateOrder = (start?: string | null, end?: string | null, code = "INVALID_SUPPLIER_DATE_RANGE") => {
  if (!start || !end) return;
  if (new Date(start).getTime() >= new Date(end).getTime()) {
    throw badRequest(code, "Contract end date must be after start date.");
  }
};

const subtractDays = (dateInput: string, days: number) => {
  const date = new Date(`${dateInput}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const normalizeStringArray = (value: unknown, fallback: string[] = []) => {
  if (!Array.isArray(value)) return fallback;
  return value.map((entry) => String(entry || "").trim()).filter(Boolean);
};

const normalizeContractRecords = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  return value.map((entry) => {
    const record = (entry || {}) as Record<string, unknown>;
    const startDate = requireDate(record.start_date, "CONTRACT_START_DATE_REQUIRED", "Contract start date is required.");
    const endDate = requireDate(record.end_date, "CONTRACT_END_DATE_REQUIRED", "Contract end date is required.");
    assertDateOrder(startDate, endDate);

    return {
      id: nullableString(record.id) || randomUUID(),
      reference: nullableString(record.reference),
      type: normalizeEnum(record.type, CONTRACT_TYPES, "saisonnier"),
      status: normalizeEnum(record.status, CONTRACT_STATUSES, "draft"),
      start_date: startDate,
      end_date: endDate,
      expiry_alert_at: subtractDays(endDate, 30),
      document_url: nullableString(record.document_url),
      compliance_status: normalizeEnum(record.compliance_status, COMPLIANCE_STATUSES, "warning"),
      reviewed_at: normalizeDate(record.reviewed_at),
      notes: nullableString(record.notes),
    };
  });
};

const contractLifecycleStatus = (contract: SupplierRecord, today = new Date()) => {
  if (contract.status === "terminated") return "terminated";
  if (!contract.end_date) return contract.status;
  const end = new Date(String(contract.end_date));
  if (Number.isNaN(end.getTime())) return contract.status;
  if (end.getTime() < today.setHours(0, 0, 0, 0)) return "expired";
  return contract.status === "draft" ? "draft" : "active";
};

const computeComplianceStatus = (doc: SupplierRecord) => {
  if (doc.qualification_status === "blacklisted" || doc.supplier_status === "blocked") {
    return "non_compliant";
  }

  const activeContracts = (doc.contract_records || []).filter((contract) => contractLifecycleStatus(contract) === "active");
  const hasCurrentContract = activeContracts.length > 0 || Boolean(doc.contract_start_date && doc.contract_end_date);
  const hasVerifiedIdentity = doc.identification_status === "verified";
  const score = Number(doc.quality_score ?? doc.rating ?? 0);
  const rejectionRate = Number(doc.rejection_rate ?? 0);

  if (!hasVerifiedIdentity || !hasCurrentContract || score < 50 || rejectionRate > 25) {
    return "warning";
  }

  return "compliant";
};

export const normalizeSupplierDocument = (input: Record<string, unknown>, existing?: Record<string, unknown>) => {
  const doc = {
    ...(existing || {}),
    ...(input || {}),
  } as SupplierRecord;

  doc.code = nullableString(doc.code);
  doc.name = nullableString(doc.name);
  if (!doc.name) {
    throw badRequest("SUPPLIER_NAME_REQUIRED", "Supplier name is required.");
  }

  doc.name_ar = nullableString(doc.name_ar);
  doc.contact_name_ar = nullableString(doc.contact_name_ar);
  doc.address_ar = nullableString(doc.address_ar);
  doc.contact_name = nullableString(doc.contact_name);
  doc.email = nullableString(doc.email);
  doc.phone = nullableString(doc.phone);
  doc.secondary_phone = nullableString(doc.secondary_phone);
  doc.address = nullableString(doc.address);
  doc.postal_address = nullableString(doc.postal_address);
  doc.city = nullableString(doc.city);
  doc.country = nullableString(doc.country) || "Tunisie";
  doc.fiscal_identifier = nullableString(doc.fiscal_identifier);
  doc.tax_registration_number = nullableString(doc.tax_registration_number);
  doc.id_document_type = nullableString(doc.id_document_type);
  doc.id_document_number = nullableString(doc.id_document_number);
  doc.cin_document_url = nullableString(doc.cin_document_url);
  doc.identification_notes = nullableString(doc.identification_notes);
  doc.region = nullableString(doc.region) || "Tozeur";
  doc.locality = nullableString(doc.locality);
  doc.oasis_name = nullableString(doc.oasis_name);
  doc.gps_coordinates = nullableString(doc.gps_coordinates);
  doc.actor_type = normalizeEnum(doc.actor_type, new Set(["producteur_direct", "collecteur", "cooperative", "societe"]), "collecteur");
  doc.produced_varieties = normalizeStringArray(doc.produced_varieties, ["Deglet Nour"]);
  doc.exploited_area_ha = nullableNumber(doc.exploited_area_ha);
  doc.palm_tree_count = nullableNumber(doc.palm_tree_count);
  doc.annual_production_tons = nullableNumber(doc.annual_production_tons);
  // §1.1.2 — Mode de culture & irrigation (spec fields 19-20)
  doc.farming_mode = normalizeEnum(doc.farming_mode, FARMING_MODES, "traditionnel");
  doc.irrigation_source = normalizeEnum(doc.irrigation_source, IRRIGATION_SOURCES, "puits_artesien");
  // §1.1.3 — agreed price per kg per variety + bank details
  doc.agreed_price_tnd_per_kg = nullableNumber(doc.agreed_price_tnd_per_kg);
  doc.bank_rib = nullableString(doc.bank_rib);
  doc.nickname = nullableString(doc.nickname);
  doc.rating = boundedNumber(doc.rating, 0, 100);
  doc.quality_score = boundedNumber(doc.quality_score, 0, 100);
  doc.delivery_reliability_score = boundedNumber(doc.delivery_reliability_score, 0, 100);
  doc.traceability_score = boundedNumber(doc.traceability_score, 0, 100);
  doc.rejection_rate = boundedNumber(doc.rejection_rate, 0, 100);
  doc.delivered_lots_count = boundedNumber(doc.delivered_lots_count, 0, Number.MAX_SAFE_INTEGER);
  doc.total_delivered_tons = boundedNumber(doc.total_delivered_tons, 0, Number.MAX_SAFE_INTEGER);
  doc.total_paid_amount_tnd = boundedNumber(doc.total_paid_amount_tnd, 0, Number.MAX_SAFE_INTEGER);
  doc.agreed_price_tnd_per_kg = nullableNumber(doc.agreed_price_tnd_per_kg);
  doc.last_delivery_date = normalizeDate(doc.last_delivery_date);
  doc.contract_type = normalizeEnum(doc.contract_type, CONTRACT_TYPES, "saisonnier");
  doc.contract_start_date = requireDate(
    doc.contract_start_date,
    "CONTRACT_START_DATE_REQUIRED",
    "Contract start date is required.",
  );
  doc.contract_end_date = requireDate(
    doc.contract_end_date,
    "CONTRACT_END_DATE_REQUIRED",
    "Contract end date is required.",
  );
  assertDateOrder(doc.contract_start_date as string | null, doc.contract_end_date as string | null);
  doc.contract_expiry_alert_at = subtractDays(String(doc.contract_end_date), 30);
  const createdAt = typeof doc.created_at === "string" ? doc.created_at : null;
  doc.onboarding_date = normalizeDate(doc.onboarding_date) || createdAt?.slice(0, 10) || nowIso().slice(0, 10);
  doc.last_evaluation_date = normalizeDate(doc.last_evaluation_date);
  doc.next_evaluation_date = normalizeDate(doc.next_evaluation_date);
  doc.last_audit_date = normalizeDate(doc.last_audit_date);
  doc.next_audit_date = normalizeDate(doc.next_audit_date);
  doc.approval_date = normalizeDate(doc.approval_date);
  doc.approved_by = nullableString(doc.approved_by);
  doc.qualification_notes = nullableString(doc.qualification_notes);
  doc.identification_status = normalizeEnum(doc.identification_status, IDENTIFICATION_STATUSES, "unverified");
  doc.qualification_status = normalizeEnum(doc.qualification_status, QUALIFICATION_STATUSES, "prospect");
  doc.supplier_status = normalizeEnum(doc.supplier_status, SUPPLIER_STATUSES, "pending_approval");
  doc.risk_level = normalizeEnum(doc.risk_level, RISK_LEVELS, "medium");
  doc.audit_score = boundedNumber(doc.audit_score, 0, 100);
  const incomingRecords = Array.isArray(doc.contract_records) && doc.contract_records.length > 0
    ? doc.contract_records
    : [
        {
          reference: null,
          type: doc.contract_type,
          status: "draft",
          start_date: doc.contract_start_date,
          end_date: doc.contract_end_date,
          document_url: null,
          compliance_status: doc.compliance_status || "warning",
          notes: null,
        },
      ];
  doc.contract_records = normalizeContractRecords(incomingRecords);
  doc.contract_documents = normalizeStringArray(doc.contract_documents);
  doc.is_active = doc.supplier_status === "active" && !["suspended", "blacklisted"].includes(String(doc.qualification_status));

  if (doc.qualification_status === "approved" && doc.identification_status !== "verified") {
    throw badRequest("SUPPLIER_IDENTIFICATION_REQUIRED", "A supplier must be identity-verified before approval.");
  }

  if (doc.qualification_status === "blacklisted") {
    doc.supplier_status = "blocked";
    doc.is_active = false;
  }

  doc.compliance_status = computeComplianceStatus(doc);
  return doc;
};

export const appendSupplierPerformanceSnapshot = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  actorId?: string | null,
) => {
  const tracked = [
    "quality_score",
    "delivery_reliability_score",
    "traceability_score",
    "rejection_rate",
    "delivered_lots_count",
    "total_delivered_tons",
    "qualification_status",
    "supplier_status",
    "compliance_status",
  ];

  const changed = tracked.some((field) => String(before[field] ?? "") !== String(after[field] ?? ""));
  if (!changed) return Array.isArray(after.performance_history) ? after.performance_history : [];

  const history = Array.isArray(before.performance_history) ? before.performance_history.slice(-23) : [];
  return [
    ...history,
    {
      at: nowIso(),
      by: actorId || "system",
      quality_score: after.quality_score ?? null,
      delivery_reliability_score: after.delivery_reliability_score ?? null,
      traceability_score: after.traceability_score ?? null,
      rejection_rate: after.rejection_rate ?? null,
      delivered_lots_count: after.delivered_lots_count ?? null,
      total_delivered_tons: after.total_delivered_tons ?? null,
      qualification_status: after.qualification_status ?? null,
      supplier_status: after.supplier_status ?? null,
      compliance_status: after.compliance_status ?? null,
    },
  ];
};
