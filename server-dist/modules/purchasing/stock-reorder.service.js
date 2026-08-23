import { prepareInsertDocument } from "../../db/defaults.js";
import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { emitNotification } from "../notifications/notification-emitter.js";
import { isPurchaseRequisitionOpen } from "../workflow/workflow-types.js";
/**
 * TODO Priorité 1 — Auto-déclenchement DA depuis seuil stock.
 *
 * Le stock (produits + stock_lots) porte `threshold_security`; la DA existe; ce
 * module est le chaînon qui les relie. Quand le stock disponible d'un produit
 * tombe sous son seuil de sécurité, une DA est créée automatiquement en statut
 * DRAFT — avec l'article, la quantité à réapprovisionner et un lien vers le lot
 * déclencheur — pour que le magasinier n'ait plus qu'à la soumettre.
 *
 * Source de vérité: on lit le stock réel dans `stock_lots` (projection des
 * `reception_lots`), pas le champ `materials.current_stock` qui n'est jamais
 * mis à jour côté serveur. Cela supprime la confusion entre les deux chemins.
 */
const StockLots = () => getCollectionModel("stock_lots");
const Products = () => getCollectionModel("products");
const PurchaseRequisitions = () => getCollectionModel("purchase_requisitions");
export const AUTO_REORDER_SOURCE = "AUTO_REORDER_THRESHOLD";
/** Statuts de stock_lots comptés comme disponibles à la consommation. */
const AVAILABLE_STATUSES = new Set(["VALIDATED", "RELEASED"]);
const readNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const readString = (...values) => {
    for (const value of values) {
        if (typeof value === "string" && value.trim())
            return value.trim();
    }
    return "";
};
const roundQuantity = (value, precision = 3) => {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
};
/** Auto-reorder est actif par défaut; `AUTO_REORDER_GATE=off` le désactive. */
export const isAutoReorderEnabled = () => String(process.env.AUTO_REORDER_GATE || "on").toLowerCase() !== "off";
/**
 * §4.1 — Produits sous leur seuil de sécurité, calculé depuis le stock réel.
 * Lecture seule: sert à afficher l'alerte et à alimenter la génération de DA.
 */
export const evaluateStockReorderNeeds = async (options) => {
    const productFilter = options?.productId
        ? { id: options.productId }
        : { threshold_security: { $gt: 0 } };
    const products = sanitizeDocument(await Products().find(productFilter).lean().exec());
    if (products.length === 0)
        return [];
    const stockLots = sanitizeDocument(await StockLots().find({}).lean().exec());
    // Stock disponible + lot déclencheur (le plus récemment touché) par produit.
    const availableByProduct = new Map();
    const triggerByProduct = new Map();
    for (const lot of stockLots) {
        const productId = readString(lot.product_id);
        if (!productId)
            continue;
        const status = readString(lot.status).toUpperCase();
        if (!AVAILABLE_STATUSES.has(status))
            continue;
        const qty = readNumber(lot.current_quantity ?? lot.initial_quantity);
        availableByProduct.set(productId, (availableByProduct.get(productId) || 0) + qty);
        const current = triggerByProduct.get(productId);
        if (!current || readString(lot.updated_at) >= readString(current.updated_at)) {
            triggerByProduct.set(productId, lot);
        }
    }
    // DA déjà ouvertes → on ne redemande pas le même produit (idempotence).
    const openRequisitions = sanitizeDocument(await PurchaseRequisitions().find({}).lean().exec());
    const alreadyRequested = new Set(openRequisitions
        .filter((requisition) => isPurchaseRequisitionOpen(requisition.status))
        .map((requisition) => readString(requisition.product_id, requisition.material_id))
        .filter(Boolean));
    const needs = [];
    for (const product of products) {
        const thresholdSecurity = readNumber(product.threshold_security);
        if (thresholdSecurity <= 0)
            continue;
        const productId = readString(product.id);
        if (!productId)
            continue;
        const available = availableByProduct.get(productId) || 0;
        if (available >= thresholdSecurity)
            continue;
        const thresholdMax = product.threshold_max == null ? null : readNumber(product.threshold_max);
        // Réappro jusqu'au plafond quand il existe, sinon jusqu'à 2× le seuil.
        const target = thresholdMax && thresholdMax > thresholdSecurity ? thresholdMax : thresholdSecurity * 2;
        const trigger = triggerByProduct.get(productId) || null;
        needs.push({
            product_id: productId,
            product_name: readString(product.name) || readString(product.code) || productId,
            product_code: readString(product.code),
            unit: readString(product.unit) || "kg",
            threshold_security: thresholdSecurity,
            threshold_max: thresholdMax,
            available_quantity: roundQuantity(available),
            suggested_quantity: roundQuantity(Math.max(target - available, thresholdSecurity - available)),
            trigger_lot_id: trigger ? readString(trigger.id) || null : null,
            trigger_lot_code: trigger
                ? readString(trigger.lot_number, trigger.entry_lot_code, trigger.source_lot_internal) || null
                : null,
            trigger_reception_lot_id: trigger ? readString(trigger.reception_lot_id) || null : null,
            preferred_supplier_id: readString(product.preferred_supplier_id, product.supplier_id) || null,
            already_requested: alreadyRequested.has(productId),
        });
    }
    return needs;
};
/**
 * RG-DA-01 — Génère les DA de réappro seuil en statut Brouillon. Confirmation
 * humaine (soumission) obligatoire avant de poursuivre le circuit d'achat.
 * Idempotent: aucun doublon tant qu'une DA reste ouverte pour le produit.
 */
export const autoCreateThresholdRequisitions = async (options = {}) => {
    const needs = (await evaluateStockReorderNeeds({ productId: options.productId })).filter((need) => !need.already_requested);
    const created = [];
    for (const need of needs) {
        const requisition = await prepareInsertDocument("purchase_requisitions", {
            requester_id: options.actorId ?? null,
            requester_name: "Réapprovisionnement automatique (seuil)",
            department: "stock",
            material_id: need.product_id,
            material_name: need.product_name,
            product_id: need.product_id,
            quantity: need.suggested_quantity,
            unit: need.unit,
            urgency: need.available_quantity <= 0 ? "critical" : "high",
            justification: `Seuil de sécurité atteint — disponible ${need.available_quantity} ${need.unit} ` +
                `< seuil ${need.threshold_security} ${need.unit}` +
                (need.trigger_lot_code ? ` (lot déclencheur ${need.trigger_lot_code}).` : "."),
            estimated_cost: null,
            preferred_supplier_id: need.preferred_supplier_id,
            status: "DRAFT",
            source: AUTO_REORDER_SOURCE,
            trigger_lot_id: need.trigger_lot_id,
            trigger_lot_code: need.trigger_lot_code,
            trigger_reception_lot_id: need.trigger_reception_lot_id,
            notes: null,
            approvals: [],
            workflow_history: [],
            current_approval_level: null,
        });
        await PurchaseRequisitions().create([requisition]);
        created.push(requisition);
        // Notification actionnable pour le magasin: la DA n'attend que sa soumission.
        try {
            await emitNotification({
                notificationType: "STOCK_THRESHOLD_REORDER",
                category: "stock",
                space: "stock",
                title: `Réappro suggérée — ${need.product_name}`,
                message: `Stock disponible ${need.available_quantity} ${need.unit} sous le seuil de sécurité ` +
                    `${need.threshold_security} ${need.unit}. DA brouillon ${readString(requisition.requisition_number)} ` +
                    `prête à soumettre (${need.suggested_quantity} ${need.unit}).`,
                severity: need.available_quantity <= 0 ? "error" : "warning",
                entityType: "purchase_requisition",
                entityId: readString(requisition.id) || null,
                actionUrl: `/?tab=purchasing&requisition=${readString(requisition.id)}`,
                metadata: {
                    product_id: need.product_id,
                    trigger_lot_id: need.trigger_lot_id,
                    available_quantity: need.available_quantity,
                    threshold_security: need.threshold_security,
                    source: AUTO_REORDER_SOURCE,
                },
                actorId: options.actorId ?? null,
            });
        }
        catch (error) {
            // La notification ne doit jamais bloquer la création de la DA.
            console.error("[auto-reorder] notification emit failed:", error);
        }
    }
    return { created_count: created.length, requisitions: created };
};
/**
 * Hook non bloquant appelé après une baisse de stock (mouvement, expédition,
 * consommation packaging). Évalue les produits touchés et crée les DA seuil.
 * Toute erreur est absorbée: un réappro raté ne doit jamais casser un mouvement.
 */
export const autoReorderOnStockChange = async (productIds, actorId) => {
    if (!isAutoReorderEnabled())
        return;
    const unique = Array.from(new Set(productIds.map((id) => String(id || "").trim()).filter(Boolean)));
    if (unique.length === 0)
        return;
    for (const productId of unique) {
        try {
            await autoCreateThresholdRequisitions({ actorId, productId });
        }
        catch (error) {
            console.error("[auto-reorder] threshold evaluation failed for product", productId, error);
        }
    }
};
