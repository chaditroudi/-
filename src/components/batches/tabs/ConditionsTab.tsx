import React from "react";
import { Activity, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { fmt, fmtNum } from "./storageTabHelpers";
import { cn } from "@/lib/utils";
import type {
  Module3StorageZone,
  StorageConditionReading,
  StorageDoorEvent,
} from "@/types/storage";

export interface ReadingFormData {
  storageZoneId: string;
  temperatureC: string;
  humidityPercent: string;
  gasPpm: string;
  sensorRef: string;
}

interface ConditionsTabProps {
  canManage: boolean;
  readingForm: ReadingFormData;
  setReadingForm: React.Dispatch<React.SetStateAction<ReadingFormData>>;
  zones: Module3StorageZone[];
  createReadingPending: boolean;
  onReadingSubmit: () => void;
  readings: StorageConditionReading[];
  doorEvents: StorageDoorEvent[];
}

export const ConditionsTab: React.FC<ConditionsTabProps> = ({
  canManage,
  readingForm,
  setReadingForm,
  zones,
  createReadingPending,
  onReadingSubmit,
  readings,
  doorEvents,
}) => {
  return (
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
              <Label>
                Zone <span className="text-destructive">*</span>
              </Label>
              <Select
                value={readingForm.storageZoneId}
                onValueChange={(v) =>
                  setReadingForm((f) => ({ ...f, storageZoneId: v }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Sélectionner une zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.code} — {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Température °C <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="ex: 18.5"
                  value={readingForm.temperatureC}
                  onChange={(e) =>
                    setReadingForm((f) => ({ ...f, temperatureC: e.target.value }))
                  }
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
                  onChange={(e) =>
                    setReadingForm((f) => ({ ...f, humidityPercent: e.target.value }))
                  }
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
                  onChange={(e) =>
                    setReadingForm((f) => ({ ...f, gasPpm: e.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Réf. capteur</Label>
                <Input
                  placeholder="SEN-001"
                  value={readingForm.sensorRef}
                  onChange={(e) =>
                    setReadingForm((f) => ({ ...f, sensorRef: e.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>
            </div>
            <Button
              className="w-full rounded-xl"
              disabled={
                !readingForm.storageZoneId ||
                !readingForm.temperatureC ||
                createReadingPending
              }
              onClick={onReadingSubmit}
            >
              {createReadingPending ? "Enregistrement…" : "Enregistrer la lecture"}
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
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                ({readings.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {readings.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Aucune lecture enregistrée
              </div>
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
                    {readings.slice(0, 60).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmt(r.reading_at)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.zone_code ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.location_code ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">
                          {fmtNum(r.temperature_c, "°")}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {fmtNum(r.humidity_percent, "%")}
                        </TableCell>
                        <TableCell className="text-right text-xs">{fmtNum(r.gas_ppm)}</TableCell>
                        <TableCell>
                          <LotStatusBadge status={r.condition_status} size="xs" />
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
                {doorEvents.slice(0, 20).map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        e.event_type === "OPEN"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      )}
                    >
                      {e.event_type === "OPEN" ? "O" : "F"}
                    </span>
                    <span className="flex-1 text-xs font-medium text-foreground">
                      {e.event_type === "OPEN" ? "Ouverture" : "Fermeture"}
                      <span className="ml-2 font-normal text-muted-foreground">
                        · {e.zone_code ?? "—"}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{fmt(e.event_at)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

