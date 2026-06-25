import dotenv from "dotenv";
dotenv.config();
const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
export const env = {
    nodeEnv: process.env.NODE_ENV || "development",
    port: toNumber(process.env.PORT, 4000),
    host: process.env.API_HOST || "0.0.0.0",
    mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/date_harvest_hub",
    mongoDbName: process.env.MONGODB_DB_NAME || "date_harvest_hub",
    jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
    jwtExpiresInSeconds: toNumber(process.env.JWT_EXPIRES_IN_SECONDS, 60 * 60 * 24 * 30),
    databaseRetryIntervalMs: toNumber(process.env.DATABASE_RETRY_INTERVAL_MS, 60_000),
};
