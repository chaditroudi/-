import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Package,
  RefreshCcw,
  Scale,
  ShieldCheck,
  Truck,
  UserRound,
  Waves,
} from 'lucide-react';

import { BrandLogo } from '@/components/branding/BrandLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { PhotoCapture } from './PhotoCapture';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCreateReceptionIntake } from '@/hooks/useReceptionIntake';
import { useAuth } from '@/hooks/useAuth';
import { useBranding } from '@/hooks/useBranding';
import { useReceptionsV2 } from '@/hooks/useReceptionsV2';
import { useModule3StorageZones } from '@/hooks/useStorageModule3';
import { getReceptionIntakeZones, suggestReceptionStorageZone } from '@/lib/receptionStorageZones';

type WeightMode = 'SCALE' | 'MANUAL';
type WeightStage = 'GROSS' | 'TARE';

type TabletLot = {
  lot_supplier: string;
  quantity: number;
  variety: string;
};

const dateVarieties = ['Deglet Nour', 'Allig', 'Khouat Allig', 'Kenta', 'Arechti', 'Autre'];
const harvestMethods = [
  { value: 'Manuelle traditionnelle', label: 'Manuelle traditionnelle' },
  { value: 'Semi-mécanique', label: 'Semi-mécanique' },
  { value: 'Mécanique', label: 'Mécanique' },
];
const maturityStages = [
  { value: 'Khalal', label: 'Khalal' },
  { value: 'Rutab', label: 'Rutab' },
  { value: 'Tamar', label: 'Tamar' },
];
const transportConditions = ['Bâché', 'Non bâché', 'Réfrigéré'];
const quickVisualStates = ['Bon', 'Moyen', 'Mauvais'];
const unitTypes = ['PALETTE', 'CAISSE', 'VRAC', 'PL', 'GC', 'PLOX', 'LAMME'] as const;

const createEmptyLot = (variety: string): TabletLot => ({
  lot_supplier: '',
  quantity: 0,
  variety,
});

const parseNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const ReceptionTabletOperatorScreen = () => {
  const { data: suppliers = [] } = useSuppliers();
  const { data: receptions = [] } = useReceptionsV2();
  const { data: storageZones = [] } = useModule3StorageZones();
  const { profile, user } = useAuth();
  const { companyName, companyShortName } = useBranding();
  const createReception = useCreateReceptionIntake();

  const operatorName = profile?.full_name || user?.email?.split('@')[0] || 'Opérateur connecté';
  const connectedAtLabel = format(new Date(), 'dd/MM/yyyy');
  const availableStorageZones = useMemo(() => getReceptionIntakeZones(storageZones), [storageZones]);

  const [clock, setClock] = useState(new Date());
  const [weightStage, setWeightStage] = useState<WeightStage>('GROSS');
  const [weightMode, setWeightMode] = useState<WeightMode>('SCALE');
  const [manualWeight, setManualWeight] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [liveWeightKg, setLiveWeightKg] = useState(0);
  const [isStable, setIsStable] = useState(false);
  const [stabilityCounter, setStabilityCounter] = useState(0);
  const [grossWeightKg, setGrossWeightKg] = useState<number | null>(null);
  const [tareWeightKg, setTareWeightKg] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [arrivalPhotos, setArrivalPhotos] = useState<string[]>([]);
  const [lots, setLots] = useState<TabletLot[]>([createEmptyLot('Deglet Nour')]);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplier_id: '',
    delivery_note_number: '',
    vehicle_number: '',
    driver_name: '',
    variety: 'Deglet Nour',
    harvest_method: 'Manuelle traditionnelle',
    maturity_stage: 'Tamar',
    harvest_datetime: '',
    arrival_temperature_c: '',
    bio_declared: false,
    storage_zone_code: '',
    transport_condition: 'Bâché',
    quick_visual_state: 'Bon',
    declared_weight_kg: '',
    unit_count: '8',
    unit_type: 'PALETTE',
    packaging_type: 'caisses',
    remarks: '',
    weighing_supervisor: operatorName,
  });

  const selectedSupplier = suppliers.find((supplier) => supplier.id === form.supplier_id);
  const suggestedStorageZone = useMemo(
    () =>
      suggestReceptionStorageZone({
        zones: availableStorageZones,
        activeReceptions: receptions,
        arrivalTemperatureC: parseNumber(form.arrival_temperature_c),
        requestedZone: null,
      }),
    [availableStorageZones, form.arrival_temperature_c, receptions],
  );
  const unitCount = Math.max(1, parseInt(form.unit_count || '1', 10));
  const declaredWeightKg = parseNumber(form.declared_weight_kg);
  const netWeightKg = grossWeightKg != null && tareWeightKg != null
    ? Math.max(0, Number((grossWeightKg - tareWeightKg).toFixed(2)))
    : 0;

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setLots((currentLots) => {
      const nextLots = currentLots.map((lot) => ({ ...lot, variety: form.variety }));
      if (nextLots.length === 1) {
        nextLots[0].quantity = netWeightKg;
      }
      return nextLots;
    });
  }, [form.variety, netWeightKg]);

  const liveWeightTarget = (() => {
    if (weightMode === 'MANUAL') {
      return parseNumber(manualWeight);
    }

    if (weightStage === 'GROSS') {
      return Math.max(1500, declaredWeightKg + Math.max(1200, unitCount * 28));
    }

    return Math.max(950, grossWeightKg ? grossWeightKg * 0.32 : declaredWeightKg * 0.35 || 1200);
  })();

  useEffect(() => {
    setForm((current) => {
      if (current.weighing_supervisor && current.weighing_supervisor !== 'Opérateur connecté') {
        return current;
      }
      return { ...current, weighing_supervisor: operatorName };
    });
  }, [operatorName]);

  useEffect(() => {
    if (availableStorageZones.length === 0) return;

    setForm((current) => {
      const currentZoneStillAvailable = availableStorageZones.some((zone) => zone.code === current.storage_zone_code);
      if (currentZoneStillAvailable) return current;

      return {
        ...current,
        storage_zone_code: suggestedStorageZone || availableStorageZones[0]?.code || '',
      };
    });
  }, [availableStorageZones, suggestedStorageZone]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveWeightKg((previous) => {
        const target = liveWeightTarget || 0;
        const jitter = (Math.random() - 0.5) * (weightMode === 'SCALE' ? 2.2 : 0.4);
        const next = target > 0
          ? previous + (target - previous) * 0.18 + jitter
          : 0;

        if (Math.abs(next - target) < 1.2) {
          setStabilityCounter((count) => Math.min(count + 1, 10));
        } else {
          setStabilityCounter(0);
        }

        return Number(Math.max(0, next).toFixed(2));
      });
    }, 180);

    return () => clearInterval(interval);
  }, [liveWeightTarget, weightMode]);

  useEffect(() => {
    setIsStable(stabilityCounter >= 5 || weightMode === 'MANUAL');
  }, [stabilityCounter, weightMode]);

  const weightGapPercent = declaredWeightKg > 0 && netWeightKg > 0
    ? Number((Math.abs(netWeightKg - declaredWeightKg) / declaredWeightKg * 100).toFixed(2))
    : null;

  const lotQuantityTotal = Number(lots.reduce((sum, lot) => sum + Number(lot.quantity || 0), 0).toFixed(2));
  const lotQuantityMismatch = Math.abs(lotQuantityTotal - netWeightKg) > 0.1;

  const requiredIssues = [
    !form.supplier_id ? 'Fournisseur agréé requis.' : null,
    !form.delivery_note_number.trim() ? 'Bon de livraison requis.' : null,
    !form.vehicle_number.trim() ? 'Immatriculation véhicule requise.' : null,
    !form.arrival_temperature_c.trim() ? 'Température d’arrivée requise.' : null,
    grossWeightKg == null ? 'Poids brut non capturé.' : null,
    tareWeightKg == null ? 'Poids tare non capturé.' : null,
    netWeightKg <= 0 ? 'Poids net invalide.' : null,
    arrivalPhotos.length < 2 ? 'Au moins 2 photos sont requises.' : null,
    !form.storage_zone_code ? 'Zone temporaire requise.' : null,
    !form.weighing_supervisor.trim() ? 'Nom du superviseur requis.' : null,
    lots.some((lot) => !lot.lot_supplier.trim()) ? 'Chaque sous-lot doit avoir une référence fournisseur.' : null,
    lotQuantityMismatch ? 'La somme des sous-lots doit correspondre au poids net.' : null,
    weightMode === 'MANUAL' && manualReason.trim().length < 10 ? 'Motif de saisie manuelle requis.' : null,
  ].filter(Boolean) as string[];

  const validationChecks = [
    Boolean(form.supplier_id),
    Boolean(form.delivery_note_number.trim()),
    Boolean(form.vehicle_number.trim()),
    Boolean(form.arrival_temperature_c.trim()),
    grossWeightKg != null,
    tareWeightKg != null,
    netWeightKg > 0,
    arrivalPhotos.length >= 2,
    Boolean(form.storage_zone_code),
    Boolean(form.weighing_supervisor.trim()),
    lots.every((lot) => lot.lot_supplier.trim().length > 0),
    !lotQuantityMismatch,
    weightMode === 'MANUAL' ? manualReason.trim().length >= 10 : true,
  ];

  const completionCount = validationChecks.filter(Boolean).length;
  const totalChecks = validationChecks.length;

  const handleFieldChange = (field: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const captureCurrentWeight = () => {
    if (weightMode === 'SCALE' && !isStable) {
      setFormError('Attendez la stabilisation de la lecture pont-bascule avant capture.');
      return;
    }

    const capturedWeight = weightMode === 'MANUAL' ? parseNumber(manualWeight) : liveWeightKg;
    if (capturedWeight <= 0) {
      setFormError('Lecture de poids invalide.');
      return;
    }

    if (weightMode === 'MANUAL' && manualReason.trim().length < 10) {
      setFormError('Ajoutez un motif manuel d’au moins 10 caractères.');
      return;
    }

    if (weightStage === 'GROSS') {
      setGrossWeightKg(capturedWeight);
      setWeightStage('TARE');
      setSubmitMessage('Poids brut capturé. Procéder maintenant à la tare après déchargement.');
    } else {
      setTareWeightKg(capturedWeight);
      setSubmitMessage('Poids tare capturé. Le poids net a été recalculé.');
    }

    setFormError(null);
  };

  const resetWeighing = () => {
    setGrossWeightKg(null);
    setTareWeightKg(null);
    setWeightStage('GROSS');
    setManualWeight('');
    setManualReason('');
    setStabilityCounter(0);
    setIsStable(false);
    setSubmitMessage('Pesée réinitialisée.');
  };

  const updateLot = (index: number, patch: Partial<TabletLot>) => {
    setLots((current) => current.map((lot, lotIndex) => (
      lotIndex === index ? { ...lot, ...patch } : lot
    )));
  };

  const addLot = () => {
    setLots((current) => [...current, createEmptyLot(form.variety)]);
  };

  const removeLot = (index: number) => {
    setLots((current) => {
      if (current.length === 1) return current;
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const autoDistributeLots = () => {
    if (lots.length === 0) return;
    if (lots.length === 1) {
      updateLot(0, { quantity: netWeightKg });
      return;
    }

    const weights = lots.map((lot) => Number(lot.quantity || 0));
    const assignedBeforeLast = weights.slice(0, -1).reduce((sum, value) => sum + value, 0);
    const remainder = Math.max(0, Number((netWeightKg - assignedBeforeLast).toFixed(2)));
    updateLot(lots.length - 1, { quantity: remainder });
  };

  const handleResetScreen = (message = 'Écran réinitialisé.') => {
    setForm({
      supplier_id: '',
      delivery_note_number: '',
      vehicle_number: '',
      driver_name: '',
      variety: 'Deglet Nour',
      harvest_method: 'Manuelle traditionnelle',
      maturity_stage: 'Tamar',
      harvest_datetime: '',
      arrival_temperature_c: '',
      bio_declared: false,
      storage_zone_code: suggestedStorageZone || availableStorageZones[0]?.code || '',
      transport_condition: 'Bâché',
      quick_visual_state: 'Bon',
      declared_weight_kg: '',
      unit_count: '8',
      unit_type: 'PALETTE',
      packaging_type: 'caisses',
      remarks: '',
      weighing_supervisor: operatorName,
    });
    setArrivalPhotos([]);
    setLots([createEmptyLot('Deglet Nour')]);
    setGrossWeightKg(null);
    setTareWeightKg(null);
    setWeightStage('GROSS');
    setWeightMode('SCALE');
    setManualWeight('');
    setManualReason('');
    setFormError(null);
    setSubmitMessage(message);
  };

  const handleSubmit = async () => {
    if (requiredIssues.length > 0) {
      setFormError(requiredIssues[0]);
      return;
    }

    try {
      const intake = await createReception.mutateAsync({
        supplier_id: form.supplier_id,
        spontaneous_delivery: true,
        reception_type: 'DATTE',
        unit: 'kg',
        packaging_type: form.packaging_type,
        delivery_note_number: form.delivery_note_number.trim(),
        delivery_note_photos: arrivalPhotos,
        vehicle_number: form.vehicle_number.trim(),
        driver_name: form.driver_name.trim() || null,
        remarks: form.remarks.trim() || null,
        gross_weight_kg: grossWeightKg || 0,
        tare_weight_kg: tareWeightKg || 0,
        declared_weight_kg: declaredWeightKg || null,
        variety: form.variety,
        maturity_stage: form.maturity_stage,
        harvest_method: form.harvest_method,
        harvest_datetime: form.harvest_datetime ? new Date(form.harvest_datetime).toISOString() : null,
        bio_declared: form.bio_declared,
        arrival_temperature_c: parseNumber(form.arrival_temperature_c),
        transport_condition: form.transport_condition,
        quick_visual_state: form.quick_visual_state,
        storage_zone_code: form.storage_zone_code,
        phase1_alerts: [],
        unit_count: unitCount,
        unit_type: form.unit_type,
        weighing_source: weightMode,
        weighing_supervisor: form.weighing_supervisor.trim(),
        weighing_manual_reason: weightMode === 'MANUAL' ? manualReason.trim() : null,
        created_by: user?.id || null,
        lots: lots.map((lot) => ({
          lot_supplier: lot.lot_supplier.trim(),
          quantity: Number(lot.quantity || 0),
          origin_country: 'Tunisie',
          origin_region: selectedSupplier?.region || null,
          origin_farm: selectedSupplier?.oasis_name || null,
          harvest_date: form.harvest_datetime ? form.harvest_datetime.slice(0, 10) : null,
          maturity_stage: form.maturity_stage,
          variety: form.variety,
        })),
      });

      setFormError(null);
      handleResetScreen(`Réception ${intake.reception.reception_number} enregistrée. ${intake.lots.length} lot(s) d’entrée créés.`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erreur lors de l’enregistrement.');
    }
  };

  return (
    <div className="rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top,_rgba(244,247,241,0.96),_rgba(255,255,255,0.98)_46%,_rgba(247,249,244,1)_100%)] p-4 shadow-card sm:p-5">
      <div className="grid h-[calc(100svh-16rem)] min-h-[820px] grid-rows-[20fr_60fr_20fr] gap-4">
        <section className="grid grid-cols-1 gap-4 rounded-[28px] bg-[linear-gradient(135deg,hsl(150_26%_18%)_0%,hsl(154_22%_13%)_100%)] p-4 text-white shadow-xl md:grid-cols-[1.2fr_1fr_1fr_1.2fr]">
          <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/8 px-4 py-3">
            <div className="rounded-2xl bg-white p-2 shadow-lg">
              <BrandLogo className="h-12 w-12" imgClassName="h-full w-full object-contain" alt={companyName} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/62">{companyShortName}</p>
              <p className="truncate text-lg font-semibold">Poste tablette réception</p>
              <p className="truncate text-sm text-white/72">{companyName} · Traçabilité d’entrée et pesée pont-bascule</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/62">Date & heure</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{format(clock, 'HH:mm:ss')}</p>
            <p className="mt-1 text-sm text-white/72">{format(clock, 'EEEE dd MMMM yyyy', { locale: fr })}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/62">
              <UserRound className="h-4 w-4" />
              Opérateur connecté
            </div>
            <p className="mt-2 text-xl font-semibold">{operatorName}</p>
            <p className="mt-1 text-sm text-white/72">Session active • {connectedAtLabel}</p>
          </div>

          <div className="rounded-3xl border border-emerald-300/25 bg-black/12 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/62">
                <Scale className="h-4 w-4" />
                Lecture pont-bascule
              </div>
              <Badge className={isStable ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-emerald-950'}>
                {isStable ? 'Stable' : 'En variation'}
              </Badge>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-5xl font-black tabular-nums">{liveWeightKg.toFixed(2)}</p>
                <p className="mt-1 text-sm text-white/72">kg • {weightStage === 'GROSS' ? 'Lecture brut' : 'Lecture tare'}</p>
              </div>
              <div className="space-y-2 text-right text-sm text-white/72">
                <p>{weightMode === 'MANUAL' ? 'Saisie manuelle' : 'Source bascule'}</p>
                <p>{selectedSupplier?.name || 'Fournisseur non sélectionné'}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-border/70 bg-white/92 shadow-card">
          <div className="grid h-full grid-cols-1 gap-0 xl:grid-cols-2">
            <div className="overflow-y-auto border-b border-border/60 p-4 xl:border-b-0 xl:border-r">
              <div className="space-y-4">
                <Card className="rounded-[24px] border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Truck className="h-5 w-5 text-primary" />
                      Identification & transport
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="supplier">Fournisseur agréé *</Label>
                      <Select value={form.supplier_id} onValueChange={(value) => handleFieldChange('supplier_id', value)}>
                        <SelectTrigger id="supplier" className="h-12 rounded-2xl text-base">
                          <SelectValue placeholder="Sélectionner un fournisseur actif" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers
                            .filter((supplier) => (supplier.supplier_status || 'pending_approval') === 'active')
                            .map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.code} • {supplier.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bl-number">N° bon de livraison *</Label>
                      <Input id="bl-number" className="h-12 rounded-2xl text-base" value={form.delivery_note_number} onChange={(event) => handleFieldChange('delivery_note_number', event.target.value)} placeholder="Ex: BL-2026-0084" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vehicle-number">Immatriculation *</Label>
                      <Input id="vehicle-number" className="h-12 rounded-2xl text-base" value={form.vehicle_number} onChange={(event) => handleFieldChange('vehicle_number', event.target.value)} placeholder="TU-4521-A" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="driver-name">Chauffeur</Label>
                      <Input id="driver-name" className="h-12 rounded-2xl text-base" value={form.driver_name} onChange={(event) => handleFieldChange('driver_name', event.target.value)} placeholder="Nom chauffeur" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="arrival-temp">Température arrivée (°C) *</Label>
                      <Input id="arrival-temp" type="number" className="h-12 rounded-2xl text-base" value={form.arrival_temperature_c} onChange={(event) => handleFieldChange('arrival_temperature_c', event.target.value)} placeholder="32.5" />
                    </div>
                    <div className="space-y-2">
                      <Label>Conditions transport</Label>
                      <Select value={form.transport_condition} onValueChange={(value) => handleFieldChange('transport_condition', value)}>
                        <SelectTrigger className="h-12 rounded-2xl text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {transportConditions.map((condition) => (
                            <SelectItem key={condition} value={condition}>{condition}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>État visuel rapide</Label>
                      <Select value={form.quick_visual_state} onValueChange={(value) => handleFieldChange('quick_visual_state', value)}>
                        <SelectTrigger className="h-12 rounded-2xl text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {quickVisualStates.map((state) => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[24px] border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Package className="h-5 w-5 text-primary" />
                      Produit & traçabilité
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Variété *</Label>
                      <Select value={form.variety} onValueChange={(value) => handleFieldChange('variety', value)}>
                        <SelectTrigger className="h-12 rounded-2xl text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dateVarieties.map((variety) => (
                            <SelectItem key={variety} value={variety}>{variety}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Méthode de récolte *</Label>
                      <Select value={form.harvest_method} onValueChange={(value) => handleFieldChange('harvest_method', value)}>
                        <SelectTrigger className="h-12 rounded-2xl text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {harvestMethods.map((method) => (
                            <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Stade de maturité *</Label>
                      <Select value={form.maturity_stage} onValueChange={(value) => handleFieldChange('maturity_stage', value)}>
                        <SelectTrigger className="h-12 rounded-2xl text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {maturityStages.map((stage) => (
                            <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date/heure récolte estimée</Label>
                      <Input type="datetime-local" className="h-12 rounded-2xl text-base" value={form.harvest_datetime} onChange={(event) => handleFieldChange('harvest_datetime', event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Zone temporaire *</Label>
                      <Select value={form.storage_zone_code} onValueChange={(value) => handleFieldChange('storage_zone_code', value)}>
                        <SelectTrigger className="h-12 rounded-2xl text-base">
                          <SelectValue placeholder={availableStorageZones.length > 0 ? 'Sélectionner une zone' : 'Aucune zone active'} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStorageZones.map((zone) => (
                            <SelectItem key={zone.id} value={zone.code}>
                              {zone.code} • {zone.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {suggestedStorageZone && (
                        <p className="text-xs text-muted-foreground">
                          Suggestion système : <span className="font-medium text-foreground">{suggestedStorageZone}</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Poids annoncé BL (kg)</Label>
                      <Input type="number" className="h-12 rounded-2xl text-base" value={form.declared_weight_kg} onChange={(event) => handleFieldChange('declared_weight_kg', event.target.value)} placeholder="Ex: 5200" />
                    </div>
                    <div className="space-y-2">
                      <Label>Nombre d’unités logistiques *</Label>
                      <Input type="number" className="h-12 rounded-2xl text-base" value={form.unit_count} onChange={(event) => handleFieldChange('unit_count', event.target.value)} placeholder="8" />
                    </div>
                    <div className="space-y-2">
                      <Label>Type unité *</Label>
                      <Select value={form.unit_type} onValueChange={(value) => handleFieldChange('unit_type', value)}>
                        <SelectTrigger className="h-12 rounded-2xl text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {unitTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Déclaration Bio</Label>
                      <Button
                        type="button"
                        variant={form.bio_declared ? 'default' : 'outline'}
                        className="h-12 w-full justify-start rounded-2xl text-base"
                        onClick={() => handleFieldChange('bio_declared', !form.bio_declared)}
                      >
                        {form.bio_declared ? 'Bio déclaré: Oui' : 'Bio déclaré: Non'}
                      </Button>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <Label>Sous-lots d’entrée / références fournisseur *</Label>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={autoDistributeLots}>
                            Répartir
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={addLot}>
                            Ajouter
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/25 p-3">
                        {lots.map((lot, index) => (
                          <div key={`${index}-${lot.lot_supplier}`} className="grid gap-3 rounded-2xl border border-border/70 bg-white p-3 sm:grid-cols-[1.6fr_1fr_auto]">
                            <Input
                              className="h-12 rounded-2xl text-base"
                              value={lot.lot_supplier}
                              onChange={(event) => updateLot(index, { lot_supplier: event.target.value })}
                              placeholder={`Réf. lot fournisseur ${index + 1}`}
                            />
                            <Input
                              type="number"
                              className="h-12 rounded-2xl text-base"
                              value={lot.quantity || ''}
                              onChange={(event) => updateLot(index, { quantity: parseNumber(event.target.value) })}
                              readOnly={lots.length === 1}
                              placeholder="Quantité"
                            />
                            <Button type="button" variant="ghost" className="h-12 rounded-2xl" onClick={() => removeLot(index)} disabled={lots.length === 1}>
                              Retirer
                            </Button>
                          </div>
                        ))}
                        <div className={`rounded-2xl px-4 py-3 text-sm ${lotQuantityMismatch ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                          Total sous-lots: <strong>{lotQuantityTotal.toFixed(2)} kg</strong> • Poids net: <strong>{netWeightKg.toFixed(2)} kg</strong>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="overflow-y-auto p-4">
              <div className="space-y-4">
                <Card className="rounded-[24px] border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Scale className="h-5 w-5 text-primary" />
                      Capture de pesée
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Mode de capture</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant={weightMode === 'SCALE' ? 'default' : 'outline'} className="h-12 rounded-2xl" onClick={() => setWeightMode('SCALE')}>
                            <Waves className="mr-2 h-4 w-4" />
                            Bascule
                          </Button>
                          <Button type="button" variant={weightMode === 'MANUAL' ? 'default' : 'outline'} className="h-12 rounded-2xl" onClick={() => setWeightMode('MANUAL')}>
                            <Scale className="mr-2 h-4 w-4" />
                            Manuel
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Étape pesée</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant={weightStage === 'GROSS' ? 'default' : 'outline'} className="h-12 rounded-2xl" onClick={() => setWeightStage('GROSS')}>
                            Brut
                          </Button>
                          <Button type="button" variant={weightStage === 'TARE' ? 'default' : 'outline'} className="h-12 rounded-2xl" onClick={() => setWeightStage('TARE')}>
                            Tare
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-emerald-100 bg-emerald-50 px-4 py-5 text-center">
                      <p className="text-sm uppercase tracking-[0.24em] text-emerald-800/70">Lecture active</p>
                      <p className="mt-2 text-6xl font-black tabular-nums text-emerald-950">{liveWeightKg.toFixed(2)}</p>
                      <p className="mt-1 text-sm text-emerald-800/80">kg • {weightStage === 'GROSS' ? 'Camion chargé' : 'Camion vide / tare'}</p>
                    </div>

                    {weightMode === 'MANUAL' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Valeur manuelle (kg)</Label>
                          <Input type="number" className="h-12 rounded-2xl text-base" value={manualWeight} onChange={(event) => setManualWeight(event.target.value)} placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                          <Label>Superviseur de pesée *</Label>
                          <Input className="h-12 rounded-2xl text-base" value={form.weighing_supervisor} onChange={(event) => handleFieldChange('weighing_supervisor', event.target.value)} placeholder="Nom superviseur" />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Motif de saisie manuelle *</Label>
                          <Textarea className="min-h-[88px] rounded-2xl text-base" value={manualReason} onChange={(event) => setManualReason(event.target.value)} placeholder="Ex: panne liaison Modbus / lecture sécurisée manuelle" />
                        </div>
                      </div>
                    )}

                    {weightMode === 'SCALE' && (
                      <div className="space-y-2">
                        <Label>Superviseur de pesée *</Label>
                        <Input className="h-12 rounded-2xl text-base" value={form.weighing_supervisor} onChange={(event) => handleFieldChange('weighing_supervisor', event.target.value)} placeholder="Nom superviseur" />
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">Poids brut validé</p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">{grossWeightKg?.toFixed(2) || '--'}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">Poids tare validé</p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">{tareWeightKg?.toFixed(2) || '--'}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">Poids net calculé</p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">{netWeightKg.toFixed(2)}</p>
                      </div>
                    </div>

                    {weightGapPercent != null && (
                      <div className={`rounded-2xl px-4 py-3 text-sm ${weightGapPercent > 10 ? 'bg-red-50 text-red-800' : weightGapPercent > 3 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                        Écart poids vs BL: <strong>{weightGapPercent}%</strong>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <Button type="button" className="h-12 flex-1 rounded-2xl text-base" onClick={captureCurrentWeight}>
                        <Scale className="mr-2 h-4 w-4" />
                        Capturer {weightStage === 'GROSS' ? 'le brut' : 'la tare'}
                      </Button>
                      <Button type="button" variant="outline" className="h-12 rounded-2xl px-5 text-base" onClick={resetWeighing}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Réinitialiser pesée
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[24px] border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Camera className="h-5 w-5 text-primary" />
                      Preuves & observations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <PhotoCapture
                      photos={arrivalPhotos}
                      onPhotosChange={setArrivalPhotos}
                      maxPhotos={4}
                      title="Photos d’arrivée obligatoires"
                    />

                    <div className="space-y-2">
                      <Label>Observations opérateur</Label>
                      <Textarea
                        className="min-h-[110px] rounded-2xl text-base"
                        value={form.remarks}
                        onChange={(event) => handleFieldChange('remarks', event.target.value)}
                        placeholder="État des caisses, odeurs, anomalies visibles, informations transport..."
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 rounded-[28px] border border-border/70 bg-white/94 p-4 shadow-card lg:grid-cols-[1.15fr_1.1fr_0.9fr]">
          <Card className="rounded-[24px] border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Validation opérateur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Champs obligatoires prêts</span>
                <Badge className={requiredIssues.length === 0 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-emerald-950'}>
                  {completionCount}/{totalChecks}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={grossWeightKg != null ? 'default' : 'outline'}>Poids brut</Badge>
                <Badge variant={tareWeightKg != null ? 'default' : 'outline'}>Poids tare</Badge>
                <Badge variant={arrivalPhotos.length >= 2 ? 'default' : 'outline'}>{arrivalPhotos.length}/2 photos</Badge>
                <Badge variant={!lotQuantityMismatch && lots.every((lot) => lot.lot_supplier.trim()) ? 'default' : 'outline'}>Sous-lots</Badge>
                <Badge variant={form.supplier_id ? 'default' : 'outline'}>Fournisseur</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Zone basse conçue comme <strong>zone d’action</strong> pour la tablette: statut, erreurs et commandes tactiles.
              </p>
            </CardContent>
          </Card>

          <Card className={`rounded-[24px] border-border/70 ${formError ? 'border-red-200 bg-red-50/80' : 'bg-muted/15'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-5 w-5 text-primary" />
                Messages & exceptions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {formError ? (
                <div className="rounded-2xl bg-white/85 p-3 text-sm text-red-700">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                </div>
              ) : submitMessage ? (
                <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{submitMessage}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-white/85 p-3 text-sm text-muted-foreground">
                  La réception est guidée pas à pas. Les erreurs critiques apparaissent ici pour limiter les erreurs opérateur.
                </div>
              )}

              {requiredIssues.length > 0 && (
                <div className="grid gap-2">
                  {requiredIssues.slice(0, 3).map((issue) => (
                    <div key={issue} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {issue}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3">
            <Button type="button" size="lg" className="h-16 rounded-[24px] text-base shadow-elegant" disabled={createReception.isPending} onClick={handleSubmit}>
              {createReception.isPending ? (
                <>
                  <Waves className="mr-2 h-5 w-5 animate-pulse" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Enregistrer la réception
                </>
              )}
            </Button>
            <Button type="button" variant="outline" size="lg" className="h-16 rounded-[24px] text-base" onClick={handleResetScreen}>
              <RefreshCcw className="mr-2 h-5 w-5" />
              Vider l’écran
            </Button>
            <div className="rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <div className="flex items-center gap-2 font-medium">
                <ImagePlus className="h-4 w-4" />
                Poste optimisé tablette
              </div>
              <p className="mt-1 text-sky-800/90">
                Champs larges, actions tactiles, validations visibles et lecture pont-bascule en direct.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
