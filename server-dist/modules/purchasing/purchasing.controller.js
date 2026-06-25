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
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards, } from "@nestjs/common";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { PurchasingService } from "./purchasing.service.js";
const PURCHASING_ROLES = ["responsable_achats", "directeur_achat", "admin", "direction"];
const REQUISITION_ROLES = [...PURCHASING_ROLES, "responsable_stock"];
const PURCHASING_READ_ROLES = [
    ...PURCHASING_ROLES,
    "responsable_stock",
    "responsable_reception",
    "chef_reception",
    "operateur_reception",
    "directeur_general",
    "directeur_usine",
    "administrateur_systeme",
];
let PurchasingController = class PurchasingController {
    purchasingService;
    constructor(purchasingService) {
        this.purchasingService = purchasingService;
    }
    async listRequisitions(status) {
        return { data: await this.purchasingService.listRequisitions(status) };
    }
    async getRequisition(id) {
        return { data: await this.purchasingService.getRequisitionById(id) };
    }
    async createRequisition(req, body) {
        const data = await this.purchasingService.createRequisition(body || {}, req.auth?.user || null);
        publishRealtimeDbChange({
            type: "purchase_requisition_created",
            table: "purchase_requisitions",
            action: "INSERT",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || "")].filter(Boolean),
            relatedTables: ["purchasing_stats"],
        });
        return { data };
    }
    async updateRequisition(id, body) {
        const data = await this.purchasingService.updateRequisition(id, body || {});
        publishRealtimeDbChange({
            type: "purchase_requisition_updated",
            table: "purchase_requisitions",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["purchasing_stats"],
        });
        return { data };
    }
    async approveRequisition(id, body) {
        const data = await this.purchasingService.approveRequisition(id, body?.approverName);
        publishRealtimeDbChange({
            type: "purchase_requisition_approved",
            table: "purchase_requisitions",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["purchasing_stats"],
        });
        return { data };
    }
    async rejectRequisition(id, body) {
        const data = await this.purchasingService.rejectRequisition(id, body?.reason, body?.rejectorName);
        publishRealtimeDbChange({
            type: "purchase_requisition_rejected",
            table: "purchase_requisitions",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["purchasing_stats"],
        });
        return { data };
    }
    async deleteRequisition(id) {
        const data = await this.purchasingService.deleteRequisition(id);
        publishRealtimeDbChange({
            type: "purchase_requisition_deleted",
            table: "purchase_requisitions",
            action: "DELETE",
            rowIds: [id],
            relatedTables: ["purchasing_stats"],
        });
        return { data };
    }
    async listOrders(status) {
        return { data: await this.purchasingService.listOrders(status) };
    }
    async getOrder(id) {
        return { data: await this.purchasingService.getOrderById(id) };
    }
    async createOrder(req, body) {
        const data = await this.purchasingService.createOrder(body || {}, req.auth?.user || null);
        publishRealtimeDbChange({
            type: "purchase_order_created",
            table: "purchase_orders",
            action: "INSERT",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || "")].filter(Boolean),
            relatedTables: ["purchase_order_lines", "purchase_requisitions", "purchasing_stats"],
        });
        return { data };
    }
    async updateOrder(id, body) {
        const data = await this.purchasingService.updateOrder(id, body || {});
        publishRealtimeDbChange({
            type: "purchase_order_updated",
            table: "purchase_orders",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["purchase_order_lines", "purchase_requisitions", "purchasing_stats"],
        });
        return { data };
    }
    async sendOrder(id) {
        const data = await this.purchasingService.sendOrder(id);
        publishRealtimeDbChange({
            type: "purchase_order_sent",
            table: "purchase_orders",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["purchasing_stats"],
        });
        return { data };
    }
    async confirmOrder(id, body) {
        const data = await this.purchasingService.confirmOrder(id, body?.expectedDate);
        publishRealtimeDbChange({
            type: "purchase_order_confirmed",
            table: "purchase_orders",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["purchasing_stats"],
        });
        return { data };
    }
    async approveOrder(id, body) {
        const data = await this.purchasingService.approveOrder(id, body?.approverName);
        publishRealtimeDbChange({
            type: "purchase_order_approved",
            table: "purchase_orders",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["purchasing_stats"],
        });
        return { data };
    }
    async receiveOrderLine(id, body) {
        const data = await this.purchasingService.receiveOrderLine(id, body || {});
        publishRealtimeDbChange({
            type: "purchase_order_line_received",
            table: "purchase_order_lines",
            action: "UPDATE",
            rowIds: [String(body?.lineId || body?.line_id || "")].filter(Boolean),
            relatedTables: ["purchase_orders", "purchasing_stats"],
        });
        return { data };
    }
    async saveThreeWayMatch(id, body) {
        const data = await this.purchasingService.saveThreeWayMatch(id, body || {});
        publishRealtimeDbChange({
            type: "purchase_order_three_way_match_saved",
            table: "purchase_orders",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["purchasing_stats"],
        });
        return { data };
    }
    async getReceiptLogs(id) {
        const data = await this.purchasingService.getReceiptLogs(id);
        return { data };
    }
    async getLinkedReceptions(id) {
        const data = await this.purchasingService.getLinkedReceptions(id);
        return { data };
    }
    async deleteOrder(id) {
        const data = await this.purchasingService.deleteOrder(id);
        publishRealtimeDbChange({
            type: "purchase_order_deleted",
            table: "purchase_orders",
            action: "DELETE",
            rowIds: [id],
            relatedTables: ["purchase_order_lines", "purchasing_stats"],
        });
        return { data };
    }
    async addOrderLine(body) {
        const data = await this.purchasingService.addOrderLine(body || {});
        publishRealtimeDbChange({
            type: "purchase_order_line_created",
            table: "purchase_order_lines",
            action: "INSERT",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || "")].filter(Boolean),
            relatedTables: ["purchase_orders", "purchasing_stats"],
        });
        return { data };
    }
    async updateOrderLine(id, body) {
        const data = await this.purchasingService.updateOrderLine(id, body || {});
        publishRealtimeDbChange({
            type: "purchase_order_line_updated",
            table: "purchase_order_lines",
            action: "UPDATE",
            rows: data ? [data] : [],
            rowIds: [String(data?.id || id)].filter(Boolean),
            relatedTables: ["purchase_orders", "purchasing_stats"],
        });
        return { data };
    }
    async deleteOrderLine(id) {
        const data = await this.purchasingService.deleteOrderLine(id);
        publishRealtimeDbChange({
            type: "purchase_order_line_deleted",
            table: "purchase_order_lines",
            action: "DELETE",
            rowIds: [id],
            relatedTables: ["purchase_orders", "purchasing_stats"],
        });
        return { data };
    }
    async getStats() {
        return { data: await this.purchasingService.getStats() };
    }
};
__decorate([
    Get("requisitions"),
    Roles(...REQUISITION_ROLES),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "listRequisitions", null);
__decorate([
    Get("requisitions/:id"),
    Roles(...REQUISITION_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "getRequisition", null);
__decorate([
    Post("requisitions"),
    Roles(...REQUISITION_ROLES),
    HttpCode(201),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "createRequisition", null);
__decorate([
    Patch("requisitions/:id"),
    Roles(...REQUISITION_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "updateRequisition", null);
__decorate([
    Post("requisitions/:id/approve"),
    Roles(...REQUISITION_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "approveRequisition", null);
__decorate([
    Post("requisitions/:id/reject"),
    Roles(...REQUISITION_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "rejectRequisition", null);
__decorate([
    Delete("requisitions/:id"),
    Roles(...REQUISITION_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "deleteRequisition", null);
__decorate([
    Get("orders"),
    Roles(...PURCHASING_READ_ROLES),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "listOrders", null);
__decorate([
    Get("orders/:id"),
    Roles(...PURCHASING_READ_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "getOrder", null);
__decorate([
    Post("orders"),
    Roles(...PURCHASING_ROLES),
    HttpCode(201),
    __param(0, Req()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "createOrder", null);
__decorate([
    Patch("orders/:id"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "updateOrder", null);
__decorate([
    Post("orders/:id/send"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "sendOrder", null);
__decorate([
    Post("orders/:id/confirm"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "confirmOrder", null);
__decorate([
    Post("orders/:id/approve"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "approveOrder", null);
__decorate([
    Post("orders/:id/receive-line"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "receiveOrderLine", null);
__decorate([
    Post("orders/:id/three-way-match"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "saveThreeWayMatch", null);
__decorate([
    Get("orders/:id/receipt-logs"),
    Roles(...PURCHASING_READ_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "getReceiptLogs", null);
__decorate([
    Get("orders/:id/linked-receptions"),
    Roles(...PURCHASING_READ_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "getLinkedReceptions", null);
__decorate([
    Delete("orders/:id"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "deleteOrder", null);
__decorate([
    Post("order-lines"),
    Roles(...PURCHASING_ROLES),
    HttpCode(201),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "addOrderLine", null);
__decorate([
    Patch("order-lines/:id"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "updateOrderLine", null);
__decorate([
    Delete("order-lines/:id"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "deleteOrderLine", null);
__decorate([
    Get("stats"),
    Roles(...PURCHASING_READ_ROLES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PurchasingController.prototype, "getStats", null);
PurchasingController = __decorate([
    Controller("api/purchasing"),
    UseGuards(RequireAuthGuard, RolesGuard),
    __metadata("design:paramtypes", [PurchasingService])
], PurchasingController);
export { PurchasingController };
