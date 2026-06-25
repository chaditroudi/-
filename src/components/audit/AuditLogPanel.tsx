import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuditLogs, AuditLog } from '@/hooks/useSystemAudit';
import {
  History, Search, FileText, Package, Truck, Factory, ClipboardCheck,
  User, Eye, Shield, Warehouse, ShoppingCart, Users, Zap, BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ── Category chips ────────────────────────────────────────────────────────────

type Category = {
  key: string;
  label: string;
  Icon: React.ElementType;
  match: (log: AuditLog) => boolean;
};

const CATEGORIES: Category[] = [
  { key: 'all',       label: 'Tous',       Icon: History,       match: () => true },
  { key: 'auth',      label: 'Auth',       Icon: Shield,        match: (l) => (l.event_type ?? '').startsWith('AUTH') || l.event_type === 'ACCESS_DENIED' },
  { key: 'recv',      label: 'Réceptions', Icon: Truck,         match: (l) => (l.module ?? '').includes('Réception') },
  { key: 'prod',      label: 'Production', Icon: Factory,       match: (l) => (l.module ?? '').includes('Production') || (l.module ?? '').includes('Conditionnement') },
  { key: 'phase2',    label: 'Phase 2',    Icon: Zap,           match: (l) => ['Phase 2', 'Fumigation', 'Triage', 'Nettoyage', 'Hydratation'].some((k) => (l.module ?? '').includes(k)) },
  { key: 'quality',   label: 'Qualité',    Icon: ClipboardCheck,match: (l) => (l.module ?? '').toLowerCase().includes('qualité') || (l.module ?? '').toLowerCase().includes('alerte') },
  { key: 'stock',     label: 'Stock',      Icon: Warehouse,     match: (l) => ['Stock', 'Entrepôt', 'Stockage'].some((k) => (l.module ?? '').includes(k)) },
  { key: 'purchase',  label: 'Achats',     Icon: ShoppingCart,  match: (l) => ['Achat', 'Commande', 'Fournisseur', 'Matière'].some((k) => (l.module ?? '').includes(k)) },
  { key: 'logistics', label: 'Logistique', Icon: Package,       match: (l) => ['Logistique', 'Transport', 'Expédition'].some((k) => (l.module ?? '').includes(k)) },
  { key: 'hr',        label: 'RH',         Icon: Users,         match: (l) => ['Employé', 'RH', 'Ressources', 'Pointage'].some((k) => (l.module ?? '').includes(k)) },
  { key: 'system',    label: 'Système',    Icon: BarChart3,     match: (l) => ['Système', 'Paramètre', 'Profil'].some((k) => (l.module ?? '').includes(k)) },
];

// ── Action display ────────────────────────────────────────────────────────────

function getActionDisplay(log: AuditLog): { label: string; color: string } {
  const et = log.event_type ?? '';
  if (et === 'AUTH_LOGIN')    return { label: 'Connexion',    color: 'bg-slate-100 text-slate-700' };
  if (et === 'AUTH_LOGOUT')   return { label: 'Déconnexion',  color: 'bg-slate-100 text-slate-700' };
  if (et === 'AUTH_SIGNUP')   return { label: 'Inscription',  color: 'bg-blue-100 text-blue-700' };
  if (et === 'AUTH_FAILED')   return { label: 'Échec auth',   color: 'bg-red-100 text-red-700' };
  if (et === 'ACCESS_DENIED') return { label: 'Accès refusé', color: 'bg-red-100 text-red-700' };
  const a = log.action ?? et;
  if (a === 'INSERT') return { label: 'Création',     color: 'bg-green-100 text-green-700' };
  if (a === 'UPDATE') return { label: 'Modification', color: 'bg-blue-100 text-blue-700' };
  if (a === 'DELETE') return { label: 'Suppression',  color: 'bg-red-100 text-red-700' };
  return { label: a || '—', color: 'bg-gray-100 text-gray-700' };
}

// ── Module icon ───────────────────────────────────────────────────────────────

function getModuleIcon(log: AuditLog): { Icon: React.ElementType; bg: string } {
  const m = log.module ?? '';
  const et = log.event_type ?? '';
  if (et.startsWith('AUTH') || et === 'ACCESS_DENIED')         return { Icon: Shield,       bg: 'bg-slate-500' };
  if (m.includes('Réception'))                                  return { Icon: Truck,        bg: 'bg-blue-500' };
  if (['Phase 2', 'Fumigation', 'Triage'].some((k) => m.includes(k))) return { Icon: Zap,  bg: 'bg-amber-500' };
  if (m.includes('Production'))                                 return { Icon: Factory,      bg: 'bg-purple-500' };
  if (m.includes('Conditionnement'))                            return { Icon: Package,      bg: 'bg-violet-500' };
  if (m.toLowerCase().includes('qualité') || m.includes('Alerte')) return { Icon: ClipboardCheck, bg: 'bg-yellow-500' };
  if (m.includes('Stock') || m.includes('Entrepôt'))            return { Icon: Warehouse,    bg: 'bg-orange-500' };
  if (m.includes('Logistique') || m.includes('Transport'))      return { Icon: Package,      bg: 'bg-cyan-500' };
  if (['Achat', 'Commande', 'Fournisseur'].some((k) => m.includes(k))) return { Icon: ShoppingCart, bg: 'bg-green-500' };
  if (['Employé', 'RH', 'Pointage'].some((k) => m.includes(k))) return { Icon: Users,       bg: 'bg-pink-500' };
  return { Icon: FileText, bg: 'bg-gray-400' };
}

const SEV_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  warning:  'bg-amber-400',
  info:     'bg-emerald-500',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const AuditLogPanel = () => {
  const { i18n } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const locale = i18n.language === 'ar' ? ar : i18n.language === 'en' ? enUS : fr;

  const ts = (log: AuditLog) => {
    const raw = log.performed_at ?? log.created_at;
    if (!raw) return '—';
    try { return format(new Date(raw), 'dd/MM/yyyy HH:mm:ss', { locale }); } catch { return raw; }
  };

  // Fetch latest 200 entries from system_audit_logs (covers all modules)
  const { data, isLoading } = useAuditLogs({ limit: 200 });
  const logs: AuditLog[] = data?.logs ?? [];

  const cat = CATEGORIES.find((c) => c.key === activeCategory) ?? CATEGORIES[0];
  const filteredLogs = logs.filter((log) => {
    if (!cat.match(log)) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.message ?? '').toLowerCase().includes(term) ||
      (log.user_name ?? log.user_email ?? '').toLowerCase().includes(term) ||
      (log.module ?? '').toLowerCase().includes(term) ||
      (log.table ?? '').toLowerCase().includes(term)
    );
  });

  return (
    <>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5" />
              Journal d'audit
            </CardTitle>
            <Badge variant="outline" className="font-mono text-xs">
              {filteredLogs.length} / {logs.length}
            </Badge>
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher action, module, utilisateur…"
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category filter chips */}
          <div className="mt-2 flex flex-wrap gap-1">
            {CATEGORIES.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveCategory(key)}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                  activeCategory === key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[480px]">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-10 w-10 opacity-40" />
                <p className="text-sm">Aucune entrée</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const { Icon, bg } = getModuleIcon(log);
                const { label: aLabel, color: aColor } = getActionDisplay(log);
                const by = log.user_name ?? log.user_email ?? log.user_id ?? 'Système';
                const sevDot = SEV_DOT[log.severity ?? 'info'];
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 border-b px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    {/* Module icon + severity dot */}
                    <div className="relative shrink-0">
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-white', bg)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background', sevDot)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px]', aColor)}>
                          {aLabel}
                        </Badge>
                        {log.module && (
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {log.module}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[13px] font-medium leading-tight text-foreground">
                        {log.message ?? '—'}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="max-w-[140px] truncate">{by}</span>
                        <span>·</span>
                        <span className="shrink-0">{ts(log)}</span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Détail de l'action
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (() => {
            const { label: aLabel, color: aColor } = getActionDisplay(selectedLog);
            const by = selectedLog.user_name ?? selectedLog.user_email ?? selectedLog.user_id ?? 'Système';
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Module</p>
                    <p className="font-medium">{selectedLog.module ?? '—'}</p>
                    {selectedLog.table && (
                      <p className="mt-0.5 text-xs text-muted-foreground">Table : {selectedLog.table}</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Action</p>
                    <div className="flex items-center gap-2">
                      <Badge className={cn('text-xs', aColor)}>{aLabel}</Badge>
                      {selectedLog.severity && (
                        <span className="text-xs capitalize text-muted-foreground">{selectedLog.severity}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Effectué par</p>
                    <p className="font-medium">{by}</p>
                    {selectedLog.user_roles?.length > 0 && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{selectedLog.user_roles.join(', ')}</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Date / heure</p>
                    <p className="font-medium">{ts(selectedLog)}</p>
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Description</p>
                  <p className="font-medium">{selectedLog.message ?? '—'}</p>
                </div>

                {selectedLog.affected_ids?.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">IDs concernés</p>
                    <p className="break-all font-mono text-sm">{selectedLog.affected_ids.join(', ')}</p>
                  </div>
                )}

                {(selectedLog.before_snapshot || selectedLog.after_snapshot) && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedLog.before_snapshot && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">État précédent</p>
                        <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
                          {JSON.stringify(selectedLog.before_snapshot, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedLog.after_snapshot && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Nouvel état</p>
                        <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
                          {JSON.stringify(selectedLog.after_snapshot, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {selectedLog.ip_address && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Adresse IP</p>
                    <p className="font-mono text-sm">{selectedLog.ip_address}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
};
