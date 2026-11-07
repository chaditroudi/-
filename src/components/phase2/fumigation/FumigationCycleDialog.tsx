import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  useCreateFumigationCycle,
  useUpdateFumigationCycle,
  useStartFumigationCycle,
  useSignFumigationCycle,
} from '@/hooks/useFumigation';
import { printFumigationCertificate } from './printFumigationCertificate';
import { FumigationCCPMonitor } from './FumigationCCPMonitor';
import { FumigationProgress } from './FumigationProgress';
import {
  FumigationCycle,
  FumigationChamber,
  FumigationProtocol,
  FumigationCycleStatus,
  Phase2LotRef,
  FUMIGATION_PROTOCOL_CONFIG,
} from '@/types/phase2';
import { ArrowRight, CheckCircle2, OctagonX, Printer, ShieldCheck, Play, Loader2 } from 'lucide-react';
import { LotSelector } from '../LotSelector';
import { AvailableLot } from '@/hooks/useAvailableLotsForPhase2';
import { useAuth } from '@/hooks/useAuth';
import { NumericSignaturePad } from '@/components/shared/NumericSignatureDialog';
import { PhotoCapture } from '@/components/reception/PhotoCapture';
import { formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cycle?: FumigationCycle | null;
  currentUser?: string;
}

const fieldLabel = 'text-sm font-medium';

// ─── Create form ────────────────────────────────────────────────────────────

function CreateForm({ onCreated, currentUser }: { onCreated: () => void; currentUser: string }) {
  const { t } = useTranslation();
  const create = useCreateFumigationCycle();
  const [chamber, setChamber] = useState<FumigationChamber>('FU-01');
  const [protocol, setProtocol] = useState<FumigationProtocol>('FUM-PH3-72');
  const [selectedLots, setSelectedLots] = useState<AvailableLot[]>([]);

  const proto = FUMIGATION_PROTOCOL_CONFIG[protocol];
  const totalKg = selectedLots.reduce((s, l) => s + (l.quantity_total ?? 0), 0);
  const bioConflict = selectedLots.some((l) => l.is_bio) && !proto.allows_bio;

  // Lot BIO sélectionné + protocole incompatible → bascule automatique vers
  // CO2 (autorisé bio) au lieu de demander à l'opérateur de corriger lui-même.
  const handleLotsChange = (lots: AvailableLot[]) => {
    setSelectedLots(lots);
    if (lots.some((l) => l.is_bio) && !FUMIGATION_PROTOCOL_CONFIG[protocol].allows_bio) {
      setProtocol('FUM-CO2-96');
    }
  };

  const handleCreate = async () => {
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
    <div className="space-y-5">
      <div className="space-y-2" role="group" aria-labelledby="fum-chamber">
        <p id="fum-chamber" className={fieldLabel}>{t('fumigation.create.chamber')}</p>
        <div className="grid grid-cols-2 gap-2">
          {(['FU-01', 'FU-02'] as FumigationChamber[]).map((ch) => (
            <button
              key={ch}
              type="button"
              aria-pressed={chamber === ch}
              onClick={() => setChamber(ch)}
              className={cn('min-h-14 rounded-xl border-2 font-mono text-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                chamber === ch ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/50')}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2" role="group" aria-labelledby="fum-protocol">
        <p id="fum-protocol" className={fieldLabel}>{t('fumigation.create.protocol')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.entries(FUMIGATION_PROTOCOL_CONFIG) as [FumigationProtocol, typeof proto][]).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              aria-pressed={protocol === key}
              onClick={() => setProtocol(key)}
              className={cn('flex min-h-16 flex-col justify-center gap-0.5 rounded-xl border-2 bg-card px-4 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                protocol === key ? 'border-primary bg-accent' : 'border-border hover:border-primary/40')}
            >
              <span className="font-semibold">{cfg.label}</span>
              <span className="text-sm text-muted-foreground">{t('fumigation.create.minDuration', { hours: cfg.min_duration_h })}</span>
              <span className={cn('text-xs font-semibold', cfg.allows_bio ? 'text-success' : 'text-warning')}>
                {cfg.allows_bio ? t('fumigation.create.bioAllowed') : t('fumigation.create.bioForbidden')}
              </span>
            </button>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-2 rounded-xl bg-secondary/60 p-3 text-sm">
          <div><dt className="text-muted-foreground">{t('fumigation.create.concentration')}</dt><dd className="font-semibold">{proto.target_concentration}</dd></div>
          <div><dt className="text-muted-foreground">{t('fumigation.create.temperature')}</dt><dd className="font-semibold">{proto.target_temperature}</dd></div>
        </dl>
      </div>

      <div className="space-y-2">
        <Label className={fieldLabel}>{t('fumigation.create.lots')}</Label>
        <LotSelector
          multi
          value={selectedLots.map((l) => l.id)}
          onChange={handleLotsChange}
          placeholder={t('fumigation.create.lotsPlaceholder')}
          maxItems={10}
        />
        {selectedLots.length > 0 && (
          <p className={cn('rounded-xl px-3 py-2 text-sm', bioConflict ? 'border border-destructive/30 bg-destructive/5 font-semibold text-destructive' : 'bg-accent')}>
            {t('fumigation.create.selection', { count: selectedLots.length, kg: formatNumber(totalKg, 0) })}
            {bioConflict && <span className="ms-2">{t('fumigation.create.bioConflict')}</span>}
          </p>
        )}
      </div>

      <Button size="xl" className="w-full" onClick={handleCreate} disabled={create.isPending}>
        {create.isPending && <Loader2 className="animate-spin" />}
        {t('fumigation.create.submit')}
      </Button>
    </div>
  );
}

// ─── Read-only summary (always visible — historical cycles have no actions) ─

function CycleSummary({ cycle }: { cycle: FumigationCycle }) {
  const { t } = useTranslation();
  const durationH = cycle.duration_minutes != null ? Math.round((cycle.duration_minutes / 60) * 10) / 10 : null;
  const lots = cycle.lot_refs ?? [];
  const tile = 'rounded-xl bg-secondary/60 px-3 py-2.5';

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className={tile}><dt className="text-muted-foreground">{t('fumigation.weight')}</dt><dd className="text-lg font-semibold tabular-nums"><bdi dir="ltr">{formatNumber(cycle.total_weight_kg, 0)} kg</bdi></dd></div>
        <div className={tile}><dt className="text-muted-foreground">{t('fumigation.fill')}</dt><dd className="text-lg font-semibold tabular-nums">{cycle.fill_rate_percent}%</dd></div>
        <div className={tile}><dt className="text-muted-foreground">{t('fumigation.summary.t0')}</dt><dd className="font-semibold">{formatDateTime(cycle.t0_start)}</dd></div>
        <div className={tile}><dt className="text-muted-foreground">{t('fumigation.summary.end')}</dt><dd className="font-semibold">{formatDateTime(cycle.t_end_real)}</dd></div>
      </dl>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {durationH != null && (
          <span>
            {t('fumigation.summary.duration', { hours: durationH, min: Math.round(cycle.minimum_duration_minutes / 60) })}
            {cycle.duration_compliant != null && (
              <span className={cn('ms-1 font-semibold', cycle.duration_compliant ? 'text-success' : 'text-destructive')}>
                {cycle.duration_compliant ? '✓' : t('fumigation.summary.notCompliant')}
              </span>
            )}
          </span>
        )}
        {cycle.dose_applied_g != null && <span>{t('fumigation.summary.dose')} <strong className="text-foreground">{cycle.dose_applied_g} g</strong></span>}
        {cycle.product_lot_number && <span>{t('fumigation.summary.product')} {cycle.product_lot_number}</span>}
        {cycle.residual_concentration_ppm != null && (
          <span>
            {t('fumigation.summary.residual')} <strong className="text-foreground">{cycle.residual_concentration_ppm} ppm</strong>
            {cycle.residual_tlv_compliant != null && (
              <span className={cn('ms-1 font-semibold', cycle.residual_tlv_compliant ? 'text-success' : 'text-destructive')}>
                {cycle.residual_tlv_compliant ? '✓ TLV' : '✗ TLV'}
              </span>
            )}
          </span>
        )}
        {cycle.operator_signed_at && <span>{t('fumigation.summary.operatorSigned', { name: cycle.operator_name })}</span>}
        {cycle.quality_signed_at && <span>{t('fumigation.summary.qualitySigned', { name: cycle.quality_inspector_name })}</span>}
      </div>

      {lots.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">{t('fumigation.summary.lots', { count: lots.length })}</p>
          <ul className="max-h-44 divide-y overflow-y-auto rounded-xl border bg-card">
            {lots.map((lot) => (
              <li key={lot.reception_id} className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm">
                <span className="font-mono font-semibold">{lot.lot_number}</span>
                <span className="text-muted-foreground">{lot.variety}</span>
                {lot.is_bio && <Badge variant="outline" className="border-success/40 text-success">BIO</Badge>}
                <span className="ms-auto tabular-nums"><bdi dir="ltr">{formatNumber(lot.weight_kg, 0)} kg</bdi></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── View / manage existing cycle ──────────────────────────────────────────

function CycleView({ cycle, currentUser }: { cycle: FumigationCycle; currentUser: string }) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const updateCycle = useUpdateFumigationCycle();
  const startCycle = useStartFumigationCycle();
  const signCycle = useSignFumigationCycle();

  const [view, setView] = useState<'details' | 'ccp'>('details');
  const [signRole, setSignRole] = useState<'operator' | 'quality' | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [dosage, setDosage] = useState({
    dose_applied_g: String(cycle.dose_applied_g ?? ''),
    product_lot_number: cycle.product_lot_number ?? '',
    product_expiry_date: cycle.product_expiry_date?.slice(0, 10) ?? '',
  });
  const [residualPpm, setResidualPpm] = useState(String(cycle.residual_concentration_ppm ?? ''));
  // The server refuses T0 without at least one disposition photo; this is where the operator adds it.
  const [photos, setPhotos] = useState<string[]>(cycle.photo_disposition_urls ?? []);

  const signerId = user?.id || currentUser;
  const signerName =
    profile?.full_name?.trim() ||
    String(user?.user_metadata?.full_name || '').trim() ||
    user?.email?.split('@')[0] ||
    currentUser;

  const isCCP = cycle.status === 'EN_COURS' || cycle.status === 'VENTILATION' || cycle.status === 'VALIDATION';
  const canAdvance = cycle.status === 'PREPARATION';
  const canStart = cycle.status === 'CHARGEMENT';
  const canSign = cycle.status === 'VALIDATION';
  const canPrint = cycle.status === 'TERMINE';
  const canAbort = ['EN_COURS', 'CHARGEMENT', 'PREPARATION'].includes(cycle.status);

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
        photo_disposition_urls: photos,
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
  const readiness = [
    { key: 'dose', ok: Boolean(cycle.dose_applied_g) },
    { key: 'productLot', ok: Boolean(cycle.product_lot_number) },
    { key: 'photo', ok: (cycle.photo_disposition_urls?.length ?? 0) > 0 },
  ];
  const readyToStart = readiness.every((item) => item.ok);
  const finished = ['TERMINE', 'INTERROMPU', 'ECHEC'].includes(cycle.status);
  const pending = updateCycle.isPending || startCycle.isPending;

  // The one action that moves the cycle on, as on every task screen.
  const primary =
    canAdvance ? { label: t('fumigation.actions.toLoading'), onClick: () => void advance(), icon: <ArrowRight aria-hidden /> }
    : canStart ? { label: t('fumigation.actions.start'), onClick: () => startCycle.mutate({ id: cycle.id }), icon: <Play aria-hidden />, disabled: !readyToStart }
    : cycle.status === 'EN_COURS' ? { label: t('fumigation.actions.toVentilation'), onClick: moveToVentilation, icon: <ArrowRight aria-hidden /> }
    : cycle.status === 'VENTILATION' ? { label: t('fumigation.actions.toValidation'), onClick: () => void advance(), icon: <ArrowRight aria-hidden /> }
    : null;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t(`fumigation.status.${cycle.status}`)}</Badge>
          <span className="text-sm text-muted-foreground">{t('fumigation.chamber', { chamber: cycle.chamber })} · {proto.label}</span>
        </div>
        {!finished && <FumigationProgress status={cycle.status} />}
        <p className="rounded-xl bg-accent px-3 py-2.5 text-sm">{t(`fumigation.now.${cycle.status}`)}</p>
      </div>

      {isCCP && (
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border bg-card p-1.5" role="tablist" aria-label={t('fumigation.viewLabel')}>
          {(['details', 'ccp'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={cn('min-h-11 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary')}
            >
              {key === 'details' ? t('fumigation.details') : t('fumigation.ccpMonitor')}
            </button>
          ))}
        </div>
      )}

      {view === 'ccp' ? (
        <FumigationCCPMonitor cycle={cycle} />
      ) : (
        <>
          <CycleSummary cycle={cycle} />

          {(cycle.status === 'PREPARATION' || cycle.status === 'CHARGEMENT') && (
            <section className="space-y-3 rounded-2xl border bg-secondary/40 p-4">
              <h3 className="font-display text-lg font-semibold">{t('fumigation.dosage.title')}</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fum-dose" className={fieldLabel}>{t('fumigation.dosage.dose')}</Label>
                  <Input id="fum-dose" type="number" inputMode="decimal" className="h-12 text-lg tabular-nums" value={dosage.dose_applied_g}
                    onFocus={(e) => e.target.select()} onChange={(e) => setDosage((p) => ({ ...p, dose_applied_g: e.target.value }))} placeholder="ex: 2500" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fum-product-lot" className={fieldLabel}>{t('fumigation.dosage.productLot')}</Label>
                  <Input id="fum-product-lot" className="h-12 text-base" value={dosage.product_lot_number}
                    onChange={(e) => setDosage((p) => ({ ...p, product_lot_number: e.target.value }))} placeholder="ex: PH3-2026-042" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fum-expiry" className={fieldLabel}>{t('fumigation.dosage.expiry')}</Label>
                  <Input id="fum-expiry" type="date" className="h-12 text-base" value={dosage.product_expiry_date}
                    onChange={(e) => setDosage((p) => ({ ...p, product_expiry_date: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <p className={fieldLabel}>{t('fumigation.dosage.photos')}</p>
                <PhotoCapture photos={photos} onPhotosChange={setPhotos} maxPhotos={4} />
              </div>
              <Button variant="secondary" className="min-h-11" onClick={saveDosage} disabled={updateCycle.isPending}>
                {t('fumigation.dosage.save')}
              </Button>
              {canStart && (
                <ul className="grid gap-1.5 sm:grid-cols-3" aria-label={t('fumigation.dosage.readyLabel')}>
                  {readiness.map((item) => (
                    <li key={item.key} className={cn('flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium', item.ok ? 'border-success/40 bg-accent' : 'border-warning/40 bg-sand')}>
                      {item.ok ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> : <span className="h-4 w-4 rounded-full border-2 border-warning" aria-hidden />}
                      {t(`fumigation.dosage.ready.${item.key}`)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {cycle.status === 'VALIDATION' && (
            <section className="space-y-3 rounded-2xl border bg-secondary/40 p-4">
              <h3 className="font-display text-lg font-semibold">{t('fumigation.residual.title')}</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[12rem] flex-1 space-y-1.5">
                  <Label htmlFor="fum-residual" className={fieldLabel}>{t('fumigation.residual.ppm')}</Label>
                  <Input id="fum-residual" type="number" inputMode="decimal" className="h-12 text-lg tabular-nums" value={residualPpm}
                    onFocus={(e) => e.target.select()} onChange={(e) => setResidualPpm(e.target.value)} placeholder="ex: 0.05" />
                </div>
                <Button
                  variant="secondary"
                  className="min-h-12"
                  disabled={!residualPpm || updateCycle.isPending}
                  onClick={() => {
                    const val = Number(residualPpm);
                    updateCycle.mutate({ id: cycle.id, patch: { residual_concentration_ppm: val, residual_tlv_compliant: val <= 0.3 } });
                  }}
                >
                  {t('fumigation.residual.save')}
                </Button>
              </div>
            </section>
          )}

          {canSign && (
            <section className="space-y-3 rounded-2xl border p-4">
              <h3 className="font-display text-lg font-semibold">{t('fumigation.sign.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('fumigation.sign.hint')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['operator', 'quality'] as const).map((role) => {
                  const signedAt = role === 'operator' ? cycle.operator_signed_at : cycle.quality_signed_at;
                  const name = role === 'operator' ? cycle.operator_name : cycle.quality_inspector_name;
                  const verified = role === 'operator' ? cycle.operator_pin_verified : cycle.quality_pin_verified;
                  return (
                    <div key={role} className={cn('rounded-xl border p-3', signedAt && 'border-success/40 bg-accent')}>
                      <p className="mb-2 text-sm text-muted-foreground">{t(`fumigation.sign.${role}Role`)}</p>
                      {signedAt ? (
                        <div className="flex items-start gap-2 text-success">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                          <div>
                            <p className="font-semibold text-foreground">{name}</p>
                            <p className="text-sm text-muted-foreground">{formatDateTime(signedAt)}</p>
                            {verified ? <p className="text-sm font-semibold">{t('fumigation.sign.pinVerified')}</p> : null}
                          </div>
                        </div>
                      ) : (
                        <Button className="min-h-12 w-full" variant={role === 'operator' ? 'default' : 'outline'} onClick={() => setSignRole(role)} disabled={signCycle.isPending}>
                          <ShieldCheck aria-hidden />
                          {t(`fumigation.sign.${role}`)}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {signRole ? (
                <NumericSignaturePad
                  key={signRole}
                  title={signRole === 'quality' ? t('fumigation.sign.qualityPad') : t('fumigation.sign.operatorPad')}
                  subtitle={t('fumigation.sign.as', { name: signerName })}
                  confirmLabel={t('fumigation.sign.confirm')}
                  pending={signCycle.isPending}
                  onCancel={() => setSignRole(null)}
                  onConfirm={async (pin) => {
                    await signCycle.mutateAsync({ id: cycle.id, role: signRole, signerName, signerId, pin });
                    setSignRole(null);
                  }}
                />
              ) : null}
            </section>
          )}

          {(primary || canPrint || canAbort) && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                {canPrint && (
                  <Button variant="outline" className="min-h-12" onClick={() => printFumigationCertificate(cycle)}>
                    <Printer aria-hidden />
                    {t('fumigation.actions.print')}
                  </Button>
                )}
                {primary && (
                  <Button size="xl" className="w-full sm:w-auto" onClick={primary.onClick} disabled={pending || ('disabled' in primary && primary.disabled)}>
                    {pending && <Loader2 className="animate-spin" />}
                    {primary.label}
                    {primary.icon}
                  </Button>
                )}
              </div>
              {canAbort && (
                // An emergency stop ends a CCP cycle for good: one tap asks, the second stops.
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <p className="min-w-[12rem] flex-1 text-sm text-destructive">{confirmStop ? t('fumigation.stop.confirmHint') : t('fumigation.stop.hint')}</p>
                  {confirmStop && (
                    <Button variant="outline" className="min-h-11" onClick={() => setConfirmStop(false)}>{t('fumigation.stop.keep')}</Button>
                  )}
                  <Button
                    variant="destructive"
                    className="min-h-11"
                    onClick={() => {
                      if (!confirmStop) { setConfirmStop(true); return; }
                      updateCycle.mutate({ id: cycle.id, patch: { status: 'INTERROMPU' } });
                      setConfirmStop(false);
                    }}
                    disabled={updateCycle.isPending}
                  >
                    <OctagonX aria-hidden />
                    {confirmStop ? t('fumigation.stop.confirm') : t('fumigation.stop.button')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Dialog shell ───────────────────────────────────────────────────────────

export function FumigationCycleDialog({ open, onOpenChange, cycle, currentUser = 'Utilisateur' }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94dvh] max-w-2xl overflow-y-auto">
        <DialogHeader className="text-start">
          <p className="text-sm font-semibold text-primary">{t('fumigation.eyebrow')}</p>
          <DialogTitle className="font-display text-2xl">
            {cycle ? <span className="font-mono">{cycle.cycle_number}</span> : t('fumigation.create.title')}
          </DialogTitle>
          <DialogDescription>{cycle ? t('fumigation.manageHint') : t('fumigation.create.hint')}</DialogDescription>
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

