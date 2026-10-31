import { useEffect, useMemo } from 'react';
import { CheckCircle2, Keyboard, Plus, Radio, Scale, Trash2, Unplug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStorageZonesForIntake } from '@/hooks/useReceptionIntakeZones';
import { useLatestWeighbridgeReading, type WeighbridgeReading } from '@/hooks/useWeighbridge';
import { cn } from '@/lib/utils';
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

const formatTime = (value: string) => new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

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
    className={cn('flex min-h-[72px] items-start gap-3 rounded-xl border p-3 text-left', active ? 'border-primary bg-primary/5' : 'hover:bg-muted')}
  >
    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
    <span>
      <span className="block text-sm font-semibold">{title}</span>
      <span className="block text-xs text-muted-foreground">{text}</span>
    </span>
  </button>
);

const CapturedWeight = ({ label, value, device, at }: { label: string; value: string; device: string; at: string }) => (
  <div className={cn('rounded-xl border p-3', value ? 'border-emerald-200 bg-emerald-50' : 'border-dashed')}>
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="text-2xl font-semibold tabular-nums">{value ? `${value} kg` : '—'}</p>
    {value && <p className="text-xs text-muted-foreground">{device} · {at && formatTime(at)}</p>}
  </div>
);

const ConnectedWeighing = ({ draft, update, reading, online }: {
  draft: IntakeDraft;
  update: (patch: Partial<IntakeDraft>) => void;
  reading: WeighbridgeReading | null;
  online: boolean;
}) => {
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
          Bascule injoignable. Vérifiez la connexion, ou passez en saisie manuelle.
        </p>
      ) : !reading ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          <Radio className="h-4 w-4 shrink-0" />
          Aucune lecture disponible. Faites monter le camion sur la bascule.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-semibold tabular-nums">{reading.weight_kg} kg</p>
            <p className="text-xs text-muted-foreground">
              {reading.device_code} · {formatTime(reading.captured_at)}{reading.signature_verified ? ' · lecture signée' : ''}
            </p>
          </div>
          <Button type="button" disabled={Boolean(alreadyUsed)} onClick={() => capture('gross')}>Prendre comme brut</Button>
          <Button type="button" variant="outline" disabled={Boolean(alreadyUsed)} onClick={() => capture('tare')}>Prendre comme tare</Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <CapturedWeight label="Poids brut" value={draft.gross_weight_kg} device={draft.gross_device_code} at={draft.gross_captured_at} />
        <CapturedWeight label="Tare" value={draft.tare_weight_kg} device={draft.tare_device_code} at={draft.tare_captured_at} />
      </div>
    </div>
  );
};

const ManualWeighing = ({ draft, update }: { draft: IntakeDraft; update: (patch: Partial<IntakeDraft>) => void }) => (
  <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Poids brut (kg)" required>
        <Input
          inputMode="decimal"
          className="h-12 text-lg tabular-nums"
          value={draft.gross_weight_kg}
          onChange={(event) => update({ gross_weight_kg: event.target.value, gross_captured_at: new Date().toISOString() })}
        />
      </Field>
      <Field label="Tare (kg)" required hint="Après déchargement. Le brouillon attend si le camion décharge encore.">
        <Input
          inputMode="decimal"
          className="h-12 text-lg tabular-nums"
          value={draft.tare_weight_kg}
          onChange={(event) => update({ tare_weight_kg: event.target.value, tare_captured_at: new Date().toISOString() })}
        />
      </Field>
    </div>
    <ChoiceChips
      label="D'où vient ce poids ?"
      required
      value={draft.manual_evidence}
      options={[
        { value: 'SCALE', label: 'Lu sur l\'afficheur de la bascule' },
        { value: 'NO_SCALE', label: 'Sans bascule (panne ou autre)' },
      ]}
      onChange={(value) => update({ manual_evidence: value as IntakeDraft['manual_evidence'] })}
    />
    {draft.manual_evidence === 'NO_SCALE' && (
      <Field label="Pourquoi la bascule n'a pas servi ?" required hint={`${MIN_MANUAL_REASON_LENGTH} caractères minimum. Conservé dans l'historique de pesée (RG-R08).`}>
        <Textarea value={draft.manual_reason} onChange={(event) => update({ manual_reason: event.target.value })} rows={2} />
      </Field>
    )}
  </div>
);

interface StepLotWeighingProps {
  draft: IntakeDraft;
  update: (patch: Partial<IntakeDraft>) => void;
  declaredGap: WeightGap;
  orderGap: WeightGap;
  expectedKg: number | null;
}

export const StepLotWeighing = ({ draft, update, declaredGap, orderGap, expectedKg }: StepLotWeighingProps) => {
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
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Scale className="h-4 w-4 text-primary" />Pesée</h3>
        <div role="radiogroup" aria-label="Mode de pesée" className="grid gap-2 sm:grid-cols-2">
          <ModeCard
            active={!connected}
            icon={Keyboard}
            title="Saisie manuelle"
            text="L'opérateur saisit le poids. Enregistré comme saisie manuelle."
            onClick={() => setMode('MANUAL')}
          />
          <ModeCard
            active={connected}
            icon={Radio}
            title="Bascule connectée"
            text="Le poids vient d'une lecture signée de la bascule."
            onClick={() => setMode('CONNECTED')}
          />
        </div>

        {connected
          ? <ConnectedWeighing draft={draft} update={update} reading={reading} online={scaleOnline} />
          : <ManualWeighing draft={draft} update={update} />}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className={cn('rounded-xl border p-3', net !== null && net > 0 ? 'border-primary/30 bg-primary/5' : net !== null ? 'border-red-200 bg-red-50' : 'border-dashed')}>
            <p className="text-xs font-medium text-muted-foreground">Poids net</p>
            <p className="text-2xl font-semibold tabular-nums" data-testid="net-weight">{net !== null ? `${net} kg` : '—'}</p>
          </div>
          <Field label="Poids annoncé sur le BL (kg)">
            <Input inputMode="decimal" value={draft.declared_weight_kg} onChange={(event) => update({ declared_weight_kg: event.target.value })} />
          </Field>
          {expectedKg !== null ? (
            <div className="rounded-xl border p-3">
              <p className="text-xs font-medium text-muted-foreground">Reste attendu sur la commande</p>
              <p className="text-2xl font-semibold tabular-nums">{expectedKg} kg</p>
            </div>
          ) : <div />}
        </div>
        {declaredGap.level !== 'none' && (
          <p className={cn('rounded-xl border p-3 text-sm', declaredGap.level === 'critical' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900')}>
            Écart avec le BL : {declaredGap.gapKg} kg ({declaredGap.gapPercent} %). Les deux poids sont conservés
            {declaredGap.level === 'critical' ? ' et un responsable devra revoir cet écart.' : ' et une alerte sera créée.'}
          </p>
        )}
        {orderGap.gapKg !== null && Math.abs(orderGap.gapKg) > 0.001 && (
          <p className="rounded-xl border bg-muted/40 p-3 text-sm">
            {orderGap.gapKg < 0
              ? `Livraison partielle : il restera ${Math.abs(orderGap.gapKg)} kg à recevoir sur cette commande.`
              : `${orderGap.gapKg} kg au-dessus du reste commandé. Le serveur vérifiera la tolérance de la commande.`}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Lot et supports</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre de supports" required>
            <Input inputMode="numeric" value={draft.unit_count} onChange={(event) => update({ unit_count: event.target.value })} />
          </Field>
          <Field label="Type de support">
            <Select value={draft.unit_type} onValueChange={(unit_type) => update({ unit_type })}>
              <SelectTrigger aria-label="Type de support"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {draft.lots.map((lot, index) => (
          <div key={index} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_10rem_auto]">
            <Field label={singleLot ? 'Référence du lot fournisseur' : `Lot ${index + 1} — référence fournisseur`} required>
              <Input value={lot.lot_supplier} onChange={(event) => setLot(index, { lot_supplier: event.target.value })} />
            </Field>
            <Field label="Quantité (kg)" required>
              <Input
                inputMode="decimal"
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
                aria-label={`Retirer le lot ${index + 1}`}
                onClick={() => update({ lots: draft.lots.filter((_, position) => position !== index) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {!connected && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => update({ lots: [...draft.lots, { lot_supplier: '', quantity: '' }] })}>
              <Plus className="h-4 w-4" />
              Séparer en plusieurs lots
            </Button>
            {!singleLot && <span className="text-sm text-muted-foreground">Total des lots : {getLotsTotalKg(draft)} kg</span>}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">À l'arrivée</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Température à l'arrivée (°C)" required>
            <Input inputMode="decimal" value={draft.arrival_temperature_c} onChange={(event) => update({ arrival_temperature_c: event.target.value })} />
          </Field>
          <Field label="Zone de stockage temporaire" required hint={suggestedZone ? `Suggestion : ${suggestedZone}` : undefined}>
            <Select value={draft.storage_zone_code} onValueChange={(storage_zone_code) => update({ storage_zone_code })}>
              <SelectTrigger aria-label="Zone de stockage temporaire">
                <SelectValue placeholder={zones.length > 0 ? 'Choisir une zone' : 'Aucune zone de réception active'} />
              </SelectTrigger>
              <SelectContent>
                {zones.map((zone) => <SelectItem key={zone.id} value={zone.code}>{zone.code} · {zone.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ChoiceChips
            label="Transport"
            value={draft.transport_condition}
            options={ROYAL_PALM_TRANSPORT_CONDITIONS.map((name) => ({ value: name, label: name }))}
            onChange={(transport_condition) => update({ transport_condition })}
          />
          <ChoiceChips
            label="État visuel"
            value={draft.quick_visual_state}
            options={ROYAL_PALM_VISUAL_STATES.map((name) => ({ value: name, label: name }))}
            onChange={(quick_visual_state) => update({ quick_visual_state })}
          />
        </div>
        <PhotoCapture
          photos={draft.photos}
          onPhotosChange={(photos) => update({ photos })}
          maxPhotos={4}
          title="Photo 1 vue d'ensemble · Photo 2 gros plan · Photo 3 anomalie"
        />
        {draft.photos.length >= 2 && (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Photos obligatoires ajoutées</p>
        )}
        <Field label="Observations">
          <Textarea value={draft.quick_check_notes} onChange={(event) => update({ quick_check_notes: event.target.value })} rows={2} />
        </Field>
      </section>
    </div>
  );
};
