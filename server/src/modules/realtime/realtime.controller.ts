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
import { resolveAuthToken } from "../../middleware/auth.js";
import { sameFactory } from "../../db/factory-context.js";

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
  async events(@Req() req: any, @Res() res: any) {
    const ticket = typeof req.query?.ticket === "string" ? req.query.ticket : "";
    const issued = ticket ? tickets.redeem(ticket) : null;
    const auth = issued ? await resolveAuthToken(issued.token) : null;
    if (!auth?.user?.id || auth.mustChangePassword || !sameFactory(auth.factory, issued?.factory)) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "A valid realtime ticket is required." } });
      return;
    }

    const clientId = createRealtimeClientId();
    const roles = normalizeRolesFromMetadata(auth.user.user_metadata);
    const seesAll = notificationSeesAll(roles);
    const metadata = JSON.stringify(auth.user.user_metadata);
    const authorize = async () => {
      const current = await resolveAuthToken(auth.token);
      return Boolean(current && !current.mustChangePassword && sameFactory(current.factory, auth.factory)
        && JSON.stringify(current.user.user_metadata) === metadata);
    };

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

    addRealtimeClient({ id: clientId, factory: auth.factory, userId: auth.user.id, roles, seesAll, write, authorize, end: () => res.end() });

    write("connected", {
      clientId,
      connectedClients: getRealtimeClientCount(auth.factory),
      at: new Date().toISOString(),
    });

    const heartbeat = setInterval(async () => {
      if (!await authorize()) { res.end(); return; }
      write("ping", { at: new Date().toISOString(), connectedClients: getRealtimeClientCount(auth.factory) });
    }, 25000);

    // The client reconnects with a new ticket, which proves the session is still good.
    const expiry = setTimeout(() => res.end(), STREAM_MAX_AGE_MS);

    res.on("close", () => {
      clearInterval(heartbeat);
      clearTimeout(expiry);
      removeRealtimeClient(clientId);
    });
  }
}
