/**
 * Read-only: which active quality users could not sign a QC release today. Run it
 * before relying on the fail-closed gate, because a user with no PIN cannot release.
 * It ignores MONGODB_URI, reads only role and PIN presence, and prints no hash.
 *
 *   AUDIT_MONGODB_URI=<snapshot uri> AUDIT_DB_NAME=<snapshot db> node scripts/audit-pin-readiness.mjs
 *
 * A remote target also needs --i-know and --confirm-db=<database name>, and Atlas
 * needs the owner's explicit approval first.
 */
import mongoose from "mongoose";

import { assertSafeDbTarget } from "./lib/db-target-guard.mjs";

const QUALITY_ROLES = new Set(["responsable_qualite", "inspecteur_qualite", "resp_management_qualite", "resp_qualite_haccp"]);

const uri = process.env.AUDIT_MONGODB_URI;
const dbName = process.env.AUDIT_DB_NAME;
if (!dbName) throw new Error("AUDIT_DB_NAME is required; this audit has no default target.");
assertSafeDbTarget({ uri, dbName });

await mongoose.connect(uri, { dbName, autoIndex: false, autoCreate: false });
const users = await mongoose.connection.db.collection("auth_users").find(
  { is_active: true },
  { projection: { _id: 0, email: 1, "user_metadata.role": 1, "user_metadata.roles": 1, signaturePinHash: 1, signature_pin_hash: 1 } },
).toArray();
await mongoose.disconnect();

const quality = users.filter((user) => [user.user_metadata?.role, ...(user.user_metadata?.roles ?? [])].some((role) => QUALITY_ROLES.has(role)));
const missing = quality.filter((user) => !user.signaturePinHash && !user.signature_pin_hash);

console.log(JSON.stringify({
  quality_users: quality.length,
  ready: quality.length - missing.length,
  missing_pin: missing.map((user) => user.email),
  verdict: quality.length > 0 && missing.length === 0 ? "READY" : "NOT_READY",
}, null, 2));
