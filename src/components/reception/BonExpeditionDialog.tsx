import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Loader2, Printer, RefreshCw, Save, Truck } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useAuthContext } from '@/contexts/AuthContext';
import { useDocumentPrint, useSaveDocumentPrint, useUpdateDocumentPrint } from '@/hooks/useDocumentPrints';
import type { BonExpeditionFormData } from '@/types/documentPrints';
import type { ReceptionLot, ReceptionV2 } from '@/types/reception';

interface BonExpeditionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reception: ReceptionV2;
  lots: ReceptionLot[];
}

type ProductKey = keyof BonExpeditionFormData['products'];

const PRODUCT_ROWS: Array<{ key: ProductKey; label: string }> = [
  { key: 'branche1', label: 'Branche 1ère' },
  { key: 'branche2', label: 'Branche 2ème' },
  { key: 'vrac', label: 'Vrac' },
  { key: 'vrac_sec', label: 'Vrac Sèche' },
  { key: 'branche_sec', label: 'Branche Sèche' },
  { key: 'alig_khouat', label: 'Alig / Khouat' },
];

const UNIT_LABELS: Record<string, string> = {
  GC: 'GC',
  PLOX: 'GCM',
  PL: 'P',
  PALETTE: 'P',
  LAMME: 'L',
  CAISSE: 'C',
};

const fmtWeight = (value: number | null | undefined) =>
  value == null || Number.isNaN(value)
    ? ''
    : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

function classifyLot(lot: ReceptionLot): ProductKey {
  const value = `${lot.variety ?? ''} ${lot.lot_supplier ?? ''}`.toLowerCase();
  if (value.includes('alig') || value.includes('khouat') || value.includes('allig')) return 'alig_khouat';
  if (value.includes('vrac sèche') || value.includes('vrac seche') || value.includes('vrac sec')) return 'vrac_sec';
  if (value.includes('sèche') || value.includes('seche') || value.includes('brs')) return 'branche_sec';
  if (value.includes('1ère') || value.includes('1ere') || value.includes('premiere') || value.includes('br1')) return 'branche1';
  if (value.includes('2ème') || value.includes('2eme') || value.includes('deuxieme') || value.includes('br2')) return 'branche2';
  if (value.includes('vrac')) return 'vrac';
  return 'branche2';
}

function buildDerivedRow(rowLots: ReceptionLot[]): BonExpeditionFormData['products'][ProductKey] {
  const counts = new Map<string, number>();

  rowLots.forEach((lot) => {
    (lot.units ?? []).forEach((unit) => {
      const label = UNIT_LABELS[unit.unit_type] || unit.unit_type;
      if (!label) return;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
  });

  const orderedLabels = ['GC', 'GCM', 'P', 'L', 'C'];
  const nature = orderedLabels.filter((label) => (counts.get(label) ?? 0) > 0).join('/');
  const quantities = orderedLabels
    .filter((label) => (counts.get(label) ?? 0) > 0)
    .map((label) => String(counts.get(label)))
    .join('/');
  const totalKg = rowLots.reduce((sum, lot) => sum + Number(lot.quantity || 0), 0);

  return {
    nature_caisse: nature,
    quantite_caisse: quantities || (totalKg > 0 ? `${fmtWeight(totalKg)} kg` : ''),
    observation: '',
    source_lots: rowLots.map((lot) => lot.lot_internal || lot.lot_supplier).filter(Boolean) as string[],
    total_kg: totalKg > 0 ? Number(totalKg.toFixed(2)) : null,
  };
}

function buildDerivedProducts(lots: ReceptionLot[]): BonExpeditionFormData['products'] {
  const grouped = Object.fromEntries(
    PRODUCT_ROWS.map(({ key }) => [key, [] as ReceptionLot[]]),
  ) as Record<ProductKey, ReceptionLot[]>;

  lots.forEach((lot) => {
    grouped[classifyLot(lot)].push(lot);
  });

  return Object.fromEntries(
    PRODUCT_ROWS.map(({ key }) => [key, buildDerivedRow(grouped[key])]),
  ) as BonExpeditionFormData['products'];
}

function makeDefaultForm(reception: ReceptionV2, lots: ReceptionLot[]): BonExpeditionFormData {
  const actualArrival = reception.actual_arrival_date ? new Date(reception.actual_arrival_date) : new Date();
  const supplierCode = reception.supplier?.code ?? reception.supplier_code_snapshot ?? '';
  const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? '';

  return {
    version: 2,
    document_number: reception.delivery_note_number ?? reception.reception_number ?? '',
    year: format(actualArrival, 'yyyy', { locale: fr }),
    document_date: format(actualArrival, 'yyyy-MM-dd', { locale: fr }),
    lieu_expedition: reception.origin_oasis ?? reception.storage_zone_code ?? '',
    supplier_code: supplierCode,
    supplier_name: supplierName,
    conventional: reception.bio_declared !== true,
    tn_bio_001: reception.bio_declared === true,
    ggp: false,
    vehicle_number: reception.vehicle_number ?? '',
    driver_name: reception.driver_name ?? '',
    lieu_reception: reception.storage_zone_code ?? '',
    controleur_code: '',
    responsable_nom: '',
    signataire_nom: '',
    general_observation: '',
    casse_gc: '',
    casse_p: '',
    casse_l: '',
    products: buildDerivedProducts(lots),
  };
}

function mergeBonExpeditionForm(
  defaults: BonExpeditionFormData,
  rawValue: unknown,
): BonExpeditionFormData {
  const raw = rawValue && typeof rawValue === 'object' ? (rawValue as Record<string, unknown>) : {};
  const rawProducts = raw.products && typeof raw.products === 'object'
    ? (raw.products as Record<string, unknown>)
    : {};

  const legacyObservations: Record<ProductKey, string> = {
    branche1: typeof raw.obs_branche1 === 'string' ? raw.obs_branche1 : '',
    branche2: typeof raw.obs_branche2 === 'string' ? raw.obs_branche2 : '',
    vrac: typeof raw.obs_vrac === 'string' ? raw.obs_vrac : '',
    vrac_sec: typeof raw.obs_vrac_sec === 'string' ? raw.obs_vrac_sec : '',
    branche_sec: typeof raw.obs_branche_sec === 'string' ? raw.obs_branche_sec : '',
    alig_khouat: typeof raw.obs_alig === 'string' ? raw.obs_alig : '',
  };

  const products = Object.fromEntries(
    PRODUCT_ROWS.map(({ key }) => {
      const base = defaults.products[key];
      const rawRow = rawProducts[key] && typeof rawProducts[key] === 'object'
        ? (rawProducts[key] as Record<string, unknown>)
        : {};

      return [key, {
        nature_caisse: typeof rawRow.nature_caisse === 'string' ? rawRow.nature_caisse : base.nature_caisse,
        quantite_caisse: typeof rawRow.quantite_caisse === 'string' ? rawRow.quantite_caisse : base.quantite_caisse,
        observation: typeof rawRow.observation === 'string'
          ? rawRow.observation
          : legacyObservations[key] || base.observation,
        source_lots: Array.isArray(rawRow.source_lots)
          ? rawRow.source_lots.map((entry) => String(entry ?? '')).filter(Boolean)
          : base.source_lots,
        total_kg: typeof rawRow.total_kg === 'number' ? rawRow.total_kg : base.total_kg,
      }];
    }),
  ) as BonExpeditionFormData['products'];

  return {
    version: typeof raw.version === 'number' ? raw.version : defaults.version,
    document_number: typeof raw.document_number === 'string' ? raw.document_number : defaults.document_number,
    year: typeof raw.year === 'string' ? raw.year : defaults.year,
    document_date: typeof raw.document_date === 'string' ? raw.document_date : defaults.document_date,
    lieu_expedition: typeof raw.lieu_expedition === 'string'
      ? raw.lieu_expedition
      : defaults.lieu_expedition,
    supplier_code: typeof raw.supplier_code === 'string' ? raw.supplier_code : defaults.supplier_code,
    supplier_name: typeof raw.supplier_name === 'string' ? raw.supplier_name : defaults.supplier_name,
    conventional: typeof raw.conventional === 'boolean'
      ? raw.conventional
      : defaults.conventional,
    tn_bio_001: typeof raw.tn_bio_001 === 'boolean'
      ? raw.tn_bio_001
      : defaults.tn_bio_001,
    ggp: typeof raw.ggp === 'boolean' ? raw.ggp : false,
    vehicle_number: typeof raw.vehicle_number === 'string' ? raw.vehicle_number : defaults.vehicle_number,
    driver_name: typeof raw.driver_name === 'string' ? raw.driver_name : defaults.driver_name,
    lieu_reception: typeof raw.lieu_reception === 'string'
      ? raw.lieu_reception
      : defaults.lieu_reception,
    controleur_code: typeof raw.controleur_code === 'string' ? raw.controleur_code : defaults.controleur_code,
    responsable_nom: typeof raw.responsable_nom === 'string' ? raw.responsable_nom : defaults.responsable_nom,
    signataire_nom: typeof raw.signataire_nom === 'string' ? raw.signataire_nom : defaults.signataire_nom,
    general_observation: typeof raw.general_observation === 'string' ? raw.general_observation : '',
    casse_gc: typeof raw.casse_gc === 'string' ? raw.casse_gc : '',
    casse_p: typeof raw.casse_p === 'string' ? raw.casse_p : '',
    casse_l: typeof raw.casse_l === 'string' ? raw.casse_l : '',
    products,
  };
}

function buildPrintHtml(form: BonExpeditionFormData, reception: ReceptionV2) {
  const blue = '#2154a3';
  const productRows = PRODUCT_ROWS.map(({ key, label }) => {
    const row = form.products[key];
    return `
      <tr>
        <td class="product">${escapeHtml(label)}</td>
        <td class="cell center">${escapeHtml(row.nature_caisse)}</td>
        <td class="cell center">${escapeHtml(row.quantite_caisse)}</td>
        <td class="cell">${escapeHtml(row.observation)}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Bon d'expédition ${escapeHtml(form.document_number || reception.reception_number)}</title>
    <style>
      @page { size: A4 landscape; margin: 7mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, sans-serif; color: ${blue}; }
      .sheet { border: 2px solid ${blue}; padding: 0; }
      .top-grid { width: 100%; border-collapse: collapse; }
      .top-grid td { border: 2px solid ${blue}; padding: 8px 10px; vertical-align: top; }
      .title { font-size: 24px; font-weight: 900; text-align: center; letter-spacing: 0.6px; }
      .subline { margin-top: 8px; display: flex; justify-content: center; gap: 18px; font-size: 14px; }
      .check { display: inline-flex; align-items: center; gap: 5px; }
      .box { display: inline-block; width: 16px; height: 16px; border: 2px solid ${blue}; text-align: center; line-height: 12px; font-size: 12px; font-weight: 900; }
      .logo { font-size: 18px; font-weight: 900; line-height: 1; }
      .logo small { display: block; font-size: 11px; font-weight: 700; opacity: 0.7; margin-top: 2px; }
      .label { font-size: 12px; font-weight: 700; }
      .value { border-bottom: 1px dotted ${blue}; min-height: 18px; padding: 1px 2px; color: #111; }
      .form-table { width: 100%; border-collapse: collapse; }
      .form-table td, .form-table th { border: 2px solid ${blue}; padding: 6px 8px; }
      .form-table th { font-size: 12px; font-weight: 700; text-align: center; }
      .product { width: 27%; font-size: 12px; font-weight: 700; }
      .cell { height: 38px; color: #111; font-size: 13px; }
      .center { text-align: center; }
      .sidebar { width: 26%; vertical-align: top; }
      .sidebar-block { padding: 6px 0; border-bottom: 2px solid ${blue}; }
      .sidebar-block:last-child { border-bottom: 0; }
      .side-sign { height: 86px; }
      .bottom-grid { width: 100%; border-collapse: collapse; }
      .bottom-grid td { border: 2px solid ${blue}; padding: 8px; vertical-align: top; }
      .casse-table { width: 100%; border-collapse: collapse; }
      .casse-table td, .casse-table th { border: 2px solid ${blue}; padding: 5px 8px; }
      .sign-box { height: 86px; }
      .foot { font-size: 11px; color: ${blue}; padding-top: 6px; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <table class="top-grid">
        <tr>
          <td style="width: 18%;">
            <div class="logo">RoyalPalm<small>Group</small></div>
          </td>
          <td style="width: 58%;">
            <div class="title">BON D'EXPEDITION</div>
            <div class="subline">
              <span class="check"><span class="box">${form.conventional ? 'X' : ''}</span>Conventionnel</span>
              <span class="check"><span class="box">${form.tn_bio_001 ? 'X' : ''}</span>TN-Bio-001</span>
              <span class="check"><span class="box">${form.ggp ? 'X' : ''}</span>GGP</span>
            </div>
          </td>
          <td style="width: 24%;">
            <div class="label">Année</div>
            <div class="value">${escapeHtml(form.year)}</div>
            <div class="label" style="margin-top: 10px;">Nr.</div>
            <div class="value">${escapeHtml(form.document_number)}</div>
          </td>
        </tr>
      </table>

      <table class="form-table" style="border-top: 0;">
        <tr>
          <td style="width: 74%;">
            <div class="label">Lieu :</div>
            <div class="value">${escapeHtml(form.lieu_expedition)}</div>
          </td>
          <td class="sidebar">
            <div class="label">Date :</div>
            <div class="value">${escapeHtml(form.document_date)}</div>
          </td>
        </tr>
        <tr>
          <td>
            <div class="label">Code Fournisseur :</div>
            <div class="value">${escapeHtml(form.supplier_code)} ${form.supplier_name ? `- ${escapeHtml(form.supplier_name)}` : ''}</div>
          </td>
          <td class="sidebar">
            <div class="label">Code Contrôleur :</div>
            <div class="value">${escapeHtml(form.controleur_code)}</div>
          </td>
        </tr>
      </table>

      <table class="form-table" style="border-top: 0;">
        <tr>
          <th style="width: 21%;">Produit</th>
          <th style="width: 18%;">Nature de caisse</th>
          <th style="width: 18%;">Quantité de caisse</th>
          <th style="width: 17%;">Observation</th>
          <th style="width: 26%;"></th>
        </tr>
        ${productRows}
        <tr>
          <td colspan="4" style="padding: 0;">
            <table class="casse-table">
              <tr>
                <td style="width: 18%; font-weight: 700;">Casse</td>
                <th>GC</th>
                <th>P</th>
                <th>L</th>
              </tr>
              <tr>
                <td style="font-weight: 700;">Quantité</td>
                <td class="center cell">${escapeHtml(form.casse_gc)}</td>
                <td class="center cell">${escapeHtml(form.casse_p)}</td>
                <td class="center cell">${escapeHtml(form.casse_l)}</td>
              </tr>
            </table>
          </td>
          <td class="sidebar" rowspan="2" style="padding: 0;">
            <div class="sidebar-block">
              <div class="label" style="padding: 0 8px;">Camion :</div>
              <div class="value" style="margin: 0 8px;">${escapeHtml(form.vehicle_number)}</div>
            </div>
            <div class="sidebar-block">
              <div class="label" style="padding: 0 8px;">Chauffeur :</div>
              <div class="value" style="margin: 0 8px;">${escapeHtml(form.driver_name)}</div>
            </div>
            <div class="sidebar-block">
              <div class="label" style="padding: 0 8px;">Lieu de réception :</div>
              <div class="value" style="margin: 0 8px;">${escapeHtml(form.lieu_reception)}</div>
            </div>
            <div class="sidebar-block">
              <div class="label" style="padding: 0 8px;">Responsable réception :</div>
              <div class="value" style="margin: 0 8px;">${escapeHtml(form.responsable_nom)}</div>
            </div>
            <div class="side-sign" style="padding: 8px;">
              <div class="label">Nom et signature</div>
              <div class="value" style="height: 52px;">${escapeHtml(form.responsable_nom)}</div>
            </div>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="vertical-align: top;">
            <div class="label">Nom et Signature</div>
            <div class="value sign-box">${escapeHtml(form.signataire_nom)}</div>
          </td>
          <td colspan="2" style="vertical-align: top;">
            <div class="label">Observation générale</div>
            <div class="value sign-box">${escapeHtml(form.general_observation)}</div>
          </td>
        </tr>
      </table>

      <div class="foot">
        V02 - 2023 &nbsp;|&nbsp; Réception ${escapeHtml(reception.reception_number)} &nbsp;|&nbsp; Poids net ${escapeHtml(fmtWeight(reception.quantity_total))} ${escapeHtml(reception.unit || 'kg')}
      </div>
    </div>
  </body>
</html>`;
}

export const BonExpeditionDialog = ({ open, onOpenChange, reception, lots }: BonExpeditionDialogProps) => {
  const { profile, user } = useAuthContext();
  const { data: saved } = useDocumentPrint(reception.id, 'BON_EXPEDITION');
  const saveDoc = useSaveDocumentPrint(reception.id, 'BON_EXPEDITION');
  const updateDoc = useUpdateDocumentPrint(reception.id, 'BON_EXPEDITION');

  const defaults = useMemo(() => makeDefaultForm(reception, lots), [reception, lots]);
  const [form, setForm] = useState<BonExpeditionFormData>(defaults);

  useEffect(() => {
    if (!open) return;
    if (saved?.form_data) {
      setForm(mergeBonExpeditionForm(defaults, saved.form_data));
      return;
    }
    setForm(defaults);
  }, [defaults, open, saved]);

  const actorName = profile?.full_name?.trim() || user?.email || 'Utilisateur';

  const setField = <K extends keyof BonExpeditionFormData>(key: K, value: BonExpeditionFormData[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setProductField = (
    key: ProductKey,
    field: keyof BonExpeditionFormData['products'][ProductKey],
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      products: {
        ...current.products,
        [key]: {
          ...current.products[key],
          [field]: value,
        },
      },
    }));
  };

  const handleCertificationToggle = (field: 'conventional' | 'tn_bio_001' | 'ggp', checked: boolean) => {
    setForm((current) => {
      if (field === 'ggp') {
        return { ...current, ggp: checked };
      }
      if (field === 'conventional') {
        return { ...current, conventional: checked, tn_bio_001: checked ? false : current.tn_bio_001 };
      }
      return { ...current, tn_bio_001: checked, conventional: checked ? false : current.conventional };
    });
  };

  const persistPayload = {
    document_type: 'BON_EXPEDITION' as const,
    source_id: reception.id,
    source_number: reception.reception_number,
    template_version: 2,
    form_data: form,
  };

  const handleSave = async () => saveDoc.mutateAsync(persistPayload);

  const handlePrint = async () => {
    const persisted = await handleSave();
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=860');
    if (!printWindow) return;
    printWindow.document.write(buildPrintHtml(form, reception));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);

    if (persisted?.id) {
      await updateDoc.mutateAsync({
        id: persisted.id,
        print_count: (persisted.print_count ?? 0) + 1,
        last_printed_at: new Date().toISOString(),
        last_printed_by: actorName,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Bon d&apos;Expédition Fournisseur — {reception.delivery_note_number ?? reception.reception_number}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[78vh] pr-3">
          <div className="space-y-4">
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Résumé source</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4 text-sm">
                <div><span className="text-muted-foreground">Réception :</span> <strong>{reception.reception_number}</strong></div>
                <div><span className="text-muted-foreground">Fournisseur :</span> <strong>{defaults.supplier_name || '—'}</strong></div>
                <div><span className="text-muted-foreground">Date :</span> <strong>{format(new Date(reception.actual_arrival_date), 'dd/MM/yyyy', { locale: fr })}</strong></div>
                <div><span className="text-muted-foreground">Poids net :</span> <strong>{fmtWeight(reception.quantity_total)} {reception.unit}</strong></div>
                <div><span className="text-muted-foreground">Lots liés :</span> <strong>{lots.length}</strong></div>
                <div><span className="text-muted-foreground">Camion :</span> <strong>{reception.vehicle_number || '—'}</strong></div>
                <div><span className="text-muted-foreground">Chauffeur :</span> <strong>{reception.driver_name || '—'}</strong></div>
                <div>
                  <span className="text-muted-foreground">Impressions :</span>{' '}
                  <strong>{saved?.print_count ?? 0}</strong>
                  {saved?.last_printed_at ? (
                    <span className="text-xs text-muted-foreground"> · {format(new Date(saved.last_printed_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</span>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm">Entête du document</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setForm((current) => ({
                      ...mergeBonExpeditionForm(defaults, current),
                      products: buildDerivedProducts(lots),
                    }))}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Recharger depuis les lots
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Année</Label>
                    <Input value={form.year} onChange={(e) => setField('year', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">N° document</Label>
                    <Input value={form.document_number} onChange={(e) => setField('document_number', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={form.document_date} onChange={(e) => setField('document_date', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lieu</Label>
                    <Input value={form.lieu_expedition} onChange={(e) => setField('lieu_expedition', e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Code fournisseur</Label>
                    <Input value={form.supplier_code} onChange={(e) => setField('supplier_code', e.target.value)} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">Nom fournisseur</Label>
                    <Input value={form.supplier_name} onChange={(e) => setField('supplier_name', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Code contrôleur</Label>
                    <Input value={form.controleur_code} onChange={(e) => setField('controleur_code', e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Camion</Label>
                    <Input value={form.vehicle_number} onChange={(e) => setField('vehicle_number', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Chauffeur</Label>
                    <Input value={form.driver_name} onChange={(e) => setField('driver_name', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lieu de réception</Label>
                    <Input value={form.lieu_reception} onChange={(e) => setField('lieu_reception', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Responsable réception</Label>
                    <Input value={form.responsable_nom} onChange={(e) => setField('responsable_nom', e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nom du signataire</Label>
                    <Input value={form.signataire_nom} onChange={(e) => setField('signataire_nom', e.target.value)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-5 pt-6">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.conventional}
                        onCheckedChange={(checked) => handleCertificationToggle('conventional', Boolean(checked))}
                      />
                      Conventionnel
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.tn_bio_001}
                        onCheckedChange={(checked) => handleCertificationToggle('tn_bio_001', Boolean(checked))}
                      />
                      TN-Bio-001
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.ggp}
                        onCheckedChange={(checked) => handleCertificationToggle('ggp', Boolean(checked))}
                      />
                      GGP
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Lignes produit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="hidden md:grid md:grid-cols-[1.2fr_1fr_1fr_1.5fr] gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <div>Produit</div>
                  <div>Nature de caisse</div>
                  <div>Quantité de caisse</div>
                  <div>Observation</div>
                </div>

                {PRODUCT_ROWS.map(({ key, label }) => {
                  const row = form.products[key];
                  return (
                    <div key={key} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1.2fr_1fr_1fr_1.5fr]">
                      <div>
                        <div className="font-medium">{label}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {row.source_lots.length > 0
                            ? `Lots: ${row.source_lots.join(', ')}`
                            : 'Aucun lot détecté'}
                          {row.total_kg ? ` · ${fmtWeight(row.total_kg)} kg` : ''}
                        </div>
                      </div>
                      <Input
                        value={row.nature_caisse}
                        onChange={(e) => setProductField(key, 'nature_caisse', e.target.value)}
                        placeholder="Ex: GCRP/GCM"
                      />
                      <Input
                        value={row.quantite_caisse}
                        onChange={(e) => setProductField(key, 'quantite_caisse', e.target.value)}
                        placeholder="Ex: 40/4/16"
                      />
                      <Input
                        value={row.observation}
                        onChange={(e) => setProductField(key, 'observation', e.target.value)}
                        placeholder="Observation..."
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Casse et remarques</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Casse GC</Label>
                    <Input value={form.casse_gc} onChange={(e) => setField('casse_gc', e.target.value)} placeholder="Quantité GC" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Casse P</Label>
                    <Input value={form.casse_p} onChange={(e) => setField('casse_p', e.target.value)} placeholder="Quantité P" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Casse L</Label>
                    <Input value={form.casse_l} onChange={(e) => setField('casse_l', e.target.value)} placeholder="Quantité L" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Observation générale</Label>
                  <Textarea
                    value={form.general_observation}
                    onChange={(e) => setField('general_observation', e.target.value)}
                    rows={4}
                    placeholder="Remarques supplémentaires, état du chargement, consignes..."
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button variant="outline" onClick={() => void handleSave()} disabled={saveDoc.isPending}>
            {saveDoc.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Sauvegarder
          </Button>
          <Button onClick={() => void handlePrint()} disabled={saveDoc.isPending || updateDoc.isPending}>
            {(saveDoc.isPending || updateDoc.isPending) ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
