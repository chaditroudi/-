var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from "@nestjs/common";
import { badRequest, notFound } from "../../core/app-error.js";
import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { SiteSettingsModel } from "../../models/site-settings.model.js";
const RFQRequests = () => getCollectionModel("p2p_rfq");
const RFQResponses = () => getCollectionModel("p2p_rfq_responses");
const GoodsReceipts = () => getCollectionModel("p2p_goods_receipts");
const SupplierInvoices = () => getCollectionModel("p2p_invoices");
const SupplierCertificates = () => getCollectionModel("p2p_certificates");
const BudgetCenters = () => getCollectionModel("p2p_budget_centers");
const PurchaseRequisitions = () => getCollectionModel("purchase_requisitions");
const PurchaseOrders = () => getCollectionModel("purchase_orders");
const Suppliers = () => getCollectionModel("suppliers");
const SITE_CODES = ["ROYALE_PALM", "ECODATTE", "BIOSCHA"];
const DEFAULT_SITE_RULES = {
    ROYALE_PALM: {
        code: "ROYALE_PALM",
        name: "Royale Palm Tunisia",
        bio_certification_required: false,
        phytosanitary_required: false,
        lot_traceability_required: false,
        dluo_required: false,
        fds_required: false,
        forex_enabled: true,
        systematic_quarantine: false,
        cert_alert_days: [60, 30],
    },
    ECODATTE: {
        code: "ECODATTE",
        name: "EcoDatte",
        bio_certification_required: true,
        phytosanitary_required: true,
        lot_traceability_required: false,
        dluo_required: false,
        fds_required: false,
        forex_enabled: false,
        systematic_quarantine: false,
        cert_alert_days: [60, 30],
    },
    BIOSCHA: {
        code: "BIOSCHA",
        name: "Bioscha",
        bio_certification_required: false,
        phytosanitary_required: false,
        lot_traceability_required: true,
        dluo_required: true,
        fds_required: true,
        forex_enabled: false,
        systematic_quarantine: true,
        cert_alert_days: [60, 30],
    },
};
const readNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const readBoolean = (value, fallback = false) => typeof value === "boolean" ? value : fallback;
const readDateTimestamp = (value) => {
    const date = new Date(String(value || ""));
    const timestamp = date.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
};
const cleanPatch = (input, blocked = []) => {
    const output = {};
    for (const [key, value] of Object.entries(input || {})) {
        if (value === undefined)
            continue;
        if (blocked.includes(key))
            continue;
        output[key] = value;
    }
    return output;
};
const normalizeSiteCode = (value) => {
    const normalized = String(value || "").trim().toUpperCase();
    return SITE_CODES.includes(normalized) ? normalized : null;
};
// ── RFQ ────────────────────────────────────────────────────────────────────────
let P2PService = class P2PService {
    async getRuntimeSettings() {
        const raw = (await SiteSettingsModel.findOne({ id: "global" })
            .select("operations p2p")
            .lean()
            .exec());
        const sites = SITE_CODES.reduce((acc, code) => {
            acc[code] = {
                ...DEFAULT_SITE_RULES[code],
                ...(raw?.p2p?.sites?.[code] || {}),
                cert_alert_days: Array.isArray(raw?.p2p?.sites?.[code]?.cert_alert_days)
                    ? raw?.p2p?.sites?.[code]?.cert_alert_days.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
                    : DEFAULT_SITE_RULES[code].cert_alert_days,
            };
            return acc;
        }, {});
        return {
            operations: {
                require_purchase_order_for_reception: readBoolean(raw?.operations?.require_purchase_order_for_reception, false),
            },
            p2p: {
                enable_minimum_quotes_rule: readBoolean(raw?.p2p?.enable_minimum_quotes_rule, true),
                rfq_minimum_quote_count: readNumber(raw?.p2p?.rfq_minimum_quote_count, 3),
                rfq_quote_threshold_tnd: readNumber(raw?.p2p?.rfq_quote_threshold_tnd, 1000),
                require_purchase_order_for_goods_receipt: readBoolean(raw?.p2p?.require_purchase_order_for_goods_receipt, false),
                default_invoice_tolerance_pct: readNumber(raw?.p2p?.default_invoice_tolerance_pct, 3),
                require_goods_receipt_for_payment: readBoolean(raw?.p2p?.require_goods_receipt_for_payment, false),
                sites,
            },
        };
    }
    async getRfqBudgetAmount(rfq) {
        const requisitionId = String(rfq.requisition_id || "").trim();
        if (requisitionId) {
            const requisition = sanitizeDocument(await PurchaseRequisitions().findOne({ id: requisitionId }).lean().exec());
            if (requisition) {
                return readNumber(requisition.estimated_cost);
            }
        }
        const responses = sanitizeDocument(await RFQResponses().find({ rfq_id: String(rfq.id || "") }).lean().exec());
        return responses.reduce((max, response) => Math.max(max, readNumber(response.total_amount)), 0);
    }
    async ensureSupplierCertificateCompliance(site, supplierId) {
        if (!site || !supplierId)
            return;
        const settings = await this.getRuntimeSettings();
        const siteRule = settings.p2p.sites[site];
        if (!siteRule.bio_certification_required)
            return;
        const certificates = sanitizeDocument(await SupplierCertificates().find({
            supplier_id: supplierId,
            certificate_type: { $in: ["BIO_AB", "BIO_EU"] },
        }).lean().exec());
        const hasValidCertificate = certificates.some((certificate) => {
            const expiry = readDateTimestamp(certificate.expiry_date);
            return expiry !== null && expiry >= Date.now();
        });
        if (!hasValidCertificate) {
            throw badRequest("SUPPLIER_CERTIFICATE_REQUIRED", `Le fournisseur sélectionné doit disposer d'un certificat bio valide pour ${siteRule.name}.`);
        }
    }
    async enrichPurchaseOrderContext(payload) {
        const purchaseOrderId = String(payload.purchase_order_id || "").trim();
        if (!purchaseOrderId)
            return payload;
        const purchaseOrder = sanitizeDocument(await PurchaseOrders().findOne({ id: purchaseOrderId }).lean().exec());
        if (!purchaseOrder) {
            throw notFound("PURCHASE_ORDER_NOT_FOUND", "Bon de commande introuvable.");
        }
        const supplierId = String(payload.supplier_id || purchaseOrder.supplier_id || "").trim();
        let supplierName = payload.supplier_name ?? null;
        if (!supplierName && supplierId) {
            const supplier = sanitizeDocument(await Suppliers().findOne({ id: supplierId }).lean().exec());
            supplierName = supplier?.name ?? null;
        }
        return {
            ...payload,
            purchase_order_id: purchaseOrderId,
            purchase_order_number: payload.purchase_order_number ?? purchaseOrder.order_number ?? null,
            supplier_id: supplierId || null,
            supplier_name: supplierName,
            bc_amount: payload.bc_amount ?? purchaseOrder.total_amount ?? null,
        };
    }
    // ── RFQ ──────────────────────────────────────────────────────────────────────
    async listRFQs(status) {
        const query = status ? { status } : {};
        return sanitizeDocument(await RFQRequests().find(query).sort({ created_at: -1 }).lean().exec());
    }
    async getRFQById(id) {
        const doc = sanitizeDocument(await RFQRequests().findOne({ id }).lean().exec());
        return doc;
    }
    async createRFQ(payload) {
        const doc = await prepareInsertDocument("p2p_rfq", {
            ...payload,
            status: payload.status ?? "BROUILLON",
            supplier_ids: Array.isArray(payload.supplier_ids) ? payload.supplier_ids : [],
            selected_supplier_id: payload.selected_supplier_id ?? null,
            selected_reason: payload.selected_reason ?? null,
        });
        await RFQRequests().create([doc]);
        return this.getRFQById(String(doc.id));
    }
    async updateRFQ(id, payload) {
        const existing = await RFQRequests().findOne({ id }).lean().exec();
        if (!existing)
            throw notFound("RFQ_NOT_FOUND", "Appel d'offres introuvable.");
        await RFQRequests().updateOne({ id }, { $set: { ...cleanPatch(payload, ["id", "rfq_number", "created_at"]), updated_at: new Date().toISOString() } }).exec();
        return this.getRFQById(id);
    }
    async getRFQResponses(rfqId) {
        return sanitizeDocument(await RFQResponses().find({ rfq_id: rfqId }).sort({ received_at: -1 }).lean().exec());
    }
    async addRFQResponse(rfqId, payload) {
        const rfq = await RFQRequests().findOne({ id: rfqId }).lean().exec();
        if (!rfq)
            throw notFound("RFQ_NOT_FOUND", "Appel d'offres introuvable.");
        const doc = await prepareInsertDocument("p2p_rfq_responses", {
            ...payload,
            rfq_id: rfqId,
            received_at: payload.received_at ?? new Date().toISOString(),
            score: payload.score ?? null,
            rank: payload.rank ?? null,
        });
        await RFQResponses().create([doc]);
        return sanitizeDocument(doc);
    }
    async selectRFQWinner(rfqId, supplierId, reason) {
        if (!supplierId)
            throw badRequest("SUPPLIER_REQUIRED", "supplierId requis.");
        if (!reason)
            throw badRequest("REASON_REQUIRED", "reason requis.");
        const rfq = sanitizeDocument(await RFQRequests().findOne({ id: rfqId }).lean().exec());
        if (!rfq)
            throw notFound("RFQ_NOT_FOUND", "Appel d'offres introuvable.");
        const responses = sanitizeDocument(await RFQResponses().find({ rfq_id: rfqId }).lean().exec());
        const matchingResponse = responses.find((response) => String(response.supplier_id || "") === supplierId);
        if (!matchingResponse) {
            throw badRequest("RFQ_RESPONSE_REQUIRED", "Aucune réponse fournisseur correspondante n'a été trouvée.");
        }
        const settings = await this.getRuntimeSettings();
        const budgetAmount = await this.getRfqBudgetAmount(rfq);
        if (settings.p2p.enable_minimum_quotes_rule &&
            budgetAmount >= settings.p2p.rfq_quote_threshold_tnd &&
            responses.length < settings.p2p.rfq_minimum_quote_count) {
            throw badRequest("RFQ_MINIMUM_QUOTES_REQUIRED", `Au moins ${settings.p2p.rfq_minimum_quote_count} devis sont requis au-delà de ${settings.p2p.rfq_quote_threshold_tnd} TND.`);
        }
        await this.ensureSupplierCertificateCompliance(normalizeSiteCode(rfq.site), supplierId);
        return this.updateRFQ(rfqId, {
            selected_supplier_id: supplierId,
            selected_reason: reason,
            status: "EVALUEE",
        });
    }
    // ── Goods Receipts ────────────────────────────────────────────────────────────
    async listGoodsReceipts(params) {
        const query = {};
        if (params?.status)
            query.status = params.status;
        if (params?.supplier_id)
            query.supplier_id = params.supplier_id;
        return sanitizeDocument(await GoodsReceipts().find(query).sort({ created_at: -1 }).lean().exec());
    }
    async getGoodsReceiptById(id) {
        return sanitizeDocument(await GoodsReceipts().findOne({ id }).lean().exec());
    }
    async createGoodsReceipt(payload) {
        const settings = await this.getRuntimeSettings();
        const siteCode = normalizeSiteCode(payload.site);
        const siteRule = siteCode ? settings.p2p.sites[siteCode] : null;
        const requirePurchaseOrder = settings.operations.require_purchase_order_for_reception ||
            settings.p2p.require_purchase_order_for_goods_receipt;
        if (requirePurchaseOrder && !String(payload.purchase_order_id || "").trim()) {
            throw badRequest("PURCHASE_ORDER_REQUIRED", "Un bon de commande est requis pour enregistrer ce bon de réception.");
        }
        if (siteRule?.bio_certification_required && !String(payload.bio_cert_ref || "").trim()) {
            throw badRequest("BIO_CERT_REQUIRED", `La référence du certificat bio est obligatoire pour ${siteRule.name}.`);
        }
        if (siteRule?.phytosanitary_required && !String(payload.phyto_doc_ref || "").trim()) {
            throw badRequest("PHYTO_DOC_REQUIRED", `La référence phytosanitaire est obligatoire pour ${siteRule.name}.`);
        }
        if (siteRule?.dluo_required && !String(payload.dluo_date || "").trim()) {
            throw badRequest("DLUO_REQUIRED", `La date DLUO/DDM est obligatoire pour ${siteRule.name}.`);
        }
        if (siteRule?.fds_required && !String(payload.fds_document || "").trim()) {
            throw badRequest("FDS_REQUIRED", `La référence FDS est obligatoire pour ${siteRule.name}.`);
        }
        const enrichedPayload = await this.enrichPurchaseOrderContext(payload);
        const forcedQuarantineReason = siteRule?.systematic_quarantine && !String(enrichedPayload.quarantine_reason || "").trim()
            ? `Quarantaine systématique paramétrée pour ${siteRule.name}.`
            : enrichedPayload.quarantine_reason ?? null;
        const doc = await prepareInsertDocument("p2p_goods_receipts", {
            ...enrichedPayload,
            total_received_qty: readNumber(payload.total_received_qty),
            total_accepted_qty: readNumber(payload.total_accepted_qty),
            total_rejected_qty: readNumber(payload.total_rejected_qty),
            release_decision: payload.release_decision ?? null,
            release_by: payload.release_by ?? null,
            release_at: payload.release_at ?? null,
            qc_notes: payload.qc_notes ?? null,
            reception_id: payload.reception_id ?? null,
            dluo_date: payload.dluo_date ?? null,
            fds_document: payload.fds_document ?? null,
            bio_cert_ref: payload.bio_cert_ref ?? null,
            phyto_doc_ref: payload.phyto_doc_ref ?? null,
            quarantine_reason: forcedQuarantineReason,
            status: siteRule?.systematic_quarantine ? "EN_QUARANTAINE" : payload.status ?? "ATTENDUE",
        });
        await GoodsReceipts().create([doc]);
        return this.getGoodsReceiptById(String(doc.id));
    }
    async updateGoodsReceipt(id, payload) {
        const existing = await GoodsReceipts().findOne({ id }).lean().exec();
        if (!existing)
            throw notFound("GOODS_RECEIPT_NOT_FOUND", "Bon de réception introuvable.");
        await GoodsReceipts().updateOne({ id }, { $set: { ...cleanPatch(payload, ["id", "receipt_number", "created_at"]), updated_at: new Date().toISOString() } }).exec();
        return this.getGoodsReceiptById(id);
    }
    async releaseQuarantine(id, decision, by, notes) {
        if (!decision)
            throw badRequest("DECISION_REQUIRED", "decision requis (ACCEPTE ou REFUSE).");
        if (!by)
            throw badRequest("BY_REQUIRED", "by requis.");
        if (decision === "REFUSE" && !String(notes || "").trim()) {
            throw badRequest("REFUSAL_NOTES_REQUIRED", "Une note est requise pour refuser une réception.");
        }
        const now = new Date().toISOString();
        const nextStatus = decision === "ACCEPTE" ? "ACCEPTEE" : "REFUSEE";
        return this.updateGoodsReceipt(id, {
            status: nextStatus,
            release_decision: decision,
            release_by: by,
            release_at: now,
            qc_notes: notes ?? null,
        });
    }
    // ── Supplier Invoices ─────────────────────────────────────────────────────────
    async listInvoices(params) {
        const query = {};
        if (params?.status)
            query.status = params.status;
        if (params?.supplier_id)
            query.supplier_id = params.supplier_id;
        return sanitizeDocument(await SupplierInvoices().find(query).sort({ created_at: -1 }).lean().exec());
    }
    async getInvoiceById(id) {
        return sanitizeDocument(await SupplierInvoices().findOne({ id }).lean().exec());
    }
    async createInvoice(payload) {
        const settings = await this.getRuntimeSettings();
        const enrichedPayload = await this.enrichPurchaseOrderContext(payload);
        const doc = await prepareInsertDocument("p2p_invoices", {
            ...enrichedPayload,
            status: payload.status ?? "RECUE",
            currency: payload.currency ?? "TND",
            subtotal: readNumber(payload.subtotal),
            tax_amount: readNumber(payload.tax_amount),
            total_amount: readNumber(payload.total_amount),
            tolerance_pct: readNumber(payload.tolerance_pct ?? payload.tolerancePct, settings.p2p.default_invoice_tolerance_pct),
            match_result: payload.match_result ?? "NON_VERIFIE",
            bc_amount: enrichedPayload.bc_amount ?? null,
            br_amount: payload.br_amount ?? null,
            variance_amount: payload.variance_amount ?? null,
            variance_pct: payload.variance_pct ?? null,
            match_notes: payload.match_notes ?? null,
            matched_by: payload.matched_by ?? null,
            matched_at: payload.matched_at ?? null,
            payment_reference: payload.payment_reference ?? null,
            paid_at: payload.paid_at ?? null,
            paid_by: payload.paid_by ?? null,
        });
        await SupplierInvoices().create([doc]);
        return this.getInvoiceById(String(doc.id));
    }
    async updateInvoice(id, payload) {
        const existing = await SupplierInvoices().findOne({ id }).lean().exec();
        if (!existing)
            throw notFound("INVOICE_NOT_FOUND", "Facture introuvable.");
        await SupplierInvoices().updateOne({ id }, { $set: { ...cleanPatch(payload, ["id", "invoice_number", "created_at"]), updated_at: new Date().toISOString() } }).exec();
        return this.getInvoiceById(id);
    }
    async runThreeWayMatch(invoiceId, tolerancePct) {
        const settings = await this.getRuntimeSettings();
        const invoice = sanitizeDocument(await SupplierInvoices().findOne({ id: invoiceId }).lean().exec());
        if (!invoice)
            throw notFound("INVOICE_NOT_FOUND", "Facture introuvable.");
        const effectiveTolerance = tolerancePct ??
            readNumber(invoice.tolerance_pct, settings.p2p.default_invoice_tolerance_pct);
        const bcAmount = readNumber(invoice.bc_amount);
        const brAmount = readNumber(invoice.br_amount);
        const invoiceAmount = readNumber(invoice.total_amount);
        const ref = Math.max(bcAmount, brAmount);
        let matchResult;
        let varianceAmount = 0;
        let variancePct = 0;
        if (ref === 0) {
            matchResult = "NON_VERIFIE";
        }
        else {
            varianceAmount = invoiceAmount - ref;
            variancePct = (Math.abs(varianceAmount) / ref) * 100;
            if (variancePct === 0)
                matchResult = "MATCH";
            else if (variancePct <= effectiveTolerance)
                matchResult = "ECART_TOLERANCE";
            else
                matchResult = "ECART_BLOQUANT";
        }
        const nextStatus = matchResult === "ECART_BLOQUANT" ? "EN_LITIGE" : "EN_RAPPROCHEMENT";
        return this.updateInvoice(invoiceId, {
            match_result: matchResult,
            variance_amount: varianceAmount,
            variance_pct: variancePct,
            tolerance_pct: effectiveTolerance,
            status: nextStatus,
        });
    }
    async approvePayment(invoiceId, by) {
        if (!by)
            throw badRequest("BY_REQUIRED", "by requis.");
        const settings = await this.getRuntimeSettings();
        const invoice = sanitizeDocument(await SupplierInvoices().findOne({ id: invoiceId }).lean().exec());
        if (!invoice)
            throw notFound("INVOICE_NOT_FOUND", "Facture introuvable.");
        // RG-PAY-01: block if discrepancy above tolerance
        if (invoice.match_result === "ECART_BLOQUANT") {
            throw badRequest("PAYMENT_BLOCKED", "Paiement bloqué — écart de rapprochement supérieur à la tolérance autorisée.");
        }
        if (!["MATCH", "ECART_TOLERANCE"].includes(String(invoice.match_result || ""))) {
            throw badRequest("THREE_WAY_MATCH_REQUIRED", "Le rapprochement 3 voies doit être validé avant le bon à payer.");
        }
        if (settings.p2p.require_goods_receipt_for_payment &&
            !String(invoice.goods_receipt_id || "").trim() &&
            readNumber(invoice.br_amount) <= 0) {
            throw badRequest("GOODS_RECEIPT_REQUIRED", "Une référence de bon de réception est requise avant le bon à payer.");
        }
        return this.updateInvoice(invoiceId, {
            status: "BON_A_PAYER",
            matched_by: by,
            matched_at: new Date().toISOString(),
        });
    }
    async markPaid(invoiceId, paymentRef, by) {
        if (!paymentRef)
            throw badRequest("PAYMENT_REF_REQUIRED", "paymentRef requis.");
        if (!by)
            throw badRequest("BY_REQUIRED", "by requis.");
        const now = new Date().toISOString();
        return this.updateInvoice(invoiceId, {
            status: "PAYEE",
            payment_reference: paymentRef,
            paid_at: now,
            paid_by: by,
        });
    }
    // ── Supplier Certificates ─────────────────────────────────────────────────────
    async listCertificates(params) {
        const query = {};
        if (params?.supplier_id)
            query.supplier_id = params.supplier_id;
        if (params?.type)
            query.certificate_type = params.type;
        return sanitizeDocument(await SupplierCertificates().find(query).sort({ expiry_date: 1 }).lean().exec());
    }
    async createCertificate(payload) {
        if (!payload.supplier_id)
            throw badRequest("SUPPLIER_REQUIRED", "supplier_id requis.");
        if (!payload.expiry_date)
            throw badRequest("EXPIRY_REQUIRED", "expiry_date requis.");
        const doc = await prepareInsertDocument("p2p_certificates", {
            ...payload,
            certificate_number: payload.certificate_number ?? null,
            issuer: payload.issuer ?? null,
            issue_date: payload.issue_date ?? null,
            document_ref: payload.document_ref ?? null,
            notes: payload.notes ?? null,
        });
        await SupplierCertificates().create([doc]);
        return sanitizeDocument(doc);
    }
    async updateCertificate(id, payload) {
        const existing = await SupplierCertificates().findOne({ id }).lean().exec();
        if (!existing)
            throw notFound("CERT_NOT_FOUND", "Certificat introuvable.");
        await SupplierCertificates().updateOne({ id }, { $set: { ...cleanPatch(payload, ["id", "created_at"]), updated_at: new Date().toISOString() } }).exec();
        return sanitizeDocument(await SupplierCertificates().findOne({ id }).lean().exec());
    }
    async deleteCertificate(id) {
        const result = await SupplierCertificates().deleteOne({ id }).exec();
        if (!result.deletedCount)
            throw notFound("CERT_NOT_FOUND", "Certificat introuvable.");
        return { id, deleted: true };
    }
    // ── Budget Centers ─────────────────────────────────────────────────────────────
    async listBudgetCenters(site) {
        const query = site ? { site } : {};
        return sanitizeDocument(await BudgetCenters().find(query).sort({ code: 1 }).lean().exec());
    }
    async createBudgetCenter(payload) {
        if (!payload.code)
            throw badRequest("CODE_REQUIRED", "code requis.");
        const doc = await prepareInsertDocument("p2p_budget_centers", {
            ...payload,
            annual_budget: readNumber(payload.annual_budget),
            consumed: readNumber(payload.consumed),
            committed: readNumber(payload.committed),
            currency: payload.currency ?? "TND",
            fiscal_year: readNumber(payload.fiscal_year, new Date().getFullYear()),
        });
        await BudgetCenters().create([doc]);
        return sanitizeDocument(doc);
    }
    async updateBudgetCenter(id, payload) {
        const existing = await BudgetCenters().findOne({ id }).lean().exec();
        if (!existing)
            throw notFound("BUDGET_CENTER_NOT_FOUND", "Centre budgétaire introuvable.");
        await BudgetCenters().updateOne({ id }, { $set: { ...cleanPatch(payload, ["id", "code", "created_at"]), updated_at: new Date().toISOString() } }).exec();
        return sanitizeDocument(await BudgetCenters().findOne({ id }).lean().exec());
    }
};
P2PService = __decorate([
    Injectable()
], P2PService);
export { P2PService };
