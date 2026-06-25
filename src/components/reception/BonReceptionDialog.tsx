import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Printer, QrCode, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReceptionV2, ReceptionLot } from '@/types/reception';
import type { BonReceptionFormData } from '@/types/documentPrints';
import { useDocumentPrint, useSaveDocumentPrint } from '@/hooks/useDocumentPrints';

interface BonReceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reception: ReceptionV2;
  lots: ReceptionLot[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type LotCategory = 'branche1' | 'branche2' | 'vrac' | 'seche' | 'casse';

function categorizeLot(lot: ReceptionLot): LotCategory {
  const v = `${lot.variety ?? ''} ${lot.lot_supplier ?? ''}`.toLowerCase();
  if (v.includes('1ère') || v.includes('1ere') || v.includes('br1') || v.includes('branche 1') || v.includes('premiere')) return 'branche1';
  if (v.includes('sèche') || v.includes('seche') || v.includes('sec') || v.includes('brs') || v.includes('branche s')) return 'seche';
  if (v.includes('2ème') || v.includes('2eme') || v.includes('br2') || v.includes('branche 2') || v.includes('deuxieme')) return 'branche2';
  if (v.includes('vrac')) return 'vrac';
  if (v.includes('casse') || v.includes('cassé') || v.includes('chute')) return 'casse';
  return 'branche2';
}

function getUnitCount(lot: ReceptionLot, type: string): number {
  return lot.units?.filter((u) => u.unit_type === type).length ?? 0;
}

interface RowData {
  lots: ReceptionLot[];
  gc: number;
  rp: number;
  gcm: number;
  lame: number;
  poidsBrut: number | null;
  poidsNet: number;
  palettes: number;
  lotNums: string[];
}

function buildRowData(lotsArr: ReceptionLot[]): RowData {
  const gc = lotsArr.reduce((s, l) => s + getUnitCount(l, 'GC'), 0);
  const rp = lotsArr.reduce((s, l) => s + getUnitCount(l, 'PL') + getUnitCount(l, 'PALETTE'), 0);
  const gcm = lotsArr.reduce((s, l) => s + getUnitCount(l, 'PLOX') + getUnitCount(l, 'CAISSE'), 0);
  const lame = lotsArr.reduce((s, l) => s + getUnitCount(l, 'LAMME'), 0);
  const palettes = lotsArr.reduce((s, l) => s + getUnitCount(l, 'PALETTE'), 0);
  const poidsNet = lotsArr.reduce((s, l) => s + l.quantity, 0);
  const poidsBrut = lotsArr.reduce((s: number | null, l) => {
    const bw = l.units?.reduce((a, u) => a + (u.gross_weight ?? 0), 0) ?? null;
    if (bw === null && s === null) return null;
    return (s ?? 0) + (bw ?? 0);
  }, null);
  const lotNums = lotsArr.map((l) => l.lot_internal ?? l.lot_supplier).filter(Boolean) as string[];
  return { lots: lotsArr, gc, rp, gcm, lame, poidsBrut, poidsNet, palettes, lotNums };
}

function fmtW(v: number | null | undefined): string {
  if (v == null || v === 0) return '';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
}

function dash(v: number): string { return v === 0 ? '' : String(v); }

function buildQrPayload(reception: ReceptionV2, lots: ReceptionLot[]): string {
  return JSON.stringify({
    t: 'BRA', n: reception.reception_number,
    s: reception.supplier?.name ?? reception.supplier_name_snapshot ?? '',
    d: format(new Date(reception.actual_arrival_date), 'dd/MM/yyyy'),
    lots: lots.map((l) => ({ id: l.lot_internal ?? l.lot_supplier, q: l.quantity })),
    tot_kg: reception.quantity_total,
    bl: reception.delivery_note_number ?? '',
  });
}

const DEFAULT_FORM: BonReceptionFormData = {
  responsable_nom: '',
  rapport_gcr_number: '',
  fiche_palette_number: '',
  obs_branche1: '',
  obs_branche2: '',
  obs_vrac: '',
  obs_seche: '',
  obs_casse: '',
};

// ── Print HTML builder ─────────────────────────────────────────────────────────

function buildPrintHtml(
  form: BonReceptionFormData,
  reception: ReceptionV2,
  lots: ReceptionLot[],
  rowsData: { label: string; data: RowData }[],
  casseData: RowData,
): string {
  const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? '—';
  const supplierCode = reception.supplier?.code ?? reception.supplier_code_snapshot ?? '';
  const dateStr = format(new Date(reception.actual_arrival_date), 'dd/MM/yyyy', { locale: fr });
  const annee = format(new Date(reception.actual_arrival_date), 'yyyy');
  const heureArrivee = reception.gate_arrival_at
    ? format(new Date(reception.gate_arrival_at), 'HH:mm', { locale: fr }) : '';
  const rc = (reception.region_code ?? '').toLowerCase();
  const isKebilli = rc.includes('keb') || rc.includes('kebilli');
  const isElJirid = rc.includes('jirid') || rc.includes('tozeur') || rc.includes('toz');
  const isBio = reception.bio_declared === true;
  const lotRef = lots[0]?.lot_internal ?? lots[0]?.lot_supplier ?? '—';

  const cb = (on: boolean) => `<span style="display:inline-block;border:1.5px solid #333;width:11px;height:11px;text-align:center;line-height:11px;font-size:9px;margin-right:3px;font-weight:bold;">${on ? '✓' : ''}</span>`;

  const rows: { label: string; key: keyof Pick<BonReceptionFormData, 'obs_branche1'|'obs_branche2'|'obs_vrac'|'obs_seche'> }[] = [
    { label: 'Branche 1ère', key: 'obs_branche1' },
    { label: 'Branche 2ème', key: 'obs_branche2' },
    { label: 'Vrac', key: 'obs_vrac' },
    { label: 'Branche Sèche', key: 'obs_seche' },
  ];

  const obsMap: Record<string, string> = {
    'Branche 1ère': form.obs_branche1,
    'Branche 2ème': form.obs_branche2,
    'Vrac': form.obs_vrac,
    'Branche Sèche': form.obs_seche,
  };

  const productRows = rowsData.map(({ label, data }, idx) => `
    <tr>
      <td style="border:1px solid #444;font-weight:600;">${label}</td>
      <td style="border:1px solid #444;text-align:center;font-weight:bold;">${dash(data.gc)}</td>
      <td style="border:1px solid #444;text-align:center;font-weight:bold;">${dash(data.rp)}</td>
      <td style="border:1px solid #444;text-align:center;font-weight:bold;">${dash(data.gcm)}</td>
      <td style="border:1px solid #444;text-align:center;font-weight:bold;">${dash(data.lame)}</td>
      <td style="border:1px solid #444;text-align:right;font-weight:bold;">${fmtW(data.poidsBrut)}</td>
      <td style="border:1px solid #444;text-align:right;font-weight:bold;">
        ${data.poidsNet > 0 ? fmtW(data.poidsNet) : ''}
        ${data.poidsBrut != null && data.poidsNet > 0 && data.poidsBrut > 0 ? `<div style="font-size:8px;color:#c00;font-weight:normal;">-${fmtW(data.poidsBrut - data.poidsNet)}</div>` : ''}
      </td>
      ${idx === 0 ? `<td rowspan="${rows.length * 3 + 3}" style="border:2px solid #444;vertical-align:top;padding:6px 8px;">
        <div style="margin-bottom:6px;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;">Camion</div>
          <div style="font-weight:bold;">${reception.vehicle_number ?? '............'}</div>
        </div>
        <div style="margin-bottom:6px;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;">Chauffeur</div>
          <div style="font-weight:bold;">${reception.driver_name ?? '............'}</div>
        </div>
        <div style="border-top:1px solid #ddd;padding-top:5px;margin-bottom:6px;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;">Lieu de réception</div>
          <div style="font-weight:bold;">${reception.storage_zone_code ?? '............'}</div>
        </div>
        <div style="border-top:1px solid #ddd;padding-top:5px;margin-bottom:10px;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;">Responsable réception</div>
          <div style="font-weight:bold;">${form.responsable_nom || '........................'}</div>
          <div style="min-height:20px;border-bottom:1px solid #bbb;margin-top:2px;"></div>
        </div>
        <div style="border-top:1px solid #ddd;padding-top:5px;margin-bottom:6px;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;">N° Rapport GCR</div>
          <div style="min-height:16px;">${form.rapport_gcr_number || '............'}</div>
        </div>
        <div style="border-top:1px solid #ddd;padding-top:5px;margin-bottom:8px;">
          <div style="font-size:8px;color:#888;text-transform:uppercase;">N° fiche palette</div>
          <div style="font-weight:bold;font-size:9px;">${form.fiche_palette_number || (reception.pallet_count ? `${reception.pallet_count} pal.` : 'Voir Annex')}</div>
        </div>
      </td>` : ''}
    </tr>
    <tr style="background:#f7f7f7;">
      <td style="border:1px solid #ccc;font-size:9px;color:#666;font-style:italic;">Nbre de palette</td>
      <td colspan="2" style="border:1px solid #ccc;text-align:center;font-size:9px;">${dash(data.palettes)}</td>
      <td colspan="4" style="border:1px solid #ccc;font-size:9px;color:#777;font-family:monospace;">${data.lotNums.slice(0, 2).join(' · ')}</td>
    </tr>
    <tr style="background:#f7f7f7;">
      <td style="border:1px solid #ccc;font-size:9px;color:#666;font-style:italic;">Observation</td>
      <td colspan="6" style="border:1px solid #ccc;min-height:12px;">${obsMap[label] ?? ''}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"/>
<title>BON DE RECEPTION ACHAT ${reception.reception_number}</title>
<style>
  @page{size:A4 landscape;margin:7mm 9mm;}
  *{box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:10px;color:#111;margin:0;}
  table{border-collapse:collapse;width:100%;}
  td,th{border:1px solid #444;padding:3px 5px;vertical-align:top;}
  .bold{font-weight:bold;}
  .center{text-align:center;}
  .right{text-align:right;}
  .label{color:#666;font-size:9px;}
  .totrow td{background:#e8e8e8;font-weight:bold;font-size:11px;}
  .version{font-size:8px;color:#999;}
</style>
</head><body>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;">
  <tbody>
    <tr>
      <td style="width:14%;border:2px solid #333;vertical-align:middle;padding:6px 8px;text-align:center;">
        <div style="font-weight:900;font-size:14px;color:#1a5c2a;line-height:1.1;">Royal</div>
        <div style="font-weight:900;font-size:20px;color:#1a5c2a;line-height:1.1;">Palm</div>
        <div style="font-size:7px;color:#888;letter-spacing:1px;">GROUP</div>
      </td>
      <td style="border:2px solid #333;border-left:none;vertical-align:middle;padding:6px 10px;text-align:center;">
        <div style="font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">BON DE RECEPTION ACHAT</div>
        <div style="margin-top:6px;display:flex;justify-content:center;gap:24px;">
          <span>${cb(!isBio)}Convention</span>
          <span>${cb(isBio)}TN-Bio-001</span>
          <span>${cb(false)}GGP</span>
        </div>
      </td>
      <td style="width:17%;border:2px solid #333;border-left:none;vertical-align:top;padding:5px 8px;">
        <div style="font-size:9px;color:#777;text-transform:uppercase;">Année</div>
        <div style="font-size:14px;font-weight:900;">${annee}</div>
        <div style="font-size:20px;font-weight:900;line-height:1.1;letter-spacing:-0.5px;">${reception.reception_number}</div>
        <div style="font-size:9px;font-family:monospace;color:#555;margin-top:2px;">${lotRef.substring(0, 8)}</div>
      </td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr>
      <td style="border:1px solid #444;width:30%;padding:3px 6px;"><span style="color:#777;">N° Bon d'expédition :</span> <strong>${reception.delivery_note_number ?? '—'}</strong></td>
      <td style="border:1px solid #444;border-left:none;width:22%;padding:3px 6px;"><span style="color:#777;">Lieu :</span> <strong>${reception.origin_oasis ?? reception.storage_zone_code ?? '—'}</strong></td>
      <td style="border:1px solid #444;border-left:none;width:26%;padding:3px 6px;"><span style="color:#777;">Date :</span> <strong>${dateStr}</strong></td>
      <td style="border:1px solid #444;border-left:none;padding:3px 6px;"><span style="color:#777;">H. Arrivée :</span> <strong>${heureArrivee || '........'}</strong></td>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #444;border-top:none;padding:3px 6px;"><span style="color:#777;">Fournisseur :</span> <strong>${supplierName}</strong>${supplierCode ? `<span style="color:#aaa;font-size:9px;margin-left:6px;">${supplierCode}</span>` : ''}</td>
      <td colspan="2" style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;"><span style="color:#777;">N° Facture :</span> <strong>${reception.remarks?.match(/[Ff]acture\s*[:n°#]*\s*(\S+)/)?.[1] ?? '—'}</strong></td>
    </tr>
    <tr>
      <td colspan="3" style="border:1px solid #444;border-top:none;padding:3px 6px;">
        ${cb(isElJirid)}<strong>El jirid</strong>&nbsp;&nbsp;&nbsp;${cb(isKebilli)}<strong>Kebilli</strong>&nbsp;&nbsp;&nbsp;&nbsp;
        <span style="color:#777;">N° de Lot :</span> <strong style="font-family:monospace;">${lotRef}</strong>
      </td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;"><span style="color:#777;">N° Rapport QC :</span> <strong>—</strong></td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <colgroup>
    <col style="width:13%;"/>
    <col style="width:6%;"/>
    <col style="width:6%;"/>
    <col style="width:6%;"/>
    <col style="width:5%;"/>
    <col style="width:12%;"/>
    <col style="width:12%;"/>
    <col style="width:22%;"/>
  </colgroup>
  <thead>
    <tr style="background:#333;color:#fff;font-size:10px;">
      <th style="border:1px solid #555;padding:3px 5px;text-align:left;"></th>
      <th style="border:1px solid #555;padding:3px 5px;text-align:center;">GC</th>
      <th style="border:1px solid #555;padding:3px 5px;text-align:center;">RP</th>
      <th style="border:1px solid #555;padding:3px 5px;text-align:center;">GCM</th>
      <th style="border:1px solid #555;padding:3px 5px;text-align:center;">L</th>
      <th style="border:1px solid #555;padding:3px 5px;text-align:center;">Poid Brut</th>
      <th style="border:1px solid #555;padding:3px 5px;text-align:center;">Poid Net</th>
      <th style="border:1px solid #555;padding:3px 5px;"></th>
    </tr>
  </thead>
  <tbody>
    ${productRows}
    <tr>
      <td style="border:1px solid #444;font-weight:600;">Casse</td>
      <td colspan="6" style="border:1px solid #444;font-size:10px;">
        <span style="margin-right:16px;"><span style="color:#777;">Nature</span></span>
        <span style="margin-right:12px;"><span style="color:#777;font-size:9px;">GC</span> <strong>${dash(casseData.gc)}</strong></span>
        <span style="margin-right:12px;"><span style="color:#777;font-size:9px;">P</span> <strong>${dash(casseData.rp)}</strong></span>
        <span><span style="color:#777;font-size:9px;">L</span> <strong>${dash(casseData.lame)}</strong></span>
      </td>
    </tr>
    <tr style="background:#f7f7f7;">
      <td style="border:1px solid #ccc;font-size:9px;color:#666;font-style:italic;">Quantité</td>
      <td colspan="6" style="border:1px solid #ccc;">
        <strong>${casseData.poidsNet > 0 ? `${fmtW(casseData.poidsNet)} kg` : ''}</strong>
        ${form.obs_casse ? `<span style="margin-left:8px;color:#555;font-size:9px;">${form.obs_casse}</span>` : ''}
      </td>
    </tr>
    <tr style="background:#e5e5e5;font-weight:bold;font-size:11px;">
      <td style="border:2px solid #333;font-weight:900;">TOTAL</td>
      <td style="border:2px solid #333;text-align:center;">${dash(rowsData.reduce((s, r) => s + r.data.gc, 0) + casseData.gc)}</td>
      <td style="border:2px solid #333;text-align:center;">${dash(rowsData.reduce((s, r) => s + r.data.rp, 0))}</td>
      <td style="border:2px solid #333;text-align:center;">${dash(rowsData.reduce((s, r) => s + r.data.gcm, 0))}</td>
      <td style="border:2px solid #333;text-align:center;">${dash(rowsData.reduce((s, r) => s + r.data.lame, 0))}</td>
      <td style="border:2px solid #333;text-align:right;">${fmtW(reception.gross_weight_kg)}</td>
      <td style="border:2px solid #333;text-align:right;font-size:12px;">${fmtW(reception.quantity_total)}</td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr>
      <td colspan="3" style="border:1px solid #444;padding:2px 6px;font-size:8px;color:#666;">
        (*) GC : Grand Caisse &nbsp;/&nbsp; P : Plateau &nbsp;/&nbsp; L : Lame &nbsp;/&nbsp; GCR : GC Royal &nbsp;/&nbsp; GCI : GC jaune &nbsp;/&nbsp; GCN : GC Bleu
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #444;border-top:none;width:38%;padding:3px 8px;">
        <span style="color:#777;font-size:9px;">Comptabilité N° de Pièces :</span>
        <span style="display:inline-block;width:70px;border-bottom:1px solid #bbb;margin-left:4px;"></span>
      </td>
      <td style="border:1px solid #444;border-top:none;border-left:none;width:28%;text-align:center;padding:3px;font-size:9px;color:#777;">Contrôle de Gestion</td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 8px;font-size:8px;color:#bbb;">
        V01-2024 &nbsp;|&nbsp; ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })} — Royal Palm MES
      </td>
    </tr>
  </tbody>
</table>
</body></html>`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const BonReceptionDialog = ({ open, onOpenChange, reception, lots }: BonReceptionDialogProps) => {
  const { data: saved } = useDocumentPrint(reception.id, 'BON_RECEPTION');
  const saveDoc = useSaveDocumentPrint(reception.id, 'BON_RECEPTION');

  const [form, setForm] = useState<BonReceptionFormData>(DEFAULT_FORM);

  useEffect(() => {
    if (saved?.form_data) {
      setForm(saved.form_data as BonReceptionFormData);
    }
  }, [saved]);

  const set = (key: keyof BonReceptionFormData) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? '—';
  const dateStr = format(new Date(reception.actual_arrival_date), 'dd/MM/yyyy', { locale: fr });
  const qrValue = buildQrPayload(reception, lots);

  const grouped: Record<LotCategory, ReceptionLot[]> = { branche1: [], branche2: [], vrac: [], seche: [], casse: [] };
  lots.forEach((l) => grouped[categorizeLot(l)].push(l));

  const rows: { key: LotCategory; label: string }[] = [
    { key: 'branche1', label: 'Branche 1ère' },
    { key: 'branche2', label: 'Branche 2ème' },
    { key: 'vrac', label: 'Vrac' },
    { key: 'seche', label: 'Branche Sèche' },
  ];
  const rowsData = rows.map(({ key, label }) => ({ label, data: buildRowData(grouped[key]) }));
  const casseData = buildRowData(grouped.casse);

  const handleSave = () => saveDoc.mutate({
    document_type: 'BON_RECEPTION',
    source_id: reception.id,
    source_number: reception.reception_number,
    form_data: form,
  });

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildPrintHtml(form, reception, lots, rowsData, casseData));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 350);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            BON DE RECEPTION ACHAT — {reception.reception_number}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-auto max-h-[75vh] space-y-3 pr-1">
          {/* Section 1: Read-only summary */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Informations réception
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Fournisseur : </span><strong>{supplierName}</strong></div>
                <div><span className="text-muted-foreground">Date : </span><strong>{dateStr}</strong></div>
                <div><span className="text-muted-foreground">N° Réception : </span><strong>{reception.reception_number}</strong></div>
                <div><span className="text-muted-foreground">Poids net : </span><strong>{fmtW(reception.quantity_total)} kg</strong></div>
                <div><span className="text-muted-foreground">Lots : </span><strong>{lots.length}</strong></div>
                <div><span className="text-muted-foreground">BL : </span><strong>{reception.delivery_note_number ?? '—'}</strong></div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <QRCodeSVG value={qrValue} size={48} level="M" includeMargin={false} />
                <span className="text-xs text-muted-foreground font-mono">{reception.reception_number}</span>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Editable fields */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-medium uppercase tracking-wide">
                Champs à compléter
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="responsable_nom" className="text-xs">Responsable réception</Label>
                  <Input
                    id="responsable_nom"
                    value={form.responsable_nom}
                    onChange={(e) => set('responsable_nom')(e.target.value)}
                    placeholder="Nom du responsable"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rapport_gcr_number" className="text-xs">N° Rapport GCR</Label>
                  <Input
                    id="rapport_gcr_number"
                    value={form.rapport_gcr_number}
                    onChange={(e) => set('rapport_gcr_number')(e.target.value)}
                    placeholder="GCR-XXXX"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fiche_palette_number" className="text-xs">N° Fiche palette</Label>
                  <Input
                    id="fiche_palette_number"
                    value={form.fiche_palette_number}
                    onChange={(e) => set('fiche_palette_number')(e.target.value)}
                    placeholder="FP-XXXX"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="obs_branche1" className="text-xs">Observation Branche 1ère</Label>
                  <Input
                    id="obs_branche1"
                    value={form.obs_branche1}
                    onChange={(e) => set('obs_branche1')(e.target.value)}
                    placeholder="Observation..."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="obs_branche2" className="text-xs">Observation Branche 2ème</Label>
                  <Input
                    id="obs_branche2"
                    value={form.obs_branche2}
                    onChange={(e) => set('obs_branche2')(e.target.value)}
                    placeholder="Observation..."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="obs_vrac" className="text-xs">Observation Vrac</Label>
                  <Input
                    id="obs_vrac"
                    value={form.obs_vrac}
                    onChange={(e) => set('obs_vrac')(e.target.value)}
                    placeholder="Observation..."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="obs_seche" className="text-xs">Observation Branche Sèche</Label>
                  <Input
                    id="obs_seche"
                    value={form.obs_seche}
                    onChange={(e) => set('obs_seche')(e.target.value)}
                    placeholder="Observation..."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="obs_casse" className="text-xs">Observation Casse</Label>
                  <Input
                    id="obs_casse"
                    value={form.obs_casse}
                    onChange={(e) => set('obs_casse')(e.target.value)}
                    placeholder="Observation..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button variant="outline" onClick={handleSave} disabled={saveDoc.isPending}>
            {saveDoc.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sauvegarder
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
