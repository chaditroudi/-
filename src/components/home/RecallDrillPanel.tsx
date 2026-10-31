import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { trustApi, type RecallDrillResult } from '@/lib/api/trust';
import { buildLotPassportUrl } from '@/lib/passportUrl';
import { printRecallReport } from '@/lib/printRecallReport';
import { useSiteSettings } from '@/hooks/useSettings';
import { useAuthContext } from '@/contexts/AuthContext';
import { useBranding } from '@/hooks/useBranding';
import { ExternalLink, FileDown, Timer, Radar } from 'lucide-react';

interface RecallDrillPanelProps {
  /** Prefill lot from Parcours / deep-link. */
  initialLot?: string;
  compact?: boolean;
}

export const RecallDrillPanel = ({ initialLot, compact = false }: RecallDrillPanelProps) => {
  const [query, setQuery] = useState(initialLot || '');
  const [result, setResult] = useState<RecallDrillResult | null>(null);
  const { data: settings } = useSiteSettings();
  const { profile, user } = useAuthContext();
  const { companyName } = useBranding();

  useEffect(() => {
    if (initialLot) setQuery(initialLot);
  }, [initialLot]);

  const mutation = useMutation({
    mutationFn: async (raw?: string) => {
      const value = String(raw ?? query).trim();
      if (!value) throw new Error('Saisissez un lot, LOT-ID ou SSCC.');
      const looksLikeSscc = /^(\(00\)|\d{18})$/.test(value) || value.toUpperCase().startsWith('SSCC');
      return trustApi.runRecall(
        looksLikeSscc
          ? { sscc: value }
          : { lotId: value, lotNumber: value },
      );
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(
        data.under60s
          ? `Recall OK en ${data.elapsedMs} ms`
          : `Recall terminé en ${data.elapsedMs} ms (cible < 60s)`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handlePrint = () => {
    if (!result) return;
    try {
      printRecallReport(result, {
        companyName,
        plantName: settings?.plant_name,
        coordinator: settings?.quality?.recall_coordinator,
        preparedBy: profile?.full_name || user?.email || null,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impression impossible');
    }
  };

  return (
    <Card className="surface-card">
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className="text-base flex items-center gap-2">
          <Radar className="h-4 w-4" />
          Drill recall &lt; 60s
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!compact && (
          <p className="text-sm text-muted-foreground">
            Simulation auditeur : amont / aval depuis le registre lot + dossier traçabilité. Générez le
            PDF pour le dossier audit.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="LOT-ID, lot_internal ou SSCC"
            onKeyDown={(event) => {
              if (event.key === 'Enter') mutation.mutate(undefined);
            }}
          />
          <Button onClick={() => mutation.mutate(undefined)} disabled={mutation.isPending}>
            {mutation.isPending ? 'Recherche…' : 'Lancer recall'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={!result}
            onClick={handlePrint}
          >
            <FileDown className="h-4 w-4" />
            Rapport PDF
          </Button>
        </div>

        {result && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={result.under60s ? 'bg-emerald-600' : 'bg-orange-500'}>
                <Timer className="h-3 w-3 mr-1" />
                {result.elapsedMs} ms
              </Badge>
              <Badge className={result.valid ? 'bg-emerald-700' : 'bg-red-600'}>
                Hash {result.valid ? 'OK' : 'cassé'}
              </Badge>
              <Badge variant="secondary">{result.lotNumber}</Badge>
              <a
                className="inline-flex items-center gap-1 text-xs text-emerald-800 underline"
                href={buildLotPassportUrl(result.resolvedLotId)}
                target="_blank"
                rel="noreferrer"
              >
                Passeport public <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Stat label="Nœuds" value={result.stats.nodeCount} />
              <Stat label="Amont" value={result.stats.upstreamCount} />
              <Stat label="Aval" value={result.stats.downstreamCount} />
              <Stat label="Expéditions" value={result.stats.shipmentCount} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <NodeList title="Amont" nodes={result.upstream} />
              <NodeList title="Aval" nodes={result.downstream} />
            </div>

            {(result.impactedShipments.length > 0 || result.impactedPalettes.length > 0) && (
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded border p-2">
                  <p className="font-semibold text-muted-foreground">Expéditions</p>
                  <ul className="mt-1 space-y-0.5">
                    {result.impactedShipments.slice(0, 6).map((s) => (
                      <li key={s.id || s.reference || Math.random()}>
                        {s.reference || '—'} · {s.customer || '—'}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded border p-2">
                  <p className="font-semibold text-muted-foreground">Palettes</p>
                  <ul className="mt-1 space-y-0.5">
                    {result.impactedPalettes.slice(0, 6).map((p) => (
                      <li key={p.id || p.sscc || Math.random()}>
                        {p.palette_number || '—'} · {p.sscc || '—'}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded border p-2">
    <div className="text-lg font-bold">{value}</div>
    <div className="text-muted-foreground">{label}</div>
  </div>
);

const NodeList = ({
  title,
  nodes,
}: {
  title: string;
  nodes: RecallDrillResult['upstream'];
}) => (
  <div className="rounded border p-2 space-y-1">
    <p className="text-xs font-semibold text-muted-foreground">{title}</p>
    <div className="max-h-40 overflow-auto space-y-1">
      {nodes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucun</p>
      ) : (
        nodes.slice(0, 12).map((node) => (
          <div key={node.id} className="text-xs flex justify-between gap-2">
            <span className="truncate">{node.label}</span>
            <span className="text-muted-foreground shrink-0">{node.type}</span>
          </div>
        ))
      )}
    </div>
  </div>
);
