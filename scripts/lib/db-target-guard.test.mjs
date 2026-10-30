import { describe, expect, it } from "vitest";
import { assertSafeDbTarget, describeHosts } from "./db-target-guard.mjs";

const LOCAL = "mongodb://127.0.0.1:27017/date_harvest_hub";
const REMOTE = "mongodb+srv://user:s3cret@cluster0.example.mongodb.net/app";

describe("assertSafeDbTarget", () => {
  it("refuses a missing URI instead of falling back to any default", () => {
    expect(() => assertSafeDbTarget({ uri: "", dbName: "app", argv: [] })).toThrow(/MONGODB_URI/);
  });

  it("allows a local target without flags", () => {
    expect(assertSafeDbTarget({ uri: LOCAL, dbName: "app", argv: [] }).isLocal).toBe(true);
    expect(assertSafeDbTarget({ uri: "mongodb://localhost:27017", dbName: "app", argv: [] }).isLocal).toBe(true);
  });

  it("refuses a remote target with no flags", () => {
    expect(() => assertSafeDbTarget({ uri: REMOTE, dbName: "app", argv: [] })).toThrow(/--i-know/);
  });

  it("refuses a remote target when the typed database name does not match", () => {
    expect(() =>
      assertSafeDbTarget({ uri: REMOTE, dbName: "app", argv: ["--i-know", "--confirm-db=other"] }),
    ).toThrow(/--confirm-db/);
    expect(() => assertSafeDbTarget({ uri: REMOTE, dbName: "app", argv: ["--i-know"] })).toThrow(/--confirm-db/);
  });

  it("allows a remote target with both flags", () => {
    const target = assertSafeDbTarget({ uri: REMOTE, dbName: "app", argv: ["--i-know", "--confirm-db=app"] });
    expect(target.isLocal).toBe(false);
  });

  it("treats a replica set with any remote member as remote", () => {
    const uri = "mongodb://127.0.0.1:27017,db2.example.com:27017/app";
    expect(() => assertSafeDbTarget({ uri, dbName: "app", argv: [] })).toThrow(/--i-know/);
  });

  it("does not treat a look-alike host as local", () => {
    const uri = "mongodb://localhost.attacker.example:27017/app";
    expect(() => assertSafeDbTarget({ uri, dbName: "app", argv: [] })).toThrow(/--i-know/);
  });

  it("never exposes credentials in errors or the description", () => {
    let message = "";
    try {
      assertSafeDbTarget({ uri: REMOTE, dbName: "app", argv: [] });
    } catch (error) {
      message = error.message;
    }
    expect(message).not.toContain("s3cret");
    expect(message).not.toContain("user:");
    expect(describeHosts(REMOTE)).toBe("cluster0.example.mongodb.net");
  });
});
