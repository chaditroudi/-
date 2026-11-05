import { useMemo } from 'react';
import { AlertTriangle, ChevronDown, Truck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  return (
    <div className="space-y-4">
      <section className="space-y-4">
        <Field label="Fournisseur" required>
          <SupplierPicker suppliers={activeSuppliers} value={draft.supplier_id} label={draft.supplier_label} onSelect={selectSupplier} />
        </Field>

        {draft.supplier_id && (
          <Field label="Bon de commande" required={orderRequired}>
            {ordersLoading ? (
              <p className="text-sm text-muted-foreground">Recherche des commandes ouvertes…</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {!orderRequired && (
                  <button
                    type="button"
                    onClick={() => update({ purchase_order_id: '', purchase_order_line_id: '' })}
                    aria-pressed={!draft.purchase_order_id}
                    className={cn('rounded-xl border p-3 text-left text-sm', !draft.purchase_order_id ? 'border-primary bg-primary/5' : 'hover:bg-muted')}
                  >
                    <span className="font-medium">Sans bon de commande</span>
                    <span className="block text-xs text-muted-foreground">Livraison directe. Aucune dette n'est créée ici.</span>
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
                      className={cn('rounded-xl border p-3 text-left text-sm', selected ? 'border-primary bg-primary/5' : 'hover:bg-muted')}
                    >
                      <span className="font-mono font-medium">{order.order_number}</span>
                      <span className="block truncate text-xs text-muted-foreground">{line.material?.name || line.description}</span>
                      <span className="mt-1 block text-xs">
                        Reste <strong>{getPurchaseOrderLineRemainingQuantity(line)} kg</strong> sur {getPurchaseOrderLineTargetQuantity(line)} kg
                      </span>
                    </button>
                  );
                })}
                {orderRequired && openLines.length === 0 && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 md:col-span-2">
                    Aucune commande ouverte pour ce fournisseur. Cette usine exige un bon de commande : contactez les achats.
                  </p>
                )}
              </div>
            )}
          </Field>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Field label="N° bon de livraison" required>
          <Input value={draft.delivery_note_number} onChange={(event) => update({ delivery_note_number: event.target.value })} autoComplete="off" />
        </Field>
        <Field label="Immatriculation" required={policy.requireVehicleNumber}>
          <Input value={draft.vehicle_number} onChange={(event) => update({ vehicle_number: event.target.value })} autoComplete="off" />
          {lastDelivery?.vehicle_number && !draft.vehicle_number && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => update({ vehicle_number: lastDelivery.vehicle_number ?? '', driver_name: draft.driver_name || lastDelivery.driver_name || '' })}
            >
              <Truck className="mr-1 h-3 w-3" />
              Reprendre {lastDelivery.vehicle_number}
            </Button>
          )}
        </Field>
        <Field label="Chauffeur">
          <Input value={draft.driver_name} onChange={(event) => update({ driver_name: event.target.value })} autoComplete="off" />
        </Field>
        {sameVehicleToday > 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 md:col-span-3">
            Ce véhicule a déjà livré {sameVehicleToday} fois aujourd'hui (RG-R09). Vérifiez qu'il ne s'agit pas d'un doublon.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <ChoiceChips
          label="Variété"
          required
          value={draft.variety}
          options={varieties.map((name) => ({ value: name, label: name }))}
          onChange={(variety) => update({ variety })}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <ChoiceChips
            label="Stade de maturité"
            required
            value={draft.maturity_stage}
            options={ROYAL_PALM_MATURITY_STAGES}
            onChange={(maturity_stage) => update({ maturity_stage })}
          />
          <ChoiceChips
            label="Méthode de récolte"
            required
            value={draft.harvest_method}
            options={ROYAL_PALM_HARVEST_METHODS}
            onChange={(harvest_method) => update({ harvest_method })}
          />
        </div>
        <label className="flex min-h-11 items-center gap-3 rounded-xl border px-4 py-2 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={draft.bio_declared}
            onChange={(event) => update({ bio_declared: event.target.checked })}
          />
          Lot déclaré Bio par le fournisseur
        </label>
        {bioBlocked && (
          <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Ce fournisseur n'a pas de certification Bio valide : le lot ne peut pas être reçu comme Bio (RG-R05).
          </p>
        )}
      </section>

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" className="gap-2 px-2 text-muted-foreground">
            <ChevronDown className="h-4 w-4" />
            Plus de détails (facultatif)
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 grid gap-4 md:grid-cols-3">
          <Field label="Oasis d'origine">
            <Input value={draft.origin_oasis} onChange={(event) => update({ origin_oasis: event.target.value })} />
          </Field>
          <Field label="Date de récolte">
            <Input type="date" value={draft.harvest_date} onChange={(event) => update({ harvest_date: event.target.value })} />
          </Field>
          <Field label="Heure de départ déclarée">
            <Input type="time" value={draft.departure_time} onChange={(event) => update({ departure_time: event.target.value })} />
          </Field>
          <Field label="Présentation">
            <Select value={draft.presentation} onValueChange={(presentation) => update({ presentation })}>
              <SelectTrigger aria-label="Présentation"><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>
                {ROYAL_PALM_PRESENTATIONS.map((name) => <SelectItem key={name} value={name}>{frenchLabel(name)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Parcours de fabrication" hint="Fixé sur le lot à la confirmation." className="md:col-span-2">
            <Select value={draft.manufacturing_route} onValueChange={(value) => update({ manufacturing_route: value as IntakeDraft['manufacturing_route'] })}>
              <SelectTrigger aria-label="Parcours de fabrication"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PREMIUM_WHOLE">Deglet Nour premium — fumigation requise</SelectItem>
                <SelectItem value="GENERIC">Sans prérequis fumigation — plan de maîtrise du site</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
