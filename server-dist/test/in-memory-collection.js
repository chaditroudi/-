/**
 * Mongoose-model stand-in for service tests.
 *
 * Services chain `find`/`findOne` with `sort`, `limit`, `lean` and `exec`. A fake
 * that only implements part of that chain throws, and callers that deliberately
 * swallow their own failures (ledger appends via `recordStageSafe`, notification
 * emits) then pass while exercising nothing. Keep this close to model behaviour so
 * those paths stay observable.
 */
export const matchesFilter = (row, filter = {}) => Object.entries(filter || {}).every(([key, condition]) => {
    if (key === "$or") {
        return condition.some((clause) => matchesFilter(row, clause));
    }
    if (condition && typeof condition === "object" && !Array.isArray(condition)) {
        const operators = condition;
        if ("$ne" in operators)
            return row[key] !== operators.$ne;
        if ("$gte" in operators)
            return String(row[key] ?? "") >= String(operators.$gte);
        if ("$in" in operators)
            return operators.$in.includes(row[key]);
    }
    return row[key] === condition;
});
export const buildQuery = (rows, single) => {
    let result = [...rows];
    const chain = {
        sort: (spec) => {
            const [key, direction] = Object.entries(spec || {})[0] || [];
            if (key) {
                result.sort((a, b) => (Number(a[key] ?? 0) - Number(b[key] ?? 0)) * Number(direction));
            }
            return chain;
        },
        limit: (count) => {
            result = result.slice(0, count);
            return chain;
        },
        select: (_fields) => chain,
        lean: () => chain,
        exec: async () => (single ? result[0] ?? null : result),
    };
    return chain;
};
/**
 * Model backed by `store[collection]`, so documents written by the code under
 * test are readable by later queries in the same call.
 */
export const createInMemoryModel = (collection, store, options = {}) => {
    const rows = () => store[collection] || [];
    const insert = (incoming) => {
        store[collection] = [...rows(), ...incoming];
        options.onInsert?.(incoming);
    };
    const select = (filter) => rows().filter((row) => matchesFilter(row, filter));
    return {
        find: (filter) => buildQuery(select(filter), false),
        findOne: (filter) => buildQuery(select(filter), true),
        create: async (incoming) => insert(incoming),
        insertMany: async (incoming) => insert(incoming),
        updateOne: (filter, update) => ({
            exec: async () => {
                const row = select(filter)[0];
                if (row && update?.$set)
                    Object.assign(row, update.$set);
                return { acknowledged: true };
            },
        }),
        updateMany: (filter, update) => ({
            exec: async () => {
                if (update?.$set)
                    select(filter).forEach((row) => Object.assign(row, update.$set));
                return { acknowledged: true };
            },
        }),
        deleteMany: (filter) => ({
            exec: async () => {
                const removed = select(filter);
                store[collection] = rows().filter((row) => !removed.includes(row));
                return { acknowledged: true, deletedCount: removed.length };
            },
        }),
    };
};
