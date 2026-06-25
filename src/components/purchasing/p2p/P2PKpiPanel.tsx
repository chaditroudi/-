import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useRFQs, useGoodsReceipts, useSupplierInvoices, useSupplierCertificates } from '@/hooks/useP2P';
import { useRequisitions, usePurchaseOrders } from '@/hooks/usePurchasing';
import { getExpiryAlertLevel } from '@/types/p2p';
import { useSettingsContext } from '@/contexts/SettingsContext';

const fmt = (n: number, dec = 1) =>
  n.toLocaleString('fr-FR', { maximumFractionDigits: dec });

const pct = (num: number, den: number) =>
  den === 0 ? '—' : `${fmt((num / den) * 100)}%`;

export const P2PKpiPanel = () => {
  const { settings } = useSettingsContext();
  const { data: requisitions = [] } = useRequisitions();
  const { data: orders = [] } = usePurchaseOrders();
  const { data: rfqs = [] } = useRFQs();
  const { data: receipts = [] } = useGoodsReceipts();
  const { data: invoices = [] } = useSupplierInvoices();
  const { data: certificates = [] } = useSupplierCertificates();
  const certificateAlertDays = Array.from(
    new Set(
      Object.values(settings.p2p.sites).flatMap((siteRule) => siteRule.cert_alert_days),
    ),
  ).sort((a, b) => b - a);

  // ── Cycle time DA→BC (days) ────────────────────────────────────────────────
  const cycleTimes = useMemo(() => {
    return orders
      .filter((o) => o.requisition_id && o.created_at)
      .map((o) => {
        const req = requisitions.find((r) => r.id === o.requisition_id);
        if (!req?.created_at) return null;
        return (
          (new Date(o.created_at).getTime() - new Date(req.created_at).getTime()) /
          86_400_000
        );
      })
      .filter((d): d is number => d !== null && d >= 0);
  }, [orders, requisitions]);

  const avgCycleTime =
    cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : null;

  // ── Approval rate (DA approved / DA submitted) ─────────────────────────────
  const submitted = requisitions.filter((r) =>
    ['pending_approval', 'approved', 'ordered', 'rejected'].includes(r.status),
  ).length;
  const approved = requisitions.filter((r) =>
    ['approved', 'ordered'].includes(r.status),
  ).length;

  // ── 3-way match rate ───────────────────────────────────────────────────────
  const matchedInvoices = invoices.filter(
    (i) => i.match_result === 'MATCH' || i.match_result === 'ECART_TOLERANCE',
  ).length;
  const totalInvoices = invoices.filter((i) => i.match_result !== 'NON_VERIFIE').length;

  // ── OTIF ──────────────────────────────────────────────────────────────────
  const receivedOnTime = receipts.filter((r) => {
    if (!r.expected_date || !r.received_date) return false;
    return new Date(r.received_date) <= new Date(r.expected_date);
  }).length;
  const totalReceived = receipts.filter((r) => r.received_date).length;

  // ── Cert expiry alerts ─────────────────────────────────────────────────────
  const certExpired = certificates.filter((c) => getExpiryAlertLevel(c.expiry_date, certificateAlertDays) === 'EXPIRED').length;
  const certJ30 = certificates.filter((c) => getExpiryAlertLevel(c.expiry_date, certificateAlertDays) === 'J30').length;
  const certJ60 = certificates.filter((c) => getExpiryAlertLevel(c.expiry_date, certificateAlertDays) === 'J60').length;

  // ── Spend by status ────────────────────────────────────────────────────────
  const spendByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      const s = o.status;
      map[s] = (map[s] ?? 0) + (o.total_amount ?? 0);
    });
    return Object.entries(map)
      .map(([status, amount]) => ({ status, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [orders]);

  // ── Supplier performance ───────────────────────────────────────────────────
  const supplierNCRate = useMemo(() => {
    const map: Record<string, { total: number; rejected: number; name: string }> = {};
    receipts.forEach((r) => {
      const key = r.supplier_id;
      if (!map[key]) map[key] = { total: 0, rejected: 0, name: r.supplier_name ?? key };
      map[key].total += r.total_received_qty;
      map[key].rejected += r.total_rejected_qty;
    });
    return Object.values(map)
      .filter((x) => x.total > 0)
      .map((x) => ({ name: x.name, ncRate: (x.rejected / x.total) * 100 }))
      .sort((a, b) => b.ncRate - a.ncRate)
      .slice(0, 5);
  }, [receipts]);

  const kpis = [
    {
      label: 'Délai moyen DA→BC',
      value: avgCycleTime !== null ? `${fmt(avgCycleTime)} j` : '—',
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      target: '< 5 j',
      ok: avgCycleTime !== null && avgCycleTime <= 5,
    },
    {
      label: 'Taux approbation DA',
      value: pct(approved, submitted),
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      target: '> 80%',
      ok: submitted > 0 && approved / submitted >= 0.8,
    },
    {
      label: 'Taux rapprochement',
      value: pct(matchedInvoices, totalInvoices),
      icon: ArrowLeftRight,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      target: '> 95%',
      ok: totalInvoices > 0 && matchedInvoices / totalInvoices >= 0.95,
    },
    {
      label: 'OTIF livraisons',
      value: pct(receivedOnTime, totalReceived),
      icon: Target,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      target: '> 90%',
      ok: totalReceived > 0 && receivedOnTime / totalReceived >= 0.9,
    },
    {
      label: 'Certificats expirés',
      value: String(certExpired),
      icon: ShieldCheck,
      color: certExpired > 0 ? 'text-red-600' : 'text-emerald-600',
      bg: certExpired > 0 ? 'bg-red-50' : 'bg-emerald-50',
      target: '0',
      ok: certExpired === 0,
    },
    {
      label: 'AO actifs',
      value: String(rfqs.filter((r) => ['ENVOYEE', 'REPONSE_RECUE'].includes(r.status)).length),
      icon: TrendingUp,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      target: null,
      ok: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className={kpi.ok === false ? 'border-red-300' : ''}>
            <CardContent className={`p-3 ${kpi.bg} rounded-lg`}>
              <div className="flex items-center justify-between mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                {kpi.ok !== null && (
                  <span className={`text-xs font-semibold ${kpi.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {kpi.ok ? '✓' : '✗'}
                  </span>
                )}
              </div>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              {kpi.target && (
                <p className="text-xs text-muted-foreground/60">Cible: {kpi.target}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cert expiry alert bar */}
      {(certExpired > 0 || certJ30 > 0 || certJ60 > 0) && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="flex gap-4">
            {certExpired > 0 && <span className="text-red-700 font-semibold">{certExpired} certificat(s) expiré(s)</span>}
            {certJ30 > 0 && <span className="text-orange-700">{certJ30} expire dans 30j</span>}
            {certJ60 > 0 && <span className="text-amber-700">{certJ60} expire dans 60j</span>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Spend by status */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Engagements BC par statut (TND)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {spendByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={spendByStatus} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString('fr-FR')} TND`} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {spendByStatus.map((_, i) => (
                      <Cell
                        key={i}
                        fill={['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444'][i % 5]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* NC rate by supplier */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Taux NC par fournisseur (%)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {supplierNCRate.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée réception</p>
            ) : (
              <div className="space-y-2">
                {supplierNCRate.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-28 truncate">{s.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${s.ncRate > 10 ? 'bg-red-500' : s.ncRate > 5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(s.ncRate * 5, 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold w-10 text-right ${s.ncRate > 10 ? 'text-red-600' : s.ncRate > 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {fmt(s.ncRate)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline summary */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Pipeline P2P — vue d'ensemble</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-sm">
            {[
              {
                label: 'DA en attente',
                value: requisitions.filter((r) => r.status === 'pending_approval').length,
                color: 'text-yellow-600',
              },
              {
                label: 'BC actifs',
                value: orders.filter((o) =>
                  ['submitted', 'confirmed', 'partially_delivered'].includes(o.status),
                ).length,
                color: 'text-blue-600',
              },
              {
                label: 'AO en cours',
                value: rfqs.filter((r) => ['ENVOYEE', 'REPONSE_RECUE'].includes(r.status)).length,
                color: 'text-indigo-600',
              },
              {
                label: 'BR quarantaine',
                value: receipts.filter((r) => r.status === 'EN_QUARANTAINE').length,
                color: 'text-amber-600',
              },
              {
                label: 'Factures litiges',
                value: invoices.filter((i) => i.status === 'EN_LITIGE').length,
                color: 'text-red-600',
              },
            ].map((item) => (
              <div key={item.label} className="bg-muted/40 rounded-lg p-3">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
