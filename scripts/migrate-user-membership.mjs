/**
 * Backfill department membership + workflow org roles on auth_users.
 *
 * Idempotent by default: only fills missing departments / primary_department / org_roles.
 * Use --force to overwrite inferred fields from MES roles.
 *
 * Run: npm run migrate:membership
 *      npm run migrate:membership -- --force
 *      npm run migrate:membership -- --dry-run
 */
import mongoose from "mongoose";

const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");

/** Mirrors server/src/modules/org/departments.ts */
const DEPARTMENT_ALIASES = {
  stock: "stock",
  magasin: "stock",
  stockage: "stock",
  warehouse: "stock",
  production: "production",
  qualite: "quality",
  qualité: "quality",
  quality: "quality",
  maintenance: "maintenance",
  hr: "hr",
  rh: "hr",
  purchasing: "purchasing",
  achats: "purchasing",
  logistics: "logistics",
  logistique: "logistics",
  reception: "reception",
  réception: "reception",
  finance: "finance",
  daf: "finance",
  direction: "direction",
};

const ROLE_DEFAULT_DEPARTMENT = {
  responsable_stock: "stock",
  magasinier: "stock",
  magasinier_wms: "stock",
  chef_production: "production",
  responsable_production: "production",
  operateur: "production",
  operateur_production: "production",
  operateur_nettoyage: "production",
  operateur_fumigation: "production",
  operateur_triage_ia: "production",
  operateur_conditionnement: "production",
  operateur_emballage: "production",
  responsable_qualite: "quality",
  controleur_qualite: "quality",
  inspecteur_qualite: "quality",
  resp_management_qualite: "quality",
  resp_qualite_haccp: "quality",
  auditeur_externe: "quality",
  responsable_maintenance: "maintenance",
  technicien_maintenance: "maintenance",
  responsable_rh: "hr",
  responsable_achats: "purchasing",
  directeur_achat: "purchasing",
  acheteur: "purchasing",
  responsable_logistique: "logistics",
  technico_commercial: "logistics",
  responsable_reception: "reception",
  chef_reception: "reception",
  operateur_reception: "reception",
  daf: "finance",
  directeur_financier: "finance",
  directeur_general: "direction",
  directeur_usine: "direction",
  direction: "direction",
  administrateur_systeme: "direction",
  admin: "direction",
};

/** Mirrors server/src/modules/org/membership.ts MES_ORG_ROLE_HINTS */
const MES_ORG_ROLE_HINTS = {
  responsable_stock: ["department_manager"],
  chef_production: ["department_manager"],
  responsable_production: ["department_manager"],
  responsable_qualite: ["department_manager"],
  responsable_maintenance: ["department_manager"],
  responsable_rh: ["department_manager"],
  responsable_logistique: ["department_manager"],
  responsable_reception: ["department_manager"],
  chef_reception: ["department_manager"],
  responsable_achats: ["purchasing_officer"],
  acheteur: ["purchasing_officer"],
  directeur_achat: ["purchasing_manager"],
  daf: ["finance_director"],
  directeur_financier: ["finance_director"],
  directeur_general: ["finance_director"],
  direction: ["finance_director"],
  administrateur_systeme: ["department_manager", "purchasing_manager", "finance_director"],
  admin: ["department_manager", "purchasing_manager", "finance_director"],
};

const VALID_ORG_ROLES = new Set([
  "employee",
  "department_manager",
  "purchasing_officer",
  "purchasing_manager",
  "finance_director",
]);

const authUserSchema = new mongoose.Schema(
  {
    id: String,
    email: String,
    passwordHash: String,
    user_metadata: Object,
    is_active: Boolean,
    created_at: String,
    updated_at: String,
  },
  { collection: "auth_users", versionKey: false, strict: false },
);

const AuthUser = mongoose.models.auth_users || mongoose.model("auth_users", authUserSchema, "auth_users");

const unique = (values) => Array.from(new Set(values.filter(Boolean)));

const toStringArray = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

const normalizeDepartment = (value) => {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const compact = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return DEPARTMENT_ALIASES[compact] || DEPARTMENT_ALIASES[raw] || null;
};

const mesRolesFromMetadata = (meta) =>
  unique([
    ...toStringArray(meta.roles).map((r) => r.toLowerCase()),
    ...toStringArray(meta.role).map((r) => r.toLowerCase()),
    ...toStringArray(meta.domains).map((r) => r.toLowerCase()),
  ]);

const inferDepartments = (mesRoles, domains) => {
  const fromRoles = mesRoles
    .map((role) => ROLE_DEFAULT_DEPARTMENT[role] || normalizeDepartment(role))
    .filter(Boolean);
  const fromDomains = toStringArray(domains)
    .map((d) => normalizeDepartment(d))
    .filter(Boolean);
  return unique([...fromRoles, ...fromDomains]);
};

const inferOrgRoles = (mesRoles) => {
  const hinted = unique(mesRoles.flatMap((role) => MES_ORG_ROLE_HINTS[role] || []));
  return unique(["employee", ...hinted]).filter((role) => VALID_ORG_ROLES.has(role));
};

const buildMembershipPatch = (meta) => {
  const mesRoles = mesRolesFromMetadata(meta);
  const existingDepartments = toStringArray(meta.departments)
    .map((d) => normalizeDepartment(d))
    .filter(Boolean);
  const inferredDepartments = inferDepartments(mesRoles, meta.domains);

  const departments =
    FORCE || existingDepartments.length === 0
      ? inferredDepartments.length > 0
        ? inferredDepartments
        : existingDepartments
      : existingDepartments;

  const existingPrimary = normalizeDepartment(meta.primary_department);
  const primary_department =
    FORCE || !existingPrimary
      ? departments.includes(existingPrimary)
        ? existingPrimary
        : departments[0] || null
      : departments.includes(existingPrimary)
        ? existingPrimary
        : departments[0] || existingPrimary;

  const existingOrgRoles = toStringArray(meta.org_roles)
    .map((r) => r.toLowerCase())
    .filter((r) => VALID_ORG_ROLES.has(r));
  const inferredOrgRoles = inferOrgRoles(mesRoles);
  const org_roles =
    FORCE || existingOrgRoles.length === 0
      ? inferredOrgRoles
      : existingOrgRoles;

  return { departments, primary_department, org_roles };
};

const sameArray = (a, b) => {
  const left = [...(a || [])].sort().join("|");
  const right = [...(b || [])].sort().join("|");
  return left === right;
};

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/date_harvest_hub";
const mongoDbName = process.env.MONGODB_DB_NAME || "date_harvest_hub";

await mongoose.connect(mongoUri, { dbName: mongoDbName });

const users = await AuthUser.find({}).lean().exec();
const now = new Date().toISOString();

let updated = 0;
let skipped = 0;
let unchanged = 0;

for (const user of users) {
  const meta = user.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
  const patch = buildMembershipPatch(meta);

  const nextMeta = {
    ...meta,
    departments: patch.departments,
    primary_department: patch.primary_department,
    org_roles: patch.org_roles,
  };

  const noChange =
    sameArray(meta.departments, nextMeta.departments) &&
    (normalizeDepartment(meta.primary_department) || null) === (nextMeta.primary_department || null) &&
    sameArray(meta.org_roles, nextMeta.org_roles);

  if (noChange) {
    unchanged += 1;
    continue;
  }

  if (!patch.departments.length && !patch.org_roles.length) {
    skipped += 1;
    console.log(`SKIP ${user.email || user.id} — no MES role/domain to infer from`);
    continue;
  }

  console.log(
    `${DRY_RUN ? "DRY " : ""}UPDATE ${user.email || user.id}` +
      ` → depts=[${patch.departments.join(",")}]` +
      ` primary=${patch.primary_department || "—"}` +
      ` org_roles=[${patch.org_roles.join(",")}]`,
  );

  if (!DRY_RUN) {
    await AuthUser.updateOne(
      { _id: user._id },
      {
        $set: {
          user_metadata: nextMeta,
          updated_at: now,
        },
      },
    ).exec();
  }
  updated += 1;
}

console.log(
  `\nMembership migration ${DRY_RUN ? "(dry-run) " : ""}done.` +
    ` updated=${updated} unchanged=${unchanged} skipped=${skipped} total=${users.length}` +
    ` force=${FORCE}`,
);

await mongoose.disconnect();
