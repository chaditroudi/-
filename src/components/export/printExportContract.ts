import type { ExportOrder, ExportContract, BuyerCountry, ContractLanguage } from '@/types/exportOrders';

// ── Clause text per language ──────────────────────────────────────────────────

const T = {
  fr: {
    title:            'CONTRAT DE VENTE À L\'EXPORT',
    contract_ref:     'Référence contrat',
    order_ref:        'Référence commande',
    version:          'Version',
    date:             'Date',
    seller:           'VENDEUR',
    buyer:            'ACHETEUR',
    country:          'Pays',
    address:          'Adresse',
    contact:          'Contact',
    incoterms:        'Incoterms',
    port_loading:     'Port de chargement',
    port_dest:        'Port de destination',
    products:         'DÉTAIL DES PRODUITS',
    lot_ref:          'Référence lot',
    product:          'Produit',
    origin:           'Origine',
    harvest:          'Récolte',
    grade:            'Grade',
    net_weight:       'Poids net (kg)',
    unit_price:       'Prix unitaire',
    total:            'Total',
    grand_total:      'TOTAL GÉNÉRAL',
    traceability:     'TRAÇABILITÉ & CERTIFICATIONS',
    coa_ref:          'Réf. COA',
    certif:           'Certifications',
    special_clauses:  'CLAUSES SPÉCIALES',
    signatures:       'SIGNATURES',
    seller_sig:       'Signature vendeur',
    buyer_sig:        'Signature acheteur',
    date_sig:         'Date',
    page:             'Page',
    generated:        'Document généré le',
    hash:             'Empreinte SHA-256',
    status_locked:    'DOCUMENT VERROUILLÉ — approuvé et signé électroniquement',
  },
  en: {
    title:            'EXPORT SALES CONTRACT',
    contract_ref:     'Contract reference',
    order_ref:        'Order reference',
    version:          'Version',
    date:             'Date',
    seller:           'SELLER',
    buyer:            'BUYER',
    country:          'Country',
    address:          'Address',
    contact:          'Contact',
    incoterms:        'Incoterms',
    port_loading:     'Port of loading',
    port_dest:        'Port of destination',
    products:         'PRODUCT DETAILS',
    lot_ref:          'Lot reference',
    product:          'Product',
    origin:           'Origin',
    harvest:          'Harvest date',
    grade:            'Grade',
    net_weight:       'Net weight (kg)',
    unit_price:       'Unit price',
    total:            'Total',
    grand_total:      'GRAND TOTAL',
    traceability:     'TRACEABILITY & CERTIFICATIONS',
    coa_ref:          'COA Ref.',
    certif:           'Certifications',
    special_clauses:  'SPECIAL CLAUSES',
    signatures:       'SIGNATURES',
    seller_sig:       'Seller signature',
    buyer_sig:        'Buyer signature',
    date_sig:         'Date',
    page:             'Page',
    generated:        'Document generated on',
    hash:             'SHA-256 fingerprint',
    status_locked:    'LOCKED DOCUMENT — electronically approved and signed',
  },
  ar: {
    title:            'عقد بيع للتصدير',
    contract_ref:     'مرجع العقد',
    order_ref:        'مرجع الطلب',
    version:          'الإصدار',
    date:             'التاريخ',
    seller:           'البائع',
    buyer:            'المشتري',
    country:          'البلد',
    address:          'العنوان',
    contact:          'جهة الاتصال',
    incoterms:        'شروط التسليم',
    port_loading:     'ميناء الشحن',
    port_dest:        'ميناء الوجهة',
    products:         'تفاصيل المنتجات',
    lot_ref:          'مرجع الدفعة',
    product:          'المنتج',
    origin:           'المنشأ',
    harvest:          'تاريخ الحصاد',
    grade:            'الدرجة',
    net_weight:       'الوزن الصافي (كغ)',
    unit_price:       'سعر الوحدة',
    total:            'المجموع',
    grand_total:      'المجموع الإجمالي',
    traceability:     'إمكانية التتبع والشهادات',
    coa_ref:          'مرجع COA',
    certif:           'الشهادات',
    special_clauses:  'بنود خاصة',
    signatures:       'التواقيع',
    seller_sig:       'توقيع البائع',
    buyer_sig:        'توقيع المشتري',
    date_sig:         'التاريخ',
    page:             'صفحة',
    generated:        'تم إنشاء المستند في',
    hash:             'بصمة SHA-256',
    status_locked:    'مستند مقفل — تمت الموافقة عليه والتوقيع إلكترونيًا',
  },
} as const;

// ── Country-specific special clauses ─────────────────────────────────────────

const CLAUSES: Record<BuyerCountry, Record<ContractLanguage, string[]>> = {
  EU: {
    fr: [
      '<strong>Incoterms 2020 :</strong> Les présentes conditions sont régies par les Incoterms 2020 de la CCI.',
      '<strong>Règlement EUDR (UE 2023/1115) :</strong> Le vendeur garantit que les produits proviennent de terres non soumises à la déforestation après le 31 décembre 2020, conformément au règlement de l\'Union européenne sur la déforestation.',
      '<strong>Certification biologique :</strong> Les lots livré portent la certification TN-BIO-001 reconnue en équivalence avec le règlement (CE) 834/2007.',
      '<strong>Traçabilité :</strong> Un certificat d\'analyse (COA) par lot est joint au présent contrat.',
    ],
    en: [
      '<strong>Incoterms 2020:</strong> These terms are governed by ICC Incoterms 2020.',
      '<strong>EUDR Compliance (EU 2023/1115):</strong> The seller certifies that products originate from land not subject to deforestation after 31 December 2020, in accordance with the EU Deforestation Regulation.',
      '<strong>Organic Certification:</strong> Delivered lots carry the TN-BIO-001 certification recognised in equivalence with Regulation (EC) 834/2007.',
      '<strong>Traceability:</strong> A Certificate of Analysis (COA) per lot is attached to this contract.',
    ],
    ar: [
      '<strong>إنكوترمز 2020:</strong> تخضع هذه الشروط لإنكوترمز 2020 الصادر عن غرفة التجارة الدولية.',
      '<strong>الامتثال لـ EUDR (الاتحاد الأوروبي 2023/1115):</strong> يؤكد البائع أن المنتجات تأتي من أراضٍ غير خاضعة لإزالة الغابات بعد 31 ديسمبر 2020.',
      '<strong>شهادة عضوية:</strong> الدفعات المسلمة تحمل شهادة TN-BIO-001.',
      '<strong>إمكانية التتبع:</strong> يُرفق بهذا العقد شهادة تحليل (COA) لكل دفعة.',
    ],
  },
  USA: {
    fr: [
      '<strong>FDA Prior Notice :</strong> Conformément au Bioterrorism Act of 2002, un Prior Notice a été soumis à la FDA avant expédition. Référence à indiquer sur les documents douaniers.',
      '<strong>Incoterms 2020 :</strong> Les présentes conditions sont régies par les Incoterms 2020 de la CCI.',
      '<strong>FSMA :</strong> Les conditions de production et d\'hygiène sont conformes au Food Safety Modernization Act (FSMA, 21 CFR Part 112).',
      '<strong>Étiquetage :</strong> Les étiquettes produit sont conformes aux exigences FDA 21 CFR Part 101.',
    ],
    en: [
      '<strong>FDA Prior Notice:</strong> Pursuant to the Bioterrorism Act of 2002, a Prior Notice has been submitted to the FDA prior to shipment. Reference to be indicated on customs documents.',
      '<strong>Incoterms 2020:</strong> These terms are governed by ICC Incoterms 2020.',
      '<strong>FSMA Compliance:</strong> Production and hygiene conditions comply with the Food Safety Modernization Act (FSMA, 21 CFR Part 112).',
      '<strong>Labeling:</strong> Product labels comply with FDA 21 CFR Part 101 requirements.',
    ],
    ar: [
      '<strong>إشعار FDA المسبق:</strong> تم تقديم إشعار مسبق إلى إدارة الغذاء والدواء الأمريكية قبل الشحن وفقًا لقانون مكافحة الإرهاب البيولوجي لعام 2002.',
      '<strong>إنكوترمز 2020:</strong> تخضع هذه الشروط لإنكوترمز 2020.',
      '<strong>الامتثال لـ FSMA:</strong> تتوافق ظروف الإنتاج والنظافة مع قانون تحديث سلامة الغذاء.',
    ],
  },
  SA: {
    fr: [
      '<strong>SFDA :</strong> Les produits sont conformes aux exigences de la Saudi Food and Drug Authority (SFDA). Numéro d\'enregistrement importateur : à compléter par l\'acheteur.',
      '<strong>Halal :</strong> Les produits sont certifiés Halal conformément aux normes de l\'Organisation islamique pour la sécurité alimentaire (OISA/SMIIC).',
      '<strong>Étiquetage arabe :</strong> Les étiquettes comportent les mentions obligatoires en langue arabe conformément aux réglementations GCC.',
      '<strong>Incoterms 2020 :</strong> CIF Jeddah / Dammam, sauf accord contraire.',
    ],
    en: [
      '<strong>SFDA Compliance:</strong> Products comply with Saudi Food and Drug Authority (SFDA) requirements. Importer registration number: to be completed by the buyer.',
      '<strong>Halal Certification:</strong> Products are Halal certified in accordance with the Islamic Organisation for Food Security (IOFS/SMIIC) standards.',
      '<strong>Arabic Labeling:</strong> Labels include mandatory mentions in Arabic language in accordance with GCC regulations.',
      '<strong>Incoterms 2020:</strong> CIF Jeddah / Dammam, unless otherwise agreed.',
    ],
    ar: [
      '<strong>الامتثال لـ SFDA:</strong> تستوفي المنتجات متطلبات الهيئة السعودية للغذاء والدواء. رقم تسجيل المستورد: يكمله المشتري.',
      '<strong>شهادة حلال:</strong> المنتجات معتمدة حلال وفقًا لمعايير المنظمة الإسلامية لسلامة الغذاء.',
      '<strong>الملصقات العربية:</strong> تتضمن الملصقات البيانات الإلزامية باللغة العربية وفق لوائح مجلس التعاون.',
      '<strong>إنكوترمز 2020:</strong> CIF جدة / الدمام، ما لم يُتفق على خلاف ذلك.',
    ],
  },
};

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildContractHTML(
  order: ExportOrder,
  contract: ExportContract,
): string {
  const lang = contract.language;
  const t = T[lang];
  const clauses = CLAUSES[contract.buyer_country]?.[lang] ?? [];
  const isRTL = lang === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';
  const now = new Date().toLocaleDateString('fr-FR');

  const currencySymbol: Record<string, string> = {
    EUR: '€', USD: '$', SAR: 'SAR ', TND: 'TND ',
  };
  const sym = currencySymbol[order.currency] ?? order.currency + ' ';

  const linesHTML = order.lines.map((line) => `
    <tr>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-family:monospace;font-size:11px">${line.lot_ref}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px">${line.product_name}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px">${line.origin_region ?? ''} ${line.origin_farm ? `— ${line.origin_farm}` : ''}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;text-align:center">${line.harvest_date ?? ''}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;text-align:center">${line.quality_grade ?? ''}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;text-align:right">${line.net_weight_kg.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;text-align:right">${sym}${line.unit_price.toFixed(4)}</td>
      <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;text-align:right;font-weight:600">${sym}${(line.net_weight_kg * line.unit_price).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  const coaRowsHTML = order.lines.map((line) => `
    <tr>
      <td style="border:1px solid #ccc;padding:3px 6px;font-family:monospace;font-size:10px">${line.lot_ref}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;font-size:10px">${line.product_name}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;font-size:10px;font-family:monospace">${line.coa_ref ?? '—'}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;font-size:10px">TN-BIO-001</td>
    </tr>
  `).join('');

  const clausesHTML = clauses.map((c) => `<li style="margin-bottom:6px;font-size:11px">${c}</li>`).join('');

  const lockBanner = contract.status === 'locked' ? `
    <div style="background:#065f46;color:white;text-align:center;padding:8px;font-size:11px;font-weight:600;margin-bottom:12px;border-radius:4px">
      ${t.status_locked}
    </div>
    <div style="text-align:center;font-size:9px;color:#555;margin-bottom:12px;font-family:monospace">
      ${t.hash}: ${contract.doc_hash ?? '—'}
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8"/>
  <title>${t.title} — ${contract.contract_ref}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; padding: 0; }
    @page { size: A4; margin: 14mm; }
    @media print { body { margin: 0; } }
    .page { width: 210mm; min-height: 297mm; padding: 14mm; margin: 0 auto; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1a5276; color: white; padding: 5px 6px; font-size: 10px; }
    section { margin-bottom: 16px; }
    h2 { font-size: 12px; color: #1a5276; border-bottom: 1.5px solid #1a5276; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase; }
  </style>
</head>
<body>
<div class="page">
  ${lockBanner}

  <!-- Header -->
  <div style="display:flex;align-items:stretch;border:2px solid #1a5276;margin-bottom:12px">
    <div style="min-width:100px;border-right:1px solid #1a5276;display:flex;align-items:center;justify-content:center;padding:8px">
      <div style="text-align:center">
        <div style="color:#107754;font-weight:700;font-size:16px;line-height:1.1">Royal</div>
        <div style="color:#107754;font-weight:700;font-size:16px;line-height:1.1">Palm</div>
        <div style="color:#888;font-size:8px">Group</div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;border-right:1px solid #1a5276">
      <div style="font-size:15px;font-weight:700;color:#1a5276;text-align:center">${t.title}</div>
      <div style="font-size:10px;color:#555;margin-top:4px">Groupe Ennour Investissement — Tozeur, Tunisie</div>
    </div>
    <div style="min-width:160px;padding:10px;font-size:10px;display:flex;flex-direction:column;gap:3px">
      <div><strong>${t.contract_ref} :</strong> ${contract.contract_ref}</div>
      <div><strong>${t.order_ref} :</strong> ${order.order_ref}</div>
      <div><strong>${t.version} :</strong> v${contract.current_version}</div>
      <div><strong>${t.date} :</strong> ${now}</div>
    </div>
  </div>

  <!-- Parties -->
  <section>
    <div style="display:flex;gap:12px">
      <div style="flex:1;border:1px solid #1a5276;padding:8px">
        <div style="font-size:10px;font-weight:700;color:#1a5276;margin-bottom:6px;text-transform:uppercase">${t.seller}</div>
        <div style="font-size:11px;font-weight:700">Groupe Ennour Investissement</div>
        <div style="font-size:10px;color:#555">Route de Nefta, Tozeur 2200, Tunisie</div>
        <div style="font-size:10px;color:#555">MF : 1234567 / A / M / 000</div>
        <div style="font-size:10px;color:#555">Tél : +216 76 000 000</div>
      </div>
      <div style="flex:1;border:1px solid #1a5276;padding:8px">
        <div style="font-size:10px;font-weight:700;color:#1a5276;margin-bottom:6px;text-transform:uppercase">${t.buyer}</div>
        <div style="font-size:11px;font-weight:700">${order.customer_name}</div>
        ${order.customer_address ? `<div style="font-size:10px;color:#555">${order.customer_address}</div>` : ''}
        ${order.customer_contact ? `<div style="font-size:10px;color:#555">${order.customer_contact}</div>` : ''}
        <div style="font-size:10px;color:#555">${t.country} : ${order.customer_country}</div>
      </div>
      <div style="min-width:150px;border:1px solid #1a5276;padding:8px;font-size:10px;display:flex;flex-direction:column;gap:3px">
        ${order.incoterms ? `<div><strong>${t.incoterms} :</strong> ${order.incoterms}</div>` : ''}
        ${order.port_of_loading ? `<div><strong>${t.port_loading} :</strong> ${order.port_of_loading}</div>` : ''}
        ${order.port_of_destination ? `<div><strong>${t.port_dest} :</strong> ${order.port_of_destination}</div>` : ''}
      </div>
    </div>
  </section>

  <!-- Product lines -->
  <section>
    <h2>${t.products}</h2>
    <table>
      <thead>
        <tr>
          <th>${t.lot_ref}</th>
          <th>${t.product}</th>
          <th>${t.origin}</th>
          <th>${t.harvest}</th>
          <th>${t.grade}</th>
          <th>${t.net_weight}</th>
          <th>${t.unit_price}</th>
          <th>${t.total}</th>
        </tr>
      </thead>
      <tbody>
        ${linesHTML}
        <tr>
          <td colspan="5" style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;font-weight:700;background:#eaf4fb;text-align:right">${t.grand_total}</td>
          <td style="border:1px solid #1a5276;padding:4px 6px;font-size:11px;font-weight:700;text-align:right">${order.total_weight_kg.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} kg</td>
          <td style="border:1px solid #1a5276"></td>
          <td style="border:1px solid #1a5276;padding:4px 6px;font-size:12px;font-weight:700;text-align:right;color:#1a5276">${sym}${order.total_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <!-- Traceability & COA -->
  <section>
    <h2>${t.traceability}</h2>
    <table>
      <thead>
        <tr>
          <th>${t.lot_ref}</th>
          <th>${t.product}</th>
          <th>${t.coa_ref}</th>
          <th>${t.certif}</th>
        </tr>
      </thead>
      <tbody>
        ${coaRowsHTML}
      </tbody>
    </table>
  </section>

  <!-- Special clauses -->
  <section>
    <h2>${t.special_clauses}</h2>
    <ul style="margin:0;padding-left:${isRTL ? '0' : '18px'};padding-right:${isRTL ? '18px' : '0'}">
      ${clausesHTML}
    </ul>
  </section>

  <!-- Signatures -->
  <section>
    <h2>${t.signatures}</h2>
    <div style="display:flex;gap:24px;margin-top:8px">
      <div style="flex:1;border-top:1.5px solid #1a5276;padding-top:8px">
        <div style="font-size:10px;font-weight:600;color:#1a5276;margin-bottom:24px">${t.seller_sig}</div>
        <div style="font-size:10px;color:#555">${t.date_sig} : ___________________</div>
      </div>
      <div style="flex:1;border-top:1.5px solid #1a5276;padding-top:8px">
        <div style="font-size:10px;font-weight:600;color:#1a5276;margin-bottom:24px">${t.buyer_sig}</div>
        <div style="font-size:10px;color:#555">${t.date_sig} : ___________________</div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <div style="border-top:1px solid #1a5276;padding-top:6px;font-size:8.5px;color:#777;display:flex;justify-content:space-between;margin-top:12px">
    <span>${t.generated} ${now} — ${contract.contract_ref} v${contract.current_version}</span>
    <span>Royal Palm Group — Groupe Ennour Investissement, Tozeur</span>
  </div>
</div>
</body>
</html>`;
}

// ── Print / download entry point ──────────────────────────────────────────────

export function getContractHTML(order: ExportOrder, contract: ExportContract): string {
  return buildContractHTML(order, contract);
}

export function printExportContract(order: ExportOrder, contract: ExportContract): void {
  const html = buildContractHTML(order, contract);
  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}
