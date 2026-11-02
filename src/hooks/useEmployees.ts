import { canRead } from '@/lib/apiAccess';
import { useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/contexts/AuthContext';
import { hrApi } from '@/lib/api/hr';
import { useToast } from '@/hooks/use-toast';
import type { Employee, ActorRole, EmploymentStatus } from '@/types/roles';

export interface CreateEmployeeData {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  role: ActorRole;
  department?: string | null;
  hire_date: string;
  status: EmploymentStatus;
  hourly_rate?: number | null;
  supervisor_id?: string | null;
  notes?: string | null;
  create_access_account?: boolean;
  access_password?: string | null;
}

interface UpdateEmployeeData extends CreateEmployeeData {
  id: string;
}

const buildEmployeeWritePayload = (data: Omit<CreateEmployeeData, 'create_access_account' | 'access_password'>) => ({
  first_name: data.first_name,
  last_name: data.last_name,
  email: data.email,
  phone: data.phone,
  role: data.role,
  department: data.department,
  hire_date: data.hire_date,
  status: data.status,
  hourly_rate: data.hourly_rate,
  supervisor_id: data.supervisor_id,
  notes: data.notes,
});

export function useEmployees() {
  const { toast } = useToast();
  const { user, roles } = useAuthContext();
  const actorId = user?.id;
  const permitted = canRead(roles, 'employees');
  const source = useQuery<Employee[]>({
    queryKey: ['hr', actorId, permitted, 'employees'],
    queryFn: async () => (await hrApi.listEmployees()) as Employee[],
    enabled: Boolean(actorId) && permitted,
    retry: false,
    placeholderData: () => undefined,
  });
  const employees = source.data ?? [];
  const isLoading = source.isLoading;
  const fetchEmployees = useCallback(async () => { await source.refetch(); }, [source.refetch]);
  useEffect(() => {
    if (source.error) toast({ title: 'Erreur', description: 'Impossible de charger les employés', variant: 'destructive' });
  }, [source.error, toast]);

  const createEmployee = async (data: CreateEmployeeData) => {
    try {
      const { create_access_account, access_password, ...employeeData } = data;
      const employeePayload = buildEmployeeWritePayload(employeeData);

      const createdEmployee = await hrApi.createEmployee({
        ...employeePayload,
        user_id: null,
        employee_number: '',
      }) as Employee;

      if (create_access_account) {
        if (!employeeData.email || !access_password) {
          throw new Error('Email et mot de passe temporaire requis pour créer un accès applicatif.');
        }
        toast({
          title: 'Employé créé',
          description: `${employeeData.first_name} ${employeeData.last_name} a été ajouté (accès applicatif à configurer manuellement)`,
        });
        await fetchEmployees();
        return;
      }

      toast({
        title: 'Employé créé',
        description: `${employeeData.first_name} ${employeeData.last_name} a été ajouté`,
      });
      await fetchEmployees();
    } catch (error: any) {
      console.error('Error creating employee:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer l\'employé',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateEmployee = async (data: UpdateEmployeeData) => {
    try {
      const { id, create_access_account: _createAccessAccount, access_password: _accessPassword, ...updateData } = data;

      await hrApi.updateEmployee(id, buildEmployeeWritePayload(updateData));

      toast({
        title: 'Employé modifié',
        description: `${data.first_name} ${data.last_name} a été mis à jour`,
      });
      await fetchEmployees();
    } catch (error: any) {
      console.error('Error updating employee:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de modifier l\'employé',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteEmployee = async (id: string) => {
    try {
      const employee = employees.find(e => e.id === id);

      await hrApi.deleteEmployee(id);

      toast({
        title: 'Employé supprimé',
        description: employee
          ? `${employee.first_name} ${employee.last_name} a été supprimé`
          : 'Employé supprimé',
      });
      await fetchEmployees();
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer l\'employé',
        variant: 'destructive',
      });
    }
  };

  return {
    data: source.data,
    error: actorId && !permitted ? { status: 403, message: 'Votre compte ne donne pas accès à ces données.' } : source.error,
    updatedAt: source.dataUpdatedAt,
    employees,
    isLoading,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    refetch: fetchEmployees,
  };
}
