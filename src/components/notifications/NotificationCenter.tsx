import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, Bell,
  Check, CheckCheck, CheckCircle2, ExternalLink, Info, X,
} from 'lucide-react';
import type { Locale } from 'date-fns';
import { formatDistanceToNow } from 'date-fns';
import { enUS, fr, ar } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useNotifications, useMarkNotificationRead, useMarkAllRead, useNotificationRealtimeState,
} from '@/hooks/useNotifications';
import type { SystemNotification } from '@/types/notifications';
import { cn } from '@/lib/utils';
import { useSettingsContext } from '@/contexts/SettingsContext';
import {
  formatMetaKey,
  getNotificationTarget,
  getTabLabel,
  isInternalNotificationTarget,
  SKIP_META_KEYS,
} from '@/lib/notifications';

// ─────────────────────────────────────────────────────────────────────────────
// Shared config — module-level to avoid re-creation inside render
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  info:    { icon: Info,          color: 'text-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-100',    label: 'Info' },
  warning: { icon: AlertTriangle, color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100',   label: 'Avertissement' },
  error:   { icon: AlertCircle,   color: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-100',     label: 'Critique' },
  success: { icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'Succès' },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// NotificationItem — at module scope (never recreated on parent render)
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: SystemNotification;
  onSelect: (n: SystemNotification) => void;
  onMarkRead: (id: string) => void;
  locale: Locale;
}

const NotificationItem = ({ notification, onSelect, onMarkRead, locale }: NotificationItemProps) => {
  const cfg = SEVERITY_CONFIG[notification.severity] ?? SEVERITY_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Notification : ${notification.title}`}
      className={cn(
        'group border-b px-4 py-3 last:border-b-0 cursor-pointer outline-none',
        'transition-colors duration-150 hover:bg-muted/40 focus-visible:bg-muted/40',
        notification.is_read ? 'bg-background' : cfg.bg,
      )}
      onClick={() => onSelect(notification)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(notification); }
      }}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', cfg.color)} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] font-semibold leading-snug text-foreground">
              {notification.title}
            </span>
            {!notification.is_read && (
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </div>

          <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {notification.message}
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground/70">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale })}
            </span>
            <span className="flex items-center gap-0.5 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              Voir détails <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {!notification.is_read && (
          <button
            type="button"
            aria-label="Marquer comme lu"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NotificationDetailView — full detail panel rendered inside the Popover
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationDetailViewProps {
  notification: SystemNotification;
  onBack: () => void;
  onNavigate: () => void;
  onMarkRead: () => void;
  isMarkingRead: boolean;
  locale: Locale;
}

const NotificationDetailView = ({
  notification,
  onBack,
  onNavigate,
  onMarkRead,
  isMarkingRead,
  locale,
}: NotificationDetailViewProps) => {
  const cfg = SEVERITY_CONFIG[notification.severity] ?? SEVERITY_CONFIG.info;
  const Icon = cfg.icon;

  const target    = getNotificationTarget(notification);
  const tabLabel  = getTabLabel(target);
  const isExternal = !isInternalNotificationTarget(target);

  const metaEntries = notification.metadata
    ? Object.entries(notification.metadata).filter(
        ([k, v]) =>
          !SKIP_META_KEYS.has(k) &&
          v !== null &&
          v !== undefined &&
          String(v).trim() !== '',
      )
    : [];

  const infoRows = [
    { label: 'Type',       value: notification.notification_type.replace(/_/g, ' ') },
    { label: 'Catégorie',  value: notification.category },
    ...(notification.entity_type ? [{ label: 'Entité',     value: notification.entity_type }] : []),
    ...(notification.entity_id   ? [{ label: 'Référence',  value: notification.entity_id }]   : []),
    {
      label: 'Créé',
      value: formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale }),
    },
    ...(notification.expires_at
      ? [{ label: 'Expire', value: formatDistanceToNow(new Date(notification.expires_at), { addSuffix: true, locale }) }]
      : []),
    { label: 'Statut', value: notification.is_read ? 'Lu' : 'Non lu', accent: !notification.is_read },
  ];

  return (
    <div className="flex h-[560px] flex-col">
      {/* Back bar */}
      <div className={cn('flex shrink-0 items-center gap-3 border-b px-4 py-3', cfg.bg)}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour à la liste"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/80 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border', cfg.border)}>
          <Icon className={cn('h-4 w-4', cfg.color)} />
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn('h-4 border px-1.5 text-[11px]', cfg.color, cfg.border)}>
              {cfg.label}
            </Badge>
            <Badge variant="outline" className="h-4 px-1.5 text-[11px]">
              {notification.category}
            </Badge>
            {!notification.is_read && (
              <Badge className="h-4 bg-primary px-1.5 text-[11px]">Nouveau</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <ScrollArea className="flex-1">

        {/* Title + message */}
        <div className="px-4 pb-4 pt-4">
          <h3 className="text-[14px] font-semibold leading-snug text-foreground">
            {notification.title}
          </h3>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {notification.message}
          </p>
        </div>

        <Separator />

        {/* Info grid */}
        <div className="px-4 pb-4 pt-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
            Informations
          </p>
          <div className="space-y-2.5">
            {infoRows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4">
                <span className="shrink-0 text-[12px] text-muted-foreground">{row.label}</span>
                <span
                  className={cn(
                    'break-all text-end text-[12px] font-medium',
                    (row as { accent?: boolean }).accent ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Metadata context */}
        {metaEntries.length > 0 && (
          <>
            <Separator />
            <div className="px-4 pb-4 pt-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
                Contexte
              </p>
              <div className="space-y-2.5">
                {metaEntries.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4">
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {formatMetaKey(k)}
                    </span>
                    <span className="break-all text-end text-[12px] font-medium text-foreground">
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </ScrollArea>

      {/* Action footer */}
      <div className="shrink-0 space-y-2 border-t bg-background px-4 py-3">
        {!notification.is_read && (
          <button
            type="button"
            onClick={onMarkRead}
            disabled={isMarkingRead}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl border border-border/60',
              'h-8 text-[12px] font-medium text-muted-foreground',
              'transition-colors hover:bg-muted/50 hover:text-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <Check className="h-3.5 w-3.5" />
            Marquer comme lu
          </button>
        )}

        <Button
          size="sm"
          className="h-9 w-full text-[12.5px] font-semibold"
          onClick={onNavigate}
        >
          {isExternal
            ? <ExternalLink className="mr-2 h-3.5 w-3.5" />
            : <ArrowRight className="mr-2 h-3.5 w-3.5" />}
          Voir dans {tabLabel}
        </Button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NotificationCenter — main exported component
// ─────────────────────────────────────────────────────────────────────────────

export const NotificationCenter = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettingsContext();

  const [open, setOpen] = useState(false);
  // selectedId drives the detail view; resolved from live store so
  // is_read flips immediately when the markRead mutation resolves.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: notifications = [], isLoading } = useNotifications();
  const { recentNotifications, lastRealtimeAt } = useNotificationRealtimeState();
  const markRead   = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const locale: Locale = i18n.language === 'ar' ? ar : i18n.language === 'en' ? enUS : fr;

  const selectedNotification = selectedId
    ? (notifications.find((n) => n.id === selectedId) ?? null)
    : null;

  const unreadCount   = notifications.filter((n) => !n.is_read).length;
  const criticalCount = notifications.filter((n) => !n.is_read && n.severity === 'error').length;
  const warningCount  = notifications.filter((n) => !n.is_read && n.severity === 'warning').length;

  const livePulseActive =
    Boolean(lastRealtimeAt) &&
    Date.now() - new Date(lastRealtimeAt as string).getTime() < 30_000;

  const recentLive = recentNotifications.slice(0, 3);

  // Handlers

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSelectedId(null);

    if (
      nextOpen &&
      settings.notifications.browser_notifications_enabled &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      void Notification.requestPermission();
    }
  };

  const handleSelectNotification = (notification: SystemNotification) => {
    setSelectedId(notification.id);
    if (!notification.is_read) markRead.mutate(notification.id);
  };

  const handleMarkRead = (id: string) => markRead.mutate(id);
  const handleMarkAllRead = () => markAllRead.mutate();

  const handleNavigateFromDetail = () => {
    if (!selectedNotification) return;
    const target = getNotificationTarget(selectedNotification);
    setOpen(false);
    setSelectedId(null);
    if (isInternalNotificationTarget(target)) {
      navigate(target);
    } else {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  };

  // Render

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {/* ── Bell trigger ── */}
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
          className={cn(
            'relative h-9 w-9 rounded-[9px] text-muted-foreground/70 hover:bg-card hover:text-foreground hover:shadow-xs',
            livePulseActive && 'border-primary/40 bg-primary/5',
          )}
        >
          <Bell className="h-4 w-4" />
          {livePulseActive && (
            <span className="absolute inset-0 rounded-[9px] border border-primary/30 animate-pulse" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      {/* ── Panel ── */}
      <PopoverContent className="w-[min(400px,calc(100vw-1rem))] p-0 shadow-xl" align="end" sideOffset={8}>

        {selectedNotification ? (
          // ── Detail view ──────────────────────────────────────────────────
          <NotificationDetailView
            notification={selectedNotification}
            onBack={() => setSelectedId(null)}
            onNavigate={handleNavigateFromDetail}
            onMarkRead={() => handleMarkRead(selectedNotification.id)}
            isMarkingRead={markRead.isPending}
            locale={locale}
          />
        ) : (
          // ── List view ────────────────────────────────────────────────────
          <div className="flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h3 className="text-[13.5px] font-semibold">{t('notifications.title')}</h3>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge
                    variant={livePulseActive ? 'default' : 'outline'}
                    className="h-4 rounded-full px-2 text-[11px]"
                  >
                    Live
                  </Badge>
                  {lastRealtimeAt && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(lastRealtimeAt), { addSuffix: true, locale })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markAllRead.isPending}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Tout lire
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-2 border-b bg-muted/20 px-3 py-2.5">
              {[
                { label: t('alerts.unread'),   value: unreadCount,   accent: '' },
                { label: t('alerts.critical'),  value: criticalCount, accent: 'text-red-600' },
                { label: t('alerts.warnings'),  value: warningCount,  accent: 'text-amber-600' },
              ].map(({ label, value, accent }) => (
                <div key={label} className="rounded-lg border bg-background px-2.5 py-1.5">
                  <p className="text-[11px] leading-none text-muted-foreground">{label}</p>
                  <p className={cn('mt-1 text-[15px] font-semibold leading-none', accent)}>{value}</p>
                </div>
              ))}
            </div>

            {/* Live / recent strip */}
            {recentLive.length > 0 && (
              <div className="border-b px-3 py-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50">
                  Récentes
                </p>
                <div className="space-y-1.5">
                  {recentLive.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleSelectNotification(n)}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12.5px] font-medium">{n.title}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale })}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {n.message}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Full list */}
            <ScrollArea className="h-[360px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-[13px] text-muted-foreground">
                  {t('common.loading')}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Bell className="mb-3 h-10 w-10 opacity-30" />
                  <p className="text-[13px]">{t('notifications.noNotifications')}</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onSelect={handleSelectNotification}
                    onMarkRead={handleMarkRead}
                    locale={locale}
                  />
                ))
              )}
            </ScrollArea>

          </div>
        )}

      </PopoverContent>
    </Popover>
  );
};
