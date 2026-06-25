import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ROLE_CONFIG, type Employee } from '@/types/roles';

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  employees: Employee[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

export function EmployeeDialog({ open, onOpenChange, employeeId, employees, onSave }: EmployeeDialogProps) {
  const { t } = useTranslation();
  const isEditing = !!employeeId;
  const employee = employeeId ? employees.find(e => e.id === employeeId) : null;

  const employeeSchema = z.object({
    first_name: z.string().min(2, t('validation.minLength', { min: 2 })),
    last_name: z.string().min(2, t('validation.minLength', { min: 2 })),
    email: z.string().email(t('validation.invalidEmail')).optional().or(z.literal('')),
    phone: z.string().optional(),
    role: z.string().min(1, t('validation.required')),
    department: z.string().optional(),
    hire_date: z.string().min(1, t('validation.required')),
    status: z.string().min(1, t('validation.required')),
    hourly_rate: z.coerce.number().optional(),
    supervisor_id: z.string().optional(),
    notes: z.string().optional(),
    create_access_account: z.boolean().default(false),
    access_password: z.string().optional(),
    confirm_access_password: z.string().optional(),
  }).superRefine((data, ctx) => {
    if (isEditing || !data.create_access_account) {
      return;
    }

    if (!data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Email requis pour creer un acces.',
      });
    }

    if (!data.access_password || data.access_password.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['access_password'],
        message: 'Mot de passe temporaire de 6 caracteres minimum.',
      });
    }

    if (data.access_password !== data.confirm_access_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirm_access_password'],
        message: 'Les mots de passe doivent etre identiques.',
      });
    }
  });

  type EmployeeFormData = z.infer<typeof employeeSchema>;

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      first_name: '', last_name: '', email: '', phone: '', role: 'responsable_production',
      department: '', hire_date: new Date().toISOString().split('T')[0], status: 'active',
      hourly_rate: undefined, supervisor_id: '', notes: '',
      create_access_account: false, access_password: '', confirm_access_password: '',
    },
  });

  useEffect(() => {
    if (employee) {
      form.reset({
        first_name: employee.first_name, last_name: employee.last_name,
        email: employee.email || '', phone: employee.phone || '', role: employee.role,
        department: employee.department || '', hire_date: employee.hire_date, status: employee.status,
        hourly_rate: employee.hourly_rate || undefined, supervisor_id: employee.supervisor_id || '',
        notes: employee.notes || '',
        create_access_account: false, access_password: '', confirm_access_password: '',
      });
    } else {
      form.reset({
        first_name: '', last_name: '', email: '', phone: '', role: 'responsable_production',
        department: '', hire_date: new Date().toISOString().split('T')[0], status: 'active',
        hourly_rate: undefined, supervisor_id: '', notes: '',
        create_access_account: false, access_password: '', confirm_access_password: '',
      });
    }
  }, [employee, form]);

  const handleSubmit = async (data: EmployeeFormData) => {
    const payload = {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || null,
      phone: data.phone || null,
      role: data.role,
      department: data.department || null,
      hire_date: data.hire_date,
      status: data.status,
      hourly_rate: data.hourly_rate || null,
      supervisor_id: data.supervisor_id || null,
      notes: data.notes || null,
      create_access_account: !isEditing && data.create_access_account,
      access_password: !isEditing && data.create_access_account ? data.access_password || null : null,
    };

    if (isEditing && employeeId) await onSave({ id: employeeId, ...payload });
    else await onSave(payload);
    onOpenChange(false);
  };

  const supervisorOptions = employees.filter(e => e.id !== employeeId);
  const createAccessAccount = form.watch('create_access_account');
  const selectedRole = ROLE_CONFIG[form.watch('role')];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('employees.editEmployee') : t('employees.newEmployee')}</DialogTitle>
          <DialogDescription>{isEditing ? t('employees.editEmployeeDesc') : t('employees.newEmployeeDesc')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="first_name" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.firstName')} *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="last_name" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.lastName')} *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.email')}</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.phone')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.roleFunction')} *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t('employees.selectRole')} /></SelectTrigger></FormControl>
                    <SelectContent>{Object.values(ROLE_CONFIG).map((role) => (
                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                    ))}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.department')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="hire_date" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.hireDate')} *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>{t('common.status')} *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">{t('employees.employeeStatus.active')}</SelectItem>
                      <SelectItem value="inactive">{t('employees.employeeStatus.inactive')}</SelectItem>
                      <SelectItem value="on_leave">{t('employees.employeeStatus.onLeave')}</SelectItem>
                      <SelectItem value="terminated">{t('employees.employeeStatus.terminated')}</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hourly_rate" render={({ field }) => (
                <FormItem><FormLabel>{t('employees.hourlyRate')} (€)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="supervisor_id" render={({ field }) => (
              <FormItem><FormLabel>{t('employees.supervisor')}</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                  value={field.value || '__none__'}
                >
                  <FormControl><SelectTrigger><SelectValue placeholder={t('employees.noSupervisor')} /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">{t('common.none')}</SelectItem>
                    {supervisorOptions.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_number})</SelectItem>
                    ))}
                  </SelectContent>
                </Select><FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>{t('common.notes')}</FormLabel><FormControl><Textarea placeholder={t('employees.additionalInfo')} className="resize-none" rows={3} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            {!isEditing && (
              <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
                <FormField
                  control={form.control}
                  name="create_access_account"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Créer un compte de connexion</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          L employé pourra se connecter avec son email et le rôle {selectedRole?.label || 'sélectionné'}.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {createAccessAccount && (
                  <>
                    <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm text-muted-foreground">
                      Un accès applicatif sera créé en même temps que la fiche employé. Si la création du compte échoue, la fiche employé sera annulée automatiquement.
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField control={form.control} name="access_password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mot de passe temporaire *</FormLabel>
                          <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="confirm_access_password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmer le mot de passe *</FormLabel>
                          <FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">{isEditing ? t('common.save') : t('employees.createEmployee')}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
