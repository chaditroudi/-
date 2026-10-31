import { describe, expect, it } from "vitest";

import { canonicalize, compareSummaries, hashDocuments, rehearsalDatabaseName } from "./db-backup.mjs";

const entry = (count, hash, indexes = [{ key: { _id: 1 }, name: "_id_" }]) => ({ count, hash, indexes });

describe("canonicalize", () => {
  it("ignores field order, at any depth", () => {
    expect(JSON.stringify(canonicalize({ b: 1, a: { d: 2, c: [{ f: 1, e: 2 }] } }))).toBe(
      JSON.stringify({ a: { c: [{ e: 2, f: 1 }], d: 2 }, b: 1 }),
    );
  });
});

describe("hashDocuments", () => {
  it("ignores document order", () => {
    expect(hashDocuments(["a", "b"])).toBe(hashDocuments(["b", "a"]));
  });

  it("changes with any content", () => {
    expect(hashDocuments(["a", "b"])).not.toBe(hashDocuments(["a", "c"]));
  });
});

describe("compareSummaries", () => {
  it("finds nothing wrong in identical databases", () => {
    expect(compareSummaries({ lots: entry(2, "x") }, { lots: entry(2, "x") })).toEqual([]);
  });

  it("reports a missing collection", () => {
    expect(compareSummaries({ lots: entry(2, "x") }, {})).toEqual(["lots: missing after restore"]);
  });

  it("reports an extra collection", () => {
    expect(compareSummaries({}, { lots: entry(2, "x") })).toEqual(["lots: not in the backup"]);
  });

  it("reports lost documents", () => {
    expect(compareSummaries({ lots: entry(2, "x") }, { lots: entry(1, "y") })).toEqual(["lots: 2 documents became 1"]);
  });

  it("reports changed contents with the same count", () => {
    expect(compareSummaries({ lots: entry(2, "x") }, { lots: entry(2, "y") })).toEqual(["lots: contents differ"]);
  });

  it("reports a lost index, because a unique index protects data", () => {
    const unique = [{ key: { _id: 1 }, name: "_id_" }, { key: { lot: 1 }, name: "lot_1", unique: true }];
    expect(compareSummaries({ lots: entry(2, "x", unique) }, { lots: entry(2, "x") })).toEqual(["lots: indexes differ"]);
  });
});

describe("rehearsalDatabaseName", () => {
  it("stays within the MongoDB name limit", () => {
    expect(rehearsalDatabaseName("d".repeat(70), "20261031").length).toBeLessThanOrEqual(63);
  });

  it("is never the source name", () => {
    expect(rehearsalDatabaseName("factory", "1")).not.toBe("factory");
  });
});
