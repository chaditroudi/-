import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Keyboard, Plus, Radio, Scale, Trash2, Unplug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStorageZonesForIntake } from '@/hooks/useReceptionIntakeZones';
import { useLatestWeighbridgeReading, type WeighbridgeReading } from '@/hooks/useWeighbridge';
import { cn } from '@/lib/utils';
import { formatNumber, formatTime as formatClock } from '@/lib/format';
import { FieldGroup } from '@/components/shared/task';
import {
  getLotsTotalKg,
  getNetWeightKg,
  MIN_MANUAL_REASON_LENGTH,
  type IntakeDraft,
  type WeightGap,
} from '@/lib/receptionIntake';
import { ROYAL_PALM_TRANSPORT_CONDITIONS, ROYAL_PALM_VISUAL_STATES } from '@/lib/royalPalmPhase1';

import { PhotoCapture } from '../PhotoCapture';
import { ChoiceChips, Field } from './intakeControls';

const UNIT_TYPES = [
  { value: 'PALETTE', label: 'Palettes' },
  { value: 'CAISSE', label: 'Caisses' },
  { value: 'VRAC', label: 'Vrac' },
  { value: 'PL', label: 'PL' },
  { value: 'GC', label: 'GC' },
  { value: 'PLOX', label: 'PLOX' },
  { value: 'LAMME', label: 'Lamme' },
];

const formatTime = (value: string) => formatClock(value);

const ModeCard = ({ active, icon: Icon, title, text, onClick }: {
  active: boolean;
  icon: typeof Radio;
  title: string;
  text: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    onClick={onClick}
    className={cn('flex min-h-[76px] items-start gap-3 rounded-xl border bg-card p-4 text-start', active ? 'border-primary bg-accent' : 'hover:bg-secondary')}
  >
    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
    <span>
      <span className="block text-sm font-semibold">{title}</span>
      <span className="block text-xs text-muted-foreground">{text}</span>
    </span>
  </button>
);

const CapturedWeight = ({ label, value, device, at }: { label: string; value: string; device: string; at: string }) => (
  <div className={cn('rounded-xl border p-3', value ? 'border-emerald-200 bg-accent' : 'border-dashed bg-card')}>
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="text-2xl font-semibold tabular-nums" dir="ltr">{value ? `${value} kg` : '—'}</p>
    {value && <p className="text-xs text-muted-foreground">{device} · {at && formatTime(at)}</p>}
  </div>
);

const ConnectedWeighing = ({ draft, update, reading, online }: {
  draft: IntakeDraft;
  update: (patch: Partial<IntakeDraft>) => void;
  reading: WeighbridgeReading | null;
  online: boolean;
}) => {
  const { t } = useTranslation();
  const alreadyUsed = reading && [draft.gross_reading_id, draft.tare_reading_id].includes(reading.reading_id);
  const capture = (kind: 'gross' | 'tare') => {
    if (!reading) return;
    update({
      [`${kind}_weight_kg`]: String(reading.weight_kg),
      [`${kind}_reading_id`]: reading.reading_id,
      [`${kind}_device_code`]: reading.device_code,
      [`${kind}_captured_at`]: reading.captured_at,
    });
  };

  return (
    <div className="space-y-3">
      {!online ? (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Unplug className="h-4 w-4 shrink-0" />
          {t('intake.weighing.scaleOffline')}
        </p>
      ) : !reading ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          <Radio className="h-4 w-4 shrink-0" />
          {t('intake.weighing.noReading')}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-semibold tabular-nums" dir="ltr">{reading.weight_kg} kg</p>
            <p className="text-xs text-muted-foreground">
              {reading.device_code} · {formatTime(reading.captured_at)}{reading.signature_verified ? t('intake.weighing.signed') : ''}
            </p>
          </div>
          <Button type="button" size="lg" disabled={Boolean(alreadyUsed)} onClick={() => capture('gross')}>{t('intake.weighing.takeGross')}</Button>
          <Button type="button" size="lg" variant="outline" disabled={Boolean(alreadyUsed)} onClick={() => capture('tare')}>{t('intake.weighing.takeTare')}</Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <CapturedWeight label={t('intake.weighing.gross')} value={draft.gross_weight_kg} device={draft.gross_device_code} at={draft.gross_captured_at} />
        <CapturedWeight label={t('intake.weighing.tare')} value={draft.tare_weight_kg} device={draft.tare_device_code} at={draft.tare_captured_at} />
      </div>
    </div>
  );
};

const ManualWeighing = ({ draft, update }: { draft: IntakeDraft; update: (patch: Partial<IntakeDraft>) => void }) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t('intake.weighing.grossKg')} required>
        <Input
          inputMode="decimal"
          className="h-14 text-2xl font-semibold tabular-nums"
          dir="ltr"
          value={draft.gross_weight_kg}
          onChange={(event) => update({ gross_weight_kg: event.target.value, gross_captured_at: new Date().toISOString() })}
        />
      </Field>
      <Field label={t('intake.weighing.tareKg')} required hint={t('intake.weighing.tareHint')}>
        <Input
          inputMode="decimal"
          className="h-14 text-2xl font-semibold tabular-nums"
          dir="ltr"
          value={draft.tare_weight_kg}
          onChange={(event) => update({ tare_weight_kg: event.target.value, tare_captured_at: new Date().toISOString() })}
        />
      </Field>
    </div>
    <ChoiceChips
      label={t('intake.weighing.evidence')}
      required
      value={draft.manual_evidence}
      options={[
        { value: 'SCALE', label: t('intake.weighing.evidenceScale') },
        { value: 'NO_SCALE', label: t('intake.weighing.evidenceNone') },
      ]}
      onChange={(value) => update({ manual_evidence: value as IntakeDraft['manual_evidence'] })}
    />
    {draft.manual_evidence === 'NO_SCALE' && (
      <Field label={t('intake.weighing.reason')} required hint={t('intake.weighing.reasonHint', { min: MIN_MANUAL_REASON_LENGTH })}>
        <Textarea value={draft.manual_reason} onChange={(event) => update({ manual_reason: event.target.value })} rows={2} />
      </Field>
    )}
  </div>
  );
};

interface StepLotWeighingProps {
  draft: IntakeDraft;
  update: (patch: Partial<IntakeDraft>) => void;
  declaredGap: WeightGap;
  orderGap: WeightGap;
  expectedKg: number | null;
}

export const StepLotWeighing = ({ draft, update, declaredGap, orderGap, expectedKg }: StepLotWeighingProps) => {
  const { t } = useTranslation();
  const connected = draft.weighing_mode === 'CONNECTED';
  const { reading, connected: scaleOnline } = useLatestWeighbridgeReading(connected);
  const { zones, suggestedZone } = useStorageZonesForIntake(draft.arrival_temperature_c);
  const net = useMemo(() => getNetWeightKg(draft), [draft]);
  const singleLot = draft.lots.length === 1;

  // One lot takes the whole net. The supplier reference starts from the delivery note.
  useEffect(() => {
    if (!singleLot) return;
    const [lot] = draft.lots;
    const quantity = net !== null && net > 0 ? String(net) : '';
    const lot_supplier = lot.lot_supplier || draft.delivery_note_number.trim();
    if (quantity !== lot.quantity || lot_supplier !== lot.lot_supplier) {
      update({ lots: [{ ...lot, quantity, lot_supplier }] });
    }
  }, [draft.delivery_note_number, draft.lots, net, singleLot, update]);

  useEffect(() => {
    if (!draft.storage_zone_code && suggestedZone) update({ storage_zone_code: suggestedZone });
  }, [draft.storage_zone_code, suggestedZone, update]);

  const setMode = (weighing_mode: IntakeDraft['weighing_mode']) => {
    if (weighing_mode === draft.weighing_mode) return;
    // Values never cross over: a typed weight cannot become a device reading, or the reverse.
    update({
      weighing_mode,
      gross_weight_kg: '', tare_weight_kg: '', gross_reading_id: '', tare_reading_id: '',
      gross_device_code: '', tare_device_code: '', gross_captured_at: '', tare_captured_at: '',
      lots: weighing_mode === 'CONNECTED' ? draft.lots.slice(0, 1) : draft.lots,
    });
  };

  const setLot = (index: number, patch: Partial<IntakeDraft['lots'][number]>) =>
    update({ lots: draft.lots.map((lot, position) => (position === index ? { ...lot, ...patch } : lot)) });

  return (
    <div className="space-y-4">
      <FieldGroup title={t('intake.weighing.groupWeighing')} complete={net !== null && net > 0} summary={net !== null && net > 0 ? `${t('intake.net')} ${formatNumber(net)} kg` : undefined}>
        <div role="radiogroup" aria-label="Mode de pesée" className="grid gap-2 sm:grid-cols-2">
          <ModeCard
            active={!connected}
            icon={Keyboard}
            title={t('intake.weighing.manual')}
            text={t('intake.weighing.manualHint')}
            onClick={() => setMode('MANUAL')}
          />
          <ModeCard
            active={connected}
            icon={Radio}
            title={t('intake.weighing.connected')}
            text={t('intake.weighing.connectedHint')}
            onClick={() => setMode('CONNECTED')}
          />
        </div>

        {connected
          ? <ConnectedWeighing draft={draft} update={update} reading={reading} online={scaleOnline} />
          : <ManualWeighing draft={draft} update={update} />}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className={cn('rounded-xl border p-4', net !== null && net > 0 ? 'border-primary/30 bg-accent' : net !== null ? 'border-red-200 bg-red-50' : 'border-dashed bg-card')}>
            <p className="text-sm font-medium text-muted-foreground">{t('intake.netWeight')}</p>
            <p className="text-4xl font-semibold tabular-nums tracking-tight" dir="ltr" data-testid="net-weight">{net !== null ? `${net} kg` : '—'}</p>
          </div>
          <Field label={t('intake.weighing.declared')}>
            <Input inputMode="decimal" dir="ltr" value={draft.declared_weight_kg} onChange={(event) => update({ declared_weight_kg: event.target.value })} />
          </Field>
          {expectedKg !== null ? (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm font-medium text-muted-foreground">{t('intake.weighing.expected')}</p>
              <p className="text-2xl font-semibold tabular-nums" dir="ltr">{expectedKg} kg</p>
            </div>
          ) : <div />}
        </div>
        {declaredGap.level !== 'none' && (
          <p className={cn('rounded-xl border p-3 text-sm', declaredGap.level === 'critical' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-sand text-sand-foreground')}>
            {t('intake.weighing.gap', { kg: declaredGap.gapKg, pct: declaredGap.gapPercent })}
            {declaredGap.level === 'critical' ? t('intake.weighing.gapCritical') : t('intake.weighing.gapWarning')}
          </p>
        )}
        {orderGap.gapKg !== null && Math.abs(orderGap.gapKg) > 0.001 && (
          <p className="rounded-xl border bg-card p-3 text-sm">
            {orderGap.gapKg < 0
              ? t('intake.weighing.partial', { kg: Math.abs(orderGap.gapKg) })
              : t('intake.weighing.over', { kg: orderGap.gapKg })}
          </p>
        )}
      </FieldGroup>

      <FieldGroup title={t('intake.weighing.groupLots')} complete={Boolean(draft.unit_count) && draft.lots.every((lot) => lot.lot_supplier && lot.quantity)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('intake.weighing.unitCount')} required>
            <Input inputMode="numeric" dir="ltr" value={draft.unit_count} onChange={(event) => update({ unit_count: event.target.value })} />
          </Field>
          <Field label={t('intake.weighing.unitType')}>
            <Select value={draft.unit_type} onValueChange={(unit_type) => update({ unit_type })}>
              <SelectTrigger aria-label={t('intake.weighing.unitType')}><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {draft.lots.map((lot, index) => (
          <div key={index} className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_10rem_auto]">
            <Field label={singleLot ? t('intake.weighing.lotRef') : t('intake.weighing.lotRefN', { n: index + 1 })} required>
              <Input value={lot.lot_supplier} onChange={(event) => setLot(index, { lot_supplier: event.target.value })} />
            </Field>
            <Field label={t('intake.weighing.quantity')} required>
              <Input
                inputMode="decimal"
                dir="ltr"
                readOnly={singleLot}
                value={lot.quantity}
                onChange={(event) => setLot(index, { quantity: event.target.value })}
              />
            </Field>
            {!singleLot && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-end"
                aria-label={t('intake.weighing.removeLot', { n: index + 1 })}
                onClick={() => update({ lots: draft.lots.filter((_, position) => position !== index) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {!connected && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => update({ lots: [...draft.lots, { lot_supplier: '', quantity: '' }] })}>
              <Plus className="h-4 w-4" />
              {t('intake.weighing.split')}
            </Button>
            {!singleLot && <span className="text-sm text-muted-foreground">{t('intake.weighing.lotsTotal', { kg: getLotsTotalKg(draft) })}</span>}
          </div>
        )}
      </FieldGroup>

      <FieldGroup title={t('intake.weighing.groupArrival')} complete={Boolean(draft.arrival_temperature_c && draft.storage_zone_code) && draft.photos.length >= 2}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('intake.weighing.temperature')} required>
            <Input inputMode="decimal" dir="ltr" value={draft.arrival_temperature_c} onChange={(event) => update({ arrival_temperature_c: event.target.value })} />
          </Field>
          <Field label={t('intake.weighing.zone')} required hint={suggestedZone ? t('intake.weighing.zoneSuggestion', { zone: suggestedZone }) : undefined}>
            <Select value={draft.storage_zone_code} onValueChange={(storage_zone_code) => update({ storage_zone_code })}>
              <SelectTrigger aria-label="Zone de stockage temporaire">
                <SelectValue placeholder={zones.length > 0 ? t('intake.weighing.chooseZone') : t('intake.weighing.noZone')} />
              </SelectTrigger>
              <SelectContent>
                {zones.map((zone) => <SelectItem key={zone.id} value={zone.code}>{zone.code} · {zone.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ChoiceChips
            label={t('intake.weighing.transport')}
            value={draft.transport_condition}
            options={ROYAL_PALM_TRANSPORT_CONDITIONS.map((name) => ({ value: name, label: name }))}
            onChange={(transport_condition) => update({ transport_condition })}
          />
          <ChoiceChips
            label={t('intake.weighing.visual')}
            value={draft.quick_visual_state}
            options={ROYAL_PALM_VISUAL_STATES.map((name) => ({ value: name, label: name }))}
            onChange={(quick_visual_state) => update({ quick_visual_state })}
          />
        </div>
        <PhotoCapture
          photos={draft.photos}
          onPhotosChange={(photos) => update({ photos })}
          maxPhotos={4}
          title={t('intake.weighing.photosTitle')}
        />
        {draft.photos.length >= 2 && (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{t('intake.weighing.photosDone')}</p>
        )}
        <Field label={t('intake.weighing.notes')}>
          <Textarea value={draft.quick_check_notes} onChange={(event) => update({ quick_check_notes: event.target.value })} rows={2} />
        </Field>
      </FieldGroup>
    </div>
  );
};
