import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { Locale } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Bell, AlertTriangle, Clock, CheckCircle, XCircle,
  Package, Factory, Shield, Truck, Thermometer,
  Search, RefreshCw, Eye, CalendarDays, BellOff,
} from 'lucide-react';
import {
  useNotifications,
  useNotificationRealtimeState,
  useAuditLogs,
  useMarkAllRead,
  useMarkNotificationRead,
} from '@/hooks/useNotifications';
import type { SystemNotification, AuditLog } from '@/hooks/useNotifications';
import { useAcknowledgeReceptionAlert, useReceptionAlerts, useResolveReceptionAlert } from '@/hooks/useReceptionsV2';
import { ReceptionAlert } from '@/types/reception';
import { formatDistanceToNow, format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

 // Alert type icons
 const alertTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
   RECEPTION: Package,
   PRODUCTION: Factory,
   QUALITY: Shield,
   STOCK: Truck,
   SYSTEM: Bell,
   TEMPERATURE: Thermometer
 };

export const FactoryAlertsCenter = () => {
   const { t, i18n } = useTranslation();
   const [activeTab, setActiveTab] = useState('live');
   const [searchTerm, setSearchTerm] = useState('');
   const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
   const [dateFrom, setDateFrom] = useState<string>('');
   const [dateTo, setDateTo] = useState<string>('');
   const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());
   
   const getLocale = () => {
     switch (i18n.language) {
       case 'ar': return ar;
       case 'en': return enUS;
       default: return fr;
     }
   };

   // Severity config
   const severityConfig = {
     error: { label: t('alerts.severityLabels.error'), color: 'bg-red-600 text-white', icon: XCircle },
     warning: { label: t('alerts.severityLabels.warning'), color: 'bg-orange-500 text-white', icon: AlertTriangle },
     info: { label: t('alerts.severityLabels.info'), color: 'bg-blue-500 text-white', icon: Bell },
     success: { label: t('alerts.severityLabels.success'), color: 'bg-green-500 text-white', icon: CheckCircle }
   };

   // Category labels from i18n
   const categoryLabels: Record<string, string> = {
     RECEPTION: t('alerts.categories.RECEPTION'),
     PRODUCTION: t('alerts.categories.PRODUCTION'),
     QUALITY: t('alerts.categories.QUALITY'),
     STOCK: t('alerts.categories.STOCK'),
     SYSTEM: t('alerts.categories.SYSTEM'),
     PURCHASING: t('alerts.categories.PURCHASING')
   };

   // Action labels from i18n
   const actionLabels: Record<string, string> = {
     CREATE: t('alerts.actions.CREATE'),
     UPDATE: t('alerts.actions.UPDATE'),
     DELETE: t('alerts.actions.DELETE'),
     STATUS_CHANGE: t('alerts.actions.STATUS_CHANGE'),
     QC_DECISION: t('alerts.actions.QC_DECISION'),
     APPROVE: t('alerts.actions.APPROVE'),
     REJECT: t('alerts.actions.REJECT')
   };
   
   // Data hooks
   const { data: notifications = [], isLoading: notifLoading, refetch: refetchNotifications } = useNotifications();
   const { recentNotifications, lastRealtimeAt } = useNotificationRealtimeState();
   const { data: auditLogs = [], isLoading: auditLoading, refetch: refetchAudit } = useAuditLogs();
   const { data: receptionAlerts = [] } = useReceptionAlerts();
   
   // Cache invalidation is handled globally by useBackendRealtimeSync (SSE → RTK Query tags)

   // Stats
   const unreadCount = notifications.filter(n => !n.is_read).length;
   const criticalCount = notifications.filter(n => n.severity === 'error' && !n.is_read).length;
   const warningCount = notifications.filter(n => n.severity === 'warning' && !n.is_read).length;
   const activeReceptionAlerts = receptionAlerts.filter(a => a.status === 'ACTIVE').length;
   const livePulseActive = Boolean(lastRealtimeAt) && Date.now() - new Date(lastRealtimeAt as string).getTime() < 30_000;
   
   // Shared date-range check
   const inDateRange = (iso: string) => {
     const d = new Date(iso);
     if (dateFrom && isBefore(d, startOfDay(new Date(dateFrom)))) return false;
     if (dateTo && isAfter(d, endOfDay(new Date(dateTo)))) return false;
     return true;
   };

   // Filter notifications
   const filteredNotifications = notifications.filter(n => {
     if (mutedIds.has(n.id)) return false;
     if (searchTerm && !n.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
         !n.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
     if (categoryFilter && n.category !== categoryFilter) return false;
     if (!inDateRange(n.created_at)) return false;
     return true;
   });

   // Filter audit logs
   const filteredAuditLogs = auditLogs.filter(log => {
     if (searchTerm && !log.action_label?.toLowerCase().includes(searchTerm.toLowerCase()) &&
         !log.entity_type.toLowerCase().includes(searchTerm.toLowerCase())) return false;
     if (categoryFilter && log.entity_type !== categoryFilter) return false;
     if (!inDateRange(log.performed_at)) return false;
     return true;
   });
   
   const handleRefresh = () => {
     refetchNotifications();
     refetchAudit();
   };

   return (
     <div className="space-y-4">
       {/* Header Stats */}
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <Card className={cn("transition-all", criticalCount > 0 && "border-red-500 bg-red-50 animate-pulse")}>
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="p-2 rounded-full bg-red-100">
                 <XCircle className="h-5 w-5 text-red-600" />
               </div>
               <div>
                 <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
                 <p className="text-xs text-muted-foreground">{t('alerts.critical')}</p>
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card className={cn("transition-all", warningCount > 0 && "border-orange-500 bg-orange-50")}>
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="p-2 rounded-full bg-orange-100">
                 <AlertTriangle className="h-5 w-5 text-orange-600" />
               </div>
               <div>
                 <p className="text-2xl font-bold text-orange-600">{warningCount}</p>
                 <p className="text-xs text-muted-foreground">{t('alerts.warnings')}</p>
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card>
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="p-2 rounded-full bg-blue-100">
                 <Bell className="h-5 w-5 text-blue-600" />
               </div>
               <div>
                 <p className="text-2xl font-bold text-blue-600">{unreadCount}</p>
                 <p className="text-xs text-muted-foreground">{t('alerts.unread')}</p>
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card>
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="p-2 rounded-full bg-purple-100">
                 <Package className="h-5 w-5 text-purple-600" />
               </div>
               <div>
                 <p className="text-2xl font-bold text-purple-600">{activeReceptionAlerts}</p>
                 <p className="text-xs text-muted-foreground">{t('alerts.receptionAlerts')}</p>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
       
       {/* Main Content */}
       <Card>
         <CardHeader className="pb-2">
           <div className="flex items-center justify-between flex-wrap gap-2">
             <CardTitle className="flex items-center gap-2">
               <Bell className="h-5 w-5" />
               {t('alerts.factoryAlerts')}
               <Badge variant={livePulseActive ? "default" : "outline"} className="ml-2">
                 {t('alerts.realtime')}
               </Badge>
               {lastRealtimeAt && (
                 <span className="text-xs font-normal text-muted-foreground">
                   {formatDistanceToNow(new Date(lastRealtimeAt), { addSuffix: true, locale: getLocale() })}
                 </span>
               )}
             </CardTitle>
             <div className="flex items-center gap-2">
               <Button variant="outline" size="sm" onClick={handleRefresh}>
                 <RefreshCw className="h-4 w-4 mr-1" />
                 {t('common.refresh')}
               </Button>
             </div>
           </div>

           {recentNotifications.length > 0 && (
             <div className="mt-4 rounded-xl border bg-muted/20 p-3">
               <div className="mb-2 flex items-center justify-between gap-2">
                 <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                   {t('alerts.realtime')}
                 </span>
                 <Badge variant="outline" className="rounded-full">
                   {recentNotifications.length} {t('common.new')}
                 </Badge>
               </div>
               <div className="grid gap-2 md:grid-cols-2">
                 {recentNotifications.slice(0, 4).map((notification) => (
                   <div key={notification.id} className="rounded-lg border bg-background px-3 py-2">
                     <div className="flex items-center justify-between gap-2">
                       <span className="truncate text-sm font-medium">{notification.title}</span>
                       <Badge variant="outline" className="shrink-0 text-[10px]">
                         {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: getLocale() })}
                       </Badge>
                     </div>
                     <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                   </div>
                 ))}
               </div>
             </div>
           )}
           
           {/* Filters */}
           <div className="flex items-center gap-2 mt-4 flex-wrap">
             <div className="relative flex-1 min-w-[200px]">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                 placeholder={t('common.search')}
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-9"
               />
             </div>
             <div className="flex items-center gap-1">
               <CalendarDays className="h-4 w-4 text-muted-foreground" />
               <Input
                 type="date"
                 value={dateFrom}
                 onChange={(e) => setDateFrom(e.target.value)}
                 className="w-36 text-sm"
               />
               <span className="text-muted-foreground text-xs">→</span>
               <Input
                 type="date"
                 value={dateTo}
                 onChange={(e) => setDateTo(e.target.value)}
                 className="w-36 text-sm"
               />
               {(dateFrom || dateTo) && (
                 <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                   ✕
                 </Button>
               )}
             </div>
             <div className="flex gap-1 flex-wrap">
               <Button
                 variant={categoryFilter === null ? "default" : "outline"}
                 size="sm"
                 onClick={() => setCategoryFilter(null)}
               >
                 {t('common.all')}
               </Button>
               {Object.entries(categoryLabels).map(([key, label]) => (
                 <Button
                   key={key}
                   variant={categoryFilter === key ? "default" : "outline"}
                   size="sm"
                   onClick={() => setCategoryFilter(key)}
                 >
                   {label}
                 </Button>
               ))}
             </div>
           </div>
         </CardHeader>
         
         <CardContent>
           <Tabs value={activeTab} onValueChange={setActiveTab}>
             <TabsList className="grid w-full grid-cols-3">
               <TabsTrigger value="live" className="flex items-center gap-1">
                 <Bell className="h-4 w-4" />
                 {t('alerts.liveAlerts')}
                 {unreadCount > 0 && (
                   <Badge variant="destructive" className="ml-1 h-5 px-1">
                     {unreadCount}
                   </Badge>
                 )}
               </TabsTrigger>
               <TabsTrigger value="audit" className="flex items-center gap-1">
                 <Clock className="h-4 w-4" />
                 {t('alerts.auditLog')}
               </TabsTrigger>
               <TabsTrigger value="reception" className="flex items-center gap-1">
                 <Package className="h-4 w-4" />
                 {t('alerts.receptionAlerts')}
                 {activeReceptionAlerts > 0 && (
                   <Badge variant="destructive" className="ml-1 h-5 px-1">
                     {activeReceptionAlerts}
                   </Badge>
                 )}
               </TabsTrigger>
             </TabsList>
             
             <TabsContent value="live" className="mt-4">
               <LiveAlertsPanel
                 notifications={filteredNotifications}
                 isLoading={notifLoading}
                 severityConfig={severityConfig}
                 categoryLabels={categoryLabels}
                 getLocale={getLocale}
                 mutedIds={mutedIds}
                 onMute={(id) => setMutedIds(prev => new Set([...prev, id]))}
               />
             </TabsContent>
             
             <TabsContent value="audit" className="mt-4">
               <AuditLogPanelInline 
                 logs={filteredAuditLogs} 
                 isLoading={auditLoading}
                 actionLabels={actionLabels}
                 getLocale={getLocale}
               />
             </TabsContent>
             
             <TabsContent value="reception" className="mt-4">
               <ReceptionAlertsPanel 
                 alerts={receptionAlerts.filter(a => 
                   !searchTerm || 
                   a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   a.message.toLowerCase().includes(searchTerm.toLowerCase())
                 )}
                 getLocale={getLocale}
               />
             </TabsContent>
           </Tabs>
         </CardContent>
       </Card>
     </div>
   );
 };

// Live Alerts Panel Component
 const LiveAlertsPanel = ({
   notifications,
   isLoading,
   severityConfig,
   categoryLabels,
   getLocale,
   mutedIds,
   onMute,
 }: {
   notifications: SystemNotification[];
   isLoading: boolean;
   severityConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }>;
   categoryLabels: Record<string, string>;
   getLocale: () => Locale;
   mutedIds: Set<string>;
   onMute: (id: string) => void;
 }) => {
 const { t } = useTranslation();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllRead();
  const { recentNotifications } = useNotificationRealtimeState();
  const recentLiveIds = new Set(recentNotifications.map((notification) => notification.id));
   
   if (isLoading) {
     return <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>;
   }
   
   if (notifications.length === 0) {
     return (
       <div className="text-center py-12">
         <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
         <h3 className="text-lg font-semibold">{t('alerts.noAlerts')}</h3>
         <p className="text-muted-foreground">{t('alerts.allSystemsNormal')}</p>
       </div>
     );
   }
   
   const unreadCount = notifications.filter(n => !n.is_read).length;
   
   return (
     <div className="space-y-2">
       {unreadCount > 0 && (
         <div className="flex justify-end mb-2">
           <Button variant="ghost" size="sm" onClick={() => markAllRead()}>
             <CheckCircle className="h-4 w-4 mr-1" />
             {t('alerts.markAllRead')}
           </Button>
         </div>
       )}
       
       <ScrollArea className="h-[500px] pr-4">
         <div className="space-y-2">
           {notifications.map((notification) => {
             const config = severityConfig[notification.severity] || severityConfig.info;
             const Icon = alertTypeIcons[notification.category] || Bell;
             
             return (
               <Card 
                 key={notification.id}
                 className={cn(
                   "transition-all cursor-pointer hover:shadow-md",
                   !notification.is_read && "border-l-4",
                   recentLiveIds.has(notification.id) && "ring-1 ring-primary/30",
                   !notification.is_read && notification.severity === 'error' && "border-l-red-600 bg-red-50",
                   !notification.is_read && notification.severity === 'warning' && "border-l-orange-500 bg-orange-50",
                   !notification.is_read && notification.severity === 'info' && "border-l-blue-500 bg-blue-50",
                   !notification.is_read && notification.severity === 'success' && "border-l-green-500 bg-green-50"
                 )}
                 onClick={() => !notification.is_read && markRead(notification.id)}
               >
                 <CardContent className="p-4">
                   <div className="flex items-start gap-3">
                     <div className={cn("p-2 rounded-full", config.color)}>
                       <Icon className="h-4 w-4" />
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 flex-wrap">
                         <span className="font-semibold">{notification.title}</span>
                         <Badge variant="outline" className="text-xs">
                           {categoryLabels[notification.category] || notification.category}
                         </Badge>
                         <Badge className={config.color}>
                           {config.label}
                         </Badge>
                         {recentLiveIds.has(notification.id) && (
                           <Badge className="text-xs bg-emerald-600 text-white">{t('common.new')}</Badge>
                         )}
                         {!notification.is_read && (
                           <Badge variant="default" className="text-xs">{t('notifications.new')}</Badge>
                         )}
                       </div>
                       <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                       <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                         <span>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: getLocale() })}</span>
                         <div className="flex items-center gap-2">
                           <span>{format(new Date(notification.created_at), 'dd/MM/yyyy HH:mm', { locale: getLocale() })}</span>
                           <Button
                             variant="ghost"
                             size="icon"
                             className="h-5 w-5 opacity-50 hover:opacity-100"
                             onClick={(e) => { e.stopPropagation(); onMute(notification.id); }}
                             title={t('alerts.mute', { defaultValue: 'Masquer' })}
                           >
                             <BellOff className="h-3 w-3" />
                           </Button>
                         </div>
                       </div>
                     </div>
                   </div>
                 </CardContent>
               </Card>
             );
           })}
         </div>
       </ScrollArea>
     </div>
   );
 };

 // Audit Log Panel Component (inline)
 const AuditLogPanelInline = ({ 
   logs, 
   isLoading,
   actionLabels,
   getLocale
 }: { 
   logs: AuditLog[];
   isLoading: boolean;
   actionLabels: Record<string, string>;
   getLocale: () => Locale;
 }) => {
   const { t } = useTranslation();
   
   if (isLoading) {
     return <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>;
   }
   
   if (logs.length === 0) {
     return (
       <div className="text-center py-12">
         <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
         <h3 className="text-lg font-semibold">{t('alerts.noEvents')}</h3>
         <p className="text-muted-foreground">{t('alerts.auditEmpty')}</p>
       </div>
     );
   }
   
   return (
     <ScrollArea className="h-[500px] pr-4">
       <div className="space-y-2">
         {logs.map((log) => {
           const Icon = alertTypeIcons[log.entity_type] || Clock;
           
           return (
             <Card key={log.id} className="hover:shadow-sm transition-shadow">
               <CardContent className="p-4">
                 <div className="flex items-start gap-3">
                   <div className="p-2 rounded-full bg-muted">
                     <Icon className="h-4 w-4 text-muted-foreground" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 flex-wrap">
                       <span className="font-semibold">{log.action_label || actionLabels[log.action] || log.action}</span>
                       <Badge variant="outline" className="text-xs">
                         {log.entity_type}
                       </Badge>
                     </div>
                     {log.changed_fields && log.changed_fields.length > 0 && (
                       <p className="text-sm text-muted-foreground mt-1">
                         {t('alerts.changedFields')}: {log.changed_fields.join(', ')}
                       </p>
                     )}
                     <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                       <span>{t('common.by')}: {log.performed_by}</span>
                       <span>{format(new Date(log.performed_at), 'dd/MM/yyyy HH:mm:ss', { locale: getLocale() })}</span>
                     </div>
                   </div>
                   <Button variant="ghost" size="icon" className="flex-shrink-0">
                     <Eye className="h-4 w-4" />
                   </Button>
                 </div>
               </CardContent>
             </Card>
           );
         })}
       </div>
     </ScrollArea>
   );
 };

 // Reception Alerts Panel Component
const ReceptionAlertsPanel = ({ alerts, getLocale }: { alerts: ReceptionAlert[]; getLocale: () => Locale }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const acknowledgeAlert = useAcknowledgeReceptionAlert();
  const resolveAlert = useResolveReceptionAlert();
  
  const handleAcknowledge = async (id: string, name: string) => {
    await acknowledgeAlert.mutateAsync({ alertId: id, actorName: name });
    queryClient.invalidateQueries({ queryKey: ['reception-alerts'] });
  };
  
  const handleResolve = async (id: string, name: string) => {
    await resolveAlert.mutateAsync({ alertId: id, actorName: name });
    queryClient.invalidateQueries({ queryKey: ['reception-alerts'] });
  };
   
   if (alerts.length === 0) {
     return (
       <div className="text-center py-12">
         <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
         <h3 className="text-lg font-semibold">{t('alerts.noReceptionAlerts')}</h3>
         <p className="text-muted-foreground">{t('common.allCompliant')}</p>
       </div>
     );
   }
   
   return (
     <ScrollArea className="h-[500px] pr-4">
       <div className="space-y-2">
         {alerts.map((alert) => {
           const severityColors = {
             CRITIQUE: 'border-l-red-600 bg-red-50',
             MAJEUR: 'border-l-orange-500 bg-orange-50',
             MINEUR: 'border-l-yellow-500 bg-yellow-50'
           };
           
           return (
             <Card 
               key={alert.id}
               className={cn(
                 "border-l-4 transition-all",
                 severityColors[alert.severity as keyof typeof severityColors] || ''
               )}
             >
               <CardContent className="p-4">
                 <div className="flex items-start justify-between">
                   <div className="flex-1">
                     <div className="flex items-center gap-2 flex-wrap">
                       <span className="font-semibold">{alert.title}</span>
                       <Badge variant={alert.status === 'RESOLVED' ? 'default' : 'destructive'}>
                         {alert.status}
                       </Badge>
                       <Badge variant="outline">{alert.severity}</Badge>
                     </div>
                     <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                     {alert.threshold_value && alert.current_value && (
                       <p className="text-xs mt-2">
                         <span className="text-muted-foreground">{t('common.threshold')}: {alert.threshold_value}</span>
                         <span className="mx-2">|</span>
                         <span className="font-semibold text-red-600">{t('common.current')}: {alert.current_value}</span>
                       </p>
                     )}
                     <p className="text-xs text-muted-foreground mt-1">
                       {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: getLocale() })}
                     </p>
                   </div>
                   {alert.status === 'ACTIVE' && (
                     <div className="flex gap-1">
                       <Button 
                         variant="outline" 
                         size="sm"
                         onClick={() => handleAcknowledge(alert.id, t('production.operator'))}
                       >
                         <Eye className="h-3 w-3 mr-1" />
                         {t('alerts.acknowledge')}
                       </Button>
                       <Button 
                         size="sm"
                         onClick={() => handleResolve(alert.id, t('production.operator'))}
                       >
                         <CheckCircle className="h-3 w-3 mr-1" />
                         {t('alerts.resolve')}
                       </Button>
                     </div>
                   )}
                 </div>
               </CardContent>
             </Card>
           );
         })}
       </div>
     </ScrollArea>
   );
 };
