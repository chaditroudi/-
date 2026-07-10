import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  MapPin,
  Package,
  Scale,
  ShieldCheck,
  Truck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useCreateReceptionIntake } from '@/hooks/useReceptionIntake';
import { usePurchaseOrders } from '@/hooks/usePurchasing';
import { useReceptionsV2 } from '@/hooks/useReceptionsV2';
import { useModule3StorageZones } from '@/hooks/useStorageModule3';
import {
  buildRoyalPalmLotPreview,
  computeReceptionDraftSignals,
  computeReceptionTimelineMetrics,
  hasValidBioCertification,
  ROYAL_PALM_HARVEST_METHODS,
  ROYAL_PALM_MATURITY_STAGES,
  ROYAL_PALM_PRESENTATIONS,
  ROYAL_PALM_RECEPTION_STEPS,
  ROYAL_PALM_TRANSPORT_CONDITIONS,
  ROYAL_PALM_VARIETIES,
  ROYAL_PALM_VISUAL_STATES,
} from '@/lib/royalPalmPhase1';
import { getReceptionIntakeZones, suggestReceptionStorageZone } from '@/lib/receptionStorageZones';
import {
  countSameVehicleToday,
  getRGR03WeightGapAlert,
  getReceptionWizardStepBlockers,
  getSupplierOptionValue,
  resolveReceptionSupplier,
} from '@/lib/receptionWizardValidation';
import { Supplier, Material } from '@/types/mes';
import { getPurchaseOrderLineRemainingQuantity, isPurchaseOrderReceivable } from '@/types/purchasing';
import { ReceptionType, ReceptionV2 } from '@/types/reception';

import { PhotoCapture } from './PhotoCapture';
import { SessionLedger } from './SessionLedger';

interface ReceptionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
  materials: Material[];
  prefillPurchaseOrderId?: string;
}

interface LotDraft {
  lot_supplier: string;
  quantity: number;
  variety: string;
  origin_country: string;
  origin_region: string;
  origin_farm: string;
  harvest_date: string;
  rfid_tag: string;
}

const toDateTimeLocal = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const todayDate = () => toDateTimeLocal().slice(0, 10);

const parseNumeric = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const createLotDraft = (supplier?: Supplier | null, variety = 'Deglet Nour'): LotDraft => ({
  lot_supplier: '',
  quantity: 0,
  variety,
  origin_country: 'Tunisie',
  origin_region: supplier?.region || '',
  origin_farm: supplier?.oasis_name || '',
  harvest_date: todayDate(),
  rfid_tag: '',
});

export const ReceptionWizard = (props: ReceptionWizardProps) => {
  const { open, onOpenChange, suppliers, prefillPurchaseOrderId } = props;
  const { profile, user } = useAuth();
  const operatorLabel = profile?.full_name || user?.email || 'Operateur reception';
  const { data: receptions = [] } = useReceptionsV2();
  const { data: storageZones = [] } = useModule3StorageZones();
  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const createReceptionIntake = useCreateReceptionIntake();
  const receptionStorageZones = useMemo(() => getReceptionIntakeZones(storageZones), [storageZones]);

  const [viewMode, setViewMode] = useState<'form' | 'ledger'>('form');
  const [step, setStep] = useState(1);
  const [submitResult, setSubmitResult] = useState<{ receptionNumber: string; lotCount: number; zone: string } | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [purchaseOrderLineId, setPurchaseOrderLineId] = useState('');

  useEffect(() => {
    if (open && prefillPurchaseOrderId) {
      setPurchaseOrderId(prefillPurchaseOrderId);
    }
  }, [open, prefillPurchaseOrderId]);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [gateArrivalAt, setGateArrivalAt] = useState(toDateTimeLocal());
  const [departureTime, setDepartureTime] = useState(new Date().toTimeString().slice(0, 5));
  const [presentation, setPresentation] = useState<'En caisses' | 'En regimes' | 'En vrac' | 'Melange'>('En caisses');
  const [variety, setVariety] = useState('Deglet Nour');
  const [maturityStage, setMaturityStage] = useState<'Khalal' | 'Rutab' | 'Tamar'>('Tamar');
  const [harvestMethod, setHarvestMethod] = useState<'Manuelle traditionnelle' | 'Semi-mecanique' | 'Mecanique'>('Manuelle traditionnelle');
  const [estimatedHarvestDate, setEstimatedHarvestDate] = useState(todayDate());
  const [bioDeclared, setBioDeclared] = useState(false);
  const [originOasis, setOriginOasis] = useState('');
  const [originGps, setOriginGps] = useState('');

  const [grossWeightKg, setGrossWeightKg] = useState('');
  const [tareWeightKg, setTareWeightKg] = useState('');
  const [declaredWeightKg, setDeclaredWeightKg] = useState('');
  const [grossWeightCapturedAt, setGrossWeightCapturedAt] = useState(toDateTimeLocal());
  const [unloadingStartedAt, setUnloadingStartedAt] = useState(toDateTimeLocal());
  const [unloadingCompletedAt, setUnloadingCompletedAt] = useState(toDateTimeLocal());
  const [tareWeightCapturedAt, setTareWeightCapturedAt] = useState(toDateTimeLocal());
  const [unitCount, setUnitCount] = useState('8');
  const [unitType, setUnitType] = useState<'PALETTE' | 'CAISSE' | 'VRAC' | 'PL' | 'GC' | 'PLOX' | 'LAMME'>('PALETTE');
  const [weighingSource, setWeighingSource] = useState<'SCALE' | 'MANUAL' | 'PANNE_BASCULE'>('SCALE');
  const [manualReason, setManualReason] = useState('');

  const [arrivalTemperatureC, setArrivalTemperatureC] = useState('24');
  const [transportCondition, setTransportCondition] = useState<'Bache' | 'Non bache' | 'Refrigere'>('Bache');
  const [quickVisualState, setQuickVisualState] = useState<'Bon' | 'Moyen' | 'Mauvais'>('Bon');
  const [quickCheckNotes, setQuickCheckNotes] = useState('');
  const [arrivalPhotos, setArrivalPhotos] = useState<string[]>([]);

  const [storageZoneCode, setStorageZoneCode] = useState('');
  const [zoneLocked, setZoneLocked] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [receptionType] = useState<ReceptionType>('DATTE');
  const [lots, setLots] = useState<LotDraft[]>([createLotDraft(null)]);

  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.is_active && (supplier.supplier_status || 'pending_approval') === 'active'),
    [suppliers],
  );
  const selectedSupplier = useMemo(
    () => resolveReceptionSupplier(activeSuppliers, supplierId),
    [activeSuppliers, supplierId],
  );
  const receivablePurchaseOrders = useMemo(
    () => purchaseOrders.filter((order) => isPurchaseOrderReceivable(order.status)),
    [purchaseOrders],
  );
  const selectedPurchaseOrder = useMemo(
    () => receivablePurchaseOrders.find((order) => order.id === purchaseOrderId) || null,
    [purchaseOrderId, receivablePurchaseOrders],
  );
  const supplierScopedOrders = useMemo(() => {
    if (!selectedSupplier) return receivablePurchaseOrders;
    return receivablePurchaseOrders.filter((order) => order.supplier_id === selectedSupplier.id);
  }, [receivablePurchaseOrders, selectedSupplier]);
  const receivableOrderLines = useMemo(() => {
    if (!selectedPurchaseOrder) return [];

    return (selectedPurchaseOrder.lines || []).filter((line) => getPurchaseOrderLineRemainingQuantity(line) > 0.0001);
  }, [selectedPurchaseOrder]);
  const selectedPurchaseOrderLine = useMemo(
    () => receivableOrderLines.find((line) => line.id === purchaseOrderLineId) || null,
    [purchaseOrderLineId, receivableOrderLines],
  );

  useEffect(() => {
    if (!selectedSupplier) return;
    setOriginOasis((current) => current || selectedSupplier.oasis_name || '');
    setOriginGps((current) => current || selectedSupplier.gps_coordinates || '');
    setLots((currentLots) => currentLots.map((lot) => ({
      ...lot,
      origin_region: lot.origin_region || selectedSupplier.region || '',
      origin_farm: lot.origin_farm || selectedSupplier.oasis_name || '',
      variety: lot.variety || variety,
    })));
  }, [selectedSupplier, variety]);

  useEffect(() => {
    if (!selectedPurchaseOrder) {
      if (purchaseOrderLineId) setPurchaseOrderLineId('');
      return;
    }

    if (selectedPurchaseOrder.supplier_id && supplierId !== selectedPurchaseOrder.supplier_id) {
      setSupplierId(selectedPurchaseOrder.supplier_id);
    }

    const openLineIds = receivableOrderLines.map((line) => line.id);
    if (openLineIds.length === 1) {
      if (purchaseOrderLineId !== openLineIds[0]) {
        setPurchaseOrderLineId(openLineIds[0]);
      }
      return;
    }

    if (purchaseOrderLineId && !openLineIds.includes(purchaseOrderLineId)) {
      setPurchaseOrderLineId('');
    }
  }, [purchaseOrderLineId, receivableOrderLines, selectedPurchaseOrder, supplierId]);

  const unitCountValue = Math.max(1, parseInt(unitCount || '1', 10));
  const grossWeightValue = parseNumeric(grossWeightKg);
  const tareWeightValue = parseNumeric(tareWeightKg);
  const declaredWeightValue = parseNumeric(declaredWeightKg);
  const netWeightKg = Math.max(0, Number((grossWeightValue - tareWeightValue).toFixed(2)));
  const totalLotQuantity = Number(lots.reduce((sum, lot) => sum + Number(lot.quantity || 0), 0).toFixed(2));
  const lotMismatch = Math.abs(totalLotQuantity - netWeightKg) > 0.1;

  const phaseSignals = useMemo(
    () =>
      computeReceptionDraftSignals({
        netWeightKg,
        declaredWeightKg: declaredWeightValue || null,
        arrivalTemperatureC: parseNumeric(arrivalTemperatureC),
        departureTime,
        actualArrivalDate: new Date(gateArrivalAt).toISOString(),
        bioDeclared,
        supplier: selectedSupplier,
      }),
    [arrivalTemperatureC, bioDeclared, declaredWeightValue, departureTime, gateArrivalAt, netWeightKg, selectedSupplier],
  );

  const timelineMetrics = useMemo(
    () =>
      computeReceptionTimelineMetrics({
        gateArrivalAt: new Date(gateArrivalAt).toISOString(),
        grossWeightCapturedAt: new Date(grossWeightCapturedAt).toISOString(),
        unloadingStartedAt: new Date(unloadingStartedAt).toISOString(),
        unloadingCompletedAt: new Date(unloadingCompletedAt).toISOString(),
        tareWeightCapturedAt: new Date(tareWeightCapturedAt).toISOString(),
        validatedAt: new Date().toISOString(),
      }),
    [gateArrivalAt, grossWeightCapturedAt, tareWeightCapturedAt, unloadingCompletedAt, unloadingStartedAt],
  );

  const suggestedZone = useMemo(
    () =>
      suggestReceptionStorageZone({
        zones: receptionStorageZones,
        arrivalTemperatureC: parseNumeric(arrivalTemperatureC),
        activeReceptions: receptions,
        requestedZone: zoneLocked ? storageZoneCode : null,
      }),
    [arrivalTemperatureC, receptionStorageZones, receptions, storageZoneCode, zoneLocked],
  );

  useEffect(() => {
    if (!zoneLocked) {
      setStorageZoneCode(suggestedZone);
    }
  }, [suggestedZone, zoneLocked]);

  // Auto-fill single lot quantity from net weight when reaching step 4
  useEffect(() => {
    if (step !== 4 || netWeightKg <= 0) return;
    setLots((current) => {
      if (current.length !== 1 || current[0].quantity !== 0) return current;
      return [{ ...current[0], quantity: netWeightKg }];
    });
  }, [step, netWeightKg]);

  const lotIdPreview = useMemo(
    () =>
      buildRoyalPalmLotPreview({
        supplierCode: selectedSupplier?.code,
        region: selectedSupplier?.region,
        date: gateArrivalAt,
      }),
    [gateArrivalAt, selectedSupplier?.code, selectedSupplier?.region],
  );

  // RG-R03 — weight gap at 5% threshold (spec §2.3)
  const rgrR03Alert = useMemo(
    () => getRGR03WeightGapAlert(netWeightKg, declaredWeightValue || null),
    [netWeightKg, declaredWeightValue],
  );

  const derivedAlerts = useMemo(() => {
    const alerts: string[] = [];
    if (rgrR03Alert.level === 'warning' && rgrR03Alert.gapPercent !== null) {
      alerts.push(`RG-R03 — Ecart poids > 5% (${rgrR03Alert.gapPercent}%) — signalement obligatoire`);
    }
    if (rgrR03Alert.level === 'critical' && rgrR03Alert.gapPercent !== null) {
      alerts.push(`RG-R03 — Ecart poids > 10% (${rgrR03Alert.gapPercent}%) — blocage recommande`);
    }
    if (phaseSignals.temperatureAlert === 'critical') {
      alerts.push("Temperature arrivee > 35C");
    }
    if (bioDeclared && !hasValidBioCertification(selectedSupplier)) {
      alerts.push('Bio declare sans certification valide');
    }
    if (timelineMetrics.delayedOver60Minutes) {
      alerts.push('Delai reception > 60 minutes');
    }
    if (weighingSource === 'PANNE_BASCULE') {
      alerts.push('RG-R08 — Poids saisi en mode panne bascule — validation direction requise');
    }
    return alerts;
  }, [bioDeclared, phaseSignals.temperatureAlert, rgrR03Alert, selectedSupplier, timelineMetrics.delayedOver60Minutes, weighingSource]);

  const steps = [
    { id: 1, label: 'Arrivee camion', icon: Truck },
    { id: 2, label: 'Pesee & dechargement', icon: Scale },
    { id: 3, label: 'Produit & controle', icon: ShieldCheck },
    { id: 4, label: 'LOT-ID & stockage', icon: MapPin },
    { id: 5, label: 'Validation', icon: Check },
  ];

  const resetForm = () => {
    setViewMode('form');
    setStep(1);
    setSubmitResult(null);
    setSupplierId('');
    setPurchaseOrderId('');
    setPurchaseOrderLineId('');
    setDeliveryNoteNumber('');
    setVehicleNumber('');
    setDriverName('');
    setGateArrivalAt(toDateTimeLocal());
    setDepartureTime(new Date().toTimeString().slice(0, 5));
    setPresentation('En caisses');
    setVariety('Deglet Nour');
    setMaturityStage('Tamar');
    setHarvestMethod('Manuelle traditionnelle');
    setEstimatedHarvestDate(todayDate());
    setBioDeclared(false);
    setOriginOasis('');
    setOriginGps('');
    setGrossWeightKg('');
    setTareWeightKg('');
    setDeclaredWeightKg('');
    setGrossWeightCapturedAt(toDateTimeLocal());
    setUnloadingStartedAt(toDateTimeLocal());
    setUnloadingCompletedAt(toDateTimeLocal());
    setTareWeightCapturedAt(toDateTimeLocal());
    setUnitCount('8');
    setUnitType('PALETTE');
    setWeighingSource('SCALE');
    setManualReason('');
    setArrivalTemperatureC('24');
    setTransportCondition('Bache');
    setQuickVisualState('Bon');
    setQuickCheckNotes('');
    setArrivalPhotos([]);
    setStorageZoneCode('');
    setZoneLocked(false);
    setRemarks('');
    setLots([createLotDraft(null)]);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const addLot = () => {
    setLots((current) => [...current, createLotDraft(selectedSupplier, variety)]);
  };

  const updateLot = (index: number, patch: Partial<LotDraft>) => {
    setLots((current) => current.map((lot, lotIndex) => (lotIndex === index ? { ...lot, ...patch } : lot)));
  };

  const removeLot = (index: number) => {
    setLots((current) => (current.length === 1 ? current : current.filter((_, lotIndex) => lotIndex !== index)));
  };

  const autoBalanceLots = () => {
    setLots((currentLots) => {
      if (currentLots.length === 0) return currentLots;
      if (currentLots.length === 1) {
        return [{ ...currentLots[0], quantity: netWeightKg }];
      }

      const assignedBeforeLast = currentLots
        .slice(0, -1)
        .reduce((sum, lot) => sum + Number(lot.quantity || 0), 0);
      const remainder = Math.max(0, Number((netWeightKg - assignedBeforeLast).toFixed(2)));
      return currentLots.map((lot, index) => (
        index === currentLots.length - 1 ? { ...lot, quantity: remainder } : lot
      ));
    });
  };

  // RG-R05 — bio declared without valid certification (hard blocker in step 3)
  const bioDeclaredWithoutCert = bioDeclared && !hasValidBioCertification(selectedSupplier);

  const getStepBlockers = () => {
    return getReceptionWizardStepBlockers({
      step,
      selectedSupplier,
      deliveryNoteNumber,
      vehicleNumber,
      gateArrivalAt,
      grossWeightValue,
      tareWeightValue,
      netWeightKg,
      unitCountValue,
      weighingSource,
      manualReason,
      arrivalPhotos,
      variety,
      maturityStage,
      harvestMethod,
      arrivalTemperatureC,
      storageZoneCode,
      lots,
      lotMismatch,
      bioDeclaredWithoutCert,
    });
  };

  const purchaseOrderBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (step !== 1) return blockers;

    if (purchaseOrderId && !selectedPurchaseOrder) {
      blockers.push('sélectionner un bon de commande valide');
    }

    if (selectedPurchaseOrder && receivableOrderLines.length === 0) {
      blockers.push('choisir un bon de commande avec une ligne encore ouverte');
    }

    if (selectedPurchaseOrder && receivableOrderLines.length > 1 && !purchaseOrderLineId) {
      blockers.push('sélectionner la ligne du bon de commande');
    }

    return blockers;
  }, [purchaseOrderId, purchaseOrderLineId, receivableOrderLines.length, selectedPurchaseOrder, step]);

  const stepBlockers = [...getStepBlockers(), ...purchaseOrderBlockers];
  const canProceed = () => {
    return stepBlockers.length === 0;
  };

  const handleSubmit = async () => {
    const intake = await createReceptionIntake.mutateAsync({
      supplier_id: selectedPurchaseOrder?.supplier_id || selectedSupplier?.id || selectedSupplier?.code || supplierId,
      purchase_order_id: selectedPurchaseOrder?.id || purchaseOrderId || null,
      purchase_order_line_id: selectedPurchaseOrderLine?.id || null,
      spontaneous_delivery: !(selectedPurchaseOrder?.id || purchaseOrderId),
      reception_type: receptionType,
      material_id: selectedPurchaseOrderLine?.material_id || null,
      unit: 'kg',
      packaging_type: unitType,
      presentation,
      delivery_note_number: deliveryNoteNumber.trim(),
      delivery_note_photos: arrivalPhotos,
      vehicle_number: vehicleNumber.trim(),
      driver_name: driverName.trim() || null,
      remarks: remarks.trim() || null,
      gross_weight_kg: grossWeightValue,
      tare_weight_kg: tareWeightValue,
      declared_weight_kg: declaredWeightValue || null,
      variety,
      maturity_stage: maturityStage,
      harvest_method: harvestMethod,
      harvest_datetime: `${estimatedHarvestDate}T06:00:00.000Z`,
      estimated_harvest_date: estimatedHarvestDate,
      bio_declared: bioDeclared,
      arrival_temperature_c: parseNumeric(arrivalTemperatureC),
      departure_time: departureTime,
      transport_condition: transportCondition,
      quick_visual_state: quickVisualState,
      quick_check_notes: quickCheckNotes.trim() || null,
      storage_zone_code: storageZoneCode,
      transport_duration_hours: phaseSignals.transportDurationHours,
      origin_oasis: originOasis || null,
      origin_gps: originGps || null,
      gate_arrival_at: new Date(gateArrivalAt).toISOString(),
      gross_weight_captured_at: new Date(grossWeightCapturedAt).toISOString(),
      unloading_started_at: new Date(unloadingStartedAt).toISOString(),
      unloading_completed_at: new Date(unloadingCompletedAt).toISOString(),
      tare_weight_captured_at: new Date(tareWeightCapturedAt).toISOString(),
      phase1_alerts: derivedAlerts,
      unit_count: unitCountValue,
      unit_type: unitType,
      weighing_source: weighingSource === 'PANNE_BASCULE' ? 'MANUAL' : weighingSource,
      weighing_supervisor: operatorLabel,
      weighing_manual_reason: weighingSource !== 'SCALE' ? manualReason.trim() : null,
      created_by: user?.id || null,
      lots: lots.map((lot) => ({
        lot_supplier: lot.lot_supplier.trim(),
        quantity: Number(lot.quantity || 0),
        origin_country: lot.origin_country || 'Tunisie',
        origin_region: lot.origin_region || selectedSupplier?.region || '',
        origin_farm: lot.origin_farm || selectedSupplier?.oasis_name || '',
        harvest_date: lot.harvest_date || estimatedHarvestDate,
        maturity_stage: maturityStage,
        variety: lot.variety || variety,
        rfid_tag: lot.rfid_tag.trim() || null,
      })),
    });

    setSubmitResult({
      receptionNumber: intake.reception.reception_number,
      lotCount: intake.lots.length,
      zone: intake.reception.storage_zone_code || storageZoneCode,
    });
    setStep(6);
  };

  const todayReceptions = useMemo(() => {
    const today = new Date().toDateString();
    return receptions.filter((reception) => new Date(reception.created_at).toDateString() === today);
  }, [receptions]);

  // RG-R09 — same vehicle same day (warning, not blocker)
  const sameVehicleTodayCount = useMemo(
    () => countSameVehicleToday(vehicleNumber, todayReceptions),
    [vehicleNumber, todayReceptions],
  );

  const handleViewReception = (reception: ReceptionV2) => {
    console.log('View reception', reception);
  };

  const handlePrintReception = (reception: ReceptionV2) => {
    console.log('Print reception', reception);
    window.print();
  };

  const handleDeleteReception = (id: string) => {
    console.log('Delete reception', id);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[96vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">

        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold leading-none tracking-tight">Réception Royal Palm</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Saisie guidée · {steps.length} étapes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {viewMode === 'form' && step < 6 && (
              <span className="hidden text-xs font-medium text-muted-foreground sm:block">
                Étape {step} / {steps.length}
              </span>
            )}
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              <Button size="sm" variant={viewMode === 'form' ? 'default' : 'ghost'} onClick={() => setViewMode('form')}>
                <Package className="mr-1.5 h-3.5 w-3.5" />Saisie
              </Button>
              <Button size="sm" variant={viewMode === 'ledger' ? 'default' : 'ghost'} onClick={() => setViewMode('ledger')}>
                <List className="mr-1.5 h-3.5 w-3.5" />Registre
              </Button>
            </div>
          </div>
        </div>

        {/* ── Connected Stepper ── */}
        {viewMode === 'form' && step < 6 && (
          <div className="shrink-0 border-b bg-muted/25 px-6 pb-4 pt-5">
            <div className="flex items-start">
              {steps.map((entry, index) => {
                const isCompleted = step > entry.id;
                const isActive = step === entry.id;
                const Icon = entry.icon;
                return (
                  <div
                    key={entry.id}
                    className={`flex flex-1 flex-col items-center ${isCompleted ? 'cursor-pointer' : ''}`}
                    onClick={() => isCompleted && setStep(entry.id)}
                    title={isCompleted ? `Retour à l'étape ${entry.id} : ${entry.label}` : undefined}
                  >
                    <div className="flex w-full items-center">
                      {/* Left connector line */}
                      <div className={`h-0.5 flex-1 transition-all duration-500 ${index === 0 ? 'invisible' : isCompleted || isActive ? 'bg-primary' : 'bg-border'}`} />
                      {/* Step node — completed steps are clickable to jump back */}
                      <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                        isCompleted
                          ? 'border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-200/80 hover:bg-emerald-600'
                          : isActive
                            ? 'scale-110 border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                            : 'border-border bg-card text-muted-foreground/60'
                      }`}>
                        {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-4.5 w-4.5" />}
                        {isActive && (
                          <span className="absolute -inset-1.5 animate-ping rounded-full bg-primary/15" />
                        )}
                      </div>
                      {/* Right connector line */}
                      <div className={`h-0.5 flex-1 transition-all duration-500 ${index === steps.length - 1 ? 'invisible' : isCompleted ? 'bg-primary' : 'bg-border'}`} />
                    </div>
                    {/* Step label */}
                    <span className={`mt-2.5 max-w-[80px] text-center text-[10px] font-semibold leading-tight tracking-wide transition-colors duration-200 ${
                      isActive ? 'text-primary' : isCompleted ? 'text-emerald-600 underline-offset-2 hover:underline' : 'text-muted-foreground/50'
                    }`}>
                      {entry.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Step context pill */}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-primary/10 bg-primary/5 px-4 py-2.5 text-xs">
              <Badge variant="outline" className="border-primary/25 bg-primary/5 px-2 py-0 text-[10px] font-semibold text-primary">
                Royal Palm
              </Badge>
              <span className="font-medium text-foreground">{ROYAL_PALM_RECEPTION_STEPS[step - 1]?.label}</span>
              <Separator orientation="vertical" className="hidden h-3 sm:block" />
              <span className="text-muted-foreground">Resp : {ROYAL_PALM_RECEPTION_STEPS[step - 1]?.owner}</span>
              <Separator orientation="vertical" className="hidden h-3 sm:block" />
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock3 className="h-3 w-3" />
                Cible : {ROYAL_PALM_RECEPTION_STEPS[step - 1]?.targetMinutes} min
              </span>
            </div>
          </div>
        )}

        {/* ── Scrollable step content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {viewMode === 'ledger' ? (
            <SessionLedger
              receptions={todayReceptions}
              onView={handleViewReception}
              onPrint={handlePrintReception}
              onDelete={handleDeleteReception}
            />
          ) : (
            /* key causes remount on step change → entrance animation plays */
            <div key={step} className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300">

              {/* ── Step 1: Arrivée camion ── */}
              {step === 1 && (
                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <Card className="shadow-sm">
                    <CardHeader className="border-b bg-muted/20 pb-4">
                      <CardTitle className="flex items-center gap-2.5 text-base">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                          <Truck className="h-4 w-4 text-primary" />
                        </div>
                        Arrivée camion, fournisseur et origine
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fournisseur actif *</Label>
                        <Select
                          value={supplierId}
                          onValueChange={(value) => {
                            setSupplierId(value);
                            if (selectedPurchaseOrder && selectedPurchaseOrder.supplier_id !== value) {
                              setPurchaseOrderId('');
                              setPurchaseOrderLineId('');
                            }
                          }}
                        >
                          <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue placeholder="Sélectionner un fournisseur actif" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeSuppliers.map((supplier) => (
                              <SelectItem key={getSupplierOptionValue(supplier)} value={getSupplierOptionValue(supplier)}>
                                {supplier.code} · {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">N° bon de livraison *</Label>
                        <Input className="h-10 rounded-xl" value={deliveryNoteNumber} onChange={(e) => setDeliveryNoteNumber(e.target.value)} placeholder="BL-2026-001" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bon de commande lié</Label>
                        <Select
                          value={purchaseOrderId || 'none'}
                          onValueChange={(value) => {
                            if (value === 'none') {
                              setPurchaseOrderId('');
                              setPurchaseOrderLineId('');
                              return;
                            }

                            setPurchaseOrderId(value);
                          }}
                        >
                          <SelectTrigger className="h-10 rounded-xl">
                            <SelectValue placeholder="Livraison spontanée / sans BC" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Livraison spontanée / sans BC</SelectItem>
                            {supplierScopedOrders.map((order) => (
                              <SelectItem key={order.id} value={order.id}>
                                {order.order_number} · {order.supplier?.code || order.supplier?.name || order.supplier_id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedPurchaseOrder && (
                        <div className="space-y-1.5 md:col-span-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ligne du bon de commande</Label>
                          <Select
                            value={purchaseOrderLineId || 'none'}
                            onValueChange={(value) => setPurchaseOrderLineId(value === 'none' ? '' : value)}
                          >
                            <SelectTrigger className="h-10 rounded-xl">
                              <SelectValue placeholder="Sélectionner la ligne reçue" />
                            </SelectTrigger>
                            <SelectContent>
                              {receivableOrderLines.length > 0 ? (
                                receivableOrderLines.map((line) => (
                                  <SelectItem key={line.id} value={line.id}>
                                    L{line.line_number || 1} · {line.description} · reste {getPurchaseOrderLineRemainingQuantity(line).toFixed(2)} {line.unit}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>
                                  Aucune ligne ouverte sur ce BC
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {selectedPurchaseOrder.order_number} · statut {selectedPurchaseOrder.status}
                            {selectedPurchaseOrderLine
                              ? ` · ligne ${selectedPurchaseOrderLine.line_number || 1} · matière ${selectedPurchaseOrderLine.material?.code || selectedPurchaseOrderLine.material_id || '—'}`
                              : ''}
                          </p>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Immatriculation véhicule *</Label>
                        <Input className="h-10 rounded-xl" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="TU-4521-A" />
                        {sameVehicleTodayCount > 0 && (
                          <p className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            RG-R09 — Ce véhicule a déjà livré {sameVehicleTodayCount} fois aujourd'hui.
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nom chauffeur</Label>
                        <Input className="h-10 rounded-xl" value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Nom chauffeur" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Heure arrivée portail *</Label>
                        <div className="flex gap-1.5">
                          <Input className="h-10 flex-1 rounded-xl" type="datetime-local" value={gateArrivalAt} onChange={(e) => setGateArrivalAt(e.target.value)} />
                          <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 rounded-xl px-2.5 text-[11px]" title="Maintenant" onClick={() => setGateArrivalAt(toDateTimeLocal())}>
                            <Clock3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Heure départ déclarée</Label>
                        <Input className="h-10 rounded-xl" type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Oasis d'origine</Label>
                        <Input className="h-10 rounded-xl" value={originOasis} onChange={(e) => setOriginOasis(e.target.value)} placeholder="Oasis" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">GPS oasis</Label>
                        <Input className="h-10 rounded-xl" value={originGps} onChange={(e) => setOriginGps(e.target.value)} placeholder="Lat,Lng" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="border-b bg-muted/20 pb-4">
                      <CardTitle className="flex items-center gap-2.5 text-base">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        </div>
                        Traçabilité fournisseur
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-5 text-sm">
                      <div className="rounded-2xl border bg-card p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Code fournisseur</p>
                        <p className="mt-1.5 font-mono text-xl font-bold">{selectedSupplier?.code || '—'}</p>
                      </div>
                      <div className="rounded-2xl border bg-card p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview LOT-ID</p>
                        <p className="mt-1.5 break-all font-mono text-sm font-medium text-primary">{lotIdPreview}</p>
                      </div>
                      {selectedPurchaseOrder && (
                        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contexte achat</p>
                          <p className="mt-1.5 font-semibold text-foreground">{selectedPurchaseOrder.order_number}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {selectedPurchaseOrder.line_count || selectedPurchaseOrder.lines?.length || 0} ligne(s) · réception(s) {selectedPurchaseOrder.goods_receipt_count || 0}
                          </p>
                        </div>
                      )}
                      <div className={`rounded-2xl border p-4 ${hasValidBioCertification(selectedSupplier) ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-card'}`}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Certification Bio</p>
                        <p className={`mt-1.5 font-semibold ${hasValidBioCertification(selectedSupplier) ? 'text-emerald-700' : 'text-foreground'}`}>
                          {hasValidBioCertification(selectedSupplier) ? '✓ Certification valide' : 'Aucune certification valide'}
                        </p>
                      </div>
                      <div className="rounded-2xl border bg-card p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opérateur</p>
                        <p className="mt-1.5 font-medium">{operatorLabel}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ── Step 2: Pesée ── */}
              {step === 2 && (
                <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
                  <Card className="shadow-sm">
                    <CardHeader className="border-b bg-muted/20 pb-4">
                      <CardTitle className="flex items-center gap-2.5 text-base">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                          <Scale className="h-4 w-4 text-primary" />
                        </div>
                        Pesée brut, déchargement et tare
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mode de capture</Label>
                        <Select value={weighingSource} onValueChange={(v) => setWeighingSource(v as typeof weighingSource)}>
                          <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SCALE">Pont-bascule / Modbus</SelectItem>
                            <SelectItem value="MANUAL">Saisie manuelle</SelectItem>
                            <SelectItem value="PANNE_BASCULE">⚠ Panne bascule — RG-R08</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Présentation</Label>
                        <Select value={presentation} onValueChange={(v) => setPresentation(v as typeof presentation)}>
                          <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROYAL_PALM_PRESENTATIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Poids brut (kg) *</Label>
                        <Input className="h-10 rounded-xl" type="number" value={grossWeightKg} onChange={(e) => setGrossWeightKg(e.target.value)} placeholder="0" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Poids tare (kg) *</Label>
                        <Input className="h-10 rounded-xl" type="number" value={tareWeightKg} onChange={(e) => setTareWeightKg(e.target.value)} placeholder="0" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Poids annoncé BL (kg)</Label>
                        <Input className="h-10 rounded-xl" type="number" value={declaredWeightKg} onChange={(e) => setDeclaredWeightKg(e.target.value)} placeholder="0" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre palettes / unités *</Label>
                        <Input className="h-10 rounded-xl" type="number" value={unitCount} onChange={(e) => setUnitCount(e.target.value)} />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type unité logistique *</Label>
                        <Select value={unitType} onValueChange={(v) => setUnitType(v as typeof unitType)}>
                          <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(['PALETTE', 'CAISSE', 'VRAC', 'PL', 'GC', 'PLOX', 'LAMME'] as const).map((v) => (
                              <SelectItem key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motif manuel</Label>
                        <Input className="h-10 rounded-xl" value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="Obligatoire si saisie manuelle" />
                      </div>

                      <div className="col-span-2 flex items-center justify-between rounded-xl border border-primary/15 bg-primary/5 px-3 py-2">
                        <p className="text-xs font-semibold text-muted-foreground">Horodatages réception</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-lg border-primary/30 px-2.5 text-[11px] text-primary"
                          onClick={() => {
                            const now = toDateTimeLocal();
                            setGrossWeightCapturedAt(now);
                            setUnloadingStartedAt(now);
                            setUnloadingCompletedAt(now);
                            setTareWeightCapturedAt(now);
                          }}
                        >
                          <Clock3 className="mr-1 h-3 w-3" />
                          Horodater tout maintenant
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Horodatage poids brut</Label>
                        <div className="flex gap-1.5">
                          <Input className="h-10 flex-1 rounded-xl" type="datetime-local" value={grossWeightCapturedAt} onChange={(e) => setGrossWeightCapturedAt(e.target.value)} />
                          <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 rounded-xl px-2.5" title="Maintenant" onClick={() => setGrossWeightCapturedAt(toDateTimeLocal())}>
                            <Clock3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Début déchargement</Label>
                        <div className="flex gap-1.5">
                          <Input className="h-10 flex-1 rounded-xl" type="datetime-local" value={unloadingStartedAt} onChange={(e) => setUnloadingStartedAt(e.target.value)} />
                          <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 rounded-xl px-2.5" title="Maintenant" onClick={() => setUnloadingStartedAt(toDateTimeLocal())}>
                            <Clock3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fin déchargement</Label>
                        <div className="flex gap-1.5">
                          <Input className="h-10 flex-1 rounded-xl" type="datetime-local" value={unloadingCompletedAt} onChange={(e) => setUnloadingCompletedAt(e.target.value)} />
                          <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 rounded-xl px-2.5" title="Maintenant" onClick={() => setUnloadingCompletedAt(toDateTimeLocal())}>
                            <Clock3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Horodatage tare</Label>
                        <div className="flex gap-1.5">
                          <Input className="h-10 flex-1 rounded-xl" type="datetime-local" value={tareWeightCapturedAt} onChange={(e) => setTareWeightCapturedAt(e.target.value)} />
                          <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 rounded-xl px-2.5" title="Maintenant" onClick={() => setTareWeightCapturedAt(toDateTimeLocal())}>
                            <Clock3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="border-b bg-muted/20 pb-4">
                      <CardTitle className="flex items-center gap-2.5 text-base">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
                          <Scale className="h-4 w-4 text-blue-600" />
                        </div>
                        Métrologie réception
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-5">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border bg-gradient-to-br from-card to-muted/30 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Poids net</p>
                          <p className="mt-2 text-2xl font-bold tabular-nums">{netWeightKg.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">kg</p>
                        </div>
                        <div className="rounded-2xl border bg-gradient-to-br from-card to-muted/30 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Moy. / unité</p>
                          <p className="mt-2 text-2xl font-bold tabular-nums">
                            {unitCountValue > 0 ? (netWeightKg / unitCountValue).toFixed(2) : '0.00'}
                          </p>
                          <p className="text-xs text-muted-foreground">kg</p>
                        </div>
                      </div>

                      {/* RG-R03 weight gap alert */}
                      <div className={`rounded-2xl border p-4 text-sm font-medium ${
                        rgrR03Alert.level === 'critical'
                          ? 'border-red-200 bg-red-50 text-red-800'
                          : rgrR03Alert.level === 'warning'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            Écart poids BL
                            {rgrR03Alert.level !== 'none' && (
                              <Badge variant="outline" className="text-[0.6rem] px-1.5 border-current">RG-R03</Badge>
                            )}
                          </span>
                          <span className="text-xl font-bold tabular-nums">
                            {rgrR03Alert.gapPercent ?? 0}%
                          </span>
                        </div>
                        {rgrR03Alert.level === 'warning' && (
                          <p className="mt-1 text-xs">Écart &gt; 5 % — signalement obligatoire en sortie (RG-R03)</p>
                        )}
                        {rgrR03Alert.level === 'critical' && (
                          <p className="mt-1 text-xs">Écart &gt; 10 % — recommandé : status BLOQUE (RG-R03)</p>
                        )}
                      </div>

                      <div className="rounded-2xl border bg-card p-4 text-sm">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chronologie</p>
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Déchargement</span>
                            <span className="font-medium tabular-nums">{timelineMetrics.unloadingDurationMinutes ?? '—'} min</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Brut → validation</span>
                            <span className="font-medium tabular-nums">{timelineMetrics.grossToValidationMinutes ?? '—'} min</span>
                          </div>
                          <div className="flex items-center justify-between border-t pt-2.5">
                            <span className="font-semibold">Total réception</span>
                            <span className="font-bold tabular-nums">{timelineMetrics.totalReceptionMinutes ?? '—'} min</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ── Step 3: Produit & contrôle ── */}
              {step === 3 && (
                <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                  <Card className="shadow-sm">
                    <CardHeader className="border-b bg-muted/20 pb-4">
                      <CardTitle className="flex items-center gap-2.5 text-base">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        </div>
                        Produit, transport et contrôle rapide
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variété *</Label>
                        <Select value={variety} onValueChange={setVariety}>
                          <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROYAL_PALM_VARIETIES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stade maturation *</Label>
                        <Select value={maturityStage} onValueChange={(v) => setMaturityStage(v as typeof maturityStage)}>
                          <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROYAL_PALM_MATURITY_STAGES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Méthode récolte *</Label>
                        <Select value={harvestMethod} onValueChange={(v) => setHarvestMethod(v as typeof harvestMethod)}>
                          <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROYAL_PALM_HARVEST_METHODS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date récolte estimée</Label>
                        <Input className="h-10 rounded-xl" type="date" value={estimatedHarvestDate} onChange={(e) => setEstimatedHarvestDate(e.target.value)} />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Température arrivée (°C) *</Label>
                        <Input className="h-10 rounded-xl" type="number" value={arrivalTemperatureC} onChange={(e) => setArrivalTemperatureC(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conditions transport</Label>
                        <Select value={transportCondition} onValueChange={(v) => setTransportCondition(v as typeof transportCondition)}>
                          <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROYAL_PALM_TRANSPORT_CONDITIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">État visuel général</Label>
                        <Select value={quickVisualState} onValueChange={(v) => setQuickVisualState(v as typeof quickVisualState)}>
                          <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROYAL_PALM_VISUAL_STATES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bio déclaré</Label>
                        <Button
                          type="button"
                          variant={bioDeclared ? 'default' : 'outline'}
                          className="h-10 w-full justify-start rounded-xl"
                          onClick={() => setBioDeclared((c) => !c)}
                        >
                          {bioDeclared ? '✓ Oui, lot bio déclaré' : 'Non bio'}
                        </Button>
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contrôle rapide / observations</Label>
                        <Textarea className="rounded-xl" value={quickCheckNotes} onChange={(e) => setQuickCheckNotes(e.target.value)} placeholder="Caisses, odeurs, temperature IR, anomalies visibles..." rows={4} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="border-b bg-muted/20 pb-4">
                      <CardTitle className="flex items-center gap-2.5 text-base">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
                          <Camera className="h-4 w-4 text-violet-600" />
                        </div>
                        Photos obligatoires
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-5">
                      <PhotoCapture
                        photos={arrivalPhotos}
                        onPhotosChange={setArrivalPhotos}
                        maxPhotos={4}
                        title="Photo 1 vue ensemble · Photo 2 gros plan · Photo 3 anomalie"
                      />

                      <div className={`rounded-2xl border p-4 text-sm font-medium ${
                        phaseSignals.temperatureAlert === 'critical'
                          ? 'border-red-200 bg-red-50 text-red-800'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span>Température réception</span>
                          <span className="text-xl font-bold">{parseNumeric(arrivalTemperatureC)}°C</span>
                        </div>
                        {phaseSignals.temperatureAlert === 'critical' && (
                          <p className="mt-1 text-xs font-normal">⚠ Alerte rouge — température élevée</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ── Step 4: LOT-ID & stockage ── */}
              {step === 4 && (
                <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
                  <Card className="shadow-sm">
                    <CardHeader className="border-b bg-muted/20 pb-4">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2.5 text-base">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          LOT-ID, QR/RFID et palette(s)
                        </CardTitle>
                        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={addLot}>
                          + Sous-lot
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-5">
                      {lots.map((lot, index) => (
                        <div key={`${index}-${lot.lot_supplier}`} className="rounded-2xl border border-dashed bg-muted/20 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sous-lot {index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 rounded-lg text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => removeLot(index)}
                              disabled={lots.length === 1}
                            >
                              Retirer
                            </Button>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Réf. lot fournisseur *</Label>
                              <Input className="h-9 rounded-xl" value={lot.lot_supplier} onChange={(e) => updateLot(index, { lot_supplier: e.target.value })} placeholder={`Lot fournisseur ${index + 1}`} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Quantité (kg) *</Label>
                              <Input className="h-9 rounded-xl" type="number" value={lot.quantity || ''} onChange={(e) => updateLot(index, { quantity: parseNumeric(e.target.value) })} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Oasis / ferme</Label>
                              <Input className="h-9 rounded-xl" value={lot.origin_farm} onChange={(e) => updateLot(index, { origin_farm: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Tag RFID</Label>
                              <Input className="h-9 rounded-xl" value={lot.rfid_tag} onChange={(e) => updateLot(index, { rfid_tag: e.target.value })} placeholder="Optionnel" />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                              <Label className="text-xs text-muted-foreground">Date récolte lot</Label>
                              <Input className="h-9 rounded-xl" type="date" value={lot.harvest_date} onChange={(e) => updateLot(index, { harvest_date: e.target.value })} />
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className={`rounded-2xl border p-4 ${lotMismatch ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wide ${lotMismatch ? 'text-amber-600' : 'text-emerald-600'}`}>Total sous-lots</p>
                            <p className={`mt-1 text-2xl font-bold tabular-nums ${lotMismatch ? 'text-amber-900' : 'text-emerald-900'}`}>{totalLotQuantity.toFixed(2)} kg</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-semibold uppercase tracking-wide ${lotMismatch ? 'text-amber-600' : 'text-emerald-600'}`}>Poids net cible</p>
                            <p className={`mt-1 text-2xl font-bold tabular-nums ${lotMismatch ? 'text-amber-900' : 'text-emerald-900'}`}>{netWeightKg.toFixed(2)} kg</p>
                          </div>
                        </div>
                        {lotMismatch && (
                          <Button type="button" variant="outline" size="sm" className="mt-3 w-full rounded-xl" onClick={autoBalanceLots}>
                            Ajuster automatiquement le reliquat
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardHeader className="border-b bg-muted/20 pb-4">
                      <CardTitle className="flex items-center gap-2.5 text-base">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                          <MapPin className="h-4 w-4 text-amber-600" />
                        </div>
                        Affectation zone & étiquette
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-5">
                      <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">LOT-ID — Format RP-[REG]-[FOURN]-[DATE]-[SEQ]</p>
                          <Badge variant="outline" className="text-[0.6rem] px-1.5 border-primary/30 text-primary">RG-R01</Badge>
                        </div>
                        <p className="break-all font-mono text-base font-bold text-primary tracking-wider">{lotIdPreview}</p>
                        <div className="mt-2 grid grid-cols-4 gap-1 text-[10px] text-muted-foreground">
                          {[
                            ['REG', selectedSupplier?.region ? selectedSupplier.region.slice(0, 3).toUpperCase() : '???'],
                            ['FOURN', selectedSupplier?.code || '????'],
                            ['DATE', gateArrivalAt ? new Date(gateArrivalAt).toLocaleDateString('fr-TN') : '—'],
                            ['SEQ', 'auto (DB)'],
                          ].map(([k, v]) => (
                            <div key={k} className="rounded border bg-white/50 px-1.5 py-1 text-center">
                              <p className="font-semibold text-primary">{k}</p>
                              <p className="truncate">{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zone stockage temporaire *</Label>
                        <Select value={storageZoneCode} onValueChange={(value) => { setStorageZoneCode(value); setZoneLocked(true); }}>
                          <SelectTrigger className="h-10 rounded-xl">
                            <SelectValue placeholder={receptionStorageZones.length > 0 ? 'Sélectionner une zone' : 'Aucune zone active'} />
                          </SelectTrigger>
                          <SelectContent>
                            {receptionStorageZones.map((zone) => (
                              <SelectItem key={zone.id} value={zone.code}>
                                {zone.code} • {zone.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Suggestion système : <span className="font-semibold text-foreground">{suggestedZone}</span>
                        </p>
                        {zoneLocked && suggestedZone && storageZoneCode !== suggestedZone && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto rounded-lg px-0 text-xs text-primary hover:bg-transparent hover:text-primary/80"
                            onClick={() => {
                              setStorageZoneCode(suggestedZone);
                              setZoneLocked(false);
                            }}
                          >
                            Revenir à la suggestion système
                          </Button>
                        )}
                      </div>

                      <div className="rounded-2xl border bg-card p-4 text-sm">
                        <p className="font-semibold">Étiquetage QR/RFID</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          Une étiquette QR par palette avec LOT-ID, variété, poids et date. Les tags RFID seront liés au LOT-ID.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                        <p className="font-semibold text-emerald-900">Notification qualité</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-emerald-700">
                          À la validation, le lot passera en statut <strong>Réceptionné — En attente inspection</strong>.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ── Step 5: Validation finale ── */}
              {step === 5 && (
                <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
                  <Card className="shadow-sm">
                    <CardHeader className="border-b bg-muted/20 pb-4">
                      <CardTitle className="flex items-center gap-2.5 text-base">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                          <Check className="h-4 w-4 text-emerald-600" />
                        </div>
                        Récapitulatif et validation finale
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-5">
                      <div className="grid gap-3 md:grid-cols-2">
                        {[
                          { label: 'Fournisseur', value: selectedSupplier?.name || '—' },
                          { label: 'N° BL', value: deliveryNoteNumber || '—' },
                          { label: 'Poids net officiel', value: `${netWeightKg.toFixed(2)} kg`, large: true },
                          { label: 'Zone réception', value: storageZoneCode || '—' },
                          { label: 'Sous-lots créés', value: String(lots.length) },
                          { label: 'Durée estimée', value: `${timelineMetrics.totalReceptionMinutes ?? '—'} min` },
                        ].map(({ label, value, large }) => (
                          <div key={label} className="rounded-2xl border bg-card p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                            <p className={`mt-1.5 font-semibold ${large ? 'text-xl' : 'text-base'}`}>{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observations opérateur</Label>
                        <Textarea className="rounded-xl" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Notes finales, incidents, orientation physique du lot..." rows={4} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`shadow-sm transition-colors ${derivedAlerts.length > 0 ? 'border-amber-300' : 'border-emerald-200'}`}>
                    <CardHeader className={`border-b pb-4 ${derivedAlerts.length > 0 ? 'bg-amber-50/60' : 'bg-emerald-50/50'}`}>
                      <CardTitle className="flex items-center gap-2.5 text-base">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${derivedAlerts.length > 0 ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                          <AlertTriangle className={`h-4 w-4 ${derivedAlerts.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                        </div>
                        Alertes et contrôles
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-5">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { ok: arrivalPhotos.length >= 2, label: `${arrivalPhotos.length}/2 photos` },
                          { ok: !lotMismatch, label: 'Sous-lots OK' },
                          { ok: !!selectedSupplier, label: 'Fournisseur actif' },
                          { ok: weighingSource === 'SCALE' || manualReason.trim().length >= 10, label: 'Pesée justifiée' },
                        ].map(({ ok, label }) => (
                          <div key={label} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-border bg-muted/30 text-muted-foreground'}`}>
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${ok ? 'bg-emerald-500 text-white' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                              {ok ? '✓' : '○'}
                            </span>
                            {label}
                          </div>
                        ))}
                      </div>

                      {derivedAlerts.length > 0 ? (
                        <div className="space-y-2">
                          {derivedAlerts.map((alert) => (
                            <div key={alert} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                              {alert}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                          Aucun blocage critique détecté avant lancement QC.
                        </div>
                      )}

                      <div className="rounded-xl border bg-card px-4 py-3 text-sm">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          Opérateur validation
                        </div>
                        <p className="mt-1.5 font-semibold">{operatorLabel}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ── Step 6: Success ── */}
              {step === 6 && submitResult && (
                <div className="flex min-h-[320px] items-center justify-center py-8">
                  <div className="w-full max-w-2xl">
                    <div className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-10 text-center shadow-lg shadow-emerald-100/60">
                      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-xl shadow-emerald-300/50">
                        <Check className="h-10 w-10 text-white" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-600">Réception enregistrée</p>
                      <h3 className="mt-2 text-3xl font-bold tracking-tight text-emerald-950">{submitResult.receptionNumber}</h3>
                      <div className="mt-8 grid gap-3 text-left md:grid-cols-3">
                        {[
                          { label: 'Sous-lots', value: String(submitResult.lotCount) },
                          { label: 'Zone', value: submitResult.zone },
                          { label: 'Statut', value: 'En attente QC' },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                            <p className="mt-1.5 text-lg font-bold">{value}</p>
                          </div>
                        ))}
                      </div>
                      <Button className="mt-8 rounded-xl px-8" onClick={handleClose}>Fermer</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {viewMode === 'form' && step < 6 && (
          <div className="shrink-0 border-t bg-muted/20 px-6 py-4">
            {stepBlockers.length > 0 && (
              <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <span className="font-semibold">Pour continuer : </span>
                  {stepBlockers.join(', ')}.
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" className="rounded-xl" onClick={() => (step === 1 ? handleClose() : setStep((c) => c - 1))}>
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                {step === 1 ? 'Annuler' : 'Précédent'}
              </Button>

              {/* Dot progress indicator */}
              <div className="flex items-center gap-1.5">
                {steps.map((s) => (
                  <div
                    key={s.id}
                    className={`rounded-full transition-all duration-300 ${
                      step === s.id
                        ? 'h-2 w-6 bg-primary'
                        : step > s.id
                          ? 'h-2 w-2 bg-emerald-400'
                          : 'h-2 w-2 bg-muted-foreground/20'
                    }`}
                  />
                ))}
              </div>

              {step < 5 ? (
                <Button className="rounded-xl" onClick={() => setStep((c) => c + 1)} disabled={!canProceed()}>
                  Suivant
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <Button className="rounded-xl" onClick={handleSubmit} disabled={!canProceed() || createReceptionIntake.isPending}>
                  {createReceptionIntake.isPending ? 'Validation...' : 'Valider la réception'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
