import { useState, useEffect } from 'react';
import { hrApi } from '@/lib/api/hr';
import { useToast } from '@/hooks/use-toast';
import type { Timesheet, TimesheetStatus } from '@/types/roles';

interface CreateTimesheetData {
  work_date: string;
  start_time: string;
  end_time?: string | null;
  break_minutes?: number;
  task_description?: string | null;
  project_reference?: string | null;
  operation_module?: string | null;
  operation_id?: string | null;
  notes?: string | null;
}

interface UpdateTimesheetData extends CreateTimesheetData {
  id: string;
}

interface EmployeePointageOptions {
  operation_module?: string | null;
  operation_id?: string | null;
  project_reference?: string | null;
  notes?: string | null;
}

export function useTimesheets(employeeId?: string) {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTimesheets = async () => {
    try {
      const data = await hrApi.listTimesheets(employeeId ? { employee_id: employeeId } : undefined);
      setTimesheets((data as Timesheet[]) || []);
    } catch (error: any) {
      console.error('Error fetching timesheets:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les feuilles de temps',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTimesheets();
  }, [employeeId]);

  const createTimesheetForEmployee = async (
    targetEmployeeId: string,
    data: CreateTimesheetData,
    overrides?: { status?: TimesheetStatus; approved_by?: string | null; approved_at?: string | null },
  ): Promise<Timesheet> => {
    const payload = {
      employee_id: targetEmployeeId,
      work_date: data.work_date,
      start_time: data.start_time,
      end_time: data.end_time,
      break_minutes: data.break_minutes || 0,
      task_description: data.task_description,
      project_reference: data.project_reference,
      operation_module: data.operation_module || null,
      operation_id: data.operation_id || null,
      notes: data.notes,
      status: overrides?.status || ('draft' as TimesheetStatus),
      approved_by: overrides?.approved_by || null,
      approved_at: overrides?.approved_at || null,
    };

    const created = await hrApi.createTimesheet(payload);
    return created as Timesheet;
  };

  const createTimesheet = async (data: CreateTimesheetData) => {
    try {
      if (!employeeId) throw new Error('employeeId requis pour créer une feuille de temps');

      await createTimesheetForEmployee(employeeId, data, { status: 'draft' as TimesheetStatus });

      toast({
        title: 'Entrée créée',
        description: 'Feuille de temps enregistrée',
      });
      await fetchTimesheets();
    } catch (error: any) {
      console.error('Error creating timesheet:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer l\'entrée',
        variant: 'destructive',
      });
    }
  };

  const updateTimesheet = async (data: UpdateTimesheetData) => {
    try {
      const { id, ...updateData } = data;
      await hrApi.updateTimesheet(id, updateData as Record<string, unknown>);

      toast({
        title: 'Entrée modifiée',
        description: 'Feuille de temps mise à jour',
      });
      await fetchTimesheets();
    } catch (error: any) {
      console.error('Error updating timesheet:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de modifier l\'entrée',
        variant: 'destructive',
      });
    }
  };

  const clockInEmployee = async (targetEmployeeId: string, options?: EmployeePointageOptions) => {
    try {
      const workDate = new Date().toISOString().split('T')[0];
      const startTime = new Date().toTimeString().slice(0, 5);

      // Check for open sheet client-side (no .eq('end_time', null) query builder needed — fetch and filter)
      const existing = await hrApi.listTimesheets({ employee_id: targetEmployeeId });
      const openToday = (existing as Timesheet[]).find(
        (t) => t.work_date === workDate && !t.end_time,
      );
      if (openToday) {
        throw new Error('Cet employé a déjà un pointage d\'entrée ouvert aujourd\'hui.');
      }

      await createTimesheetForEmployee(
        targetEmployeeId,
        {
          work_date: workDate,
          start_time: startTime,
          end_time: null,
          break_minutes: 0,
          task_description: 'Pointage usine — entrée',
          project_reference: options?.project_reference || null,
          operation_module: options?.operation_module || null,
          operation_id: options?.operation_id || null,
          notes: options?.notes ? `POINTAGE_ENTREE\n${options.notes}` : 'POINTAGE_ENTREE',
        },
        {
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: 'Borne usine',
        },
      );

      toast({
        title: 'Entrée enregistrée',
        description: 'Le pointage d\'entrée a bien été enregistré.',
      });
      await fetchTimesheets();
    } catch (error: any) {
      console.error('Error clocking in employee:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'enregistrer l\'entrée',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const clockOutEmployee = async (targetEmployeeId: string, notes?: string | null) => {
    try {
      const workDate = new Date().toISOString().split('T')[0];
      const endTime = new Date().toTimeString().slice(0, 5);

      const allSheets = await hrApi.listTimesheets({ employee_id: targetEmployeeId });
      const todaySheets = (allSheets as Timesheet[]).filter(
        (t) => t.work_date === workDate && !t.end_time,
      );
      const openSheet = todaySheets.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0];

      if (!openSheet) {
        throw new Error('Aucun pointage d\'entrée ouvert à clôturer pour cet employé aujourd\'hui.');
      }

      const nextNotes = notes
        ? `${openSheet.notes ? `${openSheet.notes}\n` : ''}POINTAGE_SORTIE\n${notes}`
        : `${openSheet.notes ? `${openSheet.notes}\n` : ''}POINTAGE_SORTIE`;

      await hrApi.updateTimesheet(openSheet.id, { end_time: endTime, notes: nextNotes });

      toast({
        title: 'Sortie enregistrée',
        description: 'Le pointage de sortie a bien été enregistré.',
      });
      await fetchTimesheets();
    } catch (error: any) {
      console.error('Error clocking out employee:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'enregistrer la sortie',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteTimesheet = async (id: string) => {
    try {
      await hrApi.deleteTimesheet(id);
      toast({
        title: 'Entrée supprimée',
        description: 'Feuille de temps supprimée',
      });
      await fetchTimesheets();
    } catch (error: any) {
      console.error('Error deleting timesheet:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer l\'entrée',
        variant: 'destructive',
      });
    }
  };

  const submitTimesheet = async (id: string) => {
    try {
      await hrApi.updateTimesheet(id, {
        status: 'submitted' as TimesheetStatus,
        submitted_at: new Date().toISOString(),
      });
      toast({
        title: 'Soumise',
        description: 'Feuille de temps envoyée pour approbation',
      });
      await fetchTimesheets();
    } catch (error: any) {
      console.error('Error submitting timesheet:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de soumettre',
        variant: 'destructive',
      });
    }
  };

  const approveTimesheet = async (id: string, approvedBy = 'Système') => {
    try {
      await hrApi.updateTimesheet(id, {
        status: 'approved' as TimesheetStatus,
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
      });
      toast({
        title: 'Approuvée',
        description: 'Feuille de temps validée',
      });
      await fetchTimesheets();
    } catch (error: any) {
      console.error('Error approving timesheet:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'approuver',
        variant: 'destructive',
      });
    }
  };

  const rejectTimesheet = async (id: string, reason: string) => {
    try {
      await hrApi.updateTimesheet(id, {
        status: 'rejected' as TimesheetStatus,
        rejection_reason: reason,
      });
      toast({
        title: 'Refusée',
        description: 'Feuille de temps renvoyée pour correction',
        variant: 'destructive',
      });
      await fetchTimesheets();
    } catch (error: any) {
      console.error('Error rejecting timesheet:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de refuser',
        variant: 'destructive',
      });
    }
  };

  return {
    timesheets,
    isLoading,
    createTimesheet,
    createTimesheetForEmployee,
    updateTimesheet,
    deleteTimesheet,
    submitTimesheet,
    approveTimesheet,
    rejectTimesheet,
    clockInEmployee,
    clockOutEmployee,
    refetch: fetchTimesheets,
  };
}
