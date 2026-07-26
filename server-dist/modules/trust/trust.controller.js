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
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { Public } from "../../nest/route-metadata.js";
import { LotLedgerService } from "./lot-ledger.service.js";
import { LotLifecycleService } from "./lot-lifecycle.service.js";
import { LotPassportService } from "./lot-passport.service.js";
import { LotRecallService } from "./lot-recall.service.js";
import { ScanService } from "./scan.service.js";
import { APPEND_ONLY_COLLECTIONS, CORE_SCHEMA_COLLECTIONS, REGULATED_COLLECTIONS, } from "./regulated-collections.js";
import { GOLDEN_THREAD_STAGES } from "./lot-state-machine.js";
let TrustController = class TrustController {
    ledger;
    lifecycle;
    passport;
    recall;
    scans;
    constructor(ledger, lifecycle, passport, recall, scans) {
        this.ledger = ledger;
        this.lifecycle = lifecycle;
        this.passport = passport;
        this.recall = recall;
        this.scans = scans;
    }
    health() {
        return {
            data: {
                wave: "W2",
                trust: "enabled",
                goldenThread: "PREMIUM_WHOLE",
                passport: "enabled",
                recallDrill: "enabled",
                stages: GOLDEN_THREAD_STAGES,
                coreSchemaCollections: CORE_SCHEMA_COLLECTIONS,
                regulatedCount: REGULATED_COLLECTIONS.size,
                appendOnlyCount: APPEND_ONLY_COLLECTIONS.size,
            },
        };
    }
    async getPassport(lotId) {
        const data = await this.passport.buildPassport(lotId);
        return { data };
    }
    async runRecall(body) {
        const data = await this.recall.runDrill(body || {});
        return { data };
    }
    async resolveScan(body, req) {
        const data = await this.scans.resolve({
            ...body,
            actorId: String(req.auth?.user?.id || ""),
        });
        return { data };
    }
    async getChain(lotId) {
        const events = await this.ledger.getChain(lotId);
        return { data: { lotId, events } };
    }
    async verify(lotId) {
        const result = await this.ledger.verify(lotId);
        return { data: result };
    }
    async getState(lotId, route) {
        const data = await this.lifecycle.getState(lotId, route === "GENERIC" ? "GENERIC" : "PREMIUM_WHOLE");
        return { data };
    }
    async advance(lotId, body, req) {
        const toStage = body?.toStage;
        if (!toStage) {
            return {
                error: { code: "STAGE_REQUIRED", message: "toStage is required." },
            };
        }
        const data = await this.lifecycle.recordStage({
            lotId,
            toStage,
            collection: body.collection || "trust_advance",
            actorId: req.auth?.user?.id || null,
            payload: body.payload,
            relatedIds: body.relatedIds,
            route: body.route || "PREMIUM_WHOLE",
        });
        return { data };
    }
    async goldenThread(limit) {
        const states = await this.lifecycle.listGoldenThreadLots(Number(limit) || 40);
        const complete = states.filter((row) => row.goldenThreadComplete).length;
        const broken = states.filter((row) => !row.valid).length;
        return {
            data: {
                route: "PREMIUM_WHOLE",
                stages: GOLDEN_THREAD_STAGES,
                totalTracked: states.length,
                complete,
                broken,
                inProgress: states.length - complete,
                lots: states,
            },
        };
    }
};
__decorate([
    Get("health"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TrustController.prototype, "health", null);
__decorate([
    Public(),
    Get("lots/:lotId/passport"),
    __param(0, Param("lotId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TrustController.prototype, "getPassport", null);
__decorate([
    Post("recall"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TrustController.prototype, "runRecall", null);
__decorate([
    Post("scan/resolve"),
    __param(0, Body()),
    __param(1, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TrustController.prototype, "resolveScan", null);
__decorate([
    Get("lots/:lotId/chain"),
    __param(0, Param("lotId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TrustController.prototype, "getChain", null);
__decorate([
    Get("lots/:lotId/verify"),
    __param(0, Param("lotId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TrustController.prototype, "verify", null);
__decorate([
    Get("lots/:lotId/state"),
    __param(0, Param("lotId")),
    __param(1, Query("route")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TrustController.prototype, "getState", null);
__decorate([
    Post("lots/:lotId/advance"),
    __param(0, Param("lotId")),
    __param(1, Body()),
    __param(2, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], TrustController.prototype, "advance", null);
__decorate([
    Get("golden-thread"),
    __param(0, Query("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TrustController.prototype, "goldenThread", null);
TrustController = __decorate([
    Controller("api/trust"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [LotLedgerService,
        LotLifecycleService,
        LotPassportService,
        LotRecallService,
        ScanService])
], TrustController);
export { TrustController };
