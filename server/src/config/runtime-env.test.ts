import { describe, expect, it } from "vitest";

import {
  classifyDatabaseHost,
  describeUnlabelledTarget,
  refuseDatabaseTarget,
  resolveAppEnv,
  shouldSeedDemoData,
} from "./runtime-env.js";

const ATLAS = "mongodb+srv://user:secret@cluster0.example.mongodb.net/app";

describe("resolveAppEnv", () => {
  it("reads a declared environment", () => {
    expect(resolveAppEnv("test", "development")).toBe("test");
    expect(resolveAppEnv(" LIVE-DEV ", "development")).toBe("live-dev");
  });

  it("treats an undeclared production process as production", () => {
    expect(resolveAppEnv(undefined, "production")).toBe("production");
  });

  it("leaves an undeclared development process unlabelled", () => {
    expect(resolveAppEnv("", "development")).toBeNull();
  });

  it("refuses an unknown value instead of guessing", () => {
    expect(() => resolveAppEnv("prod", "production")).toThrow(/Unknown APP_ENV/);
  });
});

describe("classifyDatabaseHost", () => {
  it.each([
    ["mongodb://127.0.0.1:27327/?replicaSet=rs-reception", "local"],
    ["mongodb://localhost/app", "local"],
    ["mongodb://u:p@127.0.0.1:27017/app", "local"],
    ["mongodb://[::1]:27017/app", "local"],
    [ATLAS, "remote"],
    ["mongodb://10.0.0.5:27017/app", "remote"],
  ])("%s is %s", (uri, expected) => {
    expect(classifyDatabaseHost(uri)).toBe(expected);
  });

  it("treats a replica set with any remote member as remote", () => {
    expect(classifyDatabaseHost("mongodb://127.0.0.1:27017,db.example.com:27017/app")).toBe("remote");
  });

  it("is not fooled by a local-looking password", () => {
    expect(classifyDatabaseHost("mongodb://u:127.0.0.1@db.example.com/app")).toBe("remote");
  });
});

describe("refuseDatabaseTarget", () => {
  it.each(["dev", "test"] as const)("refuses a remote database for %s", (appEnv) => {
    expect(refuseDatabaseTarget(appEnv, "development", "remote")).toMatch(/local database/);
  });

  it("allows the deliberate live-dev stack on a remote database", () => {
    expect(refuseDatabaseTarget("live-dev", "development", "remote")).toBeNull();
  });

  it("does not stop an unlabelled stack that exists today", () => {
    expect(refuseDatabaseTarget(null, "development", "remote")).toBeNull();
  });

  it("refuses a production label without production settings", () => {
    expect(refuseDatabaseTarget("production", "development", "remote")).toMatch(/NODE_ENV=production/);
  });

  it("refuses a test label on a production process", () => {
    expect(refuseDatabaseTarget("test", "production", "local")).toMatch(/cannot run/);
  });
});

describe("shouldSeedDemoData", () => {
  it("seeds disposable local databases", () => {
    expect(shouldSeedDemoData("test", "local")).toBe(true);
    expect(shouldSeedDemoData("dev", "local")).toBe(true);
    expect(shouldSeedDemoData(null, "local")).toBe(true);
  });

  it.each(["live-dev", "staging", "production"] as const)("never seeds %s", (appEnv) => {
    expect(shouldSeedDemoData(appEnv, "local")).toBe(false);
    expect(shouldSeedDemoData(appEnv, "remote")).toBe(false);
  });

  it("never seeds a remote database, even unlabelled", () => {
    expect(shouldSeedDemoData(null, "remote")).toBe(false);
  });
});

describe("describeUnlabelledTarget", () => {
  it("warns only about an unlabelled remote stack", () => {
    expect(describeUnlabelledTarget(null, "remote")).toMatch(/APP_ENV/);
    expect(describeUnlabelledTarget(null, "local")).toBeNull();
    expect(describeUnlabelledTarget("live-dev", "remote")).toBeNull();
  });
});
