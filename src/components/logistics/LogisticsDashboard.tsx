import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck,
  FileSearch,
  MapPin,
  Package2,
  Plus,
  Search,
  ShieldCheck,
  Ship,
  TimerReset,
  Trash2,
  Truck,
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  useCreateShipment,
  useCreateShipmentLine,
  useDeleteShipmentLine,
  useLotSuggestions,
  useProducts,
  useShipments,
  useStockLots,
  useUpdateShipment,
  useUpdateShipmentLine,
} from '@/hooks/useStock';
import type {
  Product,
  ShipmentLine,
  ShipmentPreparation,
  ShipmentStatus,
  StockLot,
} from '@/types/stock';
import { shipmentStatusColors, shipmentStatusLabels } from '@/types/stock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { TransportWorkspace } from './TransportWorkspace';

type ShipmentChecklist = {
  totalLines: number;
  totalRequested: number;
  totalPicked: number;
  lotCoverage: number;
  conformityReady: boolean;
  phytosanitaryReady: boolean;
  genealogyReady: boolean;
  recallReady: boolean;
  fullyPicked: boolean;
  openActions: string[];
};

const EMPTY_LOT_VALUE = '__none__';

const formatDateTime = (value?: string | null) =>
  value ? format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: fr }) : '-';

const formatDateOnly = (value?: string | null) =>
  value ? format(new Date(value), 'dd/MM/yyyy', { locale: fr }) : '-';

const clampPickedQuantity = (requested: number, lot?: StockLot) => {
  if (!lot) return 0;
  return Math.min(requested, Number(lot.current_quantity || 0));
};

const getShipmentChecklist = (shipment: ShipmentPreparation): ShipmentChecklist => {
  const lines = shipment.lines || [];
  const totalRequested = lines.reduce((sum, line) => sum + Number(line.requested_quantity || 0), 0);
  const totalPicked = lines.reduce((sum, line) => sum + Number(line.picked_quantity || 0), 0);
  const linkedLots = lines.filter((line) => line.lot_id).length;
  const lotCoverage = lines.length > 0 ? Math.round((linkedLots / lines.length) * 100) : 0;
  const hasHeaderData = Boolean(shipment.customer_name && shipment.destination && shipment.requested_date);

  const conformityReady =
    hasHeaderData &&
    lines.length > 0 &&
    lines.every((line) => Number(line.picked_quantity || 0) >= Number(line.requested_quantity || 0));

  const phytosanitaryReady =
    lines.length > 0 &&
    lines.every((line) => {
      const lot = line.lot as StockLot | undefined;
      return Boolean(lot?.origin_country && lot?.reception_date && lot?.supplier?.name);
    });

  const genealogyReady =
    lines.length > 0 &&
    lines.every((line) => {
      const lot = line.lot as StockLot | undefined;
      return Boolean(lot?.lot_number && lot?.origin_farm && lot?.variety && lot?.reception_date);
    });

  const fullyPicked = lines.length > 0 && totalPicked >= totalRequested;
  const recallReady = lotCoverage === 100 && Boolean(shipment.customer_name && shipment.destination);

  const openActions: string[] = [];
  if (!shipment.customer_name) openActions.push('Renseigner le client');
  if (!shipment.destination) openActions.push('Renseigner la destination');
  if (!shipment.requested_date) openActions.push('Planifier la date demandee');
  if (lines.length === 0) openActions.push('Ajouter au moins une ligne de preparation');
  if (lotCoverage < 100) openActions.push('Affecter un lot a chaque ligne');
  if (!fullyPicked) openActions.push('Completer le picking des quantites demandees');
  if (!phytosanitaryReady) openActions.push('Completer les donnees phyto/origine des lots');
  if (!genealogyReady) openActions.push('Completer la genealogie export des lots');

  return {
    totalLines: lines.length,
    totalRequested,
    totalPicked,
    lotCoverage,
    conformityReady,
    phytosanitaryReady,
    genealogyReady,
    recallReady,
    fullyPicked,
    openActions,
  };
};

const buildConformityReport = (shipment: ShipmentPreparation) => {
  const checklist = getShipmentChecklist(shipment);
  const lines = shipment.lines || [];

  return [
    'CERTIFICAT DE CONFORMITE EXPORT',
    `Expedition: ${shipment.shipment_number}`,
    `Client: ${shipment.customer_name || '-'}`,
    `Destination: ${shipment.destination || '-'}`,
    `Date demandee: ${formatDateOnly(shipment.requested_date)}`,
    `Statut: ${shipmentStatusLabels[shipment.status as ShipmentStatus] || shipment.status}`,
    '',
    'CONTROLE DE PREPARATION',
    `Nombre de lignes: ${checklist.totalLines}`,
    `Quantite demandee: ${checklist.totalRequested.toLocaleString('fr-FR')}`,
    `Quantite preparee: ${checklist.totalPicked.toLocaleString('fr-FR')}`,
    `Couverture tracabilite: ${checklist.lotCoverage}%`,
    '',
    'DETAIL LIGNES',
    ...lines.map((line) => {
      const product = line.product as Product | undefined;
      const lot = line.lot as StockLot | undefined;
      return `- ${product?.name || 'Produit'} | Lot: ${lot?.lot_number || '-'} | Demande: ${line.requested_quantity} ${line.unit} | Prepare: ${line.picked_quantity || 0} ${line.unit}`;
    }),
    '',
    `Verdict conformite: ${checklist.conformityReady ? 'PRET POUR EXPORT' : 'A COMPLETER'}`,
    checklist.openActions.length > 0 ? `Actions restantes: ${checklist.openActions.join('; ')}` : 'Actions restantes: aucune',
  ].join('\n');
};

const buildGenealogyReport = (shipment: ShipmentPreparation) => {
  const lines = shipment.lines || [];
  const uniqueLots = Array.from(new Map(lines.map((line) => [line.lot_id, line.lot])).values()).filter(Boolean) as StockLot[];

  return [
    'RAPPORT DE GENEALOGIE LOT',
    `Expedition: ${shipment.shipment_number}`,
    `Client downstream: ${shipment.customer_name || '-'}`,
    `Destination: ${shipment.destination || '-'}`,
    '',
    'LOTS ASSOCIES',
    ...uniqueLots.flatMap((lot) => [
      `- Lot: ${lot.lot_number}`,
      `  Produit: ${lot.product?.name || '-'}`,
      `  Variete: ${lot.variety || lot.product?.variety || '-'}`,
      `  Origine: ${lot.origin_farm || '-'} / ${lot.origin_country || '-'}`,
      `  Fournisseur: ${lot.supplier?.name || '-'}`,
      `  Recolte: ${formatDateOnly(lot.harvest_date)}`,
      `  Reception: ${formatDateOnly(lot.reception_date)}`,
      `  DLC-DLUO: ${formatDateOnly(lot.dlc_date || lot.dluo_date)}`,
      `  Quantite restante: ${Number(lot.current_quantity || 0).toLocaleString('fr-FR')} ${lot.unit}`,
      '',
    ]),
  ].join('\n');
};

const buildPhytosanitaryReport = (shipment: ShipmentPreparation) => {
  const lines = shipment.lines || [];

  return [
    'FICHE PHYTOSANITAIRE / EXPORT',
    `Expedition: ${shipment.shipment_number}`,
    `Destination: ${shipment.destination || '-'}`,
    '',
    'DONNEES LOTS',
    ...lines.map((line) => {
      const lot = line.lot as StockLot | undefined;
      return [
        `- Lot: ${lot?.lot_number || '-'}`,
        `  Origine pays: ${lot?.origin_country || '-'}`,
        `  Fournisseur: ${lot?.supplier?.name || '-'}`,
        `  Humidite: ${lot?.humidity_measured ?? '-'} %`,
        `  Temperature: ${lot?.temperature_measured ?? '-'} C`,
        `  Reception: ${formatDateOnly(lot?.reception_date)}`,
      ].join('\n');
    }),
    '',
    'Usage: ce document sert de base de verification avant generation du certificat phytosanitaire officiel.',
  ].join('\n');
};

const buildRecallReport = (shipment: ShipmentPreparation) => {
  const checklist = getShipmentChecklist(shipment);
  const startedAt = performance.now();
  const affectedLots = (shipment.lines || [])
    .map((line) => line.lot as StockLot | undefined)
    .filter(Boolean) as StockLot[];
  const generationTime = Math.max(1, Math.round(performance.now() - startedAt));

  return [
    'MOCK RECALL EXERCISE',
    `Expedition cible: ${shipment.shipment_number}`,
    `Destinataire downstream: ${shipment.customer_name || '-'}`,
    `Destination: ${shipment.destination || '-'}`,
    `Reponse generee en: ${generationTime} ms`,
    `Objectif cahier des charges: identification < 4 heures`,
    '',
    `Couverture tracabilite: ${checklist.lotCoverage}%`,
    `Etat rappel: ${checklist.recallReady ? 'PRET' : 'DONNEES INCOMPLETES'}`,
    '',
    'LOTS IMPACTES',
    ...affectedLots.map((lot) => `- ${lot.lot_number} | ${lot.product?.name || '-'} | ${lot.origin_farm || '-'} | ${lot.supplier?.name || '-'}`),
  ].join('\n');
};

const downloadTextReport = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

type ShipmentLineEditorProps = {
  line: ShipmentLine;
  shipmentStatus: string;
  lots: StockLot[];
  actorName: string;
};

const ShipmentLineEditor = ({ line, shipmentStatus, lots, actorName }: ShipmentLineEditorProps) => {
  const updateLine = useUpdateShipmentLine();
  const deleteLine = useDeleteShipmentLine();
  const isLocked = shipmentStatus === 'SHIPPED' || shipmentStatus === 'CANCELLED';
  const availableLots = lots.filter((lot) => lot.product_id === line.product_id && lot.current_quantity > 0);
  const [selectedLotId, setSelectedLotId] = useState(line.lot_id || EMPTY_LOT_VALUE);
  const [pickedQuantity, setPickedQuantity] = useState(String(line.picked_quantity || 0));

  useEffect(() => {
    setSelectedLotId(line.lot_id || EMPTY_LOT_VALUE);
    setPickedQuantity(String(line.picked_quantity || 0));
  }, [line.id, line.lot_id, line.picked_quantity]);

  const handleSave = async () => {
    const lot = availableLots.find((item) => item.id === selectedLotId);
    const picked = Number(pickedQuantity || 0);
    await updateLine.mutateAsync({
      id: line.id,
      lot_id: selectedLotId === EMPTY_LOT_VALUE ? null : selectedLotId,
      picked_quantity: picked,
      picked_by: picked > 0 ? actorName : null,
      picked_at: picked > 0 ? new Date().toISOString() : null,
      suggested_by_system: false,
      unit: line.unit,
      notes: lot ? `Lot affecte manuellement: ${lot.lot_number}` : line.notes,
    });
  };

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{line.product?.name || '-'}</div>
        <div className="text-xs text-muted-foreground">{line.product?.code || '-'}</div>
      </TableCell>
      <TableCell>{Number(line.requested_quantity).toLocaleString('fr-FR')} {line.unit}</TableCell>
      <TableCell>
        <Select value={selectedLotId} onValueChange={setSelectedLotId} disabled={isLocked}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Choisir un lot" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_LOT_VALUE}>Aucun lot affecte</SelectItem>
            {availableLots.map((lot) => (
              <SelectItem key={lot.id} value={lot.id}>
                {lot.lot_number} · {Number(lot.current_quantity).toLocaleString('fr-FR')} {lot.unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={pickedQuantity}
          disabled={isLocked}
          onChange={(event) => setPickedQuantity(event.target.value)}
          className="w-28"
        />
      </TableCell>
      <TableCell>
        {line.lot ? (
          <div className="text-xs text-muted-foreground">
            <div>{(line.lot as StockLot).origin_farm || '-'}</div>
            <div>{(line.lot as StockLot).origin_country || '-'}</div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Traceabilite incomplete</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleSave} disabled={isLocked || updateLine.isPending}>
            Sauver
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => deleteLine.mutate(line.id)}
            disabled={isLocked || deleteLine.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

type CreateShipmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CreateShipmentDialog = ({ open, onOpenChange }: CreateShipmentDialogProps) => {
  const createShipment = useCreateShipment();
  const [customerName, setCustomerName] = useState('');
  const [destination, setDestination] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setCustomerName('');
    setDestination('');
    setRequestedDate('');
    setNotes('');
  };

  const handleCreate = async () => {
    await createShipment.mutateAsync({
      customer_name: customerName || undefined,
      destination: destination || undefined,
      requested_date: requestedDate || undefined,
      notes: notes || undefined,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nouvelle expedition</DialogTitle>
          <DialogDescription>Creation du dossier logistique et export.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="shipment-customer">Client</Label>
            <Input id="shipment-customer" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shipment-destination">Destination</Label>
            <Input id="shipment-destination" value={destination} onChange={(event) => setDestination(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shipment-date">Date demandee</Label>
            <Input id="shipment-date" type="date" value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shipment-notes">Notes</Label>
            <Textarea id="shipment-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={createShipment.isPending}>
            Creer l'expedition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type RecallDialogProps = {
  shipment: ShipmentPreparation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const RecallDialog = ({ shipment, open, onOpenChange }: RecallDialogProps) => {
  if (!shipment) return null;

  const report = buildRecallReport(shipment);
  const checklist = getShipmentChecklist(shipment);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Mock recall - {shipment.shipment_number}</DialogTitle>
          <DialogDescription>
            Simulation de rappel produit pour verifier la capacite de remontee lot-client.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-5">
              <div className="text-2xl font-bold">{checklist.lotCoverage}%</div>
              <div className="text-sm text-muted-foreground">Couverture tracabilite</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-2xl font-bold">{checklist.totalLines}</div>
              <div className="text-sm text-muted-foreground">Lignes impactees</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-2xl font-bold">{checklist.recallReady ? 'OK' : 'KO'}</div>
              <div className="text-sm text-muted-foreground">Objectif &lt; 4h</div>
            </CardContent>
          </Card>
        </div>

        <Textarea value={report} readOnly rows={18} className="font-mono text-xs" />

        <DialogFooter>
          <Button variant="outline" onClick={() => downloadTextReport(`${shipment.shipment_number}-mock-recall.txt`, report)}>
            Exporter le rapport
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type ShipmentDetailDialogProps = {
  shipment: ShipmentPreparation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  finishedLots: StockLot[];
  actorName: string;
};

const ShipmentDetailDialog = ({
  shipment,
  open,
  onOpenChange,
  products,
  finishedLots,
  actorName,
}: ShipmentDetailDialogProps) => {
  const updateShipment = useUpdateShipment();
  const createShipmentLine = useCreateShipmentLine();
  const [customerName, setCustomerName] = useState('');
  const [destination, setDestination] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [requestedQuantity, setRequestedQuantity] = useState('0');
  const [manualLotId, setManualLotId] = useState(EMPTY_LOT_VALUE);
  const [lineNotes, setLineNotes] = useState('');
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const matchingLots = finishedLots.filter((lot) => lot.product_id === selectedProductId && lot.current_quantity > 0);
  const suggestions = useLotSuggestions(selectedProductId, Number(requestedQuantity || 0)).data || [];

  useEffect(() => {
    if (!shipment) return;
    setCustomerName(shipment.customer_name || '');
    setDestination(shipment.destination || '');
    setRequestedDate(shipment.requested_date || '');
    setNotes(shipment.notes || '');
  }, [shipment]);

  if (!shipment) return null;

  const checklist = getShipmentChecklist(shipment);

  const resetLineForm = () => {
    setSelectedProductId('');
    setRequestedQuantity('0');
    setManualLotId(EMPTY_LOT_VALUE);
    setLineNotes('');
  };

  const handleHeaderSave = async () => {
    await updateShipment.mutateAsync({
      id: shipment.id,
      customer_name: customerName || null,
      destination: destination || null,
      requested_date: requestedDate || null,
      notes: notes || null,
    });
  };

  const handleAddLine = async (lotId?: string | null, suggestedBySystem = false) => {
    if (!selectedProductId || Number(requestedQuantity || 0) <= 0) return;
    const lot = finishedLots.find((item) => item.id === lotId);
    const pickedQuantity = clampPickedQuantity(Number(requestedQuantity), lot);

    await createShipmentLine.mutateAsync({
      shipment_id: shipment.id,
      product_id: selectedProductId,
      lot_id: lotId || null,
      requested_quantity: Number(requestedQuantity),
      picked_quantity: pickedQuantity,
      picked_by: pickedQuantity > 0 ? actorName : undefined,
      picked_at: pickedQuantity > 0 ? new Date().toISOString() : undefined,
      suggested_by_system: suggestedBySystem,
      unit: selectedProduct?.unit || 'kg',
      notes: lineNotes || undefined,
    });
    resetLineForm();
  };

  const handleStatusChange = async (status: ShipmentStatus) => {
    const updates: Partial<ShipmentPreparation> & { id: string } = {
      id: shipment.id,
      status,
    };

    if (status === 'READY') {
      updates.prepared_at = new Date().toISOString();
      updates.prepared_by = actorName;
    }

    if (status === 'SHIPPED') {
      updates.shipped_at = new Date().toISOString();
      updates.validated_by = actorName;
    }

    await updateShipment.mutateAsync(updates);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            {shipment.shipment_number}
          </DialogTitle>
          <DialogDescription>
            Preparation expedition, documentation export et verification de tracabilite.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr,0.8fr] gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Entete expedition</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="detail-customer">Client</Label>
                  <Input id="detail-customer" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="detail-destination">Destination</Label>
                  <Input id="detail-destination" value={destination} onChange={(event) => setDestination(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="detail-date">Date demandee</Label>
                  <Input id="detail-date" type="date" value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="detail-status">Statut</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <Badge className={`${shipmentStatusColors[shipment.status as ShipmentStatus] || 'bg-slate-500'} text-white`}>
                      {shipmentStatusLabels[shipment.status as ShipmentStatus] || shipment.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Cree le {formatDateTime(shipment.created_at)}
                    </span>
                  </div>
                </div>
                <div className="md:col-span-2 grid gap-2">
                  <Label htmlFor="detail-notes">Notes logistiques</Label>
                  <Textarea id="detail-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleHeaderSave} disabled={updateShipment.isPending}>
                    Enregistrer l'entete
                  </Button>
                  {shipment.status === 'DRAFT' && (
                    <Button onClick={() => handleStatusChange('PICKING')} disabled={updateShipment.isPending}>
                      Passer en picking
                    </Button>
                  )}
                  {(shipment.status === 'DRAFT' || shipment.status === 'PICKING') && (
                    <Button
                      variant="secondary"
                      onClick={() => handleStatusChange('READY')}
                      disabled={!checklist.conformityReady || updateShipment.isPending}
                    >
                      Marquer pret
                    </Button>
                  )}
                  {shipment.status === 'READY' && (
                    <Button onClick={() => handleStatusChange('SHIPPED')} disabled={updateShipment.isPending}>
                      Expedier
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ajouter une ligne</CardTitle>
                <CardDescription>Picking FEFO/FIFO avec suggestion systeme.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Produit fini</Label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un produit" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.code} · {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Quantite demandee</Label>
                    <Input type="number" min="0" step="0.01" value={requestedQuantity} onChange={(event) => setRequestedQuantity(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Lot manuel</Label>
                    <Select value={manualLotId} onValueChange={setManualLotId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Aucun" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_LOT_VALUE}>Sans lot pour l'instant</SelectItem>
                        {matchingLots.map((lot) => (
                          <SelectItem key={lot.id} value={lot.id}>
                            {lot.lot_number} · {Number(lot.current_quantity).toLocaleString('fr-FR')} {lot.unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Notes ligne</Label>
                  <Input value={lineNotes} onChange={(event) => setLineNotes(event.target.value)} />
                </div>

                {suggestions.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-dashed p-3">
                    <div className="text-sm font-medium">Suggestions systeme</div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {suggestions.slice(0, 4).map((suggestion) => {
                        const suggestedLot = finishedLots.find((lot) => lot.id === suggestion.lot_id);
                        return (
                          <div key={suggestion.lot_id} className="rounded-lg border p-3">
                            <div className="font-medium">{suggestion.lot_number}</div>
                            <div className="text-xs text-muted-foreground">
                              Disponible: {Number(suggestion.available_qty).toLocaleString('fr-FR')} {selectedProduct?.unit || 'kg'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Regle: {suggestion.rotation_rule} · Date tri: {formatDateOnly(suggestion.sort_date)}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3"
                              onClick={() => handleAddLine(suggestedLot?.id, true)}
                            >
                              Utiliser la suggestion
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleAddLine(manualLotId === EMPTY_LOT_VALUE ? null : manualLotId, false)}
                    disabled={!selectedProductId || Number(requestedQuantity || 0) <= 0 || createShipmentLine.isPending}
                  >
                    Ajouter la ligne
                  </Button>
                  <Button variant="ghost" onClick={resetLineForm}>
                    Reinitialiser
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lignes de preparation</CardTitle>
              </CardHeader>
              <CardContent>
                {(shipment.lines || []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">Aucune ligne n'a encore ete planifiee.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead>Demande</TableHead>
                        <TableHead>Lot</TableHead>
                        <TableHead>Picke</TableHead>
                        <TableHead>Traceabilite</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(shipment.lines || []).map((line) => (
                        <ShipmentLineEditor
                          key={line.id}
                          line={line}
                          shipmentStatus={shipment.status}
                          lots={finishedLots}
                          actorName={actorName}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Readiness export</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Couverture lot/genealogie</span>
                    <span className="font-medium">{checklist.lotCoverage}%</span>
                  </div>
                  <Progress value={checklist.lotCoverage} className="h-2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Demande</div>
                    <div className="text-xl font-bold">{checklist.totalRequested.toLocaleString('fr-FR')}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Prepare</div>
                    <div className="text-xl font-bold">{checklist.totalPicked.toLocaleString('fr-FR')}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Certificat de conformite', ready: checklist.conformityReady },
                    { label: 'Base phytosanitaire', ready: checklist.phytosanitaryReady },
                    { label: 'Rapport genealogie', ready: checklist.genealogyReady },
                    { label: 'Mock recall', ready: checklist.recallReady },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <span className="text-sm">{item.label}</span>
                      {item.ready ? (
                        <Badge className="bg-emerald-600 text-white">Pret</Badge>
                      ) : (
                        <Badge variant="destructive">A completer</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documents generes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => downloadTextReport(`${shipment.shipment_number}-conformite.txt`, buildConformityReport(shipment))}
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  Certificat de conformite
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => downloadTextReport(`${shipment.shipment_number}-genealogie.txt`, buildGenealogyReport(shipment))}
                >
                  <FileSearch className="h-4 w-4 mr-2" />
                  Rapport genealogie lot
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => downloadTextReport(`${shipment.shipment_number}-phytosanitaire.txt`, buildPhytosanitaryReport(shipment))}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Fiche phytosanitaire
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions ouvertes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {checklist.openActions.length === 0 ? (
                  <div className="text-sm text-emerald-700">Le dossier expedition est complet.</div>
                ) : (
                  checklist.openActions.map((action) => (
                    <div key={action} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span>{action}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const LogisticsDashboard = () => {
  const { user, profile } = useAuthContext();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ShipmentStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [recallShipmentId, setRecallShipmentId] = useState<string | null>(null);
  const { data: shipments = [] } = useShipments();
  const { data: finishedProducts = [] } = useProducts('PF');
  const { data: finishedLots = [] } = useStockLots({ category: 'PF' });
  const actorName = profile?.full_name || user?.email || 'system';

  const selectedShipment = shipments.find((shipment) => shipment.id === selectedShipmentId) || null;
  const recallShipment = shipments.find((shipment) => shipment.id === recallShipmentId) || null;

  const filteredShipments = shipments.filter((shipment) => {
    const matchesStatus = statusFilter === 'all' || shipment.status === statusFilter;
    const haystack = [
      shipment.shipment_number,
      shipment.customer_name,
      shipment.destination,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return matchesStatus && haystack.includes(search.toLowerCase());
  });

  const allLines = shipments.flatMap((shipment) => shipment.lines || []);
  const traceabilityCoverage =
    allLines.length > 0
      ? Math.round((allLines.filter((line) => line.lot_id).length / allLines.length) * 100)
      : 0;
  const readyShipments = shipments.filter((shipment) => shipment.status === 'READY').length;
  const shippedShipments = shipments.filter((shipment) => shipment.status === 'SHIPPED').length;
  const openActions = shipments.reduce((sum, shipment) => sum + getShipmentChecklist(shipment).openActions.length, 0);
  const compliantShipments = shipments.filter((shipment) => {
    const checklist = getShipmentChecklist(shipment);
    return checklist.conformityReady && checklist.phytosanitaryReady && checklist.genealogyReady;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Ship className="h-7 w-7 text-primary" />
            Logistics & Export
          </h1>
          <p className="text-muted-foreground mt-1">
            Expedition, preparation lots, documents export et exercices de rappel.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle expedition
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{shipments.length}</div>
                <div className="text-sm text-muted-foreground">Dossiers expedition</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <div>
                <div className="text-2xl font-bold">{traceabilityCoverage}%</div>
                <div className="text-sm text-muted-foreground">Couverture tracabilite</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-violet-600" />
              <div>
                <div className="text-2xl font-bold">{compliantShipments}</div>
                <div className="text-sm text-muted-foreground">Dossiers export complets</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <TimerReset className="h-5 w-5 text-amber-600" />
              <div>
                <div className="text-2xl font-bold">{openActions}</div>
                <div className="text-sm text-muted-foreground">Actions ouvertes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="shipments" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="shipments">Expeditions</TabsTrigger>
          <TabsTrigger value="stock-pf" className="gap-1">
            Stock PF
            {finishedLots.filter((lot) => lot.status === 'VALIDATED').length > 0 && (
              <span className="text-[11px] bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 leading-none font-semibold">
                {finishedLots.filter((lot) => lot.status === 'VALIDATED').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="transport">Transport live</TabsTrigger>
          <TabsTrigger value="compliance">Conformite export</TabsTrigger>
          <TabsTrigger value="recall">Mock recall</TabsTrigger>
        </TabsList>

        <TabsContent value="shipments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline expedition</CardTitle>
              <CardDescription>
                {readyShipments} pretes a partir, {shippedShipments} deja expediees.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="Rechercher par numero, client ou destination"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | ShipmentStatus)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="DRAFT">Brouillon</SelectItem>
                    <SelectItem value="PICKING">En preparation</SelectItem>
                    <SelectItem value="READY">Pret</SelectItem>
                    <SelectItem value="SHIPPED">Expedie</SelectItem>
                    <SelectItem value="CANCELLED">Annule</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filteredShipments.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  Aucune expedition ne correspond aux filtres.
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredShipments.map((shipment) => {
                    const checklist = getShipmentChecklist(shipment);

                    return (
                      <button
                        key={shipment.id}
                        className="w-full rounded-xl border p-4 text-left transition-colors hover:bg-muted/40"
                        onClick={() => setSelectedShipmentId(shipment.id)}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-semibold">{shipment.shipment_number}</span>
                              <Badge className={`${shipmentStatusColors[shipment.status as ShipmentStatus] || 'bg-slate-500'} text-white`}>
                                {shipmentStatusLabels[shipment.status as ShipmentStatus] || shipment.status}
                              </Badge>
                              {checklist.openActions.length === 0 ? (
                                <Badge className="bg-emerald-600 text-white">Export ready</Badge>
                              ) : (
                                <Badge variant="outline">{checklist.openActions.length} actions</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground flex flex-wrap gap-4">
                              <span className="inline-flex items-center gap-1">
                                <Package2 className="h-3.5 w-3.5" />
                                {shipment.customer_name || 'Client a definir'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {shipment.destination || 'Destination a definir'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Ship className="h-3.5 w-3.5" />
                                Date demandee: {formatDateOnly(shipment.requested_date)}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 min-w-[260px]">
                            <div className="rounded-lg bg-slate-50 p-3">
                              <div className="text-xs text-muted-foreground">Lignes</div>
                              <div className="text-xl font-bold">{checklist.totalLines}</div>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-3">
                              <div className="text-xs text-muted-foreground">Lots lies</div>
                              <div className="text-xl font-bold">{checklist.lotCoverage}%</div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock-pf" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package2 className="h-5 w-5 text-emerald-600" />
                Stock produits finis disponibles
              </CardTitle>
              <CardDescription>
                Palettes scellees (SSCC) validees issues du conditionnement — prets a integrer dans une expedition.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {finishedLots.filter((lot) => lot.status === 'VALIDATED').length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  Aucun lot produit fini valide disponible. Scellez des palettes en conditionnement pour les voir apparaitre ici.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SSCC / Lot</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Variete / Grade</TableHead>
                      <TableHead>Poids net</TableHead>
                      <TableHead>Date cond.</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finishedLots
                      .filter((lot) => lot.status === 'VALIDATED')
                      .map((lot) => (
                        <TableRow key={lot.id}>
                          <TableCell>
                            <div className="font-mono font-semibold text-sm">{lot.lot_number}</div>
                            {(lot as { quality_notes?: string }).quality_notes && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">{(lot as { quality_notes?: string }).quality_notes}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">{lot.source_lot_internal || '—'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">{lot.variety || '—'}</div>
                            <div className="text-[11px] text-muted-foreground">{lot.origin_country || '—'}</div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{Number(lot.current_quantity || 0).toLocaleString('fr-FR')}</span>
                            <span className="text-xs text-muted-foreground ml-1">{lot.unit}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">{formatDateOnly(lot.packaging_date || lot.reception_date)}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-600 text-white text-xs">VALIDE</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transport">
          <TransportWorkspace />
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>Matrice conformite export</CardTitle>
              <CardDescription>
                Controle automatique des documents et de la genealogie par expedition.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shipments.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucune expedition disponible.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expedition</TableHead>
                      <TableHead>Conformite</TableHead>
                      <TableHead>Phyto</TableHead>
                      <TableHead>Genealogie</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipments.map((shipment) => {
                      const checklist = getShipmentChecklist(shipment);
                      return (
                        <TableRow key={shipment.id}>
                          <TableCell>
                            <div className="font-medium">{shipment.shipment_number}</div>
                            <div className="text-xs text-muted-foreground">{shipment.customer_name || '-'}</div>
                          </TableCell>
                          <TableCell>
                            {checklist.conformityReady ? (
                              <Badge className="bg-emerald-600 text-white">Pret</Badge>
                            ) : (
                              <Badge variant="destructive">A completer</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {checklist.phytosanitaryReady ? (
                              <Badge className="bg-emerald-600 text-white">Pret</Badge>
                            ) : (
                              <Badge variant="destructive">A completer</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {checklist.genealogyReady ? (
                              <Badge className="bg-emerald-600 text-white">Pret</Badge>
                            ) : (
                              <Badge variant="destructive">A completer</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadTextReport(`${shipment.shipment_number}-conformite.txt`, buildConformityReport(shipment))}
                              >
                                Conformite
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadTextReport(`${shipment.shipment_number}-genealogie.txt`, buildGenealogyReport(shipment))}
                              >
                                Genealogie
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recall">
          <Card>
            <CardHeader>
              <CardTitle>Exercices de rappel</CardTitle>
              <CardDescription>
                Verification rapide de l'identification lots-client selon l'objectif &lt; 4 heures du cahier des charges.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {shipments.filter((shipment) => shipment.status === 'READY' || shipment.status === 'SHIPPED').length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  Aucune expedition prete pour un exercice de rappel.
                </div>
              ) : (
                shipments
                  .filter((shipment) => shipment.status === 'READY' || shipment.status === 'SHIPPED')
                  .map((shipment) => {
                    const checklist = getShipmentChecklist(shipment);
                    return (
                      <div key={shipment.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-medium">{shipment.shipment_number}</div>
                          <div className="text-sm text-muted-foreground">
                            {shipment.customer_name || '-'} · {shipment.destination || '-'}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {checklist.recallReady ? (
                            <div className="inline-flex items-center gap-2 text-sm text-emerald-700">
                              <CheckCircle2 className="h-4 w-4" />
                              Recall ready
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 text-sm text-amber-700">
                              <AlertTriangle className="h-4 w-4" />
                              Donnees incompletes
                            </div>
                          )}
                          <Button variant="outline" onClick={() => setRecallShipmentId(shipment.id)}>
                            Simuler
                          </Button>
                        </div>
                      </div>
                    );
                  })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateShipmentDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ShipmentDetailDialog
        shipment={selectedShipment}
        open={Boolean(selectedShipment)}
        onOpenChange={(open) => !open && setSelectedShipmentId(null)}
        products={finishedProducts}
        finishedLots={finishedLots.filter((lot) => lot.status === 'VALIDATED')}
        actorName={actorName}
      />
      <RecallDialog
        shipment={recallShipment}
        open={Boolean(recallShipment)}
        onOpenChange={(open) => !open && setRecallShipmentId(null)}
      />
    </div>
  );
};
