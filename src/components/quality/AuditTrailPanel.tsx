import { useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { useAuditLogs, useAuditStats } from '@/hooks/useSystemAudit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PAGE_SIZE = 50;

const KNOWN_MODULES = [
  'reception',
  'quality',
  'production',
  'packaging',
  'stock',
  'logistics',
  'purchasing',
  'auth',
  'system',
];

type SeverityFilter = 'all' | 'info' | 'warning' | 'critical';

const severityConfig: Record<'info' | 'warning' | 'critical', { label: string; classes: string; Icon: typeof Info }> = {
  info:     { label: 'Info',     classes: 'border-blue-200 bg-blue-50 text-blue-700',     Icon: Info },
  warning:  { label: 'Warning',  classes: 'border-amber-200 bg-amber-50 text-amber-700',  Icon: AlertTriangle },
  critical: { label: 'Critique', classes: 'border-red-300 bg-red-50 text-red-700',        Icon: ShieldAlert },
};

const fmtDateTime = (v: string) =>
  format(parseISO(v), 'dd/MM/yyyy HH:mm:ss', { locale: fr });

export const AuditTrailPanel = () => {
  const [page, setPage] = useState(0);
  const [moduleFilter, setModuleFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [fromDate, setFromDate] = useState(() =>
    subDays(new Date(), 7).toISOString().slice(0, 10),
  );

  const { data, isLoading } = useAuditLogs({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    module: moduleFilter || undefined,
    eventType: severityFilter !== 'all' ? severityFilter : undefined,
    from: fromDate ? new Date(fromDate).toISOString() : undefined,
  });

  const { data: stats } = useAuditStats(
    fromDate ? new Date(fromDate).toISOString() : undefined,
  );

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleFilterChange = () => setPage(0);

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{stats.total.toLocaleString('fr-FR')}</div>
                  <div className="text-sm text-muted-foreground">Événements totaux</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                <div>
                  <div className="text-2xl font-bold">{stats.securityEvents}</div>
                  <div className="text-sm text-muted-foreground">Événements sécurité</div>
                </div>
              </div>
            </CardContent>
          </Card>
          {stats.topModules[0] && (
            <Card>
              <CardContent className="pt-5">
                <div>
                  <div className="text-lg font-bold truncate">{stats.topModules[0].module}</div>
                  <div className="text-sm text-muted-foreground">
                    Module le plus actif ({stats.topModules[0].count})
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {stats.topUsers[0] && (
            <Card>
              <CardContent className="pt-5">
                <div>
                  <div className="text-sm font-bold truncate">{stats.topUsers[0].name || stats.topUsers[0].email}</div>
                  <div className="text-sm text-muted-foreground">
                    Utilisateur le plus actif ({stats.topUsers[0].count} actions)
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Journal d'audit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Depuis</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); handleFilterChange(); }}
                className="w-[160px]"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Module</Label>
              <Select
                value={moduleFilter || 'all'}
                onValueChange={(v) => { setModuleFilter(v === 'all' ? '' : v); handleFilterChange(); }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les modules</SelectItem>
                  {KNOWN_MODULES.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Sévérité</Label>
              <Select
                value={severityFilter}
                onValueChange={(v) => { setSeverityFilter(v as SeverityFilter); handleFilterChange(); }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              Chargement…
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              Aucun événement pour les filtres sélectionnés.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/heure</TableHead>
                    <TableHead>Sévérité</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead className="min-w-[260px]">Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const sev = severityConfig[log.severity] ?? severityConfig.info;
                    const SevIcon = sev.Icon;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap font-mono">
                          {fmtDateTime(log.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${sev.classes} gap-1 text-xs`}>
                            <SevIcon className="h-3 w-3" />
                            {sev.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{log.module}</TableCell>
                        <TableCell className="text-xs">{log.action}</TableCell>
                        <TableCell className="text-xs">
                          <div>{log.user_name || '—'}</div>
                          {log.user_email && (
                            <div className="text-muted-foreground">{log.user_email}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[320px] truncate">
                          {log.message}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">
                  {total.toLocaleString('fr-FR')} événement{total > 1 ? 's' : ''} · page {page + 1}/{totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
