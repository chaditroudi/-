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
import { getDatabaseStatus, isDatabaseConnected } from "../db/mongoose.js";
const buildHealthPayload = () => {
    const database = getDatabaseStatus();
    const ok = isDatabaseConnected();
    return {
        statusCode: ok ? 200 : 503,
        body: {
            ok,
            status: ok ? "ready" : "database_unavailable",
            hint: ok ? undefined : "Add the Docker host public IP to MongoDB Atlas Network Access.",
            database,
        },
    };
};
let AppController = class AppController {
    health(_req, res) {
        const payload = buildHealthPayload();
        res.status(payload.statusCode).json(payload.body);
    }
    apiHealth(_req, res) {
        const payload = buildHealthPayload();
        res.status(payload.statusCode).json(payload.body);
    }
};
__decorate([
    Get("health"),
    __param(0, Req()),
    __param(1, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "health", null);
__decorate([
    Get("api/health"),
    __param(0, Req()),
    __param(1, Res()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "apiHealth", null);
AppController = __decorate([
    Controller()
], AppController);
export { AppController };
