import { afterEach, describe, expect, it, vi } from "vitest";

import { runInTransaction } from "../../db/transaction.js";
import { addRealtimeClient, closeAllClients, publishRealtimeDbChange } from "./realtime.bus.js";

type Sent = { name: string; payload: Record<string, unknown> };

const listen = (id: string, roles: string[], options: { seesAll?: boolean; userId?: string } = {}) => {
  const sent: Sent[] = [];
  addRealtimeClient({
    id,
    userId: options.userId ?? id,
    roles,
    seesAll: options.seesAll ?? false,
    write: (name, payload) => sent.push({ name, payload: payload as Record<string, unknown> }),
    end: vi.fn(),
  });
  return sent;
};

const event = { type: "stock_lot_updated", table: "stock_lots", action: "UPDATE" as const, rowIds: ["lot-1"] };

afterEach(() => closeAllClients());

describe("realtime delivery", () => {
  it("never sends record contents, whatever a caller passes", () => {
    const operator = listen("op", ["operateur_reception"]);
    const secret = { id: "lot-1", cost_tnd_per_kg: 26.4658, current_quantity: 100 };
    publishRealtimeDbChange({ ...event, rows: [secret], before: [secret] } as never);

    expect(operator).toHaveLength(1);
    expect(operator[0].payload).not.toHaveProperty("rows");
    expect(operator[0].payload).not.toHaveProperty("before");
    expect(JSON.stringify(operator[0].payload)).not.toContain("26.4658");
    expect(operator[0].payload.rowIds).toEqual(["lot-1"]);
  });

  it.each(["fournisseur_externe", "client_externe", "partenaire_client_export", "auditeur_externe"])(
    "tells %s nothing that is not addressed to it",
    (role) => {
      const external = listen("ext", [role]);
      publishRealtimeDbChange(event);
      expect(external).toHaveLength(0);
    },
  );

  it("sends nothing to an account with no role", () => {
    const nobody = listen("none", []);
    publishRealtimeDbChange(event);
    expect(nobody).toHaveLength(0);
  });

  it("keeps staff informed, so screens refresh through the API", () => {
    const warehouse = listen("wms", ["magasinier_wms"]);
    const director = listen("dir", ["directeur_usine"], { seesAll: true });
    publishRealtimeDbChange(event);
    expect(warehouse).toHaveLength(1);
    expect(director).toHaveLength(1);
  });

  it("does not treat a staff role on an external account as an external one", () => {
    const mixed = listen("mix", ["fournisseur_externe", "responsable_achats"]);
    publishRealtimeDbChange(event);
    expect(mixed).toHaveLength(1);
  });

  it("delivers a targeted event only to its audience", () => {
    const buyer = listen("buyer", ["responsable_achats"]);
    const operator = listen("op", ["operateur_reception"]);
    const supplier = listen("sup", ["fournisseur_externe"], { userId: "supplier-user" });
    const director = listen("dir", ["directeur_usine"], { seesAll: true });

    publishRealtimeDbChange({ ...event, targetRoles: ["responsable_achats"], targetUserIds: ["supplier-user"] });

    expect(buyer).toHaveLength(1);
    expect(supplier).toHaveLength(1);
    expect(director).toHaveLength(1);
    expect(operator).toHaveLength(0);
  });

  it("publishes only after a transaction commits", async () => {
    const operator = listen("op", ["operateur_reception"]);
    await runInTransaction(async () => {
      publishRealtimeDbChange(event);
      expect(operator).toHaveLength(0);
    });
    expect(operator).toHaveLength(1);
  });

  it("publishes nothing for a transaction that fails", async () => {
    const operator = listen("op", ["operateur_reception"]);
    await expect(
      runInTransaction(async () => {
        publishRealtimeDbChange(event);
        throw new Error("write failed");
      }),
    ).rejects.toThrow("write failed");
    expect(operator).toHaveLength(0);
  });
});
