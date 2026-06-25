import { extractBearerToken, verifyAccessToken } from './auth.js';
import { forbiddenError, unauthorizedError } from './apiErrors.js';
import { canAccessRpc, canAccessTable, isAdminRole, normalizeRoles } from './rbac.js';

const normalizeResourceName = (value) => String(value || '').trim();

const loadRoles = async (db, userId) => {
  const rows = await db.collection('user_roles').find({ user_id: userId }).toArray();
  return rows.map((row) => row.role).filter(Boolean);
};

export const createOptionalAuthMiddleware = ({ db, jwtSecret }) => async (req, _res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      req.auth = null;
      return next();
    }

    const claims = verifyAccessToken(token, jwtSecret);
    const user = await db.collection('auth_users').findOne({ id: claims.sub });

    if (!user) {
      req.auth = null;
      return next();
    }

    const rawRoles = await loadRoles(db, user.id);
    req.auth = {
      token,
      claims,
      user,
      rawRoles,
      roles: normalizeRoles(rawRoles),
      isAdmin: isAdminRole(rawRoles),
    };

    return next();
  } catch (error) {
    req.auth = null;
    return next();
  }
};

export const requireAuth = (req, _res, next) => {
  if (!req.auth?.user) {
    return next(unauthorizedError());
  }
  return next();
};

export const requireRoles = (allowedRoles) => (req, _res, next) => {
  if (!req.auth?.user) {
    return next(unauthorizedError());
  }

  if (!allowedRoles?.length) {
    return next();
  }

  const isAllowed = allowedRoles.some((role) => req.auth.roles.includes(role));
  if (!isAllowed) {
    return next(forbiddenError('Your role is not allowed to access this resource.', { allowedRoles }));
  }

  return next();
};

export const authorizeTableAction = (action) => (req, _res, next) => {
  if (!req.auth?.user) {
    return next(unauthorizedError());
  }

  const table = normalizeResourceName(req.body?.table);
  if (!table) {
    return next();
  }

  if (req.body && typeof req.body === 'object') {
    req.body.table = table;
  }

  if (!canAccessTable(req.auth.rawRoles, table, action)) {
    return next(forbiddenError(
      `Your role is not allowed to ${action} ${table}.`,
      {
        table,
        action,
        currentRoles: req.auth.rawRoles || [],
      },
    ));
  }

  return next();
};

export const authorizeRpc = (req, _res, next) => {
  if (!req.auth?.user) {
    return next(unauthorizedError());
  }

  const rpcName = normalizeResourceName(req.params?.name);
  if (!canAccessRpc(req.auth.rawRoles, rpcName)) {
    return next(forbiddenError(
      `Your role is not allowed to execute ${rpcName}.`,
      {
        rpcName,
        currentRoles: req.auth.rawRoles || [],
      },
    ));
  }

  return next();
};
