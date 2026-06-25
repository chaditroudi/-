import mongoose from "mongoose";

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
  {
    collection: "auth_users",
    versionKey: false,
  },
);

export const AuthUserModel: any =
  (mongoose.models as any).auth_users || mongoose.model("auth_users", authUserSchema, "auth_users");
