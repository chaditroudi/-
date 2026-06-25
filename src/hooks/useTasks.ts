import { useState, useEffect, useCallback } from 'react';
import { hrApi } from '@/lib/api/hr';
import { useToast } from '@/hooks/use-toast';

export interface EmployeeTask {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date: string | null;
  completed_at: string | null;
  department: string | null;
  related_batch_id: string | null;
  related_production_order_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employee?: {
    first_name: string;
    last_name: string;
    employee_number: string;
  } | null;
}

interface CreateTaskData {
  title: string;
  description?: string;
  assigned_to?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  department?: string;
  related_batch_id?: string;
  related_production_order_id?: string;
  notes?: string;
}

export function useTasks() {
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTasks = useCallback(async () => {
    try {
      const data = await hrApi.listTasks();
      setTasks((data as EmployeeTask[]) || []);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les tâches',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = async (data: CreateTaskData) => {
    try {
      await hrApi.createTask({
        title: data.title,
        description: data.description || null,
        assigned_to: data.assigned_to || null,
        priority: data.priority || 'medium',
        due_date: data.due_date || null,
        department: data.department || null,
        related_batch_id: data.related_batch_id || null,
        related_production_order_id: data.related_production_order_id || null,
        notes: data.notes || null,
      });

      toast({
        title: 'Tâche créée',
        description: `"${data.title}" a été ajoutée`,
      });
      await fetchTasks();
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer la tâche',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateTask = async (id: string, data: Partial<CreateTaskData & { status: string }>) => {
    try {
      const updateData: Record<string, unknown> = { ...data };

      if (data.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      await hrApi.updateTask(id, updateData);

      toast({
        title: 'Tâche mise à jour',
        description: 'La tâche a été modifiée',
      });
      await fetchTasks();
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de mettre à jour la tâche',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await hrApi.deleteTask(id);

      toast({
        title: 'Tâche supprimée',
        description: 'La tâche a été supprimée',
      });
      await fetchTasks();
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer la tâche',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const getTaskStats = () => {
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const urgent = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length;
    const overdue = tasks.filter(t =>
      t.due_date &&
      new Date(t.due_date) < new Date() &&
      t.status !== 'completed' &&
      t.status !== 'cancelled'
    ).length;

    return { pending, inProgress, completed, urgent, overdue, total: tasks.length };
  };

  return {
    tasks,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    getTaskStats,
    refetch: fetchTasks,
  };
}
