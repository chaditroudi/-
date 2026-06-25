import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { enUS, fr, ar } from 'date-fns/locale';
import { MoreHorizontal, Pencil, Trash2, Play, CheckCircle, Clock, AlertTriangle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import type { EmployeeTask } from '@/hooks/useTasks';

interface TasksListProps {
  tasks: EmployeeTask[];
  isLoading: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}

export function TasksList({ tasks, isLoading, onEdit, onDelete, onStatusChange }: TasksListProps) {
  const { t, i18n } = useTranslation();

  const getLocale = () => {
    switch (i18n.language) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const priorityConfig = {
    low: { label: t('tasks.priorities.low'), variant: 'secondary' as const, className: 'bg-slate-100 text-slate-700' },
    medium: { label: t('tasks.priorities.medium'), variant: 'default' as const, className: 'bg-blue-100 text-blue-700' },
    high: { label: t('tasks.priorities.high'), variant: 'default' as const, className: 'bg-orange-100 text-orange-700' },
    urgent: { label: t('tasks.priorities.urgent'), variant: 'destructive' as const, className: 'bg-red-100 text-red-700' },
  };

  const statusConfig = {
    pending: { label: t('tasks.statuses.todo'), icon: Clock, className: 'bg-slate-100 text-slate-700' },
    in_progress: { label: t('tasks.statuses.inProgress'), icon: Play, className: 'bg-blue-100 text-blue-700' },
    completed: { label: t('tasks.statuses.completed'), icon: CheckCircle, className: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: t('tasks.statuses.cancelled'), icon: AlertTriangle, className: 'bg-red-100 text-red-700' },
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">{t('common.noData')}</p>
      </div>
    );
  }

  const isOverdue = (task: EmployeeTask) => {
    return task.due_date && 
      new Date(task.due_date) < new Date() && 
      task.status !== 'completed' && 
      task.status !== 'cancelled';
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('tasks.taskTitle')}</TableHead>
          <TableHead>{t('tasks.assignedTo')}</TableHead>
          <TableHead>{t('tasks.priority')}</TableHead>
          <TableHead>{t('common.status')}</TableHead>
          <TableHead>{t('tasks.dueDate')}</TableHead>
          <TableHead className="text-end">{t('common.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const priority = priorityConfig[task.priority];
          const status = statusConfig[task.status];
          const StatusIcon = status.icon;
          const overdue = isOverdue(task);

          return (
            <TableRow key={task.id} className={overdue ? 'bg-red-50' : undefined}>
              <TableCell>
                <div>
                  <p className="font-medium">{task.title}</p>
                  {task.description && (
                    <p className="text-sm text-muted-foreground truncate max-w-xs">
                      {task.description}
                    </p>
                  )}
                  {task.department && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {task.department}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {task.employee ? (
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {task.employee.first_name} {task.employee.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {task.employee.employee_number}
                      </p>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
              <TableCell>
                <Badge className={priority.className}>
                  {priority.label}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={status.className}>
                  <StatusIcon className="h-3 w-3 me-1" />
                  {status.label}
                </Badge>
              </TableCell>
              <TableCell>
                {task.due_date ? (
                  <div className={overdue ? 'text-red-600 font-medium' : undefined}>
                    {format(new Date(task.due_date), 'dd MMM yyyy', { locale: getLocale() })}
                    {overdue && (
                      <div className="flex items-center gap-1 text-xs text-red-500">
                        <AlertTriangle className="h-3 w-3" />
                        {t('alerts.severity.high')}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(task.id)}>
                      <Pencil className="h-4 w-4 me-2" />
                      {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {task.status === 'pending' && (
                      <DropdownMenuItem onClick={() => onStatusChange(task.id, 'in_progress')}>
                        <Play className="h-4 w-4 me-2" />
                        {t('tasks.statuses.inProgress')}
                      </DropdownMenuItem>
                    )}
                    {task.status === 'in_progress' && (
                      <DropdownMenuItem onClick={() => onStatusChange(task.id, 'completed')}>
                        <CheckCircle className="h-4 w-4 me-2" />
                        {t('tasks.statuses.completed')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onDelete(task.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 me-2" />
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
