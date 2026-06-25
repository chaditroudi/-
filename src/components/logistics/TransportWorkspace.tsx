import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CalendarClock,
  CarFront,
  Clock3,
  MapPinned,
  Navigation,
  Package2,
  Phone,
  Plus,
  Route,
  ShieldAlert,
  Timer,
  Truck,
  UserRound,
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import {
  useCreateTransportDriver,
  useCreateTransportMission,
  useCreateTransportPositionLog,
  useCreateTransportVehicle,
  useMissionPositions,
  useTransportDrivers,
  useTransportMissions,
  useTransportVehicles,
  useUpdateTransportMission,
} from '@/hooks/useTransport';
import { useShipments } from '@/hooks/useStock';
import type {
  TransportDriver,
  TransportDriverStatus,
  TransportMission,
  TransportMissionStatus,
  TransportMissionType,
  TransportPositionLog,
  TransportVehicle,
  TransportVehicleStatus,
} from '@/types/transport';
import {
  transportDriverStatusLabels,
  transportMissionStatusLabels,
  transportMissionTypeLabels,
  transportPositionStatusLabels,
  transportStatusColor,
  transportVehicleStatusLabels,
} from '@/types/transport';
import type { ShipmentPreparation } from '@/types/stock';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const EMPTY_VALUE = '__none__';
const ACTIVE_MISSION_STATUSES: TransportMissionStatus[] = ['READY_TO_DEPART', 'EN_ROUTE'];

const formatDateTime = (value?: string | null) =>
  value ? format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: fr }) : '-';

const formatShortDateTime = (value?: string | null) =>
  value ? format(new Date(value), 'dd/MM HH:mm', { locale: fr }) : '-';

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromDateTimeLocalValue = (value: string) => (value ? new Date(value).toISOString() : null);

const toCoordinateText = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(5) : '-';

const getMinutesFromNow = (value?: string | null) => {
  if (!value) return null;
  return Math.round((new Date(value).getTime() - Date.now()) / 60000);
};

const isMissionLate = (mission: TransportMission, etaAlertMinutes: number) => {
  if (!mission.planned_arrival_at) return false;
  if (['ARRIVED', 'COMPLETED', 'CANCELLED'].includes(mission.status)) return false;
  return Date.now() > new Date(mission.planned_arrival_at).getTime() + etaAlertMinutes * 60000;
};

const getTrackingFreshness = (value?: string | null) => {
  if (!value) return 'Aucune position';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'À l’instant';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} h`;
};

const downloadMissionOrder = (mission: TransportMission) => {
  const content = [
    'ORDRE DE MISSION TRANSPORT',
    `Mission: ${mission.mission_number}`,
    `Type: ${transportMissionTypeLabels[mission.mission_type] || mission.mission_type}`,
    `Statut: ${transportMissionStatusLabels[mission.status] || mission.status}`,
    `Départ prévu: ${formatDateTime(mission.planned_departure_at)}`,
    `Arrivée prévue: ${formatDateTime(mission.planned_arrival_at)}`,
    `Origine: ${mission.origin_label || '-'}`,
    `Destination: ${mission.destination_label || '-'}`,
    `Adresse destination: ${mission.destination_address || '-'}`,
    `Camion: ${mission.vehicle?.registration_number || '-'}`,
    `Chauffeur: ${mission.driver?.full_name || '-'}`,
    `Expédition: ${mission.shipment?.shipment_number || '-'}`,
    `Cargo: ${mission.cargo_summary || '-'}`,
    `Suivi live: ${mission.tracking_active ? 'actif' : 'inactif'}`,
    '',
    'NOTES',
    mission.notes || '-',
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${mission.mission_number}-ordre-mission.txt`;
  link.click();
  window.URL.revokeObjectURL(url);
};

const getMapSrc = (mission: TransportMission | null, googleMapsApiKey: string | null, zoom: number) => {
  if (!mission) return null;
  const origin = mission.origin_label || 'Usine';
  const destination = mission.destination_address || mission.destination_label || mission.origin_label || 'Destination';

  if (googleMapsApiKey && mission.origin_label && destination) {
    return `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(googleMapsApiKey)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving`;
  }

  if (typeof mission.last_latitude === 'number' && typeof mission.last_longitude === 'number') {
    return `https://www.google.com/maps?q=${mission.last_latitude},${mission.last_longitude}&z=${zoom}&output=embed`;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(destination)}&z=${zoom}&output=embed`;
};

const getDirectionsUrl = (mission: TransportMission) => {
  const origin = mission.origin_label || 'Usine';
  const destination = mission.destination_address || mission.destination_label || mission.origin_label || 'Destination';
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
};

const MetricCard = ({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: typeof Truck;
}) => (
  <Card>
    <CardContent className="pt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <div className="rounded-xl border bg-muted/30 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

function CreateVehicleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createVehicle = useCreateTransportVehicle();
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [trailerNumber, setTrailerNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Camion porteur');
  const [capacityKg, setCapacityKg] = useState('12000');
  const [gpsDeviceId, setGpsDeviceId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) {
      setRegistrationNumber('');
      setTrailerNumber('');
      setVehicleType('Camion porteur');
      setCapacityKg('12000');
      setGpsDeviceId('');
      setNotes('');
    }
  }, [open]);

  const handleCreate = async () => {
    await createVehicle.mutateAsync({
      registration_number: registrationNumber.trim().toUpperCase(),
      trailer_number: trailerNumber.trim() || null,
      vehicle_type: vehicleType || null,
      capacity_kg: Number(capacityKg || 0),
      gps_device_id: gpsDeviceId.trim() || null,
      notes: notes.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouveau camion</DialogTitle>
          <DialogDescription>Ajoute un véhicule exploitable dans les missions logistiques.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Immatriculation</Label>
            <Input value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} placeholder="123-TUN-456" />
          </div>
          <div className="space-y-2">
            <Label>Remorque</Label>
            <Input value={trailerNumber} onChange={(event) => setTrailerNumber(event.target.value)} placeholder="REM-22" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Input value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} placeholder="Semi-remorque" />
          </div>
          <div className="space-y-2">
            <Label>Capacité (kg)</Label>
            <Input type="number" min="0" value={capacityKg} onChange={(event) => setCapacityKg(event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Identifiant GPS / balise</Label>
            <Input value={gpsDeviceId} onChange={(event) => setGpsDeviceId(event.target.value)} placeholder="TELTONIKA-07" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Capacité réelle, restrictions, maintenance..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={createVehicle.isPending || !registrationNumber.trim()}>
            Ajouter le camion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDriverDialog({
  open,
  onOpenChange,
  vehicles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: TransportVehicle[];
}) {
  const createDriver = useCreateTransportDriver();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
  const [preferredVehicleId, setPreferredVehicleId] = useState(EMPTY_VALUE);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) {
      setFullName('');
      setPhone('');
      setLicenseNumber('');
      setLicenseExpiryDate('');
      setPreferredVehicleId(EMPTY_VALUE);
      setNotes('');
    }
  }, [open]);

  const handleCreate = async () => {
    await createDriver.mutateAsync({
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      license_number: licenseNumber.trim() || null,
      license_expiry_date: licenseExpiryDate || null,
      preferred_vehicle_id: preferredVehicleId === EMPTY_VALUE ? null : preferredVehicleId,
      notes: notes.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouveau chauffeur</DialogTitle>
          <DialogDescription>Ajoute un conducteur exploitable dans les ordres de mission.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nom complet</Label>
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Ahmed Ben Salah" />
          </div>
          <div className="space-y-2">
            <Label>Téléphone</Label>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+216..." />
          </div>
          <div className="space-y-2">
            <Label>Permis / référence</Label>
            <Input value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} placeholder="P-2026-8821" />
          </div>
          <div className="space-y-2">
            <Label>Expiration permis</Label>
            <Input type="date" value={licenseExpiryDate} onChange={(event) => setLicenseExpiryDate(event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Camion préféré</Label>
            <Select value={preferredVehicleId} onValueChange={setPreferredVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un camion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_VALUE}>Aucun camion favori</SelectItem>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Permis spécial, zones habituelles, commentaires..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={createDriver.isPending || !fullName.trim()}>
            Ajouter le chauffeur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateMissionDialog({
  open,
  onOpenChange,
  vehicles,
  drivers,
  shipments,
  actorName,
  originLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: TransportVehicle[];
  drivers: TransportDriver[];
  shipments: ShipmentPreparation[];
  actorName: string;
  originLabel: string;
}) {
  const createMission = useCreateTransportMission();
  const [missionType, setMissionType] = useState<TransportMissionType>('DELIVERY');
  const [shipmentId, setShipmentId] = useState(EMPTY_VALUE);
  const [vehicleId, setVehicleId] = useState(EMPTY_VALUE);
  const [driverId, setDriverId] = useState(EMPTY_VALUE);
  const [destinationLabel, setDestinationLabel] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [plannedDepartureAt, setPlannedDepartureAt] = useState('');
  const [plannedArrivalAt, setPlannedArrivalAt] = useState('');
  const [estimatedDistanceKm, setEstimatedDistanceKm] = useState('');
  const [cargoSummary, setCargoSummary] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) {
      setMissionType('DELIVERY');
      setShipmentId(EMPTY_VALUE);
      setVehicleId(EMPTY_VALUE);
      setDriverId(EMPTY_VALUE);
      setDestinationLabel('');
      setDestinationAddress('');
      setPlannedDepartureAt('');
      setPlannedArrivalAt('');
      setEstimatedDistanceKm('');
      setCargoSummary('');
      setNotes('');
    }
  }, [open]);

  const handleCreate = async () => {
    await createMission.mutateAsync({
      mission_type: missionType,
      shipment_id: shipmentId === EMPTY_VALUE ? null : shipmentId,
      vehicle_id: vehicleId === EMPTY_VALUE ? null : vehicleId,
      driver_id: driverId === EMPTY_VALUE ? null : driverId,
      origin_label: originLabel,
      destination_label: destinationLabel.trim(),
      destination_address: destinationAddress.trim() || destinationLabel.trim(),
      planned_departure_at: fromDateTimeLocalValue(plannedDepartureAt),
      planned_arrival_at: fromDateTimeLocalValue(plannedArrivalAt),
      estimated_distance_km: estimatedDistanceKm ? Number(estimatedDistanceKm) : null,
      cargo_summary: cargoSummary.trim() || null,
      notes: notes.trim() || null,
      created_by: actorName,
      updated_by: actorName,
      status: 'PLANNED',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nouvel ordre de mission</DialogTitle>
          <DialogDescription>Planifie un départ camion/chauffeur avec ETA et tracking live.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Type mission</Label>
            <Select value={missionType} onValueChange={(value) => setMissionType(value as TransportMissionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DELIVERY">Livraison</SelectItem>
                <SelectItem value="TRANSFER">Transfert</SelectItem>
                <SelectItem value="COLLECTION">Collecte</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Expédition liée</Label>
            <Select value={shipmentId} onValueChange={setShipmentId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une expédition" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_VALUE}>Sans expédition liée</SelectItem>
                {shipments.map((shipment) => (
                  <SelectItem key={shipment.id} value={shipment.id}>
                    {shipment.shipment_number} · {shipment.destination || 'Destination'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Camion</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un camion" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_VALUE}>À affecter plus tard</SelectItem>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Chauffeur</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un chauffeur" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_VALUE}>À affecter plus tard</SelectItem>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Destination</Label>
            <Input value={destinationLabel} onChange={(event) => setDestinationLabel(event.target.value)} placeholder="Client / dépôt / zone" />
          </div>
          <div className="space-y-2">
            <Label>Adresse destination</Label>
            <Input value={destinationAddress} onChange={(event) => setDestinationAddress(event.target.value)} placeholder="Adresse précise, coordonnées, repères..." />
          </div>
          <div className="space-y-2">
            <Label>Départ prévu</Label>
            <Input type="datetime-local" value={plannedDepartureAt} onChange={(event) => setPlannedDepartureAt(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Arrivée prévue</Label>
            <Input type="datetime-local" value={plannedArrivalAt} onChange={(event) => setPlannedArrivalAt(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Distance estimée (km)</Label>
            <Input type="number" min="0" value={estimatedDistanceKm} onChange={(event) => setEstimatedDistanceKm(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Charge / résumé</Label>
            <Input value={cargoSummary} onChange={(event) => setCargoSummary(event.target.value)} placeholder="Palette 12, carton export, retour palette..." />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Consignes chauffeur, docs à remettre, température ciblée..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={createMission.isPending || !destinationLabel.trim()}>
            Créer la mission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MissionDetailDialog({
  mission,
  open,
  onOpenChange,
  vehicles,
  drivers,
  actorName,
  trackingEnabledBySettings,
  trackingRefreshSeconds,
  etaAlertMinutes,
  mapsApiKey,
  mapsZoom,
}: {
  mission: TransportMission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: TransportVehicle[];
  drivers: TransportDriver[];
  actorName: string;
  trackingEnabledBySettings: boolean;
  trackingRefreshSeconds: number;
  etaAlertMinutes: number;
  mapsApiKey: string | null;
  mapsZoom: number;
}) {
  const updateMission = useUpdateTransportMission();
  const createPositionLog = useCreateTransportPositionLog();
  const { data: positions = [] } = useMissionPositions(mission?.id, trackingRefreshSeconds);
  const [vehicleId, setVehicleId] = useState(EMPTY_VALUE);
  const [driverId, setDriverId] = useState(EMPTY_VALUE);
  const [status, setStatus] = useState<TransportMissionStatus>('PLANNED');
  const [plannedDepartureAt, setPlannedDepartureAt] = useState('');
  const [plannedArrivalAt, setPlannedArrivalAt] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [cargoSummary, setCargoSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef<number>(0);

  useEffect(() => {
    if (!mission) return;
    setVehicleId(mission.vehicle_id || EMPTY_VALUE);
    setDriverId(mission.driver_id || EMPTY_VALUE);
    setStatus(mission.status);
    setPlannedDepartureAt(toDateTimeLocalValue(mission.planned_departure_at));
    setPlannedArrivalAt(toDateTimeLocalValue(mission.planned_arrival_at));
    setDestinationAddress(mission.destination_address || mission.destination_label || '');
    setCargoSummary(mission.cargo_summary || '');
    setNotes(mission.notes || '');
    setTrackingEnabled(false);
    setGeoError(null);
    lastSentAtRef.current = 0;
  }, [mission?.id, mission]);

  useEffect(() => {
    if (!open || !mission || !trackingEnabled || !trackingEnabledBySettings) {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setGeoError('Le navigateur ne supporte pas la géolocalisation.');
      setTrackingEnabled(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSentAtRef.current < trackingRefreshSeconds * 1000) {
          return;
        }
        lastSentAtRef.current = now;
        setGeoError(null);
        void createPositionLog.mutateAsync({
          mission_id: mission.id,
          vehicle_id: mission.vehicle_id || null,
          driver_id: mission.driver_id || null,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy ?? null,
          speed_kmh: position.coords.speed != null ? Math.round(position.coords.speed * 3.6 * 10) / 10 : null,
          heading: position.coords.heading ?? null,
          source: 'driver_browser',
          position_status: position.coords.speed != null && position.coords.speed < 1 ? 'idle' : 'moving',
        });
      },
      (error) => {
        setGeoError(error.message || 'Position inaccessible.');
        setTrackingEnabled(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      },
    );

    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [
    createPositionLog,
    mission,
    open,
    trackingEnabled,
    trackingEnabledBySettings,
    trackingRefreshSeconds,
  ]);

  if (!mission) return null;

  const handleSave = async () => {
    await updateMission.mutateAsync({
      id: mission.id,
      vehicle_id: vehicleId === EMPTY_VALUE ? null : vehicleId,
      driver_id: driverId === EMPTY_VALUE ? null : driverId,
      status,
      planned_departure_at: fromDateTimeLocalValue(plannedDepartureAt),
      planned_arrival_at: fromDateTimeLocalValue(plannedArrivalAt),
      destination_address: destinationAddress.trim() || null,
      cargo_summary: cargoSummary.trim() || null,
      notes: notes.trim() || null,
      updated_by: actorName,
    });
  };

  const handleStatusAction = async (nextStatus: TransportMissionStatus) => {
    const patch: Partial<TransportMission> & { id: string } = {
      id: mission.id,
      status: nextStatus,
      tracking_active: nextStatus === 'EN_ROUTE',
      updated_by: actorName,
    };

    if (nextStatus === 'EN_ROUTE' && !mission.actual_departure_at) {
      patch.actual_departure_at = new Date().toISOString();
    }

    if (nextStatus === 'ARRIVED' && !mission.actual_arrival_at) {
      patch.actual_arrival_at = new Date().toISOString();
      patch.tracking_active = false;
      setTrackingEnabled(false);
    }

    if (nextStatus === 'COMPLETED') {
      patch.tracking_active = false;
      setTrackingEnabled(false);
    }

    await updateMission.mutateAsync(patch);
  };

  const mapSrc = getMapSrc(mission, mapsApiKey, mapsZoom);
  const isLate = isMissionLate(mission, etaAlertMinutes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mission.mission_number}
            <Badge className={`${transportStatusColor[mission.status] || 'bg-slate-500'} text-white`}>
              {transportMissionStatusLabels[mission.status] || mission.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Orchestration camion, chauffeur, ETA et tracking live pour la mission transport.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pilotage mission</CardTitle>
                <CardDescription>Planification, affectation et consignes transport.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Camion</Label>
                  <Select value={vehicleId} onValueChange={setVehicleId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_VALUE}>Aucun camion</SelectItem>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.registration_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chauffeur</Label>
                  <Select value={driverId} onValueChange={setDriverId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_VALUE}>Aucun chauffeur</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>{driver.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as TransportMissionStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PLANNED">Planifiée</SelectItem>
                      <SelectItem value="READY_TO_DEPART">Prête au départ</SelectItem>
                      <SelectItem value="EN_ROUTE">En route</SelectItem>
                      <SelectItem value="ARRIVED">Arrivée</SelectItem>
                      <SelectItem value="COMPLETED">Terminée</SelectItem>
                      <SelectItem value="CANCELLED">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Expédition liée</Label>
                  <Input value={mission.shipment?.shipment_number || '-'} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Départ prévu</Label>
                  <Input type="datetime-local" value={plannedDepartureAt} onChange={(event) => setPlannedDepartureAt(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Arrivée prévue</Label>
                  <Input type="datetime-local" value={plannedArrivalAt} onChange={(event) => setPlannedArrivalAt(event.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Adresse destination</Label>
                  <Input value={destinationAddress} onChange={(event) => setDestinationAddress(event.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Charge / documents</Label>
                  <Input value={cargoSummary} onChange={(event) => setCargoSummary(event.target.value)} placeholder="Bon de livraison, palettes, température..." />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Notes mission</Label>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
                </div>

                <div className="md:col-span-2 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleSave} disabled={updateMission.isPending}>
                    Enregistrer
                  </Button>
                  <Button variant="outline" onClick={() => handleStatusAction('READY_TO_DEPART')} disabled={updateMission.isPending}>
                    Prête au départ
                  </Button>
                  <Button onClick={() => handleStatusAction('EN_ROUTE')} disabled={updateMission.isPending}>
                    Marquer départ
                  </Button>
                  <Button variant="outline" onClick={() => handleStatusAction('ARRIVED')} disabled={updateMission.isPending}>
                    Marquer arrivée
                  </Button>
                  <Button variant="outline" onClick={() => handleStatusAction('COMPLETED')} disabled={updateMission.isPending}>
                    Clôturer
                  </Button>
                  <Button variant="ghost" onClick={() => downloadMissionOrder(mission)}>
                    Export ordre mission
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>Tracking chauffeur</span>
                  <div className="flex items-center gap-2 rounded-full border px-3 py-1">
                    <Switch
                      checked={trackingEnabled}
                      onCheckedChange={setTrackingEnabled}
                      disabled={!trackingEnabledBySettings}
                    />
                    <span className="text-xs text-muted-foreground">Suivi navigateur</span>
                  </div>
                </CardTitle>
                <CardDescription>
                  À ouvrir sur le téléphone du chauffeur pour pousser la position en continu toutes les {trackingRefreshSeconds}s.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Dernière position</div>
                    <div className="mt-1 font-semibold">
                      {toCoordinateText(mission.last_latitude)}, {toCoordinateText(mission.last_longitude)}
                    </div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Vitesse</div>
                    <div className="mt-1 font-semibold">{mission.last_speed_kmh ? `${mission.last_speed_kmh} km/h` : '-'}</div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Dernier ping</div>
                    <div className="mt-1 font-semibold">{getTrackingFreshness(mission.last_position_at)}</div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">ETA</div>
                    <div className={`mt-1 font-semibold ${isLate ? 'text-rose-600' : ''}`}>
                      {formatDateTime(mission.planned_arrival_at)}
                    </div>
                  </div>
                </div>

                {!trackingEnabledBySettings && (
                  <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Le tracking transport est désactivé dans Paramètres &gt; Intégrations.
                  </div>
                )}

                {geoError && (
                  <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {geoError}
                  </div>
                )}

                {trackingEnabled && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Tracking actif. Gardez cet écran ouvert pour envoyer la position live du camion.
                  </div>
                )}

                <div className="rounded-2xl border overflow-hidden">
                  {mapSrc ? (
                    <iframe
                      title={`Carte mission ${mission.mission_number}`}
                      src={mapSrc}
                      className="h-[360px] w-full border-0"
                      loading="lazy"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex h-[360px] items-center justify-center bg-muted/20 text-sm text-muted-foreground">
                      Carte indisponible pour cette mission.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild>
                    <a href={getDirectionsUrl(mission)} target="_blank" rel="noreferrer">
                      Ouvrir Google Maps
                    </a>
                  </Button>
                  <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
                    {mission.actual_departure_at ? `Départ réel ${formatShortDateTime(mission.actual_departure_at)}` : 'Départ réel non saisi'}
                  </div>
                  <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
                    {mission.actual_arrival_at ? `Arrivée réelle ${formatShortDateTime(mission.actual_arrival_at)}` : 'Arrivée réelle non saisie'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>État live mission</CardTitle>
                <CardDescription>Résumé opérationnel camion, chauffeur, retard et chargement.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Destination</div>
                  <div className="font-semibold">{mission.destination_label || mission.destination_address || '-'}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Camion</div>
                  <div className="font-semibold">{mission.vehicle?.registration_number || 'Non affecté'}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Chauffeur</div>
                  <div className="font-semibold">{mission.driver?.full_name || 'Non affecté'}</div>
                  {mission.driver?.phone && <div className="text-xs text-muted-foreground mt-1">{mission.driver.phone}</div>}
                </div>
                <div className={`rounded-xl border p-3 ${isLate ? 'border-rose-300 bg-rose-50' : ''}`}>
                  <div className="text-xs text-muted-foreground">Risque ETA</div>
                  <div className={`font-semibold ${isLate ? 'text-rose-700' : ''}`}>
                    {isLate ? `Retard > ${etaAlertMinutes} min` : 'Sous contrôle'}
                  </div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">Charge</div>
                  <div className="font-semibold">{mission.cargo_summary || '-'}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Derniers points GPS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {positions.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                    Aucun point GPS enregistré pour cette mission.
                  </div>
                ) : (
                  positions.slice(0, 8).map((position) => (
                    <div key={position.id} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium">{formatDateTime(position.captured_at)}</div>
                        <Badge variant="outline">{transportPositionStatusLabels[position.position_status] || position.position_status}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {toCoordinateText(position.latitude)}, {toCoordinateText(position.longitude)} · précision {position.accuracy_m ? `${Math.round(position.accuracy_m)} m` : '-'}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {position.speed_kmh ? `${position.speed_kmh} km/h` : 'vitesse -'} · source {position.source}
                      </div>
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
}

export function TransportWorkspace() {
  const { user, profile } = useAuthContext();
  const { settings } = useSettingsContext();
  const actorName = profile?.full_name || user?.email || 'system';
  const trackingRefreshSeconds = settings.integrations.tracking_refresh_seconds || 30;
  const mapsZoom = settings.integrations.maps_default_zoom || 10;
  const mapsApiKey = settings.integrations.google_maps_api_key || null;
  const trackingEnabledBySettings = settings.integrations.transport_tracking_enabled;
  const missionEtaAlertMinutes = settings.integrations.mission_eta_alert_minutes || 30;
  const originLabel = settings.plant_address || settings.plant_name || settings.company_name;

  const { data: vehicles = [] } = useTransportVehicles(undefined, trackingRefreshSeconds);
  const { data: drivers = [] } = useTransportDrivers(undefined, trackingRefreshSeconds);
  const { data: missions = [] } = useTransportMissions(undefined, trackingRefreshSeconds);
  const { data: shipments = [] } = useShipments();

  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [driverDialogOpen, setDriverDialogOpen] = useState(false);
  const [missionDialogOpen, setMissionDialogOpen] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [detailMissionId, setDetailMissionId] = useState<string | null>(null);

  const activeMissionVehicleIds = new Set(
    missions
      .filter((mission) => ACTIVE_MISSION_STATUSES.includes(mission.status) && mission.vehicle_id)
      .map((mission) => mission.vehicle_id as string),
  );
  const activeMissionDriverIds = new Set(
    missions
      .filter((mission) => ACTIVE_MISSION_STATUSES.includes(mission.status) && mission.driver_id)
      .map((mission) => mission.driver_id as string),
  );

  const selectedMission =
    missions.find((mission) => mission.id === selectedMissionId) ||
    missions.find((mission) => ACTIVE_MISSION_STATUSES.includes(mission.status)) ||
    missions[0] ||
    null;

  const detailMission = missions.find((mission) => mission.id === detailMissionId) || null;

  useEffect(() => {
    if (!selectedMissionId && missions.length > 0) {
      const preferred =
        missions.find((mission) => ACTIVE_MISSION_STATUSES.includes(mission.status)) ||
        missions[0];
      setSelectedMissionId(preferred.id);
    }
  }, [missions, selectedMissionId]);

  const activeMissions = missions.filter((mission) => ACTIVE_MISSION_STATUSES.includes(mission.status));
  const readyMissions = missions.filter((mission) => mission.status === 'READY_TO_DEPART').length;
  const lateMissions = missions.filter((mission) => isMissionLate(mission, missionEtaAlertMinutes)).length;
  const availableVehicles = vehicles.filter(
    (vehicle) =>
      vehicle.is_active &&
      !['MAINTENANCE', 'OUT_OF_SERVICE'].includes(vehicle.status) &&
      !activeMissionVehicleIds.has(vehicle.id),
  ).length;
  const assignedDrivers = drivers.filter((driver) => activeMissionDriverIds.has(driver.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-3">
            <Truck className="h-6 w-6 text-primary" />
            Transport & ordre de mission
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Flotte, chauffeurs, départs planifiés, ETA et suivi live camion dans le même cockpit logistique.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setVehicleDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Camion
          </Button>
          <Button variant="outline" onClick={() => setDriverDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Chauffeur
          </Button>
          <Button onClick={() => setMissionDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Ordre mission
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Missions actives"
          value={activeMissions.length}
          description={`${readyMissions} prêtes à partir`}
          icon={Route}
        />
        <MetricCard
          title="Camions disponibles"
          value={availableVehicles}
          description={`${vehicles.length} dans la flotte`}
          icon={CarFront}
        />
        <MetricCard
          title="Chauffeurs affectés"
          value={assignedDrivers}
          description={`${drivers.length} chauffeurs enregistrés`}
          icon={UserRound}
        />
        <MetricCard
          title="ETA à risque"
          value={lateMissions}
          description={`alerte après ${missionEtaAlertMinutes} min`}
          icon={ShieldAlert}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tableau des missions</CardTitle>
            <CardDescription>
              Sélectionne une mission pour voir la carte live, l’ETA et le suivi chauffeur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {missions.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Aucune mission transport créée. Commence par un ordre de mission.
              </div>
            ) : (
              missions.map((mission) => {
                const etaMinutes = getMinutesFromNow(mission.planned_arrival_at);
                const missionLate = isMissionLate(mission, missionEtaAlertMinutes);
                return (
                  <button
                    key={mission.id}
                    type="button"
                    onClick={() => setSelectedMissionId(mission.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      selectedMission?.id === mission.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{mission.mission_number}</span>
                          <Badge className={`${transportStatusColor[mission.status] || 'bg-slate-500'} text-white`}>
                            {transportMissionStatusLabels[mission.status] || mission.status}
                          </Badge>
                          <Badge variant="outline">
                            {transportMissionTypeLabels[mission.mission_type] || mission.mission_type}
                          </Badge>
                          {mission.tracking_active && <Badge variant="success">Tracking actif</Badge>}
                          {missionLate && <Badge variant="destructive">ETA en retard</Badge>}
                        </div>

                        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                          <div className="inline-flex items-center gap-2">
                            <MapPinned className="h-4 w-4" />
                            {mission.destination_label || mission.destination_address || 'Destination à définir'}
                          </div>
                          <div className="inline-flex items-center gap-2">
                            <Package2 className="h-4 w-4" />
                            {mission.shipment?.shipment_number || 'Sans expédition liée'}
                          </div>
                          <div className="inline-flex items-center gap-2">
                            <CalendarClock className="h-4 w-4" />
                            Départ {formatDateTime(mission.planned_departure_at)}
                          </div>
                          <div className="inline-flex items-center gap-2">
                            <Clock3 className="h-4 w-4" />
                            ETA {formatDateTime(mission.planned_arrival_at)}
                          </div>
                          <div className="inline-flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            {mission.vehicle?.registration_number || 'Camion non affecté'}
                          </div>
                          <div className="inline-flex items-center gap-2">
                            <UserRound className="h-4 w-4" />
                            {mission.driver?.full_name || 'Chauffeur non affecté'}
                          </div>
                        </div>
                      </div>

                      <div className="grid min-w-[210px] gap-2">
                        <div className="rounded-xl border bg-muted/20 px-3 py-2">
                          <div className="text-xs text-muted-foreground">Dernier ping</div>
                          <div className="font-semibold">{getTrackingFreshness(mission.last_position_at)}</div>
                        </div>
                        <div className="rounded-xl border bg-muted/20 px-3 py-2">
                          <div className="text-xs text-muted-foreground">ETA restant</div>
                          <div className={`font-semibold ${missionLate ? 'text-rose-600' : ''}`}>
                            {etaMinutes == null ? '-' : `${etaMinutes} min`}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDetailMissionId(mission.id);
                          }}
                        >
                          Ouvrir mission
                        </Button>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Carte live</CardTitle>
            <CardDescription>
              Vue dispatch temps réel du camion sélectionné.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedMission ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Sélectionne une mission pour charger la carte.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`${transportStatusColor[selectedMission.status] || 'bg-slate-500'} text-white`}>
                    {transportMissionStatusLabels[selectedMission.status] || selectedMission.status}
                  </Badge>
                  <Badge variant="outline">{selectedMission.vehicle?.registration_number || 'Sans camion'}</Badge>
                  <Badge variant="outline">{selectedMission.driver?.full_name || 'Sans chauffeur'}</Badge>
                  {trackingEnabledBySettings ? <Badge variant="success">Tracking activable</Badge> : <Badge variant="warning">Tracking désactivé</Badge>}
                </div>

                <div className="rounded-2xl border overflow-hidden">
                  {getMapSrc(selectedMission, mapsApiKey, mapsZoom) ? (
                    <iframe
                      title={`Carte ${selectedMission.mission_number}`}
                      src={getMapSrc(selectedMission, mapsApiKey, mapsZoom) ?? undefined}
                      className="h-[320px] w-full border-0"
                      loading="lazy"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex h-[320px] items-center justify-center bg-muted/20 text-sm text-muted-foreground">
                      Carte indisponible.
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Coordonnées</div>
                    <div className="mt-1 font-semibold">
                      {toCoordinateText(selectedMission.last_latitude)}, {toCoordinateText(selectedMission.last_longitude)}
                    </div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Dernier ping</div>
                    <div className="mt-1 font-semibold">{getTrackingFreshness(selectedMission.last_position_at)}</div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Départ prévu</div>
                    <div className="mt-1 font-semibold">{formatDateTime(selectedMission.planned_departure_at)}</div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">ETA</div>
                    <div className={`mt-1 font-semibold ${isMissionLate(selectedMission, missionEtaAlertMinutes) ? 'text-rose-600' : ''}`}>
                      {formatDateTime(selectedMission.planned_arrival_at)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setDetailMissionId(selectedMission.id)}>
                    Piloter la mission
                  </Button>
                  <Button variant="ghost" asChild>
                    <a href={getDirectionsUrl(selectedMission)} target="_blank" rel="noreferrer">
                      <Navigation className="mr-2 h-4 w-4" />
                      Itinéraire
                    </a>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Flotte camions</CardTitle>
            <CardDescription>Disponibilité terrain, balises et capacité de chargement.</CardDescription>
          </CardHeader>
          <CardContent>
            {vehicles.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Aucun camion enregistré.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Camion</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Capacité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Dernier ping</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((vehicle) => {
                    const effectiveStatus: TransportVehicleStatus =
                      ['MAINTENANCE', 'OUT_OF_SERVICE'].includes(vehicle.status)
                        ? vehicle.status
                        : activeMissionVehicleIds.has(vehicle.id)
                          ? 'IN_MISSION'
                          : 'AVAILABLE';

                    return (
                      <TableRow key={vehicle.id}>
                        <TableCell>
                          <div className="font-medium">{vehicle.registration_number}</div>
                          <div className="text-xs text-muted-foreground">{vehicle.vehicle_code}</div>
                        </TableCell>
                        <TableCell>{vehicle.vehicle_type || '-'}</TableCell>
                        <TableCell>{Number(vehicle.capacity_kg || 0).toLocaleString('fr-FR')} kg</TableCell>
                        <TableCell>
                          <Badge className={`${transportStatusColor[effectiveStatus] || 'bg-slate-500'} text-white`}>
                            {transportVehicleStatusLabels[effectiveStatus] || effectiveStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>{getTrackingFreshness(vehicle.last_position_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chauffeurs</CardTitle>
            <CardDescription>Contacts, permis et disponibilité pour les prochains départs.</CardDescription>
          </CardHeader>
          <CardContent>
            {drivers.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Aucun chauffeur enregistré.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chauffeur</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Permis</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((driver) => {
                    const effectiveStatus: TransportDriverStatus = activeMissionDriverIds.has(driver.id)
                      ? 'ASSIGNED'
                      : driver.status;

                    return (
                      <TableRow key={driver.id}>
                        <TableCell>
                          <div className="font-medium">{driver.full_name}</div>
                          <div className="text-xs text-muted-foreground">{driver.driver_code}</div>
                        </TableCell>
                        <TableCell>
                          <div className="inline-flex items-center gap-2 text-sm">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            {driver.phone || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{driver.license_number || '-'}</div>
                          <div className="text-xs text-muted-foreground">
                            Expire {driver.license_expiry_date ? format(new Date(driver.license_expiry_date), 'dd/MM/yyyy', { locale: fr }) : '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${transportStatusColor[effectiveStatus] || 'bg-slate-500'} text-white`}>
                            {transportDriverStatusLabels[effectiveStatus] || effectiveStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateVehicleDialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen} />
      <CreateDriverDialog open={driverDialogOpen} onOpenChange={setDriverDialogOpen} vehicles={vehicles} />
      <CreateMissionDialog
        open={missionDialogOpen}
        onOpenChange={setMissionDialogOpen}
        vehicles={vehicles}
        drivers={drivers}
        shipments={shipments}
        actorName={actorName}
        originLabel={originLabel}
      />
      <MissionDetailDialog
        mission={detailMission}
        open={Boolean(detailMission)}
        onOpenChange={(open) => !open && setDetailMissionId(null)}
        vehicles={vehicles}
        drivers={drivers}
        actorName={actorName}
        trackingEnabledBySettings={trackingEnabledBySettings}
        trackingRefreshSeconds={trackingRefreshSeconds}
        etaAlertMinutes={missionEtaAlertMinutes}
        mapsApiKey={mapsApiKey}
        mapsZoom={mapsZoom}
      />
    </div>
  );
}
