import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Printer, Package, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TriageSession } from '@/types/phase2';
import type { FichePaletteFormData } from '@/types/documentPrints';
import { useDocumentPrint, useSaveDocumentPrint } from '@/hooks/useDocumentPrints';

interface FichePaletteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: TriageSession;
  subLots?: Array<{ sublot_number: string; grade: string; weight_kg: number; unit_count?: number }>;
}

function fmtW(v: number | null | undefined): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
}

const GRADE_LABELS: Record<string, string> = {
  EXTRA: 'Extra',
  CATEGORIE_I: 'Catégorie I',
  CATEGORIE_II: 'Catégorie II',
  REJETE: 'Rejeté',
};

const DEFAULT_FORM: FichePaletteFormData = {
  date_hydratation: '',
  numero_chambre_hydratation: '',
  heure_entree_hs: '',
  heure_sortie_hs: '',
  date_sechoir: '',
  numero_sechoir: '',
  destination: '',
  taux_infestation_v: false,
  taux_fermentation_v: false,
  taux_homogeneite_v: false,
  traitement_thermique_v: false,
  responsable_qc_nom: '',
  responsable_production_nom: '',
};

// ── Print HTML builder ─────────────────────────────────────────────────────────

function buildPrintHtml(
  form: FichePaletteFormData,
  session: TriageSession,
  subLots: Array<{ sublot_number: string; grade: string; weight_kg: number; unit_count?: number }>,
): string {
  const dateStr = format(new Date(session.created_at), 'dd/MM/yyyy', { locale: fr });
  const annee = format(new Date(session.created_at), 'yyyy');
  const ficheNum = String(parseInt(session.id?.slice(-6) || '1', 16) % 1000000).padStart(6, '0');

  const totalKg = session.total_sorted_kg ?? (
    (session.weight_cat1_kg ?? 0) + (session.weight_cat2_kg ?? 0) +
    (session.weight_extra_kg ?? 0) + (session.weight_reject_kg ?? 0)
  );
  const rejectPct = totalKg > 0 && session.weight_reject_kg
    ? ((session.weight_reject_kg / totalKg) * 100).toFixed(1) : '0.0';

  const cb = (on: boolean) => `<span style="display:inline-block;border:1.5px solid #444;width:11px;height:11px;text-align:center;line-height:11px;font-size:9px;margin-right:3px;font-weight:bold;">${on ? '✓' : ''}</span>`;

  const gradeRows = [
    { label: 'Extra', kg: session.weight_extra_kg, grade: 'EXTRA' },
    { label: 'Catégorie I', kg: session.weight_cat1_kg, grade: 'CATEGORIE_I' },
    { label: 'Catégorie II', kg: session.weight_cat2_kg, grade: 'CATEGORIE_II' },
    { label: 'Rejeté', kg: session.weight_reject_kg, grade: 'REJETE' },
  ].map(({ label, kg, grade }) => {
    const pct = totalKg > 0 && kg ? ((kg / totalKg) * 100).toFixed(1) : '—';
    const sublot = subLots.find((s) => s.grade === grade);
    return `<tr>
      <td style="border:1px solid #ccc;padding:3px 6px;font-weight:500;">${label}</td>
      <td style="border:1px solid #ccc;border-left:none;padding:3px 6px;text-align:right;font-weight:bold;">${fmtW(kg)}</td>
      <td style="border:1px solid #ccc;border-left:none;padding:3px 6px;text-align:right;">${pct}%</td>
      <td style="border:1px solid #ccc;border-left:none;padding:3px 6px;font-family:monospace;font-size:8px;color:#555;">${sublot?.sublot_number ?? '—'}</td>
    </tr>`;
  }).join('');

  const qualiteRows = [
    { label: 'Taux infestation', val: form.taux_infestation_v },
    { label: 'Taux fermentation', val: form.taux_fermentation_v },
    { label: 'Taux homogénéité', val: form.taux_homogeneite_v },
    { label: 'Traitement thermique', val: form.traitement_thermique_v },
  ].map(({ label, val }) => `<td style="border:1px solid #ccc;border-top:none;padding:3px 6px;width:25%;">
    <div style="font-size:8px;color:#777;">${label}</div>
    <div style="display:flex;gap:8px;margin-top:3px;">
      <span style="display:inline-block;border:1.5px solid #444;width:10px;height:10px;text-align:center;line-height:10px;font-size:8px;">${val ? '✓' : ''}</span>V
      <span style="display:inline-block;border:1.5px solid #444;width:10px;height:10px;text-align:center;line-height:10px;font-size:8px;">${!val ? '✓' : ''}</span>INV
    </div>
  </td>`).join('');

  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"/>
<title>Fiche Palette ${session.lot_number}</title>
<style>
  @page{size:A4;margin:8mm 10mm;}
  *{box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:9.5px;color:#111;margin:0;}
  table{border-collapse:collapse;width:100%;}
  td,th{border:1px solid #444;padding:3px 5px;vertical-align:top;}
  .bold{font-weight:bold;}
  .center{text-align:center;}
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
        <div style="font-size:13px;font-weight:900;text-transform:uppercase;">FICHE PALETTE</div>
        <div style="font-size:10px;font-weight:600;margin-top:2px;">PRODUIT SEMI-FINI (PSF)</div>
        <div style="font-size:8px;color:#888;margin-top:3px;">REF : PRD-ENG-C04-011</div>
      </td>
      <td style="width:18%;border:2px solid #333;border-left:none;vertical-align:top;padding:4px 8px;">
        <div style="font-size:8px;color:#888;">Année</div>
        <div style="font-size:13px;font-weight:900;">${annee}</div>
        <div style="font-size:8px;color:#888;margin-top:3px;">N°</div>
        <div style="font-size:15px;font-weight:900;font-family:monospace;">${ficheNum}</div>
      </td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr>
      <td style="border:1px solid #444;width:40%;padding:3px 6px;"><span style="color:#777;">N° Lot :</span> <strong style="font-family:monospace;">${session.lot_number}</strong></td>
      <td style="border:1px solid #444;border-left:none;padding:3px 6px;"><span style="color:#777;">Date triage :</span> <strong>${dateStr}</strong></td>
    </tr>
    <tr>
      <td style="border:1px solid #444;border-top:none;padding:3px 6px;">
        <span style="color:#777;">Ligne triage :</span> <strong>${session.triage_line}</strong>
        ${session.chef_ligne ? `<span style="color:#999;font-size:8px;"> — Chef ligne : ${session.chef_ligne}</span>` : ''}
      </td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;"><span style="color:#777;">Nb opérateurs :</span> <strong>${session.worker_count ?? '—'}</strong></td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr style="background:#f5f5f5;">
      <td colspan="4" style="border:1px solid #444;font-weight:700;font-size:10px;padding:3px 8px;">Rendements — Poids sortie triage</td>
    </tr>
    <tr>
      <th style="border:1px solid #444;border-top:none;background:#eee;font-size:9px;padding:2px 5px;width:25%;">Catégorie</th>
      <th style="border:1px solid #444;border-top:none;border-left:none;background:#eee;font-size:9px;padding:2px 5px;width:25%;">Poids (kg)</th>
      <th style="border:1px solid #444;border-top:none;border-left:none;background:#eee;font-size:9px;padding:2px 5px;width:25%;">% du total</th>
      <th style="border:1px solid #444;border-top:none;border-left:none;background:#eee;font-size:9px;padding:2px 5px;">N° sous-lot</th>
    </tr>
    ${gradeRows}
    <tr style="background:#f9f9f9;">
      <td style="border:1px solid #444;font-weight:bold;padding:3px 6px;">TOTAL</td>
      <td style="border:1px solid #444;border-left:none;font-weight:bold;padding:3px 6px;text-align:right;">${fmtW(totalKg)}</td>
      <td style="border:1px solid #444;border-left:none;padding:3px 6px;text-align:right;">100%</td>
      <td style="border:1px solid #444;border-left:none;"></td>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #ccc;border-top:none;padding:3px 6px;"><span style="color:#777;">Taux de déchets :</span> <strong style="color:${parseFloat(rejectPct) > 8 ? '#c00' : '#111'};">${rejectPct}%</strong></td>
      <td colspan="2" style="border:1px solid #ccc;border-top:none;border-left:none;padding:3px 6px;"><span style="color:#777;">Vitesse tapis :</span> <strong>${session.tape_speed ?? '—'}</strong></td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr style="background:#f5f5f5;">
      <td colspan="4" style="border:1px solid #444;font-weight:700;font-size:10px;padding:3px 8px;">Traitement thermique (à compléter après traitement)</td>
    </tr>
    <tr>
      <td style="border:1px solid #444;border-top:none;padding:3px 6px;width:25%;">
        <div style="font-size:8px;color:#777;">Date hydratation (H)</div>
        <div style="font-weight:bold;margin-top:2px;">${form.date_hydratation || '............'}</div>
      </td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;width:25%;">
        <div style="font-size:8px;color:#777;">N° Chambre hydratation</div>
        <div style="font-weight:bold;margin-top:2px;">${form.numero_chambre_hydratation || '............'}</div>
      </td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;width:25%;">
        <div style="font-size:8px;color:#777;">Heure entrée H/S</div>
        <div style="font-weight:bold;margin-top:2px;">${form.heure_entree_hs || '............'}</div>
      </td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;">
        <div style="font-size:8px;color:#777;">Heure sortie H/S</div>
        <div style="font-weight:bold;margin-top:2px;">${form.heure_sortie_hs || '............'}</div>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #444;border-top:none;padding:3px 6px;">
        <div style="font-size:8px;color:#777;">Date séchoir (S)</div>
        <div style="font-weight:bold;margin-top:2px;">${form.date_sechoir || '............'}</div>
      </td>
      <td style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;">
        <div style="font-size:8px;color:#777;">N° Séchoir</div>
        <div style="font-weight:bold;margin-top:2px;">${form.numero_sechoir || '............'}</div>
      </td>
      <td colspan="2" style="border:1px solid #444;border-top:none;border-left:none;padding:3px 6px;">
        <div style="font-size:8px;color:#777;">Destination finale</div>
        <div style="font-weight:bold;margin-top:2px;">${form.destination || '............'}</div>
      </td>
    </tr>
  </tbody>
</table>
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr style="background:#f5f5f5;">
      <td colspan="4" style="border:1px solid #444;font-weight:700;font-size:10px;padding:3px 8px;">Taux qualité (V = Validé, INV = Invalidé)</td>
    </tr>
    <tr>${qualiteRows}</tr>
  </tbody>
</table>
${session.notes ? `<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;"><tbody><tr><td style="border:1px solid #444;padding:3px 8px;"><span style="color:#777;">Observations :</span> ${session.notes}</td></tr></tbody></table>` : ''}
<table style="border-collapse:collapse;width:100%;border:2px solid #333;border-top:none;">
  <tbody>
    <tr>
      <td style="border:1px solid #444;padding:4px 8px;width:33%;">
        <div style="font-size:8px;color:#888;text-transform:uppercase;margin-bottom:2px;">Chef de ligne</div>
        <div style="margin-bottom:2px;"><span style="font-size:8px;color:#888;">Nom :</span> <strong style="font-size:9px;">${session.chef_ligne ?? '................'}</strong></div>
        <div style="min-height:22px;border-bottom:1px solid #bbb;margin-top:4px;"></div>
      </td>
      <td style="border:1px solid #444;padding:4px 8px;width:33%;">
        <div style="font-size:8px;color:#888;text-transform:uppercase;margin-bottom:2px;">Responsable QC</div>
        <div style="margin-bottom:2px;"><span style="font-size:8px;color:#888;">Nom :</span> <strong style="font-size:9px;">${form.responsable_qc_nom || '................'}</strong></div>
        <div style="min-height:22px;border-bottom:1px solid #bbb;margin-top:4px;"></div>
      </td>
      <td style="border:1px solid #444;padding:4px 8px;width:33%;">
        <div style="font-size:8px;color:#888;text-transform:uppercase;margin-bottom:2px;">Responsable Production</div>
        <div style="margin-bottom:2px;"><span style="font-size:8px;color:#888;">Nom :</span> <strong style="font-size:9px;">${form.responsable_production_nom || '................'}</strong></div>
        <div style="min-height:22px;border-bottom:1px solid #bbb;margin-top:4px;"></div>
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

export const FichePaletteDialog = ({ open, onOpenChange, session, subLots = [] }: FichePaletteDialogProps) => {
  const { data: saved } = useDocumentPrint(session.id, 'FICHE_PALETTE');
  const saveDoc = useSaveDocumentPrint(session.id, 'FICHE_PALETTE');

  const [form, setForm] = useState<FichePaletteFormData>(DEFAULT_FORM);

  useEffect(() => {
    if (saved?.form_data) {
      setForm(saved.form_data as FichePaletteFormData);
    }
  }, [saved]);

  const set = (key: keyof Omit<FichePaletteFormData, 'taux_infestation_v'|'taux_fermentation_v'|'taux_homogeneite_v'|'traitement_thermique_v'>) =>
    (val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const setCheck = (key: keyof Pick<FichePaletteFormData, 'taux_infestation_v'|'taux_fermentation_v'|'taux_homogeneite_v'|'traitement_thermique_v'>) =>
    (val: boolean) => setForm((prev) => ({ ...prev, [key]: val }));

  const dateStr = format(new Date(session.created_at), 'dd/MM/yyyy', { locale: fr });

  const totalKg = session.total_sorted_kg ?? (
    (session.weight_cat1_kg ?? 0) + (session.weight_cat2_kg ?? 0) +
    (session.weight_extra_kg ?? 0) + (session.weight_reject_kg ?? 0)
  );
  const rejectPct = totalKg > 0 && session.weight_reject_kg
    ? ((session.weight_reject_kg / totalKg) * 100).toFixed(1) : '0.0';

  const handleSave = () => saveDoc.mutate({
    document_type: 'FICHE_PALETTE',
    source_id: session.id,
    source_number: session.lot_number,
    form_data: form,
  });

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildPrintHtml(form, session, subLots));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 350);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Fiche Palette — {session.lot_number}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-auto max-h-[75vh] space-y-3 pr-1">
          {/* Section 1: Read-only summary */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Informations triage
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">N° Lot : </span><strong>{session.lot_number}</strong></div>
                <div><span className="text-muted-foreground">Date : </span><strong>{dateStr}</strong></div>
                <div><span className="text-muted-foreground">Ligne triage : </span><strong>{session.triage_line}</strong></div>
                <div><span className="text-muted-foreground">Total trié : </span><strong>{fmtW(totalKg)} kg</strong></div>
                <div><span className="text-muted-foreground">Taux rejet : </span><strong className={parseFloat(rejectPct) > 8 ? 'text-red-600' : ''}>{rejectPct}%</strong></div>
                {session.chef_ligne && <div><span className="text-muted-foreground">Chef ligne : </span><strong>{session.chef_ligne}</strong></div>}
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                {[
                  { label: 'Extra', kg: session.weight_extra_kg, grade: 'EXTRA' },
                  { label: 'Cat. I', kg: session.weight_cat1_kg, grade: 'CATEGORIE_I' },
                  { label: 'Cat. II', kg: session.weight_cat2_kg, grade: 'CATEGORIE_II' },
                  { label: 'Rejeté', kg: session.weight_reject_kg, grade: 'REJETE' },
                ].map(({ label, kg }) => (
                  <div key={label} className="bg-white border rounded p-1.5 text-center">
                    <div className="text-muted-foreground">{label}</div>
                    <div className="font-bold">{fmtW(kg)} kg</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Editable fields */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-medium uppercase tracking-wide">Champs à compléter</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Traitement thermique</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Date hydratation</Label>
                    <Input type="date" value={form.date_hydratation} onChange={(e) => set('date_hydratation')(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">N° Chambre hydratation</Label>
                    <Input value={form.numero_chambre_hydratation} onChange={(e) => set('numero_chambre_hydratation')(e.target.value)} placeholder="Ex: CH-01" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Heure entrée H/S</Label>
                    <Input type="time" value={form.heure_entree_hs} onChange={(e) => set('heure_entree_hs')(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Heure sortie H/S</Label>
                    <Input type="time" value={form.heure_sortie_hs} onChange={(e) => set('heure_sortie_hs')(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date séchoir</Label>
                    <Input type="date" value={form.date_sechoir} onChange={(e) => set('date_sechoir')(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">N° Séchoir</Label>
                    <Input value={form.numero_sechoir} onChange={(e) => set('numero_sechoir')(e.target.value)} placeholder="Ex: S-03" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Destination finale</Label>
                    <Input value={form.destination} onChange={(e) => set('destination')(e.target.value)} placeholder="Destination..." />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Taux qualité (V = Validé)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'taux_infestation_v' as const, label: 'Taux infestation' },
                    { key: 'taux_fermentation_v' as const, label: 'Taux fermentation' },
                    { key: 'taux_homogeneite_v' as const, label: "Taux homogénéité" },
                    { key: 'traitement_thermique_v' as const, label: 'Traitement thermique' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={key}
                        checked={form[key]}
                        onCheckedChange={(checked) => setCheck(key)(!!checked)}
                      />
                      <Label htmlFor={key} className="text-xs cursor-pointer">{label} — Validé</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Responsable QC (nom)</Label>
                  <Input value={form.responsable_qc_nom} onChange={(e) => set('responsable_qc_nom')(e.target.value)} placeholder="Nom..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Responsable Production (nom)</Label>
                  <Input value={form.responsable_production_nom} onChange={(e) => set('responsable_production_nom')(e.target.value)} placeholder="Nom..." />
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
