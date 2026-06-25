import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Users, Clock, ClipboardList, LogIn, LogOut, Check, X, AlertCircle,
  Plus, Pencil, Trash2, Calendar,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { useEmployees } from '@/hooks/useEmployees';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useTasks } from '@/hooks/useTasks';
import type { Timesheet } from '@/types/roles';
import type { EmployeeTask } from '@/hooks/useTasks';

// ── Badge helpers ─────────────────────────────────────────────────────────────

const TS_STATUS: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Brouillon',  cls: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Soumise',    cls: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Approuvée',  cls: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Refusée',    cls: 'bg-red-100 text-red-700' },
};
const tsStatus = (s: Timesheet['status']) => {
  const { label, cls } = TS_STATUS[s] ?? { label: s, cls: 'bg-gray-100 text-gray-700' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
};

const TASK_PRIORITY: Record<string, { label: string; cls: string }> = {
  low:    { label: 'Faible',  cls: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Moyen',   cls: 'bg-blue-100 text-blue-700' },
  high:   { label: 'Élevé',   cls: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent',  cls: 'bg-red-100 text-red-700' },
};
const taskPriority = (p: EmployeeTask['priority']) => {
  const { label, cls } = TASK_PRIORITY[p] ?? { label: p, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
};

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'En attente', cls: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'En cours',   cls: 'bg-blue-100 text-blue-700' },
  completed:   { label: 'Terminée',   cls: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Annulée',    cls: 'bg-red-100 text-red-700' },
};
const taskStatus = (s: EmployeeTask['status']) => {
  const { label, cls } = TASK_STATUS[s] ?? { label: s, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
};

// ── Operation modules ─────────────────────────────────────────────────────────

const MODULES = ['GENERAL', 'FUMIGATION', 'NETTOYAGE', 'HYDRATATION', 'TRIAGE', 'CONDITIONNEMENT'] as const;

// ── TimesheetDialog ───────────────────────────────────────────────────────────

const tsSchema = z.object({
  employee_id: z.string().min(1, 'Employé requis'),
  work_date:   z.string().min(1, 'Date requise'),
  start_time:  z.string().min(1, "Heure d'entrée requise"),
  end_time:    z.string().optional(),
  break_minutes: z.coerce.number().min(0).default(0),
  operation_module: z.string().optional(),
  task_description: z.string().optional(),
  notes:       z.string().optional(),
});
type TsForm = z.infer<typeof tsSchema>;

interface TimesheetDialogProps {
  mode: 'create' | 'edit';
  ts?: Timesheet;
  employees: ReturnType<typeof useEmployees>['employees'];
  onSave: (data: TsForm) => Promise<void>;
  onClose: () => void;
}

function TimesheetDialog({ mode, ts, employees, onSave, onClose }: TimesheetDialogProps) {
  const form = useForm<TsForm>({
    resolver: zodResolver(tsSchema),
    defaultValues: {
      employee_id:      ts?.employee_id ?? '',
      work_date:        ts?.work_date ?? new Date().toISOString().split('T')[0],
      start_time:       ts?.start_time ?? '08:00',
      end_time:         ts?.end_time ?? '',
      break_minutes:    ts?.break_minutes ?? 0,
      operation_module: ts?.operation_module ?? '',
      task_description: ts?.task_description ?? '',
      notes:            ts?.notes ?? '',
    },
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (data: TsForm) => {
    setSaving(true);
    try { await onSave(data); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '+ Nouveau pointage' : 'Modifier le pointage'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? 'Saisir une entrée de temps manuellement.' : 'Modifier les données du pointage.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="employee_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Employé *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={mode === 'edit'}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {employees.filter(e => e.status === 'active').map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.first_name} {e.last_name} — {e.employee_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="work_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="operation_module" render={({ field }) => (
                <FormItem>
                  <FormLabel>Module</FormLabel>
                  <Select onValueChange={v => field.onChange(v === '__none__' ? '' : v)} value={field.value || '__none__'}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="start_time" render={({ field }) => (
                <FormItem>
                  <FormLabel>Entrée *</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="end_time" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sortie</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="break_minutes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pause (min)</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="task_description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Input placeholder="Nature du travail…" {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={2} className="resize-none" {...field} /></FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── RejectDialog ──────────────────────────────────────────────────────────────

function RejectDialog({
  onConfirm, onClose,
}: { onConfirm: (reason: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try { await onConfirm(reason.trim()); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Refuser ce pointage</DialogTitle>
          <DialogDescription>Indiquez le motif de refus. L'employé sera notifié.</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={3}
          className="resize-none"
          placeholder="Motif du refus…"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || saving}
            onClick={handleConfirm}
          >
            {saving ? 'En cours…' : 'Confirmer le refus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── TaskDialog ────────────────────────────────────────────────────────────────

const taskSchema = z.object({
  title:       z.string().min(2, 'Titre requis'),
  description: z.string().optional(),
  assigned_to: z.string().optional(),
  priority:    z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  due_date:    z.string().optional(),
  department:  z.string().optional(),
  notes:       z.string().optional(),
});
type TaskForm = z.infer<typeof taskSchema>;

interface TaskDialogProps {
  mode: 'create' | 'edit';
  task?: EmployeeTask;
  employees: ReturnType<typeof useEmployees>['employees'];
  onSave: (data: TaskForm) => Promise<void>;
  onClose: () => void;
}

function TaskDialog({ mode, task, employees, onSave, onClose }: TaskDialogProps) {
  const form = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title:       task?.title ?? '',
      description: task?.description ?? '',
      assigned_to: task?.assigned_to ?? '',
      priority:    task?.priority ?? 'medium',
      due_date:    task?.due_date ?? '',
      department:  task?.department ?? '',
      notes:       task?.notes ?? '',
    },
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (data: TaskForm) => {
    setSaving(true);
    try { await onSave(data); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '+ Nouvelle tâche' : 'Modifier la tâche'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Titre *</FormLabel>
                <FormControl><Input placeholder="Intitulé de la tâche…" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="assigned_to" render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigné à</FormLabel>
                  <Select onValueChange={v => field.onChange(v === '__none__' ? '' : v)} value={field.value || '__none__'}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {employees.filter(e => e.status === 'active').map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.first_name} {e.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priorité</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="low">Faible</SelectItem>
                      <SelectItem value="medium">Moyen</SelectItem>
                      <SelectItem value="high">Élevé</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="due_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Échéance</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem>
                  <FormLabel>Département</FormLabel>
                  <FormControl><Input placeholder="ex: Production" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea rows={2} className="resize-none" placeholder="Détails de la tâche…" {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={2} className="resize-none" {...field} /></FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── PointagesPanel ────────────────────────────────────────────────────────────

type DateRange = 'today' | 'week' | 'month' | 'all';

function filterByDateRange(timesheets: Timesheet[], range: DateRange): Timesheet[] {
  const today = new Date().toISOString().split('T')[0];
  if (range === 'today') return timesheets.filter(t => t.work_date === today);
  if (range === 'week') {
    const d = new Date();
    const day = d.getDay() || 7;
    const mon = new Date(d); mon.setDate(d.getDate() - day + 1);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const lo = mon.toISOString().split('T')[0];
    const hi = sun.toISOString().split('T')[0];
    return timesheets.filter(t => t.work_date >= lo && t.work_date <= hi);
  }
  if (range === 'month') {
    const prefix = new Date().toISOString().slice(0, 7);
    return timesheets.filter(t => t.work_date.startsWith(prefix));
  }
  return timesheets;
}

function PointagesPanel() {
  const { employees } = useEmployees();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>('week');
  const [tsDialog, setTsDialog] = useState<{ mode: 'create' | 'edit'; ts?: Timesheet } | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);

  const {
    timesheets, isLoading,
    clockInEmployee, clockOutEmployee,
    approveTimesheet, submitTimesheet, rejectTimesheet, deleteTimesheet,
    createTimesheetForEmployee, refetch,
  } = useTimesheets(selectedEmployeeId && selectedEmployeeId !== '__all__' ? selectedEmployeeId : undefined);

  const today = new Date().toISOString().split('T')[0];
  const activeEmployees = employees.filter(e => e.status === 'active');

  const visibleTs = filterByDateRange(timesheets, dateRange);

  const todayAll = timesheets.filter(t => t.work_date === today);
  const openToday = todayAll.find(t => !t.end_time && t.employee_id === (selectedEmployeeId || undefined));
  const presentToday = new Set(timesheets.filter(t => t.work_date === today).map(t => t.employee_id)).size;
  const hoursToday = timesheets
    .filter(t => t.work_date === today && t.hours_worked)
    .reduce((s, t) => s + (t.hours_worked ?? 0), 0);
  const pendingApproval = timesheets.filter(t => t.status === 'submitted').length;

  const handleCreate = async (data: TsForm) => {
    await createTimesheetForEmployee(data.employee_id, {
      work_date:        data.work_date,
      start_time:       data.start_time,
      end_time:         data.end_time || null,
      break_minutes:    data.break_minutes,
      task_description: data.task_description || null,
      operation_module: (data.operation_module || null) as import('@/types/roles').TimesheetOperationModule | null,
      notes:            data.notes || null,
    }, { status: 'draft' });
    await refetch();
  };

  const handleEdit = async (data: TsForm) => {
    if (!tsDialog?.ts) return;
    // Import hrApi here directly for partial PATCH
    const { hrApi } = await import('@/lib/api/hr');
    await hrApi.updateTimesheet(tsDialog.ts.id, {
      work_date:        data.work_date,
      start_time:       data.start_time,
      end_time:         data.end_time || null,
      break_minutes:    data.break_minutes,
      task_description: data.task_description || null,
      operation_module: data.operation_module || null,
      notes:            data.notes || null,
    });
    await refetch();
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-emerald-700">{activeEmployees.length}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Employés actifs</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-blue-700">{presentToday}</p>
            <p className="text-xs text-blue-600 mt-0.5">Présents aujourd'hui</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-amber-700">{pendingApproval}</p>
            <p className="text-xs text-amber-600 mt-0.5">En attente approbation</p>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-purple-700">{hoursToday.toFixed(1)}h</p>
            <p className="text-xs text-purple-600 mt-0.5">Heures totales aujourd'hui</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick clock in/out */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pointage rapide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={selectedEmployeeId || '__all__'}
              onValueChange={v => setSelectedEmployeeId(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Tous les employés" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les employés</SelectItem>
                {activeEmployees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} — {e.employee_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!selectedEmployeeId || !!openToday}
              onClick={() => clockInEmployee(selectedEmployeeId)}
            >
              <LogIn className="h-4 w-4 mr-1.5" />
              Entrée
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              disabled={!selectedEmployeeId || !openToday}
              onClick={() => clockOutEmployee(selectedEmployeeId)}
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Sortie
            </Button>
            {openToday && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                En poste depuis {openToday.start_time}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters + Add button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {(['today', 'week', 'month', 'all'] as DateRange[]).map(r => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                dateRange === r
                  ? 'bg-emerald-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {{ today: 'Auj.', week: 'Semaine', month: 'Mois', all: 'Tout' }[r]}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          onClick={() => setTsDialog({ mode: 'create' })}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Entrée manuelle
        </Button>
      </div>

      {/* Timesheets table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Feuilles de temps ({visibleTs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Chargement…</p>
          ) : visibleTs.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground italic">Aucune feuille de temps sur cette période.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Employé</th>
                    <th className="px-3 py-2 text-left font-medium">Entrée</th>
                    <th className="px-3 py-2 text-left font-medium">Sortie</th>
                    <th className="px-3 py-2 text-left font-medium">Pause</th>
                    <th className="px-3 py-2 text-right font-medium">Heures</th>
                    <th className="px-3 py-2 text-left font-medium">Module</th>
                    <th className="px-3 py-2 text-left font-medium">Statut</th>
                    <th className="px-3 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTs.map(ts => {
                    const emp = employees.find(e => e.id === ts.employee_id);
                    const empLabel = emp ? `${emp.first_name} ${emp.last_name}` : ts.employee_id.slice(0, 8);
                    return (
                      <tr key={ts.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 font-mono">{ts.work_date}</td>
                        <td className="px-3 py-2 max-w-[140px] truncate">{empLabel}</td>
                        <td className="px-3 py-2 font-mono">{ts.start_time}</td>
                        <td className="px-3 py-2 font-mono">
                          {ts.end_time ?? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                              En cours
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {ts.break_minutes ? `${ts.break_minutes}min` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-bold">
                          {ts.hours_worked != null ? `${ts.hours_worked.toFixed(1)}h` : '—'}
                        </td>
                        <td className="px-3 py-2">{ts.operation_module ?? '—'}</td>
                        <td className="px-3 py-2">{tsStatus(ts.status)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-0.5">
                            {/* Edit */}
                            {(ts.status === 'draft' || ts.status === 'rejected') && (
                              <button
                                onClick={() => setTsDialog({ mode: 'edit', ts })}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="Modifier"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {/* Submit */}
                            {ts.status === 'draft' && (
                              <button
                                onClick={() => submitTimesheet(ts.id)}
                                className="p-1 rounded hover:bg-blue-100 text-blue-600"
                                title="Soumettre pour approbation"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {/* Approve */}
                            {ts.status === 'submitted' && (
                              <button
                                onClick={() => approveTimesheet(ts.id)}
                                className="p-1 rounded hover:bg-green-100 text-green-600"
                                title="Approuver"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {/* Reject */}
                            {ts.status === 'submitted' && (
                              <button
                                onClick={() => setRejectId(ts.id)}
                                className="p-1 rounded hover:bg-red-100 text-red-600"
                                title="Refuser"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {/* Delete */}
                            {ts.status !== 'approved' && (
                              <button
                                onClick={() => deleteTimesheet(ts.id)}
                                className="p-1 rounded hover:bg-red-100 text-red-500"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {tsDialog && (
        <TimesheetDialog
          mode={tsDialog.mode}
          ts={tsDialog.ts}
          employees={employees}
          onSave={tsDialog.mode === 'create' ? handleCreate : handleEdit}
          onClose={() => setTsDialog(null)}
        />
      )}
      {rejectId && (
        <RejectDialog
          onConfirm={reason => rejectTimesheet(rejectId, reason)}
          onClose={() => setRejectId(null)}
        />
      )}
    </div>
  );
}

// ── TachesPanel ───────────────────────────────────────────────────────────────

function TachesPanel() {
  const { tasks, isLoading, createTask, updateTask, deleteTask } = useTasks();
  const { employees } = useEmployees();
  const [statusFilter, setStatusFilter]     = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [taskDialog, setTaskDialog] = useState<{ mode: 'create' | 'edit'; task?: EmployeeTask } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = tasks
    .filter(t => statusFilter   === 'all' || t.status   === statusFilter)
    .filter(t => priorityFilter === 'all' || t.priority === priorityFilter);

  const pending    = tasks.filter(t => t.status === 'pending').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const overdue    = tasks.filter(t =>
    t.due_date && new Date(t.due_date) < new Date() &&
    t.status !== 'completed' && t.status !== 'cancelled',
  ).length;
  const completed  = tasks.filter(t => t.status === 'completed').length;

  const handleSave = async (data: TaskForm) => {
    if (taskDialog?.mode === 'create') {
      await createTask({
        title:       data.title,
        description: data.description || undefined,
        assigned_to: data.assigned_to || undefined,
        priority:    data.priority,
        due_date:    data.due_date || undefined,
        department:  data.department || undefined,
        notes:       data.notes || undefined,
      });
    } else if (taskDialog?.task) {
      await updateTask(taskDialog.task.id, {
        title:       data.title,
        description: data.description || undefined,
        assigned_to: data.assigned_to || undefined,
        priority:    data.priority,
        due_date:    data.due_date || undefined,
        department:  data.department || undefined,
        notes:       data.notes || undefined,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-blue-700">{pending}</p>
            <p className="text-xs text-blue-600 mt-0.5">En attente</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-amber-700">{inProgress}</p>
            <p className="text-xs text-amber-600 mt-0.5">En cours</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-red-700">{overdue}</p>
            <p className="text-xs text-red-600 mt-0.5">En retard</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-emerald-700">{completed}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Terminées</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="completed">Terminées</SelectItem>
              <SelectItem value="cancelled">Annulées</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes priorités</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">Élevé</SelectItem>
              <SelectItem value="medium">Moyen</SelectItem>
              <SelectItem value="low">Faible</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={() => setTaskDialog({ mode: 'create' })}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nouvelle tâche
        </Button>
      </div>

      {/* Tasks table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Tâches atelier ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground italic">Aucune tâche.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium">Titre</th>
                    <th className="px-3 py-2 text-left font-medium">Assigné à</th>
                    <th className="px-3 py-2 text-left font-medium">Priorité</th>
                    <th className="px-3 py-2 text-left font-medium">Échéance</th>
                    <th className="px-3 py-2 text-left font-medium">Département</th>
                    <th className="px-3 py-2 text-left font-medium">Statut</th>
                    <th className="px-3 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(task => {
                    const assignee = employees.find(e => e.id === task.assigned_to);
                    const assigneeLabel = assignee
                      ? `${assignee.first_name} ${assignee.last_name}`
                      : task.employee
                      ? `${task.employee.first_name} ${task.employee.last_name}`
                      : '—';
                    const isOverdue =
                      task.due_date &&
                      new Date(task.due_date) < new Date() &&
                      task.status !== 'completed' &&
                      task.status !== 'cancelled';
                    return (
                      <tr key={task.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 max-w-[200px]">
                          <div className="flex items-center gap-1.5">
                            {isOverdue && <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                            <span className="truncate font-medium">{task.title}</span>
                          </div>
                          {task.description && (
                            <p className="text-muted-foreground truncate mt-0.5">{task.description}</p>
                          )}
                        </td>
                        <td className="px-3 py-2">{assigneeLabel}</td>
                        <td className="px-3 py-2">{taskPriority(task.priority)}</td>
                        <td className={`px-3 py-2 font-mono ${isOverdue ? 'text-red-600 font-semibold' : ''}`}>
                          {task.due_date
                            ? format(parseISO(task.due_date), 'dd/MM/yyyy', { locale: fr })
                            : '—'}
                        </td>
                        <td className="px-3 py-2">{task.department ?? '—'}</td>
                        <td className="px-3 py-2">{taskStatus(task.status)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-0.5">
                            {/* Edit */}
                            {task.status !== 'completed' && task.status !== 'cancelled' && (
                              <button
                                onClick={() => setTaskDialog({ mode: 'edit', task })}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="Modifier"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {/* Start */}
                            {task.status === 'pending' && (
                              <button
                                onClick={() => updateTask(task.id, { status: 'in_progress' })}
                                className="p-1 rounded hover:bg-blue-100 text-blue-600"
                                title="Démarrer"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {/* Complete */}
                            {task.status === 'in_progress' && (
                              <button
                                onClick={() => updateTask(task.id, { status: 'completed' })}
                                className="p-1 rounded hover:bg-green-100 text-green-600"
                                title="Terminer"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {/* Cancel */}
                            {(task.status === 'pending' || task.status === 'in_progress') && (
                              <button
                                onClick={() => updateTask(task.id, { status: 'cancelled' })}
                                className="p-1 rounded hover:bg-amber-100 text-amber-600"
                                title="Annuler"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {/* Delete */}
                            <button
                              onClick={() => setDeleteId(task.id)}
                              className="p-1 rounded hover:bg-red-100 text-red-500"
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {taskDialog && (
        <TaskDialog
          mode={taskDialog.mode}
          task={taskDialog.task}
          employees={employees}
          onSave={handleSave}
          onClose={() => setTaskDialog(null)}
        />
      )}
      {deleteId && (
        <Dialog open onOpenChange={() => setDeleteId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Supprimer la tâche</DialogTitle>
              <DialogDescription>Cette action est irréversible.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Annuler</Button>
              <Button
                variant="destructive"
                onClick={async () => { await deleteTask(deleteId!); setDeleteId(null); }}
              >
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── HRDashboard ───────────────────────────────────────────────────────────────

export function HRDashboard() {
  const { tasks } = useTasks();

  const urgentTasks  = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed' && t.status !== 'cancelled').length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="pointages">
        <TabsList className="h-9">
          <TabsTrigger value="pointages" className="text-xs gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Pointages
          </TabsTrigger>
          <TabsTrigger value="taches" className="text-xs gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            Tâches
            {(urgentTasks > 0 || pendingCount > 0) && (
              <Badge className="ml-1 h-4 px-1.5 text-[10px] bg-amber-500 text-white">
                {urgentTasks > 0 ? `${urgentTasks} urgent` : pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pointages" className="mt-4">
          <PointagesPanel />
        </TabsContent>

        <TabsContent value="taches" className="mt-4">
          <TachesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
