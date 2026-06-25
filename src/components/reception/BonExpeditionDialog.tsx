import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Printer, Truck, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReceptionV2, ReceptionLot } from '@/types/reception';
import type { BonExpeditionFormData } from '@/types/documentPrints';
import { useDocumentPrint, useSaveDocumentPrint } from '@/hooks/useDocumentPrints';

interface BonExpeditionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reception: ReceptionV2;
  lots: ReceptionLot[];
}

function fmtW(v: number | null | undefined): string {
  if (v == null || v === 0) return '';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
}

type DateType = 'branche1' | 'branche2' | 'vrac' | 'vacSec' | 'brancheSec' | 'aligKhouat';

function classifyLot(lot: ReceptionLot): DateType {
  const v = `${lot.variety ?? ''} ${lot.lot_supplier ?? ''}`.toLowerCase();
  if (v.includes('alig') || v.includes('khouat') || v.includes('allig')) return 'aligKhouat';
  if (v.includes('1ère') || v.includes('1ere') || v.includes('br1')) return 'branche1';
  if (v.includes('sèche') || v.includes('seche') || v.includes('sec') || v.includes('brs')) return 'brancheSec';
  if (v.includes('2ème') || v.includes('2eme') || v.includes('br2') || v.includes('branche 2')) return 'branche2';
  if (v.includes('vrac sèche') || v.includes('vrac seche') || v.includes('vrac sec')) return 'vacSec';
  if (v.includes('vrac')) return 'vrac';
  return 'branche2';
}

interface TypeRow { key: DateType; label: string; obsKey: keyof BonExpeditionFormData }

const TYPE_ROWS: TypeRow[] = [
  { key: 'branche1', label: 'Branche 1ère', obsKey: 'obs_branche1' },
  { key: 'branche2', label: 'Branche 2ème', obsKey: 'obs_branche2' },
  { key: 'vrac', label: 'Vrac', obsKey: 'obs_vrac' },
  { key: 'vacSec', label: 'Vrac Sèche', obsKey: 'obs_vrac_sec' },
  { key: 'brancheSec', label: 'Branche Sèche', obsKey: 'obs_branche_sec' },
  { key: 'aligKhouat', label: 'Alig / khouat', obsKey: 'obs_alig' },
];

const makeDefaultForm = (reception: ReceptionV2): BonExpeditionFormData => ({
  vehicle_number: reception.vehicle_number ?? '',
  driver_name: reception.driver_name ?? '',
  lieu_reception: reception.storage_zone_code ?? '',
  controleur_code: '',
  responsable_nom: '',
  obs_branche1: '',
  obs_branche2: '',
  obs_vrac: '',
  obs_vrac_sec: '',
  obs_branche_sec: '',
  obs_alig: '',
});

// ── Print HTML builder ─────────────────────────────────────────────────────────

function buildPrintHtml(form: BonExpeditionFormData, reception: ReceptionV2, lots: ReceptionLot[]): string {
  const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? '—';
  const supplierCode = reception.supplier?.code ?? reception.supplier_code_snapshot ?? '—';
  const dateStr = format(new Date(reception.actual_arrival_date), 'dd/MM/yyyy', { locale: fr });
  const annee = format(new Date(reception.actual_arrival_date), 'yyyy');
  const isBio = reception.bio_declared === true;

  const byType = Object.fromEntries(TYPE_ROWS.map((r) => [r.key, [] as ReceptionLot[]])) as Record<DateType, ReceptionLot[]>;
  lots.forEach((l) => byType[classifyLot(l)].push(l));

  const totalGC = lots.reduce((s, l) => s + (l.units?.filter((u) => u.unit_type === 'GC').length ?? 0), 0);
  const totalPL = lots.reduce((s, l) => s + (l.units?.filter((u) => u.unit_type === 'PL' || u.unit_type === 'PALETTE').length ?? 0), 0);
  const totalL = lots.reduce((s, l) => s + (l.units?.filter((u) => u.unit_type === 'LAMME').length ?? 0), 0);

  const cb = (on: boolean) => `<span style="display:inline-block;border:1.5px solid #444;width:11px;height:11px;text-align:center;line-height:11px;font-size:9px;margin-right:3px;font-weight:bold;">${on ? '✓' : ''}</span>`;

  const obsMap: Record<string, string> = {
    branche1: form.obs_branche1,
    branche2: form.obs_branche2,
    vrac: form.obs_vrac,
    vacSec: form.obs_vrac_sec,
    brancheSec: form.obs_branche_sec,
    aligKhouat: form.obs_alig,
  };

  const productRows = TYPE_ROWS.map(({ key, label }, idx) => {
    const rowLots = byType[key];
    const hasData = rowLots.length > 0;
    const gcCount = rowLots.reduce((s, l) => s + (l.units?.filter((u) => u.unit_type === 'GC').length ?? 0), 0);
    const plCount = rowLots.reduce((s, l) => s + (l.units?.filter((u) => u.unit_type === 'PL' || u.unit_type === 'PALETTE').length ?? 0), 0);
    const gcmCount = rowLots.reduce((s, l) => s + (l.units?.filter((u) => u.unit_type === 'PLOX').length ?? 0), 0);
    const natureParts: string[] = [];
    if (gcCount > 0) natureParts.push('GCRP');
    if (gcmCount > 0) natureParts.push('GCM');
    if (plCount > 0) natureParts.push('P');
    const qtyParts: string[] = [];
    if (gcCount > 0) qtyParts.push(String(gcCount));
    if (gcmCount > 0) qtyParts.push(String(gcmCount));
    if (plCount > 0) qtyParts.push(String(plCount));
    const totalKg = rowLots.reduce((s, l) => s + l.quantity, 0);

    return `<tr>
      <td style="border:1px solid #444;font-weight:${hasData ? '600' : 'normal'};color:${hasData ? '#111' : '#bbb'};">${label}</td>
      <td style="border:1px solid #444;text-align:center;font-weight:bold;">${hasData && natureParts.length > 0 ? natureParts.join('/') : ''}</td>
      <td style="border:1px solid #444;text-align:center;font-weight:bold;">${hasData ? (qtyParts.length > 0 ? qtyParts.join('/') : (totalKg > 0 ? `${fmtW(totalKg)} kg` : '')) : ''}</td>
      <td style="border:1px solid #444;">${obsMap[key] ?? ''}</td>
      ${idx === 0 ? `<td rowspan="${TYPE_ROWS.length + 3}" style="border:2px solid #444;vertical-align:top;padding:6px 8px;">
        <div style="margin-bottom:6px;"><div style="font-size:8px;color:#888;text-transform:uppercase;">Camion</div><div style="font-weight:bold;">${form.vehicle_number || '............'}</div></div>
        <div style="margin-bottom:8px;"><div style="font-size:8px;color:#888;text-transform:uppercase;">Chauffeur</div><div style="font-weight:bold;">${form.driver_name || '............'}</div></div>
        <div style="border-top:1px solid #ddd;padding-top:5px;margin-bottom:8px;"><div style="font-size:8px;color:#888;text-transform:uppercase;">Lieu de réception</div><div style="font-weight:bold;">${form.lieu_reception || '............'}</div></div>
        <div style="border-top:1px solid #ddd;padding-top:5px;margin-bottom:8px;"><div style="font-size:8px;color:#888;text-transform:uppercase;">Code Contrôleur</div><div style="font-weight:bold;">${form.controleur_code || '............'}</div></div>
        <div style="border-top:1px solid #ddd;padding-top:5px;margin-bottom:8px;"><div style="font-size:8px;color:#888;text-transform:uppercase;">Responsable réception</div><div style="font-weight:bold;">${form.responsable_nom || '........................'}</div><div style="min-height:22px;border-bottom:1px solid #bbb;"></div></div>
        <div style="border-top:1px solid #ddd;padding-top:5px;"><div style="font-size:8px;color:#888;text-transform:uppercase;margin-bottom:4px;">Nom et signature</div><div style="min-height:28px;border-bottom:1px solid #bbb;"></div></div>
      </td>` : ''}
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"/>
<title>BON D'EXPEDITION ${reception.delivery_note_number ?? reception.reception_number}</title>
<style>
  @page{size:A4 landscape;margin:7mm 9mm;}
  *{box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:10px;color:#111;margin:0;}
  table{border-collapse:collapse;width:100%;}
  td,th{border:1px solid #444;padding:3px 6px;vertical-align:top;}
  .bold{font-weight:bold;}
  .center{text-align:center;}
  .sig{min-height:30px;border-bottom:1px solid #bbb;margin-top:4px;}
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
        <div style="font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">BON D'EXPEDITION</div>
        <div style="margin-top:6px;display:flex;justify-content:center;gap:20px;">
          <span>${cb(!isBio)}Conventionnel</span>
          <span>${cb(isBio)}TN-Bio-001</span>
          <span>${cb(false)}GGP</span>
        </div>
      </td>
      <td style="width:17%;border:2px solid #333;border-left:none;vertical-align:top;padding:5px 8px;">
        <div style="font-size:9px;color:#888;text-transform:uppercase;">Année</div>
        <div style="font-size:14px;font-weight:900;">${annee}</div>
        <div style="font-size:9px;color:#888;margin-top:4px;text-transform:uppercase;">Nr.</div>
        <div style="font-size:18px;font-weight:900;font-family:monospace;">${reception.delivery_note_number ?? reception.reception_number}</div>
      </td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr>
      <td style="border:1px solid #444;width:40%;padding:3px 6px;"><span style="color:#777;">Lieu :</span> <strong>${form.lieu_reception || (reception.origin_oasis ?? reception.storage_zone_code ?? '............')}</strong></td>
      <td style="border:1px solid #444;border-left:none;padding:3px 6px;"><span style="color:#777;">Date :</span> <strong>${dateStr}</strong></td>
    </tr>
    <tr>
      <td style="border:1px solid #444;border-top:none;padding:3px 6px;"><span style="color:#777;">Code Fournisseur :</span> <strong>${supplierCode}</strong> <span style="color:#aaa;font-size:9px;">${supplierName}</span></td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;"><span style="color:#777;">Code Contrôleur :</span> <strong>${form.controleur_code || '............'}</strong></td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <colgroup>
    <col style="width:22%;"/><col style="width:22%;"/><col style="width:22%;"/><col style="width:12%;"/><col style="width:22%;"/>
  </colgroup>
  <thead>
    <tr style="background:#333;color:#fff;font-size:10px;">
      <th style="border:1px solid #555;padding:3px 6px;text-align:left;">Produit</th>
      <th style="border:1px solid #555;padding:3px 6px;text-align:center;">Nature de caisse</th>
      <th style="border:1px solid #555;padding:3px 6px;text-align:center;">Quantité de caisse</th>
      <th style="border:1px solid #555;padding:3px 6px;text-align:center;">Observation</th>
      <th style="border:1px solid #555;padding:3px 6px;"></th>
    </tr>
  </thead>
  <tbody>
    ${productRows}
    <tr>
      <td style="border:1px solid #444;font-weight:600;">Casse</td>
      <td colspan="3" style="border:1px solid #444;">
        <div style="display:flex;gap:16px;align-items:center;">
          <div><div style="font-size:8px;color:#888;">Nature</div>
            <div style="display:flex;gap:10px;margin-top:2px;">
              <span style="border:1px solid #ccc;padding:1px 6px;font-size:9px;">GC</span>
              <span style="border:1px solid #ccc;padding:1px 6px;font-size:9px;">P</span>
              <span style="border:1px solid #ccc;padding:1px 6px;font-size:9px;">L</span>
            </div>
          </div>
          <div><div style="font-size:8px;color:#888;">Quantité</div>
            <div style="display:flex;gap:10px;margin-top:2px;">
              <span style="border:1px solid #ccc;padding:1px 8px;font-size:9px;">${totalGC || ''}</span>
              <span style="border:1px solid #ccc;padding:1px 8px;font-size:9px;">${totalPL || ''}</span>
              <span style="border:1px solid #ccc;padding:1px 8px;font-size:9px;">${totalL || ''}</span>
            </div>
          </div>
        </div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #444;padding:4px 8px;min-height:36px;">
        <div style="font-size:9px;color:#777;font-weight:600;">Nom et Signature</div>
        <div style="min-height:28px;border-bottom:1px solid #bbb;margin-top:2px;"></div>
      </td>
      <td colspan="2" style="border:1px solid #444;padding:4px 8px;">
        <div style="font-size:8px;color:#888;">Poids brut entrée</div>
        <div style="font-weight:bold;">${fmtW(reception.gross_weight_kg) || '—'} kg</div>
        <div style="font-size:8px;color:#888;margin-top:4px;">Poids net</div>
        <div style="font-weight:bold;">${fmtW(reception.quantity_total)} kg</div>
      </td>
    </tr>
    <tr style="background:#f7f7f7;">
      <td colspan="4" style="border:1px solid #ccc;font-size:8px;color:#777;padding:3px 8px;">
        (*) GC : Grand Caisse &nbsp;/&nbsp; P : Plateau &nbsp;/&nbsp; L : Lame
        &nbsp;&nbsp;|&nbsp;&nbsp;
        V02-2023 &nbsp;|&nbsp; ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })} — Royal Palm MES
      </td>
    </tr>
  </tbody>
</table>
</body></html>`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const BonExpeditionDialog = ({ open, onOpenChange, reception, lots }: BonExpeditionDialogProps) => {
  const { data: saved } = useDocumentPrint(reception.id, 'BON_EXPEDITION');
  const saveDoc = useSaveDocumentPrint(reception.id, 'BON_EXPEDITION');

  const [form, setForm] = useState<BonExpeditionFormData>(() => makeDefaultForm(reception));

  useEffect(() => {
    if (saved?.form_data) {
      setForm(saved.form_data as BonExpeditionFormData);
    }
  }, [saved]);

  const set = (key: keyof BonExpeditionFormData) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? '—';
  const dateStr = format(new Date(reception.actual_arrival_date), 'dd/MM/yyyy', { locale: fr });

  const handleSave = () => saveDoc.mutate({
    document_type: 'BON_EXPEDITION',
    source_id: reception.id,
    source_number: reception.delivery_note_number ?? reception.reception_number,
    form_data: form,
  });

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildPrintHtml(form, reception, lots));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 350);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            BON D'EXPEDITION — {reception.delivery_note_number ?? reception.reception_number}
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
                  <Label htmlFor="vehicle_number" className="text-xs">Camion / Immatriculation</Label>
                  <Input id="vehicle_number" value={form.vehicle_number} onChange={(e) => set('vehicle_number')(e.target.value)} placeholder="Ex: 123TU456" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="driver_name" className="text-xs">Chauffeur</Label>
                  <Input id="driver_name" value={form.driver_name} onChange={(e) => set('driver_name')(e.target.value)} placeholder="Nom du chauffeur" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lieu_reception" className="text-xs">Lieu de réception</Label>
                  <Input id="lieu_reception" value={form.lieu_reception} onChange={(e) => set('lieu_reception')(e.target.value)} placeholder="Zone de stockage" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="controleur_code" className="text-xs">Code Contrôleur</Label>
                  <Input id="controleur_code" value={form.controleur_code} onChange={(e) => set('controleur_code')(e.target.value)} placeholder="Code contrôleur" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="responsable_nom" className="text-xs">Responsable réception</Label>
                  <Input id="responsable_nom" value={form.responsable_nom} onChange={(e) => set('responsable_nom')(e.target.value)} placeholder="Nom du responsable" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="obs_branche1" className="text-xs">Observation Branche 1ère</Label>
                  <Input id="obs_branche1" value={form.obs_branche1} onChange={(e) => set('obs_branche1')(e.target.value)} placeholder="Observation..." />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="obs_branche2" className="text-xs">Observation Branche 2ème</Label>
                  <Input id="obs_branche2" value={form.obs_branche2} onChange={(e) => set('obs_branche2')(e.target.value)} placeholder="Observation..." />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="obs_vrac" className="text-xs">Observation Vrac</Label>
                  <Input id="obs_vrac" value={form.obs_vrac} onChange={(e) => set('obs_vrac')(e.target.value)} placeholder="Observation..." />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="obs_vrac_sec" className="text-xs">Observation Vrac Sèche</Label>
                  <Input id="obs_vrac_sec" value={form.obs_vrac_sec} onChange={(e) => set('obs_vrac_sec')(e.target.value)} placeholder="Observation..." />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="obs_branche_sec" className="text-xs">Observation Branche Sèche</Label>
                  <Input id="obs_branche_sec" value={form.obs_branche_sec} onChange={(e) => set('obs_branche_sec')(e.target.value)} placeholder="Observation..." />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="obs_alig" className="text-xs">Observation Alig / Khouat</Label>
                  <Input id="obs_alig" value={form.obs_alig} onChange={(e) => set('obs_alig')(e.target.value)} placeholder="Observation..." />
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
