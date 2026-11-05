import mongoose from "mongoose";
import { factoryConnection } from "./factory-context.js";
import { getSiteSettingsModel } from "../models/site-settings.model.js";

export const getCollectionModel = (collectionName: string): any => {
  const connection = factoryConnection();
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(collectionName) || collectionName === "auth_users") {
    throw new Error("Invalid operational collection.");
  }
  if (collectionName === "site_settings") return getSiteSettingsModel();
  if (connection.models[collectionName]) return connection.models[collectionName];

  const schema = new mongoose.Schema(
    {},
    {
      strict: false,
      minimize: false,
      versionKey: false,
      collection: collectionName,
      id: false,
    },
  );

  schema.index({ id: 1 }, { unique: false, sparse: true });

  return connection.model(collectionName, schema, collectionName);
};

export const sanitizeDocument = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDocument(item)) as T;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(source)) {
    if (key === "_id" || key === "__v" || key === "passwordHash" || key === "password_hash") {
      continue;
    }
    output[key] = sanitizeDocument(entry);
  }

  if (!output.id && source._id) {
    output.id = String(source._id);
  }

  return output as T;
};
