import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Timesheet } from '@/types/roles';

const MODULE_OPTIONS = [
  { value: 'GENERAL', label: 'Général' },
  { value: 'FUMIGATION', label: 'Fumigation' },
  { value: 'NETTOYAGE', label: 'Nettoyage' },
  { value: 'HYDRATATION', label: 'Hydratation' },
  { value: 'TRIAGE', label: 'Triage' },
  { value: 'CONDITIONNEMENT', label: 'Conditionnement' },
];

interface TimesheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timesheetId: string | null;
  timesheets: Timesheet[];
  onSave: (data: any) => Promise<void>;
}

export function TimesheetDialog({ open, onOpenChange, timesheetId, timesheets, onSave }: TimesheetDialogProps) {
  const { t } = useTranslation();
  const isEditing = !!timesheetId;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const timesheet = timesheetId ? timesheets.find(t => t.id === timesheetId) : null;

  const timesheetSchema = z.object({
    work_date: z.string().min(1, t('validation.required')),
    start_time: z.string().min(1, t('validation.required')),
    end_time: z.string().optional(),
    break_minutes: z.coerce.number().min(0).default(0),
    task_description: z.string().optional(),
    project_reference: z.string().optional(),
    operation_module: z.string().optional(),
    operation_id: z.string().optional(),
    notes: z.string().optional(),
  });

  type TimesheetFormData = z.infer<typeof timesheetSchema>;

  const form = useForm<TimesheetFormData>({
    resolver: zodResolver(timesheetSchema),
    defaultValues: { work_date: new Date().toISOString().split('T')[0], start_time: '08:00', end_time: '17:00', break_minutes: 60, task_description: '', project_reference: '', operation_module: 'GENERAL', operation_id: '', notes: '' },
  });

  useEffect(() => {
    if (timesheet) {
      form.reset({ work_date: timesheet.work_date, start_time: timesheet.start_time?.slice(0, 5) || '08:00', end_time: timesheet.end_time?.slice(0, 5) || '', break_minutes: timesheet.break_minutes || 0, task_description: timesheet.task_description || '', project_reference: timesheet.project_reference || '', operation_module: timesheet.operation_module || 'GENERAL', operation_id: timesheet.operation_id || '', notes: timesheet.notes || '' });
    } else {
      form.reset({ work_date: new Date().toISOString().split('T')[0], start_time: '08:00', end_time: '17:00', break_minutes: 60, task_description: '', project_reference: '', operation_module: 'GENERAL', operation_id: '', notes: '' });
    }
  }, [timesheet, form]);

  const handleSubmit = async (data: TimesheetFormData) => {
    const payload = { work_date: data.work_date, start_time: data.start_time, end_time: data.end_time || null, break_minutes: data.break_minutes, task_description: data.task_description || null, project_reference: data.project_reference || null, operation_module: data.operation_module && data.operation_module !== 'GENERAL' ? data.operation_module : null, operation_id: data.operation_id || null, notes: data.notes || null };
    if (isEditing && timesheetId) await onSave({ id: timesheetId, ...payload });
    else await onSave(payload);
    onOpenChange(false);
  };

  const watchStartTime = form.watch('start_time');
  const watchEndTime = form.watch('end_time');
  const watchBreak = form.watch('break_minutes');
  
  const calculateHours = () => {
    if (!watchStartTime || !watchEndTime) return null;
    const [startH, startM] = watchStartTime.split(':').map(Number);
    const [endH, endM] = watchEndTime.split(':').map(Number);
    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM) - (watchBreak || 0);
    return totalMinutes > 0 ? (totalMinutes / 60).toFixed(1) : '0';
  };
  const estimatedHours = calculateHours();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('timesheets.editEntry') : t('timesheets.newEntry')}</DialogTitle>
          <DialogDescription>{t('timesheets.recordHours')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="work_date" render={({ field }) => (
              <FormItem><FormLabel>{t('common.date')} *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="start_time" render={({ field }) => (
                <FormItem><FormLabel>{t('timesheets.start')} *</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="end_time" render={({ field }) => (
                <FormItem><FormLabel>{t('timesheets.end')}</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="break_minutes" render={({ field }) => (
                <FormItem><FormLabel>{t('timesheets.breakMin')}</FormLabel><FormControl><Input type="number" min="0" step="15" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            {estimatedHours && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                <span className="text-emerald-800 font-medium">{t('common.calculatedHours')}: <strong>{estimatedHours}h</strong></span>
              </div>
            )}
            {/* Module — chip buttons */}
            <FormField control={form.control} name="operation_module" render={({ field }) => (
              <FormItem>
                <FormLabel>Module opération</FormLabel>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {MODULE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => field.onChange(opt.value)}
                      className={`rounded-xl border-2 px-3 py-1.5 text-xs font-semibold transition-all ${
                        (field.value || 'GENERAL') === opt.value
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="task_description" render={({ field }) => (
              <FormItem><FormLabel>{t('timesheets.taskDescription')}</FormLabel><FormControl><Textarea placeholder={t('timesheets.describeTasks')} className="resize-none" rows={2} {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            {/* Advanced fields — collapsed by default */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              <span>Détails supplémentaires (N° OF, référence projet, notes)</span>
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showAdvanced && (
              <div className="space-y-3 rounded-xl border border-dashed p-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="operation_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">N° opération / OF</FormLabel>
                      <FormControl><Input placeholder="PKG-20260609-001…" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="project_reference" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">{t('timesheets.projectRef')}</FormLabel>
                      <FormControl><Input placeholder="PROJ-123…" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">{t('common.notes')}</FormLabel><FormControl><Textarea placeholder={t('timesheets.additionalNotes')} className="resize-none" rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">{isEditing ? t('common.save') : t('common.add')}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}