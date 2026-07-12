import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Note: FumigationChamber chips replace the Select for chamber selection
import { Separator } from '@/components/ui/separator';
import {
  useCreateFumigationCycle,
  useUpdateFumigationCycle,
  useStartFumigationCycle,
  useSignFumigationCycle,
} from '@/hooks/useFumigation';
import { printFumigationCertificate } from './printFumigationCertificate';
import { FumigationCCPMonitor } from './FumigationCCPMonitor';
import {
  FumigationCycle,
  FumigationChamber,
  FumigationProtocol,
  FumigationCycleStatus,
  Phase2LotRef,
  FUMIGATION_PROTOCOL_CONFIG,
} from '@/types/phase2';
import { AlertTriangle, CheckCircle2, Printer, ShieldCheck, Play, Loader2 } from 'lucide-react';
import { LotSelector } from '../LotSelector';
import { AvailableLot } from '@/hooks/useAvailableLotsForPhase2';

const STATUS_LABELS: Record<FumigationCycleStatus, string> = {
  PREPARATION: 'Préparation',
  CHARGEMENT: 'Chargement lots',
  EN_COURS: 'En cours (CCP actif)',
  VENTILATION: 'Ventilation',
  VALIDATION: 'Validation / Signature',
  TERMINE: 'Terminé',
  INTERROMPU: 'Interrompu',
  ECHEC: 'Échec',
};

const STATUS_COLOR: Record<FumigationCycleStatus, string> = {
  PREPARATION: 'bg-gray-100 text-gray-700',
  CHARGEMENT: 'bg-blue-100 text-blue-700',
  EN_COURS: 'bg-amber-100 text-amber-700',
  VENTILATION: 'bg-purple-100 text-purple-700',
  VALIDATION: 'bg-orange-100 text-orange-700',
  TERMINE: 'bg-green-100 text-green-700',
  INTERROMPU: 'bg-red-100 text-red-700',
  ECHEC: 'bg-red-100 text-red-700',
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cycle?: FumigationCycle | null;
  currentUser?: string;
}

// ─── Create form ────────────────────────────────────────────────────────────

function CreateForm({ onCreated, currentUser }: { onCreated: () => void; currentUser: string }) {
  const create = useCreateFumigationCycle();
  const [chamber, setChamber] = useState<FumigationChamber>('FU-01');
  const [protocol, setProtocol] = useState<FumigationProtocol>('FUM-PH3-72');
  const [selectedLots, setSelectedLots] = useState<AvailableLot[]>([]);

  const proto = FUMIGATION_PROTOCOL_CONFIG[protocol];

  // Lot BIO sélectionné + protocole incompatible → bascule automatique vers
  // CO2 (autorisé bio) au lieu de demander à l'opérateur de corriger lui-même.
  const handleLotsChange = (lots: AvailableLot[]) => {
    setSelectedLots(lots);
    if (lots.some((l) => l.is_bio) && !FUMIGATION_PROTOCOL_CONFIG[protocol].allows_bio) {
      setProtocol('FUM-CO2-96');
    }
  };

  const handleCreate = async () => {
    const totalKg = selectedLots.reduce((s, l) => s + (l.quantity_total ?? 0), 0);
    // Rough chamber capacity estimate: FU-01/FU-02 ~10T each
    const CHAMBER_CAPACITY_KG = 10_000;
    const fillRate = CHAMBER_CAPACITY_KG > 0 ? Math.round((totalKg / CHAMBER_CAPACITY_KG) * 1000) / 10 : 0;
    const lotRefs: Phase2LotRef[] = selectedLots.map((l) => ({
      reception_id: l.id,
      lot_number: l.reception_number,
      variety: l.variety,
      weight_kg: l.quantity_total ?? 0,
      is_bio: l.is_bio ?? false,
    }));
    await create.mutateAsync({
      chamber,
      protocol,
      lot_refs: lotRefs,
      total_weight_kg: totalKg,
      fill_rate_percent: fillRate,
      created_by: currentUser,
    });
    onCreated();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Chamber — chip buttons (only 2 options) */}
        <div className="space-y-1.5">
          <Label>Chambre</Label>
          <div className="flex gap-2">
            {(['FU-01', 'FU-02'] as FumigationChamber[]).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChamber(ch)}
                className={`flex-1 rounded-xl border-2 py-2.5 font-mono text-sm font-bold transition-all ${
                  chamber === ch
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Protocole</Label>
          <Select value={protocol} onValueChange={(v) => setProtocol(v as FumigationProtocol)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(FUMIGATION_PROTOCOL_CONFIG) as [FumigationProtocol, typeof proto][]).map(
                ([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
        <div className="font-semibold">{proto.label}</div>
        <div className="text-muted-foreground">Durée min: <strong>{proto.min_duration_h}h</strong></div>
        <div className="text-muted-foreground">Concentration: {proto.target_concentration}</div>
        <div className="text-muted-foreground">Température: {proto.target_temperature}</div>
        {!proto.allows_bio && (
          <div className="text-amber-700 flex items-center gap-1.5 mt-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Interdit pour lots biologiques</span>
          </div>
        )}
        {proto.allows_bio && (
          <div className="text-green-700 text-xs">Autorisé lots biologiques</div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Lots à fumiger (sélection multiple)</Label>
        <LotSelector
          multi
          value={selectedLots.map((l) => l.id)}
          onChange={handleLotsChange}
          placeholder="Sélectionner les lots…"
          maxItems={10}
        />
        {selectedLots.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {selectedLots.length} lot(s) · Total: {selectedLots.reduce((s, l) => s + (l.quantity_total ?? 0), 0).toLocaleString('fr-TN')} kg
            {selectedLots.some((l) => l.is_bio) && !proto.allows_bio && (
              <span className="text-red-600 font-semibold ml-2">⚠ Lot(s) BIO détecté(s) — changer de protocole</span>
            )}
          </div>
        )}
      </div>

      <Button
        className="w-full"
        onClick={handleCreate}
        disabled={create.isPending}
      >
        {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Créer cycle de fumigation
      </Button>
    </div>
  );
}

// ─── Read-only summary (always visible — historical cycles have no actions) ─

function CycleSummary({ cycle }: { cycle: FumigationCycle }) {
  const fmt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString('fr-FR') : '—';
  const durationH =
    cycle.duration_minutes != null ? Math.round((cycle.duration_minutes / 60) * 10) / 10 : null;
  const lots = cycle.lot_refs ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div className="bg-muted/40 rounded-lg p-2.5">
          <div className="text-xs text-muted-foreground">Poids total</div>
          <div className="font-semibold">{cycle.total_weight_kg.toLocaleString('fr-TN')} kg</div>
        </div>
        <div className="bg-muted/40 rounded-lg p-2.5">
          <div className="text-xs text-muted-foreground">Remplissage</div>
          <div className="font-semibold">{cycle.fill_rate_percent}%</div>
        </div>
        <div className="bg-muted/40 rounded-lg p-2.5">
          <div className="text-xs text-muted-foreground">Début (T0)</div>
          <div className="font-semibold text-xs">{fmt(cycle.t0_start)}</div>
        </div>
        <div className="bg-muted/40 rounded-lg p-2.5">
          <div className="text-xs text-muted-foreground">Fin réelle</div>
          <div className="font-semibold text-xs">{fmt(cycle.t_end_real)}</div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex gap-4 flex-wrap">
        {durationH != null && (
          <span>
            Durée: <strong>{durationH}h</strong> / {Math.round(cycle.minimum_duration_minutes / 60)}h min
            {cycle.duration_compliant != null && (
              <span className={cycle.duration_compliant ? 'text-green-600 ml-1' : 'text-red-600 ml-1'}>
                {cycle.duration_compliant ? '✓' : '✗ non conforme'}
              </span>
            )}
          </span>
        )}
        {cycle.dose_applied_g != null && <span>Dose: <strong>{cycle.dose_applied_g} g</strong></span>}
        {cycle.product_lot_number && <span>Produit: {cycle.product_lot_number}</span>}
        {cycle.residual_concentration_ppm != null && (
          <span>
            Résiduel: <strong>{cycle.residual_concentration_ppm} ppm</strong>
            {cycle.residual_tlv_compliant != null && (
              <span className={cycle.residual_tlv_compliant ? 'text-green-600 ml-1' : 'text-red-600 ml-1'}>
                {cycle.residual_tlv_compliant ? '✓ TLV' : '✗ TLV'}
              </span>
            )}
          </span>
        )}
        {cycle.operator_signed_at && <span>Signé opérateur: {cycle.operator_name}</span>}
        {cycle.quality_signed_at && <span>Signé qualité: {cycle.quality_inspector_name}</span>}
      </div>

      {lots.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Lots ({lots.length})
          </div>
          <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
            {lots.map((lot) => (
              <div key={lot.reception_id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="font-mono text-xs">{lot.lot_number}</span>
                <span className="text-muted-foreground text-xs">{lot.variety}</span>
                {lot.is_bio && <Badge variant="outline" className="text-xs text-green-700">BIO</Badge>}
                <span className="ml-auto text-xs">{lot.weight_kg.toLocaleString('fr-TN')} kg</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── View / manage existing cycle ──────────────────────────────────────────

function CycleView({ cycle, currentUser }: { cycle: FumigationCycle; currentUser: string }) {
  const updateCycle = useUpdateFumigationCycle();
  const startCycle = useStartFumigationCycle();
  const signCycle = useSignFumigationCycle();

  const [view, setView] = useState<'details' | 'ccp'>('details');
  const [dosage, setDosage] = useState({
    dose_applied_g: String(cycle.dose_applied_g ?? ''),
    product_lot_number: cycle.product_lot_number ?? '',
    product_expiry_date: cycle.product_expiry_date?.slice(0, 10) ?? '',
  });
  const [residualPpm, setResidualPpm] = useState(String(cycle.residual_concentration_ppm ?? ''));

  const isCCP = cycle.status === 'EN_COURS' || cycle.status === 'VENTILATION' || cycle.status === 'VALIDATION';
  const canAdvance = cycle.status === 'PREPARATION';
  const canStart = cycle.status === 'CHARGEMENT';
  const canSign = cycle.status === 'VALIDATION';
  const canPrint = cycle.status === 'TERMINE';
  const canAbort = ['EN_COURS', 'CHARGEMENT', 'PREPARATION'].includes(cycle.status);
  const hasActions =
    canAdvance || canStart || canPrint || canAbort ||
    cycle.status === 'EN_COURS' || cycle.status === 'VENTILATION';

  const advance = async () => {
    const nextStatus: Record<string, FumigationCycleStatus> = {
      PREPARATION: 'CHARGEMENT',
      VENTILATION: 'VALIDATION',
    };
    if (cycle.status in nextStatus) {
      await updateCycle.mutateAsync({ id: cycle.id, patch: { status: nextStatus[cycle.status] } });
    }
  };

  const saveDosage = () => {
    const dose = Number(dosage.dose_applied_g);
    const calcDose = cycle.dose_calculated_g ?? 0;
    const variance = calcDose > 0 ? Math.round(((dose - calcDose) / calcDose) * 1000) / 10 : null;
    updateCycle.mutate({
      id: cycle.id,
      patch: {
        dose_applied_g: dose || null,
        product_lot_number: dosage.product_lot_number || null,
        product_expiry_date: dosage.product_expiry_date || null,
        dose_variance_percent: variance,
      },
    });
  };

  const moveToVentilation = () => {
    const now = new Date().toISOString();
    const durationMin = cycle.t0_start
      ? Math.round((Date.now() - new Date(cycle.t0_start).getTime()) / 60_000)
      : null;
    updateCycle.mutate({
      id: cycle.id,
      patch: {
        status: 'VENTILATION',
        t_end_real: now,
        duration_minutes: durationMin,
        duration_compliant:
          durationMin != null ? durationMin >= cycle.minimum_duration_minutes : null,
        parameters_compliant: true, // simplification: operator confirms
      },
    });
  };

  const proto = FUMIGATION_PROTOCOL_CONFIG[cycle.protocol];

  return (
    <div className="space-y-4">
      {/* Status header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge className={STATUS_COLOR[cycle.status]}>{STATUS_LABELS[cycle.status]}</Badge>
        <span className="font-mono text-sm text-muted-foreground">{cycle.cycle_number}</span>
        <span className="text-sm text-muted-foreground">Chambre {cycle.chamber} · {proto.label}</span>
        {isCCP && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant={view === 'details' ? 'default' : 'outline'} onClick={() => setView('details')}>Détails</Button>
            <Button size="sm" variant={view === 'ccp' ? 'default' : 'outline'} onClick={() => setView('ccp')}>CCP Monitor</Button>
          </div>
        )}
      </div>

      {view === 'ccp' ? (
        <FumigationCCPMonitor cycle={cycle} />
      ) : (
        <>
          <CycleSummary cycle={cycle} />

          {/* Phase-specific content */}
          {(cycle.status === 'PREPARATION' || cycle.status === 'CHARGEMENT') && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dosage produit</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Dose appliquée (g)</Label>
                  <Input
                    type="number"
                    value={dosage.dose_applied_g}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDosage((p) => ({ ...p, dose_applied_g: e.target.value }))}
                    placeholder="ex: 2500"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">N° lot produit</Label>
                  <Input
                    value={dosage.product_lot_number}
                    onChange={(e) => setDosage((p) => ({ ...p, product_lot_number: e.target.value }))}
                    placeholder="ex: PH3-2026-042"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expiration produit</Label>
                  <Input
                    type="date"
                    value={dosage.product_expiry_date}
                    onChange={(e) => setDosage((p) => ({ ...p, product_expiry_date: e.target.value }))}
                  />
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={saveDosage} disabled={updateCycle.isPending}>
                Enregistrer dosage
              </Button>
            </div>
          )}

          {/* Validation / residual test */}
          {cycle.status === 'VALIDATION' && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Test résiduel post-ventilation (RG-FUM-09)</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Concentration résiduelle (ppm)</Label>
                  <Input
                    type="number"
                    value={residualPpm}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setResidualPpm(e.target.value)}
                    placeholder="ex: 0.05"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!residualPpm || updateCycle.isPending}
                    onClick={() => {
                      const val = Number(residualPpm);
                      updateCycle.mutate({
                        id: cycle.id,
                        patch: { residual_concentration_ppm: val, residual_tlv_compliant: val <= 0.3 },
                      });
                    }}
                  >
                    Enregistrer
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Signature section */}
          {canSign && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Double signature CCP obligatoire (RG-FUM-12)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border rounded-lg p-3">
                    {cycle.operator_signed_at ? (
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle2 className="h-4 w-4" />
                        <div>
                          <div className="text-sm font-semibold">{cycle.operator_name}</div>
                          <div className="text-xs">{new Date(cycle.operator_signed_at).toLocaleString('fr-FR')}</div>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          signCycle.mutate({
                            id: cycle.id,
                            role: 'operator',
                            signerName: currentUser,
                            signerId: currentUser,
                          })
                        }
                        disabled={signCycle.isPending}
                      >
                        <ShieldCheck className="h-4 w-4 mr-1.5" />
                        Signer — Opérateur
                      </Button>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">Opérateur fumigation</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    {cycle.quality_signed_at ? (
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle2 className="h-4 w-4" />
                        <div>
                          <div className="text-sm font-semibold">{cycle.quality_inspector_name}</div>
                          <div className="text-xs">{new Date(cycle.quality_signed_at).toLocaleString('fr-FR')}</div>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          signCycle.mutate({
                            id: cycle.id,
                            role: 'quality',
                            signerName: currentUser,
                            signerId: currentUser,
                          })
                        }
                        disabled={signCycle.isPending}
                      >
                        <ShieldCheck className="h-4 w-4 mr-1.5" />
                        Signer — Qualité
                      </Button>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">Responsable Qualité / HACCP</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {hasActions && <Separator />}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {canAdvance && (
              <Button size="sm" onClick={advance} disabled={updateCycle.isPending}>
                → Passer au chargement
              </Button>
            )}
            {canStart && (
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => startCycle.mutate({ id: cycle.id })}
                disabled={startCycle.isPending}
              >
                <Play className="h-4 w-4 mr-1.5" />
                Démarrer cycle (T0)
              </Button>
            )}
            {cycle.status === 'EN_COURS' && (
              <Button size="sm" variant="secondary" onClick={moveToVentilation} disabled={updateCycle.isPending}>
                → Passer en ventilation
              </Button>
            )}
            {cycle.status === 'VENTILATION' && (
              <Button size="sm" onClick={advance} disabled={updateCycle.isPending}>
                → Passer en validation / signature
              </Button>
            )}
            {canPrint && (
              <Button size="sm" variant="outline" onClick={() => printFumigationCertificate(cycle)}>
                <Printer className="h-4 w-4 mr-1.5" />
                Imprimer certificat
              </Button>
            )}
            {canAbort && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => updateCycle.mutate({ id: cycle.id, patch: { status: 'INTERROMPU' } })}
                disabled={updateCycle.isPending}
              >
                Arrêt d'urgence
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dialog shell ───────────────────────────────────────────────────────────

export function FumigationCycleDialog({ open, onOpenChange, cycle, currentUser = 'Utilisateur' }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cycle ? `Cycle — ${cycle.cycle_number}` : 'Nouveau cycle de fumigation'}
          </DialogTitle>
        </DialogHeader>

        {cycle ? (
          <CycleView cycle={cycle} currentUser={currentUser} />
        ) : (
          <CreateForm onCreated={() => onOpenChange(false)} currentUser={currentUser} />
        )}
      </DialogContent>
    </Dialog>
  );
}
