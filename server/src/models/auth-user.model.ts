import mongoose from "mongoose";

const authUserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    // Explicit membership: company + factory/site. Legacy accounts remain unassigned.
    tenant_id: { type: String, default: null, index: true },
    factory_id: { type: String, default: null },
    /** bcrypt hash of 4–6 digit numeric signature PIN (never returned to clients). */
    signaturePinHash: { type: String, default: null },
    user_metadata: { type: Object, default: {} },
    is_active: { type: Boolean, default: true },
    /** Bumped on logout and password change; a token with an older value stops working. */
    token_version: { type: Number, default: 0 },
    must_change_password: { type: Boolean, default: false },
    created_at: { type: String, required: true },
    updated_at: { type: String, required: true },
  },
  {
    collection: "auth_users",
    versionKey: false,
  },
);

authUserSchema.index({ tenant_id: 1, factory_id: 1, is_active: 1 });

export const AuthUserModel: any =
  (mongoose.models as any).auth_users || mongoose.model("auth_users", authUserSchema, "auth_users");
