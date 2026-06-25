import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { HACCP_CCPS, HACCP_PRPS } from '@/types/production-lines';
import {
  useHaccpStates,
  useUpdateHaccpState,
  type HaccpState,
  type HaccpCcpStatus,
} from '@/hooks/useHaccpStates';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Droplets,
  Edit3,
  Flame,
  FlaskConical,
  Loader2,
  RefreshCw,
  Ruler,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  ThermometerIcon,
  Users,
  Warehouse,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

// ─── PRP icon map ─────────────────────────────────────────────────────────────

const PRP_ICONS: Record<string, typeof Shield> = {
  'PRP-LOC': Warehouse,
  'PRP-EAU': Droplets,
  'PRP-NET': FlaskConical,
  'PRP-NUI': ShieldAlert,
  'PRP-MAI': Wrench,
  'PRP-HYG': Users,
  'PRP-FRD': Snowflake,
  'PRP-CE': Ruler,
  'PRP-FOU': ClipboardList,
  'PRP-CRI': Flame,
};

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
            <Badge className="rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
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
              {update.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Enregistrement…</> : 'Enregistrer'}
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
  const [expanded, setExpanded] = useState(true);
  const [updateOpen, setUpdateOpen] = useState(false);
  const status: HaccpCcpStatus = liveState?.status ?? 'not_monitored';

  return (
    <>
      <Card
        className={cn(
          'border-l-4',
          status === 'compliant'     && 'border-l-emerald-500',
          status === 'warning'       && 'border-l-amber-400',
          status === 'non_compliant' && 'border-l-red-500',
          status === 'not_monitored' && 'border-l-border',
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {statusIcon(status)}
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    {ccp.code}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">{ccp.stage}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Danger : {ccp.hazard}</p>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <Badge className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', statusBadgeClass(status))}>
                {statusLabel(status)}
              </Badge>
              {liveState?.last_checked_at && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(liveState.last_checked_at).toLocaleString('fr-FR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-6 rounded-lg px-2 text-[10px]"
                onClick={() => setUpdateOpen(true)}
              >
                <Edit3 className="mr-1 h-2.5 w-2.5" />
                Mettre à jour
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {liveState?.measured_value && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5 text-[11px]">
              <span className="text-muted-foreground">Valeur mesurée :</span>
              <span className="font-semibold text-foreground">{liveState.measured_value}</span>
              {liveState.checked_by && (
                <span className="ml-auto text-muted-foreground">par {liveState.checked_by}</span>
              )}
            </div>
          )}
          {liveState?.note && (
            <p className="mb-3 rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              {liveState.note}
            </p>
          )}

          <button
            className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary"
            onClick={() => setExpanded((p) => !p)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Masquer' : 'Voir'} les paramètres CCP
          </button>

          {expanded && (
            <div className="mt-3 space-y-3 border-t border-border pt-3 text-[12px]">
              <div className="grid grid-cols-[140px,1fr] gap-2 items-start">
                <span className="text-muted-foreground font-medium">Limite critique</span>
                <span className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 font-semibold text-red-700">
                  {ccp.criticalLimit}
                </span>
              </div>
              <div className="grid grid-cols-[140px,1fr] gap-2 items-start">
                <span className="text-muted-foreground font-medium">Surveillance</span>
                <span className="text-foreground">{ccp.monitoring}</span>
              </div>
              <div className="grid grid-cols-[140px,1fr] gap-2 items-start">
                <span className="text-muted-foreground font-medium">Action corrective</span>
                <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                  {ccp.correctiveAction}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <UpdateCcpDialog
        ccpCode={ccp.code as 'CCP1' | 'CCP2'}
        current={liveState}
        open={updateOpen}
        onOpenChange={setUpdateOpen}
      />
    </>
  );
}

// ─── PRP Card ─────────────────────────────────────────────────────────────────

function PrpCard({ prp }: { prp: typeof HACCP_PRPS[0] }) {
  const Icon = PRP_ICONS[prp.code] ?? Shield;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/30">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[9px] font-bold">{prp.code}</Badge>
          <span className="text-xs font-semibold text-foreground">{prp.label}</span>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{prp.description}</p>
      </div>
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400 opacity-60" />
    </div>
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <h2 className="text-base font-semibold text-foreground">Plan HACCP — Maîtrise & Pilotage</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            2 CCP · 10 PRP · Données en temps réel (MAJ 30 s)
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {isLoading && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
            </span>
          )}
          {compliantCount > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
              <ShieldCheck className="h-3 w-3" />
              {compliantCount} conforme{compliantCount > 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              {warningCount} alerte{warningCount > 1 ? 's' : ''}
            </span>
          )}
          {ncCount > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-medium text-red-700">
              <XCircle className="h-3 w-3" />
              {ncCount} non-conforme{ncCount > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['haccp-states'] })}
            className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-medium text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" />
            Actualiser
          </button>
        </div>
      </div>

      {/* CCP Cards */}
      <Card className="surface-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
              Points critiques
            </Badge>
            <CardTitle className="text-base font-semibold">CCP1 &amp; CCP2</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0 lg:grid-cols-2">
          {HACCP_CCPS.map((ccp) => (
            <CcpCard
              key={ccp.code}
              ccp={ccp}
              liveState={stateByCode[ccp.code as 'CCP1' | 'CCP2'] ?? null}
            />
          ))}
        </CardContent>
      </Card>

      {/* CCP integration notes */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs">
          <ThermometerIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div>
            <p className="font-semibold text-blue-800">CCP1 ← Fumigation & QC Réception</p>
            <p className="mt-1 text-blue-700">
              Les cycles de fumigation (Phase 2 — FUM-PH3/CO2/THERM) constituent la principale
              action corrective du CCP1. La désinsectisation à −18 °C ≥ 48 h est l'alternative
              en chambre froide.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50/60 p-4 text-xs">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
          <div>
            <p className="font-semibold text-purple-800">CCP2 ← Détecteur métaux (toutes lignes)</p>
            <p className="mt-1 text-purple-700">
              Chaque ligne F1–F8 intègre un pas de détection métaux qualifié CCP2.
              Tests étalons (Fe / SS / Al) à chaque démarrage. L'éjection est automatique ;
              le lot est isolé et contrôlé. Statut mis à jour par l'opérateur ci-dessus.
            </p>
          </div>
        </div>
      </div>

      {/* PRPs */}
      <Card className="surface-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
              PRP
            </Badge>
            <CardTitle className="text-base font-semibold">
              Programmes prérequis — transversaux à tous les flux
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            10 programmes documentés couvrant les conditions générales d'hygiène et de sécurité.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {HACCP_PRPS.map((prp) => <PrpCard key={prp.code} prp={prp} />)}
          </div>
        </CardContent>
      </Card>

      {/* Traceability note */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs">
        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          Tous les enregistrements CCP (humidité réception, détections métaux, T° chambres) sont
          liés par un identifiant de lot traçable de la palmeraie au client final.
          En cas de réclamation : rappel ciblé du seul lot concerné, sans bloquer le reste de la production.
        </p>
      </div>
    </div>
  );
}
