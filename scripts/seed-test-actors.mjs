// Seed one test user per manufacturing actor role.
// Run from repo root: node --env-file=.env <this file>
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const PASSWORD = "Test123!";

const ACTORS = [
  ["operateur_reception",     "Omar Réception",       ["reception"]],
  ["chef_reception",          "Chokri Chef Réception",["reception"]],
  ["inspecteur_qualite",      "Imen Inspectrice QC",  ["qualite"]],
  ["responsable_qualite",     "Rania Resp. Qualité",  ["qualite"]],
  ["operateur_fumigation",    "Fathi Fumigation",     ["production"]],
  ["operateur_triage_ia",     "Tarek Triage",         ["production"]],
  ["operateur_conditionnement","Cyrine Conditionnement",["production"]],
  ["magasinier_wms",          "Moez Magasinier",      ["magasin"]],
  ["responsable_logistique",  "Lotfi Logistique",     ["logistique"]],
  ["responsable_production",  "Pauline Resp. Prod",   ["production"]],
  ["directeur_usine",         "Driss Directeur Usine",["direction"]],
  ["auditeur_externe",        "Aziz Auditeur",        ["qualite"]],
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

for (const [role, fullName, domains] of ACTORS) {
  const email = `${role.replace(/_/g, ".")}@test.local`;
  let user = await AuthUser.findOne({ email }).exec();
  const metadata = { full_name: fullName, name: fullName, role, roles: [role], domains };
  if (!user) {
    user = await AuthUser.create({
      id: randomUUID(), email, passwordHash,
      user_metadata: metadata, is_active: true, created_at: now, updated_at: now,
    });
  } else {
    user.passwordHash = passwordHash;
    user.user_metadata = metadata;
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
  console.log(`OK ${role} → ${email}`);
}

console.log(`\n${ACTORS.length} acteurs prêts, mot de passe: ${PASSWORD}`);
await mongoose.disconnect();
