import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCreateProductionOrder, useProductionConfig } from '@/hooks/useProduction';
import { useAuth } from '@/hooks/useAuth';
import { MaterialReception } from '@/types/mes';
import { type ProductionFluxCode } from '@/types/production';
import { receptionsApi } from '@/lib/api/receptions';
import type { ReceptionV2 } from '@/types/reception';

const nowLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface ProductionOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receptions: MaterialReception[];
}

// Unified shape for displaying selectable receptions regardless of origin
type SelectableReception = {
  id: string;
  reception_number: string;
  display: string;
  supplier_name: string | null;
  source: 'v1' | 'v2';
};

export const ProductionOrderDialog = ({ open, onOpenChange, receptions }: ProductionOrderDialogProps) => {
  const { t } = useTranslation();
  const { fluxCodes } = useProductionConfig();
  const { profile, user } = useAuth();
  const [productName, setProductName] = useState('');
  const [fluxCode, setFluxCode] = useState<ProductionFluxCode>(null);
  const [targetQuantity, setTargetQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [priority, setPriority] = useState('1');
  const [receptionId, setReceptionId] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [createdBy, setCreatedBy] = useState('');

  const createOrder = useCreateProductionOrder();

  // Pre-fill user name and start date each time the dialog opens
  useEffect(() => {
    if (!open) return;
    if (!createdBy) setCreatedBy(profile?.full_name || user?.email || '');
    if (!plannedStartDate) setPlannedStartDate(nowLocal());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch V2 LIBERE receptions directly (the ones users actually create)
  const { data: v2Receptions = [] } = useQuery<ReceptionV2[]>({
    queryKey: ['receptions-v2-for-production-dialog'],
    queryFn: () => receptionsApi.list() as Promise<ReceptionV2[]>,
    enabled: open,
    staleTime: 60_000,
  });

  // Old-system accepted receptions (backward compat)
  const v1Selectable: SelectableReception[] = receptions
    .filter((r) => r.status === 'accepted')
    .map((r) => ({
      id: r.id,
      reception_number: r.reception_number,
      display: `${r.reception_number}${r.material?.name ? ` — ${r.material.name}` : ''}`,
      supplier_name: (r as any).supplier?.name ?? null,
      source: 'v1',
    }));

  // V2 LIBERE receptions
  const v2Selectable: SelectableReception[] = v2Receptions
    .filter((r) => r.status === 'LIBERE')
    .map((r) => ({
      id: r.id,
      reception_number: r.reception_number,
      display: [
        r.reception_number,
        r.supplier_name_snapshot ?? r.supplier?.name,
        r.variety,
      ]
        .filter(Boolean)
        .join(' — '),
      supplier_name: r.supplier_name_snapshot ?? r.supplier?.name ?? null,
      source: 'v2',
    }));

  // Deduplicate: V2 records take precedence (may overlap if same ID appears in both systems)
  const v2Ids = new Set(v2Selectable.map((r) => r.id));
  const allSelectable = [...v2Selectable, ...v1Selectable.filter((r) => !v2Ids.has(r.id))];

  const selectedRef = allSelectable.find((r) => r.id === receptionId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOrder.mutate(
      {
        reception_id: receptionId || undefined,
        reception_number_snapshot: selectedRef?.reception_number,
        supplier_name_snapshot: selectedRef?.supplier_name ?? undefined,
        product_name: productName,
        flux_code: fluxCode,
        target_quantity: parseFloat(targetQuantity),
        unit,
        priority: parseInt(priority),
        planned_start_date: plannedStartDate || undefined,
        planned_end_date: plannedEndDate || undefined,
        notes: notes || undefined,
        created_by: createdBy || undefined,
      },
      {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      },
    );
  };

  const resetForm = () => {
    setProductName('');
    setFluxCode(null);
    setTargetQuantity('');
    setUnit('kg');
    setPriority('1');
    setReceptionId('');
    setPlannedStartDate(nowLocal());
    setPlannedEndDate('');
    setNotes('');
    setCreatedBy(profile?.full_name || user?.email || '');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('production.newOrder')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>{t('production.finishedProduct')} *</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} required />
            </div>

            <div className="col-span-2">
              <Label>Ligne de production (Flux F1–F8)</Label>
              <Select
                value={fluxCode ?? 'none'}
                onValueChange={(v) => setFluxCode(v === 'none' ? null : (v as ProductionFluxCode))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner la ligne produit…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Non spécifié</SelectItem>
                  {fluxCodes.map(({ code, label }) => (
                    <SelectItem key={code} value={code}>
                      <span className="font-mono font-bold">{code}</span> — {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Référence : Cartographie complète des flux de production v3.0
              </p>
            </div>

            <div>
              <Label>{t('production.targetQuantity')} *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(e.target.value)}
                required
              />
            </div>

            <div>
              <Label>{t('production.unitLabel')}</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">{t('production.kg')}</SelectItem>
                  <SelectItem value="tonnes">{t('production.tonnes')}</SelectItem>
                  <SelectItem value="cartons">{t('production.cartons')}</SelectItem>
                  <SelectItem value="palettes">{t('production.pallets')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('production.priority')}</Label>
              <div className="mt-1.5 flex gap-1.5">
                {([
                  { value: '1', label: t('production.priorities.normal'), active: 'border-slate-500 bg-slate-600 text-white' },
                  { value: '2', label: t('production.priorities.high'), active: 'border-amber-500 bg-amber-500 text-white' },
                  { value: '3', label: t('production.priorities.urgent'), active: 'border-red-500 bg-red-500 text-white' },
                ] as const).map(({ value, label, active }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPriority(value)}
                    className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold transition-all ${
                      priority === value ? active : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>
                {t('production.linkedReception')}
                {v2Selectable.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-[11px] py-0 px-1.5">
                    {v2Selectable.length} libéré{v2Selectable.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </Label>
              <Select value={receptionId || 'none'} onValueChange={(val) => setReceptionId(val === 'none' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.optional')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.none')}</SelectItem>
                  {allSelectable.length === 0 && (
                    <SelectItem value="__empty__" disabled>
                      Aucune réception libérée disponible
                    </SelectItem>
                  )}
                  {v2Selectable.length > 0 && (
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Réceptions V2 — Libérées
                    </div>
                  )}
                  {v2Selectable.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.display}
                    </SelectItem>
                  ))}
                  {v1Selectable.filter((r) => !v2Ids.has(r.id)).length > 0 && (
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Réceptions classiques — Acceptées
                    </div>
                  )}
                  {v1Selectable
                    .filter((r) => !v2Ids.has(r.id))
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.display}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('production.plannedStartDate')}</Label>
              <Input
                type="datetime-local"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label>{t('production.plannedEndDate')}</Label>
              <Input
                type="datetime-local"
                value={plannedEndDate}
                onChange={(e) => setPlannedEndDate(e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <Label>{t('production.createdBy')}</Label>
              <Input
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                placeholder={t('production.operatorName')}
              />
            </div>

            <div className="col-span-2">
              <Label>{t('common.notes')}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('production.specialInstructions')}
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createOrder.isPending}>
              {createOrder.isPending ? t('common.creating') : t('production.createOrder')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
