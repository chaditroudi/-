/**
 * Notify supplier by email (+ in-app for buyers) when a purchase order is sent.
 * Safe for multi-manufacturer SaaS: brand from site_settings, SMTP from env.
 */

import { getCollectionModel, sanitizeDocument } from "../../db/dynamic-model.js";
import { emitNotification } from "../notifications/notification-emitter.js";
import { settingsService } from "../settings/settings.service.js";
import { isSmtpConfigured, sendMail, type MailBrand, type SendMailResult } from "./mailer.js";
import {
  buildPurchaseOrderSupplierEmail,
  type PurchaseOrderEmailPayload,
} from "./purchase-order-email.js";

const Suppliers = () => getCollectionModel("suppliers");

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const readNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export type SupplierPoNotifyResult = {
  attempted: boolean;
  email?: string | null;
  result?: SendMailResult | null;
  reason?: string | null;
};

const loadBrand = async (): Promise<{ brand: MailBrand; emailEnabled: boolean; supplierPoEmailEnabled: boolean }> => {
  const settings = (await settingsService.getSettings()) as Record<string, unknown>;
  const notifications = (settings.notifications || {}) as Record<string, unknown>;
  const emailEnabled = Boolean(notifications.email_notifications_enabled);
  const supplierPoEmailEnabled =
    notifications.supplier_po_email_enabled === undefined
      ? true
      : Boolean(notifications.supplier_po_email_enabled);

  return {
    emailEnabled,
    supplierPoEmailEnabled,
    brand: {
      companyName: readString(settings.company_name) || "Date Harvest Hub",
      companyShortName: readString(settings.company_short_name) || null,
      plantName: readString(settings.plant_name) || null,
      plantAddress: readString(settings.plant_address) || null,
      plantPhone: readString(settings.plant_phone) || null,
      plantEmail: readString(settings.plant_email) || null,
      primaryColor: readString(settings.primary_color) || "#107754",
      logoUrl: readString(settings.logo_url) || null,
      currency: readString(settings.currency) || "TND",
      siteCode: readString(settings.site_code) || null,
    },
  };
};

const resolveSupplierEmail = async (order: Record<string, unknown>) => {
  const embedded = order.supplier as Record<string, unknown> | null | undefined;
  const fromEmbed = readString(embedded?.email, embedded?.contact_email);
  if (fromEmbed) return fromEmbed;

  const supplierId = readString(order.supplier_id);
  if (!supplierId) return "";

  const supplier = sanitizeDocument(
    await Suppliers().findOne({ id: supplierId }).lean().exec(),
  ) as Record<string, unknown> | null;
  return readString(supplier?.email, supplier?.contact_email);
};

const toEmailPayload = (
  order: Record<string, unknown>,
  supplierName: string,
  brand: MailBrand,
): PurchaseOrderEmailPayload => {
  const lines = Array.isArray(order.lines) ? (order.lines as Record<string, unknown>[]) : [];
  const portalBase = readString(process.env.APP_PUBLIC_URL, process.env.VITE_APP_URL);
  return {
    orderNumber: readString(order.order_number, order.id) || "PO",
    orderDate: readString(order.order_date) || null,
    expectedDeliveryDate: readString(order.expected_delivery_date) || null,
    currency: readString(order.currency, brand.currency) || "TND",
    totalAmount: readNumber(order.total_amount),
    paymentTerms: readString(order.payment_terms) || null,
    deliveryAddress: readString(order.delivery_address, order.delivery_site) || null,
    notes: readString(order.notes) || null,
    buyerName: readString(order.buyer_name) || null,
    supplierName,
    portalUrl: portalBase ? `${portalBase.replace(/\/$/, "")}/supplier-portal` : null,
    lines: lines.map((line) => {
      const material = (line.material || {}) as Record<string, unknown>;
      return {
        description: readString(line.description) || null,
        materialName: readString(material.name, material.code, line.material_name) || null,
        quantity: readNumber(line.quantity),
        unit: readString(line.unit, material.unit) || "kg",
        unitPrice: readNumber(line.unit_price),
        lineTotal: readNumber(line.line_total, readNumber(line.quantity) * readNumber(line.unit_price)),
      };
    }),
  };
};

/**
 * Email the supplier when a BC is sent. Never throws — returns status for PO persistence.
 */
export const notifySupplierPurchaseOrderSent = async (
  order: Record<string, unknown>,
  actorId?: string | null,
): Promise<SupplierPoNotifyResult> => {
  const orderId = readString(order.id);
  const orderNumber = readString(order.order_number, orderId) || "PO";
  const supplierName =
    readString((order.supplier as Record<string, unknown> | undefined)?.name) || "Fournisseur";

  try {
    const { brand, emailEnabled, supplierPoEmailEnabled } = await loadBrand();

    if (!emailEnabled || !supplierPoEmailEnabled) {
      await emitNotification({
        notificationType: "PO_SENT_INTERNAL",
        category: "purchasing",
        space: "purchasing",
        title: `BC ${orderNumber} envoyé`,
        message: `Commande envoyée à ${supplierName} (email fournisseur désactivé dans les paramètres).`,
        severity: "info",
        entityType: "purchase_orders",
        entityId: orderId || null,
        actionUrl: `/purchasing?order=${encodeURIComponent(orderId)}`,
        targetRoles: ["responsable_achats", "directeur_achat", "acheteur"],
        actorId: actorId || null,
        metadata: { email_skipped: true, reason: "EMAIL_DISABLED" },
      });
      return { attempted: false, reason: "EMAIL_DISABLED", email: null, result: null };
    }

    const email = await resolveSupplierEmail(order);
    if (!email || !isValidEmail(email)) {
      await emitNotification({
        notificationType: "PO_SENT_NO_SUPPLIER_EMAIL",
        category: "purchasing",
        space: "purchasing",
        title: `BC ${orderNumber} — email fournisseur manquant`,
        message: `${supplierName} n'a pas d'email valide. Ajoutez-le sur la fiche fournisseur pour notifier automatiquement.`,
        severity: "warning",
        entityType: "purchase_orders",
        entityId: orderId || null,
        actionUrl: `/purchasing?order=${encodeURIComponent(orderId)}`,
        targetRoles: ["responsable_achats", "directeur_achat", "acheteur"],
        actorId: actorId || null,
        metadata: { supplier_name: supplierName },
      });
      return { attempted: false, reason: "NO_SUPPLIER_EMAIL", email: email || null, result: null };
    }

    const content = buildPurchaseOrderSupplierEmail(brand, toEmailPayload(order, supplierName, brand));
    const result = await sendMail({
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      replyTo: brand.plantEmail || undefined,
      softFail: true,
      tags: ["purchase_order", "supplier", orderNumber],
    });

    await emitNotification({
      notificationType: result.ok ? "PO_SENT_SUPPLIER_EMAILED" : "PO_SENT_EMAIL_FAILED",
      category: "purchasing",
      space: "purchasing",
      title: result.ok
        ? `BC ${orderNumber} — email envoyé`
        : `BC ${orderNumber} — échec email`,
      message: result.ok
        ? `Notification envoyée à ${supplierName} <${email}> (${result.mode}${isSmtpConfigured() ? "" : ", sans SMTP → console"}).`
        : `Impossible d'envoyer à ${email}: ${result.reason || "erreur"}.`,
      severity: result.ok ? "success" : "warning",
      entityType: "purchase_orders",
      entityId: orderId || null,
      actionUrl: `/purchasing?order=${encodeURIComponent(orderId)}`,
      targetRoles: ["responsable_achats", "directeur_achat", "acheteur"],
      actorId: actorId || null,
      metadata: {
        supplier_email: email,
        mail_mode: result.mode,
        message_id: result.messageId,
        reason: result.reason || null,
      },
    });

    return { attempted: true, email, result, reason: result.ok ? null : result.reason || "SEND_FAILED" };
  } catch (error) {
    console.error("[purchasing] supplier PO email failed:", error);
    return {
      attempted: true,
      reason: error instanceof Error ? error.message : "SEND_FAILED",
      email: null,
      result: null,
    };
  }
};
