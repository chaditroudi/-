import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { HACCP_CCPS, HACCP_PRPS } from '@/types/production-lines';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useHaccpStates,
  useUpdateHaccpState,
  type HaccpState,
  type HaccpCcpStatus,
} from '@/hooks/useHaccpStates';
import {
  AlertTriangle,
  Edit3,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusIcon(status: HaccpCcpStatus) {
  switch (status) {
    case 'compliant':     return <ShieldCheck className="h-5 w-5 text-emerald-600" />;
    case 'warning':       return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case 'non_compliant': return <XCircle className="h-5 w-5 text-red-500" />;
    default:              return <Shield className="h-5 w-5 text-muted-foreground" />;
  }
}

function statusBadgeClass(status: HaccpCcpStatus) {
  switch (status) {
    case 'compliant':     return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'warning':       return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'non_compliant': return 'border-red-200 bg-red-50 text-red-700';
    default:              return 'border-border bg-muted/60 text-muted-foreground';
  }
}

function statusLabel(status: HaccpCcpStatus) {
  switch (status) {
    case 'compliant':     return 'Conforme';
    case 'warning':       return 'À surveiller';
    case 'non_compliant': return 'Non conforme';
    default:              return 'Non surveillé';
  }
}

// ─── Update CCP dialog ────────────────────────────────────────────────────────

interface UpdateCcpDialogProps {
  ccpCode: 'CCP1' | 'CCP2';
  current: HaccpState | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function UpdateCcpDialog({ ccpCode, current, open, onOpenChange }: UpdateCcpDialogProps) {
  const [status, setStatus] = useState<HaccpCcpStatus>(current?.status ?? 'not_monitored');
  const [measuredValue, setMeasuredValue] = useState(current?.measured_value ?? '');
  const [checkedBy, setCheckedBy] = useState(current?.checked_by ?? '');
  const [note, setNote] = useState(current?.note ?? '');
  const update = useUpdateHaccpState();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate(
      {
        ccp_code: ccpCode,
        status,
        measured_value: measuredValue || undefined,
        checked_by: checkedBy || undefined,
        note: note || undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const placeholder =
    ccpCode === 'CCP1' ? 'ex. Humidité 14.2 % · Désinsect. conforme' : 'ex. Fe 1.5 mm · SS 2.0 mm · Al 2.5 mm';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
              {ccpCode}
            </Badge>
            Mettre à jour l'état CCP
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div>
            <Label>Statut *</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as HaccpCcpStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compliant">✓ Conforme</SelectItem>
                <SelectItem value="warning">⚠ À surveiller</SelectItem>
                <SelectItem value="non_compliant">✗ Non conforme</SelectItem>
                <SelectItem value="not_monitored">— Non surveillé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valeur mesurée</Label>
            <Input
              value={measuredValue}
              onChange={(e) => setMeasuredValue(e.target.value)}
              placeholder={placeholder}
            />
          </div>
          <div>
            <Label>Vérifié par</Label>
            <Input
              value={checkedBy}
              onChange={(e) => setCheckedBy(e.target.value)}
              placeholder="Nom du technicien / contrôleur"
            />
          </div>
          <div>
            <Label>Observations</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Remarques, actions correctives prises…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin me-1" />Enregistrement…</> : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── CCP Card ─────────────────────────────────────────────────────────────────

interface CcpCardProps {
  ccp: typeof HACCP_CCPS[0];
  liveState: HaccpState | null;
}

function CcpCard({ ccp, liveState }: CcpCardProps) {
  const [updateOpen, setUpdateOpen] = useState(false);
  const status: HaccpCcpStatus = liveState?.status ?? 'not_monitored';

  return (
    <section aria-label={`${ccp.code} ${ccp.stage}`} className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {statusIcon(status)}
        <h3 className="text-sm font-semibold">{ccp.code} {ccp.stage}</h3>
        <Badge className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', statusBadgeClass(status))}>
          {statusLabel(status)}
        </Badge>
        {liveState?.last_checked_at && (
          <span className="text-xs text-muted-foreground">
            {new Date(liveState.last_checked_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            {liveState.checked_by && `, par ${liveState.checked_by}`}
          </span>
        )}
        <Button size="sm" variant="outline" className="ms-auto" aria-label={`Mettre à jour ${ccp.code}`} onClick={() => setUpdateOpen(true)}>
          <Edit3 className="me-1 h-3 w-3" />
          Mettre à jour
        </Button>
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
        {liveState?.measured_value && (
          <>
            <dt className="text-muted-foreground">Valeur mesurée</dt>
            <dd className="font-medium">{liveState.measured_value}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Danger</dt>
        <dd>{ccp.hazard}</dd>
        <dt className="text-muted-foreground">Limite critique</dt>
        <dd className="font-medium">{ccp.criticalLimit}</dd>
        <dt className="text-muted-foreground">Surveillance</dt>
        <dd>{ccp.monitoring}</dd>
        <dt className="text-muted-foreground">Action corrective</dt>
        <dd>{ccp.correctiveAction}</dd>
        {liveState?.note && (
          <>
            <dt className="text-muted-foreground">Note</dt>
            <dd>{liveState.note}</dd>
          </>
        )}
      </dl>

      <UpdateCcpDialog
        ccpCode={ccp.code as 'CCP1' | 'CCP2'}
        current={liveState}
        open={updateOpen}
        onOpenChange={setUpdateOpen}
      />
    </section>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function HaccpDashboard() {
  const qc = useQueryClient();
  const { data: haccpStates = [], isLoading } = useHaccpStates();

  const stateByCode = Object.fromEntries(
    haccpStates.map((s) => [s.ccp_code, s]),
  ) as Record<'CCP1' | 'CCP2', HaccpState | undefined>;

  const compliantCount = haccpStates.filter((s) => s.status === 'compliant').length;
  const warningCount   = haccpStates.filter((s) => s.status === 'warning').length;
  const ncCount        = haccpStates.filter((s) => s.status === 'non_compliant').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" role="status">
          {isLoading ? 'Chargement…' : [
            `${compliantCount} conforme${compliantCount > 1 ? 's' : ''} sur ${HACCP_CCPS.length}`,
            warningCount > 0 && `${warningCount} en alerte`,
            ncCount > 0 && `${ncCount} non conforme${ncCount > 1 ? 's' : ''}`,
          ].filter(Boolean).join(', ')}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['haccp-states'] })}>
          <RefreshCw className="me-1 h-3 w-3" />
          Actualiser
        </Button>
      </div>

      <section aria-labelledby="haccp-ccp-title" className="space-y-2">
        <h2 id="haccp-ccp-title" className="text-base">Points critiques</h2>
        <div className="grid gap-3 xl:grid-cols-2">
          {HACCP_CCPS.map((ccp) => (
            <CcpCard
              key={ccp.code}
              ccp={ccp}
              liveState={stateByCode[ccp.code as 'CCP1' | 'CCP2'] ?? null}
            />
          ))}
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          La fumigation est la principale action corrective du CCP1, et la désinsectisation à −18 °C pendant 48 h son
          alternative en chambre froide. Chaque ligne F1 à F8 passe par la détection métaux du CCP2, avec un test
          d'étalons à chaque démarrage.
        </p>
      </section>

      <section aria-labelledby="haccp-prp-title">
        <h2 id="haccp-prp-title" className="pb-1 text-base">Programmes prérequis</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Code</TableHead>
              <TableHead>Programme</TableHead>
              <TableHead className="hidden md:table-cell">Contenu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {HACCP_PRPS.map((prp) => (
              <TableRow key={prp.code}>
                <TableCell className="whitespace-nowrap py-1.5 font-mono text-sm">{prp.code}</TableCell>
                <TableCell className="py-1.5 text-sm font-medium">{prp.label}</TableCell>
                <TableCell className="hidden py-1.5 text-sm text-muted-foreground md:table-cell">{prp.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <p className="max-w-3xl text-sm text-muted-foreground">
        Chaque enregistrement CCP est lié à un lot traçable de la palmeraie au client. Une réclamation se traite par le
        rappel du seul lot concerné, sans bloquer le reste de la production.
      </p>
    </div>
  );
}
