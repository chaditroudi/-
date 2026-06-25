import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Calendar, Clock, CheckCircle, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TimesheetList } from './TimesheetList';
import { TimesheetDialog } from './TimesheetDialog';
import { TimesheetWeekView } from './TimesheetWeekView';
import { PointageExpressPanel } from './PointageExpressPanel';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useAuthContext } from '@/contexts/AuthContext';

const MODULE_LABELS: Record<string, string> = {
  GENERAL: 'Général',
  FUMIGATION: 'Fumigation',
  NETTOYAGE: 'Nettoyage',
  HYDRATATION: 'Hydratation',
  TRIAGE: 'Triage',
  CONDITIONNEMENT: 'Conditionnement',
};

export function TimesheetManagement() {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<string | null>(null);
  const {
    timesheets,
    isLoading,
    createTimesheet,
    updateTimesheet,
    deleteTimesheet,
    approveTimesheet,
    rejectTimesheet,
    clockInEmployee,
    clockOutEmployee,
  } = useTimesheets();
  const { isAdmin } = useAuthContext();

  const handleAddTimesheet = () => { setSelectedTimesheet(null); setIsDialogOpen(true); };
  const handleEditTimesheet = (id: string) => { setSelectedTimesheet(id); setIsDialogOpen(true); };

  const pendingCount = timesheets.filter(t => t.status === 'submitted').length;
  const approvedCount = timesheets.filter(t => t.status === 'approved').length;
  const totalHours = timesheets.reduce((sum, t) => sum + (Number(t.hours_worked) || 0), 0);

  const operationAggregation = useMemo(() => {
    const moduleMap = new Map<string, { totalHours: number; count: number; operations: Map<string, { hours: number; count: number }> }>();
    timesheets.forEach((ts) => {
      const module = (ts as any).operation_module || 'GENERAL';
      const opId = (ts as any).operation_id as string | null;
      const hours = Number((ts as any).hours_worked) || 0;
      if (!moduleMap.has(module)) {
        moduleMap.set(module, { totalHours: 0, count: 0, operations: new Map() });
      }
      const mod = moduleMap.get(module)!;
      mod.totalHours += hours;
      mod.count += 1;
      if (opId) {
        if (!mod.operations.has(opId)) mod.operations.set(opId, { hours: 0, count: 0 });
        const op = mod.operations.get(opId)!;
        op.hours += hours;
        op.count += 1;
      }
    });
    return Array.from(moduleMap.entries())
      .map(([module, data]) => ({ module, ...data, operations: Array.from(data.operations.entries()).map(([opId, v]) => ({ opId, ...v })).sort((a, b) => b.hours - a.hours) }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [timesheets]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600">{t('timesheets.totalHours')}</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-blue-500" /><span className="text-2xl font-bold">{totalHours.toFixed(1)}h</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600">{t('common.pending')}</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-amber-500" /><span className="text-2xl font-bold">{pendingCount}</span></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600">{t('common.approved')}</CardTitle></CardHeader>
          <CardContent><div className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-emerald-500" /><span className="text-2xl font-bold">{approvedCount}</span></div></CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="pt-6">
            <Button onClick={handleAddTimesheet} className="w-full bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />{t('timesheets.new')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('timesheets.title')}</CardTitle>
          <CardDescription>{t('common.manageHours')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pointage" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pointage" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Pointage express
              </TabsTrigger>
              <TabsTrigger value="list">{t('common.list')}</TabsTrigger>
              <TabsTrigger value="week">{t('timesheets.weekView')}</TabsTrigger>
              <TabsTrigger value="by-operation" className="gap-1.5">
                <BarChart2 className="h-3.5 w-3.5" />
                Par opération
              </TabsTrigger>
              {isAdmin && <TabsTrigger value="pending">{t('common.toApprove')} ({pendingCount})</TabsTrigger>}
            </TabsList>
            <TabsContent value="pointage">
              <PointageExpressPanel
                timesheets={timesheets}
                isLoading={isLoading}
                onClockIn={clockInEmployee}
                onClockOut={clockOutEmployee}
              />
            </TabsContent>
            <TabsContent value="list">
              <TimesheetList timesheets={timesheets} isLoading={isLoading} onEdit={handleEditTimesheet} onDelete={deleteTimesheet} onApprove={isAdmin ? approveTimesheet : undefined} onReject={isAdmin ? rejectTimesheet : undefined} />
            </TabsContent>
            <TabsContent value="week"><TimesheetWeekView timesheets={timesheets} /></TabsContent>
            <TabsContent value="by-operation">
              {operationAggregation.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Aucune feuille de temps enregistrée.</p>
              ) : (
                <div className="space-y-4">
                  {operationAggregation.map(({ module, totalHours: modHours, count, operations }) => (
                    <div key={module} className="rounded-xl border overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 font-semibold text-sm">
                        <span>{MODULE_LABELS[module] ?? module}</span>
                        <span className="flex items-center gap-3">
                          <Badge variant="secondary">{count} feuilles</Badge>
                          <span className="font-bold text-primary">{modHours.toFixed(1)} h</span>
                        </span>
                      </div>
                      {operations.length > 0 && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="pl-6">N° opération / OF</TableHead>
                              <TableHead className="text-right">Feuilles</TableHead>
                              <TableHead className="text-right pr-4">Heures</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {operations.map(({ opId, hours, count: opCount }) => (
                              <TableRow key={opId}>
                                <TableCell className="pl-6 font-mono text-sm">{opId}</TableCell>
                                <TableCell className="text-right text-muted-foreground">{opCount}</TableCell>
                                <TableCell className="text-right font-semibold pr-4">{hours.toFixed(1)} h</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            {isAdmin && (
              <TabsContent value="pending">
                <TimesheetList timesheets={timesheets.filter(t => t.status === 'submitted')} isLoading={isLoading} onEdit={handleEditTimesheet} onDelete={deleteTimesheet} onApprove={approveTimesheet} onReject={rejectTimesheet} showApprovalActions />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <TimesheetDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} timesheetId={selectedTimesheet} timesheets={timesheets} onSave={selectedTimesheet ? updateTimesheet : createTimesheet} />
    </div>
  );
}
