import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Check, CheckCheck, AlertCircle, AlertTriangle, Info, CheckCircle2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  useNotifications, useMarkNotificationRead, useMarkAllRead, useNotificationRealtimeState
} from '@/hooks/useNotifications';
import type { SystemNotification } from '@/types/notifications';
import { formatDistanceToNow } from 'date-fns';
import { enUS, fr, ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { getNotificationTarget, isInternalNotificationTarget } from '@/lib/notifications';

const severityConfig = {
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
  success: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' }
};

export const NotificationCenter = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useSettingsContext();
  const [open, setOpen] = useState(false);
  const { data: notifications = [], isLoading } = useNotifications();
  const { recentNotifications, lastRealtimeAt } = useNotificationRealtimeState();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const getLocale = () => {
    switch (i18n.language) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  };
  
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const criticalCount = notifications.filter(n => !n.is_read && n.severity === 'error').length;
  const warningCount = notifications.filter(n => !n.is_read && n.severity === 'warning').length;
  const livePulseActive =
    Boolean(lastRealtimeAt) &&
    Date.now() - new Date(lastRealtimeAt as string).getTime() < 30_000;
  const recentLiveNotifications = recentNotifications.slice(0, 3);
  
  const handleMarkRead = (id: string) => { markRead.mutate(id); };
  const handleMarkAllRead = () => { markAllRead.mutate(); };
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (
      nextOpen &&
      settings.notifications.browser_notifications_enabled &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      void Notification.requestPermission();
    }
  };
  const handleOpenNotification = (notification: SystemNotification) => {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }

    const target = getNotificationTarget(notification);
    setOpen(false);

    if (isInternalNotificationTarget(target)) {
      navigate(target);
      return;
    }

    window.open(target, '_blank', 'noopener,noreferrer');
  };
  
  const NotificationItem = ({ notification }: { notification: SystemNotification }) => {
    const config = severityConfig[notification.severity] || severityConfig.info;
    const Icon = config.icon;
    
    return (
      <div 
        className={cn(
          "p-3 border-b last:border-b-0 transition-colors cursor-pointer hover:bg-muted/40",
          notification.is_read ? "bg-background" : config.bg
        )}
        onClick={() => handleOpenNotification(notification)}
      >
        <div className="flex items-start gap-3">
          <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", config.color)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{notification.title}</span>
              <Badge variant="outline" className="text-xs">
                {t(`alerts.categories.${notification.category}`, { defaultValue: notification.category })}
              </Badge>
              {!notification.is_read && (
                <Badge variant="default" className="text-xs bg-primary">{t('notifications.new')}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground block">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: getLocale() })}
              </span>
              <span className="text-xs font-medium text-primary">{t('common.view')}</span>
            </div>
          </div>
          {!notification.is_read && (
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); handleMarkRead(notification.id); }}>
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className={cn("relative", livePulseActive && "border-primary/40 bg-primary/5")}>
          <Bell className="h-5 w-5" />
          {livePulseActive && (
            <span className="absolute inset-0 rounded-md border border-primary/30 animate-pulse" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <div>
            <h3 className="font-semibold">{t('notifications.title')}</h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={livePulseActive ? "default" : "outline"} className="h-5 rounded-full px-2 text-[10px]">
                {t('alerts.realtime', { defaultValue: 'Live' })}
              </Badge>
              {lastRealtimeAt && (
                <span>
                  {formatDistanceToNow(new Date(lastRealtimeAt), { addSuffix: true, locale: getLocale() })}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead} disabled={markAllRead.isPending}>
                <CheckCheck className="h-4 w-4 mr-1" />
                {t('notifications.markAllRead')}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-b px-3 py-3">
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{t('alerts.unread')}</p>
            <p className="mt-1 text-base font-semibold">{unreadCount}</p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{t('alerts.critical')}</p>
            <p className="mt-1 text-base font-semibold text-red-600">{criticalCount}</p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{t('alerts.warnings')}</p>
            <p className="mt-1 text-base font-semibold text-amber-600">{warningCount}</p>
          </div>
        </div>
        {recentLiveNotifications.length > 0 && (
          <div className="border-b px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t('alerts.realtime', { defaultValue: 'Live' })}
              </p>
              <span className="text-[11px] text-muted-foreground">
                {recentLiveNotifications.length} {t('common.new')}
              </span>
            </div>
            <div className="space-y-2">
              {recentLiveNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleOpenNotification(notification)}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">{notification.title}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: getLocale() })}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                </button>
              ))}
            </div>
          </div>
        )}
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t('notifications.noNotifications')}</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
