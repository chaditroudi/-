import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { startOfWeek, addDays, format, isSameDay } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import type { Timesheet } from '@/types/roles';

interface TimesheetWeekViewProps {
  timesheets: Timesheet[];
}

export function TimesheetWeekView({ timesheets }: TimesheetWeekViewProps) {
  const { t, i18n } = useTranslation();

  const getLocale = () => {
    switch (i18n.language) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  };

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const getTimesheetsForDay = (date: Date) => timesheets.filter(t => isSameDay(new Date(t.work_date), date));

  const totalWeekHours = timesheets
    .filter(t => {
      const date = new Date(t.work_date);
      return date >= weekStart && date <= addDays(weekStart, 6);
    })
    .reduce((sum, t) => sum + (Number(t.hours_worked) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          {t('common.weekOf')} {format(weekStart, 'dd MMMM yyyy', { locale: getLocale() })}
        </h3>
        <Badge variant="outline" className="text-lg px-4 py-1">
          {t('common.total')}: {totalWeekHours.toFixed(1)}h
        </Badge>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dayTimesheets = getTimesheetsForDay(day);
          const dayHours = dayTimesheets.reduce((sum, t) => sum + (Number(t.hours_worked) || 0), 0);
          const isToday = isSameDay(day, new Date());
          
          return (
            <div 
              key={day.toISOString()} 
              className={`border rounded-lg p-3 min-h-[120px] ${isToday ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
            >
              <div className="text-center mb-2">
                <p className="text-xs text-muted-foreground">{format(day, 'EEEE', { locale: getLocale() })}</p>
                <p className={`text-lg font-bold ${isToday ? 'text-emerald-700' : ''}`}>{format(day, 'dd')}</p>
              </div>
              {dayTimesheets.length > 0 ? (
                <div className="space-y-1">
                  {dayTimesheets.map((ts) => (
                    <div key={ts.id} className="bg-white border rounded p-1.5 text-xs">
                      <p className="font-medium">{ts.start_time?.slice(0, 5)} - {ts.end_time?.slice(0, 5)}</p>
                      <p className="text-muted-foreground truncate">{ts.task_description || t('common.noDescription')}</p>
                    </div>
                  ))}
                  <div className="text-center"><Badge variant="secondary" className="text-xs">{dayHours.toFixed(1)}h</Badge></div>
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground">{t('common.noEntry')}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}