import React from "react";
import { BoxIcon, Eye, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { fmt, fmtNum } from "./storageTabHelpers";
import type { StockLotStatus } from "@/types/reception";

export interface StorageLotItem {
  id: string;
  lot_internal?: string;
  lot_supplier?: string;
  variety?: string;
  quantity?: number;
  unit?: string;
  stock_status?: StockLotStatus | string;
  storage_zone_code?: string;
  reception_id?: string;
  harvest_date?: string;
  created_at?: string;
  quarantine_reason?: string;
}

interface LotsTabProps {
  filteredLots: StorageLotItem[];
  lotsLoading: boolean;
  canManage: boolean;
  onAssignLot: (lot: StorageLotItem) => void;
  lotSearch: string;
  setLotSearch: (val: string) => void;
  lotStatusFilter: string;
  setLotStatusFilter: (val: string) => void;
}

export const LotsTab: React.FC<LotsTabProps> = ({
  filteredLots,
  lotsLoading,
  canManage,
  onAssignLot,
  lotSearch,
  setLotSearch,
  lotStatusFilter,
  setLotStatusFilter,
}) => {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            placeholder="Rechercher un lot, variété, zone…"
            value={lotSearch}
            onChange={(e) => setLotSearch(e.target.value)}
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
        {lotStatusFilter !== "all" ? ` · filtre: ${lotStatusFilter}` : ""}
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
                  {filteredLots.slice(0, 300).map((lot) => (
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
                        <LotStatusBadge status={lot.stock_status} size="sm" />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmt(lot.created_at)}</TableCell>
                      {canManage && (
                        <TableCell>
                          {(!lot.storage_zone_code || lot.stock_status === "STOCK_LIBERE") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 rounded-lg text-xs opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => onAssignLot(lot)}
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
    </div>
  );
};

