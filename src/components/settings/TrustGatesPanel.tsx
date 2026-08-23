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
    <Card className="rounded-[24px] border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 text-primary" />
          Trust B0 — gates & claims
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
                  ['scan', data.gates.scan],
                  ['ccp', data.gates.ccp],
                  ['stage', data.gates.stage],
                  ['mass', data.gates.mass_balance],
                ] as const
              ).map(([label, mode]) => (
                <Badge key={label} className={tone(mode)}>
                  {label}: {mode}
                </Badge>
              ))}
            </div>

            <div className="rounded-xl border px-3 py-2">
              <p className="text-xs text-muted-foreground">GS1 company prefix</p>
              <p className="font-mono text-sm">
                {data.gs1.company_prefix}
                {data.gs1.placeholder ? ' · placeholder' : ''}
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
              <p className="text-xs leading-relaxed">{data.next}</p>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Process swallowed stage failures: {data.swallowed_stage_failures_process}
              {' · '}
              Env: TRUST_SCAN_GATE / TRUST_CCP_GATE / TRUST_STAGE_GATE / TRUST_MASS_BALANCE_GATE
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
