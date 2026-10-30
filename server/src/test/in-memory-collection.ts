/**
 * Mongoose-model stand-in for service tests.
 *
 * Services chain `find`/`findOne` with `sort`, `limit`, `lean` and `exec`. A fake
 * that only implements part of that chain throws, and callers that deliberately
 * swallow their own failures (ledger appends via `recordStageSafe`, notification
 * emits) then pass while exercising nothing. Keep this close to model behaviour so
 * those paths stay observable.
 */

export type TestRow = Record<string, unknown>;

const collectPath = (value: unknown, parts: string[]): unknown[] => {
  if (parts.length === 0) return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectPath(item, parts));
  if (value && typeof value === "object") {
    return collectPath((value as TestRow)[parts[0]], parts.slice(1));
  }
  return [];
};

const fieldValues = (row: TestRow, key: string): unknown[] => {
  if (!key.includes(".")) return key in row ? [row[key]] : [];
  return collectPath(row, key.split("."));
};

const valueMatches = (values: unknown[], predicate: (value: unknown) => boolean) =>
  values.some((value) => (Array.isArray(value) ? value.some((item) => predicate(item)) : predicate(value)));

export const matchesFilter = (row: TestRow, filter: TestRow = {}): boolean =>
  Object.entries(filter || {}).every(([key, condition]) => {
    if (key === "$or") {
      return (condition as TestRow[]).some((clause) => matchesFilter(row, clause));
    }
    const values = fieldValues(row, key);
    const current = key.includes(".") ? values[0] : row[key];
    if (condition && typeof condition === "object" && !Array.isArray(condition) && !(condition instanceof RegExp)) {
      const operators = condition as TestRow;
      // Numeric-aware comparison for range operators; falls back to string
      // comparison (correct for ISO date strings, which is how callers use it).
      const compare = (a: unknown, b: unknown) => {
        if (typeof a === "number" && typeof b === "number") return a - b;
        return String(a ?? "").localeCompare(String(b ?? ""));
      };
      if ("$ne" in operators) return current !== operators.$ne;
      if ("$gt" in operators) return compare(current, operators.$gt) > 0;
      if ("$gte" in operators) return compare(current, operators.$gte) >= 0;
      if ("$lt" in operators) return compare(current, operators.$lt) < 0;
      if ("$lte" in operators) return compare(current, operators.$lte) <= 0;
      if ("$exists" in operators) {
        const exists = values.some((value) => value !== undefined && value !== null);
        return Boolean(operators.$exists) === exists;
      }
      if ("$in" in operators) {
        const list = operators.$in as unknown[];
        return valueMatches(values, (value) => list.includes(value));
      }
      if ("$regex" in operators) {
        const pattern = operators.$regex;
        const regex = pattern instanceof RegExp
          ? pattern
          : new RegExp(String(pattern), typeof operators.$options === "string" ? operators.$options : "");
        return valueMatches(values, (value) => regex.test(String(value ?? "")));
      }
    }
    // Mongo: `{ field: null }` also matches documents where the field is missing.
    if (condition === null) return values.length === 0 || valueMatches(values, (value) => value == null);
    return valueMatches(values.length > 0 ? values : [current], (value) => value === condition);
  });

export const buildQuery = (rows: TestRow[], single: boolean) => {
  let result = [...rows];
  const chain = {
    sort: (spec: Record<string, 1 | -1>) => {
      const [key, direction] = Object.entries(spec || {})[0] || [];
      if (key) {
        result.sort((a, b) => (Number(a[key] ?? 0) - Number(b[key] ?? 0)) * Number(direction));
      }
      return chain;
    },
    limit: (count: number) => {
      result = result.slice(0, count);
      return chain;
    },
    select: (_fields?: unknown) => chain,
    lean: () => chain,
    exec: async () => (single ? result[0] ?? null : result),
  };
  return chain;
};

/**
 * Model backed by `store[collection]`, so documents written by the code under
 * test are readable by later queries in the same call.
 */
export const createInMemoryModel = (
  collection: string,
  store: Record<string, TestRow[]>,
  options: { onInsert?: (rows: TestRow[]) => void } = {},
) => {
  const rows = () => store[collection] || [];
  const insert = (incoming: TestRow[]) => {
    store[collection] = [...rows(), ...incoming];
    options.onInsert?.(incoming);
  };
  const select = (filter?: TestRow) => rows().filter((row) => matchesFilter(row, filter));

  const runUpdate = (filter?: TestRow, update?: { $set?: TestRow }) => {
    const run = async () => {
      const row = select(filter)[0];
      if (row && update?.$set) Object.assign(row, update.$set);
      return { acknowledged: true, modifiedCount: row ? 1 : 0 };
    };
    const promise = run();
    return Object.assign(promise, { exec: () => promise });
  };

  const runUpdateMany = (filter?: TestRow, update?: { $set?: TestRow }) => {
    const run = async () => {
      const matched = select(filter);
      if (update?.$set) matched.forEach((row) => Object.assign(row, update.$set as TestRow));
      return { acknowledged: true, modifiedCount: matched.length };
    };
    const promise = run();
    return Object.assign(promise, { exec: () => promise });
  };

  return {
    find: (filter?: TestRow) => buildQuery(select(filter), false),
    findOne: (filter?: TestRow) => buildQuery(select(filter), true),
    create: async (incoming: TestRow[]) => insert(incoming),
    insertOne: async (doc: TestRow) => {
      insert([doc]);
      return doc;
    },
    insertMany: async (incoming: TestRow[]) => insert(incoming),
    updateOne: runUpdate,
    updateMany: runUpdateMany,
    deleteMany: (filter?: TestRow) => ({
      exec: async () => {
        const removed = select(filter);
        store[collection] = rows().filter((row) => !removed.includes(row));
        return { acknowledged: true, deletedCount: removed.length };
      },
    }),
    countDocuments: (filter?: TestRow) => ({
      exec: async () => select(filter).length,
    }),
  };
};
