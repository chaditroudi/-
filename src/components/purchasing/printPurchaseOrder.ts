import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PurchaseOrder } from '@/types/purchasing';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export function printPurchaseOrder(order: PurchaseOrder) {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    alert("Impossible d'ouvrir la fenêtre d'impression (popup bloqué).");
    return;
  }

  const orderDate = order.order_date
    ? format(new Date(order.order_date), 'dd/MM/yyyy', { locale: fr })
    : '-';

  const expected = order.expected_delivery_date
    ? format(new Date(order.expected_delivery_date), 'dd/MM/yyyy', { locale: fr })
    : '-';

  const lines = (order.lines || []).map((l) => ({
    desc: l.description || '',
    code: l.material?.code || '',
    qty: l.quantity ?? 0,
    unit: l.unit || '',
    unitPrice: l.unit_price ?? 0,
    total: l.total_price ?? Number(l.quantity || 0) * Number(l.unit_price || 0),
  }));

  const subtotal = order.subtotal ?? lines.reduce((s, x) => s + x.total, 0);
  const tax = order.tax_amount ?? 0;
  const total = order.total_amount ?? subtotal + tax;
  const currency = order.currency || 'TND';

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>BC ${escapeHtml(order.order_number)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
    .top { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
    .h1 { font-size: 20px; font-weight: 700; margin: 0; }
    .muted { color:#666; font-size: 12px; margin-top: 4px; }
    .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { border-bottom: 1px solid #eee; padding: 10px 8px; text-align:left; font-size: 13px; }
    th { background:#fafafa; font-weight: 700; }
    td.num, th.num { text-align:right; }
    .totals { margin-top: 14px; display:flex; justify-content:flex-end; }
    .totals .row { display:flex; justify-content:space-between; gap: 24px; font-size: 13px; padding: 4px 0; }
    .totals .bold { font-weight: 700; font-size: 15px; border-top:1px solid #ddd; padding-top: 8px; margin-top: 6px;}
    .footer { margin-top: 18px; font-size: 11px; color:#666; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <p class="h1">Bon de Commande (BC) ${escapeHtml(order.order_number)}</p>
      <p class="muted">Imprimé le ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
    </div>
    <div class="box">
      <div><b>Statut:</b> ${escapeHtml(order.status)}</div>
      <div><b>Date:</b> ${escapeHtml(orderDate)}</div>
      <div><b>Livraison prévue:</b> ${escapeHtml(expected)}</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <div class="muted">Fournisseur</div>
      <div style="font-weight:700">${escapeHtml(order.supplier?.name || '-')}</div>
      <div class="muted" style="margin-top:6px">Conditions paiement</div>
      <div>${escapeHtml(order.payment_terms || '-')}</div>
    </div>

    <div class="box">
      <div class="muted">Adresse livraison</div>
      <div>${escapeHtml(order.delivery_address || '-')}</div>
      <div class="muted" style="margin-top:6px">Notes</div>
      <div>${escapeHtml(order.notes || '-')}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Code</th>
        <th class="num">Qté</th>
        <th>Unité</th>
        <th class="num">Prix unit.</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>
      ${
        lines.length
          ? lines
              .map(
                (l) => `
            <tr>
              <td>${escapeHtml(l.desc)}</td>
              <td>${escapeHtml(l.code)}</td>
              <td class="num">${Number(l.qty).toFixed(2)}</td>
              <td>${escapeHtml(l.unit)}</td>
              <td class="num">${Number(l.unitPrice).toFixed(2)} ${escapeHtml(currency)}</td>
              <td class="num">${Number(l.total).toFixed(2)} ${escapeHtml(currency)}</td>
            </tr>
          `
              )
              .join('')
          : `<tr><td colspan="6" class="muted">Aucune ligne</td></tr>`
      }
    </tbody>
  </table>

  <div class="totals">
    <div style="width: 320px;">
      <div class="row"><span>Sous-total</span><span>${subtotal.toFixed(2)} ${escapeHtml(currency)}</span></div>
      ${tax > 0 ? `<div class="row"><span>TVA</span><span>${tax.toFixed(2)} ${escapeHtml(currency)}</span></div>` : ''}
      <div class="row bold"><span>Total</span><span>${total.toFixed(2)} ${escapeHtml(currency)}</span></div>
    </div>
  </div>

  <div class="footer">
    Créé par: ${escapeHtml(order.created_by || 'N/A')}
    ${order.sent_at ? ` • Envoyé: ${format(new Date(order.sent_at), 'dd/MM/yyyy HH:mm', { locale: fr })}` : ''}
    ${order.confirmed_at ? ` • Confirmé: ${format(new Date(order.confirmed_at), 'dd/MM/yyyy HH:mm', { locale: fr })}` : ''}
  </div>

  <script>
    window.focus();
    setTimeout(() => window.print(), 300);
  </script>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}
