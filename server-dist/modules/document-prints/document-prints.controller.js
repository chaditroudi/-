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
var _a, _b;
import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { DocumentPrintsService } from "./document-prints.service.js";
const DOC_ROLES = [
    "responsable_reception", "chef_reception", "operateur_reception",
    "responsable_qualite", "inspecteur_qualite", "responsable_achats",
    "responsable_production", "directeur_usine", "administrateur_systeme",
];
let DocumentPrintsController = class DocumentPrintsController {
    service;
    constructor(service) {
        this.service = service;
    }
    async getBySource(source_id, document_type) {
        if (document_type) {
            const data = await this.service.findBySourceAndType(source_id, document_type);
            return { data };
        }
        const data = await this.service.listBySource(source_id);
        return { data };
    }
    async upsert(body, req) {
        const actor = req.user?.sub || req.user?.id || "system";
        const data = await this.service.upsert(body, actor);
        return { data };
    }
    async update(id, body, req) {
        const actor = req.user?.sub || req.user?.id || "system";
        const data = await this.service.update(id, body, actor);
        return { data };
    }
};
__decorate([
    Get(),
    Roles(...DOC_ROLES),
    __param(0, Query("source_id")),
    __param(1, Query("document_type")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DocumentPrintsController.prototype, "getBySource", null);
__decorate([
    Post(),
    Roles(...DOC_ROLES),
    __param(0, Body()),
    __param(1, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_a = typeof Record !== "undefined" && Record) === "function" ? _a : Object, Object]),
    __metadata("design:returntype", Promise)
], DocumentPrintsController.prototype, "upsert", null);
__decorate([
    Put(":id"),
    Roles(...DOC_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __param(2, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_b = typeof Record !== "undefined" && Record) === "function" ? _b : Object, Object]),
    __metadata("design:returntype", Promise)
], DocumentPrintsController.prototype, "update", null);
DocumentPrintsController = __decorate([
    Controller("api/document-prints"),
    UseGuards(RequireAuthGuard, RolesGuard),
    __metadata("design:paramtypes", [DocumentPrintsService])
], DocumentPrintsController);
export { DocumentPrintsController };
