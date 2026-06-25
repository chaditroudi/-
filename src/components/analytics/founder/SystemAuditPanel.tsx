import { useState } from 'react';
import { useAuditLogs, useAuditStats, type AuditLog } from '@/hooks/useSystemAudit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import type { ElementType } from 'react';
import { Activity, Shield, User, AlertTriangle, LogIn, Database, RefreshCw, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const EVENT_STYLE: Record<string, { bg: string; text: string; label: string; icon: ElementType }> = {
  DATA_CHANGE:     { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Modification', icon: Database },
  AUTH_LOGIN:      { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Connexion',    icon: LogIn },
  AUTH_SIGNUP:     { bg: 'bg-emerald-100',text: 'text-emerald-700',label: 'Inscription',  icon: LogIn },
  AUTH_FAILED:     { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Échec auth',   icon: AlertTriangle },
  SECURITY_DENIED: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Accès refusé', icon: Shield },
};

const ACTION_STYLE: Record<string, { bg: string; text: string }> = {
  INSERT:        { bg: 'bg-green-500',  text: 'text-white' },
  UPDATE:        { bg: 'bg-blue-500',   text: 'text-white' },
  DELETE:        { bg: 'bg-red-500',    text: 'text-white' },
  AUTH_LOGIN:    { bg: 'bg-green-500',  text: 'text-white' },
  AUTH_SIGNUP:   { bg: 'bg-emerald-500',text: 'text-white' },
  AUTH_FAILED:   { bg: 'bg-red-500',    text: 'text-white' },
  AUTHZ_DENIED:  { bg: 'bg-orange-500', text: 'text-white' },
};

const ACTION_LABEL: Record<string, string> = {
  INSERT: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  AUTH_LOGIN: 'Connexion',
  AUTH_SIGNUP: 'Inscription',
  AUTH_FAILED: 'Échec',
  AUTHZ_DENIED: 'Refusé',
};

function SeverityDot({ sev }: { sev: string }) {
  const color = sev === 'warning' ? 'bg-amber-400' : sev === 'critical' ? 'bg-red-500' : 'bg-blue-400';
  return <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${color}`} />;
}

function LogRow({ log }: { log: AuditLog }) {
  const ev = EVENT_STYLE[log.event_type] ?? { bg: 'bg-gray-100', text: 'text-gray-700', label: log.event_type, icon: Activity };
  const ac = ACTION_STYLE[log.action] ?? { bg: 'bg-gray-400', text: 'text-white' };
  const Icon = ev.icon;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0 hover:bg-muted/30 px-1 rounded transition-colors">
      <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${ev.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${ev.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`text-[10px] h-4 px-1.5 ${ac.bg} ${ac.text}`}>
            {ACTION_LABEL[log.action] ?? log.action}
          </Badge>
          <span className="text-xs font-medium text-foreground truncate">{log.module}</span>
          {log.table && <span className="text-[10px] text-muted-foreground font-mono">{log.table}</span>}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{log.message}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {(log.user_name || log.user_email) && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <User className="h-3 w-3" />
              {log.user_name ?? log.user_email}
            </span>
          )}
          {log.ip_address && (
            <span className="text-[10px] text-muted-foreground font-mono">{log.ip_address}</span>
          )}
          <SeverityDot sev={log.severity} />
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground shrink-0 text-right">
        {log.created_at ? formatDistanceToNow(new Date(log.created_at), { locale: fr, addSuffix: true }) : '—'}
      </div>
    </div>
  );
}

const ALL = '__all__';

export function SystemAuditPanel() {
  const [moduleFilter, setModuleFilter] = useState<string>(ALL);
  const [eventFilter, setEventFilter] = useState<string>(ALL);
  const [search, setSearch] = useState('');

  const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: statsData, isLoading: statsLoading, isError: statsError } = useAuditStats(now24h);
  const { data: logsData, isLoading: logsLoading, isError: logsError, dataUpdatedAt } = useAuditLogs({
    limit: 100,
    module: moduleFilter !== ALL ? moduleFilter : undefined,
    eventType: eventFilter !== ALL ? eventFilter : undefined,
    from: now24h,
  });

  const logs = logsData?.logs ?? [];
  const filtered = search
    ? logs.filter(l =>
        l.message.toLowerCase().includes(search.toLowerCase()) ||
        (l.user_email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (l.user_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (l.table ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  if (statsError && logsError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Shield className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">Impossible de charger le journal d'audit</p>
        <p className="text-xs">Vérifiez que le serveur est en ligne et que vous êtes bien connecté.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-bold">Journal d'audit système</span>
          <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />
          {dataUpdatedAt ? `Mis à jour ${formatDistanceToNow(new Date(dataUpdatedAt), { locale: fr, addSuffix: true })}` : ''}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Actions (24h)</div>
            <div className="text-3xl font-black">{statsLoading ? '…' : statsData?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card className={(statsData?.securityEvents ?? 0) > 0 ? 'border-red-300 bg-red-50' : ''}>
          <CardContent className="pt-3 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Évènements sécurité</div>
            <div className={`text-3xl font-black ${(statsData?.securityEvents ?? 0) > 0 ? 'text-red-600' : ''}`}>
              {statsLoading ? '…' : statsData?.securityEvents ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Utilisateurs actifs</div>
            <div className="text-3xl font-black">{statsLoading ? '…' : statsData?.topUsers.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Modules touchés</div>
            <div className="text-3xl font-black">{statsLoading ? '…' : statsData?.topModules.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 24h activity timeline */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Activité système — 24 dernières heures</CardTitle></CardHeader>
        <CardContent>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={statsData?.timeline} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="auditGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#107754" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#107754" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" name="Actions" stroke="#107754" fill="url(#auditGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top modules */}
        {(statsData?.topModules.length ?? 0) > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Modules les plus actifs</CardTitle></CardHeader>
            <CardContent>
              <div style={{ height: Math.max((statsData?.topModules.length ?? 1) * 28 + 20, 80) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsData?.topModules} layout="vertical" margin={{ left: 0, right: 16 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis type="category" dataKey="module" tick={{ fontSize: 9 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="count" name="Actions" fill="#107754" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top users */}
        {(statsData?.topUsers.length ?? 0) > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Utilisateurs les plus actifs</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {statsData?.topUsers.map((u, i) => (
                  <div key={u.id} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{u.name ?? u.email}</div>
                      {u.name && <div className="text-[10px] text-muted-foreground truncate">{u.email}</div>}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{u.count} actions</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Live log feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm">Flux d'activité en temps réel</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Recherche…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 pl-7 w-40 text-xs"
                />
              </div>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Tous modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous modules</SelectItem>
                  {statsData?.topModules.map(m => (
                    <SelectItem key={m.module} value={m.module}>{m.module}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Tous types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tous types</SelectItem>
                  <SelectItem value="DATA_CHANGE">Modifications</SelectItem>
                  <SelectItem value="AUTH_LOGIN">Connexions</SelectItem>
                  <SelectItem value="AUTH_FAILED">Échecs auth</SelectItem>
                  <SelectItem value="SECURITY_DENIED">Accès refusés</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">Chargement du journal…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Aucune activité sur cette période.</div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto pr-1">
              {filtered.map(log => <LogRow key={log.id} log={log} />)}
            </div>
          )}
          {logsData && (
            <div className="text-[10px] text-muted-foreground text-center mt-3">
              {filtered.length} entrées affichées sur {logsData.total} au total
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
