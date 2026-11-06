import React from "react";
import { Eye, MapPin, Thermometer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LotStatusBadge } from "@/components/shared/LotStatusBadge";
import {
  conditionCls,
  familyLabel,
  fmt,
  fmtNum,
  occupancy,
  OccupancyBar,
  zoneIcon,
  zoneOccupancy,
} from "./storageTabHelpers";
import type { Module3StorageZone, StorageLocation } from "@/types/storage";
import { cn } from "@/lib/utils";

interface ZonesTabProps {
  zones: Module3StorageZone[];
  selectedZoneId: string;
  setSelectedZoneId: (val: string) => void;
  locationSearch: string;
  setLocationSearch: (val: string) => void;
  filteredLocations: StorageLocation[];
  zoneLoadsKg: Map<string, number>;
}

export const ZonesTab: React.FC<ZonesTabProps> = ({
  zones,
  selectedZoneId,
  setSelectedZoneId,
  locationSearch,
  setLocationSearch,
  filteredLocations,
  zoneLoadsKg,
}) => {
  return (
    <div className="space-y-4">
      {/* Top filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={selectedZoneId} onValueChange={setSelectedZoneId}>
          <SelectTrigger className="w-full rounded-xl sm:w-56">
            <SelectValue placeholder="Toutes les zones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les zones</SelectItem>
            {zones.map((z) => (
              <SelectItem key={z.id} value={z.id}>
                {z.code} — {z.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Input
            placeholder="Rechercher un emplacement, code lot…"
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
            className="rounded-xl ps-9"
          />
          <Eye className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        </div>
      </div>

      {/* Zone summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(selectedZoneId === "all" ? zones : zones.filter((z) => z.id === selectedZoneId)).map((z) => {
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
                      <p className="text-xs text-muted-foreground">{familyLabel[z.storage_family ?? ""] ?? z.storage_family}</p>
                    </div>
                  </div>
                  <LotStatusBadge status={z.condition_status} size="xs" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Occupation {(z.capacity_palettes ?? 0) > 0 ? "palettes" : "en poids"}</span>
                    <span className="font-semibold text-foreground">{pct}%</span>
                  </div>
                  <OccupancyBar pct={pct} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    {(z.capacity_palettes ?? 0) > 0 && (z.current_load_palettes ?? 0) > 0 ? (
                      <span>
                        {fmtNum(z.current_load_palettes)} / {fmtNum(z.capacity_palettes)} palettes
                      </span>
                    ) : (
                      <span>
                        {fmtNum(zoneLoadsKg.get(z.code) ?? z.current_load_kg, " kg")} / {fmtNum(z.capacity_kg, " kg")}
                      </span>
                    )}
                    {(z.capacity_palettes ?? 0) > 0 &&
                      (z.current_load_palettes ?? 0) > 0 &&
                      z.capacity_kg > 0 && (
                        <span>
                          {fmtNum(zoneLoadsKg.get(z.code) ?? z.current_load_kg, " kg")} / {fmtNum(z.capacity_kg, " kg")}
                        </span>
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
            <span className="ms-1 text-sm font-normal text-muted-foreground">({filteredLocations.length})</span>
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
                    <TableHead className="text-end">Occupation</TableHead>
                    <TableHead>Lots présents</TableHead>
                    <TableHead>Temp / Hum</TableHead>
                    <TableHead>Dernier mvt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations.slice(0, 250).map((loc) => {
                    const pct = occupancy(loc.occupied_palettes, loc.capacity_palettes);
                    return (
                      <TableRow key={loc.id}>
                        <TableCell className="font-mono text-xs font-semibold">{loc.code}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{loc.zone_code}</TableCell>
                        <TableCell>
                          <LotStatusBadge status={loc.location_status} size="xs" />
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-2">
                            <OccupancyBar pct={pct} className="w-16" />
                            <span className="w-10 text-end text-xs font-semibold">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {loc.lot_ids_present && loc.lot_ids_present.length > 0
                            ? loc.lot_ids_present.slice(0, 2).join(", ") +
                              (loc.lot_ids_present.length > 2 ? ` +${loc.lot_ids_present.length - 2}` : "")
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
    </div>
  );
};

