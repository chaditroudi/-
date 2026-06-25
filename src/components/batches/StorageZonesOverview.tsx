import { useCallback, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BoxIcon,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Eye,
  Factory,
  MapPin,
  Package,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Snowflake,
  Thermometer,
  Trash2,
  Truck,
  Warehouse,
  Wind,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { QrScannerDialog } from "@/components/reception/QrScannerDialog";
import {
  useCreateStorageReading,
  useCreateZone,
  useCreateLocation,
  useDeleteLocation,
  useDeleteZone,
  useModule3StorageLocations,
  useModule3StorageZones,
  useMoveStorageStock,
  useStorageConditionReadings,
  useStorageDlcAlerts,
  useStorageDoorEvents,
  useStorageLocationMovements,
  useUpdateLocation,
  useUpdateZone,
} from "@/hooks/useStorageModule3";
import { useMoveReceptionLotToStorage, useRawStorageOverdueReceptions } from "@/hooks/useReceptionsV2";
import { useAllReceptionLots, useInventoryCounts } from "@/hooks/useStock";
import { cn } from "@/lib/utils";
import { storageMovementReasonLabels, storageMovementTypeLabels } from "@/types/storage";
import type {
  Module3StorageZone,
  StorageConditionStatus,
  StorageLocationStatus,
  StorageMovementReason,
  StorageMovementType,
} from "@/types/storage";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v?: string | null) => {
  if (!v) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
};

const fmtNum = (v?: number | null, unit = "") => {
  if (v == null || Number.isNaN(v)) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)}${unit}`;
};

const fmtRelative = (date: Date) => {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 10) return "à l'instant";
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  return `il y a ${Math.floor(m / 60)} h`;
};

const occupancy = (cur = 0, cap = 0) => cap > 0 ? Math.min(100, Math.round((cur / cap) * 1000) / 10) : 0;

const zoneOccupancy = (z: Module3StorageZone, actualKg?: number) => {
  const loadKg = actualKg ?? z.current_load_kg;
  if ((z.capacity_palettes ?? 0) > 0 && (z.current_load_palettes ?? 0) > 0)
    return occupancy(z.current_load_palettes ?? 0, z.capacity_palettes ?? 0);
  if (z.capacity_kg > 0)
    return occupancy(loadKg, z.capacity_kg);
  return 0;
};

const zoneIcon = (z: Module3StorageZone) => {
  if (z.storage_family === "cold") return <Snowflake className="h-3.5 w-3.5" />;
  if (z.storage_family === "fumigation") return <Factory className="h-3.5 w-3.5" />;
  if (z.storage_family === "export") return <Package className="h-3.5 w-3.5" />;
  if (z.storage_family === "reception") return <Wind className="h-3.5 w-3.5" />;
  return <Warehouse className="h-3.5 w-3.5" />;
};

const conditionCls = (s?: StorageConditionStatus) =>
  s === "critical" ? "border-red-200 bg-red-50 text-red-700"
  : s === "warning" ? "border-amber-200 bg-amber-50 text-amber-700"
  : "border-emerald-200 bg-emerald-50 text-emerald-700";

const locationStatusCls = (s: StorageLocationStatus) =>
  s === "blocked" ? "border-red-200 bg-red-50 text-red-700"
  : s === "reserved" ? "border-sky-200 bg-sky-50 text-sky-700"
  : s === "occupied" ? "border-amber-200 bg-amber-50 text-amber-700"
  : "border-emerald-200 bg-emerald-50 text-emerald-700";

const stockStatusCls: Record<string, string> = {
  STOCK_LIBERE:   "border-emerald-200 bg-emerald-50 text-emerald-700",
  EN_QUARANTAINE: "border-amber-200 bg-amber-50 text-amber-700",
  STOCK_REJETE:   "border-red-200 bg-red-50 text-red-700",
  NON_STOCKE:     "border-slate-200 bg-slate-50 text-slate-600",
};

const stockStatusLabel: Record<string, string> = {
  STOCK_LIBERE:   "Libéré",
  EN_QUARANTAINE: "Quarantaine",
  STOCK_REJETE:   "Rejeté",
  NON_STOCKE:     "Non affecté",
};

const familyLabel: Record<string, string> = {
  reception: "Réception",
  raw:       "Stockage brut",
  cold:      "Chambre froide",
  fumigation:"Fumigation",
  export:    "Export",
};

const locationStatusLabel: Record<StorageLocationStatus, string> = {
  free:     "Libre",
  occupied: "Occupé",
  reserved: "Réservé",
  blocked:  "Bloqué",
};

const normalizeQr = (raw: string): string => {
  const v = raw.trim();
  if (!v) return "";
  try {
    const p = JSON.parse(v) as Record<string, unknown>;
    const c = p.lot_internal ?? p.lot_id ?? p.lot_code ?? p.lot_number ?? p.sscc;
    if (c) return String(c).split("|")[0].trim();
  } catch { /* not JSON */ }
  try {
    const u = new URL(v);
    const c = u.searchParams.get("lot") ?? u.searchParams.get("lotId") ?? u.searchParams.get("lot_id");
    if (c) return c;
  } catch { /* not URL */ }
  return v.split("|")[0].trim();
};

// ── Sub-components ────────────────────────────────────────────────────────────

const KpiTile = ({ label, value, sub, icon: Icon, tone = "default" }: {
  label: string; value: string | number; sub: string;
  icon: typeof Warehouse;
  tone?: "default" | "amber" | "red" | "emerald";
}) => {
  const iconCls = {
    default: "bg-primary/10 text-primary",
    amber:   "bg-amber-100 text-amber-700",
    red:     "bg-red-100 text-red-700",
    emerald: "bg-emerald-100 text-emerald-700",
  }[tone];
  return (
    <Card className="rounded-2xl border-border/60">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-bold text-foreground">{value}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconCls)}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
};

const OccupancyBar = ({ pct, className }: { pct: number; className?: string }) => (
  <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-border/40", className)}>
    <div
      className={cn(
        "h-full rounded-full transition-all duration-500",
        pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500",
      )}
      style={{ width: `${pct}%` }}
    />
  </div>
);

interface StorageZonesOverviewProps {
  canManage?: boolean;
  defaultTab?: string;
}

export const StorageZonesOverview = ({ canManage = true, defaultTab = "dashboard" }: StorageZonesOverviewProps) => {
  const [tab, setTab] = useState(defaultTab === "lots" ? "lots" : defaultTab === "movements" ? "mouvements" : "dashboard");
  const [lotSearch, setLotSearch] = useState("");
  const [lotStatusFilter, setLotStatusFilter] = useState("all");
  const [selectedZoneId, setSelectedZoneId] = useState("all");
  const [locationSearch, setLocationSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date>(new Date());

  // ── Assign lot dialog ─────────────────────────────────────────────────────
  const [assignLot, setAssignLot] = useState<null | { id: string; lot_internal?: string; variety?: string; quantity?: number; unit?: string; stock_status?: string }>(null);
  const [assignZone, setAssignZone] = useState("");
  const [assignBy, setAssignBy] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const moveLot = useMoveReceptionLotToStorage();

  const handleAssign = useCallback(async () => {
    if (!assignLot || !assignZone || !assignBy) return;
    await moveLot.mutateAsync({
      lotId: assignLot.id,
      targetZone: assignZone,
      performedBy: assignBy,
      notes: assignNotes || undefined,
      _lotStockStatus: assignLot.stock_status ?? "STOCK_LIBERE",
      _receptionStatus: "VALIDE",
    });
    setAssignLot(null);
    setAssignZone("");
    setAssignBy("");
    setAssignNotes("");
    setLastSyncAt(new Date());
  }, [assignLot, assignZone, assignBy, assignNotes, moveLot]);

  // ── Movement form ─────────────────────────────────────────────────────────
  const [mvtForm, setMvtForm] = useState({
    movementType: "TRANSFERT" as StorageMovementType,
    sourceLocationId: "none",
    destinationLocationId: "",
    destinationZoneId: "none",
    lotCode: "",
    variety: "",
    quantityPalettes: "1",
    quantityKg: "",
    reason: "RECEPTION" as StorageMovementReason,
    notes: "",
  });

  // ── Reading form ──────────────────────────────────────────────────────────
  const [readingForm, setReadingForm] = useState({
    storageZoneId: "",
    temperatureC: "",
    humidityPercent: "",
    gasPpm: "",
    sensorRef: "",
  });

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: zones = [], isLoading: zonesLoading, refetch: refetchZones } = useModule3StorageZones();
  const { data: allLocations = [], refetch: refetchLocations } = useModule3StorageLocations();
  const { data: locations = [] } = useModule3StorageLocations(selectedZoneId === "all" ? undefined : selectedZoneId);
  const { data: readings = [] } = useStorageConditionReadings(80);
  const { data: movements = [], refetch: refetchMovements } = useStorageLocationMovements(100);
  const { data: rawOverdue = [] } = useRawStorageOverdueReceptions();
  const { data: dlcAlerts = [] } = useStorageDlcAlerts();
  const { data: doorEvents = [] } = useStorageDoorEvents(30);
  const { data: allLots = [], isLoading: lotsLoading, refetch: refetchLots } = useAllReceptionLots();
  const { data: inventoryCounts = [] } = useInventoryCounts();

  const moveStock = useMoveStorageStock();
  const createReading = useCreateStorageReading();
  const createZone = useCreateZone();
  const updateZone = useUpdateZone();
  const deleteZone = useDeleteZone();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();

  // ── Zone/Location management dialogs ─────────────────────────────────────
  type ZoneFormData = {
    code: string; name: string; storage_family: string;
    capacity_kg: string; capacity_palettes: string;
    temperature_min: string; temperature_max: string;
    humidity_min: string; humidity_max: string;
    is_bio_only: boolean; notes: string; is_active: boolean;
  };
  const emptyZoneForm: ZoneFormData = {
    code: "", name: "", storage_family: "raw",
    capacity_kg: "", capacity_palettes: "",
    temperature_min: "", temperature_max: "",
    humidity_min: "", humidity_max: "",
    is_bio_only: false, notes: "", is_active: true,
  };
  const [zoneDialog, setZoneDialog] = useState<{ open: boolean; editing: Module3StorageZone | null }>({ open: false, editing: null });
  const [zoneForm, setZoneForm] = useState<ZoneFormData>(emptyZoneForm);
  const [deleteZoneConfirm, setDeleteZoneConfirm] = useState<Module3StorageZone | null>(null);

  type LocFormData = {
    code: string; name: string; storage_zone_id: string;
    capacity_palettes: string; capacity_kg: string; is_active: boolean;
  };
  const emptyLocForm: LocFormData = { code: "", name: "", storage_zone_id: "", capacity_palettes: "", capacity_kg: "", is_active: true };
  const [locDialog, setLocDialog] = useState<{ open: boolean; editing: typeof allLocations[0] | null }>({ open: false, editing: null });
  const [locForm, setLocForm] = useState<LocFormData>(emptyLocForm);
  const [deleteLocConfirm, setDeleteLocConfirm] = useState<typeof allLocations[0] | null>(null);
  const [mgmtZoneFilter, setMgmtZoneFilter] = useState("all");

  const openZoneCreate = useCallback(() => {
    setZoneForm(emptyZoneForm);
    setZoneDialog({ open: true, editing: null });
  }, []);

  const openZoneEdit = useCallback((z: Module3StorageZone) => {
    setZoneForm({
      code: z.code, name: z.name, storage_family: z.storage_family ?? "raw",
      capacity_kg: String(z.capacity_kg ?? ""), capacity_palettes: String(z.capacity_palettes ?? ""),
      temperature_min: z.temperature_min != null ? String(z.temperature_min) : "",
      temperature_max: z.temperature_max != null ? String(z.temperature_max) : "",
      humidity_min: z.humidity_min != null ? String(z.humidity_min) : "",
      humidity_max: z.humidity_max != null ? String(z.humidity_max) : "",
      is_bio_only: z.is_bio_only ?? false,
      notes: z.notes ?? "", is_active: z.is_active,
    });
    setZoneDialog({ open: true, editing: z });
  }, []);

  const handleZoneSubmit = useCallback(async () => {
    const payload = {
      code: zoneForm.code.trim().toUpperCase(),
      name: zoneForm.name.trim(),
      storage_family: zoneForm.storage_family,
      capacity_kg: Number(zoneForm.capacity_kg) || 0,
      capacity_palettes: zoneForm.capacity_palettes ? Number(zoneForm.capacity_palettes) : undefined,
      temperature_min: zoneForm.temperature_min ? Number(zoneForm.temperature_min) : null,
      temperature_max: zoneForm.temperature_max ? Number(zoneForm.temperature_max) : null,
      humidity_min: zoneForm.humidity_min ? Number(zoneForm.humidity_min) : null,
      humidity_max: zoneForm.humidity_max ? Number(zoneForm.humidity_max) : null,
      is_bio_only: zoneForm.is_bio_only,
      notes: zoneForm.notes || undefined,
      is_active: zoneForm.is_active,
    };
    if (zoneDialog.editing) {
      await updateZone.mutateAsync(zoneDialog.editing.id, payload);
    } else {
      await createZone.mutateAsync(payload);
    }
    setZoneDialog({ open: false, editing: null });
    setLastSyncAt(new Date());
  }, [zoneForm, zoneDialog.editing, updateZone, createZone]);

  const openLocCreate = useCallback(() => {
    setLocForm(emptyLocForm);
    setLocDialog({ open: true, editing: null });
  }, []);

  const openLocEdit = useCallback((l: typeof allLocations[0]) => {
    setLocForm({
      code: l.code, name: l.name, storage_zone_id: l.storage_zone_id ?? "",
      capacity_palettes: String(l.capacity_palettes ?? ""),
      capacity_kg: String(l.capacity_kg ?? ""),
      is_active: l.is_active,
    });
    setLocDialog({ open: true, editing: l });
  }, []);

  const handleLocSubmit = useCallback(async () => {
    const payload = {
      code: locForm.code.trim().toUpperCase(),
      name: locForm.name.trim(),
      storage_zone_id: locForm.storage_zone_id,
      capacity_palettes: Number(locForm.capacity_palettes) || 0,
      capacity_kg: locForm.capacity_kg ? Number(locForm.capacity_kg) : undefined,
      is_active: locForm.is_active,
    };
    if (locDialog.editing) {
      await updateLocation.mutateAsync(locDialog.editing.id, payload);
    } else {
      await createLocation.mutateAsync(payload);
    }
    setLocDialog({ open: false, editing: null });
    setLastSyncAt(new Date());
  }, [locForm, locDialog.editing, updateLocation, createLocation]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const unplacedLots = useMemo(
    () => allLots.filter(l => l.stock_status === "STOCK_LIBERE" && !l.storage_zone_code),
    [allLots],
  );

  const filteredLots = useMemo(() => {
    const q = lotSearch.trim().toLowerCase();
    return allLots.filter(l => {
      const matchStatus = lotStatusFilter === "all" || l.stock_status === lotStatusFilter;
      const matchSearch = !q || [l.lot_internal, l.lot_supplier, l.variety, l.storage_zone_code]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [allLots, lotSearch, lotStatusFilter]);

  const filteredLocations = useMemo(() => {
    const q = locationSearch.trim().toLowerCase();
    const list = selectedZoneId === "all" ? allLocations : locations;
    if (!q) return list;
    return list.filter(l => [l.code, l.name, l.zone_code, ...(l.lot_ids_present ?? [])]
      .join(" ").toLowerCase().includes(q));
  }, [allLocations, locations, selectedZoneId, locationSearch]);

  // Aggregate actual lot kg per zone from lot data (more accurate than stale backend field)
  const zoneLoadsKg = useMemo(() => {
    const map = new Map<string, number>();
    for (const lot of allLots) {
      if (lot.storage_zone_code && lot.stock_status !== "STOCK_REJETE") {
        map.set(lot.storage_zone_code, (map.get(lot.storage_zone_code) ?? 0) + (lot.quantity ?? 0));
      }
    }
    return map;
  }, [allLots]);

  const globalOccupancy = useMemo(() => {
    const pcts = zones.map(z => zoneOccupancy(z, zoneLoadsKg.get(z.code)));
    return pcts.length > 0 ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : 0;
  }, [zones, zoneLoadsKg]);

  const liberatedKg = useMemo(
    () => allLots.filter(l => l.stock_status === "STOCK_LIBERE").reduce((s, l) => s + (l.quantity ?? 0), 0),
    [allLots],
  );
  const quarantineCount = useMemo(
    () => allLots.filter(l => l.stock_status === "EN_QUARANTAINE").length,
    [allLots],
  );

  // Lot counts per zone code (for zone cards and gestion table)
  const lotCountByZone = useMemo(() => {
    const map = new Map<string, number>();
    for (const lot of allLots) {
      if (lot.storage_zone_code && lot.stock_status !== "STOCK_REJETE") {
        map.set(lot.storage_zone_code, (map.get(lot.storage_zone_code) ?? 0) + 1);
      }
    }
    return map;
  }, [allLots]);

  // Manufacturing pipeline: lots in each production stage
  const mfgStages = useMemo(() => {
    const raw      = allLots.filter(l => l.storage_zone_code && zones.find(z => z.code === l.storage_zone_code)?.storage_family === "raw");
    const cold     = allLots.filter(l => l.storage_zone_code && zones.find(z => z.code === l.storage_zone_code)?.storage_family === "cold");
    const fum      = allLots.filter(l => l.storage_zone_code && zones.find(z => z.code === l.storage_zone_code)?.storage_family === "fumigation");
    const expReady = allLots.filter(l => l.storage_zone_code && zones.find(z => z.code === l.storage_zone_code)?.storage_family === "export");
    const waiting  = allLots.filter(l => !l.storage_zone_code && l.stock_status === "STOCK_LIBERE");
    return { raw, cold, fum, expReady, waiting };
  }, [allLots, zones]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchZones(), refetchLocations(), refetchMovements(), refetchLots()]);
    setLastSyncAt(new Date());
  }, [refetchZones, refetchLocations, refetchMovements, refetchLots]);

  const handleMovementSubmit = useCallback(async () => {
    if (!mvtForm.lotCode || !mvtForm.destinationLocationId) return;
    await moveStock.mutateAsync({
      sourceLocationId: mvtForm.sourceLocationId === "none" ? undefined : mvtForm.sourceLocationId,
      destinationLocationId: mvtForm.destinationLocationId,
      destinationZoneId: mvtForm.destinationZoneId === "none" ? undefined : mvtForm.destinationZoneId,
      lotCode: mvtForm.lotCode,
      variety: mvtForm.variety || undefined,
      quantityPalettes: Number(mvtForm.quantityPalettes) || 1,
      quantityKg: mvtForm.quantityKg ? Number(mvtForm.quantityKg) : undefined,
      movementType: mvtForm.movementType,
      reason: mvtForm.reason,
      notes: mvtForm.notes || undefined,
    } as any);
    setMvtForm(f => ({ ...f, lotCode: "", variety: "", quantityPalettes: "1", quantityKg: "", notes: "" }));
    setLastSyncAt(new Date());
  }, [mvtForm, moveStock]);

  const handleReadingSubmit = useCallback(async () => {
    if (!readingForm.storageZoneId || !readingForm.temperatureC) return;
    const zone = zones.find(z => z.id === readingForm.storageZoneId);
    await createReading.mutateAsync({
      storageZoneId: readingForm.storageZoneId,
      zoneCode: zone?.code ?? "",
      temperatureC: Number(readingForm.temperatureC),
      humidityPercent: readingForm.humidityPercent ? Number(readingForm.humidityPercent) : undefined,
      gasPpm: readingForm.gasPpm ? Number(readingForm.gasPpm) : undefined,
      sensorRef: readingForm.sensorRef || undefined,
      recordedBy: "operateur",
    });
    setReadingForm(f => ({ ...f, temperatureC: "", humidityPercent: "", gasPpm: "", sensorRef: "" }));
    setLastSyncAt(new Date());
  }, [readingForm, zones, createReading]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion du stock</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Suivi des lots, zones de stockage et mouvements en temps réel
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Real-time indicator */}
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            <Zap className="h-3 w-3 text-emerald-600" />
            <span className="text-[11px] font-semibold text-emerald-700">
              Temps réel · {fmtRelative(lastSyncAt)}
            </span>
          </div>
          <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* ── Unplaced lots banner ── */}
      {unplacedLots.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {unplacedLots.length} lot{unplacedLots.length > 1 ? "s" : ""} libéré{unplacedLots.length > 1 ? "s" : ""} sans zone
              </p>
              <p className="text-xs text-amber-700">
                Ces lots ont passé le QC mais ne sont pas encore affectés à un emplacement de stockage.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0 rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => { setTab("lots"); setLotStatusFilter("STOCK_LIBERE"); }}
          >
            Affecter les lots
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Raw overdue alert ── */}
      {rawOverdue.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-800">
              {rawOverdue.length} réception{rawOverdue.length > 1 ? "s" : ""} en stockage brut depuis plus de 48h
            </p>
            <p className="text-xs text-red-700">Affecter à fumigation dès que possible (règle RG-S10)</p>
          </div>
        </div>
      )}

      {/* ── DLC alerts ── */}
      {dlcAlerts.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <Clock className="h-5 w-5 shrink-0 text-rose-600" />
          <p className="text-sm text-rose-800">
            <span className="font-semibold">{dlcAlerts.length} alerte{dlcAlerts.length > 1 ? "s" : ""} DLC :</span>{" "}
            {dlcAlerts.slice(0, 2).map(a => a.title).join(" · ")}
            {dlcAlerts.length > 2 && ` +${dlcAlerts.length - 2} autres`}
          </p>
        </div>
      )}

      {/* ── Main tabs ── */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1 rounded-2xl bg-muted/60 p-1">
          {[
            { id: "dashboard",  label: "Tableau de bord",       icon: Activity },
            { id: "lots",       label: "Lots en stock",          icon: BoxIcon },
            { id: "zones",      label: "Zones & emplacements",   icon: MapPin },
            { id: "mouvements", label: "Mouvements",             icon: ArrowRightLeft },
            { id: "conditions", label: "Conditions",             icon: Thermometer },
            ...(canManage ? [{ id: "gestion", label: "Gestion", icon: Settings2 }] : []),
          ].map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(" ")[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ════════════════════════════════════════════════
            TAB 1 — DASHBOARD
        ════════════════════════════════════════════════ */}
        <TabsContent value="dashboard" className="space-y-5">
          {/* KPI row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile
              label="Stock libéré"
              value={fmtNum(liberatedKg, " kg")}
              sub={`${allLots.filter(l => l.stock_status === "STOCK_LIBERE").length} lots disponibles`}
              icon={CheckCircle2}
              tone="emerald"
            />
            <KpiTile
              label="Quarantaine"
              value={quarantineCount}
              sub="Lots bloqués en attente décision"
              icon={ShieldAlert}
              tone="amber"
            />
            <KpiTile
              label="Occupation globale"
              value={`${globalOccupancy}%`}
              sub={`${zones.length} zones actives`}
              icon={Warehouse}
              tone={globalOccupancy >= 90 ? "red" : globalOccupancy >= 70 ? "amber" : "default"}
            />
            <KpiTile
              label="Alertes actives"
              value={dlcAlerts.length + rawOverdue.length}
              sub={rawOverdue.length > 0 ? `${rawOverdue.length} retards brut` : "Aucun retard critique"}
              icon={AlertTriangle}
              tone={dlcAlerts.length + rawOverdue.length > 0 ? "red" : "default"}
            />
          </div>

          {/* Zone occupancy grid */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Warehouse className="h-4 w-4 text-primary" />
                Occupation par zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              {zonesLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Chargement…</div>
              ) : zones.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Aucune zone configurée</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {zones.map(z => {
                    const pct = zoneOccupancy(z, zoneLoadsKg.get(z.code));
                    return (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => { setSelectedZoneId(z.id); setTab("zones"); }}
                        className="group flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                              conditionCls(z.condition_status),
                            )}>
                              {zoneIcon(z)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{z.code}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{familyLabel[z.storage_family] ?? z.storage_family}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-lg font-bold text-foreground">{pct}%</span>
                        </div>
                        <OccupancyBar pct={pct} />
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          {(z.capacity_palettes ?? 0) > 0 && (z.current_load_palettes ?? 0) > 0
                            ? <span>{fmtNum(z.current_load_palettes)} / {fmtNum(z.capacity_palettes)} pal.</span>
                            : <span>{fmtNum(zoneLoadsKg.get(z.code) ?? z.current_load_kg, " kg")} / {fmtNum(z.capacity_kg, " kg")}</span>
                          }
                          <div className="flex items-center gap-2">
                            {(lotCountByZone.get(z.code) ?? 0) > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Package className="h-3 w-3" />
                                {lotCountByZone.get(z.code)} lot{(lotCountByZone.get(z.code) ?? 0) > 1 ? "s" : ""}
                              </span>
                            )}
                            {z.current_temperature_c != null && (
                              <span className="flex items-center gap-1">
                                <Thermometer className="h-3 w-3" />
                                {z.current_temperature_c}°C
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent movements */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRightLeft className="h-4 w-4 text-primary" />
                Derniers mouvements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {movements.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aucun mouvement enregistré</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {movements.slice(0, 6).map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                        <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {storageMovementTypeLabels[m.movement_type as StorageMovementType] ?? m.movement_type}
                          {m.lot_code && <span className="ml-2 font-normal text-muted-foreground">· {m.lot_code}</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.source_zone_code ?? m.source_location_code ?? "—"}
                          {m.destination_zone_code && <> → {m.destination_zone_code}</>}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{fmt(m.movement_date)}</span>
                    </div>
                  ))}
                </div>
              )}
              {movements.length > 6 && (
                <div className="border-t border-border/40 px-4 py-2.5">
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={() => setTab("mouvements")}
                  >
                    Voir tous les mouvements ({movements.length}) →
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inventory counts */}
          {inventoryCounts.length > 0 && (
            <Card className="rounded-2xl border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Inventaires récents
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>N° inventaire</TableHead>
                      <TableHead>Emplacement</TableHead>
                      <TableHead className="text-right">Qté attendue</TableHead>
                      <TableHead className="text-right">Qté comptée</TableHead>
                      <TableHead className="text-right">Écart</TableHead>
                      <TableHead>Réalisé par</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryCounts.slice(0, 5).map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.count_number ?? c.id?.slice(-6)}</TableCell>
                        <TableCell className="text-xs">{c.location_code ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{fmtNum(c.expected_quantity)}</TableCell>
                        <TableCell className="text-right text-xs">{fmtNum(c.counted_quantity)}</TableCell>
                        <TableCell className={cn("text-right text-xs font-semibold", (c.variance ?? 0) !== 0 ? "text-red-600" : "text-emerald-600")}>
                          {c.variance != null ? (c.variance > 0 ? `+${c.variance}` : c.variance) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.performed_by ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ── Manufacturing pipeline ── */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Factory className="h-4 w-4 text-primary" />
                Flux de fabrication — lots en cours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {([
                  { key: "waiting",  label: "En attente",    icon: Clock,     color: "bg-slate-100 text-slate-700 border-slate-200",  lots: mfgStages.waiting },
                  { key: "raw",      label: "Stockage brut", icon: Warehouse,  color: "bg-amber-50 text-amber-800 border-amber-200",   lots: mfgStages.raw },
                  { key: "cold",     label: "Chambre froide", icon: Snowflake, color: "bg-sky-50 text-sky-800 border-sky-200",         lots: mfgStages.cold },
                  { key: "fum",      label: "Fumigation",     icon: Wind,      color: "bg-purple-50 text-purple-800 border-purple-200", lots: mfgStages.fum },
                  { key: "expReady", label: "Prêt export",   icon: Truck,     color: "bg-emerald-50 text-emerald-800 border-emerald-200", lots: mfgStages.expReady },
                ] as Array<{ key: string; label: string; icon: typeof Clock; color: string; lots: typeof allLots }>).map(({ key, label, icon: Icon, color, lots }) => (
                  <div key={key} className={cn("flex flex-col gap-2 rounded-xl border p-3.5", color.split(" ").slice(2).join(" "))}>
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4 shrink-0", color.split(" ").slice(1, 2).join(" "))} />
                      <span className={cn("text-[11px] font-semibold uppercase tracking-[0.15em]", color.split(" ").slice(1, 2).join(" "))}>{label}</span>
                    </div>
                    <p className={cn("text-2xl font-bold", color.split(" ").slice(1, 2).join(" "))}>{lots.length}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {lots.reduce((s, l) => s + (l.quantity ?? 0), 0).toLocaleString("fr-FR")} kg
                    </p>
                    {lots.length > 0 && (
                      <div className="space-y-1 border-t border-current/10 pt-2">
                        {lots.slice(0, 3).map(l => (
                          <p key={l.id} className="truncate text-[11px] text-muted-foreground">
                            {l.lot_internal ?? l.lot_supplier ?? l.id?.slice(-6)} · {fmtNum(l.quantity, " kg")}
                          </p>
                        ))}
                        {lots.length > 3 && (
                          <p className="text-[11px] font-medium text-muted-foreground">+{lots.length - 3} autres</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════
            TAB 2 — LOTS EN STOCK
        ════════════════════════════════════════════════ */}
        <TabsContent value="lots" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Input
                placeholder="Rechercher un lot, variété, zone…"
                value={lotSearch}
                onChange={e => setLotSearch(e.target.value)}
                className="rounded-xl pl-9"
              />
              <Eye className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            </div>
            <Select value={lotStatusFilter} onValueChange={setLotStatusFilter}>
              <SelectTrigger className="w-full rounded-xl sm:w-48">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="STOCK_LIBERE">Libéré</SelectItem>
                <SelectItem value="EN_QUARANTAINE">Quarantaine</SelectItem>
                <SelectItem value="STOCK_REJETE">Rejeté</SelectItem>
                <SelectItem value="NON_STOCKE">Non affecté</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            {filteredLots.length} lot{filteredLots.length !== 1 ? "s" : ""}
            {lotStatusFilter !== "all" ? ` · filtre: ${stockStatusLabel[lotStatusFilter]}` : ""}
          </p>

          {/* Table */}
          <Card className="rounded-2xl border-border/60">
            <CardContent className="p-0">
              {lotsLoading ? (
                <div className="py-16 text-center text-sm text-muted-foreground">Chargement des lots…</div>
              ) : filteredLots.length === 0 ? (
                <div className="py-16 text-center">
                  <BoxIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Aucun lot correspondant</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Lot interne</TableHead>
                        <TableHead>Fournisseur</TableHead>
                        <TableHead>Variété</TableHead>
                        <TableHead className="text-right">Qté</TableHead>
                        <TableHead>Zone stockage</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date entrée</TableHead>
                        {canManage && <TableHead />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLots.slice(0, 300).map(lot => (
                        <TableRow key={lot.id} className="group">
                          <TableCell className="font-mono text-xs font-semibold">{lot.lot_internal ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{lot.lot_supplier ?? "—"}</TableCell>
                          <TableCell className="text-xs">{lot.variety ?? "—"}</TableCell>
                          <TableCell className="text-right text-xs">{fmtNum(lot.quantity, ` ${lot.unit ?? "kg"}`)}</TableCell>
                          <TableCell>
                            {lot.storage_zone_code ? (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-mono">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {lot.storage_zone_code}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("rounded-full text-[11px]", stockStatusCls[lot.stock_status ?? ""] ?? "border-slate-200 bg-slate-50 text-slate-600")}>
                              {stockStatusLabel[lot.stock_status ?? ""] ?? lot.stock_status ?? "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmt(lot.created_at)}</TableCell>
                          {canManage && (
                            <TableCell>
                              {(!lot.storage_zone_code || lot.stock_status === "STOCK_LIBERE") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 rounded-lg text-xs opacity-0 transition-opacity group-hover:opacity-100"
                                  onClick={() => setAssignLot(lot)}
                                >
                                  <Truck className="mr-1 h-3 w-3" />
                                  Affecter
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          {filteredLots.length > 300 && (
            <p className="text-center text-xs text-muted-foreground">
              Affichage limité à 300 lots · {filteredLots.length - 300} non affichés · Affinez le filtre.
            </p>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════
            TAB 3 — ZONES & EMPLACEMENTS
        ════════════════════════════════════════════════ */}
        <TabsContent value="zones" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
              <SelectTrigger className="w-full rounded-xl sm:w-56">
                <SelectValue placeholder="Toutes les zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les zones</SelectItem>
                {zones.map(z => (
                  <SelectItem key={z.id} value={z.id}>{z.code} — {z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Input
                placeholder="Rechercher un emplacement, code lot…"
                value={locationSearch}
                onChange={e => setLocationSearch(e.target.value)}
                className="rounded-xl pl-9"
              />
              <Eye className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            </div>
          </div>

          {/* Zone summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(selectedZoneId === "all" ? zones : zones.filter(z => z.id === selectedZoneId)).map(z => {
              const pct = zoneOccupancy(z, zoneLoadsKg.get(z.code));
              return (
                <Card key={z.id} className="rounded-2xl border-border/60">
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl border", conditionCls(z.condition_status))}>
                          {zoneIcon(z)}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{z.code}</p>
                          <p className="text-xs text-muted-foreground">{familyLabel[z.storage_family] ?? z.storage_family}</p>
                        </div>
                      </div>
                      <Badge className={cn("rounded-full text-[11px]", conditionCls(z.condition_status))}>
                        {z.condition_status === "critical" ? "Critique" : z.condition_status === "warning" ? "À surveiller" : "Normal"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Occupation {(z.capacity_palettes ?? 0) > 0 ? "palettes" : "en poids"}</span>
                        <span className="font-semibold text-foreground">{pct}%</span>
                      </div>
                      <OccupancyBar pct={pct} />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        {(z.capacity_palettes ?? 0) > 0 && (z.current_load_palettes ?? 0) > 0
                          ? <span>{fmtNum(z.current_load_palettes)} / {fmtNum(z.capacity_palettes)} palettes</span>
                          : <span>{fmtNum(zoneLoadsKg.get(z.code) ?? z.current_load_kg, " kg")} / {fmtNum(z.capacity_kg, " kg")}</span>
                        }
                        {(z.capacity_palettes ?? 0) > 0 && (z.current_load_palettes ?? 0) > 0 && z.capacity_kg > 0 && (
                          <span>{fmtNum(zoneLoadsKg.get(z.code) ?? z.current_load_kg, " kg")} / {fmtNum(z.capacity_kg, " kg")}</span>
                        )}
                      </div>
                    </div>
                    {(z.current_temperature_c != null || z.temperature_min != null) && (
                      <div className="flex flex-wrap gap-2 border-t border-border/40 pt-2">
                        {z.current_temperature_c != null && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Thermometer className="h-3 w-3" />
                            {z.current_temperature_c}°C
                          </span>
                        )}
                        {z.temperature_min != null && (
                          <span className="text-xs text-muted-foreground">
                            Consigne: {z.temperature_min}–{z.temperature_max}°C
                          </span>
                        )}
                      </div>
                    )}
                    {z.condition_messages && z.condition_messages.length > 0 && (
                      <p className="text-xs text-amber-700">{z.condition_messages[0]}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Locations table */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                Emplacements
                <span className="ml-1 text-sm font-normal text-muted-foreground">({filteredLocations.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredLocations.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Aucun emplacement trouvé</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Code</TableHead>
                        <TableHead>Zone</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Occupation</TableHead>
                        <TableHead>Lots présents</TableHead>
                        <TableHead>Temp / Hum</TableHead>
                        <TableHead>Dernier mvt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLocations.slice(0, 250).map(loc => {
                        const pct = occupancy(loc.occupied_palettes, loc.capacity_palettes);
                        return (
                          <TableRow key={loc.id}>
                            <TableCell className="font-mono text-xs font-semibold">{loc.code}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{loc.zone_code}</TableCell>
                            <TableCell>
                              <Badge className={cn("rounded-full text-[11px]", locationStatusCls(loc.location_status))}>
                                {locationStatusLabel[loc.location_status]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <OccupancyBar pct={pct} className="w-16" />
                                <span className="w-10 text-right text-xs font-semibold">{pct}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {loc.lot_ids_present?.length > 0
                                ? loc.lot_ids_present.slice(0, 2).join(", ") + (loc.lot_ids_present.length > 2 ? ` +${loc.lot_ids_present.length - 2}` : "")
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {loc.current_temperature_c != null ? `${loc.current_temperature_c}°C` : "—"}
                              {loc.current_humidity_percent != null ? ` · ${loc.current_humidity_percent}%` : ""}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{fmt(loc.last_movement_at)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════
            TAB 4 — MOUVEMENTS
        ════════════════════════════════════════════════ */}
        <TabsContent value="mouvements">
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            {/* Form */}
            {canManage && (
              <Card className="h-fit rounded-2xl border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ArrowRightLeft className="h-4 w-4 text-primary" />
                    Enregistrer un mouvement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type de mouvement</Label>
                    <Select
                      value={mvtForm.movementType}
                      onValueChange={v => setMvtForm(f => ({ ...f, movementType: v as StorageMovementType }))}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(storageMovementTypeLabels).map(([k, label]) => (
                          <SelectItem key={k} value={k}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Code du lot <span className="text-destructive">*</span></Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="LOT-2024-001"
                        value={mvtForm.lotCode}
                        onChange={e => setMvtForm(f => ({ ...f, lotCode: e.target.value }))}
                        className="rounded-xl"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0 rounded-xl"
                        onClick={() => setScannerOpen(true)}
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Emplacement source</Label>
                    <Select
                      value={mvtForm.sourceLocationId}
                      onValueChange={v => setMvtForm(f => ({ ...f, sourceLocationId: v }))}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun (entrée externe)</SelectItem>
                        {allLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.code} — {l.zone_code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Emplacement destination <span className="text-destructive">*</span></Label>
                    <Select
                      value={mvtForm.destinationLocationId}
                      onValueChange={v => {
                        const loc = allLocations.find(l => l.id === v);
                        const zone = zones.find(z => z.code === loc?.zone_code);
                        setMvtForm(f => ({ ...f, destinationLocationId: v, destinationZoneId: zone?.id ?? "none" }));
                      }}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {allLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.code} — {l.zone_code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Palettes</Label>
                      <Input
                        type="number"
                        min="1"
                        value={mvtForm.quantityPalettes}
                        onChange={e => setMvtForm(f => ({ ...f, quantityPalettes: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantité (kg)</Label>
                      <Input
                        type="number"
                        placeholder="Optionnel"
                        value={mvtForm.quantityKg}
                        onChange={e => setMvtForm(f => ({ ...f, quantityKg: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Motif</Label>
                    <Select
                      value={mvtForm.reason}
                      onValueChange={v => setMvtForm(f => ({ ...f, reason: v as StorageMovementReason }))}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(storageMovementReasonLabels).map(([k, label]) => (
                          <SelectItem key={k} value={k}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="Observations optionnelles…"
                      value={mvtForm.notes}
                      onChange={e => setMvtForm(f => ({ ...f, notes: e.target.value }))}
                      className="min-h-[72px] resize-none rounded-xl"
                    />
                  </div>

                  <Button
                    className="w-full rounded-xl"
                    disabled={!mvtForm.lotCode || !mvtForm.destinationLocationId || moveStock.isPending}
                    onClick={handleMovementSubmit}
                  >
                    {moveStock.isPending ? "Enregistrement…" : "Enregistrer le mouvement"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* History */}
            <Card className="rounded-2xl border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  Journal des mouvements
                  <span className="ml-1 text-sm font-normal text-muted-foreground">({movements.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {movements.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">Aucun mouvement</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>N°</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Lot</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead className="text-right">Qté</TableHead>
                          <TableHead>Motif</TableHead>
                          <TableHead>Opérateur</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.map(m => (
                          <TableRow key={m.id}>
                            <TableCell className="font-mono text-xs">{m.movement_number?.slice(-6) ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{fmt(m.movement_date)}</TableCell>
                            <TableCell>
                              <Badge className="rounded-full text-[11px] border-border/60 bg-muted/40 text-muted-foreground">
                                {storageMovementTypeLabels[m.movement_type as StorageMovementType] ?? m.movement_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{m.lot_code ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{m.source_location_code ?? m.source_zone_code ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{m.destination_location_code ?? m.destination_zone_code ?? "—"}</TableCell>
                            <TableCell className="text-right text-xs">{fmtNum(m.quantity_palettes, " pal.")}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{storageMovementReasonLabels[m.movement_reason as StorageMovementReason] ?? m.reason ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{m.performed_by ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════════
            TAB 5 — CONDITIONS & MONITORING
        ════════════════════════════════════════════════ */}
        <TabsContent value="conditions">
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            {/* Reading form */}
            {canManage && (
              <Card className="h-fit rounded-2xl border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Thermometer className="h-4 w-4 text-primary" />
                    Saisir une lecture
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Zone <span className="text-destructive">*</span></Label>
                    <Select
                      value={readingForm.storageZoneId}
                      onValueChange={v => setReadingForm(f => ({ ...f, storageZoneId: v }))}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Sélectionner une zone" /></SelectTrigger>
                      <SelectContent>
                        {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.code} — {z.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Température °C <span className="text-destructive">*</span></Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="ex: 18.5"
                        value={readingForm.temperatureC}
                        onChange={e => setReadingForm(f => ({ ...f, temperatureC: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Humidité %</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="ex: 65"
                        value={readingForm.humidityPercent}
                        onChange={e => setReadingForm(f => ({ ...f, humidityPercent: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Gaz (ppm)</Label>
                      <Input
                        type="number"
                        placeholder="Optionnel"
                        value={readingForm.gasPpm}
                        onChange={e => setReadingForm(f => ({ ...f, gasPpm: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Réf. capteur</Label>
                      <Input
                        placeholder="SEN-001"
                        value={readingForm.sensorRef}
                        onChange={e => setReadingForm(f => ({ ...f, sensorRef: e.target.value }))}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full rounded-xl"
                    disabled={!readingForm.storageZoneId || !readingForm.temperatureC || createReading.isPending}
                    onClick={handleReadingSubmit}
                  >
                    {createReading.isPending ? "Enregistrement…" : "Enregistrer la lecture"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Readings + door events */}
            <div className="space-y-4">
              <Card className="rounded-2xl border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Thermometer className="h-4 w-4 text-primary" />
                    Historique des lectures
                    <span className="ml-1 text-sm font-normal text-muted-foreground">({readings.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {readings.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Aucune lecture enregistrée</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Date</TableHead>
                            <TableHead>Zone</TableHead>
                            <TableHead>Emplacement</TableHead>
                            <TableHead className="text-right">Temp °C</TableHead>
                            <TableHead className="text-right">Humidité %</TableHead>
                            <TableHead className="text-right">Gaz ppm</TableHead>
                            <TableHead>État</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {readings.slice(0, 60).map(r => (
                            <TableRow key={r.id}>
                              <TableCell className="text-xs text-muted-foreground">{fmt(r.reading_at)}</TableCell>
                              <TableCell className="font-mono text-xs">{r.zone_code ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{r.location_code ?? "—"}</TableCell>
                              <TableCell className="text-right text-xs font-semibold">{fmtNum(r.temperature_c, "°")}</TableCell>
                              <TableCell className="text-right text-xs">{fmtNum(r.humidity_percent, "%")}</TableCell>
                              <TableCell className="text-right text-xs">{fmtNum(r.gas_ppm)}</TableCell>
                              <TableCell>
                                <Badge className={cn("rounded-full text-[11px]", conditionCls(r.condition_status))}>
                                  {r.condition_status === "critical" ? "Critique" : r.condition_status === "warning" ? "Alerte" : "Normal"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Door events */}
              {doorEvents.length > 0 && (
                <Card className="rounded-2xl border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="h-4 w-4 text-primary" />
                      Événements portes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/40">
                      {doorEvents.slice(0, 20).map(e => (
                        <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                            e.event_type === "OPEN"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700",
                          )}>
                            {e.event_type === "OPEN" ? "O" : "F"}
                          </span>
                          <span className="flex-1 text-xs font-medium text-foreground">
                            {e.event_type === "OPEN" ? "Ouverture" : "Fermeture"}
                            <span className="ml-2 font-normal text-muted-foreground">· {e.zone_code ?? "—"}</span>
                          </span>
                          <span className="text-[11px] text-muted-foreground">{fmt(e.event_at)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════════
            TAB 6 — GESTION (zones + emplacements CRUD)
        ════════════════════════════════════════════════ */}
        {canManage && (
          <TabsContent value="gestion" className="space-y-6">

            {/* ── Zones ── */}
            <Card className="rounded-2xl border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Warehouse className="h-4 w-4 text-primary" />
                    Zones de stockage
                    <span className="text-sm font-normal text-muted-foreground">({zones.length})</span>
                  </CardTitle>
                  <Button size="sm" className="gap-1.5 rounded-xl" onClick={openZoneCreate}>
                    <Plus className="h-4 w-4" />
                    Nouvelle zone
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {zones.length === 0 ? (
                  <div className="py-12 text-center">
                    <Warehouse className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Aucune zone configurée</p>
                    <Button size="sm" className="mt-3 rounded-xl" onClick={openZoneCreate}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Créer la première zone
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Code</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>Famille</TableHead>
                          <TableHead className="text-right">Cap. kg</TableHead>
                          <TableHead className="text-right">Cap. palettes</TableHead>
                          <TableHead className="text-right">Lots</TableHead>
                          <TableHead>Temp. consigne</TableHead>
                          <TableHead>Actif</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {zones.map(z => (
                          <TableRow key={z.id} className="group">
                            <TableCell className="font-mono text-xs font-bold">{z.code}</TableCell>
                            <TableCell className="text-sm">{z.name}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2 py-0.5 text-xs">
                                {zoneIcon(z)}
                                {familyLabel[z.storage_family ?? ""] ?? z.storage_family}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs">{fmtNum(z.capacity_kg, " kg")}</TableCell>
                            <TableCell className="text-right text-xs">{z.capacity_palettes ? fmtNum(z.capacity_palettes, " pal.") : "—"}</TableCell>
                            <TableCell className="text-right text-xs">
                              {(lotCountByZone.get(z.code) ?? 0) > 0
                                ? <span className="font-semibold text-foreground">{lotCountByZone.get(z.code)}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {z.temperature_min != null ? `${z.temperature_min}–${z.temperature_max}°C` : "—"}
                            </TableCell>
                            <TableCell>
                              <span className={cn(
                                "inline-flex h-2 w-2 rounded-full",
                                z.is_active ? "bg-emerald-500" : "bg-slate-300",
                              )} />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 rounded-lg"
                                  onClick={() => openZoneEdit(z)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteZoneConfirm(z)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Emplacements ── */}
            <Card className="rounded-2xl border-border/60">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4 text-primary" />
                    Emplacements
                    <span className="text-sm font-normal text-muted-foreground">
                      ({mgmtZoneFilter === "all" ? allLocations.length : allLocations.filter(l => l.storage_zone_id === mgmtZoneFilter).length})
                    </span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={mgmtZoneFilter} onValueChange={setMgmtZoneFilter}>
                      <SelectTrigger className="w-44 rounded-xl">
                        <SelectValue placeholder="Toutes les zones" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes les zones</SelectItem>
                        {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="gap-1.5 rounded-xl" onClick={openLocCreate}>
                      <Plus className="h-4 w-4" />
                      Nouvel emplacement
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {(() => {
                  const locs = mgmtZoneFilter === "all"
                    ? allLocations
                    : allLocations.filter(l => l.storage_zone_id === mgmtZoneFilter);
                  return locs.length === 0 ? (
                    <div className="py-12 text-center">
                      <MapPin className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">Aucun emplacement</p>
                      <Button size="sm" className="mt-3 rounded-xl" onClick={openLocCreate}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        Ajouter un emplacement
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Code</TableHead>
                            <TableHead>Nom</TableHead>
                            <TableHead>Zone</TableHead>
                            <TableHead className="text-right">Cap. palettes</TableHead>
                            <TableHead className="text-right">Cap. kg</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead>Actif</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {locs.map(l => (
                            <TableRow key={l.id} className="group">
                              <TableCell className="font-mono text-xs font-bold">{l.code}</TableCell>
                              <TableCell className="text-sm">{l.name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{l.zone_code ?? "—"}</TableCell>
                              <TableCell className="text-right text-xs">{fmtNum(l.capacity_palettes, " pal.")}</TableCell>
                              <TableCell className="text-right text-xs">{l.capacity_kg ? fmtNum(l.capacity_kg, " kg") : "—"}</TableCell>
                              <TableCell>
                                <Badge className={cn("rounded-full text-[11px]", locationStatusCls(l.location_status))}>
                                  {locationStatusLabel[l.location_status]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className={cn(
                                  "inline-flex h-2 w-2 rounded-full",
                                  l.is_active ? "bg-emerald-500" : "bg-slate-300",
                                )} />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 rounded-lg"
                                    onClick={() => openLocEdit(l)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                                    onClick={() => setDeleteLocConfirm(l)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Assign lot dialog ── */}
      <Dialog open={!!assignLot} onOpenChange={open => !open && setAssignLot(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Affecter le lot à une zone
            </DialogTitle>
          </DialogHeader>
          {assignLot && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
                <p className="font-semibold text-foreground">{assignLot.lot_internal ?? assignLot.id}</p>
                <p className="text-muted-foreground">{assignLot.variety ?? "—"} · {fmtNum(assignLot.quantity, ` ${assignLot.unit ?? "kg"}`)}</p>
              </div>
              <div className="space-y-2">
                <Label>Zone de stockage <span className="text-destructive">*</span></Label>
                <Select value={assignZone} onValueChange={setAssignZone}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choisir une zone" /></SelectTrigger>
                  <SelectContent>
                    {zones.filter(z => z.is_active !== false).map(z => (
                      <SelectItem key={z.id} value={z.code}>
                        {z.code} — {familyLabel[z.storage_family] ?? z.storage_family}
                        {z.current_load_palettes != null && ` (${zoneOccupancy(z, zoneLoadsKg.get(z.code))}% occupé)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Réalisé par <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Nom de l'opérateur"
                  value={assignBy}
                  onChange={e => setAssignBy(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  placeholder="Optionnel"
                  value={assignNotes}
                  onChange={e => setAssignNotes(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setAssignLot(null)}>
              Annuler
            </Button>
            <Button
              className="rounded-xl"
              disabled={!assignZone || !assignBy || moveLot.isPending}
              onClick={handleAssign}
            >
              {moveLot.isPending ? "Affectation…" : "Confirmer l'affectation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── QR scanner ── */}
      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={v => {
          setMvtForm(f => ({ ...f, lotCode: normalizeQr(v) }));
          setScannerOpen(false);
        }}
      />

      {/* ── Zone form dialog ── */}
      <Dialog open={zoneDialog.open} onOpenChange={open => !open && setZoneDialog({ open: false, editing: null })}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-primary" />
              {zoneDialog.editing ? "Modifier la zone" : "Nouvelle zone de stockage"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Code <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="BRT-01"
                  value={zoneForm.code}
                  onChange={e => setZoneForm(f => ({ ...f, code: e.target.value }))}
                  className="rounded-xl uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label>Famille <span className="text-destructive">*</span></Label>
                <Select value={zoneForm.storage_family} onValueChange={v => setZoneForm(f => ({ ...f, storage_family: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(familyLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Zone stockage brut n°1"
                value={zoneForm.name}
                onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Capacité (kg) <span className="text-destructive">*</span></Label>
                <Input type="number" placeholder="50000" value={zoneForm.capacity_kg} onChange={e => setZoneForm(f => ({ ...f, capacity_kg: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Capacité (palettes)</Label>
                <Input type="number" placeholder="Optionnel" value={zoneForm.capacity_palettes} onChange={e => setZoneForm(f => ({ ...f, capacity_palettes: e.target.value }))} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Temp. min (°C)</Label>
                <Input type="number" step="0.1" placeholder="ex: 2" value={zoneForm.temperature_min} onChange={e => setZoneForm(f => ({ ...f, temperature_min: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Temp. max (°C)</Label>
                <Input type="number" step="0.1" placeholder="ex: 8" value={zoneForm.temperature_max} onChange={e => setZoneForm(f => ({ ...f, temperature_max: e.target.value }))} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Humidité min (%)</Label>
                <Input type="number" step="0.1" placeholder="ex: 60" value={zoneForm.humidity_min} onChange={e => setZoneForm(f => ({ ...f, humidity_min: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Humidité max (%)</Label>
                <Input type="number" step="0.1" placeholder="ex: 80" value={zoneForm.humidity_max} onChange={e => setZoneForm(f => ({ ...f, humidity_max: e.target.value }))} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Observations optionnelles…" value={zoneForm.notes} onChange={e => setZoneForm(f => ({ ...f, notes: e.target.value }))} className="min-h-[60px] resize-none rounded-xl" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Zone active</p>
                <p className="text-xs text-muted-foreground">Désactiver pour masquer sans supprimer</p>
              </div>
              <Switch checked={zoneForm.is_active} onCheckedChange={v => setZoneForm(f => ({ ...f, is_active: v }))} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Bio uniquement</p>
                <p className="text-xs text-muted-foreground">Réserve cette zone aux lots certifiés bio</p>
              </div>
              <Switch checked={zoneForm.is_bio_only} onCheckedChange={v => setZoneForm(f => ({ ...f, is_bio_only: v }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setZoneDialog({ open: false, editing: null })}>
              Annuler
            </Button>
            <Button
              className="rounded-xl"
              disabled={!zoneForm.code || !zoneForm.name || !zoneForm.capacity_kg || createZone.isPending || updateZone.isPending}
              onClick={handleZoneSubmit}
            >
              {(createZone.isPending || updateZone.isPending) ? "Enregistrement…" : zoneDialog.editing ? "Enregistrer" : "Créer la zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Zone delete confirm ── */}
      <Dialog open={!!deleteZoneConfirm} onOpenChange={open => !open && setDeleteZoneConfirm(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Supprimer la zone
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Êtes-vous sûr de vouloir supprimer la zone{" "}
            <span className="font-semibold text-foreground">{deleteZoneConfirm?.code}</span> ?
            Cette action est irréversible et supprimera également ses emplacements.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteZoneConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={deleteZone.isPending}
              onClick={async () => {
                if (!deleteZoneConfirm) return;
                await deleteZone.mutateAsync(deleteZoneConfirm.id);
                setDeleteZoneConfirm(null);
              }}
            >
              {deleteZone.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Location form dialog ── */}
      <Dialog open={locDialog.open} onOpenChange={open => !open && setLocDialog({ open: false, editing: null })}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {locDialog.editing ? "Modifier l'emplacement" : "Nouvel emplacement"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Code <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="BRT-01-A"
                  value={locForm.code}
                  onChange={e => setLocForm(f => ({ ...f, code: e.target.value }))}
                  className="rounded-xl uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label>Zone <span className="text-destructive">*</span></Label>
                <Select value={locForm.storage_zone_id} onValueChange={v => setLocForm(f => ({ ...f, storage_zone_id: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.code} — {z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Emplacement A nord"
                value={locForm.name}
                onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Capacité palettes <span className="text-destructive">*</span></Label>
                <Input type="number" min="1" placeholder="ex: 10" value={locForm.capacity_palettes} onChange={e => setLocForm(f => ({ ...f, capacity_palettes: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Capacité (kg)</Label>
                <Input type="number" placeholder="Optionnel" value={locForm.capacity_kg} onChange={e => setLocForm(f => ({ ...f, capacity_kg: e.target.value }))} className="rounded-xl" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Emplacement actif</p>
                <p className="text-xs text-muted-foreground">Désactiver pour le mettre hors service</p>
              </div>
              <Switch checked={locForm.is_active} onCheckedChange={v => setLocForm(f => ({ ...f, is_active: v }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setLocDialog({ open: false, editing: null })}>
              Annuler
            </Button>
            <Button
              className="rounded-xl"
              disabled={!locForm.code || !locForm.name || !locForm.storage_zone_id || !locForm.capacity_palettes || createLocation.isPending || updateLocation.isPending}
              onClick={handleLocSubmit}
            >
              {(createLocation.isPending || updateLocation.isPending) ? "Enregistrement…" : locDialog.editing ? "Enregistrer" : "Créer l'emplacement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Location delete confirm ── */}
      <Dialog open={!!deleteLocConfirm} onOpenChange={open => !open && setDeleteLocConfirm(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Supprimer l'emplacement
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Supprimer l'emplacement{" "}
            <span className="font-semibold text-foreground">{deleteLocConfirm?.code}</span> ?
            Cette action est irréversible.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteLocConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={deleteLocation.isPending}
              onClick={async () => {
                if (!deleteLocConfirm) return;
                await deleteLocation.mutateAsync(deleteLocConfirm.id);
                setDeleteLocConfirm(null);
              }}
            >
              {deleteLocation.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
