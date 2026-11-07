import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFumigationCycles, useFumigationKpis } from '@/hooks/useFumigation';
import { FumigationCycleDialog } from './FumigationCycleDialog';
import { FUMIGATION_STEPS, FumigationProgress } from './FumigationProgress';
import { FumigationCycle, FumigationCycleStatus, FUMIGATION_PROTOCOL_CONFIG } from '@/types/phase2';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, ChevronRight, Flame, Plus, Printer } from 'lucide-react';
import { printFumigationCertificate } from './printFumigationCertificate';
import { SummaryStrip } from '@/components/shared/SummaryStrip';
import { formatDateTime, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<FumigationCycleStatus, string> = {
  PREPARATION: 'border-input bg-card text-muted-foreground',
  CHARGEMENT: 'border-info/40 bg-card text-info',
  EN_COURS: 'border-warning/40 bg-sand text-sand-foreground',
  VENTILATION: 'border-info/40 bg-card text-info',
  VALIDATION: 'border-warning/40 bg-card text-warning',
  TERMINE: 'border-success/40 bg-card text-success',
  INTERROMPU: 'border-destructive/40 bg-card text-destructive',
  ECHEC: 'border-destructive/40 bg-card text-destructive',
};

export function FumigationPanel({ currentUser = 'Utilisateur' }: { currentUser?: string }) {
  const { t } = useTranslation();
  const { data: cycles = [], isLoading } = useFumigationCycles();
  const { data: kpis } = useFumigationKpis();
  // The open cycle is read from the live list, so each step shows the server's new status at once.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCycle = cycles.find((c) => c.id === selectedId) ?? null;
  const [showCreate, setShowCreate] = useState(false);

  const active = cycles.filter((c) => FUMIGATION_STEPS.includes(c.status));
  const recent = cycles.filter((c) => ['TERMINE', 'INTERROMPU', 'ECHEC'].includes(c.status)).slice(0, 10);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Flame className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold">{t('fumigation.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('fumigation.subtitle')}</p>
          </div>
        </div>
        <Button size="xl" className="w-full sm:w-auto" onClick={() => setShowCreate(true)}>
          <Plus aria-hidden />
          {t('fumigation.newCycle')}
        </Button>
      </section>

      <SummaryStrip items={[
        { label: t('fumigation.kpi.active'), value: kpis?.active_count ?? active.length },
        { label: t('fumigation.kpi.completed'), value: kpis?.completed_count ?? recent.filter(c => c.status === 'TERMINE').length },
        { label: t('fumigation.kpi.compliance'), value: kpis?.compliance_pct != null ? `${kpis.compliance_pct} %` : '—' },
        { label: t('fumigation.kpi.volume'), value: kpis?.total_kg_treated != null ? `${formatNumber(kpis.total_kg_treated, 0)} kg` : '—' },
      ]} />

      <section className="space-y-2">
        <h3 className="font-display text-lg font-semibold">{t('fumigation.active', { count: active.length })}</h3>
        {isLoading ? (
          <p role="status" className="rounded-2xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">{t('fumigation.loading')}</p>
        ) : active.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">{t('fumigation.empty')}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {active.map((c) => <CycleCard key={c.id} cycle={c} onOpen={() => setSelectedId(c.id)} />)}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-display text-lg font-semibold">{t('fumigation.history')}</h3>
          <ul className="grid gap-3 lg:grid-cols-2">
            {recent.map((c) => <CycleCard key={c.id} cycle={c} onOpen={() => setSelectedId(c.id)} showPrint />)}
          </ul>
        </section>
      )}

      <FumigationCycleDialog open={showCreate} onOpenChange={setShowCreate} currentUser={currentUser} />
      <FumigationCycleDialog
        open={!!selectedCycle}
        onOpenChange={(v) => { if (!v) setSelectedId(null); }}
        cycle={selectedCycle}
        currentUser={currentUser}
      />
    </div>
  );
}

function CycleCard({ cycle, onOpen, showPrint = false }: { cycle: FumigationCycle; onOpen: () => void; showPrint?: boolean }) {
  const { t } = useTranslation();
  const proto = FUMIGATION_PROTOCOL_CONFIG[cycle.protocol];
  const durationMs = cycle.t0_start
    ? (cycle.t_end_real ? new Date(cycle.t_end_real) : new Date()).getTime() - new Date(cycle.t0_start).getTime()
    : null;
  const durationH = durationMs != null ? Math.floor(durationMs / 3_600_000) : null;
  const finished = ['TERMINE', 'INTERROMPU', 'ECHEC'].includes(cycle.status);

  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-lg font-semibold">{cycle.cycle_number}</p>
          <p className="text-sm text-muted-foreground">{t('fumigation.chamber', { chamber: cycle.chamber })} · {proto.label.split(' — ')[0]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={STATUS_TONE[cycle.status]}>{t(`fumigation.status.${cycle.status}`)}</Badge>
          {cycle.has_bio_lots && <Badge variant="outline" className="border-success/40 text-success">BIO</Badge>}
          {cycle.status === 'EN_COURS' && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning">
              <span className="h-2 w-2 animate-pulse rounded-full bg-warning" aria-hidden />{t('fumigation.live')}
            </span>
          )}
        </div>
      </div>

      {!finished && <FumigationProgress status={cycle.status} />}

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-secondary/60 px-3 py-2">
          <dt className="text-muted-foreground">{t('fumigation.weight')}</dt>
          <dd className="font-semibold tabular-nums"><bdi dir="ltr">{formatNumber(cycle.total_weight_kg, 0)} kg</bdi></dd>
        </div>
        <div className="rounded-xl bg-secondary/60 px-3 py-2">
          <dt className="text-muted-foreground">{t('fumigation.fill')}</dt>
          <dd className="font-semibold tabular-nums">{cycle.fill_rate_percent}%</dd>
        </div>
        {durationH != null ? (
          <div className="rounded-xl bg-secondary/60 px-3 py-2">
            <dt className="text-muted-foreground">{t('fumigation.duration')}</dt>
            <dd className="font-semibold tabular-nums">{t('fumigation.durationOf', { hours: durationH, min: proto.min_duration_h })}</dd>
          </div>
        ) : cycle.created_at ? (
          <div className="rounded-xl bg-secondary/60 px-3 py-2">
            <dt className="text-muted-foreground">{t('fumigation.created')}</dt>
            <dd className="font-semibold">{formatDateTime(cycle.created_at)}</dd>
          </div>
        ) : null}
      </dl>

      {cycle.status === 'TERMINE' && (
        cycle.duration_compliant && cycle.parameters_compliant ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" aria-hidden />{t('fumigation.ccpOk')}</p>
        ) : (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" aria-hidden />{t('fumigation.ccpKo')}</p>
        )
      )}

      <div className="flex flex-wrap gap-2 sm:justify-end">
        {showPrint && cycle.status === 'TERMINE' && (
          <Button variant="outline" className="min-h-11 flex-1 sm:flex-none" aria-label={t('fumigation.printCertificateOf', { number: cycle.cycle_number })} onClick={() => printFumigationCertificate(cycle)}>
            <Printer aria-hidden />
            {t('fumigation.certificate')}
          </Button>
        )}
        <Button variant={finished ? 'outline' : 'default'} className="min-h-12 flex-1 sm:flex-none" onClick={onOpen}>
          {t('fumigation.open')}
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </li>
  );
}
