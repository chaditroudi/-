import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { trustApi, type RecallDrillResult } from '@/lib/api/trust';
import { buildLotPassportUrl } from '@/lib/passportUrl';
import { ExternalLink, Timer, Radar } from 'lucide-react';

export const RecallDrillPanel = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<RecallDrillResult | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const value = query.trim();
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

  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Radar className="h-4 w-4" />
          Drill recall &lt; 60s
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Simulation auditeur : amont / aval depuis le registre lot + dossier traçabilité. Cible produit :
          réponse sous 60 secondes.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="LOT-ID, lot_internal ou SSCC"
            onKeyDown={(event) => {
              if (event.key === 'Enter') mutation.mutate();
            }}
          />
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Recherche…' : 'Lancer recall'}
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
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
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
