// Seed one test user per manufacturing actor role — with department membership + org roles.
// Run from repo root: npm run seed:actors
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const PASSWORD = "Test123!";

/**
 * [mesRole, fullName, domains, departments, primaryDepartment, orgRoles]
 * orgRoles drive purchase-request approvals; MES roles keep space access.
 */
const ACTORS = [
  ["operateur_reception", "Omar Réception", ["reception"], ["reception"], "reception", ["employee"]],
  ["chef_reception", "Chokri Chef Réception", ["reception"], ["reception"], "reception", ["employee", "department_manager"]],
  ["inspecteur_qualite", "Imen Inspectrice QC", ["qualite"], ["quality"], "quality", ["employee"]],
  ["responsable_qualite", "Rania Resp. Qualité", ["qualite"], ["quality"], "quality", ["employee", "department_manager"]],
  ["operateur_fumigation", "Fathi Fumigation", ["production"], ["production"], "production", ["employee"]],
  ["operateur_triage_ia", "Tarek Triage", ["production"], ["production"], "production", ["employee"]],
  ["operateur_conditionnement", "Cyrine Conditionnement", ["production"], ["production"], "production", ["employee"]],
  ["magasinier_wms", "Moez Magasinier", ["magasin"], ["stock"], "stock", ["employee"]],
  ["responsable_stock", "Sami Resp. Stock", ["magasin"], ["stock"], "stock", ["employee", "department_manager"]],
  ["responsable_logistique", "Lotfi Logistique", ["logistique"], ["logistics"], "logistics", ["employee", "department_manager"]],
  ["responsable_production", "Pauline Resp. Prod", ["production"], ["production"], "production", ["employee", "department_manager"]],
  ["responsable_maintenance", "Nabil Resp. Maintenance", ["maintenance"], ["maintenance"], "maintenance", ["employee", "department_manager"]],
  ["technicien_maintenance", "Talel Technicien Maint.", ["maintenance"], ["maintenance"], "maintenance", ["employee"]],
  ["responsable_achats", "Amira Acheteuse", ["achat"], ["purchasing"], "purchasing", ["employee", "purchasing_officer"]],
  ["directeur_achat", "Karim Dir. Achats", ["achat"], ["purchasing"], "purchasing", ["employee", "purchasing_manager"]],
  ["directeur_usine", "Driss Directeur Usine", ["direction"], ["direction"], "direction", ["employee", "finance_director"]],
  ["auditeur_externe", "Aziz Auditeur", ["qualite"], ["quality"], "quality", ["employee"]],
];

const authUserSchema = new mongoose.Schema(
  {
    id: String, email: String, passwordHash: String,
    user_metadata: Object, is_active: Boolean, created_at: String, updated_at: String,
  },
  { collection: "auth_users", versionKey: false, strict: false },
);
const profileSchema = new mongoose.Schema(
  { id: String, user_id: String, email: String, full_name: String, created_at: String, updated_at: String },
  { collection: "profiles", versionKey: false, strict: false },
);

const AuthUser = mongoose.model("auth_users", authUserSchema, "auth_users");
const Profile = mongoose.model("profiles", profileSchema, "profiles");

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/date_harvest_hub";
const mongoDbName = process.env.MONGODB_DB_NAME || "date_harvest_hub";
await mongoose.connect(mongoUri, { dbName: mongoDbName });

const now = new Date().toISOString();
const passwordHash = await bcrypt.hash(PASSWORD, 10);

for (const [role, fullName, domains, departments, primaryDepartment, orgRoles] of ACTORS) {
  const email = `${role.replace(/_/g, ".")}@test.local`;
  let user = await AuthUser.findOne({ email }).exec();
  const metadata = {
    full_name: fullName,
    name: fullName,
    role,
    roles: [role],
    domains,
    departments,
    primary_department: primaryDepartment,
    org_roles: orgRoles,
  };
  if (!user) {
    user = await AuthUser.create({
      id: randomUUID(), email, passwordHash,
      user_metadata: metadata, is_active: true, created_at: now, updated_at: now,
    });
  } else {
    user.passwordHash = passwordHash;
    user.user_metadata = { ...(user.user_metadata || {}), ...metadata };
    user.is_active = true;
    user.updated_at = now;
    await user.save();
  }
  await Profile.updateOne(
    { user_id: user.id },
    {
      $set: { email, full_name: fullName, updated_at: now },
      $setOnInsert: { id: randomUUID(), user_id: user.id, created_at: now },
    },
    { upsert: true },
  ).exec();
  console.log(`OK ${role} → ${email} [${departments.join(",")}] / ${orgRoles.join("+")}`);
}

console.log(`\n${ACTORS.length} acteurs prêts, mot de passe: ${PASSWORD}`);
await mongoose.disconnect();
