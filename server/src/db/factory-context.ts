import { AsyncLocalStorage } from "node:async_hooks";
import mongoose from "mongoose";
import { AppError } from "../core/app-error.js";
import { factoryDatabaseName } from "./factory-database-name.js";

export { factoryDatabaseName, legacyFactoryDatabaseName } from "./factory-database-name.js";

export type FactoryContext = Readonly<{ tenant_id: string; factory_id: string }>;
const factoryStorage = new AsyncLocalStorage<FactoryContext>();
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);

/** Membership is provisioned on the account, never inferred from legacy rows or HTTP input. */
export const factoryFromAccount = (account: any): FactoryContext | null =>
  validId(account?.tenant_id) && validId(account?.factory_id)
    ? Object.freeze({ tenant_id: account.tenant_id, factory_id: account.factory_id }) : null;

export const currentFactory = () => factoryStorage.getStore();
export const requireFactory = (): FactoryContext => {
  const context = currentFactory();
  if (!context) throw new AppError(403, "FACTORY_CONTEXT_REQUIRED", "Un rattachement à une usine est requis.");
  return context;
};

/** Jobs must carry the authorized context captured at enqueue time; there is no default factory. */
export const runWithFactory = <T>(context: FactoryContext, work: () => T): T => {
  const validated = factoryFromAccount(context);
  if (!validated) throw new AppError(403, "FACTORY_CONTEXT_INVALID", "Rattachement à une usine invalide.");
  return factoryStorage.run(validated, work);
};

export const sameFactory = (a: FactoryContext | null | undefined, b: FactoryContext | null | undefined) =>
  Boolean(a && b && a.tenant_id === b.tenant_id && a.factory_id === b.factory_id);

const adoptedNames = new Map<string, string>();
const adoptedKey = (controlDatabase: string, context: FactoryContext) =>
  `${controlDatabase}\0${context.tenant_id}\0${context.factory_id}`;

/** The name chosen for this process. A request must resolve it before any factory write. */
export const rememberFactoryDatabase = (controlDatabase: string, context: FactoryContext, databaseName: string) => {
  const validated = factoryFromAccount(context);
  if (!validated || !controlDatabase || !databaseName) throw new Error("Valid control database and factory required.");
  adoptedNames.set(adoptedKey(controlDatabase, validated), databaseName);
};

export const rememberedFactoryDatabase = (controlDatabase: string, context: FactoryContext) => {
  const validated = factoryFromAccount(context);
  if (!validated || !controlDatabase) return undefined;
  return adoptedNames.get(adoptedKey(controlDatabase, validated));
};

/** useDb shares the existing MongoClient/session pool, including replica-set transactions. */
export const factoryConnection = () => {
  const context = requireFactory();
  const controlDatabase = mongoose.connection.name;
  if (!controlDatabase) throw new AppError(503, "DATABASE_UNAVAILABLE", "Database is not connected.");
  const databaseName = rememberedFactoryDatabase(controlDatabase, context) ?? factoryDatabaseName(controlDatabase, context);
  return mongoose.connection.useDb(databaseName, { useCache: true });
};

/** The few control-plane account lookups used by factory workflows must also be scoped. */
export const factoryUserFilter = (filter: Record<string, unknown> = {}) => ({ ...filter, ...requireFactory() });
