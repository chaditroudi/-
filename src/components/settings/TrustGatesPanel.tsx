import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/integrations/mongodb/client';
import { AlertTriangle, CheckCircle2, Shield } from 'lucide-react';

type GateStatus = {
  wave: string;
  gates: {
    scan: string;
    ccp: string;
    mass_balance: string;
    stage: string;
  };
  gs1: { company_prefix: string; placeholder: boolean };
  swallowed_stage_failures_process: number;
  enforce_ready: boolean;
  next: string;
};

// Translate only known server advice; preserve any future server message verbatim.
const adviceFr: Record<string, string> = {
  "Claims are in enforce mode with a non-placeholder GS1 prefix.": "Les contrôles sont en mode strict, avec un préfixe GS1 non provisoire.",
  "Run a warn-mode shift with zero LOT_LEDGER_STAGE_FAILED, then set TRUST_SCAN_GATE / TRUST_CCP_GATE / TRUST_STAGE_GATE=enforce and replace GS1 prefix.": "Effectuer une équipe en mode avertissement sans aucun LOT_LEDGER_STAGE_FAILED, puis passer TRUST_SCAN_GATE / TRUST_CCP_GATE / TRUST_STAGE_GATE à enforce et remplacer le préfixe GS1."
};

const tone = (mode: string) => {
  if (mode === 'enforce') return 'bg-emerald-600 text-white';
  if (mode === 'off') return 'bg-slate-500 text-white';
  return 'bg-amber-500 text-white';
};

/** B0 — live gate / GS1 readiness for admins. */
export function TrustGatesPanel() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['trust-gates'],
    queryFn: async () => {
      const res = await apiRequest<{ data: GateStatus }>('/trust/gates');
      return res.data;
    },
    refetchInterval: 30_000,
  });

  return (
    <Card className="rounded-lg border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 text-primary" />
          Contrôles de traçabilité
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading && <p className="text-muted-foreground">Chargement…</p>}
        {isError && (
          <p className="text-red-600">
            {error instanceof Error ? error.message : 'Impossible de lire /trust/gates'}
          </p>
        )}
        {data && (
          <>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['Scan', data.gates.scan],
                  ['CCP', data.gates.ccp],
                  ['Étapes', data.gates.stage],
                  ['Bilan matière', data.gates.mass_balance],
                ] as const
              ).map(([label, mode]) => (
                <Badge key={label} className={tone(mode)}>
                  {label}: {mode}
                </Badge>
              ))}
            </div>

            <div className="rounded-xl border px-3 py-2">
              <p className="text-xs text-muted-foreground">Préfixe société GS1</p>
              <p className="font-mono text-sm">
                {data.gs1.company_prefix}
                {data.gs1.placeholder ? ', provisoire' : ''}
              </p>
            </div>

            <div
              className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 ${
                data.enforce_ready
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-950'
              }`}
            >
              {data.enforce_ready ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <p className="text-xs leading-relaxed">{adviceFr[data.next] ?? data.next}</p>
            </div>

            <p className="text-xs text-muted-foreground">
              Échecs d'étape non remontés par le processus : {data.swallowed_stage_failures_process}
              {' · '}
              Env: TRUST_SCAN_GATE / TRUST_CCP_GATE / TRUST_STAGE_GATE / TRUST_MASS_BALANCE_GATE
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
