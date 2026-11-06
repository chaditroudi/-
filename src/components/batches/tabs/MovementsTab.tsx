import React from "react";
import { Activity, ArrowRightLeft, QrCode } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { LotStatusBadge } from "@/components/shared/LotStatusBadge";
import { fmt, fmtNum } from "./storageTabHelpers";
import {
  storageMovementReasonLabels,
  storageMovementTypeLabels,
} from "@/types/storage";
import type {
  Module3StorageZone,
  StorageLocation,
  StorageLocationMovement,
  StorageMovementReason,
  StorageMovementType,
} from "@/types/storage";

export interface MovementFormData {
  movementType: StorageMovementType;
  lotCode: string;
  sourceLocationId: string;
  destinationLocationId: string;
  destinationZoneId: string;
  quantityPalettes: string;
  quantityKg: string;
  reason: StorageMovementReason;
  notes: string;
}

interface MovementsTabProps {
  canManage: boolean;
  mvtForm: MovementFormData;
  setMvtForm: React.Dispatch<React.SetStateAction<MovementFormData>>;
  allLocations: StorageLocation[];
  zones: Module3StorageZone[];
  setScannerOpen: (open: boolean) => void;
  lotScanToken: string;
  moveStockPending: boolean;
  onMovementSubmit: () => void;
  movements: StorageLocationMovement[];
}

export const MovementsTab: React.FC<MovementsTabProps> = ({
  canManage,
  mvtForm,
  setMvtForm,
  allLocations,
  zones,
  setScannerOpen,
  lotScanToken,
  moveStockPending,
  onMovementSubmit,
  movements,
}) => {
  return (
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
                onValueChange={(v) =>
                  setMvtForm((f) => ({ ...f, movementType: v as StorageMovementType }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(storageMovementTypeLabels).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Code du lot <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Scanner le QR/SSCC du lot"
                  value={mvtForm.lotCode}
                  readOnly
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
                onValueChange={(v) => setMvtForm((f) => ({ ...f, sourceLocationId: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun (entrée externe)</SelectItem>
                  {allLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.code} — {l.zone_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Emplacement destination <span className="text-destructive">*</span>
              </Label>
              <Select
                value={mvtForm.destinationLocationId}
                onValueChange={(v) => {
                  const loc = allLocations.find((l) => l.id === v);
                  const zone = zones.find((z) => z.code === loc?.zone_code);
                  setMvtForm((f) => ({
                    ...f,
                    destinationLocationId: v,
                    destinationZoneId: zone?.id ?? "none",
                  }));
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {allLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.code} — {l.zone_code}
                    </SelectItem>
                  ))}
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
                  onChange={(e) =>
                    setMvtForm((f) => ({ ...f, quantityPalettes: e.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Quantité (kg)</Label>
                <Input
                  type="number"
                  placeholder="Optionnel"
                  value={mvtForm.quantityKg}
                  onChange={(e) => setMvtForm((f) => ({ ...f, quantityKg: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motif</Label>
              <Select
                value={mvtForm.reason}
                onValueChange={(v) =>
                  setMvtForm((f) => ({ ...f, reason: v as StorageMovementReason }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(storageMovementReasonLabels).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Observations optionnelles…"
                value={mvtForm.notes}
                onChange={(e) => setMvtForm((f) => ({ ...f, notes: e.target.value }))}
                className="min-h-[72px] resize-none rounded-xl"
              />
            </div>

            <Button
              className="w-full rounded-xl"
              disabled={
                !mvtForm.lotCode ||
                !lotScanToken ||
                !mvtForm.destinationLocationId ||
                moveStockPending
              }
              onClick={onMovementSubmit}
            >
              {moveStockPending ? "Enregistrement…" : "Enregistrer le mouvement"}
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
            <span className="ms-1 text-sm font-normal text-muted-foreground">
              ({movements.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucun mouvement
            </div>
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
                    <TableHead className="text-end">Qté</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Opérateur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">
                        {m.movement_number?.slice(-6) ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmt(m.movement_date)}
                      </TableCell>
                      <TableCell>
                        <LotStatusBadge status={m.movement_type} size="xs" />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{m.lot_code ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.source_location_code ?? m.source_zone_code ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.destination_location_code ?? m.destination_zone_code ?? "—"}
                      </TableCell>
                      <TableCell className="text-end text-xs">
                        {fmtNum(m.quantity_palettes, " pal.")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {storageMovementReasonLabels[m.movement_reason as StorageMovementReason] ??
                          m.reason ??
                          "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.performed_by ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
