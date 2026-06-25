import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Printer, FlaskConical, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReceptionV2, ReceptionLot, QCInspection, QCCheckResult } from '@/types/reception';
import type { RapportQCFormData, RapportQCCriterion } from '@/types/documentPrints';
import { useDocumentPrint, useSaveDocumentPrint } from '@/hooks/useDocumentPrints';

interface RapportQCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reception: ReceptionV2;
  lots: ReceptionLot[];
  inspection: QCInspection | null;
}

const CRITERIA_ROWS = [
  { key: 'infestee' as const,      label: 'Infestée' },
  { key: 'fermentee' as const,     label: 'Fermentée' },
  { key: 'immature' as const,      label: 'Immature' },
  { key: 'craquele' as const,      label: 'Craquelée' },
  { key: 'grasse' as const,        label: 'Grasse' },
  { key: 'seche' as const,         label: 'Sèche' },
  { key: 'tachee' as const,        label: 'Tachée' },
  { key: 'ridee' as const,         label: 'Ridée' },
  { key: 'petit_calibre' as const, label: 'Petit calibre' },
];

type CriteriaKey = typeof CRITERIA_ROWS[number]['key'];

function matchCriterion(check: QCCheckResult, key: string): boolean {
  const name = (check.check_name ?? check.check_code ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const k = key.replace('_', ' ');
  return name.includes(k) || name.includes(key);
}

function getCriterionValue(checks: QCCheckResult[], key: string, sample: 1 | 2 | 3): string {
  const matches = checks.filter((c) => matchCriterion(c, key));
  const idx = sample - 1;
  const check = matches[idx] ?? matches[0];
  if (!check) return '';
  const val = check.measured_value;
  if (!val) return check.result === 'NON_CONFORME' ? '✗' : check.result === 'CONFORME' ? '✓' : '';
  const num = parseFloat(val);
  return isNaN(num) ? val : `${num.toFixed(1)}`;
}

function fmtW(v: number | null | undefined): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v);
}

const EMPTY_CRITERION: RapportQCCriterion = { test1: '', test2: '', test3: '' };

const makeDefaultForm = (reception: ReceptionV2, inspection: QCInspection | null): RapportQCFormData => {
  const checks: QCCheckResult[] = inspection?.check_results ?? [];
  const totalKg = reception.quantity_total;
  const tbPercent = reception.qc_score ?? null;
  const sampleWeight = inspection?.nb_samples ? (inspection.nb_samples * 2.5) : null;
  const isBranche = !reception.presentation || reception.presentation !== 'En vrac';

  const makeCriterion = (key: string): RapportQCCriterion => ({
    test1: getCriterionValue(checks, key, 1),
    test2: getCriterionValue(checks, key, 2),
    test3: getCriterionValue(checks, key, 3),
  });

  return {
    poids_tb_kg: tbPercent != null ? String((totalKg * tbPercent / 100).toFixed(0)) : '',
    poids_echantillon_kg: sampleWeight != null ? String(sampleWeight) : '',
    inspector_qc1: inspection?.inspector_name ?? '',
    inspector_qc2: inspection?.secondary_inspector_name ?? '',
    directeur_qc: '',
    criteria: {
      infestee: makeCriterion('infestee'),
      fermentee: makeCriterion('fermentee'),
      immature: makeCriterion('immature'),
      craquele: makeCriterion('craquele'),
      grasse: makeCriterion('grasse'),
      seche: makeCriterion('seche'),
      tachee: makeCriterion('tachee'),
      ridee: makeCriterion('ridee'),
      petit_calibre: makeCriterion('petit_calibre'),
    },
    conclusion: inspection?.decision ?? reception.qc_decision ?? '',
    observation: inspection?.comment ?? '',
    type_branche: isBranche,
  };
};

// ── Print HTML builder ─────────────────────────────────────────────────────────

function buildPrintHtml(form: RapportQCFormData, reception: ReceptionV2, lots: ReceptionLot[], inspection: QCInspection | null): string {
  const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? '—';
  const dateStr = format(new Date(reception.actual_arrival_date), 'dd/MM/yyyy', { locale: fr });
  const annee = format(new Date(reception.actual_arrival_date), 'yyyy');
  const isBio = reception.bio_declared === true;
  const totalKg = reception.quantity_total;
  const gcCount = lots.reduce((s, l) => s + (l.units?.filter((u) => u.unit_type === 'GC').length ?? 0), 0);
  const cmCount = lots.reduce((s, l) => s + (l.units?.filter((u) => u.unit_type === 'PLOX' || u.unit_type === 'CAISSE').length ?? 0), 0);

  const inspNum = inspection?.inspection_number ?? `QC-${reception.reception_number}`;
  const reportNum = String(parseInt(reception.reception_number.replace(/\D/g, '') || '1')).padStart(6, '0');

  const cb = (on: boolean) => `<span style="display:inline-block;border:1.5px solid #444;width:11px;height:11px;text-align:center;line-height:11px;font-size:9px;margin-right:3px;font-weight:bold;">${on ? '✓' : ''}</span>`;

  const decisionLabel = form.conclusion === 'ACCEPTE' ? 'Accepté' : form.conclusion === 'REJETE' ? 'Rejeté' : form.conclusion === 'QUARANTAINE' ? 'Quarantaine' : '—';

  const wasteKeys: CriteriaKey[] = ['infestee', 'fermentee', 'immature', 'craquele'];
  const totalWaste = wasteKeys.reduce((sum, k) => {
    const c = form.criteria[k];
    const vals = [c.test1, c.test2, c.test3].map((v) => parseFloat(v)).filter((n) => !isNaN(n));
    if (vals.length === 0) return sum;
    return sum + (vals.reduce((a, b) => a + b, 0) / vals.length);
  }, 0);

  const avgCriterion = (k: CriteriaKey): string => {
    const c = form.criteria[k];
    const vals = [c.test1, c.test2, c.test3].map((v) => parseFloat(v)).filter((n) => !isNaN(n));
    if (vals.length === 0) return '';
    return `${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)}%`;
  };

  const criteriaRows = CRITERIA_ROWS.map(({ key, label }, i) => {
    const c = form.criteria[key];
    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'};">
      <td style="border:1px solid #ccc;padding:3px 6px;font-weight:500;">${label}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center;">${c.test1 ? `${c.test1}%` : ''}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center;">${c.test2 ? `${c.test2}%` : ''}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center;">${c.test3 ? `${c.test3}%` : ''}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center;font-weight:bold;">${avgCriterion(key)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"/>
<title>Rapport Contrôle Qualité ${inspNum}</title>
<style>
  @page{size:A4;margin:8mm 10mm;}
  *{box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:9.5px;color:#111;margin:0;}
  table{border-collapse:collapse;width:100%;}
  td,th{border:1px solid #444;padding:2px 5px;vertical-align:top;}
  .bold{font-weight:bold;}
  .center{text-align:center;}
  .right{text-align:right;}
  .header-row th{background:#222;color:#fff;text-align:center;padding:3px 4px;}
  .sig{min-height:30px;border-bottom:1px solid #bbb;}
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
        <div style="font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;">RAPPORT CONTRÔLE QUALITÉ</div>
        <div style="font-size:11px;font-weight:600;margin-top:2px;">RECEPTION ACHAT</div>
        <div style="margin-top:5px;display:flex;justify-content:center;gap:18px;">
          <span>${cb(!isBio)}Conventionnel</span>
          <span>${cb(isBio)}TN-Bio-001</span>
          <span>${cb(false)}GGP</span>
        </div>
      </td>
      <td style="width:18%;border:2px solid #333;border-left:none;vertical-align:top;padding:4px 8px;">
        <div style="font-size:8px;color:#888;text-transform:uppercase;">Année</div>
        <div style="font-size:13px;font-weight:900;">${annee}</div>
        <div style="font-size:8px;color:#888;margin-top:3px;text-transform:uppercase;">N°</div>
        <div style="font-size:15px;font-weight:900;font-family:monospace;">${reportNum}</div>
      </td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr>
      <td style="border:1px solid #444;width:30%;padding:3px 6px;"><span style="color:#777;">Date réception :</span> <strong>${dateStr}</strong></td>
      <td style="border:1px solid #444;border-left:none;width:35%;padding:3px 6px;"><span style="color:#777;">Bon de Réception :</span> <strong style="font-family:monospace;">${reception.reception_number}</strong> <span style="font-size:8px;color:#888;">${reception.variety ?? ''}</span></td>
      <td style="border:1px solid #444;border-left:none;padding:3px 6px;"><span style="color:#777;">Inspecteur :</span> <strong>${form.inspector_qc1 || inspection?.inspector_name || '—'}</strong></td>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #444;border-top:none;padding:3px 6px;"><span style="color:#777;">Fournisseur :</span> <strong>${supplierName}</strong></td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;"><span style="color:#777;">Poids :</span> <strong>${fmtW(totalKg)} kg</strong></td>
    </tr>
    <tr>
      <td style="border:1px solid #444;border-top:none;padding:3px 6px;"><span style="color:#777;">Nbr caisses :</span> <strong>${gcCount > 0 ? `${gcCount} GC` : ''} ${cmCount > 0 ? `${cmCount} CM` : ''}${gcCount === 0 && cmCount === 0 ? (reception.crate_count ?? '—') : ''}</strong></td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;"><span style="color:#777;">Type des dattes :</span> ${cb(form.type_branche)}Branche ${cb(!form.type_branche)}Vrac</td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;"><span style="color:#777;">N° lot :</span> <strong style="font-family:monospace;font-size:8px;">${lots[0]?.lot_internal ?? lots[0]?.lot_supplier ?? '—'}</strong></td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr style="background:#f5f5f5;">
      <td colspan="4" style="border:1px solid #444;font-weight:700;font-size:10px;text-align:center;padding:2px;">BRANCHE</td>
    </tr>
    <tr>
      <td style="border:1px solid #444;width:30%;padding:3px 6px;"><span style="color:#777;font-size:8px;">Poids T.B.</span><div style="font-weight:bold;">${form.poids_tb_kg ? `${form.poids_tb_kg} kg` : '............'}</div></td>
      <td style="border:1px solid #444;border-left:none;width:20%;padding:3px 6px;"><span style="color:#777;font-size:8px;">% T.B.</span><div style="font-weight:bold;">${reception.qc_score != null ? `${reception.qc_score.toFixed(1)}%` : '............'}</div></td>
      <td style="border:1px solid #444;border-left:none;width:25%;padding:3px 6px;"><span style="color:#777;font-size:8px;">Poids Ech</span><div style="font-weight:bold;">${form.poids_echantillon_kg ? `${form.poids_echantillon_kg} kg` : '............'}</div></td>
      <td style="border:1px solid #444;border-left:none;padding:3px 6px;"><span style="color:#777;font-size:8px;">VRAC</span><div style="font-weight:bold;">${!form.type_branche ? fmtW(totalKg) : '0'}</div></td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <thead>
    <tr style="background:#333;color:#fff;">
      <th style="border:1px solid #555;padding:3px 5px;text-align:left;width:28%;">Critères du Contrôle</th>
      <th style="border:1px solid #555;padding:3px 5px;text-align:center;width:16%;">TEST 1</th>
      <th style="border:1px solid #555;padding:3px 5px;text-align:center;width:16%;">TEST 2</th>
      <th style="border:1px solid #555;padding:3px 5px;text-align:center;width:16%;">TEST 3</th>
      <th style="border:1px solid #555;padding:3px 5px;text-align:center;">Taux Moyen</th>
    </tr>
  </thead>
  <tbody>
    ${criteriaRows}
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr>
      <td style="border:1px solid #444;width:30%;padding:3px 6px;"><span style="color:#777;font-size:8px;">Conclusion :</span><div style="font-weight:bold;font-size:11px;">${decisionLabel}</div></td>
      <td style="border:1px solid #444;border-left:none;width:20%;padding:3px 6px;"><span style="color:#777;font-size:8px;">Taux déchet (TD)</span><div style="font-weight:bold;color:${totalWaste > 8 ? '#c00' : '#111'};">${totalWaste > 0 ? `${totalWaste.toFixed(1)}%` : '—'}</div></td>
      <td style="border:1px solid #444;border-left:none;padding:3px 6px;font-size:8px;color:#666;"><strong>NB :</strong> taux du déchet = Infestée + Fermentée + Immature + Craquelée</td>
    </tr>
    ${form.observation ? `<tr><td colspan="3" style="border:1px solid #444;border-top:none;padding:3px 6px;font-size:9px;"><span style="color:#777;">Observation :</span> ${form.observation}</td></tr>` : ''}
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr>
      <td style="border:1px solid #444;width:33%;padding:4px 8px;min-height:40px;">
        <div style="font-size:8px;color:#888;text-transform:uppercase;margin-bottom:3px;">Responsable QC 1</div>
        <div style="font-weight:bold;margin-bottom:4px;">${form.inspector_qc1 || '........................'}</div>
        <div style="min-height:22px;border-bottom:1px solid #bbb;"></div>
      </td>
      <td style="border:1px solid #444;border-left:none;width:33%;padding:4px 8px;">
        <div style="font-size:8px;color:#888;text-transform:uppercase;margin-bottom:3px;">Responsable QC 2</div>
        <div style="font-weight:bold;margin-bottom:4px;">${form.inspector_qc2 || '........................'}</div>
        <div style="min-height:22px;border-bottom:1px solid #bbb;"></div>
      </td>
      <td style="border:1px solid #444;border-left:none;padding:4px 8px;">
        <div style="font-size:8px;color:#888;text-transform:uppercase;margin-bottom:3px;">Directeur QC</div>
        <div style="font-weight:bold;margin-bottom:4px;">${form.directeur_qc || ''}</div>
        <div style="min-height:22px;border-bottom:1px solid #bbb;margin-top:16px;"></div>
      </td>
    </tr>
    <tr>
      <td colspan="3" style="border:1px solid #ccc;border-top:none;font-size:7px;color:#bbb;padding:2px 8px;">
        V01-2023 &nbsp;|&nbsp; ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })} — Royal Palm MES
      </td>
    </tr>
  </tbody>
</table>
</body></html>`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const RapportQCDialog = ({ open, onOpenChange, reception, lots, inspection }: RapportQCDialogProps) => {
  const { data: saved } = useDocumentPrint(reception.id, 'RAPPORT_QC');
  const saveDoc = useSaveDocumentPrint(reception.id, 'RAPPORT_QC');

  const [form, setForm] = useState<RapportQCFormData>(() => makeDefaultForm(reception, inspection));

  useEffect(() => {
    if (saved?.form_data) {
      setForm(saved.form_data as RapportQCFormData);
    } else {
      setForm(makeDefaultForm(reception, inspection));
    }
  }, [saved, reception, inspection]);

  const set = (key: keyof Omit<RapportQCFormData, 'criteria' | 'type_branche'>) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const setCriterion = (criterionKey: CriteriaKey, testKey: keyof RapportQCCriterion) => (val: string) =>
    setForm((prev) => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        [criterionKey]: { ...prev.criteria[criterionKey], [testKey]: val },
      },
    }));

  const supplierName = reception.supplier?.name ?? reception.supplier_name_snapshot ?? '—';
  const dateStr = format(new Date(reception.actual_arrival_date), 'dd/MM/yyyy', { locale: fr });
  const inspNum = inspection?.inspection_number ?? `QC-${reception.reception_number}`;

  const handleSave = () => saveDoc.mutate({
    document_type: 'RAPPORT_QC',
    source_id: reception.id,
    source_number: reception.reception_number,
    form_data: form,
  });

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildPrintHtml(form, reception, lots, inspection));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 350);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Rapport Contrôle Qualité — {inspNum}
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
                <div><span className="text-muted-foreground">Décision : </span><strong>{reception.qc_decision ?? '—'}</strong></div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Editable fields */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-medium uppercase tracking-wide">Champs à compléter</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Poids T.B. (kg)</Label>
                  <Input value={form.poids_tb_kg} onChange={(e) => set('poids_tb_kg')(e.target.value)} placeholder="Ex: 1250" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Poids échantillon (kg)</Label>
                  <Input value={form.poids_echantillon_kg} onChange={(e) => set('poids_echantillon_kg')(e.target.value)} placeholder="Ex: 7.5" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Inspecteur QC 1</Label>
                  <Input value={form.inspector_qc1} onChange={(e) => set('inspector_qc1')(e.target.value)} placeholder="Nom inspecteur" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Inspecteur QC 2</Label>
                  <Input value={form.inspector_qc2} onChange={(e) => set('inspector_qc2')(e.target.value)} placeholder="Nom inspecteur" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Directeur QC</Label>
                  <Input value={form.directeur_qc} onChange={(e) => set('directeur_qc')(e.target.value)} placeholder="Nom directeur" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Conclusion</Label>
                  <Select value={form.conclusion} onValueChange={(v) => setForm((p) => ({ ...p, conclusion: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACCEPTE">Accepté</SelectItem>
                      <SelectItem value="REJETE">Rejeté</SelectItem>
                      <SelectItem value="QUARANTAINE">Quarantaine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="type_branche"
                  checked={form.type_branche}
                  onCheckedChange={(checked) => setForm((p) => ({ ...p, type_branche: !!checked }))}
                />
                <Label htmlFor="type_branche" className="text-xs cursor-pointer">
                  Branche (décocher = Vrac)
                </Label>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Observation</Label>
                <Textarea value={form.observation} onChange={(e) => setForm((p) => ({ ...p, observation: e.target.value }))} placeholder="Observation générale..." rows={2} />
              </div>

              {/* Criteria table */}
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 block">Critères du Contrôle (% par test)</Label>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left p-2 font-medium">Critère</th>
                        <th className="text-center p-2 font-medium">TEST 1</th>
                        <th className="text-center p-2 font-medium">TEST 2</th>
                        <th className="text-center p-2 font-medium">TEST 3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CRITERIA_ROWS.map(({ key, label }, i) => (
                        <tr key={key} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                          <td className="p-1.5 font-medium">{label}</td>
                          <td className="p-1 w-24">
                            <Input
                              value={form.criteria[key].test1}
                              onChange={(e) => setCriterion(key, 'test1')(e.target.value)}
                              placeholder="0.0"
                              className="h-7 text-center text-xs"
                            />
                          </td>
                          <td className="p-1 w-24">
                            <Input
                              value={form.criteria[key].test2}
                              onChange={(e) => setCriterion(key, 'test2')(e.target.value)}
                              placeholder="0.0"
                              className="h-7 text-center text-xs"
                            />
                          </td>
                          <td className="p-1 w-24">
                            <Input
                              value={form.criteria[key].test3}
                              onChange={(e) => setCriterion(key, 'test3')(e.target.value)}
                              placeholder="0.0"
                              className="h-7 text-center text-xs"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
