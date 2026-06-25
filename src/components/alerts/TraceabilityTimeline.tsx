 import { useEffect, useMemo, useRef, useState } from 'react';
 import { useTranslation } from 'react-i18next';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
 import { Clock, ChevronDown, ChevronRight, Search, Package, Factory, Shield, Truck, User, FileText } from 'lucide-react';
 import { useAuditLogs, AuditLog } from '@/hooks/useNotifications';
 import { format, formatDistanceToNow } from 'date-fns';
 import { fr, enUS, ar } from 'date-fns/locale';
 import { cn } from '@/lib/utils';

 const entityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
   RECEPTION: Package, PRODUCTION: Factory, BATCH: Package, QUALITY: Shield,
   STOCK: Truck, REQUISITION: FileText, PURCHASE_ORDER: FileText, EMPLOYEE: User
 };

 const actionColors: Record<string, string> = {
   CREATE: 'bg-green-500', UPDATE: 'bg-blue-500', DELETE: 'bg-red-500',
   STATUS_CHANGE: 'bg-purple-500', QC_DECISION: 'bg-orange-500', APPROVE: 'bg-green-600', REJECT: 'bg-red-600'
 };

 interface TraceabilityTimelineProps {
   entityType?: string;
   entityId?: string;
   showFilters?: boolean;
   maxHeight?: string;
 }

 export const TraceabilityTimeline = ({ entityType, entityId, showFilters = true, maxHeight = "600px" }: TraceabilityTimelineProps) => {
   const { t, i18n } = useTranslation();
   const [searchTerm, setSearchTerm] = useState('');
   const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
   const [entityTypeFilter, setEntityTypeFilter] = useState<string | null>(entityType || null);
   const [recentLogIds, setRecentLogIds] = useState<Set<string>>(new Set());
   const [lastLiveUpdateAt, setLastLiveUpdateAt] = useState<string | null>(null);
   const previousLogIdsRef = useRef<string[]>([]);

   const getLocale = () => {
     switch (i18n.language) { case 'ar': return ar; case 'en': return enUS; default: return fr; }
   };
   
   const { data: logs = [], isLoading } = useAuditLogs(entityTypeFilter || undefined, entityId);

   useEffect(() => {
     const nextIds = logs.map((log) => log.id);
     if (previousLogIdsRef.current.length > 0) {
       const previousIds = new Set(previousLogIdsRef.current);
       const newIds = nextIds.filter((id) => !previousIds.has(id));

       if (newIds.length > 0) {
         setLastLiveUpdateAt(new Date().toISOString());
         setRecentLogIds((current) => {
           const merged = new Set(current);
           newIds.forEach((id) => merged.add(id));
           return merged;
         });
       }
     }

     previousLogIdsRef.current = nextIds;
   }, [logs]);

   useEffect(() => {
     if (recentLogIds.size === 0) return;

     const timeout = window.setTimeout(() => {
       setRecentLogIds(new Set());
     }, 15000);

     return () => window.clearTimeout(timeout);
   }, [recentLogIds]);
   
   const filteredLogs = logs.filter(log => {
     if (searchTerm) {
       const searchLower = searchTerm.toLowerCase();
       return log.action_label?.toLowerCase().includes(searchLower) || log.entity_type.toLowerCase().includes(searchLower) || log.performed_by.toLowerCase().includes(searchLower);
     }
     return true;
   });
   
   const groupedLogs = useMemo(() => filteredLogs.reduce((acc, log) => {
     const date = format(new Date(log.performed_at), 'yyyy-MM-dd');
     if (!acc[date]) acc[date] = [];
     acc[date].push(log);
     return acc;
   }, {} as Record<string, AuditLog[]>), [filteredLogs]);
   
   const toggleExpanded = (id: string) => {
     setExpandedLogs(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
   };

   const renderChangeDetails = (log: AuditLog) => {
     if (!log.old_state && !log.new_state) return null;
     const changes: { field: string; oldVal: unknown; newVal: unknown }[] = [];
     if (log.changed_fields) {
       log.changed_fields.forEach(field => { changes.push({ field, oldVal: log.old_state?.[field], newVal: log.new_state?.[field] }); });
     }
     if (changes.length === 0) return null;
     return (
       <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
         <p className="font-medium mb-2 text-muted-foreground">{t('alerts.changeDetails')}:</p>
         <div className="space-y-2">
           {changes.map((change, idx) => (
             <div key={idx} className="flex items-start gap-2">
               <Badge variant="outline" className="text-xs font-mono">{change.field}</Badge>
               <div className="flex-1">
                 {change.oldVal !== undefined && <span className="text-red-600 line-through mr-2">{String(change.oldVal)}</span>}
                 {change.newVal !== undefined && <span className="text-green-600">{String(change.newVal)}</span>}
               </div>
             </div>
           ))}
         </div>
       </div>
     );
   };

   return (
     <Card>
       <CardHeader className="pb-2">
         <div className="flex items-start justify-between gap-3 flex-wrap">
           <div>
             <CardTitle className="flex items-center gap-2">
               <Clock className="h-5 w-5" />
               {t('alerts.traceabilityHistory')}
             </CardTitle>
             <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
               <Badge variant={recentLogIds.size > 0 ? "default" : "outline"} className="rounded-full">
                 {t('alerts.realtime', { defaultValue: 'Live' })}
               </Badge>
               <span>{filteredLogs.length} {t('common.events', { defaultValue: 'events' })}</span>
               {lastLiveUpdateAt && (
                 <span>{formatDistanceToNow(new Date(lastLiveUpdateAt), { addSuffix: true, locale: getLocale() })}</span>
               )}
             </div>
           </div>
           {recentLogIds.size > 0 && (
             <Badge className="rounded-full bg-emerald-600 text-white">
               +{recentLogIds.size} {t('common.new')}
             </Badge>
           )}
         </div>
         {showFilters && (
           <div className="flex items-center gap-2 mt-4 flex-wrap">
             <div className="relative flex-1 min-w-[200px]">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input placeholder={t('alerts.searchHistory')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
             </div>
             {!entityType && (
               <div className="flex gap-1 flex-wrap">
                 <Button variant={entityTypeFilter === null ? "default" : "outline"} size="sm" onClick={() => setEntityTypeFilter(null)}>{t('common.all')}</Button>
                 {['RECEPTION', 'PRODUCTION', 'BATCH', 'STOCK', 'REQUISITION'].map(type => (
                   <Button key={type} variant={entityTypeFilter === type ? "default" : "outline"} size="sm" onClick={() => setEntityTypeFilter(type)}>{type}</Button>
                 ))}
               </div>
             )}
           </div>
         )}
       </CardHeader>
       <CardContent>
         {isLoading ? (
           <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
         ) : filteredLogs.length === 0 ? (
           <div className="text-center py-12">
             <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
             <h3 className="text-lg font-semibold">{t('alerts.noHistory')}</h3>
             <p className="text-muted-foreground">{t('alerts.noEventsRecorded')}</p>
           </div>
         ) : (
           <ScrollArea className="pr-4" style={{ height: maxHeight }}>
             <div className="relative">
               <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
               {Object.entries(groupedLogs).map(([date, dayLogs]) => (
                 <div key={date} className="mb-6">
                   <div className="flex items-center gap-2 mb-4 ml-8">
                     <Badge variant="secondary" className="font-medium">{format(new Date(date), 'EEEE d MMMM yyyy', { locale: getLocale() })}</Badge>
                     <span className="text-xs text-muted-foreground">{dayLogs.length} {t('common.events')}</span>
                   </div>
                   <div className="space-y-3">
                     {dayLogs.map((log) => {
                       const Icon = entityIcons[log.entity_type] || Clock;
                       const isExpanded = expandedLogs.has(log.id);
                       const actionColor = actionColors[log.action] || 'bg-gray-500';
                       return (
                         <Collapsible key={log.id} open={isExpanded} onOpenChange={() => toggleExpanded(log.id)}>
                           <div className="flex items-start gap-3 ml-1">
                              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center z-10", actionColor)}>
                                <Icon className="h-3 w-3 text-white" />
                              </div>
                             <Card className={cn(
                               "flex-1 hover:shadow-sm transition-shadow",
                               recentLogIds.has(log.id) && "border-primary/40 bg-primary/5 shadow-sm"
                             )}>
                               <CardContent className="p-3">
                                 <CollapsibleTrigger className="w-full text-left">
                                   <div className="flex items-start justify-between">
                                     <div className="flex-1">
                                       <div className="flex items-center gap-2 flex-wrap">
                                         <span className="font-semibold text-sm">{log.action_label || log.action}</span>
                                         <Badge variant="outline" className="text-xs">{log.entity_type}</Badge>
                                         {recentLogIds.has(log.id) && (
                                           <Badge className="text-xs bg-emerald-600 text-white">{t('common.new')}</Badge>
                                         )}
                                         {log.changed_fields && log.changed_fields.length > 0 && (
                                           <Badge variant="secondary" className="text-xs">{log.changed_fields.length} {t('common.fields')}</Badge>
                                         )}
                                       </div>
                                       <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                         <span className="flex items-center gap-1"><User className="h-3 w-3" />{log.performed_by}</span>
                                         <span>{format(new Date(log.performed_at), 'HH:mm:ss', { locale: getLocale() })}</span>
                                         <span className="italic">{formatDistanceToNow(new Date(log.performed_at), { addSuffix: true, locale: getLocale() })}</span>
                                       </div>
                                     </div>
                                     <Button variant="ghost" size="icon" className="h-6 w-6">
                                       {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                     </Button>
                                   </div>
                                 </CollapsibleTrigger>
                                 <CollapsibleContent>
                                   {renderChangeDetails(log)}
                                   {log.metadata && Object.keys(log.metadata).length > 0 && (
                                     <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                                       <p className="font-medium mb-2 text-muted-foreground">{t('alerts.metadata')}:</p>
                                       <pre className="text-xs overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                                     </div>
                                   )}
                                 </CollapsibleContent>
                               </CardContent>
                             </Card>
                           </div>
                         </Collapsible>
                       );
                     })}
                   </div>
                 </div>
               ))}
             </div>
           </ScrollArea>
         )}
       </CardContent>
     </Card>
   );
 };
