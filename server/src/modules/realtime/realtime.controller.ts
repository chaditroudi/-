import { Controller, Get, Post, Req, Res } from "@nestjs/common";

import { normalizeRolesFromMetadata, notificationSeesAll } from "../../middleware/authorization.js";
import { Authenticated, Public } from "../../nest/route-metadata.js";
import {
  addRealtimeClient,
  createRealtimeClientId,
  getRealtimeClientCount,
  removeRealtimeClient,
} from "./realtime.bus.js";
import { createTicketStore, STREAM_TICKET_TTL_MS } from "./stream-ticket.js";

/** Closes every stream in time, so a removed account or changed role cannot listen on. */
const STREAM_MAX_AGE_MS = 15 * 60_000;

const tickets = createTicketStore<any>();

@Controller("api/realtime")
export class RealtimeController {
  @Post("ticket")
  @Authenticated()
  ticket(@Req() req: any) {
    return { data: { ticket: tickets.issue(req.auth), expires_in_ms: STREAM_TICKET_TTL_MS } };
  }

  @Get("events")
  @Public()
  events(@Req() req: any, @Res() res: any) {
    const ticket = typeof req.query?.ticket === "string" ? req.query.ticket : "";
    const auth = ticket ? tickets.redeem(ticket) : null;
    if (!auth?.user?.id) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "A valid realtime ticket is required." } });
      return;
    }

    const clientId = createRealtimeClientId();
    const roles = normalizeRolesFromMetadata(auth.user.user_metadata);
    const seesAll = notificationSeesAll(roles);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const write = (eventName: string, payload: unknown) => {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    addRealtimeClient({ id: clientId, userId: auth.user.id, roles, seesAll, write, end: () => res.end() });

    write("connected", {
      clientId,
      connectedClients: getRealtimeClientCount(),
      at: new Date().toISOString(),
    });

    const heartbeat = setInterval(() => {
      write("ping", { at: new Date().toISOString(), connectedClients: getRealtimeClientCount() });
    }, 25000);

    // The client reconnects with a new ticket, which proves the session is still good.
    const expiry = setTimeout(() => res.end(), STREAM_MAX_AGE_MS);

    req.on("close", () => {
      clearInterval(heartbeat);
      clearTimeout(expiry);
      removeRealtimeClient(clientId);
    });
  }
}
