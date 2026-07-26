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
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { lotLifecycleService } from "../trust/lot-lifecycle.service.js";
const compactIds = (...values) => values.flat().map((value) => String(value || "")).filter(Boolean);
let BonExpeditionController = class BonExpeditionController {
    cs;
    constructor(cs) {
        this.cs = cs;
    }
    async list(fournisseurId, statut) {
        const filters = [];
        if (fournisseurId)
            filters.push({ type: "eq", column: "fournisseur_id", value: fournisseurId });
        if (statut)
            filters.push({ type: "eq", column: "statut", value: statut });
        const data = await this.cs.query({
            table: "bon_expeditions",
            filters,
            orderBy: { column: "created_at", ascending: false },
        });
        return { data };
    }
    async detail(id) {
        const rows = await this.cs.query({
            table: "bon_expeditions",
            filters: [{ type: "eq", column: "id", value: id }],
            limit: 1,
        });
        return { data: rows[0] ?? null };
    }
    async create(req, body) {
        const data = await this.cs.insert({
            table: "bon_expeditions",
            values: body,
            actorId: req.auth?.user?.id || null,
        });
        await this.maybeRecordShipped(data[0], req.auth?.user?.id || null);
        publishRealtimeDbChange({
            type: "bon_expedition_created",
            table: "bon_expeditions",
            action: "INSERT",
            actorId: req.auth?.user?.id || null,
            rows: [data[0]].filter(Boolean),
            rowIds: compactIds(data[0]?.id),
            relatedTables: ["lot_events", "stock_lots"],
        });
        return { data: data[0] };
    }
    async update(req, id, body) {
        const { after } = await this.cs.update({
            table: "bon_expeditions",
            filters: [{ type: "eq", column: "id", value: id }],
            values: body,
            actorId: req.auth?.user?.id || null,
        });
        await this.maybeRecordShipped(after[0], req.auth?.user?.id || null);
        publishRealtimeDbChange({
            type: "bon_expedition_updated",
            table: "bon_expeditions",
            action: "UPDATE",
            actorId: req.auth?.user?.id || null,
            rows: [after[0]].filter(Boolean),
            rowIds: compactIds(id),
            relatedTables: ["lot_events", "stock_lots"],
        });
        return { data: after[0] };
    }
    async remove(req, id) {
        const data = await this.cs.remove({
            table: "bon_expeditions",
            filters: [{ type: "eq", column: "id", value: id }],
        });
        publishRealtimeDbChange({
            type: "bon_expedition_deleted",
            table: "bon_expeditions",
            action: "DELETE",
            actorId: req.auth?.user?.id || null,
            rows: [data[0]].filter(Boolean),
            rowIds: compactIds(id),
        });
        return { data: data[0] };
    }
    async maybeRecordShipped(doc, actorId) {
        if (!doc)
            return;
        const statut = String(doc.statut || doc.status || "").toUpperCase();
        const closing = ["EXPEDIE", "SHIPPED", "CLOSED", "CLOTURE", "LIVRE", "DELIVERED"].includes(statut);
        if (!closing)
            return;
        const lignes = Array.isArray(doc.lignes) ? doc.lignes : [];
        const lotIds = new Set();
        for (const ligne of lignes) {
            const row = (ligne || {});
            const resolved = await lotLifecycleService.resolveReceptionLotId({
                lotId: String(row.lot_id || row.reception_lot_id || "") || null,
                lotNumber: String(row.lot_number || row.lot_internal || "") || null,
            });
            if (resolved)
                lotIds.add(resolved);
        }
        for (const lotId of Array.from(lotIds)) {
            await lotLifecycleService.recordStageSafe({
                lotId,
                toStage: "SHIPPED",
                collection: "bon_expeditions",
                actorId,
                payload: {
                    bon_id: doc.id ?? null,
                    numero_bon: doc.numero_bon ?? null,
                    statut,
                },
                route: "PREMIUM_WHOLE",
            });
        }
    }
};
__decorate([
    Get(),
    __param(0, Query("fournisseur_id")),
    __param(1, Query("statut")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BonExpeditionController.prototype, "list", null);
__decorate([
    Get(":id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BonExpeditionController.prototype, "detail", null);
__decorate([
    Post(),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BonExpeditionController.prototype, "create", null);
__decorate([
    Patch(":id"),
    __param(0, Req()),
    __param(1, Param("id")),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], BonExpeditionController.prototype, "update", null);
__decorate([
    Delete(":id"),
    __param(0, Req()),
    __param(1, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], BonExpeditionController.prototype, "remove", null);
BonExpeditionController = __decorate([
    Controller("api/bon-expeditions"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [CollectionsService])
], BonExpeditionController);
export { BonExpeditionController };
