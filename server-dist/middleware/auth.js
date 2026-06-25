import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { unauthorized } from "../core/app-error.js";
const readToken = (req) => {
    const header = String(req.headers?.authorization || "");
    if (!header.startsWith("Bearer ")) {
        return null;
    }
    return header.slice("Bearer ".length);
};
export const decodeAuthToken = (token) => {
    if (!token)
        return null;
    try {
        const payload = jwt.verify(token, env.jwtSecret);
        return {
            token,
            expiresAt: payload?.exp,
            user: {
                id: payload.sub,
                email: payload.email,
                user_metadata: payload.user_metadata || {},
            },
        };
    }
    catch {
        return null;
    }
};
export const optionalAuth = (req, _res, next) => {
    req.auth = decodeAuthToken(readToken(req));
    next();
};
export const requireAuth = (req, _res, next) => {
    req.auth = decodeAuthToken(readToken(req));
    if (!req.auth?.user?.id) {
        return next(unauthorized());
    }
    next();
};
