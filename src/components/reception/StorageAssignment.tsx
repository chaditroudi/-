import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, ArrowRight, CheckCircle2, Leaf, MapPin, Snowflake, Factory, Warehouse, Wind, ShieldAlert } from 'lucide-react';
import { ReceptionV2, ReceptionLot, stockStatusLabels, stockStatusColors } from '@/types/reception';
import { useMoveReceptionLotToStorage } from '@/hooks/useReceptionsV2';
import { useModule3StorageLocations, useModule3StorageZones } from '@/hooks/useStorageModule3';
import { checkBioSegregationRGS01, checkLotStorageAllowed } from '@/lib/phase1RuleEngine';
import type { Module3StorageZone } from '@/types/storage';

// ── Zone family → semantic role ───────────────────────────────────────────────

type ZoneRole = 'reception' | 'quarantine' | 'stock' | 'none';

const FAMILY_ROLE: Record<string, ZoneRole> = {
  reception: 'reception',
  raw:       'reception',   // raw bulk = pre-processing, still in reception flow
  fumigation:'quarantine',  // FU zones = quarantine treatment
  cold:      'stock',       // CF zones = released product
  export:    'stock',       // ZE zones = export prep
};

// Which families are reachable from each lot status
const ALLOWED_FAMILIES: Record<string, string[]> = {
  NON_STOCKE:     ['reception', 'raw', 'fumigation'],
  EN_QUARANTAINE: ['fumigation'],
  STOCK_LIBERE:   ['cold', 'export'],
  STOCK_REJETE:   [],
};

const FAMILY_LABEL: Record<string, string> = {
  reception:  'Zone Réception (ZR)',
  raw:        'Stockage brut (SB)',
  fumigation: 'Quarantaine / Fumigation (FU)',
  cold:       'Chambres froides (CF)',
  export:     'Export (ZE)',
};

const FAMILY_COLOR: Record<string, string> = {
  reception:  'text-sky-700',
  raw:        'text-amber-700',
  fumigation: 'text-orange-700',
  cold:       'text-blue-700',
  export:     'text-emerald-700',
};

const FAMILY_ICON: Record<string, React.ReactNode> = {
  reception:  <Wind className="h-4 w-4" />,
  raw:        <Warehouse className="h-4 w-4" />,
  fumigation: <Factory className="h-4 w-4" />,
  cold:       <Snowflake className="h-4 w-4" />,
  export:     <MapPin className="h-4 w-4" />,
};

const getOccupancy = (used = 0, cap = 0) =>
  cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;

// ── StorageAssignment component ───────────────────────────────────────────────

interface StorageAssignmentProps {
  reception: ReceptionV2;
  lots: ReceptionLot[];
}

export const StorageAssignment = ({ reception, lots }: StorageAssignmentProps) => {
  const moveLotToStorage = useMoveReceptionLotToStorage();
  const { data: dbZones = [], isLoading: zonesLoading } = useModule3StorageZones();

  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<ReceptionLot | null>(null);
  const [targetZoneCode, setTargetZoneCode] = useState('');
  const [targetLocationId, setTargetLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [performedBy, setPerformedBy] = useState('');

  const lotIsBio = reception.bio_declared ?? false;

  // Selected physical zone + its locations
  const selectedDbZone = dbZones.find((z) => z.code === targetZoneCode);
  const { data: zoneLocations = [] } = useModule3StorageLocations(selectedDbZone?.id);
  const freeLocations = zoneLocations.filter(
    (l) => l.location_status === 'free' || (l.location_status === 'occupied' && (l.occupied_palettes ?? 0) < (l.capacity_palettes ?? 1)),
  );

  // Valid zones for a lot status + bio
  const getValidZones = (lotStatus: string): Module3StorageZone[] => {
    const allowed = ALLOWED_FAMILIES[lotStatus] ?? [];
    return dbZones.filter((z) => {
      const family = z.storage_family ?? '';
      if (!allowed.includes(family)) return false;
      // Bio segregation: cold/export zones — bio lots need dedicated section
      // Since zones don't have a bio_only flag, we allow but warn
      return true;
    });
  };

  // Bio check for selected zone
  const bioCheck = useMemo(() => {
    if (!targetZoneCode || !selectedDbZone) return null;
    const family = selectedDbZone.storage_family ?? '';
    // fumigation = quarantine zone → always allowed for bio check
    const isQuarantineZone = family === 'fumigation';
    return checkBioSegregationRGS01({
      lotIsBio,
      zoneIsBioOnly: null,      // real DB zones don't have bio_only flag
      isQuarantineZone,
    });
  }, [targetZoneCode, selectedDbZone, lotIsBio]);

  // Guard check for the transition
  const storageGuard = useMemo(() => {
    if (!selectedLot || !targetZoneCode) return null;
    return checkLotStorageAllowed({
      lotStockStatus: selectedLot.stock_status,
      receptionStatus: reception.status,
      targetZoneCode,
    });
  }, [selectedLot, targetZoneCode, reception.status]);

  // Zone group stats for overview cards
  const zoneGroupStats = useMemo(() => {
    const families = ['reception', 'raw', 'fumigation', 'cold', 'export'];
    return families.map((f) => {
      const fZones = dbZones.filter((z) => (z.storage_family ?? '') === f);
      const totalPal = fZones.reduce((s, z) => s + (z.capacity_palettes ?? 0), 0);
      const usedPal  = fZones.reduce((s, z) => s + (z.current_load_palettes ?? 0), 0);
      return { family: f, count: fZones.length, totalPal, usedPal };
    }).filter((g) => g.count > 0);
  }, [dbZones]);

  // Lot breakdown by current zone role
  const lotsByRole = useMemo(() => ({
    inReception:  lots.filter((l) => l.stock_status === 'NON_STOCKE').length,
    inQuarantine: lots.filter((l) => l.stock_status === 'EN_QUARANTAINE').length,
    released:     lots.filter((l) => l.stock_status === 'STOCK_LIBERE').length,
    rejected:     lots.filter((l) => l.stock_status === 'STOCK_REJETE').length,
  }), [lots]);

  const handleOpenMoveDialog = (lot: ReceptionLot) => {
    setSelectedLot(lot);
    setTargetZoneCode('');
    setTargetLocationId('');
    setNotes('');
    setMoveDialogOpen(true);
  };

  const handleMove = async () => {
    if (!selectedLot || !targetZoneCode || !performedBy) return;
    if (storageGuard && !storageGuard.allowed) return;

    await moveLotToStorage.mutateAsync({
      lotId: selectedLot.id,
      targetZone: targetZoneCode,
      position: targetLocationId || undefined,
      notes,
      performedBy,
      _lotStockStatus: selectedLot.stock_status,
      _receptionStatus: reception.status,
    });
    setMoveDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <Warehouse className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-medium">Orientation des lots d'entrée</h3>
        {lotIsBio && (
          <Badge className="ml-2 gap-1 bg-emerald-600 text-white">
            <Leaf className="h-3 w-3" />BIO déclaré
          </Badge>
        )}
        {zonesLoading && (
          <Badge variant="secondary" className="text-xs">Chargement des zones…</Badge>
        )}
      </div>

      {/* RG-S01 banner */}
      <Card className={lotIsBio ? 'border-emerald-300 bg-emerald-50' : 'border-sky-200 bg-sky-50'}>
        <CardContent className="p-3 text-sm">
          <p className={`font-medium ${lotIsBio ? 'text-emerald-900' : 'text-sky-900'}`}>
            {lotIsBio
              ? 'RG-S01 — Lot BIO : stockage en chambres froides séparées des lots conventionnels.'
              : 'RG-S01 — Lot conventionnel : respecter la ségrégation bio / conv.'}
          </p>
        </CardContent>
      </Card>

      {/* Zone overview — from real DB zones */}
      {dbZones.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {zoneGroupStats.map(({ family, count, totalPal, usedPal }) => {
            const occ = getOccupancy(usedPal, totalPal);
            return (
              <Card key={family} className="rounded-xl">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className={FAMILY_COLOR[family]}>{FAMILY_ICON[family]}</span>
                    <p className="text-xs font-medium text-muted-foreground truncate">{FAMILY_LABEL[family]}</p>
                  </div>
                  <p className="text-xl font-bold">{count} <span className="text-xs font-normal text-muted-foreground">zone(s)</span></p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{usedPal}/{totalPal} pal.</span>
                      <span>{occ}%</span>
                    </div>
                    <Progress
                      value={occ}
                      className={`h-1.5 ${occ >= 90 ? '[&>div]:bg-red-500' : occ >= 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        !zonesLoading && (
          <Card className="border-dashed">
            <CardContent className="p-4 text-sm text-muted-foreground text-center">
              Aucune zone synchronisée. Allez dans l'onglet Stockage → Synchroniser le plan Royal Palm.
            </CardContent>
          </Card>
        )
      )}

      {/* Lot summary chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        {lotsByRole.inReception > 0 && <Badge className="bg-sky-100 text-sky-800">{lotsByRole.inReception} en réception</Badge>}
        {lotsByRole.inQuarantine > 0 && <Badge className="bg-orange-100 text-orange-800">{lotsByRole.inQuarantine} en quarantaine</Badge>}
        {lotsByRole.released > 0 && <Badge className="bg-emerald-100 text-emerald-800">{lotsByRole.released} libéré(s)</Badge>}
        {lotsByRole.rejected > 0 && <Badge className="bg-red-100 text-red-800">{lotsByRole.rejected} rejeté(s)</Badge>}
      </div>

      {/* Lots list */}
      <div className="space-y-3">
        {lots.map((lot) => {
          const validZones = getValidZones(lot.stock_status);
          const canMove = validZones.length > 0;

          return (
            <Card key={lot.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-mono font-medium">{lot.lot_internal || lot.lot_supplier}</p>
                      <p className="text-sm text-muted-foreground">
                        {lot.quantity} {lot.unit}
                        {(lot as any).current_zone_code && <> • <span className="font-medium">{(lot as any).current_zone_code}</span></>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={stockStatusColors[lot.stock_status]}>
                      {stockStatusLabels[lot.stock_status]}
                    </Badge>
                    {/* Current zone — shown when lot is already placed */}
                    {lot.storage_zone_code && (
                      <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-700 font-mono text-xs">
                        <MapPin className="h-3 w-3" />
                        {lot.storage_zone_code}
                      </Badge>
                    )}
                    {/* Warn: libéré but not yet placed in a physical zone */}
                    {lot.stock_status === 'STOCK_LIBERE' && !lot.storage_zone_code && (
                      <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700 text-xs">
                        <AlertTriangle className="h-3 w-3" /> À placer
                      </Badge>
                    )}
                    {/* Action button — all statuses except rejeté */}
                    {lot.stock_status !== 'STOCK_REJETE' && canMove && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenMoveDialog(lot)}
                        disabled={dbZones.length === 0}
                        className={lot.stock_status === 'STOCK_LIBERE' ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : ''}
                      >
                        <ArrowRight className="h-4 w-4 mr-1" />
                        {lot.storage_zone_code
                          ? 'Déplacer'
                          : lot.stock_status === 'STOCK_LIBERE'
                          ? 'Affecter chambre froide'
                          : 'Affecter'}
                      </Button>
                    )}
                    {lot.stock_status === 'STOCK_REJETE' && (
                      <Badge variant="outline" className="gap-1 border-red-300 text-red-700 text-xs">
                        <ShieldAlert className="h-3 w-3" /> Rejeté
                      </Badge>
                    )}
                  </div>
                </div>

                {lot.stock_status === 'EN_QUARANTAINE' && lot.quarantine_reason && (
                  <div className="mt-2 p-2 bg-orange-100 rounded text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="text-orange-800">{lot.quarantine_reason}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rules reminder */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-3 text-sm text-blue-800">
          <p className="font-medium mb-1">Règles d'orientation</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>RG-R07 — Lot rejeté/bloqué → seule la zone Quarantaine (FU) est autorisée</li>
            <li>RG-S01 — Respecter la ségrégation bio / conventionnel en chambres froides</li>
            <li>Lot non stocké → zones Réception (ZR), Stockage brut (SB) ou Fumigation (FU)</li>
            <li>Lot libéré → chambres froides (CF) ou export (ZE) uniquement</li>
          </ul>
        </CardContent>
      </Card>

      {/* ── Move Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Affecter / Déplacer le lot</DialogTitle>
          </DialogHeader>

          {selectedLot && (
            <div className="space-y-4">
              {/* Lot summary */}
              <div className="rounded-lg bg-muted p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium font-mono">{selectedLot.lot_internal || selectedLot.lot_supplier}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedLot.quantity} {selectedLot.unit} • {stockStatusLabels[selectedLot.stock_status]}
                  </p>
                </div>
                {lotIsBio && (
                  <Badge className="gap-1 bg-emerald-600 text-white"><Leaf className="h-3 w-3" />BIO</Badge>
                )}
              </div>

              {/* Zone select — grouped by family */}
              <div className="space-y-2">
                <Label>Zone de destination *</Label>
                <Select value={targetZoneCode} onValueChange={(v) => { setTargetZoneCode(v); setTargetLocationId(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une zone physique" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(
                      getValidZones(selectedLot.stock_status).reduce<Record<string, Module3StorageZone[]>>((acc, z) => {
                        const f = z.storage_family ?? 'raw';
                        (acc[f] ??= []).push(z);
                        return acc;
                      }, {}),
                    ).map(([family, zones]) => (
                      <SelectGroup key={family}>
                        <SelectLabel className="text-xs font-semibold">{FAMILY_LABEL[family] ?? family}</SelectLabel>
                        {zones.map((z) => {
                          const occ = getOccupancy(z.current_load_palettes, z.capacity_palettes);
                          return (
                            <SelectItem key={z.id} value={z.code}>
                              <span className="flex items-center gap-2">
                                <span className={FAMILY_COLOR[family]}>{FAMILY_ICON[family]}</span>
                                <span>{z.code} — {z.name}</span>
                                <span className={`text-[10px] ml-auto ${occ >= 90 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                  {occ}%
                                </span>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    ))}
                    {getValidZones(selectedLot.stock_status).length === 0 && (
                      <SelectItem value="__none__" disabled>Aucune zone disponible</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Guard / bio warning */}
              {storageGuard && !storageGuard.allowed && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 flex items-start gap-2 text-sm text-red-800">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{storageGuard.reason}</span>
                </div>
              )}
              {lotIsBio && targetZoneCode && (selectedDbZone?.storage_family === 'cold' || selectedDbZone?.storage_family === 'export') && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex items-start gap-2">
                  <Leaf className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>Lot BIO — veiller à utiliser un emplacement dédié BIO dans cette zone (ségrégation physique).</span>
                </div>
              )}

              {/* Selected zone info */}
              {selectedDbZone && (
                <div className="rounded-lg bg-muted/50 border px-3 py-2 text-xs space-y-1">
                  <p className="font-medium text-foreground">{selectedDbZone.code} — {selectedDbZone.name}</p>
                  {selectedDbZone.current_temperature_c != null && (
                    <p className="text-muted-foreground">
                      Température actuelle : <strong>{selectedDbZone.current_temperature_c}°C</strong>
                      {selectedDbZone.temperature_min != null && <span> (cible {selectedDbZone.temperature_min}–{selectedDbZone.temperature_max}°C)</span>}
                    </p>
                  )}
                  {(selectedDbZone.capacity_palettes ?? 0) > 0 && (
                    <p className="text-muted-foreground">
                      Occupation : <strong>{selectedDbZone.current_load_palettes ?? 0}/{selectedDbZone.capacity_palettes} palettes</strong>
                      {' '}({getOccupancy(selectedDbZone.current_load_palettes, selectedDbZone.capacity_palettes)}%)
                    </p>
                  )}
                </div>
              )}

              {/* Location dropdown from real DB */}
              <div className="space-y-2">
                <Label>Emplacement spécifique</Label>
                {freeLocations.length > 0 ? (
                  <Select
                    value={targetLocationId || '__none__'}
                    onValueChange={(v) => setTargetLocationId(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un emplacement (optionnel)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Sans emplacement précis —</SelectItem>
                      {freeLocations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.code}>
                          {loc.code}
                          {loc.capacity_palettes ? ` — ${loc.occupied_palettes ?? 0}/${loc.capacity_palettes} pal.` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : targetZoneCode ? (
                  <Input
                    value={targetLocationId}
                    onChange={(e) => setTargetLocationId(e.target.value)}
                    placeholder="Ex : A-01-03 (aucun emplacement libre trouvé)"
                  />
                ) : (
                  <Input disabled placeholder="Sélectionner d'abord une zone" />
                )}
              </div>

              <div className="space-y-2">
                <Label>Effectué par *</Label>
                <Input
                  value={performedBy}
                  onChange={(e) => setPerformedBy(e.target.value)}
                  placeholder="Nom du magasinier"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observations…"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={handleMove}
              disabled={
                !targetZoneCode ||
                !performedBy ||
                moveLotToStorage.isPending ||
                (storageGuard !== null && !storageGuard.allowed)
              }
            >
              {moveLotToStorage.isPending ? "Déplacement…" : "Confirmer l'affectation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
