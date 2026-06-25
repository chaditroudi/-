var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Controller, Get, Req, Res } from "@nestjs/common";
import { decodeAuthToken } from "../../middleware/auth.js";
import { addRealtimeClient, createRealtimeClientId, getRealtimeClientCount, removeRealtimeClient, } from "./realtime.bus.js";
const readRealtimeToken = (req) => {
    const queryToken = typeof req.query?.token === "string" ? req.query.token : "";
    if (queryToken)
        return queryToken;
    const header = String(req.headers?.authorization || "");
    return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
};
let RealtimeController = class RealtimeController {
    events(req, res) {
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
        const write = (eventName, payload) => {
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
};
__decorate([
    Get("events"),
    __param(0, Req()),
    __param(1, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], RealtimeController.prototype, "events", null);
RealtimeController = __decorate([
    Controller("api/realtime")
], RealtimeController);
export { RealtimeController };
