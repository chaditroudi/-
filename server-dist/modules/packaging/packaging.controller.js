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
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards, } from "@nestjs/common";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { PackagingService } from "./packaging.service.js";
const PACKAGING_ROLES = [
    "responsable_production",
    "operateur_conditionnement",
    "operateur_emballage",
    "responsable_qualite",
    "resp_qualite_haccp",
    "responsable_stock",
    "admin",
    "direction",
];
let PackagingController = class PackagingController {
    packagingService;
    constructor(packagingService) {
        this.packagingService = packagingService;
    }
    async listBoms() {
        return { data: await this.packagingService.listBoms() };
    }
    async createBom(body) {
        const data = await this.packagingService.createBom(body || {});
        publishRealtimeDbChange({
            type: "packaging_bom_created",
            table: "packaging_bom",
            action: "INSERT",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || "")].filter(Boolean),
        });
        return { data };
    }
    async updateBom(id, body) {
        const data = await this.packagingService.updateBom(id, body || {});
        publishRealtimeDbChange({
            type: "packaging_bom_updated",
            table: "packaging_bom",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
        });
        return { data };
    }
    async toggleBomActive(id, body) {
        const data = await this.packagingService.toggleBomActive(id, Boolean(body?.is_active));
        publishRealtimeDbChange({
            type: "packaging_bom_toggled",
            table: "packaging_bom",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
        });
        return { data };
    }
    async listLabelTemplates(status) {
        return { data: await this.packagingService.listLabelTemplates(status) };
    }
    async createLabelTemplate(body) {
        const data = await this.packagingService.createLabelTemplate(body || {});
        publishRealtimeDbChange({
            type: "label_template_created",
            table: "label_templates",
            action: "INSERT",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || "")].filter(Boolean),
        });
        return { data };
    }
    async updateLabelTemplate(id, body) {
        const data = await this.packagingService.updateLabelTemplate(id, body || {});
        publishRealtimeDbChange({
            type: "label_template_updated",
            table: "label_templates",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["packaging_bom"],
        });
        return { data };
    }
    async approveLabelTemplate(id, body) {
        const data = await this.packagingService.approveLabelTemplate(id, body?.approved_by);
        publishRealtimeDbChange({
            type: "label_template_approved",
            table: "label_templates",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["packaging_bom"],
        });
        return { data };
    }
    async archiveLabelTemplate(id) {
        const data = await this.packagingService.archiveLabelTemplate(id);
        publishRealtimeDbChange({
            type: "label_template_archived",
            table: "label_templates",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
        });
        return { data };
    }
    async listPrivateLabelClients() {
        return { data: await this.packagingService.listPrivateLabelClients() };
    }
    async createPrivateLabelClient(body) {
        const data = await this.packagingService.createPrivateLabelClient(body || {});
        publishRealtimeDbChange({
            type: "private_label_client_created",
            table: "private_label_clients",
            action: "INSERT",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || "")].filter(Boolean),
        });
        return { data };
    }
    async togglePrivateLabelClient(id, body) {
        const data = await this.packagingService.togglePrivateLabelClient(id, Boolean(body?.active));
        publishRealtimeDbChange({
            type: "private_label_client_toggled",
            table: "private_label_clients",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
        });
        return { data };
    }
    async listAvailableSublots() {
        return { data: await this.packagingService.listAvailableSublots() };
    }
    async listOrders(status) {
        return { data: await this.packagingService.listOrders(status) };
    }
    async createOrder(body) {
        const data = await this.packagingService.createOrder(body || {});
        publishRealtimeDbChange({
            type: "packaging_order_created",
            table: "packaging_orders",
            action: "INSERT",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || "")].filter(Boolean),
            relatedTables: ["stock_lots", "stock_movements"],
        });
        return { data };
    }
    async startOrder(id, body) {
        const data = await this.packagingService.startOrder(id, body?.label_status);
        publishRealtimeDbChange({
            type: "packaging_order_started",
            table: "packaging_orders",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["system_notifications"],
        });
        return { data };
    }
    async updateProgress(id, body) {
        const data = await this.packagingService.updateProgress(id, body || {});
        publishRealtimeDbChange({
            type: "packaging_order_progress_updated",
            table: "packaging_orders",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["system_notifications"],
        });
        return { data };
    }
    async toggleRunState(id, body) {
        const data = await this.packagingService.toggleRunState(id, body?.current_status);
        publishRealtimeDbChange({
            type: "packaging_order_run_state_toggled",
            table: "packaging_orders",
            action: "UPDATE",
            rowIds: [id],
        });
        return { data };
    }
    async closeOrder(id, body) {
        const data = await this.packagingService.closeOrder(id, body || {});
        publishRealtimeDbChange({
            type: "packaging_order_closed",
            table: "packaging_orders",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["system_notifications"],
        });
        return { data };
    }
    async listOrderPalettes(id) {
        return { data: await this.packagingService.listPalettes(id) };
    }
    async listPalettes() {
        return { data: await this.packagingService.listPalettes() };
    }
    async createPalette(body) {
        const data = await this.packagingService.createPalette(body || {});
        publishRealtimeDbChange({
            type: "packaging_palette_created",
            table: "packaging_palettes",
            action: "INSERT",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || "")].filter(Boolean),
        });
        return { data };
    }
    async sealPalette(id, body) {
        const data = await this.packagingService.sealPalette(id, body || {});
        publishRealtimeDbChange({
            type: "packaging_palette_sealed",
            table: "packaging_palettes",
            action: "UPDATE",
            rowIds: [id],
            relatedTables: ["stock_lots", "stock_movements", "system_notifications"],
        });
        return { data };
    }
};
__decorate([
    Get("boms"),
    Roles(...PACKAGING_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "listBoms", null);
__decorate([
    Post("boms"),
    Roles(...PACKAGING_ROLES),
    HttpCode(201),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "createBom", null);
__decorate([
    Patch("boms/:id"),
    Roles(...PACKAGING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "updateBom", null);
__decorate([
    Post("boms/:id/toggle-active"),
    Roles(...PACKAGING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "toggleBomActive", null);
__decorate([
    Get("label-templates"),
    Roles(...PACKAGING_ROLES),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "listLabelTemplates", null);
__decorate([
    Post("label-templates"),
    Roles(...PACKAGING_ROLES),
    HttpCode(201),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "createLabelTemplate", null);
__decorate([
    Patch("label-templates/:id"),
    Roles(...PACKAGING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "updateLabelTemplate", null);
__decorate([
    Post("label-templates/:id/approve"),
    Roles(...PACKAGING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "approveLabelTemplate", null);
__decorate([
    Post("label-templates/:id/archive"),
    Roles(...PACKAGING_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "archiveLabelTemplate", null);
__decorate([
    Get("private-label-clients"),
    Roles(...PACKAGING_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "listPrivateLabelClients", null);
__decorate([
    Post("private-label-clients"),
    Roles(...PACKAGING_ROLES),
    HttpCode(201),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "createPrivateLabelClient", null);
__decorate([
    Post("private-label-clients/:id/toggle-active"),
    Roles(...PACKAGING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "togglePrivateLabelClient", null);
__decorate([
    Get("available-sublots"),
    Roles(...PACKAGING_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "listAvailableSublots", null);
__decorate([
    Get("orders"),
    Roles(...PACKAGING_ROLES),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "listOrders", null);
__decorate([
    Post("orders"),
    Roles(...PACKAGING_ROLES),
    HttpCode(201),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "createOrder", null);
__decorate([
    Post("orders/:id/start"),
    Roles(...PACKAGING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "startOrder", null);
__decorate([
    Patch("orders/:id/progress"),
    Roles(...PACKAGING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "updateProgress", null);
__decorate([
    Post("orders/:id/toggle-run"),
    Roles(...PACKAGING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "toggleRunState", null);
__decorate([
    Post("orders/:id/close"),
    Roles(...PACKAGING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "closeOrder", null);
__decorate([
    Get("orders/:id/palettes"),
    Roles(...PACKAGING_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "listOrderPalettes", null);
__decorate([
    Get("palettes"),
    Roles(...PACKAGING_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "listPalettes", null);
__decorate([
    Post("palettes"),
    Roles(...PACKAGING_ROLES),
    HttpCode(201),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "createPalette", null);
__decorate([
    Post("palettes/:id/seal"),
    Roles(...PACKAGING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PackagingController.prototype, "sealPalette", null);
PackagingController = __decorate([
    Controller("api/packaging"),
    UseGuards(RequireAuthGuard, RolesGuard),
    __metadata("design:paramtypes", [PackagingService])
], PackagingController);
export { PackagingController };
