import { createHash } from "node:crypto";

export type FactoryContext = Readonly<{ tenant_id: string; factory_id: string }>;
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
const validatedContext = (context: FactoryContext): FactoryContext | null =>
  validId(context?.tenant_id) && validId(context?.factory_id)
    ? { tenant_id: context.tenant_id, factory_id: context.factory_id }
    : null;

/**
 * MongoDB itself allows a database name below 64 bytes.
 * MongoDB Atlas shared tiers (the cluster that returned AtlasError code 8000)
 * reject a name longer than 38 bytes. New names stay inside that limit.
 * A longer name is used only when that database already exists.
 */
export const FACTORY_DATABASE_NAME_MAX_BYTES = 38;
export const FACTORY_DATABASE_PREFIX = "dhh_f_";
const CURRENT_HEX_CHARS = 32;
const LEGACY_HEX_CHARS = 40;

const digestFor = (controlDatabase: string, context: FactoryContext) => {
  const validated = validatedContext(context);
  if (!validated || !controlDatabase) throw new Error("Valid control database and factory required.");
  return createHash("sha256")
    .update(JSON.stringify([controlDatabase, validated.tenant_id, validated.factory_id]))
    .digest("hex");
};

const named = (controlDatabase: string, context: FactoryContext, hexChars: number) =>
  `${FACTORY_DATABASE_PREFIX}${digestFor(controlDatabase, context).slice(0, hexChars)}`;

/** Atlas-safe name for a factory that does not already have a database. 6 + 32 = 38 bytes. */
export const factoryDatabaseName = (controlDatabase: string, context: FactoryContext) => {
  const name = named(controlDatabase, context, CURRENT_HEX_CHARS);
  if (Buffer.byteLength(name, "utf8") > FACTORY_DATABASE_NAME_MAX_BYTES) {
    throw new Error("Factory database name exceeds the Atlas shared-tier limit.");
  }
  return name;
};

/** Historical 46-byte name. Kept only so an existing database is not abandoned. */
export const legacyFactoryDatabaseName = (controlDatabase: string, context: FactoryContext) =>
  named(controlDatabase, context, LEGACY_HEX_CHARS);

export type FactoryDatabaseReason = "registry" | "existing-legacy" | "existing-current" | "new";

export type FactoryDatabaseMapping = {
  control_database: string;
  tenant_id: string;
  factory_id: string;
  database_name: string;
  reason: FactoryDatabaseReason;
};

export class FactoryDatabaseNameError extends Error {
  constructor(readonly code: "FACTORY_DATABASE_AMBIGUOUS" | "FACTORY_DATABASE_COLLISION" | "FACTORY_DATABASE_UNRESOLVED") {
    super(code);
  }
}

/**
 * 32 hex characters are 128 bits of SHA-256. For n factories the chance two
 * names collide is about n² / 2^129. One million factories is still negligible.
 * The registry rejects a name already owned by another factory anyway.
 */
export const resolveFactoryDatabaseName = async (input: {
  controlDatabase: string;
  context: FactoryContext;
  listDatabaseNames: () => Promise<string[]>;
  readMapping: (context: FactoryContext) => Promise<string | null>;
  readOwner: (databaseName: string) => Promise<Pick<FactoryContext, "tenant_id" | "factory_id"> | null>;
  saveMapping: (mapping: FactoryDatabaseMapping) => Promise<void>;
}): Promise<string> => {
  const validated = validatedContext(input.context);
  if (!validated) throw new Error("Valid control database and factory required.");
  const recorded = await input.readMapping(validated);
  if (recorded) return recorded;

  const current = factoryDatabaseName(input.controlDatabase, validated);
  const legacy = legacyFactoryDatabaseName(input.controlDatabase, validated);
  let names: string[];
  try {
    names = await input.listDatabaseNames();
  } catch {
    throw new FactoryDatabaseNameError("FACTORY_DATABASE_UNRESOLVED");
  }
  const hasCurrent = names.includes(current);
  const hasLegacy = names.includes(legacy);
  if (hasCurrent && hasLegacy) throw new FactoryDatabaseNameError("FACTORY_DATABASE_AMBIGUOUS");

  const chosen = hasLegacy ? legacy : current;
  const reason: FactoryDatabaseReason = hasLegacy ? "existing-legacy" : hasCurrent ? "existing-current" : "new";
  const owner = await input.readOwner(chosen);
  if (owner && (owner.tenant_id !== validated.tenant_id || owner.factory_id !== validated.factory_id)) {
    throw new FactoryDatabaseNameError("FACTORY_DATABASE_COLLISION");
  }
  await input.saveMapping({
    control_database: input.controlDatabase,
    tenant_id: validated.tenant_id,
    factory_id: validated.factory_id,
    database_name: chosen,
    reason,
  });
  return chosen;
};
