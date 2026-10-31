import { describe, expect, it } from "vitest";

import { createTicketStore, STREAM_TICKET_TTL_MS } from "./stream-ticket.js";

describe("realtime stream tickets", () => {
  it("returns the session a ticket was issued for", () => {
    const store = createTicketStore<{ id: string }>();
    expect(store.redeem(store.issue({ id: "user-a" }))).toEqual({ id: "user-a" });
  });

  it("works once", () => {
    const store = createTicketStore<string>();
    const ticket = store.issue("user-a");
    expect(store.redeem(ticket)).toBe("user-a");
    expect(store.redeem(ticket)).toBeNull();
  });

  it("expires", () => {
    let clock = 1_000;
    const store = createTicketStore<string>(() => clock);
    const ticket = store.issue("user-a");
    clock += STREAM_TICKET_TTL_MS;
    expect(store.redeem(ticket)).toBeNull();
  });

  it("refuses anything it did not issue", () => {
    const store = createTicketStore<string>();
    store.issue("user-a");
    expect(store.redeem("guess")).toBeNull();
    expect(store.redeem("")).toBeNull();
  });

  it("gives each session its own unguessable ticket", () => {
    const store = createTicketStore<string>();
    const first = store.issue("user-a");
    const second = store.issue("user-b");
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(43);
    expect(store.redeem(second)).toBe("user-b");
    expect(store.redeem(first)).toBe("user-a");
  });

  it("drops expired tickets instead of keeping them forever", () => {
    let clock = 1_000;
    const store = createTicketStore<string>(() => clock);
    store.issue("user-a");
    store.issue("user-b");
    clock += STREAM_TICKET_TTL_MS + 1;
    store.issue("user-c");
    expect(store.size()).toBe(1);
  });
});
