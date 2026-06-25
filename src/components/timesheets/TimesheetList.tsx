import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Edit, Trash2, CheckCircle, XCircle, Send } from 'lucide-react';
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
import type { Timesheet } from '@/types/roles';
import { format } from 'date-fns';
import { enUS, fr, ar } from 'date-fns/locale';

interface TimesheetListProps {
  timesheets: Timesheet[];
  isLoading: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string, reason: string) => void;
  showApprovalActions?: boolean;
}

export function TimesheetList({ 
  timesheets, 
  isLoading, 
  onEdit, 
  onDelete,
  onApprove,
  onReject,
  showApprovalActions = false
}: TimesheetListProps) {
  const { t, i18n } = useTranslation();

  const getLocale = () => {
    switch (i18n.language) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    draft: { label: t('purchasing.status.draft'), className: 'bg-slate-100 text-slate-800' },
    submitted: { label: t('purchasing.status.sent'), className: 'bg-blue-100 text-blue-800' },
    approved: { label: t('common.approved'), className: 'bg-emerald-100 text-emerald-800' },
    rejected: { label: t('common.rejected'), className: 'bg-red-100 text-red-800' },
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (timesheets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{t('common.noData')}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('common.date')}</TableHead>
          <TableHead>{t('timesheets.startTime')} - {t('timesheets.endTime')}</TableHead>
          <TableHead>{t('timesheets.breakDuration')}</TableHead>
          <TableHead>{t('timesheets.totalHours')}</TableHead>
          <TableHead>{t('timesheets.project')}</TableHead>
          <TableHead>{t('common.description')}</TableHead>
          <TableHead>{t('common.status')}</TableHead>
          <TableHead className="text-end">{t('common.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {timesheets.map((timesheet) => {
          const status = statusConfig[timesheet.status];
          const canEdit = timesheet.status === 'draft' || timesheet.status === 'rejected';
          
          return (
            <TableRow key={timesheet.id}>
              <TableCell className="font-medium">
                {format(new Date(timesheet.work_date), 'EEEE dd MMM', { locale: getLocale() })}
              </TableCell>
              <TableCell>
                {timesheet.start_time?.slice(0, 5)} - {timesheet.end_time?.slice(0, 5) || '--:--'}
              </TableCell>
              <TableCell>{timesheet.break_minutes} min</TableCell>
              <TableCell>
                <span className="font-semibold">
                  {timesheet.hours_worked ? `${Number(timesheet.hours_worked).toFixed(1)}h` : '-'}
                </span>
              </TableCell>
              <TableCell>
                {timesheet.project_reference ? (
                  <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">
                    {timesheet.project_reference}
                  </code>
                ) : '-'}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {timesheet.task_description || '-'}
              </TableCell>
              <TableCell>
                <Badge className={status.className}>{status.label}</Badge>
              </TableCell>
              <TableCell className="text-end">
                {showApprovalActions && timesheet.status === 'submitted' ? (
                  <div className="flex items-center justify-end gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                      onClick={() => onApprove?.(timesheet.id)}
                    >
                      <CheckCircle className="h-4 w-4 me-1" />
                      {t('common.approved')}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => onReject?.(timesheet.id, 'Informations incomplètes')}
                    >
                      <XCircle className="h-4 w-4 me-1" />
                      {t('common.rejected')}
                    </Button>
                  </div>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && (
                        <>
                          <DropdownMenuItem onClick={() => onEdit(timesheet.id)}>
                            <Edit className="h-4 w-4 me-2" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Send className="h-4 w-4 me-2" />
                            {t('common.confirm')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {onApprove && timesheet.status === 'submitted' && (
                        <>
                          <DropdownMenuItem onClick={() => onApprove(timesheet.id)}>
                            <CheckCircle className="h-4 w-4 me-2" />
                            {t('common.approved')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => onReject?.(timesheet.id, 'Informations incomplètes')}
                          >
                            <XCircle className="h-4 w-4 me-2" />
                            {t('common.rejected')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {canEdit && (
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => onDelete(timesheet.id)}
                        >
                          <Trash2 className="h-4 w-4 me-2" />
                          {t('common.delete')}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
