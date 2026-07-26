import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { trustApi } from '@/lib/api/trust';
import { BadgeCheck, Link2, RefreshCw, ShieldAlert } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  SUPPLIER_INTAKE: 'Réception',
  WEIGHED: 'Pesée',
  QC_DECIDED: 'QC',
  COLD_STORE: 'Froid',
  FUMIGATION_CCP: 'Fumigation',
  TRIAGE: 'Triage',
  PACKED: 'Conditionnement',
  SHIPPED: 'Expédition',
};

export const GoldenThreadPanel = ({ onOpenScan }: { onOpenScan?: () => void }) => {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['golden-thread'],
    queryFn: () => trustApi.getGoldenThread(),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <Card className="surface-card">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Chargement du fil d'or Deglet Nour…
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="surface-card">
        <CardContent className="p-6 space-y-3">
          <p className="text-sm text-red-600 font-medium">Impossible de charger le fil d'or W1.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const topLots = data.lots.slice(0, 6);

  return (
    <Card className="surface-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Fil d'or — Deglet Nour premium
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Chaîne serveur hash-vérifiée : réception → pesée → QC → froid → fumigation CCP → triage →
          conditionnement → expédition.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Lots suivis" value={data.totalTracked} />
          <Metric label="Complets" value={data.complete} tone="ok" />
          <Metric label="En cours" value={data.inProgress} />
          <Metric label="Chaînes cassées" value={data.broken} tone={data.broken > 0 ? 'bad' : 'ok'} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {data.stages.map((stage) => (
            <Badge key={stage} variant="secondary" className="text-[11px]">
              {STAGE_LABELS[stage] || stage}
            </Badge>
          ))}
        </div>

        <div className="space-y-3">
          {topLots.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Aucun lot sur le fil d'or pour l'instant. Créez une réception Deglet Nour pour démarrer.
            </p>
          ) : (
            topLots.map((lot) => (
              <div key={lot.lotId} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs truncate">{lot.lotId}</div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {lot.valid ? (
                      <Badge className="bg-emerald-600 gap-1">
                        <BadgeCheck className="h-3 w-3" />
                        Hash OK
                      </Badge>
                    ) : (
                      <Badge className="bg-red-600 gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Cassée
                      </Badge>
                    )}
                    {lot.goldenThreadComplete && <Badge className="bg-emerald-700">Complet</Badge>}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Étape : {STAGE_LABELS[lot.stage || ''] || lot.stage || '—'}</span>
                  <span>{lot.progress.percent}%</span>
                </div>
                <Progress value={lot.progress.percent} className="h-1.5" />
              </div>
            ))
          )}
        </div>

        {onOpenScan && (
          <Button variant="outline" size="sm" onClick={onOpenScan}>
            Ouvrir station scan
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const Metric = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'bad';
}) => (
  <div className="rounded-md border p-3">
    <div
      className={`text-xl font-bold ${
        tone === 'ok' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : ''
      }`}
    >
      {value}
    </div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);
