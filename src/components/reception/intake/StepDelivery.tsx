import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, Truck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldGroup } from '@/components/shared/task';
import { usePurchaseOrders } from '@/hooks/usePurchasing';
import { useSuppliers } from '@/hooks/useSuppliers';
import { cn } from '@/lib/utils';
import type { IntakeDraft, IntakePolicy } from '@/lib/receptionIntake';
import {
  hasValidBioCertification,
  isReceivableSupplier,
  ROYAL_PALM_HARVEST_METHODS,
  ROYAL_PALM_MATURITY_STAGES,
  ROYAL_PALM_PRESENTATIONS,
} from '@/lib/royalPalmPhase1';
import { getPurchaseOrderLineRemainingQuantity, getPurchaseOrderLineTargetQuantity, isPurchaseOrderReceivable } from '@/types/purchasing';
import type { Supplier } from '@/types/mes';
import type { ReceptionV2 } from '@/types/reception';

import { ChoiceChips, Field, frenchLabel, SupplierPicker } from './intakeControls';

interface StepDeliveryProps {
  draft: IntakeDraft;
  update: (patch: Partial<IntakeDraft>) => void;
  policy: IntakePolicy;
  varieties: string[];
  lastDelivery: Pick<ReceptionV2, 'vehicle_number' | 'driver_name'> | null;
  sameVehicleToday: number;
}

export const StepDelivery = ({ draft, update, policy, varieties, lastDelivery, sameVehicleToday }: StepDeliveryProps) => {
  const { t } = useTranslation();
  const { data: suppliers = [] } = useSuppliers();
  const { data: orders = [], isLoading: ordersLoading } = usePurchaseOrders();

  const activeSuppliers = useMemo(() => suppliers.filter(isReceivableSupplier), [suppliers]);
  const supplier = useMemo(() => suppliers.find((row) => row.id === draft.supplier_id) ?? null, [suppliers, draft.supplier_id]);
  const openLines = useMemo(
    () => orders
      .filter((order) => order.supplier_id === draft.supplier_id && isPurchaseOrderReceivable(order.status))
      .flatMap((order) => (order.lines ?? [])
        .filter((line) => getPurchaseOrderLineRemainingQuantity(line) > 0.0001)
        .map((line) => ({ order, line }))),
    [orders, draft.supplier_id],
  );

  const selectSupplier = (next: Supplier) => {
    update({
      supplier_id: next.id,
      supplier_label: `${next.code} · ${next.name}`,
      purchase_order_id: '',
      purchase_order_line_id: '',
      origin_oasis: next.oasis_name || '',
      origin_region: next.region || '',
      origin_gps: next.gps_coordinates || '',
    });
  };

  const orderRequired = policy.requirePurchaseOrder || !policy.allowSpontaneous;
  const bioBlocked = draft.bio_declared && !hasValidBioCertification(supplier);
  const supplierDone = Boolean(draft.supplier_id) && (!orderRequired || Boolean(draft.purchase_order_line_id));
  const truckDone = Boolean(draft.delivery_note_number.trim()) && (!policy.requireVehicleNumber || Boolean(draft.vehicle_number.trim()));
  const productDone = Boolean(draft.variety && draft.maturity_stage && draft.harvest_method) && !bioBlocked;

  return (
    <div className="space-y-4">
      <FieldGroup title={t('intake.delivery.groupSupplier')} complete={supplierDone}>
        <Field label={t('intake.delivery.supplier')} required>
          <SupplierPicker suppliers={activeSuppliers} value={draft.supplier_id} label={draft.supplier_label} onSelect={selectSupplier} />
        </Field>

        {draft.supplier_id && (
          <Field label={t('intake.delivery.order')} required={orderRequired}>
            {ordersLoading ? (
              <p className="text-sm text-muted-foreground" role="status">{t('intake.delivery.searchingOrders')}</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {!orderRequired && (
                  <button
                    type="button"
                    onClick={() => update({ purchase_order_id: '', purchase_order_line_id: '' })}
                    aria-pressed={!draft.purchase_order_id}
                    className={cn('min-h-16 rounded-xl border bg-card p-3 text-start text-sm', !draft.purchase_order_id ? 'border-primary bg-accent' : 'hover:bg-secondary')}
                  >
                    <span className="font-semibold">{t('intake.delivery.noOrder')}</span>
                    <span className="block text-xs text-muted-foreground">{t('intake.delivery.noOrderHint')}</span>
                  </button>
                )}
                {openLines.map(({ order, line }) => {
                  const selected = draft.purchase_order_line_id === line.id;
                  return (
                    <button
                      key={line.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => update({ purchase_order_id: order.id, purchase_order_line_id: line.id })}
                      className={cn('min-h-16 rounded-xl border bg-card p-3 text-start text-sm', selected ? 'border-primary bg-accent' : 'hover:bg-secondary')}
                    >
                      <span className="font-mono font-semibold" dir="ltr">{order.order_number}</span>
                      <span className="block truncate text-xs text-muted-foreground">{line.material?.name || line.description}</span>
                      <span className="mt-1 block text-xs">
                        {t('intake.delivery.remainingOn', { remaining: getPurchaseOrderLineRemainingQuantity(line), target: getPurchaseOrderLineTargetQuantity(line) })}
                      </span>
                    </button>
                  );
                })}
                {orderRequired && openLines.length === 0 && (
                  <p className="rounded-xl border border-amber-200 bg-sand p-3 text-sm text-sand-foreground md:col-span-2">
                    {t('intake.delivery.orderRequired')}
                  </p>
                )}
              </div>
            )}
          </Field>
        )}
      </FieldGroup>

      <FieldGroup title={t('intake.delivery.groupTruck')} complete={truckDone}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t('intake.delivery.deliveryNote')} required>
            <Input value={draft.delivery_note_number} onChange={(event) => update({ delivery_note_number: event.target.value })} autoComplete="off" />
          </Field>
          <Field label={t('intake.delivery.plate')} required={policy.requireVehicleNumber}>
            <Input value={draft.vehicle_number} onChange={(event) => update({ vehicle_number: event.target.value })} autoComplete="off" dir="ltr" />
            {lastDelivery?.vehicle_number && !draft.vehicle_number && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => update({ vehicle_number: lastDelivery.vehicle_number ?? '', driver_name: draft.driver_name || lastDelivery.driver_name || '' })}
              >
                <Truck className="me-1 h-3 w-3" />
                {t('intake.delivery.reuse', { plate: lastDelivery.vehicle_number })}
              </Button>
            )}
          </Field>
          <Field label={t('intake.delivery.driver')}>
            <Input value={draft.driver_name} onChange={(event) => update({ driver_name: event.target.value })} autoComplete="off" />
          </Field>
        </div>
        {sameVehicleToday > 0 && (
          <p className="rounded-xl border border-amber-200 bg-sand p-3 text-sm text-sand-foreground">
            {t('intake.delivery.sameVehicle', { count: sameVehicleToday })}
          </p>
        )}
      </FieldGroup>

      <FieldGroup title={t('intake.delivery.groupProduct')} complete={productDone}>
        <ChoiceChips
          label={t('intake.delivery.variety')}
          required
          value={draft.variety}
          options={varieties.map((name) => ({ value: name, label: name }))}
          onChange={(variety) => update({ variety })}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <ChoiceChips
            label={t('intake.delivery.maturity')}
            required
            value={draft.maturity_stage}
            options={ROYAL_PALM_MATURITY_STAGES}
            onChange={(maturity_stage) => update({ maturity_stage })}
          />
          <ChoiceChips
            label={t('intake.delivery.harvest')}
            required
            value={draft.harvest_method}
            options={ROYAL_PALM_HARVEST_METHODS}
            onChange={(harvest_method) => update({ harvest_method })}
          />
        </div>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border bg-card px-4 py-2 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[hsl(var(--primary))]"
            checked={draft.bio_declared}
            onChange={(event) => update({ bio_declared: event.target.checked })}
          />
          {t('intake.delivery.bio')}
        </label>
        {bioBlocked && (
          <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {t('intake.delivery.bioBlocked')}
          </p>
        )}
      </FieldGroup>

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" className="gap-2 px-2 text-muted-foreground">
            <ChevronDown className="h-4 w-4" />
            {t('intake.delivery.more')}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 grid gap-4 rounded-xl border bg-secondary/60 p-4 md:grid-cols-3">
          <Field label={t('intake.delivery.oasis')}>
            <Input value={draft.origin_oasis} onChange={(event) => update({ origin_oasis: event.target.value })} />
          </Field>
          <Field label={t('intake.delivery.harvestDate')}>
            <Input type="date" value={draft.harvest_date} onChange={(event) => update({ harvest_date: event.target.value })} />
          </Field>
          <Field label={t('intake.delivery.departure')}>
            <Input type="time" value={draft.departure_time} onChange={(event) => update({ departure_time: event.target.value })} />
          </Field>
          <Field label={t('intake.delivery.presentation')}>
            <Select value={draft.presentation} onValueChange={(presentation) => update({ presentation })}>
              <SelectTrigger aria-label={t('intake.delivery.presentation')}><SelectValue placeholder={t('intake.delivery.choose')} /></SelectTrigger>
              <SelectContent>
                {ROYAL_PALM_PRESENTATIONS.map((name) => <SelectItem key={name} value={name}>{frenchLabel(name)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('intake.delivery.route')} hint={t('intake.delivery.routeHint')} className="md:col-span-2">
            <Select value={draft.manufacturing_route} onValueChange={(value) => update({ manufacturing_route: value as IntakeDraft['manufacturing_route'] })}>
              <SelectTrigger aria-label={t('intake.delivery.route')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PREMIUM_WHOLE">{t('intake.delivery.routePremium')}</SelectItem>
                <SelectItem value="GENERIC">{t('intake.delivery.routeGeneric')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
