import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Printer, FileWarning, Loader2, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReceptionV2, ReceptionLot, QCInspection } from '@/types/reception';
import type {
  BonReclamationFormData,
  BonReclamationEcartRow,
  BonReclamationDeclassementRow,
  BonReclamationConclusionRow,
  BonReclamationPrixRow,
} from '@/types/documentPrints';
import { useDocumentPrint, useSaveDocumentPrint } from '@/hooks/useDocumentPrints';

interface BonReclamationDialogProps {
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

function articuleLabel(reception: ReceptionV2): string {
  const isBranche = !reception.presentation || reception.presentation !== 'En vrac';
  if (!isBranche) return 'Vrac';
  const v = reception.variety?.toLowerCase() ?? '';
  return v.includes('1') ? 'Branche 1ère' : 'Branche 2ème';
}

const makeDefaultForm = (
  reception: ReceptionV2,
  inspection: QCInspection | null
): BonReclamationFormData => {
  const declaredKg = reception.declared_weight_kg ?? reception.gross_weight_kg;
  const receivedKg = reception.quantity_total;
  const weightGapKg = declaredKg != null ? receivedKg - declaredKg : null;
  const articule = articuleLabel(reception);
  const agreedPrice = reception.supplier?.agreed_price_tnd_per_kg;

  return {
    document_date: format(new Date(), 'yyyy-MM-dd'),
    numero_facture_fournisseur: '',
    numero_bon_expedition: reception.delivery_note_number ?? '',
    numero_rapport_qualite: inspection?.inspection_number ?? '',
    ecarts: [
      {
        articule,
        qte_fournisseur: declaredKg != null ? String(declaredKg) : '',
        qte_reception: String(receivedKg ?? ''),
        ecart: weightGapKg != null ? String(Math.round(weightGapKg * 10) / 10) : '',
      },
    ],
    ecart_nb: '',
    declassements: [],
    conclusions: [],
    prix: [
      {
        articule,
        prix_fournisseur: agreedPrice != null ? String(agreedPrice) : '',
        prix_definitif: '',
      },
    ],
    observation: '',
    responsable_reception_nom: '',
    responsable_achat_nom: '',
    fournisseur_nom: '',
  };
};

// ── Print HTML builder ─────────────────────────────────────────────────────────

function buildPrintHtml(form: BonReclamationFormData, reception: ReceptionV2): string {
  const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? '—';
  const isBio = reception.bio_declared === true;
  const dateStr = form.document_date
    ? format(new Date(form.document_date), 'dd/MM/yyyy', { locale: fr })
    : format(new Date(), 'dd/MM/yyyy', { locale: fr });

  const recNum = reception.reception_number.replace(/[A-Z]+-?/, '');
  const docNum = String(parseInt(recNum) || 1).padStart(6, '0');

  const cb = (on: boolean) =>
    `<span style="display:inline-block;border:1.5px solid #444;width:11px;height:11px;text-align:center;line-height:11px;font-size:9px;margin-right:3px;font-weight:bold;">${on ? '✓' : ''}</span>`;

  const th = (label: string, w?: string) =>
    `<th style="border:1px solid #444;background:#eee;font-size:9px;padding:2px 5px;${w ? `width:${w};` : ''}">${label}</th>`;
  const td = (v: string, align = 'left') =>
    `<td style="border:1px solid #444;padding:3px 6px;text-align:${align};min-height:16px;">${v || '&nbsp;'}</td>`;
  const emptyRow = (cols: number) =>
    `<tr>${Array.from({ length: cols }, () => td('')).join('')}</tr>`;

  const ecartRows = form.ecarts
    .filter((r) => r.articule || r.qte_fournisseur || r.qte_reception || r.ecart)
    .map(
      (r) =>
        `<tr>${td(r.articule)}${td(r.qte_fournisseur ? `${r.qte_fournisseur} kg` : '', 'right')}${td(r.qte_reception ? `${r.qte_reception} kg` : '', 'right')}${td(r.ecart ? `${r.ecart} kg` : '', 'right')}</tr>`
    )
    .join('');

  const declassementRows = form.declassements
    .filter((r) => r.articule || r.qte || r.classe_fournisseur || r.classe_reception)
    .map(
      (r) =>
        `<tr>${td(r.articule)}${td(r.qte, 'right')}${td(r.classe_fournisseur)}${td(r.classe_reception)}</tr>`
    )
    .join('');

  const conclusionRows = form.conclusions
    .filter((r) => r.articule || r.taux_tombe_branche || r.taux_dechets || r.taux_dattes_seches || r.action)
    .map(
      (r) =>
        `<tr>${td(r.articule)}${td(r.taux_tombe_branche, 'center')}${td(r.taux_dechets, 'center')}${td(r.taux_dattes_seches, 'center')}${td(r.action)}</tr>`
    )
    .join('');

  const prixRows = form.prix
    .filter((r) => r.articule || r.prix_fournisseur || r.prix_definitif)
    .map(
      (r) =>
        `<tr>${td(r.articule)}${td(r.prix_fournisseur, 'right')}${td(r.prix_definitif, 'right')}</tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"/>
<title>Bon de réclamation fournisseur ${docNum}</title>
<style>
  @page{size:A4;margin:8mm 10mm;}
  *{box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:9.5px;color:#111;margin:0;}
  table{border-collapse:collapse;width:100%;}
  h3{font-size:10px;margin:8px 0 3px;}
</style>
</head><body>
<table style="border:2px solid #333;">
  <tbody>
    <tr>
      <td style="width:16%;border:2px solid #333;vertical-align:middle;padding:5px 8px;text-align:center;">
        <div style="font-weight:900;font-size:14px;color:#1a5c2a;line-height:1.1;">Royal</div>
        <div style="font-weight:900;font-size:20px;color:#1a5c2a;line-height:1.1;">Palm</div>
        <div style="font-size:7px;color:#888;letter-spacing:1px;">GROUP</div>
      </td>
      <td style="border:2px solid #333;border-left:none;vertical-align:middle;padding:5px 10px;text-align:center;">
        <div style="font-size:15px;font-weight:900;">Bon de réclamation fournisseur</div>
        <div style="margin-top:6px;display:flex;justify-content:center;gap:20px;">
          <span>${cb(isBio)}TN BIO-001</span>
          <span>${cb(!isBio)}CONVENTION</span>
          <span>${cb(false)}GGP</span>
        </div>
      </td>
      <td style="width:16%;border:2px solid #333;border-left:none;vertical-align:middle;padding:4px 8px;text-align:center;">
        <div style="font-size:13px;font-weight:900;font-family:monospace;color:#c00;">N° ${docNum}</div>
      </td>
    </tr>
  </tbody>
</table>

<table style="border:2px solid #333;border-top:none;">
  <tbody>
    <tr>
      <td style="border:1px solid #444;width:50%;padding:4px 8px;">
        <div><span style="color:#777;">Date :</span> <strong>${dateStr}</strong></div>
        <div style="margin-top:3px;"><span style="color:#777;">Fournisseur :</span> <strong>${supplierName}</strong></div>
      </td>
      <td style="border:1px solid #444;border-left:none;padding:4px 8px;">
        <div><span style="color:#777;">N° Facture Fournisseur :</span> <strong>${form.numero_facture_fournisseur || '............'}</strong></div>
        <div style="margin-top:2px;"><span style="color:#777;">N° Bon d'Expédition :</span> <strong>${form.numero_bon_expedition || '............'}</strong></div>
        <div style="margin-top:2px;"><span style="color:#777;">N° Rapport qualité :</span> <strong>${form.numero_rapport_qualite || '............'}</strong></div>
        <div style="margin-top:2px;"><span style="color:#777;">N° Bon de réception :</span> <strong style="font-family:monospace;">${reception.reception_number}</strong></div>
      </td>
    </tr>
  </tbody>
</table>

<h3>Écart de poids</h3>
<table style="border:1.5px solid #333;">
  <tbody>
    <tr>${th('Articulé / Caisse', '30%')}${th('Qté fournisseur')}${th('Qté réception')}${th('Écart de poids / Caisse')}</tr>
    ${ecartRows}
    ${form.ecart_nb ? `<tr><td colspan="4" style="border:1px solid #444;padding:3px 6px;font-weight:bold;">NB : ${form.ecart_nb}</td></tr>` : emptyRow(4)}
  </tbody>
</table>

<h3>Déclassement</h3>
<table style="border:1.5px solid #333;">
  <tbody>
    <tr>${th('Articulé', '30%')}${th('Qté')}${th('Classe fournisseur')}${th('Classe réception')}</tr>
    ${declassementRows || emptyRow(4) + emptyRow(4)}
  </tbody>
</table>

<h3>Conclusion du Rapport qualité :</h3>
<table style="border:1.5px solid #333;">
  <tbody>
    <tr>${th('Articulé', '22%')}${th('Taux de tombé de branche')}${th('Taux de déchets')}${th('Taux des dattes sèches')}${th('Action', '22%')}</tr>
    ${conclusionRows || emptyRow(5) + emptyRow(5)}
  </tbody>
</table>

<h3>Prix :</h3>
<table style="border:1.5px solid #333;width:70%;">
  <tbody>
    <tr>${th('Articulé', '40%')}${th('Prix fournisseur')}${th('Prix définitive')}</tr>
    ${prixRows || emptyRow(3)}
  </tbody>
</table>

<table style="border:2px solid #333;margin-top:10px;">
  <tbody>
    <tr>
      ${th('', '30%')}${th('Observation')}${th('Signature', '28%')}
    </tr>
    <tr>
      <td style="border:1px solid #444;padding:4px 8px;font-weight:bold;">Responsable réception</td>
      <td style="border:1px solid #444;padding:4px 8px;">${form.observation || '&nbsp;'}</td>
      <td style="border:1px solid #444;padding:4px 8px;"><div style="min-height:22px;"></div><div style="font-size:8px;color:#888;border-top:1px solid #ccc;">${form.responsable_reception_nom || ''}</div></td>
    </tr>
    <tr>
      <td style="border:1px solid #444;padding:4px 8px;font-weight:bold;">Responsable Achat</td>
      <td style="border:1px solid #444;padding:4px 8px;">&nbsp;</td>
      <td style="border:1px solid #444;padding:4px 8px;"><div style="min-height:22px;"></div><div style="font-size:8px;color:#888;border-top:1px solid #ccc;">${form.responsable_achat_nom || ''}</div></td>
    </tr>
    <tr>
      <td style="border:1px solid #444;padding:4px 8px;font-weight:bold;">Fournisseur</td>
      <td style="border:1px solid #444;padding:4px 8px;">&nbsp;</td>
      <td style="border:1px solid #444;padding:4px 8px;"><div style="min-height:22px;"></div><div style="font-size:8px;color:#888;border-top:1px solid #ccc;">${form.fournisseur_nom || ''}</div></td>
    </tr>
  </tbody>
</table>

<div style="font-size:7px;color:#bbb;margin-top:4px;">
  V02-2023 &nbsp;|&nbsp; ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })} — Ce document est la propriété de la société ENNOUR DATTES. Il ne peut être copié ou communiqué sans autorisation.
</div>
</body></html>`;
}

// ── Row table editor helpers ───────────────────────────────────────────────────

interface RowTableProps<T> {
  title: string;
  rows: T[];
  columns: { key: keyof T & string; label: string; placeholder?: string }[];
  emptyRow: T;
  onChange: (rows: T[]) => void;
}

function RowTable<T extends Record<string, string>>({ title, rows, columns, emptyRow, onChange }: RowTableProps<T>) {
  const setCell = (idx: number, key: keyof T & string, val: string) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{title}</Label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => onChange([...rows, { ...emptyRow }])}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Ligne
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune ligne.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              {columns.map((col) => (
                <Input
                  key={col.key}
                  className="h-9 text-xs"
                  value={row[col.key]}
                  placeholder={col.placeholder ?? col.label}
                  onChange={(e) => setCell(idx, col.key, e.target.value)}
                />
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-red-600"
                onClick={() => onChange(rows.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export const BonReclamationDialog = ({ open, onOpenChange, reception, lots, inspection }: BonReclamationDialogProps) => {
  const { data: saved } = useDocumentPrint(reception.id, 'BON_RECLAMATION');
  const saveDoc = useSaveDocumentPrint(reception.id, 'BON_RECLAMATION');

  const [form, setForm] = useState<BonReclamationFormData>(() => makeDefaultForm(reception, inspection));

  useEffect(() => {
    if (saved?.form_data) {
      setForm(saved.form_data as BonReclamationFormData);
    } else {
      setForm(makeDefaultForm(reception, inspection));
    }
  }, [saved, reception, inspection]);

  const set = (key: keyof BonReclamationFormData) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? '—';
  const recNum = reception.reception_number.replace(/[A-Z]+-?/, '');
  const docNum = String(parseInt(recNum) || 1).padStart(6, '0');

  const declaredKg = reception.declared_weight_kg ?? reception.gross_weight_kg;
  const weightGapKg = declaredKg != null ? reception.quantity_total - declaredKg : null;

  const handleSave = () => saveDoc.mutate({
    document_type: 'BON_RECLAMATION',
    source_id: reception.id,
    source_number: reception.reception_number,
    form_data: form,
  });

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildPrintHtml(form, reception));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 350);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-red-500" />
            Bon de réclamation fournisseur — {docNum}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-auto max-h-[75vh] space-y-3 pr-1">
          {/* Read-only summary */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Informations réception
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Fournisseur : </span><strong>{supplierName}</strong></div>
                <div><span className="text-muted-foreground">N° Réception : </span><strong>{reception.reception_number}</strong></div>
                <div><span className="text-muted-foreground">Qté reçue : </span><strong>{fmtW(reception.quantity_total)} kg</strong></div>
                {weightGapKg != null && (
                  <div><span className="text-muted-foreground">Écart poids : </span>
                    <strong className={weightGapKg < 0 ? 'text-red-600' : 'text-green-600'}>
                      {weightGapKg >= 0 ? '+' : ''}{fmtW(weightGapKg)} kg
                    </strong>
                  </div>
                )}
                <div><span className="text-muted-foreground">Rapport QC : </span><strong>{inspection?.inspection_number ?? '—'}</strong></div>
                <div><span className="text-muted-foreground">Lot : </span><strong>{lots[0]?.lot_internal ?? lots[0]?.lot_supplier ?? '—'}</strong></div>
              </div>
            </CardContent>
          </Card>

          {/* Header refs */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-medium uppercase tracking-wide">Références</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date du document</Label>
                <Input type="date" value={form.document_date} onChange={(e) => set('document_date')(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">N° Facture fournisseur</Label>
                <Input value={form.numero_facture_fournisseur} onChange={(e) => set('numero_facture_fournisseur')(e.target.value)} placeholder="Ex: 6122" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">N° Bon d'expédition</Label>
                <Input value={form.numero_bon_expedition} onChange={(e) => set('numero_bon_expedition')(e.target.value)} placeholder="Ex: 2090" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">N° Rapport qualité</Label>
                <Input value={form.numero_rapport_qualite} onChange={(e) => set('numero_rapport_qualite')(e.target.value)} placeholder="Ex: 491, 492" />
              </div>
            </CardContent>
          </Card>

          {/* Tables */}
          <Card>
            <CardContent className="px-4 py-4 space-y-5">
              <RowTable
                title="Écart de poids"
                rows={form.ecarts}
                columns={[
                  { key: 'articule', label: 'Articulé / Caisse' },
                  { key: 'qte_fournisseur', label: 'Qté fournisseur (kg)' },
                  { key: 'qte_reception', label: 'Qté réception (kg)' },
                  { key: 'ecart', label: 'Écart (kg)' },
                ]}
                emptyRow={{ articule: '', qte_fournisseur: '', qte_reception: '', ecart: '' }}
                onChange={(rows) => setForm((p) => ({ ...p, ecarts: rows }))}
              />
              <div className="space-y-1">
                <Label className="text-xs">NB (sous tableau écart)</Label>
                <Input value={form.ecart_nb} onChange={(e) => set('ecart_nb')(e.target.value)} placeholder="Ex: 75 GCRP + 9 GCM Branche sèche" />
              </div>

              <RowTable
                title="Déclassement"
                rows={form.declassements}
                columns={[
                  { key: 'articule', label: 'Articulé' },
                  { key: 'qte', label: 'Qté' },
                  { key: 'classe_fournisseur', label: 'Classe fournisseur' },
                  { key: 'classe_reception', label: 'Classe réception' },
                ]}
                emptyRow={{ articule: '', qte: '', classe_fournisseur: '', classe_reception: '' }}
                onChange={(rows) => setForm((p) => ({ ...p, declassements: rows }))}
              />

              <RowTable
                title="Conclusion du rapport qualité"
                rows={form.conclusions}
                columns={[
                  { key: 'articule', label: 'Articulé' },
                  { key: 'taux_tombe_branche', label: 'Taux tombé branche' },
                  { key: 'taux_dechets', label: 'Taux déchets' },
                  { key: 'taux_dattes_seches', label: 'Taux dattes sèches' },
                  { key: 'action', label: 'Action' },
                ]}
                emptyRow={{ articule: '', taux_tombe_branche: '', taux_dechets: '', taux_dattes_seches: '', action: '' }}
                onChange={(rows) => setForm((p) => ({ ...p, conclusions: rows }))}
              />

              <RowTable
                title="Prix"
                rows={form.prix}
                columns={[
                  { key: 'articule', label: 'Articulé' },
                  { key: 'prix_fournisseur', label: 'Prix fournisseur' },
                  { key: 'prix_definitif', label: 'Prix définitif' },
                ]}
                emptyRow={{ articule: '', prix_fournisseur: '', prix_definitif: '' }}
                onChange={(rows) => setForm((p) => ({ ...p, prix: rows }))}
              />
            </CardContent>
          </Card>

          {/* Signatures */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-medium uppercase tracking-wide">Observation & signatures</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Observation (responsable réception)</Label>
                <Textarea value={form.observation} onChange={(e) => set('observation')(e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Responsable réception</Label>
                  <Input value={form.responsable_reception_nom} onChange={(e) => set('responsable_reception_nom')(e.target.value)} placeholder="Nom..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Responsable achat</Label>
                  <Input value={form.responsable_achat_nom} onChange={(e) => set('responsable_achat_nom')(e.target.value)} placeholder="Nom..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fournisseur (signataire)</Label>
                  <Input value={form.fournisseur_nom} onChange={(e) => set('fournisseur_nom')(e.target.value)} placeholder="Nom..." />
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
