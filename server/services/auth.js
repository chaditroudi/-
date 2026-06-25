import jwt from 'jsonwebtoken';

export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export const extractBearerToken = (authorizationHeader) => {
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  return authorizationHeader.slice(7);
};

export const createAccessToken = (user, jwtSecret, claims = {}) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      ...claims,
    },
    jwtSecret,
    { expiresIn: `${SESSION_DURATION_SECONDS}s` },
  );

export const createSessionPayload = (user, jwtSecret, metadata = {}) => ({
  access_token: createAccessToken(user, jwtSecret, metadata.claims || {}),
  token_type: 'bearer',
  expires_in: SESSION_DURATION_SECONDS,
  user: {
    id: user.id,
    email: user.email,
    ...(metadata.user_metadata ? { user_metadata: metadata.user_metadata } : {}),
  },
});

export const verifyAccessToken = (token, jwtSecret) => jwt.verify(token, jwtSecret);
