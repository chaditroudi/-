import mongoose from "mongoose";
const modelCache = new Map();
export const getCollectionModel = (collectionName) => {
    if (modelCache.has(collectionName)) {
        return modelCache.get(collectionName);
    }
    const schema = new mongoose.Schema({}, {
        strict: false,
        minimize: false,
        versionKey: false,
        collection: collectionName,
        id: false,
    });
    schema.index({ id: 1 }, { unique: false, sparse: true });
    const existingModel = mongoose.models[collectionName];
    const model = existingModel || mongoose.model(collectionName, schema, collectionName);
    modelCache.set(collectionName, model);
    return model;
};
export const sanitizeDocument = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeDocument(item));
    }
    if (!value || typeof value !== "object") {
        return value;
    }
    const source = value;
    const output = {};
    for (const [key, entry] of Object.entries(source)) {
        if (key === "_id" || key === "__v" || key === "passwordHash" || key === "password_hash") {
            continue;
        }
        output[key] = sanitizeDocument(entry);
    }
    if (!output.id && source._id) {
        output.id = String(source._id);
    }
    return output;
};
