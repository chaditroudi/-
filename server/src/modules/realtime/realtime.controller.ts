import { Controller, Get, Req, Res } from "@nestjs/common";

import { normalizeRolesFromMetadata, notificationSeesAll } from "../../middleware/authorization.js";
import { Public } from "../../nest/route-metadata.js";
import {
  addRealtimeClient,
  createRealtimeClientId,
  getRealtimeClientCount,
  removeRealtimeClient,
} from "./realtime.bus.js";

@Controller("api/realtime")
export class RealtimeController {
  @Get("events")
  @Public()
  events(@Req() req: any, @Res() res: any) {
    const auth = req.auth;
    if (!auth?.user?.id) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "A valid realtime token is required." } });
      return;
    }

    const clientId = createRealtimeClientId();
    const roles = normalizeRolesFromMetadata(auth.user.user_metadata);
    const seesAll = notificationSeesAll(roles);

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

    addRealtimeClient({ id: clientId, userId: auth.user.id, roles, seesAll, write, end: () => res.end() });

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
