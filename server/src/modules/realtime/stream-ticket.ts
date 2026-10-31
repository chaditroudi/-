import { randomBytes } from "node:crypto";

/**
 * EventSource cannot send headers, and a session token in a URL ends up in proxy and
 * access logs. So a signed-in client swaps its token for one of these: single use and
 * gone in seconds. Held in memory, like the stream itself, so a restart only forces a
 * reconnect. Running several API instances would need sticky routing for both.
 */

export const STREAM_TICKET_TTL_MS = 30_000;
const MAX_OPEN_TICKETS = 5_000;

type Ticket<T> = { auth: T; expiresAt: number };

export const createTicketStore = <T>(now: () => number = Date.now) => {
  const tickets = new Map<string, Ticket<T>>();

  const prune = () => {
    const at = now();
    for (const [key, ticket] of tickets) {
      if (ticket.expiresAt <= at) tickets.delete(key);
    }
  };

  return {
    issue(auth: T) {
      prune();
      if (tickets.size >= MAX_OPEN_TICKETS) throw new Error("Too many open realtime tickets.");
      const ticket = randomBytes(32).toString("base64url");
      tickets.set(ticket, { auth, expiresAt: now() + STREAM_TICKET_TTL_MS });
      return ticket;
    },
    /** A ticket works once. The lookup removes it, whether or not it is still valid. */
    redeem(ticket: string): T | null {
      const found = tickets.get(ticket);
      if (!found) return null;
      tickets.delete(ticket);
      return found.expiresAt > now() ? found.auth : null;
    },
    size: () => tickets.size,
  };
};
