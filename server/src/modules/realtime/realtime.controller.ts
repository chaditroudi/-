import { Controller, Get, Req, Res } from "@nestjs/common";

import { decodeAuthToken } from "../../middleware/auth.js";
import {
  addRealtimeClient,
  createRealtimeClientId,
  getRealtimeClientCount,
  removeRealtimeClient,
} from "./realtime.bus.js";

const readRealtimeToken = (req: any) => {
  const queryToken = typeof req.query?.token === "string" ? req.query.token : "";
  if (queryToken) return queryToken;
  const header = String(req.headers?.authorization || "");
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
};

@Controller("api/realtime")
export class RealtimeController {
  @Get("events")
  events(@Req() req: any, @Res() res: any) {
    const auth = decodeAuthToken(readRealtimeToken(req));
    if (!auth?.user?.id) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "A valid realtime token is required." } });
      return;
    }

    const clientId = createRealtimeClientId();

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const write = (eventName: string, payload: unknown) => {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    addRealtimeClient({ id: clientId, userId: auth.user.id, write, end: () => res.end() });

    write("connected", {
      clientId,
      connectedClients: getRealtimeClientCount(),
      at: new Date().toISOString(),
    });

    const heartbeat = setInterval(() => {
      write("ping", { at: new Date().toISOString(), connectedClients: getRealtimeClientCount() });
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      removeRealtimeClient(clientId);
    });
  }
}
