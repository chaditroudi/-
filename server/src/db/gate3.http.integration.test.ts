// @vitest-environment node
/** Real HTTP + real local replica set; never loads or seeds a deployed factory. Build server first. */
import "reflect-metadata";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthUserModel } from "../models/auth-user.model.js";
import { getCollectionModel } from "./dynamic-model.js";
import { factoryConnection, runWithFactory } from "./factory-context.js";
import { ensureTrustIndexes } from "./indexes.js";
import { consumeStockLotKg } from "../modules/stock/stock-quantity.js";
import { findDepartmentManagers } from "../modules/org/membership.js";
import { SiteSettingsModel } from "../models/site-settings.model.js";
import { signReading } from "../modules/weighbridge/weighbridge-signature.js";

const uri = process.env.GATE3_IT_MONGO_URI;
const DB = "gate3_security_it";
const PASSWORD = "Local-gate3-password-1";
const A = { tenant_id: "factory-company-a", factory_id: "site-one" };
const B = { tenant_id: "factory-company-b", factory_id: "site-one" };
const C = { tenant_id: "factory-company-a", factory_id: "site-two" };
const D = { tenant_id: "factory-company-a", factory_id: "broken-index" };
const tokens: Record<string, string> = {};
let app: any;
let base = "";
const streams: AbortController[] = [];
const scoped = <T>(scope: typeof A, work: () => T) => runWithFactory(scope, work);
const model = (name: string) => getCollectionModel(name);
const http = async (method: string, path: string, actor?: string, body?: unknown) => {
  const response = await fetch(`${base}/api${path}`, { method,
    headers: { "Content-Type": "application/json", ...(actor ? { Authorization: `Bearer ${tokens[actor]}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json() as any;
  return { status: response.status, data: payload.data, code: payload.error?.code };
};

const openStream = async (actor: string) => {
  const ticket = (await http("POST", "/realtime/ticket", actor)).data.ticket;
  const abort = new AbortController();
  streams.push(abort);
  const response = await fetch(`${base}/api/realtime/events?ticket=${ticket}`, { signal: abort.signal });
  expect(response.status).toBe(200);
  const events: Array<{ name: string; data: any }> = [];
  let closed = false;
  const reading = (async () => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        buffer += decoder.decode(result.value, { stream: true });
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const name = /^event: (.+)$/m.exec(frame)?.[1];
          const data = /^data: (.+)$/m.exec(frame)?.[1];
          if (name && data) events.push({ name, data: JSON.parse(data) });
        }
      }
    } catch (error) { if (!abort.signal.aborted) throw error; }
    finally { closed = true; }
  })();
  await vi.waitFor(() => expect(events.some((event) => event.name === "connected")).toBe(true));
  return { events, reading, abort, isClosed: () => closed };
};

describe.skipIf(!uri)("Gate 3 two-factory HTTP and database isolation", () => {
  beforeAll(async () => {
    if (process.env.APP_ENV !== "test" || !/^mongodb:\/\/127\.0\.0\.1:27431\//.test(uri!)) throw Error("Disposable local Gate 3 replica set required");
    process.env.MONGODB_URI = uri;
    process.env.MONGODB_DB_NAME = DB;
    const compiled = "../../../server-dist";
    const { connectToDatabase } = await import(/* @vite-ignore */ `${compiled}/db/mongoose.js`);
    await connectToDatabase();
    expect(mongoose.connection.name).toBe(DB);
    await mongoose.connection.dropDatabase();
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const now = new Date().toISOString();
    for (const [key, scope] of [["a", A], ["b", B], ["c", C]] as const) {
      await AuthUserModel.create({ id: key, email: `${key}@gate3.test`, ...scope, passwordHash, is_active: true,
        user_metadata: { roles: ["administrateur_systeme"], role: "administrateur_systeme", departments: ["stock"], org_roles: ["department_manager"] }, created_at: now, updated_at: now });
      await scoped(scope, async () => {
        await factoryConnection().dropDatabase();
        await ensureTrustIndexes(factoryConnection().db, true);
        await model("suppliers").create({ id: `supplier-${key}`, code: "SUP-SAME", name: `Supplier ${key}`, is_active: true });
        await model("customers").create({ id: `customer-${key}`, code: "CUS-SAME", name: `Customer ${key}`, is_active: true });
        await model("stock_lots").create({ id: `stock-${key}`, lot_number: "LOT-SAME", category: "MP", current_quantity: 100, initial_quantity: 100, status: "VALIDATED", cost_tnd_per_kg: 17 });
        await model("receptions_v2").create({ id: `reception-${key}`, reception_number: "REC-SAME", status: "EN_ATTENTE_QC", supplier_id: `supplier-${key}`, purchase_cost_tnd: 1700 });
        await model("purchase_orders").create({ id: `purchase-${key}`, order_number: "PO-SAME", supplier_id: `supplier-${key}`, subtotal: 1000, total_amount: 1190, tax_amount: 190 });
        await model("qc_inspections").create({ id: `qc-${key}`, reception_id: `reception-${key}`, lab_sample_required: true });
        await model("production_orders").create({ id: `production-${key}`, order_number: "OF-SAME", status: "DRAFT" });
        await model("cleaning_cycles").create({ id: `cleaning-${key}`, cycle_number: "CLEAN-SAME", status: "EN_COURS" });
        await model("document_prints").create({ id: `document-${key}`, source_id: `reception-${key}`, document_type: "RECEPTION", content: `Private document ${key}` });
        await model("system_audit_logs").create({ id: `audit-${key}`, action: "OWN", message: `Private audit ${key}`, created_at: now });
        await model("site_settings").create({ id: "global", company_name: `Company ${key}`, plant_name: `Plant ${key}`, operations: { shift_model: key === "a" ? "2x8" : "3x8" }, costing: { labour_rate_tnd_per_hour: key === "a" ? 7 : 12 } });
      });
    }
    await AuthUserModel.create({ id: "operator", email: "operator@gate3.test", ...A, passwordHash, is_active: true, user_metadata: { roles: ["operateur_reception"] }, created_at: now, updated_at: now });
    const { createApp } = await import(/* @vite-ignore */ `${compiled}/app.js`);
    app = await createApp();
    await app.listen(0, "127.0.0.1");
    base = await app.getUrl();
    for (const actor of ["a", "b", "c", "operator"]) {
      const login = await http("POST", "/auth/signin", undefined, { email: `${actor}@gate3.test`, password: PASSWORD });
      expect(login.status).toBe(201);
      tokens[actor] = login.data.access_token;
    }
  }, 120_000);

  afterAll(async () => {
    streams.forEach((stream) => stream.abort());
    await app?.close();
    if (mongoose.connection.name === DB && mongoose.connection.readyState === 1) {
      for (const scope of [A, B, C, D]) await scoped(scope, () => factoryConnection().dropDatabase());
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  }, 30_000);

  it("keeps stock private across companies and sites, including direct object references", async () => {
    expect((await http("GET", "/stock/lots", "a")).data.map((row: any) => row.id)).toEqual(["stock-a"]);
    expect((await http("GET", "/stock/lots", "b")).data.map((row: any) => row.id)).toEqual(["stock-b"]);
    expect((await http("GET", "/stock/lots", "c")).data.map((row: any) => row.id)).toEqual(["stock-c"]);
    await expect(scoped(A, () => consumeStockLotKg("stock-b", 10, new Date().toISOString()))).rejects.toMatchObject({ code: "STOCK_LOT_NOT_FOUND" });
    expect((await http("POST", "/stock/adjustments", "a", { stock_lot_id: "stock-b", delta_kg: -10, reason: "foreign attempt" })).status).toBe(404);
    expect(await scoped(B, async () => (await model("stock_lots").findOne({ id: "stock-b" }).lean()).current_quantity)).toBe(100);
  });

  it("keeps supplier/customer lists and direct updates within the signed factory", async () => {
    expect((await http("GET", "/suppliers", "a")).data.map((row: any) => row.id)).toEqual(["supplier-a"]);
    expect((await http("GET", "/customers", "a")).data.map((row: any) => row.id)).toEqual(["customer-a"]);
    expect((await http("GET", "/customers/customer-b", "a")).data).toBeNull();
    await http("PATCH", "/customers/customer-b", "a", { name: "INTRUSION", tenant_id: B.tenant_id, factory_id: B.factory_id });
    expect((await http("GET", "/customers/customer-b", "b")).data.name).toBe("Customer b");
  });

  it("isolates documents, lab/production records, traceability and dashboard aggregates", async () => {
    expect((await http("GET", "/document-prints?source_id=reception-b", "a")).data).toEqual([]);
    expect((await http("GET", "/document-prints?source_id=reception-b", "b")).data[0].content).toBe("Private document b");
    expect((await http("GET", "/qc-lab-results", "a")).data.map((row: any) => row.id)).toEqual(["qc-a"]);
    const foreign = await http("POST", "/qc-inspections/qc-b/lab-results", "a", { lab_result: "INTRUSION" });
    expect(foreign.status).toBeGreaterThanOrEqual(400);
    expect((await http("GET", "/production/orders", "a")).data.map((row: any) => row.id)).toEqual(["production-a"]);
    const clean = await http("GET", "/phase2/cleaning/cycles/cleaning-b", "a");
    expect(clean.status).toBe(404);
    const dashboard = await http("GET", "/stock/summary", "a");
    expect(dashboard.status).toBe(200);
    expect(JSON.stringify(dashboard.data)).not.toContain("stock-b");
    expect((await http("GET", "/trust/lots/foreign/passport")).status).toBe(401);
  });

  it("retains independent factory settings and exposes no factory configuration before login", async () => {
    const a = (await http("GET", "/settings", "a")).data;
    const b = (await http("GET", "/settings", "b")).data;
    expect(a.company_name).toBe("Company a");
    expect(b.company_name).toBe("Company b");
    expect(a.operations.shift_model).toBe("2x8");
    expect(b.operations.shift_model).toBe("3x8");
    const anonymous = (await http("GET", "/settings")).data;
    expect(anonymous.company_name).toBe("Date Harvest Hub");
    expect(anonymous).not.toHaveProperty("costing");
    expect(anonymous).not.toHaveProperty("p2p");
  });

  it("uses the canonical factory settings schema regardless of first reader and initializes once under concurrency", async () => {
    const boundModel = scoped(C, () => model("site_settings"));
    expect(boundModel.schema.path("costing.labour_rate_tnd_per_hour")).toBeDefined();
    await scoped(C, async () => {
      model("site_settings"); // Generic configuration readers may be the first caller.
      expect(SiteSettingsModel.schema.path("costing.labour_rate_tnd_per_hour")).toBeDefined();
      await model("site_settings").deleteMany({ id: "global" });
    });
    const settings = await Promise.all(Array.from({ length: 8 }, () => http("GET", "/settings", "c")));
    expect(settings.every((response) => response.status === 200)).toBe(true);
    expect(await scoped(C, () => model("site_settings").countDocuments({ id: "global" }))).toBe(1);
  });

  it("withholds prices and management configuration from reception workers", async () => {
    const reception = (await http("GET", "/receptions", "operator")).data[0];
    expect(reception).not.toHaveProperty("purchase_cost_tnd");
    expect((await http("GET", "/settings", "operator")).data).not.toHaveProperty("costing");
    expect((await http("GET", "/costing/summary", "operator")).status).toBe(403);
    const purchase = (await http("GET", "/purchasing/orders", "operator")).data[0];
    expect(purchase).not.toHaveProperty("subtotal");
    expect(purchase).not.toHaveProperty("total_amount");
    expect(purchase).not.toHaveProperty("tax_amount");
  });

  it("scopes account administration and workflow approvers", async () => {
    expect((await http("GET", "/settings/users", "a")).data.map((row: any) => row.id).sort()).toEqual(["a", "operator"]);
    expect((await http("PATCH", "/settings/users/b", "a", { is_active: false, signature_pin: "1234" })).status).toBe(404);
    expect((await AuthUserModel.findOne({ id: "b" }).lean()).is_active).toBe(true);
    expect((await scoped(A, () => findDepartmentManagers("stock"))).map((row) => row.userId)).toEqual(["a"]);
  });

  it("preserves concurrent CAS and identical idempotency/business references independently", async () => {
    const results = await Promise.allSettled([
      scoped(A, () => consumeStockLotKg("stock-a", 60, new Date().toISOString())),
      scoped(A, () => consumeStockLotKg("stock-a", 60, new Date().toISOString())),
      scoped(B, () => consumeStockLotKg("stock-b", 30, new Date().toISOString())),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    expect(await scoped(A, async () => (await model("stock_lots").findOne({ id: "stock-a" }).lean()).current_quantity)).toBe(40);
    expect(await scoped(B, async () => (await model("stock_lots").findOne({ id: "stock-b" }).lean()).current_quantity)).toBe(70);
    for (const scope of [A, B]) await scoped(scope, () => model("idempotency_commands").create({ scope: "packaging", key: "SAME-REQUEST", status: "COMPLETED" }));
    await expect(scoped(A, () => model("idempotency_commands").create({ scope: "packaging", key: "SAME-REQUEST" }))).rejects.toMatchObject({ code: 11000 });
  });

  it("keeps MongoDB lookups and deferred jobs inside their captured factory", async () => {
    const results = await Promise.all([A, B].map((scope) => scoped(scope, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return model("receptions_v2").aggregate([{ $lookup: { from: "suppliers", localField: "supplier_id", foreignField: "id", as: "supplier" } }]);
    })));
    expect(results[0][0].supplier[0].name).toBe("Supplier a");
    expect(results[1][0].supplier[0].name).toBe("Supplier b");
    expect(() => model("stock_lots")).toThrow();
  });

  it("fails closed when required factory indexes cannot be initialized", async () => {
    const user = await AuthUserModel.findOne({ id: "a" }).lean();
    await AuthUserModel.create({ ...user, _id: undefined, id: "broken", email: "broken@gate3.test", ...D });
    await scoped(D, async () => {
      await factoryConnection().dropDatabase();
      await factoryConnection().db!.collection("site_settings").createIndex({ id: 1 }, { unique: false, name: "id_1" });
    });
    const login = await http("POST", "/auth/signin", undefined, { email: "broken@gate3.test", password: PASSWORD });
    tokens.broken = login.data.access_token;
    expect(await http("GET", "/stock/lots", "broken")).toMatchObject({ status: 503, code: "FACTORY_DATABASE_UNAVAILABLE" });
  });

  it("authenticates actual device ingestion within its signed factory and device channel", async () => {
    const credentials: Record<string, string> = {};
    for (const actor of ["a", "b"]) {
      const registered = await http("POST", "/weighbridge/devices", actor, { device_code: "SAME-SCALE", secret: `private-device-${actor}`, protocol: "HTTP_PUSH", status: "ACTIVE", calibration_valid_until: "2030-01-01T00:00:00Z" });
      expect(registered.status).toBe(201);
      credentials[actor] = registered.data.factory_token;
    }
    const reading = { readingId: "SAME-READING", deviceCode: "SAME-SCALE", capturedAt: new Date().toISOString(), weightKg: 123, unit: "kg", stable: true, direction: "GROSS" as const };
    const ingest = async (credential: string, secret: string, path = "/weighbridge/readings", payload = reading) => fetch(`${base}/api${path}`, { method: "POST",
      headers: { "Content-Type": "application/json", "x-factory-device-token": credential, "x-weighbridge-signature": signReading(payload, secret) }, body: JSON.stringify(payload) });
    expect((await ingest(credentials.a, "private-device-a")).status).toBe(201);
    expect((await ingest(credentials.b, "private-device-a")).status).toBe(401);
    expect((await ingest(credentials.a, "private-device-a", "/ccp-sensors/readings")).status).toBe(401);
    expect((await ingest(`${credentials.a}forged`, "private-device-a")).status).toBe(401);
    expect((await ingest(credentials.a, "private-device-a", "/weighbridge/readings", { ...reading, deviceCode: "OTHER" })).status).toBe(401);
    expect((await ingest(credentials.b, "private-device-b")).status).toBe(201);
    expect(await scoped(A, () => model("weighbridge_readings").countDocuments({}))).toBe(1);
    expect(await scoped(B, () => model("weighbridge_readings").countDocuments({}))).toBe(1);
  });

  it("rolls back useDb writes and suppresses SSE on a real transaction failure", async () => {
    const stream = await openStream("a");
    const compiled = "../../../server-dist";
    const { runWithFactory: runCompiled } = await import(/* @vite-ignore */ `${compiled}/db/factory-context.js`);
    const { getCollectionModel: compiledModel } = await import(/* @vite-ignore */ `${compiled}/db/dynamic-model.js`);
    const { runInTransaction } = await import(/* @vite-ignore */ `${compiled}/db/transaction.js`);
    const { publishRealtimeDbChange } = await import(/* @vite-ignore */ `${compiled}/modules/realtime/realtime.bus.js`);
    await expect(runCompiled(A, () => runInTransaction(async () => {
      await compiledModel("stock_lots").create([{ id: "rolled-back", current_quantity: 10 }]);
      publishRealtimeDbChange({ table: "stock_lots", action: "INSERT", rowIds: ["rolled-back"] });
      throw Error("forced transaction failure");
    }))).rejects.toThrow("forced transaction failure");
    await runCompiled(A, () => runInTransaction(async () => {
      await compiledModel("stock_lots").create([{ id: "committed", current_quantity: 10 }]);
      publishRealtimeDbChange({ table: "stock_lots", action: "INSERT", rowIds: ["committed"] });
    }));
    await vi.waitFor(() => expect(stream.events.some((event) => event.data.rowIds?.includes("committed"))).toBe(true));
    expect(stream.events.some((event) => event.data.rowIds?.includes("rolled-back"))).toBe(false);
    expect(await scoped(A, () => model("stock_lots").countDocuments({ id: "rolled-back" }))).toBe(0);
    expect(await scoped(A, () => model("stock_lots").countDocuments({ id: "committed" }))).toBe(1);
    expect(await scoped(B, () => model("stock_lots").countDocuments({ id: "committed" }))).toBe(0);
    stream.abort.abort(); await stream.reading;
  });

  it("isolates real SSE streams and counts, revalidates tickets and revokes open sessions", async () => {
    const a = await openStream("a");
    const b = await openStream("b");
    expect(b.events[0].data.connectedClients).toBe(1);
    const create = await http("POST", "/stock/products", "a", { code: "EVENT-A", name: "Event product A", unit: "kg" });
    expect(create.status).toBe(201);
    await vi.waitFor(() => expect(a.events.some((event) => event.name === "db-change" && event.data.rowIds.includes(create.data.id))).toBe(true), { timeout: 3000 });
    expect(b.events.filter((event) => event.name === "db-change")).toEqual([]);
    expect(JSON.stringify(a.events)).not.toContain("cost_tnd_per_kg");
    const issued = (await http("POST", "/realtime/ticket", "a")).data.ticket;
    await http("POST", "/auth/logout", "a");
    expect((await fetch(`${base}/api/realtime/events?ticket=${issued}`)).status).toBe(401);
    // Enqueue a change with the captured scope, as a worker would do after the user's logout.
    const compiled = "../../../server-dist";
    const { runWithFactory: runCompiled } = await import(/* @vite-ignore */ `${compiled}/db/factory-context.js`);
    const { publishRealtimeDbChange } = await import(/* @vite-ignore */ `${compiled}/modules/realtime/realtime.bus.js`);
    runCompiled(A, () => publishRealtimeDbChange({ table: "stock_lots", action: "UPDATE", rowIds: ["after-logout"] }));
    await vi.waitFor(() => expect(a.isClosed()).toBe(true), { timeout: 3000 });
    expect(a.events.some((event) => event.data.rowIds?.includes("after-logout"))).toBe(false);
    a.abort.abort(); b.abort.abort();
    await Promise.all([a.reading, b.reading]);
    tokens.a = (await http("POST", "/auth/signin", undefined, { email: "a@gate3.test", password: PASSWORD })).data.access_token;
  });

  it("revokes old HTTP sessions immediately on role and membership changes", async () => {
    const changed = await http("PATCH", "/settings/users/operator", "a", { roles: ["operateur_conditionnement"] });
    expect(changed.status).toBe(200);
    expect((await http("GET", "/receptions", "operator")).status).toBe(401);
    const user = await AuthUserModel.findOne({ id: "operator" }).lean();
    expect(user.user_metadata.role).toBe("operateur_conditionnement");
    await AuthUserModel.updateOne({ id: "c" }, { $set: { factory_id: "moved-site" } });
    expect((await http("GET", "/stock/lots", "c")).status).toBe(401);
  });
});
