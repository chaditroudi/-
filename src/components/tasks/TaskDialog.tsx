 import { useEffect } from 'react';
 import { useTranslation } from 'react-i18next';
 import { useForm } from 'react-hook-form';
 import { zodResolver } from '@hookform/resolvers/zod';
 import * as z from 'zod';
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
 import { Input } from '@/components/ui/input';
 import { Textarea } from '@/components/ui/textarea';
 import { Button } from '@/components/ui/button';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import type { EmployeeTask } from '@/hooks/useTasks';
 import type { Employee } from '@/types/roles';

 interface TaskDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   taskId: string | null;
   tasks: EmployeeTask[];
   employees: Employee[];
   onSave: (data: any) => Promise<void>;
 }

 export function TaskDialog({ open, onOpenChange, taskId, tasks, employees, onSave }: TaskDialogProps) {
   const { t } = useTranslation();
   const task = taskId ? tasks.find(t => t.id === taskId) : null;
   const isEditing = !!task;

   const formSchema = z.object({
     title: z.string().min(2, t('validation.minLength', { min: 2 })),
     description: z.string().optional(),
     assigned_to: z.string().optional(),
     priority: z.enum(['low', 'medium', 'high', 'urgent']),
     status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
     due_date: z.string().optional(),
     department: z.string().optional(),
     notes: z.string().optional(),
   });

   type FormData = z.infer<typeof formSchema>;

   const departmentKeys = ['direction', 'production', 'quality', 'logistics', 'reception', 'stock', 'purchasing', 'commercial', 'it'] as const;

   const form = useForm<FormData>({
     resolver: zodResolver(formSchema),
     defaultValues: { title: '', description: '', assigned_to: 'unassigned', priority: 'medium', status: 'pending', due_date: '', department: '', notes: '' },
   });

   useEffect(() => {
     if (task) {
       form.reset({ title: task.title, description: task.description || '', assigned_to: task.assigned_to || 'unassigned', priority: task.priority, status: task.status, due_date: task.due_date ? task.due_date.split('T')[0] : '', department: task.department || '', notes: task.notes || '' });
     } else {
       form.reset({ title: '', description: '', assigned_to: 'unassigned', priority: 'medium', status: 'pending', due_date: '', department: '', notes: '' });
     }
   }, [task, form]);

   const handleSubmit = async (data: FormData) => {
     try {
       const submitData = { ...data, assigned_to: data.assigned_to === 'unassigned' ? undefined : data.assigned_to };
       await onSave(submitData);
       onOpenChange(false);
     } catch (_error) { /* submit errors are shown via toast in onSave */ }
   };

   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-lg">
         <DialogHeader>
           <DialogTitle>{isEditing ? t('tasks.editTask') : t('tasks.newTask')}</DialogTitle>
           <DialogDescription>{isEditing ? t('tasks.editTaskDesc') : t('tasks.newTaskDesc')}</DialogDescription>
         </DialogHeader>
         <Form {...form}>
           <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
             <FormField control={form.control} name="title" render={({ field }) => (
               <FormItem><FormLabel>{t('tasks.taskTitleLabel')} *</FormLabel><FormControl><Input placeholder={t('tasks.taskTitle')} {...field} /></FormControl><FormMessage /></FormItem>
             )} />
             <FormField control={form.control} name="description" render={({ field }) => (
               <FormItem><FormLabel>{t('common.description')}</FormLabel><FormControl><Textarea placeholder={t('tasks.detailedDescription')} rows={3} {...field} /></FormControl><FormMessage /></FormItem>
             )} />
             <div className="grid grid-cols-2 gap-4">
               <FormField control={form.control} name="assigned_to" render={({ field }) => (
                 <FormItem><FormLabel>{t('tasks.assignedTo')}</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value}>
                     <FormControl><SelectTrigger><SelectValue placeholder={t('tasks.selectEmployee')} /></SelectTrigger></FormControl>
                     <SelectContent>
                       <SelectItem value="unassigned">{t('common.unassigned')}</SelectItem>
                       {employees.filter(e => e.status === 'active').map(emp => (
                         <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select><FormMessage />
                 </FormItem>
               )} />
               <FormField control={form.control} name="department" render={({ field }) => (
                 <FormItem><FormLabel>{t('employees.department')}</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value}>
                     <FormControl><SelectTrigger><SelectValue placeholder={t('tasks.selectEmployee')} /></SelectTrigger></FormControl>
                     <SelectContent>
                       {departmentKeys.map(key => (
                         <SelectItem key={key} value={t(`tasks.departments.${key}`)}>{t(`tasks.departments.${key}`)}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select><FormMessage />
                 </FormItem>
               )} />
             </div>
             <div className="grid grid-cols-2 gap-4">
               <FormField control={form.control} name="priority" render={({ field }) => (
                 <FormItem><FormLabel>{t('tasks.priority')}</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value}>
                     <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                     <SelectContent>
                       <SelectItem value="low">{t('tasks.priorities.low')}</SelectItem>
                       <SelectItem value="medium">{t('tasks.priorities.medium')}</SelectItem>
                       <SelectItem value="high">{t('tasks.priorities.high')}</SelectItem>
                       <SelectItem value="urgent">{t('tasks.priorities.urgent')}</SelectItem>
                     </SelectContent>
                   </Select><FormMessage />
                 </FormItem>
               )} />
               {isEditing && (
                 <FormField control={form.control} name="status" render={({ field }) => (
                   <FormItem><FormLabel>{t('common.status')}</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value}>
                       <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                       <SelectContent>
                         <SelectItem value="pending">{t('tasks.statuses.todo')}</SelectItem>
                         <SelectItem value="in_progress">{t('tasks.statuses.inProgress')}</SelectItem>
                         <SelectItem value="completed">{t('tasks.statuses.completed')}</SelectItem>
                         <SelectItem value="cancelled">{t('tasks.statuses.cancelled')}</SelectItem>
                       </SelectContent>
                     </Select><FormMessage />
                   </FormItem>
                 )} />
               )}
             </div>
             <FormField control={form.control} name="due_date" render={({ field }) => (
               <FormItem><FormLabel>{t('tasks.dueDate')}</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
             )} />
             <FormField control={form.control} name="notes" render={({ field }) => (
               <FormItem><FormLabel>{t('common.notes')}</FormLabel><FormControl><Textarea placeholder={t('timesheets.additionalNotes')} rows={2} {...field} /></FormControl><FormMessage /></FormItem>
             )} />
             <DialogFooter>
               <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
               <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">{isEditing ? t('common.save') : t('common.create')}</Button>
             </DialogFooter>
           </form>
         </Form>
       </DialogContent>
     </Dialog>
   );
 }