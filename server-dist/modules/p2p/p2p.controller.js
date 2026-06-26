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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, } from "@nestjs/common";
import { Roles } from "../../nest/route-metadata.js";
import { RequireAuthGuard, RolesGuard } from "../../nest/route-guards.js";
import { publishRealtimeDbChange } from "../realtime/realtime.bus.js";
import { P2PService } from "./p2p.service.js";
const PURCHASING_ROLES = [
    "responsable_achats",
    "acheteur",
    "gestionnaire_approvisionnement",
    "daf",
    "directeur_general",
    "administrateur_systeme",
];
const pub = (table, action, row) => publishRealtimeDbChange({
    type: `${table}_${action.toLowerCase()}`,
    table,
    action,
    rows: [row],
    rowIds: [String(row.id || "")].filter(Boolean),
});
let P2PController = class P2PController {
    service;
    constructor(service) {
        this.service = service;
    }
    // ── RFQ ────────────────────────────────────────────────────────────────────
    async listRFQs(status) {
        return { data: await this.service.listRFQs(status) };
    }
    async createRFQ(body) {
        const result = await this.service.createRFQ(body);
        pub("p2p_rfq", "INSERT", result ?? {});
        return { data: result };
    }
    async getRFQ(id) {
        return { data: await this.service.getRFQById(id) };
    }
    async updateRFQ(id, body) {
        const result = await this.service.updateRFQ(id, body);
        pub("p2p_rfq", "UPDATE", result ?? {});
        return { data: result };
    }
    async getRFQResponses(rfqId) {
        return { data: await this.service.getRFQResponses(rfqId) };
    }
    async addRFQResponse(rfqId, body) {
        const result = await this.service.addRFQResponse(rfqId, body);
        pub("p2p_rfq_responses", "INSERT", result ?? {});
        return { data: result };
    }
    async selectRFQWinner(rfqId, body) {
        const result = await this.service.selectRFQWinner(rfqId, body.supplier_id ?? body.supplierId ?? "", body.reason);
        pub("p2p_rfq", "UPDATE", result ?? {});
        return { data: result };
    }
    // ── Goods Receipts ──────────────────────────────────────────────────────────
    async listGoodsReceipts(status, supplier_id) {
        return { data: await this.service.listGoodsReceipts({ status, supplier_id }) };
    }
    async createGoodsReceipt(body) {
        const result = await this.service.createGoodsReceipt(body);
        pub("p2p_goods_receipts", "INSERT", result ?? {});
        return { data: result };
    }
    async getGoodsReceipt(id) {
        return { data: await this.service.getGoodsReceiptById(id) };
    }
    async updateGoodsReceipt(id, body) {
        const result = await this.service.updateGoodsReceipt(id, body);
        pub("p2p_goods_receipts", "UPDATE", result ?? {});
        return { data: result };
    }
    async releaseQuarantine(id, body) {
        const result = await this.service.releaseQuarantine(id, body.decision, body.by, body.notes);
        pub("p2p_goods_receipts", "UPDATE", result ?? {});
        return { data: result };
    }
    // ── Supplier Invoices ────────────────────────────────────────────────────────
    async listInvoices(status, supplier_id) {
        return { data: await this.service.listInvoices({ status, supplier_id }) };
    }
    async createInvoice(body) {
        const result = await this.service.createInvoice(body);
        pub("p2p_invoices", "INSERT", result ?? {});
        return { data: result };
    }
    async getInvoice(id) {
        return { data: await this.service.getInvoiceById(id) };
    }
    async updateInvoice(id, body) {
        const result = await this.service.updateInvoice(id, body);
        pub("p2p_invoices", "UPDATE", result ?? {});
        return { data: result };
    }
    async runThreeWayMatch(id, body) {
        const result = await this.service.runThreeWayMatch(id, body.tolerance_pct ?? body.tolerancePct);
        pub("p2p_invoices", "UPDATE", result ?? {});
        return { data: result };
    }
    async approvePayment(id, body) {
        const result = await this.service.approvePayment(id, body.by);
        pub("p2p_invoices", "UPDATE", result ?? {});
        return { data: result };
    }
    async markPaid(id, body) {
        const result = await this.service.markPaid(id, body.payment_reference ?? body.paymentRef ?? "", body.by);
        pub("p2p_invoices", "UPDATE", result ?? {});
        return { data: result };
    }
    // ── Supplier Certificates ────────────────────────────────────────────────────
    async listCertificates(supplier_id, type) {
        return { data: await this.service.listCertificates({ supplier_id, type }) };
    }
    async createCertificate(body) {
        const result = await this.service.createCertificate(body);
        pub("p2p_certificates", "INSERT", result ?? {});
        return { data: result };
    }
    async updateCertificate(id, body) {
        const result = await this.service.updateCertificate(id, body);
        pub("p2p_certificates", "UPDATE", result ?? {});
        return { data: result };
    }
    async deleteCertificate(id) {
        const result = await this.service.deleteCertificate(id);
        pub("p2p_certificates", "DELETE", { id });
        return { data: result };
    }
    // ── Budget Centers ───────────────────────────────────────────────────────────
    async listBudgetCenters(site) {
        return { data: await this.service.listBudgetCenters(site) };
    }
    async createBudgetCenter(body) {
        const result = await this.service.createBudgetCenter(body);
        pub("p2p_budget_centers", "INSERT", result ?? {});
        return { data: result };
    }
    async updateBudgetCenter(id, body) {
        const result = await this.service.updateBudgetCenter(id, body);
        pub("p2p_budget_centers", "UPDATE", result ?? {});
        return { data: result };
    }
};
__decorate([
    Get("rfq"),
    Roles(...PURCHASING_ROLES),
    __param(0, Query("status")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "listRFQs", null);
__decorate([
    Post("rfq"),
    Roles(...PURCHASING_ROLES),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_a = typeof Record !== "undefined" && Record) === "function" ? _a : Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "createRFQ", null);
__decorate([
    Get("rfq/:id"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "getRFQ", null);
__decorate([
    Patch("rfq/:id"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_b = typeof Record !== "undefined" && Record) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "updateRFQ", null);
__decorate([
    Get("rfq/:id/responses"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "getRFQResponses", null);
__decorate([
    Post("rfq/:id/responses"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_c = typeof Record !== "undefined" && Record) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "addRFQResponse", null);
__decorate([
    Post("rfq/:id/select"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "selectRFQWinner", null);
__decorate([
    Get("goods-receipts"),
    Roles(...PURCHASING_ROLES),
    __param(0, Query("status")),
    __param(1, Query("supplier_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "listGoodsReceipts", null);
__decorate([
    Post("goods-receipts"),
    Roles(...PURCHASING_ROLES),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_d = typeof Record !== "undefined" && Record) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "createGoodsReceipt", null);
__decorate([
    Get("goods-receipts/:id"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "getGoodsReceipt", null);
__decorate([
    Patch("goods-receipts/:id"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_e = typeof Record !== "undefined" && Record) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "updateGoodsReceipt", null);
__decorate([
    Post("goods-receipts/:id/release"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "releaseQuarantine", null);
__decorate([
    Get("invoices"),
    Roles(...PURCHASING_ROLES),
    __param(0, Query("status")),
    __param(1, Query("supplier_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "listInvoices", null);
__decorate([
    Post("invoices"),
    Roles(...PURCHASING_ROLES),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_f = typeof Record !== "undefined" && Record) === "function" ? _f : Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "createInvoice", null);
__decorate([
    Get("invoices/:id"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "getInvoice", null);
__decorate([
    Patch("invoices/:id"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_g = typeof Record !== "undefined" && Record) === "function" ? _g : Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "updateInvoice", null);
__decorate([
    Post("invoices/:id/three-way-match"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "runThreeWayMatch", null);
__decorate([
    Post("invoices/:id/approve-payment"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "approvePayment", null);
__decorate([
    Post("invoices/:id/mark-paid"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "markPaid", null);
__decorate([
    Get("certificates"),
    Roles(...PURCHASING_ROLES, "responsable_qualite", "resp_management_qualite"),
    __param(0, Query("supplier_id")),
    __param(1, Query("type")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "listCertificates", null);
__decorate([
    Post("certificates"),
    Roles(...PURCHASING_ROLES),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_h = typeof Record !== "undefined" && Record) === "function" ? _h : Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "createCertificate", null);
__decorate([
    Patch("certificates/:id"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_j = typeof Record !== "undefined" && Record) === "function" ? _j : Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "updateCertificate", null);
__decorate([
    Delete("certificates/:id"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "deleteCertificate", null);
__decorate([
    Get("budget-centers"),
    Roles(...PURCHASING_ROLES),
    __param(0, Query("site")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "listBudgetCenters", null);
__decorate([
    Post("budget-centers"),
    Roles(...PURCHASING_ROLES),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_k = typeof Record !== "undefined" && Record) === "function" ? _k : Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "createBudgetCenter", null);
__decorate([
    Patch("budget-centers/:id"),
    Roles(...PURCHASING_ROLES),
    __param(0, Param("id")),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_l = typeof Record !== "undefined" && Record) === "function" ? _l : Object]),
    __metadata("design:returntype", Promise)
], P2PController.prototype, "updateBudgetCenter", null);
P2PController = __decorate([
    Controller("api/p2p"),
    UseGuards(RequireAuthGuard, RolesGuard),
    __metadata("design:paramtypes", [P2PService])
], P2PController);
export { P2PController };
