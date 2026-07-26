var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from "@nestjs/common";
import { badRequest, notFound } from "../../core/app-error.js";
import { buildGenealogyFromDossier } from "../phase2/genealogy-builder.js";
import { buildLotTraceabilityDossier } from "../phase2/traceability-dossier.js";
import { LotLedgerService } from "./lot-ledger.service.js";
import { LotLifecycleService } from "./lot-lifecycle.service.js";
let LotRecallService = class LotRecallService {
    ledger;
    lifecycle;
    constructor(ledger, lifecycle) {
        this.ledger = ledger;
        this.lifecycle = lifecycle;
    }
    async runDrill(query) {
        const started = Date.now();
        const lookup = String(query.lotId || query.lotNumber || query.sscc || "").trim();
        if (!lookup && !query.sscc) {
            throw badRequest("RECALL_QUERY_REQUIRED", "Provide lotId, lotNumber, or sscc.");
        }
        const resolvedLotId = await this.lifecycle.resolveReceptionLotId({
            lotId: query.lotId || query.lotNumber || null,
            lotNumber: query.lotNumber || query.lotId || null,
            sscc: query.sscc || null,
        });
        if (!resolvedLotId) {
            throw notFound("LOT_NOT_FOUND", `No lot resolved for recall query ${lookup || query.sscc}.`);
        }
        const lot = await this.lifecycle.requireLot(resolvedLotId);
        const lotNumber = String(lot.lot_internal || lot.id);
        const verify = await this.ledger.verify(resolvedLotId);
        const dossier = await buildLotTraceabilityDossier(lotNumber);
        const genealogy = buildGenealogyFromDossier(dossier);
        const focus = genealogy.nodes.find((node) => node.type === "reception_lot") ||
            genealogy.nodes[0] ||
            null;
        const focusColumn = focus?.column ?? 0;
        const mapNode = (node) => ({
            id: node.id,
            type: node.type,
            label: node.label,
            sublabel: node.sublabel,
            status: node.status,
            column: node.column,
        });
        const upstream = genealogy.nodes
            .filter((node) => node.column <= focusColumn)
            .map(mapNode);
        const downstream = genealogy.nodes
            .filter((node) => node.column > focusColumn)
            .map(mapNode);
        const shipments = Array.isArray(dossier.shipments) ? dossier.shipments : [];
        const palettes = Array.isArray(dossier.packaging_palettes)
            ? dossier.packaging_palettes
            : Array.isArray(dossier.palettes)
                ? dossier.palettes
                : [];
        const elapsedMs = Date.now() - started;
        return {
            wave: "W2",
            query: {
                lotId: query.lotId || null,
                lotNumber: query.lotNumber || null,
                sscc: query.sscc || null,
            },
            resolvedLotId,
            lotNumber,
            tipHash: verify.tipHash,
            valid: verify.valid,
            elapsedMs,
            under60s: elapsedMs < 60_000,
            targetSeconds: 60,
            stats: {
                nodeCount: genealogy.nodes.length,
                edgeCount: genealogy.edges.length,
                upstreamCount: upstream.length,
                downstreamCount: downstream.length,
                shipmentCount: shipments.length,
                paletteCount: palettes.length,
                stageCount: genealogy.stats.stage_count,
            },
            upstream,
            downstream,
            impactedShipments: shipments.slice(0, 50).map((row) => ({
                id: row.id ?? null,
                status: row.status ?? null,
                reference: row.shipment_number || row.numero_bon || row.reference || null,
                customer: row.customer_name || row.client_name || null,
            })),
            impactedPalettes: palettes.slice(0, 50).map((row) => ({
                id: row.id ?? null,
                sscc: row.sscc ?? null,
                palette_number: row.palette_number ?? null,
                status: row.status ?? null,
            })),
            ranAt: new Date().toISOString(),
        };
    }
};
LotRecallService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [LotLedgerService,
        LotLifecycleService])
], LotRecallService);
export { LotRecallService };
