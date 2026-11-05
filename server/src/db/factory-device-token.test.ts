// @vitest-environment node
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { env } from "../config/env.js";
import { resolveFactoryDeviceToken, issueFactoryDeviceToken } from "./factory-device-token.js";
import { runWithFactory } from "./factory-context.js";

describe("factory device routing credential", () => {
  it("binds a server-issued credential to one factory, channel and device", () => {
    const token = runWithFactory({ tenant_id: "company-a", factory_id: "site-one" }, () => issueFactoryDeviceToken("weighbridge", "SCALE-1"));
    expect(resolveFactoryDeviceToken(token, "weighbridge")).toMatchObject({ tenant_id: "company-a", factory_id: "site-one", deviceCode: "SCALE-1" });
    expect(resolveFactoryDeviceToken(token, "ccp-sensors")).toBeNull();
    expect(resolveFactoryDeviceToken(`${token}tampered`, "weighbridge")).toBeNull();
  });
  it("rejects a user session or a factory id supplied without a device credential", () => {
    expect(resolveFactoryDeviceToken("company-a", "weighbridge")).toBeNull();
    const token = jwt.sign({ tenant_id: "company-a", factory_id: "site-one" }, env.jwtSecret);
    expect(resolveFactoryDeviceToken(token, "weighbridge")).toBeNull();
  });
});
