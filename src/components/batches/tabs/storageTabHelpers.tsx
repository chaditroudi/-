import React from "react";
import { Snowflake, Factory, Package, Wind, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Module3StorageZone, StorageConditionStatus, StorageLocationStatus } from "@/types/storage";

export const fmt = (v?: string | null) => {
  if (!v) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(v));
};

export const fmtNum = (v?: number | null, unit = "") => {
  if (v == null || Number.isNaN(v)) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)}${unit}`;
};

export const occupancy = (cur = 0, cap = 0) =>
  cap > 0 ? Math.min(100, Math.round((cur / cap) * 1000) / 10) : 0;

export const zoneOccupancy = (z: Module3StorageZone, actualKg?: number) => {
  const loadKg = actualKg ?? z.current_load_kg;
  if ((z.capacity_palettes ?? 0) > 0 && (z.current_load_palettes ?? 0) > 0)
    return occupancy(z.current_load_palettes ?? 0, z.capacity_palettes ?? 0);
  if (z.capacity_kg > 0) return occupancy(loadKg, z.capacity_kg);
  return 0;
};

export const zoneIcon = (z: Module3StorageZone) => {
  if (z.storage_family === "cold") return <Snowflake className="h-3.5 w-3.5" />;
  if (z.storage_family === "fumigation") return <Factory className="h-3.5 w-3.5" />;
  if (z.storage_family === "export") return <Package className="h-3.5 w-3.5" />;
  if (z.storage_family === "reception") return <Wind className="h-3.5 w-3.5" />;
  return <Warehouse className="h-3.5 w-3.5" />;
};

export const conditionCls = (s?: StorageConditionStatus) =>
  s === "critical"
    ? "border-red-200 bg-red-50 text-red-700"
    : s === "warning"
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";

export const locationStatusCls = (s: StorageLocationStatus) =>
  s === "blocked"
    ? "border-red-200 bg-red-50 text-red-700"
    : s === "reserved"
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : s === "occupied"
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";

export const familyLabel: Record<string, string> = {
  reception: "Réception",
  raw: "Stockage brut",
  cold: "Chambre froide",
  fumigation: "Fumigation",
  export: "Export",
};

export const locationStatusLabel: Record<StorageLocationStatus, string> = {
  free: "Libre",
  occupied: "Occupé",
  reserved: "Réservé",
  blocked: "Bloqué",
};

export const OccupancyBar: React.FC<{ pct: number; className?: string }> = ({ pct, className }) => (
  <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-border/40", className)}>
    <div
      className={cn(
        "h-full rounded-full transition-all duration-500",
        pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"
      )}
      style={{ width: `${pct}%` }}
    />
  </div>
);

