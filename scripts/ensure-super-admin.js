import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const email = "superadmin@royalpalm.local";
const password = "Admin123!";
const now = new Date().toISOString();

const roles = [
  "admin",
  "administrateur_systeme",
  "directeur_general",
  "directeur_usine",
  "responsable_production",
  "responsable_qualite",
  "inspecteur_qualite",
  "chef_reception",
  "operateur_reception",
  "operateur_nettoyage",
  "operateur_fumigation",
  "operateur_triage_ia",
  "operateur_conditionnement",
  "operateur_emballage",
  "magasinier_wms",
  "responsable_logistique",
  "responsable_achats",
  "responsable_maintenance",
  "technicien_maintenance",
  "fournisseur_externe",
  "client_externe",
  "auditeur_externe",
  "technico_commercial",
  "directeur_achat",
  "resp_management_qualite",
  "resp_qualite_haccp",
  "responsable_reception",
  "responsable_stock",
  "partenaire_client_export",
];

const authUserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    user_metadata: { type: Object, default: {} },
    is_active: { type: Boolean, default: true },
    created_at: { type: String, required: true },
    updated_at: { type: String, required: true },
  },
  { collection: "auth_users", versionKey: false },
);

const profileSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    email: { type: String, required: true },
    full_name: { type: String, required: true },
    avatar_url: { type: String, default: null },
    phone: { type: String, default: null },
    created_at: { type: String, required: true },
    updated_at: { type: String, required: true },
  },
  { collection: "profiles", versionKey: false, strict: false },
);

const AuthUser = mongoose.models.auth_users || mongoose.model("auth_users", authUserSchema, "auth_users");
const Profile = mongoose.models.profiles || mongoose.model("profiles", profileSchema, "profiles");

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/date_harvest_hub";
const mongoDbName = process.env.MONGODB_DB_NAME || "date_harvest_hub";

await mongoose.connect(mongoUri, { dbName: mongoDbName });

let user = await AuthUser.findOne({ email }).exec();
const passwordHash = await bcrypt.hash(password, 10);

if (!user) {
  user = await AuthUser.create({
    id: randomUUID(),
    email,
    passwordHash,
    user_metadata: {
      full_name: "Royal Palm Super Admin",
      role: "administrateur_systeme",
      roles,
      domains: ["admin", "direction", "achat", "reception", "qualite", "production", "magasin", "export", "maintenance"],
    },
    is_active: true,
    created_at: now,
    updated_at: now,
  });
} else {
  user.passwordHash = passwordHash;
  user.user_metadata = {
    ...(user.user_metadata || {}),
    full_name: "Royal Palm Super Admin",
    role: "administrateur_systeme",
    roles,
    domains: ["admin", "direction", "achat", "reception", "qualite", "production", "magasin", "export", "maintenance"],
  };
  user.is_active = true;
  user.updated_at = now;
  await user.save();
}

await Profile.updateOne(
  { user_id: user.id },
  {
    $set: {
      email,
      full_name: "Royal Palm Super Admin",
      avatar_url: null,
      phone: null,
      updated_at: now,
    },
    $setOnInsert: {
      id: randomUUID(),
      user_id: user.id,
      created_at: now,
    },
  },
  { upsert: true },
).exec();

console.log(`Super admin ready: ${email}`);
console.log(`Roles assigned: ${roles.length}`);

await mongoose.disconnect();
