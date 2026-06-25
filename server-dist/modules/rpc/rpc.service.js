var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from "@nestjs/common";
import { notFound } from "../../core/app-error.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
const StockLots = () => getCollectionModel("stock_lots");
const Products = () => getCollectionModel("products");
const toComparable = (value) => {
    if (typeof value === "number")
        return value;
    if (typeof value === "string") {
        const asNumber = Number(value);
        if (Number.isFinite(asNumber) && value.trim() !== "")
            return asNumber;
        const asDate = Date.parse(value);
        if (!Number.isNaN(asDate))
            return asDate;
    }
    return 0;
};
let RpcService = class RpcService {
    async execute(name, args) {
        if (name !== "suggest_lots_for_picking") {
            throw notFound("RPC_NOT_FOUND", `Unknown RPC: ${name}`);
        }
        const productId = String(args.p_product_id || "");
        const requestedQuantity = Number(args.p_quantity || 0);
        const product = sanitizeDocument(await Products().findOne({ id: productId }).lean().exec());
        if (!product)
            return [];
        const lots = sanitizeDocument(await StockLots().find({
            product_id: productId,
            current_quantity: { $gt: 0 },
            status: "VALIDATED",
        })
            .lean()
            .exec());
        const rotationRule = product.rotation_rule || "FIFO";
        const sortedLots = [...lots].sort((left, right) => {
            const leftKey = rotationRule === "FEFO"
                ? left.dlc_date || left.dluo_date || left.reception_date || left.created_at
                : left.reception_date || left.created_at;
            const rightKey = rotationRule === "FEFO"
                ? right.dlc_date || right.dluo_date || right.reception_date || right.created_at
                : right.reception_date || right.created_at;
            return toComparable(leftKey) - toComparable(rightKey);
        });
        let remaining = requestedQuantity;
        const suggestions = [];
        for (const lot of sortedLots) {
            if (remaining <= 0)
                break;
            const available = Number(lot.current_quantity || 0);
            if (available <= 0)
                continue;
            const suggested = Math.min(available, remaining);
            suggestions.push({
                lot_id: lot.id,
                lot_number: lot.lot_number,
                available_qty: available,
                suggested_qty: suggested,
                sort_date: rotationRule === "FEFO"
                    ? lot.dlc_date || lot.dluo_date || lot.reception_date || lot.created_at
                    : lot.reception_date || lot.created_at,
                rotation_rule: rotationRule,
            });
            remaining -= suggested;
        }
        return suggestions;
    }
};
RpcService = __decorate([
    Injectable()
], RpcService);
export { RpcService };
export const rpcService = new RpcService();
