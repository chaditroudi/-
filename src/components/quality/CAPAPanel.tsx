import { useEffect, useState } from 'react';
import { format, isPast, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  useCAPATickets,
  useCreateCAPA,
  useUpdateCAPA,
  type CreateCAPAInput,
  type UpdateCAPAInput,
} from '@/hooks/useCAPATickets';
import type { CAPAStatus, CAPASeverity, CAPATicket } from '@/types/capa';
import {
  capaStatusColors,
  capaStatusLabels,
  capaSeverityColors,
} from '@/types/capa';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const ALL_STATUS_VALUE = 'all';

const fmt = (v?: string | null) =>
  v ? format(parseISO(v), 'dd/MM/yyyy', { locale: fr }) : '—';

const isOverdue = (t: CAPATicket) =>
  !!t.deadline &&
  isPast(parseISO(t.deadline)) &&
  t.status !== 'FERME' &&
  t.status !== 'VERIFIE';

// ── Detail / Edit dialog ───────────────────────────────────────────

type CAPADetailDialogProps = {
  ticket: CAPATicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: string;
};

const CAPADetailDialog = ({ ticket, open, onOpenChange, currentUser }: CAPADetailDialogProps) => {
  const updateCAPA = useUpdateCAPA();
  const [status, setStatus] = useState<CAPAStatus>('OUVERT');
  const [rootCause, setRootCause] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [preventiveAction, setPreventiveAction] = useState('');
  const [deadline, setDeadline] = useState('');
  const [responsible, setResponsible] = useState('');

  useEffect(() => {
    if (ticket) {
      setStatus(ticket.status);
      setRootCause(ticket.root_cause ?? '');
      setCorrectiveAction(ticket.corrective_action ?? '');
      setPreventiveAction(ticket.preventive_action ?? '');
      setDeadline(ticket.deadline ? ticket.deadline.slice(0, 10) : '');
      setResponsible(ticket.responsible ?? '');
    }
  }, [ticket?.id]);

  if (!ticket) return null;

  const handleSave = async () => {
    const patch: UpdateCAPAInput = {
      id: ticket.id,
      status,
      root_cause: rootCause || null,
      corrective_action: correctiveAction || null,
      preventive_action: preventiveAction || null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      responsible: responsible || null,
    };
    if (status === 'VERIFIE') patch.verified_by = currentUser;
    await updateCAPA.mutateAsync(patch);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            {ticket.ticket_number}
            <Badge className={capaSeverityColors[ticket.severity]}>{ticket.severity}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm rounded-lg bg-muted/40 px-4 py-3">
            <div><span className="text-muted-foreground">Fournisseur: </span>{ticket.supplier_name || '—'}</div>
            <div><span className="text-muted-foreground">Réception: </span>{ticket.reception_number || '—'}</div>
            <div><span className="text-muted-foreground">NC codes: </span>{(ticket.nc_codes || []).join(', ') || '—'}</div>
            <div><span className="text-muted-foreground">Créé le: </span>{fmt(ticket.created_at)}</div>
          </div>

          <div className="grid gap-2">
            <Label>Statut</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as CAPAStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(capaStatusLabels) as CAPAStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{capaStatusLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Responsable</Label>
              <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Délai cible</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Cause racine</Label>
            <Textarea rows={2} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>Action corrective</Label>
            <Textarea rows={2} value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>Action préventive</Label>
            <Textarea rows={2} value={preventiveAction} onChange={(e) => setPreventiveAction(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={updateCAPA.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Create dialog ──────────────────────────────────────────────────

type CAPACreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: string;
};

const CAPACreateDialog = ({ open, onOpenChange, currentUser }: CAPACreateDialogProps) => {
  const createCAPA = useCreateCAPA();
  const [severity, setSeverity] = useState<CAPASeverity>('MAJEUR');
  const [ncCodes, setNcCodes] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [responsible, setResponsible] = useState('');
  const [deadline, setDeadline] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');

  const reset = () => {
    setSeverity('MAJEUR');
    setNcCodes('');
    setSupplierName('');
    setResponsible('');
    setDeadline('');
    setRootCause('');
    setCorrectiveAction('');
  };

  const handleCreate = async () => {
    const input: CreateCAPAInput = {
      nc_codes: ncCodes ? ncCodes.split(',').map((s) => s.trim()).filter(Boolean) : [],
      severity,
      supplier_name: supplierName || null,
      responsible: responsible || null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      root_cause: rootCause || null,
      corrective_action: correctiveAction || null,
      created_by: currentUser,
    };
    await createCAPA.mutateAsync(input);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nouveau ticket CAPA</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Sévérité</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as CAPASeverity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CRITIQUE">Critique</SelectItem>
                <SelectItem value="MAJEUR">Majeur</SelectItem>
                <SelectItem value="MINEUR">Mineur</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Codes NC (séparés par virgule)</Label>
            <Input
              value={ncCodes}
              onChange={(e) => setNcCodes(e.target.value)}
              placeholder="Ex: NC-PEST-01, NC-HYGIENE-03"
            />
          </div>

          <div className="grid gap-2">
            <Label>Fournisseur concerné</Label>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Responsable</Label>
              <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Délai cible</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Cause racine (initiale)</Label>
            <Textarea rows={2} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>Action corrective proposée</Label>
            <Textarea rows={2} value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={createCAPA.isPending}>Créer le ticket</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Main panel ─────────────────────────────────────────────────────

export const CAPAPanel = ({ currentUser }: { currentUser: string }) => {
  const [statusFilter, setStatusFilter] = useState<'all' | CAPAStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<CAPATicket | null>(null);

  const { data: tickets = [] } = useCAPATickets(
    statusFilter !== ALL_STATUS_VALUE ? { status: statusFilter as CAPAStatus } : undefined,
  );

  const openCount = tickets.filter((t) => t.status === 'OUVERT').length;
  const inProgressCount = tickets.filter((t) => t.status === 'EN_COURS').length;
  const overdueCount = tickets.filter(isOverdue).length;
  const criticalCount = tickets.filter(
    (t) => t.severity === 'CRITIQUE' && t.status !== 'FERME' && t.status !== 'VERIFIE',
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold">{openCount}</div>
                <div className="text-sm text-muted-foreground">Tickets ouverts</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600" />
              <div>
                <div className="text-2xl font-bold">{inProgressCount}</div>
                <div className="text-sm text-muted-foreground">En cours</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-rose-600" />
              <div>
                <div className="text-2xl font-bold">{overdueCount}</div>
                <div className="text-sm text-muted-foreground">En retard</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">{criticalCount}</div>
                <div className="text-sm text-muted-foreground">CRITIQUE actives</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>Tickets CAPA</CardTitle>
            <div className="flex items-center gap-3">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as 'all' | CAPAStatus)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUS_VALUE}>Tous les statuts</SelectItem>
                  {(Object.keys(capaStatusLabels) as CAPAStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{capaStatusLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau CAPA
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              {statusFilter === ALL_STATUS_VALUE
                ? 'Aucun ticket CAPA enregistré.'
                : `Aucun ticket CAPA avec le statut "${capaStatusLabels[statusFilter as CAPAStatus]}".`}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Sévérité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Délai</TableHead>
                  <TableHead>NC codes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <TableCell>
                      <div className="font-mono font-semibold text-sm">{ticket.ticket_number}</div>
                      <div className="text-xs text-muted-foreground">{fmt(ticket.created_at)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={capaSeverityColors[ticket.severity]}>{ticket.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={capaStatusColors[ticket.status]}>
                        {capaStatusLabels[ticket.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{ticket.supplier_name || '—'}</TableCell>
                    <TableCell className="text-sm">{ticket.responsible || '—'}</TableCell>
                    <TableCell>
                      {ticket.deadline ? (
                        <span className={isOverdue(ticket) ? 'text-rose-600 font-semibold text-sm' : 'text-sm'}>
                          {fmt(ticket.deadline)}
                          {isOverdue(ticket) && ' ⚠'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(ticket.nc_codes || []).join(', ') || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CAPACreateDialog open={createOpen} onOpenChange={setCreateOpen} currentUser={currentUser} />
      <CAPADetailDialog
        ticket={selectedTicket}
        open={Boolean(selectedTicket)}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
        currentUser={currentUser}
      />
    </div>
  );
};
