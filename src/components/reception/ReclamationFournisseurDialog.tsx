import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Printer, AlertTriangle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReceptionV2, ReceptionLot, QCInspection } from '@/types/reception';
import type { ReclamationFormData } from '@/types/documentPrints';
import { useDocumentPrint, useSaveDocumentPrint } from '@/hooks/useDocumentPrints';

interface ReclamationFournisseurDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reception: ReceptionV2;
  lots: ReceptionLot[];
  inspection: QCInspection | null;
}

function fmtW(v: number | null | undefined): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
}

const IMPACT_LEVELS = ['Faible', 'Moyen', 'Important'] as const;
const REPETITIVITE_LEVELS = ['Rare', 'Fréquente'] as const;

const makeDefaultForm = (reception: ReceptionV2, inspection: QCInspection | null): ReclamationFormData => {
  const declaredKg = reception.declared_weight_kg ?? reception.gross_weight_kg;
  const receivedKg = reception.quantity_total;
  const weightGapKg = declaredKg != null ? receivedKg - declaredKg : null;
  const hasWeightGap = weightGapKg != null && Math.abs(weightGapKg) > 0.5;

  const ncDescription = inspection?.comment ?? (hasWeightGap ? `Écart de poids constaté à la réception : ${fmtW(weightGapKg)} kg` : '');

  return {
    nc_description: ncDescription,
    impact: '',
    repetitivite: '',
    prix_definitif_tnd_kg: '',
    actions_correctives: '',
    date_realisation: '',
    verification_efficacite: '',
    responsable_reception_nom: '',
    responsable_achat_nom: '',
    date_cloture: '',
  };
};

// ── Print HTML builder ─────────────────────────────────────────────────────────

function buildPrintHtml(form: ReclamationFormData, reception: ReceptionV2, lots: ReceptionLot[]): string {
  const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? '—';
  const dateStr = format(new Date(reception.actual_arrival_date), 'dd/MM/yyyy', { locale: fr });
  const isBio = reception.bio_declared === true;

  const declaredKg = reception.declared_weight_kg ?? reception.gross_weight_kg;
  const receivedKg = reception.quantity_total;
  const weightGapKg = declaredKg != null ? receivedKg - declaredKg : null;
  const hasWeightGap = weightGapKg != null && Math.abs(weightGapKg) > 0.5;

  const gcCount = lots.reduce((s, l) => s + (l.units?.filter((u) => u.unit_type === 'GC').length ?? 0), 0);
  const cmCount = lots.reduce((s, l) => s + (l.units?.filter((u) => u.unit_type === 'PLOX' || u.unit_type === 'CAISSE').length ?? 0), 0);
  const isBranche = !reception.presentation || reception.presentation !== 'En vrac';
  const brancheType = reception.variety?.toLowerCase().includes('2') ? '2ème' : reception.variety?.toLowerCase().includes('1') ? '1ère' : '2ème';

  const recNum = reception.reception_number.replace(/[A-Z]+-?/, '');
  const reportNum = String(parseInt(recNum) || 1).padStart(6, '0');

  const agreedPrice = reception.supplier?.agreed_price_tnd_per_kg;

  const cb = (on: boolean) => `<span style="display:inline-block;border:1.5px solid #444;width:11px;height:11px;text-align:center;line-height:11px;font-size:9px;margin-right:3px;font-weight:bold;">${on ? '✓' : ''}</span>`;

  const weightGapSection = hasWeightGap ? `
    <tr style="background:#f5f5f5;">
      <td colspan="4" style="border:1px solid #444;border-top:none;font-weight:700;font-size:10px;padding:3px 8px;">Écart de poids</td>
    </tr>
    <tr>
      <th style="border:1px solid #444;border-top:none;background:#eee;font-size:9px;padding:2px 5px;">Articulé / Caisse</th>
      <th style="border:1px solid #444;border-top:none;border-left:none;background:#eee;font-size:9px;padding:2px 5px;">Qté fournisseur</th>
      <th style="border:1px solid #444;border-top:none;border-left:none;background:#eee;font-size:9px;padding:2px 5px;">Qté réception</th>
      <th style="border:1px solid #444;border-top:none;border-left:none;background:#eee;font-size:9px;padding:2px 5px;">Écart de poids</th>
    </tr>
    <tr>
      <td style="border:1px solid #444;border-top:none;padding:3px 6px;">${isBranche ? `Branche ${brancheType}` : 'Vrac'}</td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;text-align:right;font-weight:bold;">${fmtW(declaredKg)} kg</td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;text-align:right;font-weight:bold;">${fmtW(receivedKg)} kg</td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;text-align:right;font-weight:bold;color:${(weightGapKg ?? 0) < 0 ? '#c00' : '#060'};">${(weightGapKg ?? 0) >= 0 ? '+' : ''}${fmtW(weightGapKg)} kg</td>
    </tr>` : '';

  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"/>
<title>Réclamation Fournisseur ${reportNum}</title>
<style>
  @page{size:A4;margin:8mm 10mm;}
  *{box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:9.5px;color:#111;margin:0;}
  table{border-collapse:collapse;width:100%;}
  td,th{border:1px solid #444;padding:3px 6px;vertical-align:top;}
  .bold{font-weight:bold;}
  .center{text-align:center;}
  .sig{min-height:28px;border-bottom:1px solid #bbb;margin-top:3px;}
</style>
</head><body>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;">
  <tbody>
    <tr>
      <td style="width:14%;border:2px solid #333;vertical-align:middle;padding:5px 8px;text-align:center;">
        <div style="font-weight:900;font-size:14px;color:#1a5c2a;line-height:1.1;">Royal</div>
        <div style="font-weight:900;font-size:20px;color:#1a5c2a;line-height:1.1;">Palm</div>
        <div style="font-size:7px;color:#888;letter-spacing:1px;">GROUP</div>
      </td>
      <td style="border:2px solid #333;border-left:none;vertical-align:middle;padding:5px 10px;text-align:center;">
        <div style="font-size:14px;font-weight:900;text-transform:uppercase;">RÉCLAMATION FOURNISSEUR DATTES</div>
        <div style="margin-top:5px;display:flex;justify-content:center;gap:18px;">
          <span>${cb(!isBio)}Conventionnelle</span>
          <span>${cb(isBio)}Biologique</span>
        </div>
      </td>
      <td style="width:18%;border:2px solid #333;border-left:none;vertical-align:top;padding:4px 8px;">
        <div style="font-size:8px;color:#888;">Réf : ENR-CQL-10</div>
        <div style="font-size:8px;color:#888;">Version 01</div>
        <div style="font-size:8px;color:#888;">Page : 1/1</div>
        <div style="font-size:14px;font-weight:900;margin-top:3px;font-family:monospace;">N° ${reportNum}</div>
      </td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr>
      <td style="border:1px solid #444;width:50%;padding:3px 6px;"><strong>Type de dattes</strong></td>
      <td style="border:1px solid #444;border-left:none;padding:3px 6px;"><strong>Informations sur le Fournisseur</strong></td>
    </tr>
    <tr>
      <td style="border:1px solid #444;border-top:none;padding:3px 6px;">${cb(!isBio)}Conventionnelle &nbsp; ${cb(isBio)}Biologique</td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;"><span style="color:#777;">Nom du fournisseur :</span> <strong>${supplierName}</strong></td>
    </tr>
    <tr>
      <td style="border:1px solid #444;border-top:none;padding:3px 6px;">
        ${cb(isBranche)}Branche &nbsp; ${cb(!isBranche)}Vrac<br/>
        <span style="color:#777;font-size:8px;">1ère</span> <span style="color:#777;font-size:8px;">2ème</span> <span style="color:#777;font-size:8px;">Sèche</span> <span style="color:#777;font-size:8px;">Standard</span><br/>
        ${cb(brancheType === '1ère')}${cb(brancheType === '2ème')}${cb(false)}${cb(false)}
      </td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;">
        <div><span style="color:#777;">N° Bon de réception :</span> <strong style="font-family:monospace;">${reception.reception_number}</strong></div>
        <div style="margin-top:2px;"><span style="color:#777;">Quantité réceptionnée :</span> <strong>${fmtW(receivedKg)} kg</strong></div>
        <div style="margin-top:2px;"><span style="color:#777;">Nombre de caisses :</span> <strong>${gcCount > 0 ? `${gcCount} GC` : ''} ${cmCount > 0 ? `${cmCount} CM` : ''}${gcCount === 0 && cmCount === 0 ? (reception.crate_count ?? '—') : ''}</strong></div>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #444;border-top:none;padding:3px 6px;"><span style="color:#777;">Date de réception :</span> <strong>${dateStr}</strong></td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;"><span style="color:#777;">Numéro de lot :</span> <strong style="font-family:monospace;font-size:9px;">${lots[0]?.lot_internal ?? lots[0]?.lot_supplier ?? '—'}</strong></td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr style="background:#f5f5f5;">
      <td colspan="4" style="border:1px solid #444;font-weight:700;font-size:10px;padding:3px 8px;">Non-conformité Identifiée</td>
    </tr>
    <tr>
      <td colspan="4" style="border:1px solid #444;border-top:none;padding:4px 8px;min-height:36px;">
        <div style="font-size:8px;color:#777;margin-bottom:2px;">Description de la non-conformité</div>
        <div style="font-weight:${form.nc_description ? 'bold' : 'normal'};">${form.nc_description || '.......................................................................................'}</div>
      </td>
    </tr>
    ${weightGapSection}
    <tr>
      <td colspan="2" style="border:1px solid #444;border-top:none;padding:3px 6px;">
        <strong>Impact</strong> ${IMPACT_LEVELS.map((l) => `<span>${cb(form.impact === l)}${l} &nbsp;</span>`).join('')}
      </td>
      <td colspan="2" style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;">
        <strong>Répétitivité</strong> ${REPETITIVITE_LEVELS.map((l) => `<span>${cb(form.repetitivite === l)}${l} &nbsp;</span>`).join('')}
      </td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr style="background:#f5f5f5;">
      <td colspan="3" style="border:1px solid #444;font-weight:700;font-size:10px;padding:3px 8px;">Prix</td>
    </tr>
    <tr>
      <th style="border:1px solid #444;border-top:none;background:#eee;font-size:9px;padding:2px 5px;width:40%;">Articulé</th>
      <th style="border:1px solid #444;border-top:none;border-left:none;background:#eee;font-size:9px;padding:2px 5px;">Prix fournisseur (TND/kg)</th>
      <th style="border:1px solid #444;border-top:none;border-left:none;background:#eee;font-size:9px;padding:2px 5px;">Prix définitif (TND/kg)</th>
    </tr>
    <tr>
      <td style="border:1px solid #444;border-top:none;padding:3px 6px;">${isBranche ? `Branche ${brancheType}` : 'Vrac'}</td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;text-align:right;font-weight:bold;">${agreedPrice != null ? fmtW(agreedPrice) : '............'}</td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;text-align:right;font-weight:bold;">${form.prix_definitif_tnd_kg || '............'}</td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr style="background:#f5f5f5;">
      <td colspan="2" style="border:1px solid #444;font-weight:700;font-size:10px;padding:3px 8px;">Actions correctives demandées (Remplacement du Lot / Remboursement / Autres Actions)</td>
      <td style="border:1px solid #444;border-left:none;font-weight:700;font-size:10px;padding:3px 8px;">Date de Réalisation</td>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #444;border-top:none;padding:3px 8px;min-height:32px;">${form.actions_correctives || ''}</td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 8px;text-align:center;font-weight:bold;">${form.date_realisation || '.../.../......'}</td>
    </tr>
    <tr style="background:#f5f5f5;">
      <td colspan="3" style="border:1px solid #444;border-top:none;font-weight:700;font-size:10px;padding:3px 8px;">Vérification de l'efficacité des actions</td>
    </tr>
    <tr>
      <td colspan="3" style="border:1px solid #444;border-top:none;padding:3px 8px;min-height:28px;">${form.verification_efficacite || ''}</td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr>
      <td style="border:1px solid #444;padding:4px 8px;width:33%;">
        <div style="font-size:8px;color:#888;text-transform:uppercase;margin-bottom:2px;">Responsable réception</div>
        <div style="margin-bottom:2px;"><span style="font-size:8px;color:#888;">Nom :</span> <strong style="font-size:9px;">${form.responsable_reception_nom || '........................'}</strong></div>
        <div><span style="font-size:8px;color:#888;">Signature :</span><div style="min-height:22px;border-bottom:1px solid #bbb;margin-top:2px;"></div></div>
        <div style="margin-top:4px;"><div><span style="font-size:8px;color:#888;">Date d'ouverture :</span> <strong>${dateStr}</strong></div><div style="margin-top:2px;"><span style="font-size:8px;color:#888;">Date de clôture :</span> ${form.date_cloture || '..../.../......'}</div></div>
      </td>
      <td style="border:1px solid #444;padding:4px 8px;width:33%;">
        <div style="font-size:8px;color:#888;text-transform:uppercase;margin-bottom:2px;">Responsable Achat</div>
        <div style="margin-bottom:2px;"><span style="font-size:8px;color:#888;">Nom :</span> <strong style="font-size:9px;">${form.responsable_achat_nom || '........................'}</strong></div>
        <div><span style="font-size:8px;color:#888;">Signature :</span><div style="min-height:22px;border-bottom:1px solid #bbb;margin-top:2px;"></div></div>
        <div style="margin-top:4px;"><div style="font-size:8px;font-weight:700;color:#555;">VISA DIRECTION ACHAT</div><div style="min-height:16px;border-bottom:1px solid #ccc;"></div></div>
      </td>
      <td style="border:1px solid #444;padding:4px 8px;width:33%;">
        <div style="font-size:8px;color:#888;text-transform:uppercase;margin-bottom:2px;">Fournisseur</div>
        <div style="margin-bottom:2px;"><span style="font-size:8px;color:#888;">Nom :</span> <strong style="font-size:9px;">${supplierName}</strong></div>
        <div><span style="font-size:8px;color:#888;">Signature :</span><div style="min-height:22px;border-bottom:1px solid #bbb;margin-top:2px;"></div></div>
        <div style="margin-top:4px;"><div style="font-size:8px;font-weight:700;color:#555;">VISA DIRECTION QUALITÉ</div><div style="min-height:16px;border-bottom:1px solid #ccc;"></div></div>
      </td>
    </tr>
    <tr>
      <td colspan="3" style="border:1px solid #ccc;border-top:none;font-size:7px;color:#bbb;padding:2px 8px;">
        V02-2023 &nbsp;|&nbsp; ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })} — Ce document est la propriété de la société ENNOUR DATTES.
      </td>
    </tr>
  </tbody>
</table>
</body></html>`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const ReclamationFournisseurDialog = ({ open, onOpenChange, reception, lots, inspection }: ReclamationFournisseurDialogProps) => {
  const { data: saved } = useDocumentPrint(reception.id, 'RECLAMATION');
  const saveDoc = useSaveDocumentPrint(reception.id, 'RECLAMATION');

  const [form, setForm] = useState<ReclamationFormData>(() => makeDefaultForm(reception, inspection));

  useEffect(() => {
    if (saved?.form_data) {
      setForm(saved.form_data as ReclamationFormData);
    } else {
      setForm(makeDefaultForm(reception, inspection));
    }
  }, [saved, reception, inspection]);

  const set = (key: keyof ReclamationFormData) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? '—';
  const dateStr = format(new Date(reception.actual_arrival_date), 'dd/MM/yyyy', { locale: fr });
  const recNum = reception.reception_number.replace(/[A-Z]+-?/, '');
  const reportNum = String(parseInt(recNum) || 1).padStart(6, '0');

  const declaredKg = reception.declared_weight_kg ?? reception.gross_weight_kg;
  const receivedKg = reception.quantity_total;
  const weightGapKg = declaredKg != null ? receivedKg - declaredKg : null;

  const handleSave = () => saveDoc.mutate({
    document_type: 'RECLAMATION',
    source_id: reception.id,
    source_number: reception.reception_number,
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
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Réclamation Fournisseur — {reportNum}
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
                <div><span className="text-muted-foreground">Qté reçue : </span><strong>{fmtW(receivedKg)} kg</strong></div>
                {weightGapKg != null && (
                  <div><span className="text-muted-foreground">Écart poids : </span>
                    <strong className={weightGapKg < 0 ? 'text-red-600' : 'text-green-600'}>
                      {weightGapKg >= 0 ? '+' : ''}{fmtW(weightGapKg)} kg
                    </strong>
                  </div>
                )}
                <div><span className="text-muted-foreground">Lot : </span><strong>{lots[0]?.lot_internal ?? lots[0]?.lot_supplier ?? '—'}</strong></div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Editable fields */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-medium uppercase tracking-wide">Champs à compléter</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Description de la non-conformité</Label>
                <Textarea
                  value={form.nc_description}
                  onChange={(e) => set('nc_description')(e.target.value)}
                  placeholder="Description..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Impact</Label>
                  <Select value={form.impact} onValueChange={(v) => setForm((p) => ({ ...p, impact: v as ReclamationFormData['impact'] }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Faible">Faible</SelectItem>
                      <SelectItem value="Moyen">Moyen</SelectItem>
                      <SelectItem value="Important">Important</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Répétitivité</Label>
                  <Select value={form.repetitivite} onValueChange={(v) => setForm((p) => ({ ...p, repetitivite: v as ReclamationFormData['repetitivite'] }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rare">Rare</SelectItem>
                      <SelectItem value="Fréquente">Fréquente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Prix définitif (TND/kg)</Label>
                  <Input value={form.prix_definitif_tnd_kg} onChange={(e) => set('prix_definitif_tnd_kg')(e.target.value)} placeholder="Ex: 2.50" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date de réalisation</Label>
                  <Input type="date" value={form.date_realisation} onChange={(e) => set('date_realisation')(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Actions correctives</Label>
                <Textarea value={form.actions_correctives} onChange={(e) => set('actions_correctives')(e.target.value)} placeholder="Actions correctives demandées..." rows={2} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Vérification de l'efficacité</Label>
                <Textarea value={form.verification_efficacite} onChange={(e) => set('verification_efficacite')(e.target.value)} placeholder="Vérification..." rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Responsable réception (nom)</Label>
                  <Input value={form.responsable_reception_nom} onChange={(e) => set('responsable_reception_nom')(e.target.value)} placeholder="Nom..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Responsable achat (nom)</Label>
                  <Input value={form.responsable_achat_nom} onChange={(e) => set('responsable_achat_nom')(e.target.value)} placeholder="Nom..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date de clôture</Label>
                  <Input type="date" value={form.date_cloture} onChange={(e) => set('date_cloture')(e.target.value)} />
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
