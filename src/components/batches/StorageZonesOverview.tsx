import { FormEvent, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  Droplets,
  Factory,
  MapPinned,
  Package,
  PackageCheck,
  QrCode,
  Search,
  ShieldAlert,
  Snowflake,
  Thermometer,
  Warehouse,
  Wind,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { QrScannerDialog } from "@/components/reception/QrScannerDialog";
import {
  useCreateStorageDoorEvent,
  useCreateStorageReading,
  useEvaluateStorageRules,
  useModule3StorageLocations,
  useModule3StorageZones,
  useMoveStorageStock,
  useSeedStorageModule3,
  useStorageConditionReadings,
  useStorageDoorEvents,
  useStorageDlcAlerts,
  useStorageLocationMovements,
  useSuggestFefoLots,
  useSuggestStorageLocation,
} from "@/hooks/useStorageModule3";
import { useMoveReceptionLotToStorage, useRawStorageOverdueReceptions } from "@/hooks/useReceptionsV2";
import { useAllReceptionLots, useInventoryCounts, useStockSummary } from "@/hooks/useStock";
import { cn } from "@/lib/utils";
import { storageMovementReasonLabels, storageMovementTypeLabels } from "@/types/storage";
import type {
  Module3StorageZone,
  StorageConditionStatus,
  StorageLocationStatus,
  StorageMovementReason,
  StorageMovementType,
} from "@/types/storage";

interface StorageZonesOverviewProps {
  canManage?: boolean;
  defaultTab?: string;
}

const statusLabels: Record<StorageLocationStatus, string> = {
  free: "Libre",
  occupied: "Occupe",
  reserved: "Reserve",
  blocked: "Bloque",
};

const conditionLabels: Record<StorageConditionStatus, string> = {
  normal: "Normal",
  warning: "A surveiller",
  critical: "Critique",
};

const familyLabels: Record<string, string> = {
  reception: "Reception",
  raw: "Stockage brut",
  cold: "Froid",
  fumigation: "Fumigation",
  export: "Export",
};

const stockStatusLabels: Record<string, string> = {
  EN_QUARANTAINE: "Quarantaine",
  STOCK_LIBERE: "Libéré",
  STOCK_REJETE: "Rejeté",
  NON_STOCKE: "Non stocké",
};

const stockStatusBadge: Record<string, string> = {
  STOCK_LIBERE:   "border-emerald-200 bg-emerald-50 text-emerald-700",
  EN_QUARANTAINE: "border-amber-200 bg-amber-50 text-amber-700",
  STOCK_REJETE:   "border-red-200 bg-red-50 text-red-700",
  NON_STOCKE:     "border-slate-200 bg-slate-50 text-slate-600",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatNumber = (value?: number | null, suffix = "") => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
};

const normalizeScannedLotToken = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const beforePipe = raw.split("|")[0]?.trim();
  return beforePipe || raw;
};

const extractLotIdFromQr = (value: string) => {
  const raw = value.trim();
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const candidate = parsed.stock_lot_id
      || parsed.stockLotId
      || parsed.lot_internal
      || parsed.lot_id
      || parsed.lotId
      || parsed.lot_code
      || parsed.lotCode
      || parsed.lot_number
      || parsed.lotNumber
      || parsed.barcode
      || parsed.unit_barcode
      || parsed.unitBarcode
      || parsed.qr_code_payload
      || parsed.qrCodePayload
      || parsed.qr_label_text
      || parsed.qrLabelText
      || parsed.sscc;

    if (candidate) return normalizeScannedLotToken(candidate);
  } catch {
    // QR labels may contain plain LOT-ID text or a URL.
  }

  try {
    const url = new URL(raw);
    const candidate = url.searchParams.get("lot")
      || url.searchParams.get("lotId")
      || url.searchParams.get("lot_id")
      || url.searchParams.get("lotCode")
      || url.searchParams.get("lot_code")
      || url.searchParams.get("lotNumber")
      || url.searchParams.get("lot_number")
      || url.searchParams.get("barcode")
      || url.searchParams.get("unit")
      || url.searchParams.get("unitBarcode")
      || url.searchParams.get("unit_barcode")
      || url.searchParams.get("sscc");

    if (candidate) return normalizeScannedLotToken(candidate);
  } catch {
    // Not a URL; use the raw scan value.
  }

  return normalizeScannedLotToken(raw);
};

const getOccupancy = (current = 0, capacity = 0) =>
  capacity > 0 ? Math.min(100, Math.round((current / capacity) * 1000) / 10) : 0;

const getZoneIcon = (zone: Module3StorageZone) => {
  if (zone.storage_family === "cold") return <Snowflake className="h-4 w-4" />;
  if (zone.storage_family === "fumigation") return <Factory className="h-4 w-4" />;
  if (zone.storage_family === "export") return <Package className="h-4 w-4" />;
  if (zone.storage_family === "reception") return <Wind className="h-4 w-4" />;
  return <Warehouse className="h-4 w-4" />;
};

const getConditionClass = (status?: StorageConditionStatus) => {
  if (status === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const getLocationStatusClass = (status: StorageLocationStatus) => {
  if (status === "blocked") return "border-red-200 bg-red-50 text-red-700";
  if (status === "reserved") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "occupied") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const StatTile = ({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: typeof Warehouse;
}) => (
  <Card className="rounded-md">
    <CardContent className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="mt-2 truncate text-2xl font-semibold text-foreground">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{helper}</p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
    </CardContent>
  </Card>
);

export const StorageZonesOverview = ({ canManage = true, defaultTab = "zones" }: StorageZonesOverviewProps) => {
  const [selectedZoneId, setSelectedZoneId] = useState("all");
  const [locationSearch, setLocationSearch] = useState("");
  const [lotStatusFilter, setLotStatusFilter] = useState("all");
  const [lotSearch, setLotSearch] = useState("");
  const [movementScannerOpen, setMovementScannerOpen] = useState(false);
  const [readingForm, setReadingForm] = useState({
    storageZoneId: "",
    locationId: "none",
    temperatureC: "",
    humidityPercent: "",
    gasPpm: "",
    sensorRef: "",
  });
  const [doorForm, setDoorForm] = useState({
    storageZoneId: "",
    eventType: "OPEN" as "OPEN" | "CLOSE",
    sensorRef: "",
  });
  const [movementForm, setMovementForm] = useState({
    movementType: "TRANSFERT" as StorageMovementType,
    sourceLocationId: "none",
    destinationLocationId: "",
    destinationZoneId: "none",
    lotCode: "",
    productId: "",
    variety: "",
    lotIsBio: "unknown",
    quantityPalettes: "1",
    quantityKg: "",
    reason: "RECEPTION" as StorageMovementReason,
    fefoOverrideReason: "",
    notes: "",
  });

  // ── Unplaced-lot assignment state ─────────────────────────────────────────
  type UnplacedLot = { id: string; lot_internal?: string; lot_supplier?: string; variety?: string; quantity?: number; unit?: string; stock_status?: string; reception_id?: string };
  const [assignLot, setAssignLot] = useState<UnplacedLot | null>(null);
  const [assignZone, setAssignZone] = useState('');
  const [assignPerformedBy, setAssignPerformedBy] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const moveLotToStorage = useMoveReceptionLotToStorage();

  const handleAssignLot = async () => {
    if (!assignLot || !assignZone || !assignPerformedBy) return;
    await moveLotToStorage.mutateAsync({
      lotId: assignLot.id,
      targetZone: assignZone,
      performedBy: assignPerformedBy,
      notes: assignNotes || undefined,
      _lotStockStatus: assignLot.stock_status ?? 'STOCK_LIBERE',
      _receptionStatus: 'VALIDE',
    });
    setAssignLot(null);
    setAssignZone('');
    setAssignPerformedBy('');
    setAssignNotes('');
  };

  const { data: zones = [], isLoading: zonesLoading } = useModule3StorageZones();
  const { data: allLocations = [] } = useModule3StorageLocations();
  const { data: locations = [] } = useModule3StorageLocations(selectedZoneId);
  const { data: readings = [] } = useStorageConditionReadings(120);
  const { data: movements = [] } = useStorageLocationMovements(120);
  const { data: rawOverdue = [] } = useRawStorageOverdueReceptions();
  const { data: dlcAlerts = [] } = useStorageDlcAlerts();
  const { data: inventoryCounts = [] } = useInventoryCounts();
  const { data: doorEvents = [] } = useStorageDoorEvents(80);
  const { data: allReceptionLots = [] } = useAllReceptionLots();
  const { data: stockSummary } = useStockSummary();
  const seedStorage = useSeedStorageModule3();
  const createReading = useCreateStorageReading();
  const createDoorEvent = useCreateStorageDoorEvent();
  const moveStock = useMoveStorageStock();
  const suggestLocation = useSuggestStorageLocation();
  const suggestFefo = useSuggestFefoLots();
  const evaluateRules = useEvaluateStorageRules();

  const selectedReadingZone = zones.find((zone) => zone.id === readingForm.storageZoneId);
  const selectedDoorZone = zones.find((zone) => zone.id === doorForm.storageZoneId);
  const readingLocations = allLocations.filter(
    (location) => !readingForm.storageZoneId || location.storage_zone_id === readingForm.storageZoneId,
  );

  const filteredLocations = useMemo(() => {
    const search = locationSearch.trim().toLowerCase();
    if (!search) return locations;
    return locations.filter((location) => {
      const lots = Array.isArray(location.lot_ids_present) ? location.lot_ids_present.join(" ") : "";
      return [location.code, location.name, location.zone_code, lots]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [locationSearch, locations]);

  const filteredLots = useMemo(() => {
    let result = allReceptionLots;
    if (lotStatusFilter !== "all") result = result.filter((l) => l.stock_status === lotStatusFilter);
    const q = lotSearch.trim().toLowerCase();
    if (q) result = result.filter((l) =>
      [l.lot_internal, l.lot_supplier, l.variety, l.storage_zone_code]
        .filter(Boolean).join(" ").toLowerCase().includes(q),
    );
    return result;
  }, [allReceptionLots, lotStatusFilter, lotSearch]);

  const lotStats = useMemo(() => {
    const liberéKg   = allReceptionLots.filter((l) => l.stock_status === "STOCK_LIBERE").reduce((s, l) => s + Number(l.quantity ?? 0), 0);
    const quarantineKg = allReceptionLots.filter((l) => l.stock_status === "EN_QUARANTAINE").reduce((s, l) => s + Number(l.quantity ?? 0), 0);
    const rejeté      = allReceptionLots.filter((l) => l.stock_status === "STOCK_REJETE").length;
    return { liberéKg, quarantineKg, rejeté, total: allReceptionLots.length };
  }, [allReceptionLots]);

  const metrics = useMemo(() => {
    const KG_PER_PALETTE = 800;
    const totalPalettes = zones.reduce((sum, zone) => sum + Number(zone.capacity_palettes || 0), 0);
    const totalKg = zones.reduce((sum, zone) => sum + Number(zone.capacity_kg || 0), 0);
    const activeConditions = zones.filter((zone) => zone.condition_status === "warning" || zone.condition_status === "critical");
    const freeLocations = allLocations.filter((location) => {
      if (location.location_status === "blocked" || location.location_status === "reserved") return false;
      const cap = Number(location.capacity_palettes || 0);
      const occ = Number(location.occupied_palettes || 0);
      return cap <= 0 || occ < cap;
    }).length;
    const blockedLocations = allLocations.filter((location) => location.location_status === "blocked").length;

    // Compute usedKg from ALL active lots (libéré + quarantaine), regardless of zone assignment.
    // Zone aggregation only counts lots that have been physically placed → would miss QC-only lots.
    const usedKg = allReceptionLots
      .filter((l) => l.stock_status === "STOCK_LIBERE" || l.stock_status === "EN_QUARANTAINE")
      .reduce((s, l) => s + Number(l.quantity ?? 0), 0);
    const usedPalettes = Math.ceil(usedKg / KG_PER_PALETTE);

    // Lots libérés but not yet placed in a physical zone
    const unplacedKg = allReceptionLots
      .filter((l) => (l.stock_status === "STOCK_LIBERE" || l.stock_status === "EN_QUARANTAINE") && !l.storage_zone_code)
      .reduce((s, l) => s + Number(l.quantity ?? 0), 0);

    return {
      totalPalettes,
      usedPalettes,
      totalKg,
      usedKg,
      unplacedKg,
      activeConditions,
      freeLocations,
      blockedLocations,
      occupancy: getOccupancy(usedPalettes, totalPalettes),
    };
  }, [allLocations, allReceptionLots, zones]);

  const movementNeedsSource = movementForm.movementType !== "ENTREE_ZONE";
  const movementNeedsDestination = movementForm.movementType !== "SORTIE_ZONE";
  const movementPaletteQuantity = Number(movementForm.quantityPalettes || 1);

  const destinationCapacityExceeded = useMemo(() => {
    if (!movementNeedsDestination || !movementForm.destinationLocationId) return false;
    const destLoc = allLocations.find((l) => l.id === movementForm.destinationLocationId);
    if (!destLoc) return false;
    const cap = Number(destLoc.capacity_palettes || 0);
    if (cap <= 0) return false;
    return Number(destLoc.occupied_palettes || 0) + movementPaletteQuantity > cap;
  }, [movementNeedsDestination, movementForm.destinationLocationId, movementPaletteQuantity, allLocations]);

  const canSubmitMovement =
    !!movementForm.lotCode.trim() &&
    !!movementForm.reason &&
    Number.isFinite(movementPaletteQuantity) &&
    movementPaletteQuantity > 0 &&
    !destinationCapacityExceeded &&
    (!movementNeedsSource || movementForm.sourceLocationId !== "none") &&
    (!movementNeedsDestination || !!movementForm.destinationLocationId || movementForm.destinationZoneId !== "none");

  const handleMovementQrDetected = useCallback((value: string) => {
    const lotId = extractLotIdFromQr(value);
    setMovementForm((current) => ({ ...current, lotCode: lotId }));
  }, []);

  const handleReadingSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedReadingZone) return;

    createReading.mutate({
      storageZoneId: selectedReadingZone.id,
      zoneCode: selectedReadingZone.code,
      locationId: readingForm.locationId === "none" ? undefined : readingForm.locationId,
      temperatureC: readingForm.temperatureC === "" ? "" : Number(readingForm.temperatureC),
      humidityPercent: readingForm.humidityPercent === "" ? "" : Number(readingForm.humidityPercent),
      gasPpm: readingForm.gasPpm === "" ? "" : Number(readingForm.gasPpm),
      sensorRef: readingForm.sensorRef || undefined,
    });
  };

  const handleMovementSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmitMovement) return;

    moveStock.mutate({
      sourceLocationId: movementForm.sourceLocationId === "none" ? undefined : movementForm.sourceLocationId,
      destinationLocationId: movementForm.destinationLocationId || undefined,
      destinationZoneId: movementForm.destinationZoneId === "none" ? undefined : movementForm.destinationZoneId,
      lotCode: movementForm.lotCode || undefined,
      productId: movementForm.productId || undefined,
      variety: movementForm.variety || undefined,
      lotIsBio: movementForm.lotIsBio === "unknown" ? undefined : movementForm.lotIsBio === "yes",
      quantityPalettes: movementForm.quantityPalettes ? Number(movementForm.quantityPalettes) : 0,
      quantityKg: movementForm.quantityKg ? Number(movementForm.quantityKg) : 0,
      movementType: movementForm.movementType,
      reason: movementForm.reason,
      fefoOverrideReason: movementForm.fefoOverrideReason || undefined,
      notes: movementForm.notes || undefined,
    });
  };

  const handleDoorSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedDoorZone) return;

    createDoorEvent.mutate({
      storageZoneId: selectedDoorZone.id,
      zoneCode: selectedDoorZone.code,
      eventType: doorForm.eventType,
      sensorRef: doorForm.sensorRef || undefined,
    });
  };

  const handleSuggestDestination = () => {
    if (movementForm.destinationZoneId === "none") return;

    suggestLocation.mutate(
      {
        destinationZoneId: movementForm.destinationZoneId,
        quantityPalettes: movementForm.quantityPalettes ? Number(movementForm.quantityPalettes) : 1,
        variety: movementForm.variety || undefined,
        lotIsBio: movementForm.lotIsBio === "unknown" ? undefined : movementForm.lotIsBio === "yes",
      },
      {
        onSuccess: (data) => {
          if (data.suggestion?.id) {
            setMovementForm((current) => ({ ...current, destinationLocationId: data.suggestion?.id || "" }));
          } else {
            toast.error("Aucun emplacement disponible dans cette zone pour " + movementPaletteQuantity + " palette(s).");
          }
        },
      },
    );
  };

  const handleSuggestFefo = () => {
    suggestFefo.mutate({
      productId: movementForm.productId || undefined,
      variety: movementForm.variety || undefined,
      limit: 8,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">Module 3</p>
          <h2 className="text-2xl text-foreground">Stockage et gestion des zones</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Cartographie Royal Palm, emplacements structures, mouvements et monitoring des conditions.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => evaluateRules.mutate()}
              disabled={evaluateRules.isPending}
              className="h-10 rounded-md"
            >
              <AlertTriangle className="h-4 w-4" />
              {evaluateRules.isPending ? "Evaluation..." : "Evaluer regles 3.4"}
            </Button>
            <Button
              type="button"
              onClick={() => seedStorage.mutate()}
              disabled={seedStorage.isPending}
              className="h-10 rounded-md"
            >
              <MapPinned className="h-4 w-4" />
              {seedStorage.isPending ? "Synchronisation..." : "Synchroniser plan Royal Palm"}
            </Button>
          </div>
        )}
      </div>

      {/* ── RG-S10: Raw storage delay alert ─────────────────────────────── */}
      {rawOverdue.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span className="font-semibold text-sm">
              RG-S10 — {rawOverdue.length} lot(s) en zone brute &gt; 48h sans orientation fumigation
            </span>
          </div>
          <ul className="mt-2 space-y-0.5">
            {rawOverdue.map((r) => {
              const hours = Math.round(
                (Date.now() - new Date(r.actual_arrival_date).getTime()) / (1000 * 60 * 60),
              );
              return (
                <li key={r.id} className="ml-6 text-xs text-red-800">
                  {r.reception_number} — zone {r.storage_zone_code} — {hours}h — {r.quantity_total} {r.unit}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── RG-S05: DLC alert notifications ─────────────────────────────── */}
      {dlcAlerts.length > 0 && (
        <div className="rounded-md border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-2 text-orange-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600" />
            <span className="font-semibold text-sm">
              RG-S05 — {dlcAlerts.length} alerte(s) DLC active(s)
            </span>
          </div>
          <ul className="mt-2 space-y-0.5">
            {dlcAlerts.slice(0, 6).map((n) => (
              <li key={n.id} className="ml-6 text-xs text-orange-800">
                {n.title}
                {n.message ? ` — ${n.message.slice(0, 90)}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Row 1 — lot status from reception_lots */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Stock libéré"
          value={`${(lotStats.liberéKg / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t`}
          helper={`${allReceptionLots.filter((l) => l.stock_status === "STOCK_LIBERE").length} lots libérés`}
          icon={PackageCheck}
        />
        <StatTile
          label="En quarantaine"
          value={`${(lotStats.quarantineKg / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t`}
          helper={`${allReceptionLots.filter((l) => l.stock_status === "EN_QUARANTAINE").length} lots en attente QC`}
          icon={Activity}
        />
        <StatTile
          label="Lots rejetés"
          value={lotStats.rejeté}
          helper={`sur ${lotStats.total} lots au total`}
          icon={ShieldAlert}
        />
        <StatTile
          label="Alertes DLC / stock"
          value={(metrics.activeConditions.length + metrics.blockedLocations + (stockSummary as { MP?: { alertsMin?: number; alertsSecurity?: number } } | undefined)?.MP?.alertsMin ?? 0) as number}
          helper={`${metrics.blockedLocations} empl. bloqués · ${dlcAlerts.length} alertes DLC`}
          icon={AlertTriangle}
        />
      </div>

      {/* Row 2 — physical zone metrics */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Zones actives"
          value={zones.length}
          helper={`${allLocations.length} emplacements structures`}
          icon={Warehouse}
        />
        <StatTile
          label="Occupation palettes"
          value={`${metrics.occupancy}%`}
          helper={`${metrics.usedPalettes}/${metrics.totalPalettes} palettes`}
          icon={Boxes}
        />
        <StatTile
          label="Charge totale"
          value={formatNumber(metrics.usedKg / 1000, " t")}
          helper={`${formatNumber(metrics.totalKg / 1000, " t")} capacité installée`}
          icon={Activity}
        />
        <StatTile
          label="Emplacements"
          value={metrics.freeLocations}
          helper={`libres · ${metrics.blockedLocations} bloqués`}
          icon={MapPinned}
        />
      </div>

      {/* Unplaced stock warning */}
      {metrics.unplacedKg > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <span>
            <strong>{formatNumber(metrics.unplacedKg / 1000, " t")}</strong> de stock libéré/quarantaine n'ont pas encore été affectés à une zone physique.
            Utilisez l'onglet <strong>Réception → Affectation stockage</strong> pour placer ces lots dans une chambre.
          </span>
        </div>
      )}

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-md border bg-background p-1">
          <TabsTrigger value="lots" className="rounded-sm">
            <PackageCheck className="h-4 w-4" />
            Lots en stock
            {lotStats.rejeté > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {lotStats.rejeté}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="zones" className="rounded-sm">
            <MapPinned className="h-4 w-4" />
            Cartographie
          </TabsTrigger>
          <TabsTrigger value="locations" className="rounded-sm">
            <Warehouse className="h-4 w-4" />
            Emplacements
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="rounded-sm">
            <Thermometer className="h-4 w-4" />
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="movements" className="rounded-sm">
            <ArrowRightLeft className="h-4 w-4" />
            Mouvements
          </TabsTrigger>
          <TabsTrigger value="inventaire" className="rounded-sm">
            <Package className="h-4 w-4" />
            Inventaire
          </TabsTrigger>
        </TabsList>

        {/* ── Lots en stock ─────────────────────────────────────────────── */}
        <TabsContent value="lots" className="space-y-4">
          <Card className="rounded-md">
            <CardHeader className="gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="text-lg">Lots de réception — vision stock</CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={lotStatusFilter} onValueChange={setLotStatusFilter}>
                    <SelectTrigger className="h-10 rounded-md sm:w-52">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="STOCK_LIBERE">Libéré</SelectItem>
                      <SelectItem value="EN_QUARANTAINE">Quarantaine</SelectItem>
                      <SelectItem value="STOCK_REJETE">Rejeté</SelectItem>
                      <SelectItem value="NON_STOCKE">Non stocké</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={lotSearch}
                      onChange={(e) => setLotSearch(e.target.value)}
                      className="h-10 rounded-md pl-9"
                      placeholder="Lot interne, variété, zone..."
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot interne</TableHead>
                    <TableHead>Lot fournisseur</TableHead>
                    <TableHead>Variété</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Zone stockage</TableHead>
                    <TableHead>Statut stock</TableHead>
                    <TableHead>Récolte</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead>Motif quarantaine</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLots.slice(0, 300).map((lot) => (
                    <TableRow key={lot.id} className={lot.stock_status === "STOCK_REJETE" ? "bg-red-50/40" : lot.stock_status === "EN_QUARANTAINE" ? "bg-amber-50/30" : ""}>
                      <TableCell className="font-mono text-xs font-semibold">{lot.lot_internal || "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{lot.lot_supplier || "-"}</TableCell>
                      <TableCell>{lot.variety || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {lot.quantity != null ? `${Number(lot.quantity).toLocaleString("fr-FR")} ${lot.unit || "kg"}` : "-"}
                      </TableCell>
                      <TableCell>
                        {lot.storage_zone_code ? (
                          <Badge variant="outline" className="rounded-md font-mono text-xs">{lot.storage_zone_code}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-md text-xs ${stockStatusBadge[lot.stock_status ?? "NON_STOCKE"] || ""}`}>
                          {stockStatusLabels[lot.stock_status ?? "NON_STOCKE"] || lot.stock_status || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lot.harvest_date ? lot.harvest_date.slice(0, 10) : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lot.created_at ? lot.created_at.slice(0, 10) : "-"}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {lot.quarantine_reason || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLots.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                        {allReceptionLots.length === 0
                          ? "Aucun lot reçu. Les lots apparaîtront ici dès la première réception."
                          : "Aucun lot ne correspond à ce filtre."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filteredLots.length > 300 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {filteredLots.length - 300} lots supplémentaires masqués — affinez le filtre.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zones" className="space-y-6">
          {zonesLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Chargement du plan…</div>
          ) : zones.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <MapPinned className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">Aucun plan de stockage synchronisé.</p>
              {canManage && (
                <Button onClick={() => seedStorage.mutate()} disabled={seedStorage.isPending}>
                  <MapPinned className="h-4 w-4 mr-2" />
                  {seedStorage.isPending ? "Synchronisation…" : "Synchroniser le plan Royal Palm"}
                </Button>
              )}
            </div>
          ) : (
            Object.entries(
              zones.reduce<Record<string, typeof zones>>((acc, z) => {
                const f = z.storage_family || "raw";
                (acc[f] ??= []).push(z);
                return acc;
              }, {}),
            ).map(([family, familyZones]) => {
              const totalPal = familyZones.reduce((s, z) => s + (z.capacity_palettes || 0), 0);
              const usedPal  = familyZones.reduce((s, z) => s + (z.current_load_palettes || 0), 0);
              const groupOcc = getOccupancy(usedPal, totalPal);

              const SECTION_STYLE: Record<string, string> = {
                reception:  "border-sky-200 bg-sky-50/60",
                raw:        "border-amber-200 bg-amber-50/60",
                fumigation: "border-orange-200 bg-orange-50/60",
                cold:       "border-blue-200 bg-blue-50/60",
                export:     "border-emerald-200 bg-emerald-50/60",
              };
              const CARD_STYLE: Record<string, string> = {
                normal:   "border-emerald-200 bg-white",
                warning:  "border-amber-300 bg-amber-50",
                critical: "border-red-300 bg-red-50",
              };

              return (
                <div key={family} className={cn("rounded-xl border p-4 space-y-3", SECTION_STYLE[family] || "border-border bg-muted/20")}>
                  {/* Section header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/80 text-foreground border">
                        {getZoneIcon(familyZones[0])}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{familyLabels[family] || family}</p>
                        <p className="text-xs text-muted-foreground">{familyZones.length} zone(s) • {usedPal}/{totalPal} palettes ({groupOcc}%)</p>
                      </div>
                    </div>
                    <Progress
                      value={groupOcc}
                      className={cn("w-24 h-2",
                        groupOcc >= 90 ? "[&>div]:bg-red-500" :
                        groupOcc >= 70 ? "[&>div]:bg-amber-500" :
                        "[&>div]:bg-emerald-500"
                      )}
                    />
                  </div>

                  {/* Zone cards */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {familyZones.map((zone) => {
                      const occ = getOccupancy(zone.current_load_palettes || 0, zone.capacity_palettes || 0);
                      const condStyle = CARD_STYLE[zone.condition_status || "normal"] || CARD_STYLE.normal;
                      return (
                        <Card
                          key={zone.id}
                          className={cn("rounded-lg border transition-shadow hover:shadow-md", condStyle)}
                        >
                          <CardContent className="p-3 space-y-2.5">
                            {/* Code + name */}
                            <div className="flex items-start justify-between gap-1">
                              <div>
                                <p className="font-bold text-sm leading-tight">{zone.code}</p>
                                <p className="text-xs text-muted-foreground leading-tight mt-0.5 line-clamp-2">{zone.name}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] shrink-0 rounded-md px-1.5 py-px", getConditionClass(zone.condition_status))}
                              >
                                {conditionLabels[zone.condition_status || "normal"]}
                              </Badge>
                            </div>

                            {/* Occupancy bar */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>{zone.current_load_palettes || 0} / {zone.capacity_palettes || 0} pal.</span>
                                <span className={cn("font-semibold", occ >= 90 ? "text-red-600" : occ >= 70 ? "text-amber-600" : "text-emerald-600")}>{occ}%</span>
                              </div>
                              <Progress
                                value={occ}
                                className={cn("h-1.5 rounded-full",
                                  occ >= 90 ? "[&>div]:bg-red-500" :
                                  occ >= 70 ? "[&>div]:bg-amber-500" :
                                  "[&>div]:bg-emerald-500"
                                )}
                              />
                            </div>

                            {/* Temperature */}
                            {(zone.current_temperature_c != null || zone.temperature_min != null) && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Thermometer className="h-3 w-3 shrink-0" />
                                {zone.current_temperature_c != null
                                  ? <span><strong className="text-foreground">{zone.current_temperature_c}°C</strong> actuel</span>
                                  : <span>—</span>
                                }
                                {zone.temperature_min != null && zone.temperature_max != null && (
                                  <span className="ml-1 opacity-70">({zone.temperature_min}–{zone.temperature_max}°C)</span>
                                )}
                              </div>
                            )}

                            {/* Capacity + sensors */}
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/40 pt-1.5">
                              <span>{formatNumber(zone.capacity_kg / 1000, " t")}</span>
                              {zone.sensor_summary && <span className="truncate ml-2">{zone.sensor_summary}</span>}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Unplaced lots — liberated via QC but not yet assigned to a zone */}
          {(() => {
            const unplaced = allReceptionLots.filter(
              (l) => (l.stock_status === "STOCK_LIBERE" || l.stock_status === "EN_QUARANTAINE") && !l.storage_zone_code,
            );
            if (unplaced.length === 0) return null;
            const unplacedKg = unplaced.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
            return (
              <>
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <p className="font-semibold text-sm text-amber-800">
                      Stock non localisé — {unplaced.length} lot(s) · {formatNumber(unplacedKg / 1000, " t")}
                    </p>
                    <span className="text-xs text-amber-600 ml-auto">À affecter à une zone physique</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {unplaced.map((lot) => (
                      <div key={String(lot.id)} className="rounded-md border border-amber-200 bg-white px-3 py-2 text-xs space-y-1.5">
                        <p className="font-mono font-semibold">{lot.lot_internal || lot.lot_supplier || "—"}</p>
                        <p className="text-muted-foreground">{lot.variety || "—"} · {Number(lot.quantity ?? 0).toLocaleString("fr-FR")} kg</p>
                        <Badge variant="outline" className={`text-[10px] rounded ${stockStatusBadge[lot.stock_status ?? "NON_STOCKE"]}`}>
                          {stockStatusLabels[lot.stock_status ?? "NON_STOCKE"]}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-[11px] border-amber-400 text-amber-800 hover:bg-amber-100 mt-1"
                          onClick={() => { setAssignLot(lot); setAssignZone(''); setAssignPerformedBy(''); setAssignNotes(''); }}
                        >
                          <ArrowRight className="h-3 w-3 mr-1" />
                          Affecter une zone
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assignment dialog */}
                <Dialog open={!!assignLot} onOpenChange={(open) => { if (!open) setAssignLot(null); }}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Affecter le lot à une zone physique</DialogTitle>
                    </DialogHeader>
                    {assignLot && (
                      <div className="space-y-4">
                        {/* Lot summary */}
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                          <p className="font-mono font-bold text-sm">{assignLot.lot_internal || assignLot.lot_supplier || "—"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {assignLot.variety || "—"} · {Number(assignLot.quantity ?? 0).toLocaleString("fr-FR")} {assignLot.unit || "kg"}
                          </p>
                          <Badge variant="outline" className={`mt-1 text-[10px] rounded ${stockStatusBadge[assignLot.stock_status ?? "NON_STOCKE"]}`}>
                            {stockStatusLabels[assignLot.stock_status ?? "NON_STOCKE"]}
                          </Badge>
                        </div>

                        {/* Zone selector — all zones grouped by family, recommended families highlighted */}
                        <div className="space-y-1.5">
                          <Label>Zone de destination *</Label>
                          <Select value={assignZone} onValueChange={setAssignZone}>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner une zone physique" />
                            </SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const recommendedFamilies = assignLot.stock_status === 'STOCK_LIBERE'
                                  ? ['cold', 'export']
                                  : assignLot.stock_status === 'EN_QUARANTAINE'
                                  ? ['fumigation']
                                  : [];
                                const familyLabel: Record<string, string> = {
                                  cold: 'Chambres froides (CF)',
                                  export: 'Export (ZE)',
                                  fumigation: 'Quarantaine / Fumigation (FU)',
                                  reception: 'Zone Réception (ZR)',
                                  raw: 'Stockage brut (SB)',
                                };
                                // Group all zones by family, recommended first
                                const allFamilies = [...new Set(zones.map((z) => z.storage_family ?? 'raw'))];
                                const ordered = [
                                  ...recommendedFamilies.filter((f) => allFamilies.includes(f)),
                                  ...allFamilies.filter((f) => !recommendedFamilies.includes(f)),
                                ];
                                if (zones.length === 0) {
                                  return (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">
                                      Aucune zone disponible. Vérifiez la configuration du stockage.
                                    </div>
                                  );
                                }
                                return ordered.map((family) => {
                                  const fzones = zones.filter((z) => (z.storage_family ?? 'raw') === family);
                                  if (fzones.length === 0) return null;
                                  const isRecommended = recommendedFamilies.includes(family);
                                  return (
                                    <SelectGroup key={family}>
                                      <SelectLabel className={`text-xs font-semibold ${isRecommended ? 'text-green-700' : 'text-muted-foreground'}`}>
                                        {isRecommended ? '✓ ' : ''}{familyLabel[family] ?? family}
                                      </SelectLabel>
                                      {fzones.map((z) => {
                                        const occ = z.capacity_palettes ? Math.round(((z.current_load_palettes ?? 0) / z.capacity_palettes) * 100) : 0;
                                        return (
                                          <SelectItem key={z.id} value={z.code}>
                                            <span className="font-mono">{z.code}</span>
                                            {z.name ? ` — ${z.name}` : ''}
                                            {z.capacity_palettes ? (
                                              <span className={`ml-2 text-[10px] ${occ >= 90 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                                {occ}%
                                              </span>
                                            ) : null}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectGroup>
                                  );
                                });
                              })()}
                            </SelectContent>
                          </Select>
                          {assignLot.stock_status === 'STOCK_LIBERE' && (
                            <p className="text-[11px] text-green-700">Recommandé : chambres froides (CF) ou export (ZE).</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label>Effectué par *</Label>
                          <Input
                            value={assignPerformedBy}
                            onChange={(e) => setAssignPerformedBy(e.target.value)}
                            placeholder="Nom du magasinier"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Notes</Label>
                          <Textarea
                            value={assignNotes}
                            onChange={(e) => setAssignNotes(e.target.value)}
                            placeholder="Observations…"
                            rows={2}
                          />
                        </div>
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAssignLot(null)}>Annuler</Button>
                      <Button
                        onClick={handleAssignLot}
                        disabled={!assignZone || !assignPerformedBy || moveLotToStorage.isPending}
                      >
                        {moveLotToStorage.isPending ? 'Affectation…' : 'Confirmer l\'affectation'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            );
          })()}
        </TabsContent>

        <TabsContent value="locations" className="space-y-4">
          {/* ── Zone summary cards ─────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {zones.map((zone) => {
              const zoneLots = allReceptionLots.filter((l) => l.storage_zone_code === zone.code);
              const zoneKg = zoneLots.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
              const libKg = zoneLots.filter((l) => l.stock_status === "STOCK_LIBERE").reduce((s, l) => s + Number(l.quantity ?? 0), 0);
              const quarKg = zoneLots.filter((l) => l.stock_status === "EN_QUARANTAINE").reduce((s, l) => s + Number(l.quantity ?? 0), 0);
              const occ = getOccupancy(zone.current_load_palettes || 0, zone.capacity_palettes || 0);
              if (zoneLots.length === 0 && zone.current_load_palettes === 0) return null;
              return (
                <Card key={zone.id} className="rounded-lg border">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm">{zone.code}</p>
                      <Badge variant="outline" className="text-[10px] rounded-md">{zone.storage_family || "raw"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{zone.name}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{zone.current_load_palettes || 0} / {zone.capacity_palettes} pal.</span>
                        <span className={cn("font-semibold", occ >= 90 ? "text-red-600" : occ >= 70 ? "text-amber-600" : "text-emerald-600")}>{occ}%</span>
                      </div>
                      <Progress value={occ} className={cn("h-1.5", occ >= 90 ? "[&>div]:bg-red-500" : occ >= 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500")} />
                    </div>
                    {zoneLots.length > 0 && (
                      <div className="text-[11px] space-y-0.5 border-t pt-1.5">
                        <p className="text-muted-foreground">{zoneLots.length} lot(s) · {zoneKg.toLocaleString("fr-FR")} kg total</p>
                        {libKg > 0 && <p className="text-emerald-700">✓ {libKg.toLocaleString("fr-FR")} kg libérés</p>}
                        {quarKg > 0 && <p className="text-amber-600">⚠ {quarKg.toLocaleString("fr-FR")} kg quarantaine</p>}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {zoneLots.slice(0, 4).map((l) => (
                            <Badge key={String(l.id)} variant="secondary" className="text-[10px] rounded font-mono px-1">{l.lot_internal || "—"}</Badge>
                          ))}
                          {zoneLots.length > 4 && <Badge variant="outline" className="text-[10px] rounded">+{zoneLots.length - 4}</Badge>}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            }).filter(Boolean)}
          </div>

          {/* ── Sub-locations table ────────────────────────────────────── */}
          <Card className="rounded-md">
            <CardHeader className="gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-lg">Emplacements physiques</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Les lots sont affectés aux zones (CF-A1, SB-01…), non aux sous-emplacements. L'occupation indiquée est une répartition estimée par zone.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
                    <SelectTrigger className="h-10 rounded-md sm:w-64">
                      <SelectValue placeholder="Zone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les zones</SelectItem>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.code} — {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={locationSearch}
                      onChange={(event) => setLocationSearch(event.target.value)}
                      className="h-10 rounded-md pl-9"
                      placeholder="Rechercher code emplacement"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Emplacement</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Capacité</TableHead>
                    <TableHead>Occupation estimée</TableHead>
                    <TableHead>Lots dans la zone</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Dernier mvt</TableHead>
                    <TableHead>T° / HR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations.slice(0, 250).map((location) => {
                    const zoneCode = (location as any).zone_code || (location as any).storage_zone?.code || "";
                    const zoneLots = allReceptionLots.filter((l) => l.storage_zone_code === zoneCode);
                    const occ = getOccupancy(
                      Number((location as any).occupied_palettes || 0),
                      Number((location as any).capacity_palettes || 0),
                    );
                    return (
                      <TableRow key={location.id}>
                        <TableCell>
                          <p className="font-mono font-semibold text-sm">{(location as any).code}</p>
                          <p className="text-xs text-muted-foreground">{(location as any).name}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-md font-mono text-xs">{zoneCode || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {(location as any).capacity_palettes} pal.
                          <p className="text-xs text-muted-foreground">{formatNumber((location as any).capacity_kg, " kg")}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[90px]">
                            <Progress value={occ} className={cn("h-1.5 w-16", occ >= 90 ? "[&>div]:bg-red-500" : occ >= 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500")} />
                            <span className="text-xs text-muted-foreground">{occ}%</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ~{formatNumber((location as any).occupied_kg, " kg")}
                          </p>
                        </TableCell>
                        <TableCell>
                          {zoneLots.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {zoneLots.slice(0, 3).map((l) => (
                                <Badge key={String(l.id)} variant="secondary" className="font-mono text-[10px] rounded px-1">
                                  {l.lot_internal || "?"}
                                </Badge>
                              ))}
                              {zoneLots.length > 3 && (
                                <Badge variant="outline" className="text-[10px] rounded">+{zoneLots.length - 3}</Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("rounded-md text-xs", getLocationStatusClass((location as any).location_status))}>
                            {statusLabels[(location as any).location_status as StorageLocationStatus] || (location as any).location_status || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime((location as any).last_movement_at)}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {(location as any).current_temperature_c != null && (
                              <span className="flex items-center gap-1"><Thermometer className="h-3 w-3" />{(location as any).current_temperature_c}°C</span>
                            )}
                            {(location as any).current_humidity_percent != null && (
                              <span className="flex items-center gap-1"><Droplets className="h-3 w-3" />{(location as any).current_humidity_percent}%</span>
                            )}
                            {(location as any).current_temperature_c == null && (location as any).current_humidity_percent == null && "—"}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredLocations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        Aucun emplacement trouvé.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filteredLocations.length > 250 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {filteredLocations.length - 250} emplacements supplémentaires — affinez le filtre par zone.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="text-lg">Nouvelle lecture</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleReadingSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Zone</Label>
                  <Select
                    value={readingForm.storageZoneId}
                    onValueChange={(value) => setReadingForm((current) => ({ ...current, storageZoneId: value, locationId: "none" }))}
                  >
                    <SelectTrigger className="rounded-md">
                      <SelectValue placeholder="Selectionner une zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.code} - {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Emplacement</Label>
                  <Select
                    value={readingForm.locationId}
                    onValueChange={(value) => setReadingForm((current) => ({ ...current, locationId: value }))}
                    disabled={!readingForm.storageZoneId}
                  >
                    <SelectTrigger className="rounded-md">
                      <SelectValue placeholder="Optionnel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Zone complete</SelectItem>
                      {readingLocations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="temperatureC">Temp.</Label>
                    <Input
                      id="temperatureC"
                      type="number"
                      step="0.1"
                      value={readingForm.temperatureC}
                      onChange={(event) => setReadingForm((current) => ({ ...current, temperatureC: event.target.value }))}
                      className="rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="humidityPercent">Humid.</Label>
                    <Input
                      id="humidityPercent"
                      type="number"
                      step="0.1"
                      value={readingForm.humidityPercent}
                      onChange={(event) => setReadingForm((current) => ({ ...current, humidityPercent: event.target.value }))}
                      className="rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gasPpm">Gaz</Label>
                    <Input
                      id="gasPpm"
                      type="number"
                      step="0.1"
                      value={readingForm.gasPpm}
                      onChange={(event) => setReadingForm((current) => ({ ...current, gasPpm: event.target.value }))}
                      className="rounded-md"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sensorRef">Capteur</Label>
                  <Input
                    id="sensorRef"
                    value={readingForm.sensorRef}
                    onChange={(event) => setReadingForm((current) => ({ ...current, sensorRef: event.target.value }))}
                    className="rounded-md"
                    placeholder="CF-A1-T02"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!selectedReadingZone || createReading.isPending || !canManage}
                  className="w-full rounded-md"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Enregistrer lecture
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="text-lg">Capteur porte</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDoorSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Chambre froide</Label>
                  <Select
                    value={doorForm.storageZoneId}
                    onValueChange={(value) => setDoorForm((current) => ({ ...current, storageZoneId: value }))}
                  >
                    <SelectTrigger className="rounded-md">
                      <SelectValue placeholder="Selectionner une zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones
                        .filter((zone) => zone.zone_type === "cold_room")
                        .map((zone) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.code} - {zone.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Etat porte</Label>
                  <Select
                    value={doorForm.eventType}
                    onValueChange={(value: "OPEN" | "CLOSE") => setDoorForm((current) => ({ ...current, eventType: value }))}
                  >
                    <SelectTrigger className="rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Ouverture</SelectItem>
                      <SelectItem value="CLOSE">Fermeture</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doorSensorRef">Capteur</Label>
                  <Input
                    id="doorSensorRef"
                    value={doorForm.sensorRef}
                    onChange={(event) => setDoorForm((current) => ({ ...current, sensorRef: event.target.value }))}
                    className="rounded-md"
                    placeholder="CF-A1-D01"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!selectedDoorZone || createDoorEvent.isPending || !canManage}
                  className="w-full rounded-md"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Enregistrer porte
                </Button>
              </form>
              <div className="mt-4 space-y-2">
                {doorEvents.slice(0, 4).map((event) => (
                  <div key={event.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{event.zone_code}</span>
                    <Badge variant="outline" className="rounded-md">
                      {event.event_type === "OPEN" ? "Ouverte" : "Fermee"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(event.event_at)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="text-lg">Historique conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Emplacement</TableHead>
                    <TableHead>Temperature</TableHead>
                    <TableHead>Humidite</TableHead>
                    <TableHead>Gaz</TableHead>
                    <TableHead>Etat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readings.map((reading) => (
                    <TableRow key={reading.id}>
                      <TableCell>{formatDateTime(reading.reading_at)}</TableCell>
                      <TableCell>{reading.zone_code}</TableCell>
                      <TableCell>{reading.location_code || "-"}</TableCell>
                      <TableCell>{formatNumber(reading.temperature_c, "C")}</TableCell>
                      <TableCell>{formatNumber(reading.humidity_percent, "%")}</TableCell>
                      <TableCell>{formatNumber(reading.gas_ppm, " ppm")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("rounded-md", getConditionClass(reading.condition_status))}>
                          {conditionLabels[reading.condition_status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {readings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        Aucune lecture capteur.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="text-lg">Mouvement emplacement</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMovementSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Type mouvement</Label>
                  <Select
                    value={movementForm.movementType}
                    onValueChange={(value: StorageMovementType) =>
                      setMovementForm((current) => ({
                        ...current,
                        movementType: value,
                        sourceLocationId: value === "ENTREE_ZONE" ? "none" : current.sourceLocationId,
                        destinationLocationId: value === "SORTIE_ZONE" ? "" : current.destinationLocationId,
                      }))
                    }
                  >
                    <SelectTrigger className="rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(storageMovementTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Zone/Emplacement depart</Label>
                  <Select
                    value={movementForm.sourceLocationId}
                    onValueChange={(value) => setMovementForm((current) => ({ ...current, sourceLocationId: value }))}
                    disabled={!movementNeedsSource}
                  >
                    <SelectTrigger className="rounded-md">
                      <SelectValue placeholder={movementNeedsSource ? "Scanner ou selectionner" : "Non requis"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{movementNeedsSource ? "Selectionner une source" : "Entree directe"}</SelectItem>
                      {allLocations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Zone/Emplacement arrivee</Label>
                  <Select
                    value={movementForm.destinationLocationId}
                    onValueChange={(value) => setMovementForm((current) => ({ ...current, destinationLocationId: value }))}
                    disabled={!movementNeedsDestination}
                  >
                    <SelectTrigger className={cn("rounded-md", destinationCapacityExceeded && "border-red-400")}>
                      <SelectValue placeholder={movementNeedsDestination ? "Choisir emplacement" : "Non requis"} />
                    </SelectTrigger>
                    <SelectContent>
                      {allLocations
                        .filter((location) => {
                          if (location.location_status === "blocked") return false;
                          const cap = Number(location.capacity_palettes || 0);
                          if (cap <= 0) return true;
                          return Number(location.occupied_palettes || 0) < cap;
                        })
                        .map((location) => {
                          const cap = Number(location.capacity_palettes || 0);
                          const occ = Number(location.occupied_palettes || 0);
                          const remaining = cap > 0 ? cap - occ : null;
                          return (
                            <SelectItem key={location.id} value={location.id}>
                              {location.code} — {occ}/{cap > 0 ? cap : "∞"} pal.
                              {remaining !== null && remaining < movementPaletteQuantity && (
                                <span className="ml-1 text-amber-500">(insuffisant)</span>
                              )}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  {destinationCapacityExceeded && (
                    <p className="text-xs text-red-600">
                      Capacite insuffisante : {movementPaletteQuantity} palette(s) demandee(s), emplacement sature.
                    </p>
                  )}
                </div>

                {movementNeedsDestination && (
                  <div className="space-y-2">
                    <Label>Suggestion systeme</Label>
                    <Select
                      value={movementForm.destinationZoneId}
                      onValueChange={(value) => setMovementForm((current) => ({ ...current, destinationZoneId: value }))}
                    >
                      <SelectTrigger className="rounded-md">
                        <SelectValue placeholder="Laisser le systeme suggerer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune suggestion</SelectItem>
                        {zones.map((zone) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.code} - {zone.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Si aucun emplacement d'arrivee n'est choisi, le systeme prend le meilleur emplacement disponible dans cette zone.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-md"
                      disabled={movementForm.destinationZoneId === "none" || suggestLocation.isPending}
                      onClick={handleSuggestDestination}
                    >
                      <MapPinned className="h-4 w-4" />
                      {suggestLocation.isPending ? "Suggestion..." : "Proposer emplacement"}
                    </Button>
                    {suggestLocation.data?.suggestion && (
                      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        Suggestion {suggestLocation.data.suggestion.code} via {suggestLocation.data.algorithm}.
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="lotCode">LOT-ID</Label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      id="lotCode"
                      value={movementForm.lotCode}
                      onChange={(event) => setMovementForm((current) => ({ ...current, lotCode: event.target.value }))}
                      className="rounded-md"
                      placeholder="Scanner QR ou saisir LOT-ID"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="rounded-md"
                      onClick={() => setMovementScannerOpen(true)}
                      disabled={!canManage}
                      title="Scanner QR"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="productId">Produit</Label>
                    <Input
                      id="productId"
                      value={movementForm.productId}
                      onChange={(event) => setMovementForm((current) => ({ ...current, productId: event.target.value }))}
                      className="rounded-md"
                      placeholder="Option FEFO"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="variety">Variete</Label>
                    <Input
                      id="variety"
                      value={movementForm.variety}
                      onChange={(event) => setMovementForm((current) => ({ ...current, variety: event.target.value }))}
                      className="rounded-md"
                      placeholder="Deglet Nour"
                    />
                  </div>
                </div>

                {movementForm.reason === "PICKING_EXPORT" && (
                  <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-md"
                      onClick={handleSuggestFefo}
                      disabled={suggestFefo.isPending}
                    >
                      <Package className="h-4 w-4" />
                      {suggestFefo.isPending ? "Tri FEFO..." : "Afficher liste FEFO"}
                    </Button>
                    {suggestFefo.data && suggestFefo.data.length > 0 && (
                      <div className="space-y-2">
                        {suggestFefo.data.slice(0, 5).map((lot, index) => (
                          <button
                            key={String(lot.id || lot.lot_number || index)}
                            type="button"
                            onClick={() => setMovementForm((current) => ({ ...current, lotCode: String(lot.lot_number || current.lotCode) }))}
                            className="flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-left text-xs"
                          >
                            <span className="font-medium">{String(lot.lot_number || "-")}</span>
                            <span className="text-muted-foreground">{String(lot.dlc_date || lot.dluo_date || "Sans DLC")}</span>
                            {lot.dlc_alert_level && (
                              <Badge variant="outline" className="rounded-md">
                                {String(lot.dlc_alert_level).toUpperCase()}
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Lot Bio</Label>
                  <Select
                    value={movementForm.lotIsBio}
                    onValueChange={(value) => setMovementForm((current) => ({ ...current, lotIsBio: value }))}
                  >
                    <SelectTrigger className="rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">Non precise</SelectItem>
                      <SelectItem value="yes">Bio</SelectItem>
                      <SelectItem value="no">Non Bio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="quantityPalettes">Palettes</Label>
                    <Input
                      id="quantityPalettes"
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={movementForm.quantityPalettes}
                      onChange={(event) => setMovementForm((current) => ({ ...current, quantityPalettes: event.target.value }))}
                      className="rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantityKg">Kg</Label>
                    <Input
                      id="quantityKg"
                      type="number"
                      min="0"
                      value={movementForm.quantityKg}
                      onChange={(event) => setMovementForm((current) => ({ ...current, quantityKg: event.target.value }))}
                      className="rounded-md"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Motif</Label>
                  <Select
                    value={movementForm.reason}
                    onValueChange={(value: StorageMovementReason) => setMovementForm((current) => ({ ...current, reason: value }))}
                  >
                    <SelectTrigger className="rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(storageMovementReasonLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {movementForm.reason === "PICKING_EXPORT" && (
                  <div className="space-y-2">
                    <Label htmlFor="fefoOverrideReason">Motif override FEFO</Label>
                    <Input
                      id="fefoOverrideReason"
                      value={movementForm.fefoOverrideReason}
                      onChange={(event) => setMovementForm((current) => ({ ...current, fefoOverrideReason: event.target.value }))}
                      className="rounded-md"
                      placeholder="Obligatoire si le lot choisi n'est pas le premier FEFO"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={movementForm.notes}
                    onChange={(event) => setMovementForm((current) => ({ ...current, notes: event.target.value }))}
                    className="min-h-20 rounded-md"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!canSubmitMovement || moveStock.isPending || !canManage}
                  className="w-full rounded-md"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Enregistrer mouvement
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="text-lg">Journal des mouvements</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N mouvement</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Quantite</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Operateur</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="font-semibold">{movement.movement_number}</TableCell>
                      <TableCell>{formatDateTime(movement.movement_date)}</TableCell>
                      <TableCell>
                        {storageMovementTypeLabels[movement.movement_type as StorageMovementType] || movement.movement_type}
                      </TableCell>
                      <TableCell>{movement.lot_code || movement.lot_id || "-"}</TableCell>
                      <TableCell>{movement.source_location_code || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <span>{movement.destination_location_code || "-"}</span>
                          {movement.destination_suggested_by_system && (
                            <Badge variant="outline" className="rounded-md border-sky-200 bg-sky-50 text-sky-700">
                              Suggestion
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p>{formatNumber(movement.quantity_palettes, " pal.")}</p>
                        <p className="text-xs text-muted-foreground">{formatNumber(movement.quantity_kg, " kg")}</p>
                      </TableCell>
                      <TableCell>
                        {movement.movement_reason
                          ? storageMovementReasonLabels[movement.movement_reason]
                          : movement.reason || "-"}
                      </TableCell>
                      <TableCell>{movement.performed_by || "-"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{movement.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {movements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                        Aucun mouvement enregistre.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── RG-S08: Inventaire cyclique ────────────────────────────────── */}
        <TabsContent value="inventaire" className="space-y-4">
          <Card className="rounded-md">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Inventaire cyclique (RG-S08)</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Comptages planifiés par le moteur de règles. Cliquez sur "Planifier" pour déclencher un cycle.
                </p>
              </div>
              {canManage && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => evaluateRules.mutate()}
                  disabled={evaluateRules.isPending}
                  className="h-10 rounded-md shrink-0"
                >
                  <Package className="h-4 w-4" />
                  {evaluateRules.isPending ? "Planification..." : "Planifier comptage"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° inventaire</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Emplacement</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Qté attendue</TableHead>
                    <TableHead>Qté comptée</TableHead>
                    <TableHead>Écart</TableHead>
                    <TableHead>Réalisé par</TableHead>
                    <TableHead>Approuvé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryCounts.slice(0, 50).map((count) => (
                    <TableRow key={count.id}>
                      <TableCell className="font-semibold">{count.inventory_number}</TableCell>
                      <TableCell>{count.inventory_date ? count.inventory_date.slice(0, 10) : '-'}</TableCell>
                      <TableCell>{count.location?.code || '-'}</TableCell>
                      <TableCell>{count.product?.name || count.lot?.lot_number || '-'}</TableCell>
                      <TableCell>{count.expected_quantity}</TableCell>
                      <TableCell>{count.counted_quantity}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-md",
                            count.variance === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                            Math.abs(count.variance_percent) > 5 ? "border-red-200 bg-red-50 text-red-700" :
                            "border-amber-200 bg-amber-50 text-amber-700",
                          )}
                        >
                          {count.variance > 0 ? '+' : ''}{count.variance} ({count.variance_percent?.toFixed(1)}%)
                        </Badge>
                      </TableCell>
                      <TableCell>{count.counted_by || '-'}</TableCell>
                      <TableCell>
                        {count.adjustment_approved ? (
                          <Badge className="rounded-md bg-emerald-600 text-white">Oui</Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-md">Non</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {inventoryCounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                        Aucun comptage inventaire enregistré. Cliquez sur "Planifier comptage" pour lancer un cycle.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <QrScannerDialog
        open={movementScannerOpen}
        onOpenChange={setMovementScannerOpen}
        onDetected={handleMovementQrDetected}
      />
    </div>
  );
};
