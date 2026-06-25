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
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAuthGuard } from "../../nest/route-guards.js";
import { CollectionsService } from "../collections/collections.service.js";
let BonReceptionAchatController = class BonReceptionAchatController {
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
            table: "bon_receptions_achat",
            filters,
            orderBy: { column: "created_at", ascending: false },
        });
        return { data };
    }
    async detail(id) {
        const rows = await this.cs.query({
            table: "bon_receptions_achat",
            filters: [{ type: "eq", column: "id", value: id }],
            limit: 1,
        });
        return { data: rows[0] ?? null };
    }
    async create(body) {
        const data = await this.cs.insert({ table: "bon_receptions_achat", values: body });
        return { data: data[0] };
    }
    async update(id, body) {
        const { after } = await this.cs.update({
            table: "bon_receptions_achat",
            filters: [{ type: "eq", column: "id", value: id }],
            values: body,
        });
        return { data: after[0] };
    }
    async remove(id) {
        const data = await this.cs.remove({
            table: "bon_receptions_achat",
            filters: [{ type: "eq", column: "id", value: id }],
        });
        return { data: data[0] };
    }
};
__decorate([
    Get(),
    __param(0, Query("fournisseur_id")),
    __param(1, Query("statut")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BonReceptionAchatController.prototype, "list", null);
__decorate([
    Get(":id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BonReceptionAchatController.prototype, "detail", null);
__decorate([
    Post(),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BonReceptionAchatController.prototype, "create", null);
__decorate([
    Patch(":id"),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BonReceptionAchatController.prototype, "update", null);
__decorate([
    Delete(":id"),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BonReceptionAchatController.prototype, "remove", null);
BonReceptionAchatController = __decorate([
    Controller("api/bon-receptions-achat"),
    UseGuards(RequireAuthGuard),
    __metadata("design:paramtypes", [CollectionsService])
], BonReceptionAchatController);
export { BonReceptionAchatController };
