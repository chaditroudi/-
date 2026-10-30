import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { AuthUserModel } from "../models/auth-user.model.js";

/** How long a deactivation or role change can lag on another process. */
const AUTH_CACHE_TTL_MS = 60_000;

type SessionUser = {
  id: string;
  email: string;
  is_active?: boolean;
  token_version?: number;
  must_change_password?: boolean;
  user_metadata?: Record<string, unknown>;
};

const sessionCache = new Map<string, { readAt: number; user: SessionUser | null }>();

export const invalidateAuthCache = (userId: string) => {
  sessionCache.delete(userId);
};

export const clearAuthCache = () => {
  sessionCache.clear();
};

const readSessionUser = async (userId: string) => {
  const cached = sessionCache.get(userId);
  if (cached && Date.now() - cached.readAt < AUTH_CACHE_TTL_MS) return cached.user;

  const user: SessionUser | null = await AuthUserModel.findOne({ id: userId }).lean().exec();
  sessionCache.set(userId, { readAt: Date.now(), user });
  return user;
};

/** Identity comes from the token; roles and account state come from the database. */
export const resolveAuthToken = async (token: string | null) => {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, env.jwtSecret) as any;
    const user = await readSessionUser(String(payload.sub));
    if (!user?.is_active) return null;
    if (Number(payload.tv ?? 0) !== Number(user.token_version ?? 0)) return null;

    return {
      token,
      expiresAt: payload.exp,
      mustChangePassword: Boolean(user.must_change_password),
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata || {},
      },
    };
  } catch {
    return null;
  }
};
