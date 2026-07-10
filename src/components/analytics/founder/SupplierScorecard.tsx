import { useSupplierIntelligence } from '@/hooks/useFounderAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Users } from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'quarter';

const acceptColor = (v: number) => v >= 90 ? '#22c55e' : v >= 75 ? '#f59e0b' : '#ef4444';
const acceptLabel = (v: number) => v >= 90 ? 'Excellent' : v >= 75 ? 'Moyen' : 'Faible';

export function SupplierScorecard({ period }: { period: Period }) {
  const { data, isLoading } = useSupplierIntelligence(period);

  if (isLoading) return <div className="py-20 text-center text-sm text-muted-foreground animate-pulse">Analyse fournisseurs…</div>;

  const suppliers = data?.topSuppliers ?? [];
  const totalKg = suppliers.reduce((s, r) => s + r.kgReceived, 0);

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <div className="text-2xl font-black">{suppliers.length}</div>
              <div className="text-xs text-muted-foreground">Fournisseurs actifs</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-black">{totalKg >= 1000 ? `${(totalKg / 1000).toFixed(1)}t` : `${totalKg.toFixed(0)} kg`}</div>
            <div className="text-xs text-muted-foreground">Total reçu</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-black">
              {suppliers.length > 0
                ? `${(suppliers.reduce((s, r) => s + r.acceptanceRate, 0) / suppliers.length).toFixed(1)}%`
                : '—'}
            </div>
            <div className="text-xs text-muted-foreground">Taux acceptation moyen</div>
          </CardContent>
        </Card>
      </div>

      {/* Horizontal bar chart */}
      {suppliers.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">Top fournisseurs — kg livrés</CardTitle></CardHeader>
          <CardContent>
            <div style={{ height: Math.max(suppliers.length * 36 + 20, 120) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={suppliers} layout="vertical" margin={{ left: 0, right: 20, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
                  <Tooltip formatter={(v: number) => [`${v >= 1000 ? `${(v / 1000).toFixed(2)} t` : `${v.toFixed(0)} kg`}`, 'Kg reçus']} />
                  <Bar dataKey="kgReceived" name="kg reçus" radius={[0, 4, 4, 0]}>
                    {suppliers.map((s, i) => (
                      <Cell key={s.supplierId} fill={`hsl(${140 + i * 20}, 65%, ${45 + i * 3}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Aucune réception enregistrée sur cette période.
          </CardContent>
        </Card>
      )}

      {/* Per-supplier detail table */}
      {suppliers.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Détail par fournisseur</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suppliers.map((s, i) => (
                <div key={s.supplierId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                  <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: `hsl(${140 + i * 20}, 65%, 45%)` }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">{s.deliveries} livraison{s.deliveries > 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm">
                      {s.kgReceived >= 1000 ? `${(s.kgReceived / 1000).toFixed(2)} t` : `${s.kgReceived.toFixed(0)} kg`}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {totalKg > 0 ? `${((s.kgReceived / totalKg) * 100).toFixed(1)}% du total` : ''}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Badge className="text-[11px] h-5 px-1.5" style={{ background: acceptColor(s.acceptanceRate) }}>
                      {s.acceptanceRate.toFixed(0)}% — {acceptLabel(s.acceptanceRate)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
