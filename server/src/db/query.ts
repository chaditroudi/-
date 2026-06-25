type QueryFilter = {
  type: "eq" | "in" | "gte" | "lte" | "or";
  column?: string;
  value: unknown;
};

const normalizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  return value;
};

const parseOrExpression = (expression: string) => {
  return expression
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const match = token.match(/^([^.=]+)\.(eq|gte|lte|in)\.(.+)$/);
      if (!match) return null;

      const [, field, operator, rawValue] = match;
      const value = operator === "in" ? rawValue.split(";").map((item) => normalizeValue(item)) : normalizeValue(rawValue);

      if (operator === "eq") return { [field]: value };
      if (operator === "gte") return { [field]: { $gte: value } };
      if (operator === "lte") return { [field]: { $lte: value } };
      return { [field]: { $in: Array.isArray(value) ? value : [value] } };
    })
    .filter(Boolean);
};

export const buildMongoFilter = (filters: QueryFilter[] = []) => {
  const andClauses: Record<string, unknown>[] = [];

  filters.forEach((filter) => {
    if (filter.type === "or" && typeof filter.value === "string") {
      const orClauses = parseOrExpression(filter.value);
      if (orClauses.length > 0) {
        andClauses.push({ $or: orClauses });
      }
      return;
    }

    if (!filter.column) return;

    const value = normalizeValue(filter.value);
    if (filter.type === "eq") {
      andClauses.push({ [filter.column]: value });
      return;
    }

    if (filter.type === "in") {
      andClauses.push({ [filter.column]: { $in: Array.isArray(value) ? value : [value] } });
      return;
    }

    if (filter.type === "gte") {
      andClauses.push({ [filter.column]: { $gte: value } });
      return;
    }

    if (filter.type === "lte") {
      andClauses.push({ [filter.column]: { $lte: value } });
    }
  });

  if (andClauses.length === 0) return {};
  if (andClauses.length === 1) return andClauses[0];
  return { $and: andClauses };
};

export const buildSort = (orderBy?: { column?: string; ascending?: boolean }) => {
  if (!orderBy?.column) return undefined;
  return { [orderBy.column]: orderBy.ascending === false ? -1 : 1 };
};
