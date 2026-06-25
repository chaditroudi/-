import mongoose from "mongoose";

import { env } from "../config/env.js";

let connected = false;
let connectionPromise: Promise<typeof mongoose.connection> | null = null;

type DatabaseStatus = {
  status: "idle" | "connecting" | "connected" | "error";
  attempts: number;
  lastError: string | null;
  lastConnectedAt: string | null;
  nextRetryAt: string | null;
};

const databaseStatus: DatabaseStatus = {
  status: "idle",
  attempts: 0,
  lastError: null,
  lastConnectedAt: null,
  nextRetryAt: null,
};

const errorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : String(error);
};

export const isDatabaseConnected = () => {
  return connected && mongoose.connection.readyState === 1;
};

export const getDatabaseStatus = () => ({
  ...databaseStatus,
  readyState: mongoose.connection.readyState,
});

export const setNextDatabaseRetry = (nextRetryAt: Date) => {
  if (!isDatabaseConnected()) {
    databaseStatus.nextRetryAt = nextRetryAt.toISOString();
  }
};

export const connectToDatabase = async () => {
  if (isDatabaseConnected()) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  databaseStatus.status = "connecting";
  databaseStatus.attempts += 1;
  databaseStatus.lastError = null;
  databaseStatus.nextRetryAt = null;

  connectionPromise = (async () => {
    try {
      await mongoose.connect(env.mongoUri, {
        dbName: env.mongoDbName,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });

      connected = true;
      databaseStatus.status = "connected";
      databaseStatus.lastConnectedAt = new Date().toISOString();
      databaseStatus.lastError = null;
      databaseStatus.nextRetryAt = null;

      return mongoose.connection;
    } catch (error) {
      connected = false;
      databaseStatus.status = "error";
      databaseStatus.lastError = errorMessage(error);

      await mongoose.disconnect().catch(() => undefined);
      throw error;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};
