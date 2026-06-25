import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { unauthorized } from "../core/app-error.js";

const readToken = (req: any) => {
  const header = String(req.headers?.authorization || "");
  if (!header.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length);
};

export const decodeAuthToken = (token: string | null) => {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, env.jwtSecret) as any;
    return {
      token,
      expiresAt: payload?.exp,
      user: {
        id: payload.sub,
        email: payload.email,
        user_metadata: payload.user_metadata || {},
      },
    };
  } catch {
    return null;
  }
};

export const optionalAuth = (req: any, _res: any, next: any) => {
  req.auth = decodeAuthToken(readToken(req));
  next();
};

export const requireAuth = (req: any, _res: any, next: any) => {
  req.auth = decodeAuthToken(readToken(req));
  if (!req.auth?.user?.id) {
    return next(unauthorized());
  }
  next();
};
