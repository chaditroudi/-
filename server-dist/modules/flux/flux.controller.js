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
var _a, _b, _c, _d;
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { notFound } from "../../core/app-error.js";
let FluxController = class FluxController {
    // ── Flux Production Runs ──────────────────────────────────────────────────────
    async listRuns(fluxCode, status, since, limit, orderId) {
        const filter = {};
        if (fluxCode)
            filter.flux_code = fluxCode;
        if (status)
            filter.status = status;
        if (since)
            filter.started_at = { $gte: since };
        if (orderId)
            filter.order_id = orderId;
        const query = getCollectionModel("flux_runs")
            .find(filter)
            .sort({ started_at: -1 });
        if (limit)
            query.limit(Number(limit));
        const raw = await query.lean().exec();
        return { data: sanitizeDocument(raw) };
    }
    async createRun(body) {
        const doc = await prepareInsertDocument("flux_runs", body);
        await getCollectionModel("flux_runs").create([doc]);
        return { data: sanitizeDocument(doc) };
    }
    async updateRun(id, body) {
        const now = new Date().toISOString();
        const update = { ...body, updated_at: now };
        delete update.id;
        delete update.created_at;
        const raw = await getCollectionModel("flux_runs")
            .findOneAndUpdate({ id }, { $set: update }, { returnDocument: "after" })
            .lean()
            .exec();
        if (!raw)
            throw notFound("FLUX_RUN_NOT_FOUND", `Flux run ${id} not found`);
        return { data: sanitizeDocument(raw) };
    }
    async deleteRun(id) {
        const raw = await getCollectionModel("flux_runs")
            .findOneAndDelete({ id })
            .lean()
            .exec();
        if (!raw)
            throw notFound("FLUX_RUN_NOT_FOUND", `Flux run ${id} not found`);
        return { data: sanitizeDocument(raw) };
    }
    // ── HACCP States ──────────────────────────────────────────────────────────────
    async listHaccpStates() {
        const raw = await getCollectionModel("haccp_states")
            .find()
            .sort({ ccp_code: 1 })
            .lean()
            .exec();
        return { data: sanitizeDocument(raw) };
    }
    async upsertHaccpState(body) {
        const ccpCode = body.ccp_code;
        if (ccpCode) {
            const existing = await getCollectionModel("haccp_states")
                .findOne({ ccp_code: ccpCode })
                .lean()
                .exec();
            if (existing) {
                const now = new Date().toISOString();
                const update = { ...body, updated_at: now };
                delete update.id;
                delete update.created_at;
                const updated = await getCollectionModel("haccp_states")
                    .findOneAndUpdate({ ccp_code: ccpCode }, { $set: update }, { returnDocument: "after" })
                    .lean()
                    .exec();
                return { data: sanitizeDocument(updated) };
            }
        }
        const doc = await prepareInsertDocument("haccp_states", body);
        await getCollectionModel("haccp_states").create([doc]);
        return { data: sanitizeDocument(doc) };
    }
    async updateHaccpState(id, body) {
        const now = new Date().toISOString();
        const update = { ...body, updated_at: now };
        delete update.id;
        delete update.created_at;
        const raw = await getCollectionModel("haccp_states")
            .findOneAndUpdate({ id }, { $set: update }, { returnDocument: "after" })
            .lean()
            .exec();
        if (!raw)
            throw notFound("HACCP_STATE_NOT_FOUND", `HACCP state ${id} not found`);
        return { data: sanitizeDocument(raw) };
    }
};
__decorate([
    Get("runs"),
    __param(0, Query("flux_code")),
    __param(1, Query("status")),
    __param(2, Query("since")),
    __param(3, Query("limit")),
    __param(4, Query("order_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], FluxController.prototype, "listRuns", null);
__decorate([
    Post("runs"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_a = typeof Record !== "undefined" && Record) === "function" ? _a : Object]),
    __metadata("design:returntype", Promise)
], FluxController.prototype, "createRun", null);
__decorate([
    Patch("runs/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_b = typeof Record !== "undefined" && Record) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], FluxController.prototype, "updateRun", null);
__decorate([
    Delete("runs/:id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FluxController.prototype, "deleteRun", null);
__decorate([
    Get("haccp-states"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FluxController.prototype, "listHaccpStates", null);
__decorate([
    Post("haccp-states"),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_c = typeof Record !== "undefined" && Record) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], FluxController.prototype, "upsertHaccpState", null);
__decorate([
    Patch("haccp-states/:id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_d = typeof Record !== "undefined" && Record) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], FluxController.prototype, "updateHaccpState", null);
FluxController = __decorate([
    Controller("api/flux"),
    UseGuards(RequireAuthGuard)
], FluxController);
export { FluxController };
