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

export const matchesFilter = (row: TestRow, filter: TestRow = {}): boolean =>
  Object.entries(filter || {}).every(([key, condition]) => {
    if (key === "$or") {
      return (condition as TestRow[]).some((clause) => matchesFilter(row, clause));
    }
    if (condition && typeof condition === "object" && !Array.isArray(condition)) {
      const operators = condition as TestRow;
      if ("$ne" in operators) return row[key] !== operators.$ne;
      if ("$gte" in operators) return String(row[key] ?? "") >= String(operators.$gte);
      if ("$in" in operators) return (operators.$in as unknown[]).includes(row[key]);
    }
    return row[key] === condition;
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

  return {
    find: (filter?: TestRow) => buildQuery(select(filter), false),
    findOne: (filter?: TestRow) => buildQuery(select(filter), true),
    create: async (incoming: TestRow[]) => insert(incoming),
    insertMany: async (incoming: TestRow[]) => insert(incoming),
    updateOne: (filter?: TestRow, update?: { $set?: TestRow }) => ({
      exec: async () => {
        const row = select(filter)[0];
        if (row && update?.$set) Object.assign(row, update.$set);
        return { acknowledged: true };
      },
    }),
    updateMany: (filter?: TestRow, update?: { $set?: TestRow }) => ({
      exec: async () => {
        if (update?.$set) select(filter).forEach((row) => Object.assign(row, update.$set as TestRow));
        return { acknowledged: true };
      },
    }),
    deleteMany: (filter?: TestRow) => ({
      exec: async () => {
        const removed = select(filter);
        store[collection] = rows().filter((row) => !removed.includes(row));
        return { acknowledged: true, deletedCount: removed.length };
      },
    }),
  };
};
