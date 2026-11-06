import mongoose from "mongoose";
import { rememberFactoryDatabase, type FactoryContext } from "./factory-context.js";
import { resolveFactoryDatabaseName, type FactoryDatabaseMapping } from "./factory-database-name.js";

const COLLECTION = "factory_database_registry";

/** Records which database already belongs to a factory. It does not create or rename one. */
export const adoptFactoryDatabase = async (context: FactoryContext) => {
  const control = mongoose.connection.db;
  const controlDatabase = mongoose.connection.name;
  if (!control || !controlDatabase) throw new Error("Database is not connected.");
  const registry = control.collection(COLLECTION);
  await registry.createIndex(
    { control_database: 1, tenant_id: 1, factory_id: 1 },
    { unique: true, name: "factory_database_identity" },
  );
  await registry.createIndex({ database_name: 1 }, { unique: true, name: "factory_database_name" });

  const name = await resolveFactoryDatabaseName({
    controlDatabase,
    context,
    listDatabaseNames: async () => {
      const listed = await control.admin().listDatabases({ nameOnly: true });
      return listed.databases.map((row) => row.name);
    },
    readMapping: async (scope) => {
      const row = await registry.findOne({
        control_database: controlDatabase,
        tenant_id: scope.tenant_id,
        factory_id: scope.factory_id,
      });
      return typeof row?.database_name === "string" ? row.database_name : null;
    },
    readOwner: async (databaseName) => {
      const row = await registry.findOne({ database_name: databaseName });
      if (!row?.tenant_id || !row.factory_id) return null;
      return { tenant_id: String(row.tenant_id), factory_id: String(row.factory_id) };
    },
    saveMapping: async (mapping: FactoryDatabaseMapping) => {
      try {
        await registry.insertOne({ ...mapping, created_at: new Date().toISOString() });
      } catch (error) {
        const duplicate = (error as { code?: number }).code === 11000;
        const row = duplicate
          ? await registry.findOne({
            control_database: mapping.control_database,
            tenant_id: mapping.tenant_id,
            factory_id: mapping.factory_id,
          })
          : null;
        if (row?.database_name === mapping.database_name) return;
        throw error;
      }
    },
  });
  rememberFactoryDatabase(controlDatabase, context, name);
  return name;
};
