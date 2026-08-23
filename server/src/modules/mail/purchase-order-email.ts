/**
 * Branded purchase-order email for any manufacturer instance
 * (Royale Palm, EcoDatte, Bioscha, … — driven by site_settings).
 */

import { escapeHtml, type MailBrand } from "./mailer.js";

export type PurchaseOrderEmailLine = {
  description?: string | null;
  materialName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
};

export type PurchaseOrderEmailPayload = {
  orderNumber: string;
  orderDate?: string | null;
  expectedDeliveryDate?: string | null;
  currency: string;
  totalAmount: number;
  paymentTerms?: string | null;
  deliveryAddress?: string | null;
  notes?: string | null;
  buyerName?: string | null;
  supplierName: string;
  lines: PurchaseOrderEmailLine[];
  portalUrl?: string | null;
};

const formatMoney = (amount: number, currency: string) =>
  `${Number(amount || 0).toLocaleString("fr-TN", { maximumFractionDigits: 3 })} ${currency}`;

export const buildPurchaseOrderSupplierEmail = (
  brand: MailBrand,
  order: PurchaseOrderEmailPayload,
) => {
  const company = brand.companyName || "Usine";
  const plant = brand.plantName || company;
  const color = brand.primaryColor || "#107754";
  const currency = order.currency || brand.currency || "TND";

  const linesHtml = order.lines
    .map((line) => {
      const label = escapeHtml(line.materialName || line.description || "Article");
      const qty = `${Number(line.quantity || 0)} ${escapeHtml(line.unit || "u")}`;
      const total = formatMoney(Number(line.lineTotal ?? 0), currency);
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb">${label}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${qty}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${escapeHtml(total)}</td>
      </tr>`;
    })
    .join("");

  const linesText = order.lines
    .map((line) => {
      const label = line.materialName || line.description || "Article";
      return `- ${label}: ${Number(line.quantity || 0)} ${line.unit || "u"} · ${formatMoney(Number(line.lineTotal ?? 0), currency)}`;
    })
    .join("\n");

  const subject = `[${company}] Bon de commande ${order.orderNumber}`;

  const contactBits = [
    brand.plantEmail ? `Email: ${brand.plantEmail}` : null,
    brand.plantPhone ? `Tél: ${brand.plantPhone}` : null,
    brand.plantAddress || null,
  ].filter(Boolean);

  const portalBlock = order.portalUrl
    ? `<p style="margin:16px 0 0"><a href="${escapeHtml(order.portalUrl)}" style="color:${escapeHtml(color)}">Ouvrir le portail fournisseur</a></p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px">
    <tr><td align="center">
      <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <tr>
          <td style="background:${escapeHtml(color)};color:#fff;padding:20px 24px">
            <div style="font-size:18px;font-weight:700">${escapeHtml(company)}</div>
            <div style="opacity:.9;font-size:13px;margin-top:4px">${escapeHtml(plant)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px">
            <p style="margin:0 0 12px">Bonjour <strong>${escapeHtml(order.supplierName)}</strong>,</p>
            <p style="margin:0 0 16px">Vous avez reçu le bon de commande <strong>${escapeHtml(order.orderNumber)}</strong>.</p>
            <table role="presentation" width="100%" style="font-size:13px;margin-bottom:16px">
              <tr><td style="padding:4px 0;color:#64748b">Date</td><td style="padding:4px 0;text-align:right">${escapeHtml(order.orderDate || "—")}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b">Livraison souhaitée</td><td style="padding:4px 0;text-align:right">${escapeHtml(order.expectedDeliveryDate || "—")}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b">Conditions</td><td style="padding:4px 0;text-align:right">${escapeHtml(order.paymentTerms || "—")}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b">Total</td><td style="padding:4px 0;text-align:right;font-weight:700">${escapeHtml(formatMoney(order.totalAmount, currency))}</td></tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;border-collapse:collapse">
              <thead>
                <tr style="background:#f1f5f9">
                  <th align="left" style="padding:8px">Article</th>
                  <th align="right" style="padding:8px">Qté</th>
                  <th align="right" style="padding:8px">Montant</th>
                </tr>
              </thead>
              <tbody>${linesHtml || `<tr><td colspan="3" style="padding:8px;color:#64748b">Aucune ligne</td></tr>`}</tbody>
            </table>
            ${order.deliveryAddress ? `<p style="margin:16px 0 0;font-size:13px"><strong>Livraison:</strong> ${escapeHtml(order.deliveryAddress)}</p>` : ""}
            ${order.notes ? `<p style="margin:12px 0 0;font-size:13px;color:#475569">${escapeHtml(order.notes)}</p>` : ""}
            ${portalBlock}
            <p style="margin:20px 0 0;font-size:12px;color:#64748b">
              Merci de confirmer réception de cette commande${order.buyerName ? ` auprès de ${escapeHtml(order.buyerName)}` : ""}.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;background:#f8fafc;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0">
            ${escapeHtml(company)}${brand.siteCode ? ` · ${escapeHtml(brand.siteCode)}` : ""}
            ${contactBits.length ? `<br/>${escapeHtml(contactBits.join(" · "))}` : ""}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `${company} — ${plant}`,
    "",
    `Bonjour ${order.supplierName},`,
    `Vous avez reçu le bon de commande ${order.orderNumber}.`,
    `Date: ${order.orderDate || "—"}`,
    `Livraison souhaitée: ${order.expectedDeliveryDate || "—"}`,
    `Total: ${formatMoney(order.totalAmount, currency)}`,
    "",
    "Lignes:",
    linesText || "(aucune)",
    order.deliveryAddress ? `\nLivraison: ${order.deliveryAddress}` : "",
    order.portalUrl ? `\nPortail: ${order.portalUrl}` : "",
    "",
    contactBits.join(" · "),
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
};
