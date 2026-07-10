import { useAlertIntelligence } from '@/hooks/useFounderAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { AlertTriangle, Clock } from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'quarter';

const SEV_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  URGENCE: { bg: 'bg-red-600', text: 'text-white', label: 'Urgence' },
  CRITIQUE: { bg: 'bg-red-400', text: 'text-white', label: 'Critique' },
  AVERTISSEMENT: { bg: 'bg-amber-400', text: 'text-white', label: 'Avertissement' },
  INFO: { bg: 'bg-blue-400', text: 'text-white', label: 'Info' },
};

export function AlertsIntelligence({ period }: { period: Period }) {
  const { data, isLoading } = useAlertIntelligence(period);

  if (isLoading) return <div className="py-20 text-center text-sm text-muted-foreground animate-pulse">Analyse alertes…</div>;

  return (
    <div className="space-y-4">
      {/* Severity breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(SEV_STYLE).map(([sev, style]) => {
          const count = data?.bySeverity[sev as keyof typeof data.bySeverity] ?? 0;
          return (
            <Card key={sev} className={count > 0 && (sev === 'URGENCE' || sev === 'CRITIQUE') ? 'border-red-300' : ''}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`h-2 w-2 rounded-full ${style.bg}`} />
                  <span className="text-xs text-muted-foreground">{style.label}</span>
                </div>
                <div className={`text-3xl font-black ${count > 0 && (sev === 'URGENCE' || sev === 'CRITIQUE') ? 'text-red-600' : 'text-foreground'}`}>{count}</div>
                <div className="text-[11px] text-muted-foreground">sur la période</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Actives', val: data?.byStatus.ACTIVE ?? 0, cls: 'text-red-600' },
          { label: 'Acquittées', val: data?.byStatus.ACKNOWLEDGED ?? 0, cls: 'text-amber-600' },
          { label: 'Résolues', val: data?.byStatus.RESOLVED ?? 0, cls: 'text-green-600' },
        ].map(({ label, val, cls }) => (
          <Card key={label}>
            <CardContent className="pt-3 pb-3 flex items-center gap-3">
              <div className={`text-2xl font-black ${cls}`}>{val}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data?.mttrMin != null && data.mttrMin > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-3 pb-3 flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-600 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-blue-800">MTTR — Temps moyen de résolution</div>
              <div className="text-xs text-blue-600">Mean Time To Resolve (alertes résolues)</div>
            </div>
            <div className="ml-auto text-2xl font-black text-blue-700">
              {data.mttrMin >= 60 ? `${Math.floor(data.mttrMin / 60)}h ${data.mttrMin % 60}m` : `${data.mttrMin} min`}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily trend */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Tendance quotidienne (30 jours)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.daily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="critGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="warnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip />
                <Area type="monotone" dataKey="warning" name="Avert." stroke="#f59e0b" fill="url(#warnGrad)" strokeWidth={1.5} stackId="1" />
                <Area type="monotone" dataKey="critical" name="Critique" stroke="#ef4444" fill="url(#critGrad)" strokeWidth={2} stackId="1" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top alert types */}
      {(data?.topTypes.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Codes d'alerte les plus fréquents</CardTitle></CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.topTypes} layout="vertical" margin={{ left: 0, right: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="code" tick={{ fontSize: 9 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" name="Occurrences" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
