import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BadgeCheck,
  Clock3,
  LogIn,
  LogOut,
  Search,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEmployees } from '@/hooks/useEmployees';
import type { Timesheet, TimesheetOperationModule } from '@/types/roles';

const MODULE_OPTIONS: Array<{ value: TimesheetOperationModule | 'GENERAL'; label: string }> = [
  { value: 'GENERAL', label: 'Général' },
  { value: 'FUMIGATION', label: 'Fumigation' },
  { value: 'NETTOYAGE', label: 'Nettoyage' },
  { value: 'HYDRATATION', label: 'Hydratation' },
  { value: 'TRIAGE', label: 'Triage' },
  { value: 'CONDITIONNEMENT', label: 'Conditionnement' },
];

type PointageStatus = 'not_started' | 'clocked_in' | 'completed';

interface PointageExpressPanelProps {
  timesheets: Timesheet[];
  isLoading?: boolean;
  onClockIn: (employeeId: string, options?: {
    operation_module?: string | null;
    operation_id?: string | null;
    project_reference?: string | null;
    notes?: string | null;
  }) => Promise<void>;
  onClockOut: (employeeId: string, notes?: string | null) => Promise<void>;
}

export function PointageExpressPanel({
  timesheets,
  isLoading = false,
  onClockIn,
  onClockOut,
}: PointageExpressPanelProps) {
  const { employees, isLoading: isEmployeesLoading } = useEmployees();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<TimesheetOperationModule | 'GENERAL'>('GENERAL');
  const [operationRef, setOperationRef] = useState('');
  const [sharedNote, setSharedNote] = useState('');
  const [busyEmployeeId, setBusyEmployeeId] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const todayTimesheets = useMemo(
    () => timesheets.filter((timesheet) => timesheet.work_date === today),
    [timesheets, today],
  );

  const employeeRows = useMemo(() => {
    const activeEmployees = employees.filter((employee) => employee.status === 'active');

    return activeEmployees
      .map((employee) => {
        const employeeTimesheets = todayTimesheets
          .filter((timesheet) => timesheet.employee_id === employee.id)
          .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());

        const latest = employeeTimesheets[0] || null;
        let status: PointageStatus = 'not_started';

        if (latest?.end_time) status = 'completed';
        else if (latest?.start_time) status = 'clocked_in';

        return {
          employee,
          latest,
          status,
        };
      })
      .filter(({ employee }) => {
        const haystack = [
          employee.first_name,
          employee.last_name,
          employee.employee_number,
          employee.department || '',
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(searchTerm.toLowerCase());
      })
      .sort((left, right) => {
        const statusRank: Record<PointageStatus, number> = {
          clocked_in: 0,
          not_started: 1,
          completed: 2,
        };

        return (
          statusRank[left.status] - statusRank[right.status]
          || left.employee.last_name.localeCompare(right.employee.last_name)
        );
      });
  }, [employees, todayTimesheets, searchTerm]);

  const summary = useMemo(() => {
    const activeCount = employees.filter((employee) => employee.status === 'active').length;
    const presentNow = employeeRows.filter((row) => row.status === 'clocked_in').length;
    const checkedOut = employeeRows.filter((row) => row.status === 'completed').length;
    const notStarted = employeeRows.filter((row) => row.status === 'not_started').length;

    return { activeCount, presentNow, checkedOut, notStarted };
  }, [employeeRows, employees]);

  const recentEvents = useMemo(() => {
    return [...todayTimesheets]
      .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
      .slice(0, 6)
      .map((timesheet) => {
        const employee = employees.find((item) => item.id === timesheet.employee_id);
        return {
          timesheet,
          employeeName: employee ? `${employee.first_name} ${employee.last_name}` : timesheet.employee_id,
        };
      });
  }, [employees, todayTimesheets]);

  const handleClockIn = async (employeeId: string) => {
    setBusyEmployeeId(employeeId);
    try {
      await onClockIn(employeeId, {
        operation_module: selectedModule === 'GENERAL' ? null : selectedModule,
        operation_id: operationRef || null,
        project_reference: operationRef || null,
        notes: sharedNote || null,
      });
    } finally {
      setBusyEmployeeId(null);
    }
  };

  const handleClockOut = async (employeeId: string) => {
    setBusyEmployeeId(employeeId);
    try {
      await onClockOut(employeeId, sharedNote || null);
    } finally {
      setBusyEmployeeId(null);
    }
  };

  const getStatusBadge = (status: PointageStatus) => {
    switch (status) {
      case 'clocked_in':
        return <Badge className="bg-emerald-600 text-white">Présent</Badge>;
      case 'completed':
        return <Badge className="bg-slate-700 text-white">Sorti</Badge>;
      default:
        return <Badge variant="outline">Pas pointé</Badge>;
    }
  };

  const getStatusText = (row: { status: PointageStatus; latest: Timesheet | null }) => {
    if (!row.latest) return 'Aucun pointage aujourd’hui';
    if (row.status === 'clocked_in') return `Entrée à ${row.latest.start_time?.slice(0, 5) || '--:--'}`;
    return `Sortie à ${row.latest.end_time?.slice(0, 5) || '--:--'}`;
  };

  return (
    <div className="space-y-5">
      <Card className="surface-card overflow-hidden rounded-[28px] border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(238,247,240,0.92)_38%,rgba(255,255,255,0.96)_100%)]">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                Pointage Express
              </div>
              <CardTitle className="mt-3 text-2xl">Borne digitale pour remplacer le papier</CardTitle>
              <CardDescription className="mt-2 max-w-2xl text-sm leading-6">
                Les agents peuvent être pointés en quelques secondes, avec état de présence en direct, référence d’atelier et historique de la journée.
              </CardDescription>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Actifs</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{summary.activeCount}</p>
              </div>
              <div className="rounded-2xl border bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Présents</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-700">{summary.presentNow}</p>
              </div>
              <div className="rounded-2xl border bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Sortis</p>
                <p className="mt-1 text-2xl font-semibold text-slate-800">{summary.checkedOut}</p>
              </div>
              <div className="rounded-2xl border bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">À pointer</p>
                <p className="mt-1 text-2xl font-semibold text-amber-700">{summary.notStarted}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 border-t border-border/50 pt-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Chercher par nom, matricule, service..."
                className="pl-10"
              />
            </div>
            <Select value={selectedModule} onValueChange={(value) => setSelectedModule(value as TimesheetOperationModule | 'GENERAL')}>
              <SelectTrigger>
                <SelectValue placeholder="Module atelier" />
              </SelectTrigger>
              <SelectContent>
                {MODULE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={operationRef}
              onChange={(event) => setOperationRef(event.target.value)}
              placeholder="Réf. OF / ligne / équipe"
            />
          </div>

          <Input
            value={sharedNote}
            onChange={(event) => setSharedNote(event.target.value)}
            placeholder="Note commune optionnelle pour ce lot de pointage"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="surface-card rounded-[28px]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-primary" />
              Équipe du jour
            </CardTitle>
            <CardDescription>
              Entrée et sortie en un clic, avec statut de présence visible immédiatement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || isEmployeesLoading ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                Chargement du pointage...
              </div>
            ) : employeeRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                Aucun employé actif trouvé avec ce filtre.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {employeeRows.map((row) => {
                  const fullName = `${row.employee.first_name} ${row.employee.last_name}`;
                  const initials = `${row.employee.first_name[0] || ''}${row.employee.last_name[0] || ''}`.toUpperCase();
                  const isBusy = busyEmployeeId === row.employee.id;

                  return (
                    <div key={row.employee.id} className="rounded-[24px] border border-border/70 bg-background/80 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 font-semibold text-primary">
                            {initials || <UserRound className="h-5 w-5" />}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{fullName}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.employee.employee_number} {row.employee.department ? `· ${row.employee.department}` : ''}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(row.status)}
                      </div>

                      <div className="mt-4 space-y-2 rounded-2xl bg-muted/30 p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">État</span>
                          <span className="font-medium text-foreground">{getStatusText(row)}</span>
                        </div>
                        {row.latest?.updated_at && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Dernière activité</span>
                            <span className="font-medium text-foreground">
                              {formatDistanceToNow(new Date(row.latest.updated_at), { addSuffix: true, locale: fr })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex gap-2">
                        {row.status === 'clocked_in' ? (
                          <Button
                            className="flex-1 bg-red-600 hover:bg-red-700"
                            disabled={isBusy}
                            onClick={() => void handleClockOut(row.employee.id)}
                          >
                            <LogOut className="mr-2 h-4 w-4" />
                            {isBusy ? 'Enregistrement...' : 'Sortie'}
                          </Button>
                        ) : (
                          <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            disabled={isBusy}
                            onClick={() => void handleClockIn(row.employee.id)}
                          >
                            <LogIn className="mr-2 h-4 w-4" />
                            {isBusy ? 'Enregistrement...' : 'Entrée'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card rounded-[28px]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Clock3 className="h-5 w-5 text-primary" />
              Historique du jour
            </CardTitle>
            <CardDescription>
              Les derniers mouvements de présence, utiles pour le chef d’équipe et rassurants pour le client usine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                Aucun pointage enregistré aujourd’hui.
              </div>
            ) : (
              recentEvents.map(({ timesheet, employeeName }) => {
                const isOpen = !timesheet.end_time;
                return (
                  <div key={timesheet.id} className="rounded-2xl border border-border/70 bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{employeeName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {timesheet.start_time?.slice(0, 5) || '--:--'}
                          {timesheet.end_time ? ` → ${timesheet.end_time.slice(0, 5)}` : ' → en poste'}
                        </p>
                      </div>
                      <Badge className={isOpen ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'}>
                        {isOpen ? 'En poste' : 'Clôturé'}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {timesheet.operation_module && (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                          {timesheet.operation_module}
                        </span>
                      )}
                      {timesheet.project_reference && (
                        <span className="rounded-full bg-muted px-2 py-1">
                          {timesheet.project_reference}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {timesheet.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
