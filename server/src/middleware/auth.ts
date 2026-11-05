import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { AuthUserModel } from "../models/auth-user.model.js";
import { factoryFromAccount, sameFactory } from "../db/factory-context.js";

type SessionUser = {
  id: string;
  email: string;
  is_active?: boolean;
  token_version?: number;
  must_change_password?: boolean;
  user_metadata?: Record<string, unknown>;
  tenant_id?: string;
  factory_id?: string;
};
// Retained API for callers; authorization reads are deliberately never cached.
export const invalidateAuthCache = (_userId: string) => {};
export const clearAuthCache = () => {};

const readSessionUser = async (userId: string) => {
  const user: SessionUser | null = await AuthUserModel.findOne({ id: userId }).lean().exec();
  return user;
};

/** Identity comes from the token; roles and account state come from the database. */
export const resolveAuthToken = async (token: string | null) => {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] }) as any;
    const user = await readSessionUser(String(payload.sub));
    if (!user?.is_active) return null;
    if (Number(payload.tv ?? 0) !== Number(user.token_version ?? 0)) return null;
    const factory = factoryFromAccount(user);
    if (!factory || !sameFactory(factory, factoryFromAccount(payload))) return null;

    return {
      token,
      expiresAt: payload.exp,
      mustChangePassword: Boolean(user.must_change_password),
      factory,
      user: {
        id: user.id,
        email: user.email,
        ...factory,
        user_metadata: user.user_metadata || {},
      },
    };
  } catch {
    return null;
  }
};
