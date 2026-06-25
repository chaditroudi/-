import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, CheckCircle2, Truck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Supplier } from '@/types/mes';
import { ROYAL_PALM_VARIETIES } from '@/lib/royalPalmPhase1';
import {
  type InboundNotice,
  useCancelInboundNotice,
  useCreateInboundNotice,
  useTodayPendingNotices,
} from '@/hooks/useInboundNotices';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: Supplier[];
}

const toLocalDateTimeInput = (offsetMinutes = 60) => {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const STATUS_LABELS: Record<InboundNotice['status'], string> = {
  PENDING: 'En attente',
  RECEIVED: 'Reçue',
  CANCELLED: 'Annulée',
};

const STATUS_CLASSES: Record<InboundNotice['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  RECEIVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const InboundNoticeDialog = ({ open, onOpenChange, suppliers }: Props) => {
  const { data: todayNotices = [] } = useTodayPendingNotices();
  const createMutation = useCreateInboundNotice();
  const cancelMutation = useCancelInboundNotice();

  const [view, setView] = useState<'list' | 'create'>('list');
  const [supplierId, setSupplierId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [variety, setVariety] = useState('Deglet Nour');
  const [declaredWeight, setDeclaredWeight] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState(toLocalDateTimeInput(60));
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setView('list');
    setSupplierId('');
    setVehicleNumber('');
    setDriverName('');
    setVariety('Deglet Nour');
    setDeclaredWeight('');
    setDeliveryNote('');
    setEstimatedArrival(toLocalDateTimeInput(60));
    setNotes('');
    setFormError(null);
  }, [open]);

  const activeSuppliers = suppliers.filter(
    (s) => s.is_active && (s.supplier_status || 'pending_approval') === 'active',
  );

  const handleCreate = () => {
    if (!supplierId) { setFormError('Sélectionner un fournisseur.'); return; }
    if (!vehicleNumber.trim()) { setFormError("Renseigner l'immatriculation."); return; }
    if (!estimatedArrival) { setFormError("Renseigner l'heure estimée d'arrivée."); return; }
    setFormError(null);

    const supplier = activeSuppliers.find(
      (s) => s.id === supplierId || s.code === supplierId,
    );

    createMutation.mutate(
      {
        supplier_id: supplierId,
        supplier_name: supplier?.name ?? null,
        supplier_code: supplier?.code ?? null,
        vehicle_number: vehicleNumber.trim().toUpperCase(),
        driver_name: driverName.trim() || null,
        variety,
        declared_weight_kg: declaredWeight ? Number(declaredWeight) : null,
        delivery_note_number: deliveryNote.trim() || null,
        estimated_arrival_at: new Date(estimatedArrival).toISOString(),
        notes: notes.trim() || null,
        reception_id: null,
      },
      { onSuccess: () => setView('list') },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Pré-annonces d'arrivée — §2.1
            </DialogTitle>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              <Button
                size="sm"
                variant={view === 'list' ? 'default' : 'ghost'}
                onClick={() => setView('list')}
              >
                Aujourd'hui ({todayNotices.length})
              </Button>
              <Button
                size="sm"
                variant={view === 'create' ? 'default' : 'ghost'}
                onClick={() => setView('create')}
              >
                + Nouvelle
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ── List view ──────────────────────────────────────────────── */}
        {view === 'list' && (
          <ScrollArea className="max-h-[60vh]">
            {todayNotices.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
                <Truck className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">Aucune pré-annonce pour aujourd'hui</p>
                <Button size="sm" variant="outline" onClick={() => setView('create')}>
                  Enregistrer une arrivée attendue
                </Button>
              </div>
            ) : (
              <div className="space-y-3 pr-1">
                {todayNotices.map((notice) => (
                  <div
                    key={notice.id}
                    className="rounded-2xl border border-border/70 bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={STATUS_CLASSES[notice.status]}>
                            {STATUS_LABELS[notice.status]}
                          </Badge>
                          <span className="font-mono text-sm font-semibold">
                            {notice.vehicle_number}
                          </span>
                          <Badge variant="secondary">{notice.variety}</Badge>
                        </div>
                        <p className="mt-1.5 font-medium text-sm">
                          {notice.supplier_name || notice.supplier_code || '—'}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            Arrivée estimée :{' '}
                            {format(new Date(notice.estimated_arrival_at), 'HH:mm', { locale: fr })}
                          </span>
                          {notice.declared_weight_kg && (
                            <span>Poids annoncé : {notice.declared_weight_kg} kg</span>
                          )}
                          {notice.delivery_note_number && (
                            <span>BL : {notice.delivery_note_number}</span>
                          )}
                          {notice.driver_name && <span>Chauffeur : {notice.driver_name}</span>}
                        </div>
                        {notice.notes && (
                          <p className="mt-1 text-xs text-muted-foreground italic">{notice.notes}</p>
                        )}
                      </div>

                      {notice.status === 'RECEIVED' && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      )}
                      {notice.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => cancelMutation.mutate(notice.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}

        {/* ── Create view ────────────────────────────────────────────── */}
        {view === 'create' && (
          <ScrollArea className="max-h-[60vh] pr-1">
            <div className="space-y-4">
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                La pré-annonce permet à la réception de préparer l'accueil avant l'arrivée du camion (vérification BL, zone disponible, inspecteur QC prévenu).
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Fournisseur *</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Sélectionner un fournisseur actif" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSuppliers.map((s) => (
                        <SelectItem key={s.id || s.code} value={s.id || s.code}>
                          {s.code} • {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Immatriculation *</Label>
                  <Input
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="TU-4521-A"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom chauffeur</Label>
                  <Input
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Optionnel"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Variété annoncée</Label>
                  <Select value={variety} onValueChange={setVariety}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROYAL_PALM_VARIETIES.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Poids déclaré (kg)</Label>
                  <Input
                    type="number"
                    value={declaredWeight}
                    onChange={(e) => setDeclaredWeight(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>N° bon de livraison</Label>
                  <Input
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    placeholder="BL-2026-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Heure d'arrivée estimée *</Label>
                  <Input
                    type="datetime-local"
                    value={estimatedArrival}
                    onChange={(e) => setEstimatedArrival(e.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Instructions particulières, conditions de livraison..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {formError && (
            <p className="mr-auto text-sm text-destructive">{formError}</p>
          )}
          {view === 'create' && (
            <>
              <Button variant="outline" onClick={() => setView('list')}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Enregistrement...' : 'Enregistrer la pré-annonce'}
              </Button>
            </>
          )}
          {view === 'list' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
