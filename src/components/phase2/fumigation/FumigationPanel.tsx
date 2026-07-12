import { useState } from 'react';
import { useFumigationCycles, useFumigationKpis } from '@/hooks/useFumigation';
import { FumigationCycleDialog } from './FumigationCycleDialog';
import { FumigationCycle, FumigationCycleStatus, FUMIGATION_PROTOCOL_CONFIG } from '@/types/phase2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer, Plus, Activity, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { printFumigationCertificate } from './printFumigationCertificate';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_LABELS: Record<FumigationCycleStatus, string> = {
  PREPARATION: 'Préparation',
  CHARGEMENT: 'Chargement',
  EN_COURS: 'En cours',
  VENTILATION: 'Ventilation',
  VALIDATION: 'Validation',
  TERMINE: 'Terminé',
  INTERROMPU: 'Interrompu',
  ECHEC: 'Échec',
};

const STATUS_VARIANT: Record<FumigationCycleStatus, string> = {
  PREPARATION: 'bg-gray-100 text-gray-700',
  CHARGEMENT: 'bg-blue-100 text-blue-700',
  EN_COURS: 'bg-amber-100 text-amber-800 font-semibold',
  VENTILATION: 'bg-purple-100 text-purple-700',
  VALIDATION: 'bg-orange-100 text-orange-700',
  TERMINE: 'bg-green-100 text-green-700',
  INTERROMPU: 'bg-red-100 text-red-700',
  ECHEC: 'bg-red-100 text-red-700',
};

export function FumigationPanel({ currentUser = 'Utilisateur' }: { currentUser?: string }) {
  const { data: cycles = [], isLoading } = useFumigationCycles();
  const { data: kpis } = useFumigationKpis();
  const [selectedCycle, setSelectedCycle] = useState<FumigationCycle | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const active = cycles.filter((c) => ['PREPARATION', 'CHARGEMENT', 'EN_COURS', 'VENTILATION', 'VALIDATION'].includes(c.status));
  const recent = cycles.filter((c) => ['TERMINE', 'INTERROMPU', 'ECHEC'].includes(c.status)).slice(0, 10);

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-500" />
              <div>
                <div className="text-2xl font-bold">{kpis?.active_count ?? active.length}</div>
                <div className="text-xs text-muted-foreground">Cycles actifs</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{kpis?.completed_count ?? recent.filter(c => c.status === 'TERMINE').length}</div>
                <div className="text-xs text-muted-foreground">Cycles terminés</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <div>
                <div className="text-2xl font-bold">
                  {kpis?.compliance_pct != null ? `${kpis.compliance_pct}%` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Conformité CCP</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">
                  {kpis?.total_kg_treated != null ? `${kpis.total_kg_treated.toLocaleString('fr-TN')} kg` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Volume traité</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active cycles */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Cycles actifs ({active.length})
            </CardTitle>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nouveau cycle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Chargement…</div>
          ) : active.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Aucun cycle actif. Créez un cycle pour commencer.
            </div>
          ) : (
            <div className="divide-y">
              {active.map((c) => (
                <CycleRow
                  key={c.id}
                  cycle={c}
                  onOpen={() => setSelectedCycle(c)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent completed */}
      {recent.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Historique récent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {recent.map((c) => (
                <CycleRow
                  key={c.id}
                  cycle={c}
                  onOpen={() => setSelectedCycle(c)}
                  showPrint
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <FumigationCycleDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        currentUser={currentUser}
      />
      <FumigationCycleDialog
        open={!!selectedCycle}
        onOpenChange={(v) => { if (!v) setSelectedCycle(null); }}
        cycle={selectedCycle}
        currentUser={currentUser}
      />
    </div>
  );
}

function CycleRow({
  cycle,
  onOpen,
  showPrint = false,
}: {
  cycle: FumigationCycle;
  onOpen: () => void;
  showPrint?: boolean;
}) {
  const proto = FUMIGATION_PROTOCOL_CONFIG[cycle.protocol];
  const durationMs = cycle.t0_start
    ? (cycle.t_end_real ? new Date(cycle.t_end_real) : new Date()).getTime() - new Date(cycle.t0_start).getTime()
    : null;
  const durationH = durationMs != null ? Math.floor(durationMs / 3_600_000) : null;

  return (
    <div
      className="py-3 flex items-start gap-3 -mx-2 px-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/40"
      onClick={onOpen}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-semibold">{cycle.cycle_number}</span>
          <Badge className={`text-xs ${STATUS_VARIANT[cycle.status]}`}>{STATUS_LABELS[cycle.status]}</Badge>
          {cycle.has_bio_lots && <Badge variant="outline" className="text-xs text-green-700">BIO</Badge>}
          {cycle.status === 'EN_COURS' && <span className="text-xs text-amber-600 animate-pulse font-semibold">● LIVE</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
          <span>Chambre: {cycle.chamber}</span>
          <span>{proto.label.split(' — ')[0]}</span>
          <span>{cycle.total_weight_kg.toLocaleString('fr-TN')} kg · {cycle.fill_rate_percent}% remplissage</span>
          {durationH != null && <span>Durée: {durationH}h / {proto.min_duration_h}h min</span>}
          {cycle.created_at && (
            <span>Créé: {format(new Date(cycle.created_at), 'dd/MM HH:mm', { locale: fr })}</span>
          )}
        </div>
        {cycle.status === 'TERMINE' && (
          <div className="flex items-center gap-2 mt-1">
            {cycle.duration_compliant && cycle.parameters_compliant ? (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Conforme CCP
              </span>
            ) : (
              <span className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Non conforme
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        {showPrint && cycle.status === 'TERMINE' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 px-2"
            onClick={(e) => { e.stopPropagation(); printFumigationCertificate(cycle); }}
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-9 px-3 text-xs" onClick={onOpen}>
          Ouvrir
        </Button>
      </div>
    </div>
  );
}
