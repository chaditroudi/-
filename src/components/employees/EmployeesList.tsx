import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Edit, Trash2, Clock, Mail, Phone, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ROLE_CONFIG, type Employee } from '@/types/roles';
import { format } from 'date-fns';
import { enUS, fr, ar } from 'date-fns/locale';

interface EmployeesListProps {
  employees: Employee[];
  isLoading: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function EmployeesList({ employees, isLoading, onEdit, onDelete }: EmployeesListProps) {
  const { t, i18n } = useTranslation();

  const getLocale = () => {
    switch (i18n.language) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800',
    inactive: 'bg-slate-100 text-slate-800',
    on_leave: 'bg-amber-100 text-amber-800',
    terminated: 'bg-red-100 text-red-800',
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return t('common.active');
      case 'inactive': return t('common.inactive');
      case 'on_leave': return t('timesheets.pending');
      case 'terminated': return t('common.completed');
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{t('common.noResults')}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('employees.title')}</TableHead>
          <TableHead>{t('employees.number')}</TableHead>
          <TableHead>{t('employees.role')}</TableHead>
          <TableHead>{t('employees.department')}</TableHead>
          <TableHead>{t('employees.hireDate')}</TableHead>
          <TableHead>Accès</TableHead>
          <TableHead>{t('common.status')}</TableHead>
          <TableHead className="text-end">{t('common.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => {
          const roleInfo = ROLE_CONFIG[employee.role];
          const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();
          const hasAccess = Boolean(employee.user_id);
          
          return (
            <TableRow key={employee.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {employee.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {employee.email}
                        </span>
                      )}
                      {employee.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {employee.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <code className="bg-slate-100 px-2 py-1 rounded text-sm">
                  {employee.employee_number}
                </code>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{roleInfo?.label || employee.role}</Badge>
              </TableCell>
              <TableCell>{employee.department || roleInfo?.department || '-'}</TableCell>
              <TableCell>
                {format(new Date(employee.hire_date), 'dd MMM yyyy', { locale: getLocale() })}
              </TableCell>
              <TableCell>
                <Badge
                  variant={hasAccess ? 'success' : 'outline'}
                  className="inline-flex items-center gap-1"
                >
                  <KeyRound className="h-3 w-3" />
                  {hasAccess ? 'Compte actif' : 'Pas de login'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={statusColors[employee.status]}>
                  {getStatusLabel(employee.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(employee.id)}>
                      <Edit className="h-4 w-4 me-2" />
                      {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Clock className="h-4 w-4 me-2" />
                      {t('nav.timesheets')}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-600"
                      onClick={() => onDelete(employee.id)}
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
