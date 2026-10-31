import dotenv from "dotenv";

import { classifyDatabaseHost, resolveAppEnv } from "./runtime-env.js";

dotenv.config();

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const DEV_JWT_SECRET = "change-me-in-production";
const MIN_JWT_SECRET_LENGTH = 32;

export const resolveJwtSecret = (nodeEnv: string, secret: string | undefined) => {
  if (nodeEnv !== "production") return secret || DEV_JWT_SECRET;
  if (!secret || secret === DEV_JWT_SECRET) {
    throw new Error("JWT_SECRET must be set to a private value in production.");
  }
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production.`);
  }
  return secret;
};

const nodeEnv = process.env.NODE_ENV || "development";
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/date_harvest_hub";

export const env = {
  nodeEnv,
  appEnv: resolveAppEnv(process.env.APP_ENV, nodeEnv),
  databaseHostClass: classifyDatabaseHost(mongoUri),
  port: toNumber(process.env.PORT, 4000),
  host: process.env.API_HOST || "0.0.0.0",
  mongoUri,
  mongoDbName: process.env.MONGODB_DB_NAME || "date_harvest_hub",
  jwtSecret: resolveJwtSecret(nodeEnv, process.env.JWT_SECRET),
  jwtExpiresInSeconds: toNumber(process.env.JWT_EXPIRES_IN_SECONDS, 60 * 60 * 8),
  databaseRetryIntervalMs: toNumber(process.env.DATABASE_RETRY_INTERVAL_MS, 60_000),
};
